"use client";

import { ArrowDownLeft, ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import { useBalanceVisibility } from "@/components/layout/balance-visibility";
import { Amount } from "@/components/shared/amount";
import { Card } from "@/components/ui/card";
import { percentChange, type Analytics } from "@/lib/analytics";
import { cn } from "@/lib/utils";

function Delta({ current, previous, upIsGood }: { current: number; previous: number; upIsGood: boolean }) {
  const change = percentChange(current, previous);
  if (change === null) return <span className="text-xs text-muted-foreground">No comparable data last month</span>;
  const up = change >= 0;
  const good = up === upIsGood;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", good ? "text-success" : "text-destructive")}>
      <Icon className="size-3.5" aria-hidden="true" />
      {up ? "+" : "−"}
      {Math.abs(change).toFixed(1)}%<span className="font-normal text-muted-foreground"> vs same period last month</span>
    </span>
  );
}

function Tile({ label, value, footer, icon }: { label: string; value: number; footer: React.ReactNode; icon: React.ReactNode }) {
  const { hidden } = useBalanceVisibility();
  return (
    <Card size="sm" className="relative gap-2 px-4">
      {/* Hairline of brand light along the top edge. */}
      <span className="pointer-events-none absolute inset-x-5 top-0 h-px bg-linear-to-r from-transparent via-brand-glow/45 to-transparent" aria-hidden="true" />
      <div className="flex items-center justify-between">
        <p className="text-[0.8125rem] font-medium text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className="text-xl font-semibold tracking-tight">
        <Amount kobo={value} hidden={hidden} />
      </p>
      <div className="min-h-4">{footer}</div>
    </Card>
  );
}

export function StatTiles({ analytics }: { analytics: Analytics }) {
  const inIcon = (
    <span className="flex size-7 items-center justify-center rounded-lg bg-success-soft text-success">
      <ArrowDownLeft className="size-4" aria-hidden="true" />
    </span>
  );
  const outIcon = (
    <span className="flex size-7 items-center justify-center rounded-lg bg-brand-soft text-brand-vivid ring-1 ring-brand-soft-border/70 ring-inset">
      <ArrowUpRight className="size-4" aria-hidden="true" />
    </span>
  );
  return (
    <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
      <Tile label="Total received" value={analytics.totalReceived} icon={inIcon} footer={<span className="text-xs text-muted-foreground">All successful credits</span>} />
      <Tile label="Total spent" value={analytics.totalSpent} icon={outIcon} footer={<span className="text-xs text-muted-foreground">Including fees</span>} />
      <Tile
        label="Income this month"
        value={analytics.thisMonthIncome}
        icon={inIcon}
        footer={<Delta current={analytics.thisMonthIncome} previous={analytics.lastMonthToDateIncome} upIsGood />}
      />
      <Tile
        label="Expenses this month"
        value={analytics.thisMonthExpenses}
        icon={outIcon}
        footer={<Delta current={analytics.thisMonthExpenses} previous={analytics.lastMonthToDateExpenses} upIsGood={false} />}
      />
    </div>
  );
}
