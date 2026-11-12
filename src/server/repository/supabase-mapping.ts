import type {
  Account,
  AppNotification,
  Beneficiary,
  LedgerEntry,
  Profile,
  Transaction,
  UserPreferences,
  VirtualCard,
} from "@/lib/types";
import type { DemoSeed } from "../seed/demo-seed";

/* Row <-> domain mapping for the Supabase schema (snake_case, bigint kobo). */

type Row = Record<string, unknown>;

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const iso = (v: unknown) => new Date(String(v)).toISOString();
const isoOrNull = (v: unknown) => (v === null || v === undefined ? null : iso(v));
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const strOrNull = (v: unknown) => (v === null || v === undefined ? null : String(v));

export function toTransaction(r: Row): Transaction {
  return {
    id: str(r.id),
    userId: str(r.user_id),
    accountId: str(r.account_id),
    reference: str(r.reference),
    idempotencyKey: strOrNull(r.idempotency_key),
    type: r.type as Transaction["type"],
    direction: r.direction as Transaction["direction"],
    status: r.status as Transaction["status"],
    amount: num(r.amount),
    fee: num(r.fee),
    total: r.total !== undefined && r.total !== null ? num(r.total) : r.direction === "debit" ? num(r.amount) + num(r.fee) : num(r.amount),
    description: str(r.description),
    narration: strOrNull(r.narration),
    details: (r.details as Transaction["details"]) ?? {},
    balanceAfter: numOrNull(r.balance_after),
    failureReason: strOrNull(r.failure_reason),
    provider: str(r.provider),
    providerReference: strOrNull(r.provider_reference),
    isDemo: r.is_demo !== false,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    completedAt: isoOrNull(r.completed_at),
  };
}

