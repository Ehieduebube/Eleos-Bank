import { randomUUID } from "node:crypto";
import type {
  Account,
  AppNotification,
  Beneficiary,
  LedgerEntry,
  Profile,
  SecurityStatus,
  Transaction,
  TransactionPage,
  TransactionQuery,
  UserPreferences,
  VirtualCard,
} from "@/lib/types";
import { DEMO_USER } from "../config";
import { AppError, Errors } from "../errors";
import { LocalStore, defaultStorePath, type LocalDb } from "../local/store";
import { generateReference } from "../references";
import { buildDemoSeed } from "../seed/demo-seed";
import { compareTransactions, matchesQuery, paginate } from "./query";
import type {
  BankRepository,
  BeneficiaryData,
  CardPatch,
  NewUser,
  PinRecord,
  PostingIntent,
  PostingResult,
  SettlementOutcome,
} from "./types";

const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCK_MINUTES = 15;

function uniqueReference(db: LocalDb, at: Date): string {
  const existing = new Set(db.transactions.map((t) => t.reference));
  for (let i = 0; i < 5; i++) {
    const ref = generateReference(at);
    if (!existing.has(ref)) return ref;
  }
  throw new AppError("INTERNAL", "Could not allocate a unique transaction reference.");
}

/** Insert a full demo account for `user` into the draft db (no-op if one exists). */
export function provisionInto(db: LocalDb, user: NewUser, now = new Date()): void {
  if (db.accounts.some((a) => a.userId === user.id)) return;
  const existingProfile = db.profiles.find((p) => p.id === user.id);
  const references = new Set(db.transactions.map((t) => t.reference));
  const seed = buildDemoSeed({
    userId: user.id,
    email: existingProfile?.email ?? user.email,
    fullName: existingProfile?.fullName ?? user.fullName,
    phone: existingProfile?.phone ?? user.phone,
    now,
    newReference: (at) => {
      let ref = generateReference(at);
      while (references.has(ref)) ref = generateReference(at);
      references.add(ref);
      return ref;
    },
  });
  if (!existingProfile) db.profiles.push(seed.profile);
  db.accounts.push(seed.account);
  db.cards.push(seed.card);
  if (!db.preferences.some((p) => p.userId === user.id)) db.preferences.push(seed.preferences);
  if (!db.security.some((s) => s.userId === user.id)) {
    db.security.push({ userId: user.id, pinHash: null, pinUpdatedAt: null, failedPinAttempts: 0, pinLockedUntil: null });
  }
  db.transactions.push(...seed.transactions);
  db.ledgerEntries.push(...seed.ledgerEntries);
  db.beneficiaries.push(...seed.beneficiaries);
  db.notifications.push(...seed.notifications);
}

/** Seeds the passwordless primary demo user into a fresh store. */
export function bootstrapDemoUser(db: LocalDb): void {
  if (db.users.some((u) => u.email === DEMO_USER.email)) return;
  const id = randomUUID();
  db.users.push({ id, email: DEMO_USER.email, passwordHash: null, isDemo: true, createdAt: new Date().toISOString() });
  provisionInto(db, { id, email: DEMO_USER.email, fullName: DEMO_USER.fullName, phone: DEMO_USER.phone });
}

/** Safety net: the stored balance must always equal the sum of its ledger entries. */
function assertLedgerConsistent(db: LocalDb, account: Account): void {
  const sum = db.ledgerEntries
    .filter((e) => e.accountId === account.id)
    .reduce((acc, e) => acc + (e.direction === "credit" ? e.amount : -e.amount), 0);
  if (sum !== account.balance) {
    throw new AppError("INTERNAL", `Ledger inconsistency detected for account ${account.id}; operation aborted.`);
  }
}

function assertValidIntent(intent: PostingIntent, direction: "debit" | "credit") {
  if (intent.direction !== direction) throw new AppError("VALIDATION", `Expected a ${direction} intent.`);
  if (!Number.isSafeInteger(intent.amount) || intent.amount <= 0) throw new AppError("VALIDATION", "Amount must be a positive whole number of kobo.");
  if (!Number.isSafeInteger(intent.fee) || intent.fee < 0) throw new AppError("VALIDATION", "Fee must be a non-negative whole number of kobo.");
  if (direction === "credit" && intent.fee !== 0) throw new AppError("VALIDATION", "Credits cannot carry a fee.");
}

export class LocalBankRepository implements BankRepository {
  readonly mode = "local" as const;

  constructor(private readonly store: LocalStore) {}

  // ---- helpers -------------------------------------------------------------

