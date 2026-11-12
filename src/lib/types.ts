/**
 * Domain model shared by server and client code.
 * All money fields are integer kobo. All timestamps are ISO-8601 strings.
 */

export const TRANSACTION_TYPES = [
  "transfer",
  "airtime",
  "data",
  "electricity",
  "cable_tv",
  "internet",
  "utility",
  "betting",
  "card",
  "credit",
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_STATUSES = ["pending", "successful", "failed", "reversed"] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export type Direction = "debit" | "credit";

/** Service-specific details captured with a transaction (stored as JSON). */
export interface TransactionDetails {
  recipientName?: string;
  bankCode?: string;
  bankName?: string;
  accountNumberMasked?: string;
  phone?: string;
  network?: string;
  networkName?: string;
  planId?: string;
  planName?: string;
  validity?: string;
  providerId?: string;
  providerName?: string;
  customerId?: string;
  customerName?: string;
  meterType?: "prepaid" | "postpaid";
  token?: string;
  units?: string;
  merchant?: string;
  merchantCategory?: string;
  cardLast4?: string;
  source?: string;
  senderName?: string;
  note?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  reference: string;
  idempotencyKey: string | null;
  type: TransactionType;
  direction: Direction;
  status: TransactionStatus;
  /** Principal amount in kobo (always positive). */
  amount: number;
  /** Fee in kobo (always >= 0; only charged on debits). */
  fee: number;
  /** amount + fee for debits, amount for credits. */
  total: number;
  description: string;
  narration: string | null;
  details: TransactionDetails;
  /** Account balance immediately after this transaction's initial posting. */
  balanceAfter: number | null;
  failureReason: string | null;
  provider: string;
  providerReference: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export type LedgerEntryType = "opening" | "principal" | "fee" | "reversal" | "credit";

export interface LedgerEntry {
  id: string;
  accountId: string;
  /** Null only for the opening-balance entry of a demo account. */
  transactionId: string | null;
  entryType: LedgerEntryType;
  direction: Direction;
  amount: number;
  balanceAfter: number;
  createdAt: string;
}

export interface Account {
  id: string;
  userId: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  currency: "NGN";
  balance: number;
  status: "active" | "frozen" | "closed";
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Beneficiary {
  id: string;
  userId: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  nickname: string | null;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}

export type NotificationKind = "transaction" | "security" | "system";

export interface AppNotification {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface VirtualCard {
  id: string;
  userId: string;
  accountId: string;
  label: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  cardholderName: string;
  frozen: boolean;
  onlinePayments: boolean;
  dailyLimit: number;
  monthlyLimit: number;
  createdAt: string;
  updatedAt: string;
}

export type ThemePreference = "light" | "dark" | "system";

export interface UserPreferences {
  userId: string;
  theme: ThemePreference;
  hideBalance: boolean;
  emailAlerts: boolean;
  smsAlerts: boolean;
  pushAlerts: boolean;
  lowBalanceAlert: boolean;
  lowBalanceThreshold: number;
  marketingEmails: boolean;
  updatedAt: string;
}

export interface SecurityStatus {
  hasPin: boolean;
  pinUpdatedAt: string | null;
  pinLockedUntil: string | null;
}

export interface SessionInfo {
  id: string;
  current: boolean;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

/** A row on a confirmation / receipt screen. */
export interface SummaryRow {
  label: string;
  value: string;
  emphasis?: boolean;
  mono?: boolean;
}

export type ActionErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INSUFFICIENT_FUNDS"
  | "LIMIT_EXCEEDED"
  | "DUPLICATE"
  | "IDEMPOTENCY_CONFLICT"
  | "QUOTE_CHANGED"
  | "PIN_REQUIRED"
  | "PIN_INVALID"
  | "PIN_LOCKED"
  | "VERIFICATION_FAILED"
  | "PROVIDER_ERROR"
  | "NOT_CONFIGURED"
  | "CONFLICT"
  | "INTERNAL";

export interface ActionError {
  code: ActionErrorCode;
  message: string;
  fieldErrors?: Record<string, string>;
}

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: ActionError };

export interface TransactionQuery {
  search?: string;
  type?: TransactionType | "all";
  status?: TransactionStatus | "all";
  direction?: Direction | "all";
  from?: string;
  to?: string;
  sort?: "date_desc" | "date_asc" | "amount_desc" | "amount_asc";
  page?: number;
  pageSize?: number;
}

export interface TransactionPage {
  items: Transaction[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}
