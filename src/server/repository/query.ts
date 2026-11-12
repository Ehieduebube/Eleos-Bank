import { z } from "zod";
import { lagosDayKey } from "@/lib/format";
import { TRANSACTION_STATUSES, TRANSACTION_TYPES, type Transaction, type TransactionPage, type TransactionQuery } from "@/lib/types";

export const DEFAULT_PAGE_SIZE = 12;

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Parse untrusted URL search params into a safe TransactionQuery. */
export function parseTransactionQuery(params: Record<string, string | string[] | undefined>): TransactionQuery {
  const get = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const type = get("type");
  const status = get("status");
  const direction = get("direction");
  const sort = get("sort");
  const from = get("from");
  const to = get("to");
  const page = Number(get("page") ?? "1");
  return {
    search: get("q")?.trim().slice(0, 80) || undefined,
    type: type && (TRANSACTION_TYPES as readonly string[]).includes(type) ? (type as TransactionQuery["type"]) : "all",
    status: status && (TRANSACTION_STATUSES as readonly string[]).includes(status) ? (status as TransactionQuery["status"]) : "all",
    direction: direction === "debit" || direction === "credit" ? direction : "all",
    sort: sort === "date_asc" || sort === "amount_desc" || sort === "amount_asc" ? sort : "date_desc",
    from: from && dateKey.safeParse(from).success ? from : undefined,
    to: to && dateKey.safeParse(to).success ? to : undefined,
    page: Number.isInteger(page) && page > 0 ? Math.min(page, 10_000) : 1,
    pageSize: DEFAULT_PAGE_SIZE,
  };
}

export function matchesQuery(txn: Transaction, query: TransactionQuery): boolean {
  if (query.type && query.type !== "all" && txn.type !== query.type) return false;
  if (query.status && query.status !== "all" && txn.status !== query.status) return false;
  if (query.direction && query.direction !== "all" && txn.direction !== query.direction) return false;
  if (query.from || query.to) {
    const day = lagosDayKey(txn.createdAt);
    if (query.from && day < query.from) return false;
    if (query.to && day > query.to) return false;
  }
  if (query.search) {
    const needle = query.search.toLowerCase();
    const haystack = [txn.description, txn.reference, txn.narration ?? "", txn.details.recipientName ?? "", txn.details.customerId ?? ""]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

export function compareTransactions(sort: TransactionQuery["sort"] = "date_desc") {
  return (a: Transaction, b: Transaction) => {
    switch (sort) {
      case "date_asc":
        return a.createdAt.localeCompare(b.createdAt);
      case "amount_desc":
        return b.total - a.total || b.createdAt.localeCompare(a.createdAt);
      case "amount_asc":
        return a.total - b.total || b.createdAt.localeCompare(a.createdAt);
      default:
        return b.createdAt.localeCompare(a.createdAt);
    }
  };
}

export function paginate(items: Transaction[], query: TransactionQuery): TransactionPage {
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, query.page ?? 1), pageCount);
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    pageSize,
    pageCount,
  };
}

/** Convert a Lagos calendar day (YYYY-MM-DD) to the UTC instant at which it starts. */
export function lagosDayStartIso(day: string): string {
  return new Date(`${day}T00:00:00+01:00`).toISOString();
}

export function lagosDayEndIso(day: string): string {
  return new Date(new Date(`${day}T00:00:00+01:00`).getTime() + 86_400_000 - 1).toISOString();
}