  private accountOf(db: LocalDb, userId: string): Account {
    const account = db.accounts.find((a) => a.userId === userId);
    if (!account) throw Errors.notFound("Account");
    return account;
  }

  private replay(db: LocalDb, userId: string, key: string, fingerprint: string): PostingResult | null {
    const record = db.idempotency.find((r) => r.userId === userId && r.key === key);
    if (!record) return null;
    if (record.fingerprint !== fingerprint) throw Errors.idempotencyConflict();
    const transaction = db.transactions.find((t) => t.id === record.transactionId && t.userId === userId);
    if (!transaction) throw new AppError("INTERNAL", "Idempotency record points at a missing transaction.");
    return { transaction, replayed: true };
  }

  private newTransaction(db: LocalDb, userId: string, account: Account, key: string, intent: PostingIntent, now: Date): Transaction {
    const iso = now.toISOString();
    return {
      id: randomUUID(),
      userId,
      accountId: account.id,
      reference: uniqueReference(db, now),
      idempotencyKey: key,
      type: intent.type,
      direction: intent.direction,
      status: "pending",
      amount: intent.amount,
      fee: intent.fee,
      total: intent.direction === "debit" ? intent.amount + intent.fee : intent.amount,
      description: intent.description,
      narration: intent.narration,
      details: intent.details,
      balanceAfter: null,
      failureReason: null,
      provider: intent.provider,
      providerReference: null,
      isDemo: true,
      createdAt: iso,
      updatedAt: iso,
      completedAt: null,
    };
  }

  private postEntry(db: LocalDb, account: Account, transactionId: string, entryType: LedgerEntry["entryType"], direction: "debit" | "credit", amount: number, at: string) {
    account.balance += direction === "credit" ? amount : -amount;
    account.updatedAt = at;
    db.ledgerEntries.push({ id: randomUUID(), accountId: account.id, transactionId, entryType, direction, amount, balanceAfter: account.balance, createdAt: at });
  }

  // ---- provisioning ---------------------------------------------------------

  async ensureProvisioned(user: NewUser): Promise<void> {
    const exists = await this.store.read((db) => db.accounts.some((a) => a.userId === user.id));
    if (exists) return;
    await this.store.write((db) => provisionInto(db, user));
  }

  async resetDemoData(userId: string): Promise<void> {
    await this.store.write((db) => {
      const profile = db.profiles.find((p) => p.id === userId);
      if (!profile) throw Errors.notFound("Profile");
      const accountIds = new Set(db.accounts.filter((a) => a.userId === userId).map((a) => a.id));
      db.transactions = db.transactions.filter((t) => t.userId !== userId);
      db.ledgerEntries = db.ledgerEntries.filter((e) => !accountIds.has(e.accountId));
      db.accounts = db.accounts.filter((a) => a.userId !== userId);
      db.cards = db.cards.filter((c) => c.userId !== userId);
      db.beneficiaries = db.beneficiaries.filter((b) => b.userId !== userId);
      db.notifications = db.notifications.filter((n) => n.userId !== userId);
      db.idempotency = db.idempotency.filter((r) => r.userId !== userId);
      provisionInto(db, { id: userId, email: profile.email, fullName: profile.fullName, phone: profile.phone });
    });
  }

  // ---- profile / account / prefs / card -------------------------------------

  getProfile(userId: string): Promise<Profile | null> {
    return this.store.read((db) => db.profiles.find((p) => p.id === userId) ?? null);
  }

  updateProfile(userId: string, patch: { fullName?: string; email?: string; phone?: string | null }): Promise<Profile> {
    return this.store.write((db) => {
      const profile = db.profiles.find((p) => p.id === userId);
      if (!profile) throw Errors.notFound("Profile");
      if (patch.email && patch.email !== profile.email) {
        if (db.users.some((u) => u.email === patch.email && u.id !== userId)) {
          throw new AppError("CONFLICT", "That email address is already in use.", { email: "That email address is already in use." });
        }
        const user = db.users.find((u) => u.id === userId);
        if (user) user.email = patch.email;
        profile.email = patch.email;
      }
      if (patch.fullName !== undefined) profile.fullName = patch.fullName;
      if (patch.phone !== undefined) profile.phone = patch.phone;
      profile.updatedAt = new Date().toISOString();
      return profile;
    });
  }

  getAccount(userId: string): Promise<Account | null> {
    return this.store.read((db) => db.accounts.find((a) => a.userId === userId) ?? null);
  }

  getPreferences(userId: string): Promise<UserPreferences | null> {
    return this.store.read((db) => db.preferences.find((p) => p.userId === userId) ?? null);
  }

