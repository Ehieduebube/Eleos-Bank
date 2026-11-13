"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DailyPoint } from "@/lib/analytics";
import { formatNaira } from "@/lib/money";

// Lazy-loaded like the income vs expenses plot: see income-expense-chart.tsx.
const DailySpendPlot = dynamic(() => import("./daily-spend-plot"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-lg" />,
});

export function DailySpendChart({ data }: { data: DailyPoint[] }) {
  const total = data.reduce((s, d) => s + d.spent, 0);
  const count = data.reduce((s, d) => s + d.count, 0);
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Daily spending</CardTitle>
        <CardDescription>
          Last 14 days · {formatNaira(total, { trimZeroKobo: true })} across {count} payment{count === 1 ? "" : "s"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-56 w-full" role="img" aria-label="Column chart of daily spending over the last 14 days">
          <DailySpendPlot data={data} />
        </div>
        <table className="sr-only">
          <caption>Daily spending</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Spent</th>
              <th scope="col">Payments</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.key}>
                <th scope="row">{d.label}</th>
                <td>{formatNaira(d.spent)}</td>
                <td>{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
