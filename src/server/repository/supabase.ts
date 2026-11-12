import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type {
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
  ActionErrorCode,
} from "@/lib/types";
import { AppError, Errors } from "../errors";
import { generateReference } from "../references";
import { buildDemoSeed } from "../seed/demo-seed";
import { DEFAULT_PAGE_SIZE, lagosDayEndIso, lagosDayStartIso } from "./query";
import {
  preferencesPatchToRow,
  seedToJson,
  toAccount,
  toBeneficiary,
  toCard,
  toLedgerEntry,
  toNotification,
  toPreferences,
  toProfile,
  toTransaction,
} from "./supabase-mapping";
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

const KNOWN_CODES = new Set<ActionErrorCode>([
  "VALIDATION",
  "NOT_FOUND",
  "FORBIDDEN",
  "INSUFFICIENT_FUNDS",
  "IDEMPOTENCY_CONFLICT",
  "DUPLICATE",
]);

/** Map a Postgres/PostgREST error to an AppError. RPCs raise 'CODE:message'. */
function toAppError(error: PostgrestError): AppError {
  const match = /^([A-Z_]+):(.*)$/s.exec(error.message ?? "");
  if (match && KNOWN_CODES.has(match[1] as ActionErrorCode)) return new AppError(match[1] as ActionErrorCode, match[2]!.trim());
  if (error.code === "23505") return new AppError("DUPLICATE", "This record already exists.");
  console.error("[eleos] Supabase error", { code: error.code, message: error.message, details: error.details });
  return new AppError("INTERNAL", "A database error occurred. Please try again.");
}

function check<T>(result: { data: T; error: PostgrestError | null }): T {
  if (result.error) throw toAppError(result.error);
  return result.data;
}