  updatePreferences(userId: string, patch: Partial<Omit<UserPreferences, "userId" | "updatedAt">>): Promise<UserPreferences> {
    return this.store.write((db) => {
      const prefs = db.preferences.find((p) => p.userId === userId);
      if (!prefs) throw Errors.notFound("Preferences");
      Object.assign(prefs, patch, { updatedAt: new Date().toISOString() });
      return prefs;
    });
  }

  getCard(userId: string): Promise<VirtualCard | null> {
    return this.store.read((db) => db.cards.find((c) => c.userId === userId) ?? null);
  }

  updateCard(userId: string, patch: CardPatch): Promise<VirtualCard> {
    return this.store.write((db) => {
      const card = db.cards.find((c) => c.userId === userId);
      if (!card) throw Errors.notFound("Card");
      Object.assign(card, patch, { updatedAt: new Date().toISOString() });
      return card;
    });
  }

  // ---- transactions ---------------------------------------------------------

  listTransactions(userId: string, query: TransactionQuery): Promise<TransactionPage> {
    return this.store.read((db) =>
      paginate(
        db.transactions.filter((t) => t.userId === userId && matchesQuery(t, query)).sort(compareTransactions(query.sort)),
        query,
      ),
    );
  }

  exportTransactions(userId: string, query: TransactionQuery, cap = 5000): Promise<Transaction[]> {
    return this.store.read((db) =>
      db.transactions
        .filter((t) => t.userId === userId && matchesQuery(t, query))
        .sort(compareTransactions(query.sort))
        .slice(0, cap),
    );
  }

  listRecentTransactions(userId: string, sinceIso?: string): Promise<Transaction[]> {
    return this.store.read((db) =>
      db.transactions
        .filter((t) => t.userId === userId && (!sinceIso || t.createdAt >= sinceIso))
        .sort(compareTransactions("date_desc")),
    );
  }

  getTransaction(userId: string, idOrReference: string): Promise<Transaction | null> {
    return this.store.read(
      (db) => db.transactions.find((t) => t.userId === userId && (t.id === idOrReference || t.reference === idOrReference)) ?? null,
    );
  }

  listLedgerEntries(userId: string): Promise<LedgerEntry[]> {
    return this.store.read((db) => {
      const accountIds = new Set(db.accounts.filter((a) => a.userId === userId).map((a) => a.id));
      return db.ledgerEntries.filter((e) => accountIds.has(e.accountId));
    });
  }

  // ---- beneficiaries --------------------------------------------------------

  listBeneficiaries(userId: string): Promise<Beneficiary[]> {
    return this.store.read((db) =>
      db.beneficiaries
        .filter((b) => b.userId === userId)
        .sort((a, b) => (b.lastUsedAt ?? b.createdAt).localeCompare(a.lastUsedAt ?? a.createdAt)),
    );
  }

  getBeneficiary(userId: string, id: string): Promise<Beneficiary | null> {
    return this.store.read((db) => db.beneficiaries.find((b) => b.userId === userId && b.id === id) ?? null);
  }

  findBeneficiary(userId: string, bankCode: string, accountNumber: string): Promise<Beneficiary | null> {
    return this.store.read(
      (db) => db.beneficiaries.find((b) => b.userId === userId && b.bankCode === bankCode && b.accountNumber === accountNumber) ?? null,
    );
  }

  createBeneficiary(userId: string, data: BeneficiaryData): Promise<Beneficiary> {
    return this.store.write((db) => {
      if (db.beneficiaries.some((b) => b.userId === userId && b.bankCode === data.bankCode && b.accountNumber === data.accountNumber)) {
        throw new AppError("DUPLICATE", "This account is already saved as a beneficiary.");
      }
      const iso = new Date().toISOString();
      const beneficiary: Beneficiary = { id: randomUUID(), userId, ...data, createdAt: iso, updatedAt: iso, lastUsedAt: null };
      db.beneficiaries.push(beneficiary);
      return beneficiary;
    });
  }

  updateBeneficiary(userId: string, id: string, data: BeneficiaryData): Promise<Beneficiary> {
    return this.store.write((db) => {
      const beneficiary = db.beneficiaries.find((b) => b.userId === userId && b.id === id);
      if (!beneficiary) throw Errors.notFound("Beneficiary");
      if (db.beneficiaries.some((b) => b.userId === userId && b.id !== id && b.bankCode === data.bankCode && b.accountNumber === data.accountNumber)) {
        throw new AppError("DUPLICATE", "Another saved beneficiary already uses this account.");
      }
      beneficiary.bankCode = data.bankCode;
      beneficiary.bankName = data.bankName;
      beneficiary.accountNumber = data.accountNumber;
      beneficiary.accountName = data.accountName;
      beneficiary.nickname = data.nickname;
      beneficiary.updatedAt = new Date().toISOString();
      return beneficiary;
    });
  }

