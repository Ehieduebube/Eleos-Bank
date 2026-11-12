import { MONTH_SHORT, WEEKDAY_SHORT, lagosDayKey, lagosMonthKey } from "./format";
import { SPENDING_CATEGORIES, countsTowardTotals } from "./transaction-meta";
import type { Transaction } from "./types";

export interface MonthlyPoint {
  key: string;
  label: string;
  income: number;
  expenses: number;
}

export interface DailyPoint {
  key: string;
  label: string;
  spent: number;
  count: number;
}

export interface CategorySlice {
  id: string;
  label: string;
  color: string;
  amount: number;
  share: number;
  count: number;
}

export interface Analytics {
  totalReceived: number;
  totalSpent: number;
  thisMonthIncome: number;
  thisMonthExpenses: number;
  lastMonthIncome: number;
  lastMonthExpenses: number;
  /** Last month up to the same day-of-month as today, for a like-for-like delta. */
  lastMonthToDateIncome: number;
  lastMonthToDateExpenses: number;
  monthly: MonthlyPoint[];
  daily: DailyPoint[];
  categories: CategorySlice[];
  categoryWindowLabel: string;
  pendingCount: number;
  transactionCount: number;
}


function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthKey: string): string {
  const m = Number(monthKey.slice(5, 7));
  return MONTH_SHORT[m - 1]!;
}

/** Debit amount that counts as "spent" (principal + fee). */
function spendOf(txn: Transaction): number {
  return txn.direction === "debit" ? txn.amount + txn.fee : 0;
}

/**
 * Derive every dashboard figure from the transaction list, so balance cards,
 * summaries and charts always agree with the ledger-backed history.
 * Only successful transactions count; pending, failed and reversed are excluded.
 */
export function computeAnalytics(transactions: Transaction[], now: Date = new Date(), months = 6, days = 14): Analytics {
  const settled = transactions.filter(countsTowardTotals);
  const currentMonth = lagosMonthKey(now);
  const previousMonth = shiftMonth(currentMonth, -1);

  const monthKeys = Array.from({ length: months }, (_, i) => shiftMonth(currentMonth, i - (months - 1)));
  const monthly = new Map<string, MonthlyPoint>(
    monthKeys.map((key) => [key, { key, label: monthLabel(key), income: 0, expenses: 0 }]),
  );

  const dayKeys = Array.from({ length: days }, (_, i) => lagosDayKey(new Date(now.getTime() - (days - 1 - i) * 86_400_000)));
  const daily = new Map<string, DailyPoint>(
    dayKeys.map((key) => {
      const [y, m, d] = key.split("-").map(Number);
      return [key, { key, label: `${WEEKDAY_SHORT[new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()]} ${d}`, spent: 0, count: 0 }];
    }),
  );

  // Category window: last 30 days, so the chart reflects recent behaviour.
  const categoryWindowStart = now.getTime() - 30 * 86_400_000;
  const categoryTotals = new Map<string, { amount: number; count: number }>();

  let totalReceived = 0;
  let totalSpent = 0;
  let lastMonthToDateIncome = 0;
  let lastMonthToDateExpenses = 0;
  const todayDay = Number(lagosDayKey(now).slice(8, 10));

  for (const txn of settled) {
    const monthKey = lagosMonthKey(txn.createdAt);
    const dayKey = lagosDayKey(txn.createdAt);
    const inLastMonthToDate = monthKey === previousMonth && Number(dayKey.slice(8, 10)) <= todayDay;
    if (txn.direction === "credit") {
      totalReceived += txn.amount;
      const point = monthly.get(monthKey);
      if (point) point.income += txn.amount;
      if (inLastMonthToDate) lastMonthToDateIncome += txn.amount;
    } else {
      const spend = spendOf(txn);
      totalSpent += spend;
      const point = monthly.get(monthKey);
      if (point) point.expenses += spend;
      if (inLastMonthToDate) lastMonthToDateExpenses += spend;
      const day = daily.get(dayKey);
      if (day) {
        day.spent += spend;
        day.count += 1;
      }
      if (new Date(txn.createdAt).getTime() >= categoryWindowStart) {
        const category = SPENDING_CATEGORIES.find((c) => (c.types as readonly string[]).includes(txn.type));
        if (category) {
          const entry = categoryTotals.get(category.id) ?? { amount: 0, count: 0 };
          entry.amount += spend;
          entry.count += 1;
          categoryTotals.set(category.id, entry);
        }
      }
    }
  }

  const categorySum = [...categoryTotals.values()].reduce((sum, c) => sum + c.amount, 0);
  const categories: CategorySlice[] = SPENDING_CATEGORIES.map((c) => {
    const entry = categoryTotals.get(c.id) ?? { amount: 0, count: 0 };
    return {
      id: c.id,
      label: c.label,
      color: c.color,
      amount: entry.amount,
      count: entry.count,
      share: categorySum > 0 ? entry.amount / categorySum : 0,
    };
  });

  const thisMonth = monthly.get(currentMonth) ?? { income: 0, expenses: 0 };
  const lastMonth = monthly.get(previousMonth) ?? { income: 0, expenses: 0 };

  return {
    totalReceived,
    totalSpent,
    thisMonthIncome: thisMonth.income,
    thisMonthExpenses: thisMonth.expenses,
    lastMonthIncome: lastMonth.income,
    lastMonthExpenses: lastMonth.expenses,
    lastMonthToDateIncome,
    lastMonthToDateExpenses,
    monthly: [...monthly.values()],
    daily: [...daily.values()],
    categories,
    categoryWindowLabel: "Last 30 days",
    pendingCount: transactions.filter((t) => t.status === "pending").length,
    transactionCount: transactions.length,
  };
}

/** Percentage change, or null when there is no baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
