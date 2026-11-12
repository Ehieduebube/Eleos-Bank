import { randomUUID } from "node:crypto";
import { getBank } from "@/lib/catalog/banks";
import { maskAccountNumber, formatToken, lagosDayKey } from "@/lib/format";
import { transferFee, feeFor } from "@/lib/fees";
import type {
  Account,
  AppNotification,
  Beneficiary,
  LedgerEntry,
  Profile,
  Transaction,
  TransactionDetails,
  TransactionStatus,
  TransactionType,
  UserPreferences,
  VirtualCard,
} from "@/lib/types";
import { DEMO_BANK_NAME, DEMO_INITIAL_BALANCE_KOBO } from "../config";
import { DEMO_DIRECTORY, stableHash } from "../providers/demo-directory";
import { generateReference } from "../references";

/**
 * Builds a complete, internally consistent demo account:
 *   - ~5 months of realistic history (salary, transfers, bills, card spend, ...)
 *   - including one failed, one reversed and one pending transaction
 *   - a ledger whose opening entry is computed so the closing balance is
 *     exactly DEMO_INITIAL_BALANCE_KOBO (₦45,140,708.60).
 *
 * The function is pure apart from id/reference generation (injectable for tests)
 * and is used by both the local store and the Supabase provisioning RPC, so the
 * two modes always seed identical data.
 */

export interface DemoSeedInput {
  userId: string;
  email: string;
  fullName: string;
  phone: string | null;
  now?: Date;
  targetBalance?: number;
  newId?: () => string;
  newReference?: (date: Date) => string;
}

export interface DemoSeed {
  profile: Profile;
  account: Account;
  card: VirtualCard;
  preferences: UserPreferences;
  transactions: Transaction[];
  ledgerEntries: LedgerEntry[];
  beneficiaries: Beneficiary[];
  notifications: AppNotification[];
}

// Deterministic PRNG so every demo account has the same shaped history.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n = (naira: number) => Math.round(naira * 100);

/** A Lagos wall-clock time (UTC+1, no DST) as a Date. */
function lagosTime(year: number, month0: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(year, month0, day, hour - 1, minute));
}

interface SeedEvent {
  at: Date;
  type: TransactionType;
  direction: "debit" | "credit";
  amount: number;
  fee: number;
  description: string;
  narration?: string;
  details: TransactionDetails;
  status: TransactionStatus;
  failureReason?: string;
  provider?: string;
  /** For reversed transactions: when the reversal was posted. */
  reversedAt?: Date;
}

export function demoAccountNumber(userId: string): string {
  const h = stableHash(userId).toString().padStart(10, "0").slice(-8);
  return `80${h}`;
}

function directory(accountNumber: string) {
  const entry = DEMO_DIRECTORY.find((d) => d.accountNumber === accountNumber)!;
  return { ...entry, bankName: getBank(entry.bankCode)?.name ?? entry.bankCode };
}