  async deleteBeneficiary(userId: string, id: string): Promise<void> {
    await this.store.write((db) => {
      const before = db.beneficiaries.length;
      db.beneficiaries = db.beneficiaries.filter((b) => !(b.userId === userId && b.id === id));
      if (db.beneficiaries.length === before) throw Errors.notFound("Beneficiary");
    });
  }

  async touchBeneficiary(userId: string, id: string): Promise<void> {
    await this.store.write((db) => {
      const beneficiary = db.beneficiaries.find((b) => b.userId === userId && b.id === id);
      if (beneficiary) beneficiary.lastUsedAt = new Date().toISOString();
    });
  }

  // ---- notifications --------------------------------------------------------

  listNotifications(userId: string, limit = 20): Promise<AppNotification[]> {
    return this.store.read((db) =>
      db.notifications
        .filter((n) => n.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit),
    );
  }

  async createNotification(userId: string, n: { kind: AppNotification["kind"]; title: string; body: string; link?: string | null }): Promise<void> {
    await this.store.write((db) => {
      db.notifications.push({ id: randomUUID(), userId, kind: n.kind, title: n.title, body: n.body, link: n.link ?? null, readAt: null, createdAt: new Date().toISOString() });
      // Keep the store small: retain the newest 100 per user.
      const mine = db.notifications.filter((x) => x.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (mine.length > 100) {
        const drop = new Set(mine.slice(100).map((x) => x.id));
        db.notifications = db.notifications.filter((x) => !drop.has(x.id));
      }
    });
  }

  async markNotificationsRead(userId: string, ids?: string[]): Promise<void> {
    await this.store.write((db) => {
      const iso = new Date().toISOString();
      for (const n of db.notifications) {
        if (n.userId === userId && !n.readAt && (!ids || ids.includes(n.id))) n.readAt = iso;
      }
    });
  }

  // ---- security -------------------------------------------------------------

  getSecurityStatus(userId: string): Promise<SecurityStatus> {
    return this.store.read((db) => {
      const s = db.security.find((x) => x.userId === userId);
      return { hasPin: !!s?.pinHash, pinUpdatedAt: s?.pinUpdatedAt ?? null, pinLockedUntil: s?.pinLockedUntil ?? null };
    });
  }

  getPinRecord(userId: string): Promise<PinRecord> {
    return this.store.read((db) => {
      const s = db.security.find((x) => x.userId === userId);
      return { pinHash: s?.pinHash ?? null, failedAttempts: s?.failedPinAttempts ?? 0, lockedUntil: s?.pinLockedUntil ?? null };
    });
  }

  async setPinHash(userId: string, pinHash: string | null): Promise<void> {
    await this.store.write((db) => {
      let s = db.security.find((x) => x.userId === userId);
      if (!s) {
        s = { userId, pinHash: null, pinUpdatedAt: null, failedPinAttempts: 0, pinLockedUntil: null };
        db.security.push(s);
      }
      s.pinHash = pinHash;
      s.pinUpdatedAt = pinHash ? new Date().toISOString() : null;
      s.failedPinAttempts = 0;
      s.pinLockedUntil = null;
    });
  }

  recordPinAttempt(userId: string, success: boolean): Promise<PinRecord> {
    return this.store.write((db) => {
      const s = db.security.find((x) => x.userId === userId);
      if (!s) throw Errors.notFound("Security settings");
      if (success) {
        s.failedPinAttempts = 0;
        s.pinLockedUntil = null;
      } else {
        s.failedPinAttempts += 1;
        if (s.failedPinAttempts >= PIN_MAX_ATTEMPTS) {
          s.pinLockedUntil = new Date(Date.now() + PIN_LOCK_MINUTES * 60_000).toISOString();
          s.failedPinAttempts = 0;
        }
      }
      return { pinHash: s.pinHash, failedAttempts: s.failedPinAttempts, lockedUntil: s.pinLockedUntil };
    });
  }

  // ---- money movement -------------------------------------------------------

  reserveDebit(userId: string, idempotencyKey: string, intent: PostingIntent): Promise<PostingResult> {
    assertValidIntent(intent, "debit");
    return this.store.write((db) => {
      const replay = this.replay(db, userId, idempotencyKey, intent.fingerprint);
      if (replay) return replay;
      const account = this.accountOf(db, userId);
      if (account.status !== "active") throw new AppError("FORBIDDEN", "This account cannot make payments right now.");
      const total = intent.amount + intent.fee;
      if (account.balance < total) throw Errors.insufficientFunds();

      const now = new Date();
      const txn = this.newTransaction(db, userId, account, idempotencyKey, intent, now);
      this.postEntry(db, account, txn.id, "principal", "debit", intent.amount, txn.createdAt);
      if (intent.fee > 0) this.postEntry(db, account, txn.id, "fee", "debit", intent.fee, txn.createdAt);
      txn.balanceAfter = account.balance;
      db.transactions.push(txn);
      db.idempotency.push({ userId, key: idempotencyKey, fingerprint: intent.fingerprint, transactionId: txn.id, createdAt: txn.createdAt });
      assertLedgerConsistent(db, account);
      return { transaction: txn, replayed: false };
    });
  }

  settleTransaction(userId: string, transactionId: string, outcome: SettlementOutcome): Promise<Transaction> {
    return this.store.write((db) => {
      const txn = db.transactions.find((t) => t.id === transactionId && t.userId === userId);
      if (!txn) throw Errors.notFound("Transaction");
      if (txn.status !== "pending") return txn; // already final: settling twice is a no-op
      const iso = new Date().toISOString();
      if (outcome.details) txn.details = { ...txn.details, ...outcome.details };
      if (outcome.providerReference !== undefined) txn.providerReference = outcome.providerReference;
      txn.updatedAt = iso;
      if (outcome.status === "successful") {
        txn.status = "successful";
        txn.completedAt = iso;
      } else if (outcome.status === "failed") {
        const account = db.accounts.find((a) => a.id === txn.accountId && a.userId === userId);
        if (!account) throw Errors.notFound("Account");
        this.postEntry(db, account, txn.id, "reversal", "credit", txn.amount + txn.fee, iso);
        txn.status = "failed";
        txn.failureReason = outcome.failureReason ?? "The payment could not be completed.";
        txn.completedAt = iso;
        assertLedgerConsistent(db, account);
      }
      return txn;
    });
  }

  postCredit(userId: string, idempotencyKey: string, intent: PostingIntent): Promise<PostingResult> {
    assertValidIntent(intent, "credit");
    return this.store.write((db) => {
      const replay = this.replay(db, userId, idempotencyKey, intent.fingerprint);
      if (replay) return replay;
      const account = this.accountOf(db, userId);
      const now = new Date();
      const txn = this.newTransaction(db, userId, account, idempotencyKey, intent, now);
      this.postEntry(db, account, txn.id, "credit", "credit", intent.amount, txn.createdAt);
      txn.status = "successful";
      txn.completedAt = txn.createdAt;
      txn.providerReference = `CR-${txn.id.slice(0, 8).toUpperCase()}`;
      txn.balanceAfter = account.balance;
      db.transactions.push(txn);
      db.idempotency.push({ userId, key: idempotencyKey, fingerprint: intent.fingerprint, transactionId: txn.id, createdAt: txn.createdAt });
      assertLedgerConsistent(db, account);
      return { transaction: txn, replayed: false };
    });
  }

  recordDeclined(userId: string, idempotencyKey: string, intent: PostingIntent, reason: string): Promise<PostingResult> {
    return this.store.write((db) => {
      const replay = this.replay(db, userId, idempotencyKey, intent.fingerprint);
      if (replay) return replay;
      const account = this.accountOf(db, userId);
      const txn = this.newTransaction(db, userId, account, idempotencyKey, intent, new Date());
      txn.status = "failed";
      txn.failureReason = reason;
      txn.completedAt = txn.createdAt;
      txn.balanceAfter = account.balance;
      db.transactions.push(txn);
      db.idempotency.push({ userId, key: idempotencyKey, fingerprint: intent.fingerprint, transactionId: txn.id, createdAt: txn.createdAt });
      return { transaction: txn, replayed: false };
    });
  }
}

// ---- singleton ------------------------------------------------------------------

type GlobalWithStore = typeof globalThis & { __eleosLocalStores?: Map<string, LocalStore> };

/** One store per data file, shared across module instances in the same process. */
export function getLocalStore(): LocalStore {
  const g = globalThis as GlobalWithStore;
  g.__eleosLocalStores ??= new Map();
  const file = defaultStorePath();
  let store = g.__eleosLocalStores.get(file);
  if (!store) {
    store = new LocalStore(file, bootstrapDemoUser);
    g.__eleosLocalStores.set(file, store);
  }
  return store;
}
