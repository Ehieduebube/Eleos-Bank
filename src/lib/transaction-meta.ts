import type { Transaction, TransactionStatus, TransactionType } from "./types";

export const TYPE_LABELS: Record<TransactionType, string> = {
  transfer: "Transfer",
  airtime: "Airtime",
  data: "Data",
  electricity: "Electricity",
  cable_tv: "Cable TV",
  internet: "Internet",
  utility: "Utility",
  betting: "Betting",
  card: "Card",
  credit: "Credit",
};

export const STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: "Pending",
  successful: "Successful",
  failed: "Failed",
  reversed: "Reversed",
};

/**
 * Spending categories for analytics. Airtime and data share a category so the
 * chart stays within the 8-slot validated categorical palette; the slot order
 * is fixed so a category keeps its colour whatever else is on screen.
 */
export const SPENDING_CATEGORIES = [
  { id: "transfers", label: "Transfers", types: ["transfer"], color: "var(--chart-1)" },
  { id: "airtime_data", label: "Airtime & data", types: ["airtime", "data"], color: "var(--chart-2)" },
  { id: "electricity", label: "Electricity", types: ["electricity"], color: "var(--chart-3)" },
  { id: "cable_tv", label: "Cable TV", types: ["cable_tv"], color: "var(--chart-4)" },
  { id: "internet", label: "Internet", types: ["internet"], color: "var(--chart-5)" },
  { id: "card", label: "Card spend", types: ["card"], color: "var(--chart-6)" },
  { id: "betting", label: "Betting", types: ["betting"], color: "var(--chart-7)" },
  { id: "utility", label: "Other bills", types: ["utility"], color: "var(--chart-8)" },
] as const satisfies ReadonlyArray<{ id: string; label: string; types: readonly TransactionType[]; color: string }>;

export type SpendingCategoryId = (typeof SPENDING_CATEGORIES)[number]["id"];

/** Whether a transaction counts toward income/spend analytics and totals. */
export function countsTowardTotals(txn: Pick<Transaction, "status">): boolean {
  return txn.status === "successful";
}

export function counterpartyLabel(txn: Transaction): string {
  const d = txn.details;
  switch (txn.type) {
    case "transfer":
      return [d.recipientName, d.bankName].filter(Boolean).join(" · ");
    case "airtime":
    case "data":
      return [d.networkName, d.phone].filter(Boolean).join(" · ");
    case "credit":
      return d.senderName ?? d.source ?? "Incoming";
    case "card":
      return d.merchant ? `${d.merchant}${d.cardLast4 ? ` · card •••• ${d.cardLast4}` : ""}` : "Card payment";
    default:
      return [d.providerName, d.customerId].filter(Boolean).join(" · ");
  }
}