export function toAccount(r: Row): Account {
  return {
    id: str(r.id),
    userId: str(r.user_id),
    accountNumber: str(r.account_number),
    accountName: str(r.account_name),
    bankName: str(r.bank_name),
    currency: "NGN",
    balance: num(r.balance),
    status: r.status as Account["status"],
    isDemo: r.is_demo !== false,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

export function toProfile(r: Row): Profile {
  return {
    id: str(r.id),
    fullName: str(r.full_name),
    email: str(r.email),
    phone: strOrNull(r.phone),
    isDemo: r.is_demo !== false,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

export function toLedgerEntry(r: Row): LedgerEntry {
  return {
    id: str(r.id),
    accountId: str(r.account_id),
    transactionId: strOrNull(r.transaction_id),
    entryType: r.entry_type as LedgerEntry["entryType"],
    direction: r.direction as LedgerEntry["direction"],
    amount: num(r.amount),
    balanceAfter: num(r.balance_after),
    createdAt: iso(r.created_at),
  };
}

export function toBeneficiary(r: Row): Beneficiary {
  return {
    id: str(r.id),
    userId: str(r.user_id),
    bankCode: str(r.bank_code),
    bankName: str(r.bank_name),
    accountNumber: str(r.account_number),
    accountName: str(r.account_name),
    nickname: strOrNull(r.nickname),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    lastUsedAt: isoOrNull(r.last_used_at),
  };
}

export function toNotification(r: Row): AppNotification {
  return {
    id: str(r.id),
    userId: str(r.user_id),
    kind: r.kind as AppNotification["kind"],
    title: str(r.title),
    body: str(r.body),
    link: strOrNull(r.link),
    readAt: isoOrNull(r.read_at),
    createdAt: iso(r.created_at),
  };
}

export function toCard(r: Row): VirtualCard {
  return {
    id: str(r.id),
    userId: str(r.user_id),
    accountId: str(r.account_id),
    label: str(r.label),
    last4: str(r.last4),
    expiryMonth: num(r.expiry_month),
    expiryYear: num(r.expiry_year),
    cardholderName: str(r.cardholder_name),
    frozen: r.frozen === true,
    onlinePayments: r.online_payments !== false,
    dailyLimit: num(r.daily_limit),
    monthlyLimit: num(r.monthly_limit),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

export function toPreferences(r: Row): UserPreferences {
  return {
    userId: str(r.user_id),
    theme: (r.theme as UserPreferences["theme"]) ?? "light",
    hideBalance: r.hide_balance === true,
    emailAlerts: r.email_alerts !== false,
    smsAlerts: r.sms_alerts === true,
    pushAlerts: r.push_alerts !== false,
    lowBalanceAlert: r.low_balance_alert !== false,
    lowBalanceThreshold: num(r.low_balance_threshold),
    marketingEmails: r.marketing_emails === true,
    updatedAt: iso(r.updated_at),
  };
}

export function preferencesPatchToRow(patch: Partial<UserPreferences>): Row {
  const map: Record<string, string> = {
    theme: "theme",
    hideBalance: "hide_balance",
    emailAlerts: "email_alerts",
    smsAlerts: "sms_alerts",
    pushAlerts: "push_alerts",
    lowBalanceAlert: "low_balance_alert",
    lowBalanceThreshold: "low_balance_threshold",
    marketingEmails: "marketing_emails",
  };
  const row: Row = {};
  for (const [key, value] of Object.entries(patch)) {
    const column = map[key];
    if (column && value !== undefined) row[column] = value;
  }
  return row;
}

/** Serialise a demo seed into the snake_case JSON consumed by app_provision_demo_account. */
export function seedToJson(seed: DemoSeed) {
  return {
    profile: {
      full_name: seed.profile.fullName,
      email: seed.profile.email,
      phone: seed.profile.phone,
      created_at: seed.profile.createdAt,
      updated_at: seed.profile.updatedAt,
    },
    account: {
      id: seed.account.id,
      account_number: seed.account.accountNumber,
      account_name: seed.account.accountName,
      bank_name: seed.account.bankName,
      currency: seed.account.currency,
      balance: seed.account.balance,
      status: seed.account.status,
      created_at: seed.account.createdAt,
      updated_at: seed.account.updatedAt,
    },
    transactions: seed.transactions.map((t) => ({
      id: t.id,
      account_id: t.accountId,
      reference: t.reference,
      type: t.type,
      direction: t.direction,
      status: t.status,
      amount: t.amount,
      fee: t.fee,
      description: t.description,
      narration: t.narration,
      details: t.details,
      balance_after: t.balanceAfter,
      failure_reason: t.failureReason,
      provider: t.provider,
      provider_reference: t.providerReference,
      created_at: t.createdAt,
      updated_at: t.updatedAt,
      completed_at: t.completedAt,
    })),
    ledger_entries: seed.ledgerEntries.map((e) => ({
      id: e.id,
      account_id: e.accountId,
      transaction_id: e.transactionId,
      entry_type: e.entryType,
      direction: e.direction,
      amount: e.amount,
      balance_after: e.balanceAfter,
      created_at: e.createdAt,
    })),
    card: {
      id: seed.card.id,
      account_id: seed.card.accountId,
      label: seed.card.label,
      last4: seed.card.last4,
      expiry_month: seed.card.expiryMonth,
      expiry_year: seed.card.expiryYear,
      cardholder_name: seed.card.cardholderName,
      frozen: seed.card.frozen,
      online_payments: seed.card.onlinePayments,
      daily_limit: seed.card.dailyLimit,
      monthly_limit: seed.card.monthlyLimit,
      created_at: seed.card.createdAt,
      updated_at: seed.card.updatedAt,
    },
    preferences: {
      theme: seed.preferences.theme,
      hide_balance: seed.preferences.hideBalance,
      email_alerts: seed.preferences.emailAlerts,
      sms_alerts: seed.preferences.smsAlerts,
      push_alerts: seed.preferences.pushAlerts,
      low_balance_alert: seed.preferences.lowBalanceAlert,
      low_balance_threshold: seed.preferences.lowBalanceThreshold,
      marketing_emails: seed.preferences.marketingEmails,
      updated_at: seed.preferences.updatedAt,
    },
    beneficiaries: seed.beneficiaries.map((b) => ({
      id: b.id,
      bank_code: b.bankCode,
      bank_name: b.bankName,
      account_number: b.accountNumber,
      account_name: b.accountName,
      nickname: b.nickname,
      created_at: b.createdAt,
      updated_at: b.updatedAt,
      last_used_at: b.lastUsedAt,
    })),
    notifications: seed.notifications.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      link: n.link,
      read_at: n.readAt,
      created_at: n.createdAt,
    })),
  };
}
