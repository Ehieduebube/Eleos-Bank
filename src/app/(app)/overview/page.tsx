import type { Metadata } from "next";
import { BalanceCard } from "@/components/dashboard/balance-card";
import { DailySpendChart } from "@/components/dashboard/daily-spend-chart";
import { IncomeExpenseChart } from "@/components/dashboard/income-expense-chart";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { SpendingBreakdown } from "@/components/dashboard/spending-breakdown";
import { StatTiles } from "@/components/dashboard/stat-tiles";
import { PageHeader } from "@/components/shared/page-header";
import { computeAnalytics } from "@/lib/analytics";
import { firstName, formatDate, greeting } from "@/lib/format";
import { getViewer } from "@/server/context";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const { user, repo, profile, account } = await getViewer();
  const transactions = await repo.listRecentTransactions(user.id);
  const now = new Date();
  const analytics = computeAnalytics(transactions, now);
  const pendingHold = transactions.filter((t) => t.status === "pending" && t.direction === "debit").reduce((s, t) => s + t.total, 0);

  return (
    <div className="space-y-6">
      <PageHeader title={`${greeting(now)}, ${firstName(profile.fullName)}`} description={`Here's your account at a glance · ${formatDate(now.toISOString())}`} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <BalanceCard account={account} pendingHold={pendingHold} />
        </div>
        <div className="lg:col-span-2">
          <QuickActions />
        </div>
      </div>

      <StatTiles analytics={analytics} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <IncomeExpenseChart data={analytics.monthly} />
        </div>
        <div className="lg:col-span-2">
          <SpendingBreakdown categories={analytics.categories} windowLabel={analytics.categoryWindowLabel} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RecentTransactions transactions={transactions.slice(0, 7)} />
        </div>
        <div className="lg:col-span-2">
          <DailySpendChart data={analytics.daily} />
        </div>
      </div>
    </div>
  );
}
