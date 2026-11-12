"use client";

import { PieChart } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CategorySlice } from "@/lib/analytics";
import { formatNaira } from "@/lib/money";

/**
 * Part-to-whole as a segmented bar plus a ranked legend list: easier to read
 * than a donut with eight slices. Each category keeps its fixed palette slot.
 */
export function SpendingBreakdown({ categories, windowLabel }: { categories: CategorySlice[]; windowLabel: string }) {
  const active = categories.filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);
  const total = active.reduce((s, c) => s + c.amount, 0);
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Spending by category</CardTitle>
        <CardDescription>
          {windowLabel} · {formatNaira(total, { trimZeroKobo: true })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {active.length === 0 ? (
          <EmptyState icon={PieChart} title="No spending yet" description="Payments you make will be grouped here." className="py-8" />
        ) : (
          <>
            <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Share of spending by category">
              {active.map((c) => (
                <Tooltip key={c.id}>
                  <TooltipTrigger asChild>
                    <span className="h-full min-w-1 first:rounded-l-full last:rounded-r-full" style={{ width: `${c.share * 100}%`, background: c.color }} />
                  </TooltipTrigger>
                  <TooltipContent>
                    {c.label}: {formatNaira(c.amount)} ({(c.share * 100).toFixed(1)}%)
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
            <ul className="space-y-2.5">
              {active.map((c) => (
                <li key={c.id} className="flex items-center gap-3 text-sm">
                  <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: c.color }} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-foreground">{c.label}</span>
                  <span className="text-xs text-muted-foreground tabular">{(c.share * 100).toFixed(1)}%</span>
                  <span className="w-28 text-right font-medium tabular">{formatNaira(c.amount, { trimZeroKobo: true })}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