function sanitizeSearch(term: string): string {
  // PostgREST filter syntax uses , ( ) and * — strip them (and LIKE wildcards) from user input.
  return term.replace(/[,()*%_\\:"']/g, " ").trim().slice(0, 60);
}

/**
 * Supabase-backed repository.
 *  - `db` is the user-scoped client (RLS enforced) for reads and owner-managed records.
 *  - `admin` is the service-role client used only for the ledger RPCs, provisioning,
 *    notifications and PIN storage — always with the server-verified user id.
 * Every query also filters by user_id explicitly as defence in depth.
 */
export class SupabaseBankRepository implements BankRepository {
  readonly mode = "supabase" as const;

  constructor(
    private readonly db: SupabaseClient,
    private readonly adminFactory: () => SupabaseClient,
  ) {}

  private _admin: SupabaseClient | null = null;
  private get admin(): SupabaseClient {
    this._admin ??= this.adminFactory();
    return this._admin;
  }

  // ---- provisioning ---------------------------------------------------------

  async ensureProvisioned(user: NewUser): Promise<void> {
    const { data, error } = await this.admin.from("accounts").select("id").eq("user_id", user.id).maybeSingle();
    if (error) throw toAppError(error);
    if (data) {
      // Keep the profile email in sync with Supabase Auth (e.g. after a confirmed email change).
      await this.admin.from("profiles").update({ email: user.email }).eq("id", user.id).neq("email", user.email);
      return;
    }
    const seed = buildDemoSeed({ userId: user.id, email: user.email, fullName: user.fullName, phone: user.phone });
    check(await this.admin.rpc("app_provision_demo_account", { p_user_id: user.id, p_seed: seedToJson(seed) }));
  }

  async resetDemoData(userId: string): Promise<void> {
    const profile = await this.getProfile(userId);
    if (!profile) throw Errors.notFound("Profile");
    const seed = buildDemoSeed({ userId, email: profile.email, fullName: profile.fullName, phone: profile.phone });
    check(await this.admin.rpc("app_reset_demo_account", { p_user_id: userId, p_seed: seedToJson(seed) }));
  }

  // ---- profile / account / prefs / card -------------------------------------

  async getProfile(userId: string): Promise<Profile | null> {
    const data = check(await this.db.from("profiles").select("*").eq("id", userId).maybeSingle());
    return data ? toProfile(data) : null;
  }

  async updateProfile(userId: string, patch: { fullName?: string; email?: string; phone?: string | null }): Promise<Profile> {
    const row: Record<string, unknown> = {};
    if (patch.fullName !== undefined) row.full_name = patch.fullName;
    if (patch.phone !== undefined) row.phone = patch.phone;
    // Email is owned by Supabase Auth and synced on the next load once confirmed.
    const data = check(await this.db.from("profiles").update(row).eq("id", userId).select("*").single());
    return toProfile(data);
  }

  async getAccount(userId: string) {
    const data = check(await this.db.from("accounts").select("*").eq("user_id", userId).maybeSingle());
    return data ? toAccount(data) : null;
  }

  async getPreferences(userId: string): Promise<UserPreferences | null> {
    const data = check(await this.db.from("user_preferences").select("*").eq("user_id", userId).maybeSingle());
    return data ? toPreferences(data) : null;
  }

  async updatePreferences(userId: string, patch: Partial<Omit<UserPreferences, "userId" | "updatedAt">>): Promise<UserPreferences> {
    const data = check(await this.db.from("user_preferences").update(preferencesPatchToRow(patch)).eq("user_id", userId).select("*").single());
    return toPreferences(data);
  }

  async getCard(userId: string): Promise<VirtualCard | null> {
    const data = check(await this.db.from("virtual_cards").select("*").eq("user_id", userId).maybeSingle());
    return data ? toCard(data) : null;
  }

  async updateCard(userId: string, patch: CardPatch): Promise<VirtualCard> {
    const row: Record<string, unknown> = {};
    if (patch.frozen !== undefined) row.frozen = patch.frozen;
    if (patch.onlinePayments !== undefined) row.online_payments = patch.onlinePayments;
    if (patch.dailyLimit !== undefined) row.daily_limit = patch.dailyLimit;
    if (patch.monthlyLimit !== undefined) row.monthly_limit = patch.monthlyLimit;
    const data = check(await this.db.from("virtual_cards").update(row).eq("user_id", userId).select("*").single());
    return toCard(data);
  }

  // ---- transactions ---------------------------------------------------------

  private filtered(userId: string, query: TransactionQuery, count: boolean) {
    let q = this.db.from("transactions").select("*", count ? { count: "exact" } : undefined).eq("user_id", userId);
    if (query.type && query.type !== "all") q = q.eq("type", query.type);
    if (query.status && query.status !== "all") q = q.eq("status", query.status);
    if (query.direction && query.direction !== "all") q = q.eq("direction", query.direction);
    if (query.from) q = q.gte("created_at", lagosDayStartIso(query.from));
    if (query.to) q = q.lte("created_at", lagosDayEndIso(query.to));
    if (query.search) {
      const term = sanitizeSearch(query.search);
      if (term) q = q.or(`description.ilike.*${term}*,reference.ilike.*${term}*,narration.ilike.*${term}*`);
    }
    const sort = query.sort ?? "date_desc";
    if (sort.startsWith("amount")) q = q.order("total", { ascending: sort === "amount_asc" }).order("created_at", { ascending: false });
    else q = q.order("created_at", { ascending: sort === "date_asc" });
    return q;
  }

  async listTransactions(userId: string, query: TransactionQuery): Promise<TransactionPage> {
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    let page = Math.max(1, query.page ?? 1);
    let result = await this.filtered(userId, query, true).range((page - 1) * pageSize, page * pageSize - 1);
    if (result.error) throw toAppError(result.error);
    const total = result.count ?? 0;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    if (page > pageCount) {
      page = pageCount;
      result = await this.filtered(userId, query, true).range((page - 1) * pageSize, page * pageSize - 1);
      if (result.error) throw toAppError(result.error);
    }
    return { items: (result.data ?? []).map(toTransaction), total, page, pageSize, pageCount };
  }

  async exportTransactions(userId: string, query: TransactionQuery, cap = 5000): Promise<Transaction[]> {
    const data = check(await this.filtered(userId, query, false).limit(cap));
    return (data ?? []).map(toTransaction);
  }

  async listRecentTransactions(userId: string, sinceIso?: string): Promise<Transaction[]> {
    let q = this.db.from("transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(2000);
    if (sinceIso) q = q.gte("created_at", sinceIso);
    return (check(await q) ?? []).map(toTransaction);
  }

  async getTransaction(userId: string, idOrReference: string): Promise<Transaction | null> {
    const isUuid = /^[0-9a-f-]{36}$/i.test(idOrReference);
    const q = this.db.from("transactions").select("*").eq("user_id", userId);
    const data = check(await (isUuid ? q.eq("id", idOrReference) : q.eq("reference", idOrReference)).maybeSingle());
    return data ? toTransaction(data) : null;
  }

  async listLedgerEntries(userId: string): Promise<LedgerEntry[]> {
    const account = await this.getAccount(userId);
    if (!account) return [];
    const data = check(await this.db.from("ledger_entries").select("*").eq("account_id", account.id).order("created_at"));
    return (data ?? []).map(toLedgerEntry);
  }

  // ---- beneficiaries --------------------------------------------------------

  async listBeneficiaries(userId: string): Promise<Beneficiary[]> {
    const data = check(await this.db.from("beneficiaries").select("*").eq("user_id", userId));
    return (data ?? [])
      .map(toBeneficiary)
      .sort((a, b) => (b.lastUsedAt ?? b.createdAt).localeCompare(a.lastUsedAt ?? a.createdAt));
  }

  async getBeneficiary(userId: string, id: string): Promise<Beneficiary | null> {
    const data = check(await this.db.from("beneficiaries").select("*").eq("user_id", userId).eq("id", id).maybeSingle());
    return data ? toBeneficiary(data) : null;
  }

  async findBeneficiary(userId: string, bankCode: string, accountNumber: string): Promise<Beneficiary | null> {
    const data = check(
      await this.db.from("beneficiaries").select("*").eq("user_id", userId).eq("bank_code", bankCode).eq("account_number", accountNumber).maybeSingle(),
    );
    return data ? toBeneficiary(data) : null;
  }

  async createBeneficiary(userId: string, b: BeneficiaryData): Promise<Beneficiary> {
    const result = await this.db
      .from("beneficiaries")
      .insert({ user_id: userId, bank_code: b.bankCode, bank_name: b.bankName, account_number: b.accountNumber, account_name: b.accountName, nickname: b.nickname })
      .select("*")
      .single();
    if (result.error?.code === "23505") throw new AppError("DUPLICATE", "This account is already saved as a beneficiary.");
    return toBeneficiary(check(result));
  }

  async updateBeneficiary(userId: string, id: string, b: BeneficiaryData): Promise<Beneficiary> {
    const result = await this.db
      .from("beneficiaries")
      .update({ bank_code: b.bankCode, bank_name: b.bankName, account_number: b.accountNumber, account_name: b.accountName, nickname: b.nickname })
      .eq("user_id", userId)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (result.error?.code === "23505") throw new AppError("DUPLICATE", "Another saved beneficiary already uses this account.");
    const data = check(result);
    if (!data) throw Errors.notFound("Beneficiary");
    return toBeneficiary(data);
  }

  async deleteBeneficiary(userId: string, id: string): Promise<void> {
    const data = check(await this.db.from("beneficiaries").delete().eq("user_id", userId).eq("id", id).select("id"));
    if (!data || data.length === 0) throw Errors.notFound("Beneficiary");
  }

  async touchBeneficiary(userId: string, id: string): Promise<void> {
    await this.db.from("beneficiaries").update({ last_used_at: new Date().toISOString() }).eq("user_id", userId).eq("id", id);
  }

  // ---- notifications --------------------------------------------------------

  async listNotifications(userId: string, limit = 20): Promise<AppNotification[]> {
    const data = check(await this.db.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit));
    return (data ?? []).map(toNotification);
  }

  async createNotification(userId: string, n: { kind: AppNotification["kind"]; title: string; body: string; link?: string | null }): Promise<void> {
    check(await this.admin.from("notifications").insert({ user_id: userId, kind: n.kind, title: n.title, body: n.body, link: n.link ?? null }));
  }

  async markNotificationsRead(userId: string, ids?: string[]): Promise<void> {
    let q = this.db.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
    if (ids) q = q.in("id", ids);
    check(await q);
  }

  // ---- security -------------------------------------------------------------

  async getSecurityStatus(userId: string): Promise<SecurityStatus> {
    const record = await this.getPinRecord(userId);
    const data = check(await this.admin.from("user_security").select("pin_updated_at").eq("user_id", userId).maybeSingle());
    return { hasPin: !!record.pinHash, pinUpdatedAt: data?.pin_updated_at ?? null, pinLockedUntil: record.lockedUntil };
  }

  async getPinRecord(userId: string): Promise<PinRecord> {
    const data = check(await this.admin.from("user_security").select("*").eq("user_id", userId).maybeSingle());
    return {
      pinHash: data?.pin_hash ?? null,
      failedAttempts: data?.failed_pin_attempts ?? 0,
      lockedUntil: data?.pin_locked_until ? new Date(data.pin_locked_until).toISOString() : null,
    };
  }

  async setPinHash(userId: string, pinHash: string | null): Promise<void> {
    check(
      await this.admin
        .from("user_security")
        .upsert({ user_id: userId, pin_hash: pinHash, pin_updated_at: pinHash ? new Date().toISOString() : null, failed_pin_attempts: 0, pin_locked_until: null }),
    );
  }

  async recordPinAttempt(userId: string, success: boolean): Promise<PinRecord> {
    const data = check(await this.admin.rpc("app_record_pin_attempt", { p_user_id: userId, p_success: success })) as Record<string, unknown>;
    return {
      pinHash: (data.pin_hash as string) ?? null,
      failedAttempts: Number(data.failed_pin_attempts ?? 0),
      lockedUntil: data.pin_locked_until ? new Date(String(data.pin_locked_until)).toISOString() : null,
    };
  }

  // ---- money movement (service-role RPCs, atomic in Postgres) ---------------

  /** Retry when a freshly generated reference collides with an existing one. */
  private async withReference<T>(fn: (reference: string) => PromiseLike<{ data: T; error: PostgrestError | null }>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await fn(generateReference());
      if (result.error?.code === "23505" && /reference/.test(result.error.message)) continue;
      return check(result);
    }
    throw new AppError("INTERNAL", "Could not allocate a unique transaction reference.");
  }

  private toPosting(data: unknown): PostingResult {
    const payload = data as { transaction: Record<string, unknown>; replayed: boolean };
    return { transaction: toTransaction(payload.transaction), replayed: payload.replayed === true };
  }

  async reserveDebit(userId: string, idempotencyKey: string, intent: PostingIntent): Promise<PostingResult> {
    const data = await this.withReference((reference) =>
      this.admin.rpc("app_reserve_debit", {
        p_user_id: userId,
        p_idempotency_key: idempotencyKey,
        p_fingerprint: intent.fingerprint,
        p_reference: reference,
        p_type: intent.type,
        p_amount: intent.amount,
        p_fee: intent.fee,
        p_description: intent.description,
        p_narration: intent.narration,
        p_details: intent.details,
        p_provider: intent.provider,
      }),
    );
    return this.toPosting(data);
  }

  async settleTransaction(userId: string, transactionId: string, outcome: SettlementOutcome): Promise<Transaction> {
    const data = check(
      await this.admin.rpc("app_settle_transaction", {
        p_user_id: userId,
        p_transaction_id: transactionId,
        p_status: outcome.status,
        p_provider_reference: outcome.providerReference ?? null,
        p_failure_reason: outcome.failureReason ?? null,
        p_details: outcome.details ?? {},
      }),
    );
    return toTransaction(data as Record<string, unknown>);
  }

  async postCredit(userId: string, idempotencyKey: string, intent: PostingIntent): Promise<PostingResult> {
    const data = await this.withReference((reference) =>
      this.admin.rpc("app_post_credit", {
        p_user_id: userId,
        p_idempotency_key: idempotencyKey,
        p_fingerprint: intent.fingerprint,
        p_reference: reference,
        p_amount: intent.amount,
        p_description: intent.description,
        p_narration: intent.narration,
        p_details: intent.details,
        p_provider: intent.provider,
      }),
    );
    return this.toPosting(data);
  }

  async recordDeclined(userId: string, idempotencyKey: string, intent: PostingIntent, reason: string): Promise<PostingResult> {
    const data = await this.withReference((reference) =>
      this.admin.rpc("app_record_declined", {
        p_user_id: userId,
        p_idempotency_key: idempotencyKey,
        p_fingerprint: intent.fingerprint,
        p_reference: reference,
        p_type: intent.type,
        p_amount: intent.amount,
        p_description: intent.description,
        p_details: intent.details,
        p_provider: intent.provider,
        p_reason: reason,
      }),
    );
    return this.toPosting(data);
  }
}
