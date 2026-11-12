import type {
  Account,
  AppNotification,
  Beneficiary,
  Direction,
  LedgerEntry,
  NotificationKind,
  Profile,
  SecurityStatus,
  Transaction,
  TransactionDetails,
  TransactionPage,
  TransactionQuery,
  TransactionType,
  UserPreferences,
  VirtualCard,
} from "@/lib/types";
import type { DataMode } from "../config";

/**
 * Everything the money engine wants to post. Built on the server from validated
 * input and the server-side catalogue/fee schedule — never from client-supplied
 * amounts or fees.
 */
export interface PostingIntent {
  type: TransactionType;
  direction: Direction;
  amount: number;
  fee: number;
  description: string;
  narration: string | null;
  details: TransactionDetails;
  provider: string;
  /** Hash of the economically relevant fields, to detect idempotency-key reuse with a different payload. */
  fingerprint: string;
}

export interface PostingResult {
  transaction: Transaction;
  /** True when an earlier submission with the same idempotency key was returned instead of posting again. */
  replayed: boolean;
}

export interface SettlementOutcome {
  status: "successful" | "failed" | "pending";
  providerReference?: string | null;
  failureReason?: string | null;
  /** Merged into the transaction's details (e.g. a meter token). */
  details?: TransactionDetails;
}

export interface NewUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
}

export interface PinRecord {
  pinHash: string | null;
  failedAttempts: number;
  lockedUntil: string | null;
}

export interface BeneficiaryData {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  nickname: string | null;
}

export interface CardPatch {
  frozen?: boolean;
  onlinePayments?: boolean;
  dailyLimit?: number;
  monthlyLimit?: number;
}

/**
 * Data access for one bank backend. Every method takes the *authenticated*
 * user's id (resolved from the session on the server) and must scope all reads
 * and writes to that user — a user id from the browser is never passed in here.
 */
export interface BankRepository {
  readonly mode: DataMode;

  /** Creates profile/account/card/preferences + seeded demo history if the user has no account yet. Idempotent. */
  ensureProvisioned(user: NewUser): Promise<void>;
  /** Deletes the user's demo history and re-seeds the opening demo balance. */
  resetDemoData(userId: string): Promise<void>;

  getProfile(userId: string): Promise<Profile | null>;
  updateProfile(userId: string, patch: { fullName?: string; email?: string; phone?: string | null }): Promise<Profile>;
  getAccount(userId: string): Promise<Account | null>;
  getPreferences(userId: string): Promise<UserPreferences | null>;
  updatePreferences(userId: string, patch: Partial<Omit<UserPreferences, "userId" | "updatedAt">>): Promise<UserPreferences>;
  getCard(userId: string): Promise<VirtualCard | null>;
  updateCard(userId: string, patch: CardPatch): Promise<VirtualCard>;

  listTransactions(userId: string, query: TransactionQuery): Promise<TransactionPage>;
  /** All transactions matching a query (no pagination), newest first, capped for safety. */
  exportTransactions(userId: string, query: TransactionQuery, cap?: number): Promise<Transaction[]>;
  /** Transactions created at or after `sinceIso` (all when omitted), newest first. */
  listRecentTransactions(userId: string, sinceIso?: string): Promise<Transaction[]>;
  getTransaction(userId: string, idOrReference: string): Promise<Transaction | null>;
  listLedgerEntries(userId: string): Promise<LedgerEntry[]>;

  listBeneficiaries(userId: string): Promise<Beneficiary[]>;
  getBeneficiary(userId: string, id: string): Promise<Beneficiary | null>;
  findBeneficiary(userId: string, bankCode: string, accountNumber: string): Promise<Beneficiary | null>;
  createBeneficiary(userId: string, data: BeneficiaryData): Promise<Beneficiary>;
  updateBeneficiary(userId: string, id: string, data: BeneficiaryData): Promise<Beneficiary>;
  deleteBeneficiary(userId: string, id: string): Promise<void>;
  touchBeneficiary(userId: string, id: string): Promise<void>;

  listNotifications(userId: string, limit?: number): Promise<AppNotification[]>;
  createNotification(userId: string, notification: { kind: NotificationKind; title: string; body: string; link?: string | null }): Promise<void>;
  markNotificationsRead(userId: string, ids?: string[]): Promise<void>;

  getSecurityStatus(userId: string): Promise<SecurityStatus>;
  getPinRecord(userId: string): Promise<PinRecord>;
  /** Store a new PIN hash, or clear the PIN with null. */
  setPinHash(userId: string, pinHash: string | null): Promise<void>;
  /** Records a PIN attempt; locks the PIN for 15 minutes after 5 consecutive failures. */
  recordPinAttempt(userId: string, success: boolean): Promise<PinRecord>;

  // ---- Money movement: each call is atomic --------------------------------

  /**
   * Idempotently debit `amount + fee` and create a PENDING transaction with
   * ledger entries. Throws INSUFFICIENT_FUNDS if the balance cannot cover it.
   * Returns the original transaction (replayed=true) if the key was used before.
   */
  reserveDebit(userId: string, idempotencyKey: string, intent: PostingIntent): Promise<PostingResult>;
  /**
   * Move a PENDING transaction to its final state. A failure posts a reversal
   * entry and restores the balance. Settling a non-pending transaction is a no-op.
   */
  settleTransaction(userId: string, transactionId: string, outcome: SettlementOutcome): Promise<Transaction>;
  /** Idempotently post a successful credit. */
  postCredit(userId: string, idempotencyKey: string, intent: PostingIntent): Promise<PostingResult>;
  /** Idempotently record a declined attempt (no ledger movement), e.g. a frozen card. */
  recordDeclined(userId: string, idempotencyKey: string, intent: PostingIntent, reason: string): Promise<PostingResult>;
}