function titleCase(name: string) {
  return name
    .toLowerCase()
    .split(" ")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export function buildDemoSeed(input: DemoSeedInput): DemoSeed {
  const now = input.now ?? new Date();
  const newId = input.newId ?? randomUUID;
  const newReference = input.newReference ?? generateReference;
  const target = input.targetBalance ?? DEMO_INITIAL_BALANCE_KOBO;
  const rand = mulberry32(20_261_112);
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]!;
  const between = (min: number, max: number, step = 1) => Math.round((min + rand() * (max - min)) / step) * step;

  const ownPhone = input.phone ?? "08031234567";
  const [cy, cm] = lagosDayKey(now).split("-").map(Number) as [number, number];
  const events: SeedEvent[] = [];

  const friends = ["0214587793", "0692284415", "2154409983", "8123456780"].map(directory);
  const mum = directory("3089915526");
  const landlord = directory("2207718840");
  const kelechi = directory("6311204578");

  const transfer = (at: Date, to: ReturnType<typeof directory>, amount: number, narration: string, status: TransactionStatus = "successful", failureReason?: string): SeedEvent => ({
    at,
    type: "transfer",
    direction: "debit",
    amount,
    fee: transferFee(amount),
    description: `Transfer to ${titleCase(to.accountName)}`,
    narration,
    details: {
      recipientName: to.accountName,
      bankCode: to.bankCode,
      bankName: to.bankName,
      accountNumberMasked: maskAccountNumber(to.accountNumber),
    },
    status,
    failureReason,
  });

  for (let offset = -5; offset <= 0; offset++) {
    const monthDate = new Date(Date.UTC(cy, cm - 1 + offset, 1));
    const y = monthDate.getUTCFullYear();
    const m = monthDate.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const at = (day: number, hour: number, minute: number) => lagosTime(y, m, Math.min(day, daysInMonth), hour, minute);

    // Income
    events.push({
      at: at(25, 9, 12),
      type: "credit",
      direction: "credit",
      amount: n(1_850_000),
      fee: 0,
      description: "Salary — Brightline Technologies Ltd",
      narration: "Monthly salary",
      details: { senderName: "BRIGHTLINE TECHNOLOGIES LTD", bankName: "Guaranty Trust Bank", source: "salary" },
      status: "successful",
    });
    events.push({
      at: at(between(6, 11), 14, between(0, 59)),
      type: "credit",
      direction: "credit",
      amount: n(between(250_000, 600_000, 5_000)),
      fee: 0,
      description: `Transfer from ${titleCase(kelechi.accountName)}`,
      narration: "Design retainer",
      details: { senderName: kelechi.accountName, bankName: kelechi.bankName, source: "transfer" },
      status: "successful",
    });

    // Transfers
    if (offset === -4) events.push(transfer(at(3, 10, 5), landlord, n(850_000), "Annual rent balance"));
    events.push(transfer(at(27, 18, 40), mum, n(100_000), "Upkeep"));
    const friendCount = between(3, 5);
    for (let i = 0; i < friendCount; i++) {
      events.push(transfer(at(between(1, 28), between(8, 21), between(0, 59)), pick(friends), n(between(3_000, 45_000, 500)), pick(["Lunch", "Contribution", "Thanks!", "Dinner split", "Ajo", "Birthday gift"])));
    }

    // Airtime & data
    for (let i = 0; i < 3; i++) {
      const amount = n(pick([500, 1000, 1500, 2000, 3000]));
      events.push({
        at: at(between(1, 28), between(7, 22), between(0, 59)),
        type: "airtime",
        direction: "debit",
        amount,
        fee: 0,
        description: "MTN airtime",
        details: { network: "mtn", networkName: "MTN", phone: ownPhone },
        status: "successful",
      });
    }
    events.push({
      at: at(between(1, 28), 19, 15),
      type: "airtime",
      direction: "debit",
      amount: n(2000),
      fee: 0,
      description: "Airtel airtime",
      details: { network: "airtel", networkName: "Airtel", phone: "08021234567" },
      status: "successful",
    });
    for (const day of [between(2, 12), between(15, 27)]) {
      const big = rand() > 0.5;
      events.push({
        at: at(day, 8, between(0, 59)),
        type: "data",
        direction: "debit",
        amount: big ? n(7500) : n(3500),
        fee: 0,
        description: big ? "MTN 20GB Monthly" : "MTN 7GB Monthly",
        details: { network: "mtn", networkName: "MTN", phone: ownPhone, planId: big ? "mtn-20gb-30d" : "mtn-7gb-30d", planName: big ? "20GB Monthly" : "7GB Monthly", validity: "30 days" },
        status: "successful",
      });
    }

    // Bills
    for (const day of [between(1, 6), between(14, 20)]) {
      const amount = n(between(15_000, 35_000, 1_000));
      const token = String(stableHash(`${offset}-${day}-${amount}`)).padStart(10, "0") + String(stableHash(`t${day}${offset}`)).padStart(10, "0");
      events.push({
        at: at(day, 20, between(0, 59)),
        type: "electricity",
        direction: "debit",
        amount,
        fee: feeFor("electricity", amount),
        description: "Ikeja Electric prepaid",
        details: { providerId: "ikedc", providerName: "Ikeja Electric", customerId: "45071234567", customerName: input.fullName.toUpperCase(), meterType: "prepaid", token: formatToken(token.slice(0, 20)), units: `${(amount / n(209.5)).toFixed(1)} kWh` },
        status: "successful",
      });
    }
    events.push({
      at: at(5, 12, 30),
      type: "cable_tv",
      direction: "debit",
      amount: n(19_000),
      fee: 0,
      description: "DStv Compact",
      details: { providerId: "dstv", providerName: "DStv", customerId: "7023456789", customerName: input.fullName.toUpperCase(), planId: "dstv-compact", planName: "DStv Compact", validity: "1 month" },
      status: "successful",
    });
    events.push({
      at: at(10, 9, 45),
      type: "internet",
      direction: "debit",
      amount: n(23_000),
      fee: 0,
      description: "Spectranet Unlimited",
      details: { providerId: "spectranet", providerName: "Spectranet", customerId: "SPC204518", planId: "spec-unl", planName: "Spectranet Unlimited", validity: "30 days" },
      status: "successful",
    });
    if (offset % 2 === 0) {
      events.push({
        at: at(12, 11, 5),
        type: "utility",
        direction: "debit",
        amount: n(3_500),
        fee: feeFor("utility", n(3_500)),
        description: "LAWMA (Waste)",
        details: { providerId: "lawma", providerName: "LAWMA (Waste)", customerId: "LAW-778120" },
        status: "successful",
      });
    }

    // Betting
    const bets = between(1, 2);
    for (let i = 0; i < bets; i++) {
      events.push({
        at: at(between(1, 28), between(12, 22), between(0, 59)),
        type: "betting",
        direction: "debit",
        amount: n(pick([2_000, 3_000, 5_000, 10_000])),
        fee: 0,
        description: "SportyBet wallet funding",
        details: { providerId: "sportybet", providerName: "SportyBet", customerId: "TOLU2045", customerName: input.fullName.toUpperCase() },
        status: "successful",
      });
    }

    // Card spend
    const card = (day: number, merchant: string, category: string, amount: number): SeedEvent => ({
      at: at(day, between(9, 22), between(0, 59)),
      type: "card",
      direction: "debit",
      amount,
      fee: 0,
      description: `Card · ${merchant}`,
      details: { merchant, merchantCategory: category, cardLast4: "" },
      status: "successful",
      provider: "demo-card",
    });
    events.push(card(14, "Netflix", "Streaming", n(7_000)));
    events.push(card(18, "Spotify", "Streaming", n(1_900)));
    for (let i = 0; i < 3; i++) events.push(card(between(1, 28), "Bolt", "Transport", n(between(2_500, 5_500, 50))));
    events.push(card(between(1, 28), "Jumia", "Shopping", n(between(15_000, 45_000)) + between(0, 99)));
    events.push(card(between(1, 28), "Chowdeck", "Food", n(between(4_500, 9_000, 50))));
  }

  // Edge-case statuses so the UI can show every state.
  const daysAgo = (d: number, hour: number, minute: number) => {
    const base = new Date(now.getTime() - d * 86_400_000);
    const [yy, mm, dd] = lagosDayKey(base).split("-").map(Number) as [number, number, number];
    return lagosTime(yy, mm - 1, dd, hour, minute);
  };
  events.push(transfer(daysAgo(9, 16, 22), friends[3]!, n(20_000), "Shared groceries", "failed", "Beneficiary bank unavailable. Funds were returned immediately."));
  events.push({
    at: daysAgo(17, 21, 10),
    type: "betting",
    direction: "debit",
    amount: n(5_000),
    fee: 0,
    description: "SportyBet wallet funding",
    details: { providerId: "sportybet", providerName: "SportyBet", customerId: "TOLU2045", customerName: input.fullName.toUpperCase() },
    status: "reversed",
    failureReason: "Provider could not credit the wallet. Amount reversed to your balance.",
    reversedAt: daysAgo(17, 22, 5),
  });
  events.push({
    at: new Date(now.getTime() - 3 * 3_600_000),
    type: "electricity",
    direction: "debit",
    amount: n(10_000),
    fee: feeFor("electricity", n(10_000)),
    description: "Ikeja Electric prepaid",
    details: { providerId: "ikedc", providerName: "Ikeja Electric", customerId: "45071234567", customerName: input.fullName.toUpperCase(), meterType: "prepaid" },
    status: "pending",
  });

  // Never seed future-dated activity.
  const cutoff = now.getTime() - 60_000;
  const timeline = events.filter((e) => e.at.getTime() <= cutoff).sort((a, b) => a.at.getTime() - b.at.getTime());

  // Net effect of history on the balance (failed and reversed net to zero).
  const net = timeline.reduce((sum, e) => {
    if (e.status === "failed" || e.status === "reversed") return sum;
    return e.direction === "credit" ? sum + e.amount : sum - e.amount - e.fee;
  }, 0);
  const openingBalance = target - net;
  if (openingBalance < 0) throw new Error("Demo seed would require a negative opening balance");

  const accountId = newId();
  const firstAt = timeline[0]?.at ?? now;
  const openedAt = new Date(firstAt.getTime() - 86_400_000).toISOString();
  const nowIso = now.toISOString();
  const accountName = input.fullName.toUpperCase();
  const cardLast4 = String(stableHash(`card:${input.userId}`) % 10_000).padStart(4, "0");

  const ledgerEntries: LedgerEntry[] = [];
  let balance = 0;
  const post = (transactionId: string | null, entryType: LedgerEntry["entryType"], direction: "debit" | "credit", amount: number, at: string) => {
    balance += direction === "credit" ? amount : -amount;
    ledgerEntries.push({ id: newId(), accountId, transactionId, entryType, direction, amount, balanceAfter: balance, createdAt: at });
  };

  post(null, "opening", "credit", openingBalance, openedAt);

  const transactions: Transaction[] = timeline.map((e) => {
    const id = newId();
    const createdAt = e.at.toISOString();
    if (e.direction === "credit") {
      post(id, "credit", "credit", e.amount, createdAt);
    } else {
      post(id, "principal", "debit", e.amount, createdAt);
      if (e.fee > 0) post(id, "fee", "debit", e.fee, createdAt);
    }
    const balanceAfter = balance;
    let completedAt: string | null = new Date(e.at.getTime() + 4_000).toISOString();
    if (e.status === "failed") {
      post(id, "reversal", "credit", e.amount + e.fee, new Date(e.at.getTime() + 2_000).toISOString());
    } else if (e.status === "reversed") {
      const reversedAt = (e.reversedAt ?? new Date(e.at.getTime() + 3_600_000)).toISOString();
      post(id, "reversal", "credit", e.amount + e.fee, reversedAt);
      completedAt = reversedAt;
    } else if (e.status === "pending") {
      completedAt = null;
    }
    const details = { ...e.details };
    if (e.type === "card") details.cardLast4 = cardLast4;
    return {
      id,
      userId: input.userId,
      accountId,
      reference: newReference(e.at),
      idempotencyKey: null,
      type: e.type,
      direction: e.direction,
      status: e.status,
      amount: e.amount,
      fee: e.fee,
      total: e.direction === "debit" ? e.amount + e.fee : e.amount,
      description: e.description,
      narration: e.narration ?? null,
      details,
      balanceAfter,
      failureReason: e.failureReason ?? null,
      provider: e.provider ?? "demo",
      providerReference: e.status === "pending" ? null : `PRV-${id.slice(0, 8).toUpperCase()}`,
      isDemo: true,
      createdAt,
      updatedAt: completedAt ?? createdAt,
      completedAt,
    };
  });

  if (balance !== target) throw new Error(`Demo seed balance mismatch: ${balance} !== ${target}`);

  const profile: Profile = {
    id: input.userId,
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    isDemo: true,
    createdAt: openedAt,
    updatedAt: nowIso,
  };

  const account: Account = {
    id: accountId,
    userId: input.userId,
    accountNumber: demoAccountNumber(input.userId),
    accountName,
    bankName: DEMO_BANK_NAME,
    currency: "NGN",
    balance,
    status: "active",
    isDemo: true,
    createdAt: openedAt,
    updatedAt: nowIso,
  };

  const expiry = new Date(Date.UTC(cy + 3, cm - 1, 1));
  const card: VirtualCard = {
    id: newId(),
    userId: input.userId,
    accountId,
    label: "Everyday virtual card",
    last4: cardLast4,
    expiryMonth: expiry.getUTCMonth() + 1,
    expiryYear: expiry.getUTCFullYear(),
    cardholderName: accountName,
    frozen: false,
    onlinePayments: true,
    dailyLimit: n(500_000),
    monthlyLimit: n(3_000_000),
    createdAt: openedAt,
    updatedAt: nowIso,
  };

  const preferences: UserPreferences = {
    userId: input.userId,
    theme: "light",
    hideBalance: false,
    emailAlerts: true,
    smsAlerts: false,
    pushAlerts: true,
    lowBalanceAlert: true,
    lowBalanceThreshold: n(50_000),
    marketingEmails: false,
    updatedAt: nowIso,
  };

  const lastUsed = (accountNumber: string) =>
    transactions
      .filter((t) => t.type === "transfer" && t.details.accountNumberMasked === maskAccountNumber(accountNumber))
      .at(-1)?.createdAt ?? null;

  const beneficiaries: Beneficiary[] = [
    { ...directory("0214587793"), nickname: null },
    { ...directory("0692284415"), nickname: null },
    { ...directory("3089915526"), nickname: "Mum" },
    { ...directory("2207718840"), nickname: "Landlord" },
    { ...directory("2154409983"), nickname: null },
  ].map((b) => ({
    id: newId(),
    userId: input.userId,
    bankCode: b.bankCode,
    bankName: b.bankName,
    accountNumber: b.accountNumber,
    accountName: b.accountName,
    nickname: b.nickname,
    createdAt: openedAt,
    updatedAt: openedAt,
    lastUsedAt: lastUsed(b.accountNumber),
  }));

  const lastSalary = [...transactions].reverse().find((t) => t.type === "credit" && t.details.source === "salary");
  const notifications: AppNotification[] = [
    {
      id: newId(),
      userId: input.userId,
      kind: "system",
      title: "Welcome to Eleos",
      body: "Your account is ready. Send money, buy airtime and pay bills — all in one place.",
      link: "/overview",
      readAt: null,
      createdAt: nowIso,
    },
    {
      id: newId(),
      userId: input.userId,
      kind: "security",
      title: "Set a transaction PIN",
      body: "Add a 4-digit PIN to confirm transfers and payments.",
      link: "/settings?tab=security",
      readAt: null,
      createdAt: new Date(now.getTime() - 120_000).toISOString(),
    },
  ];
  if (lastSalary) {
    notifications.push({
      id: newId(),
      userId: input.userId,
      kind: "transaction",
      title: "Salary received",
      body: `₦1,850,000.00 from Brightline Technologies Ltd.`,
      link: `/transactions?ref=${lastSalary.reference}`,
      readAt: lastSalary.createdAt,
      createdAt: lastSalary.createdAt,
    });
  }

  return { profile, account, card, preferences, transactions, ledgerEntries, beneficiaries, notifications };
}
