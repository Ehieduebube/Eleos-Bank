"use client";

import dynamic from "next/dynamic";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MonthlyPoint } from "@/lib/analytics";
import { formatNaira } from "@/lib/money";
import { ChartPlaceholder, ChartUnavailable, EXPENSES_COLOR, INCOME_COLOR, LegendKey } from "./chart-parts";

// Recharts loads after the page is interactive, in its own chunk; the card, its legend and the
// screen-reader table below render with the page. The placeholder fills the plot's fixed box.
const IncomeExpensePlot = dynamic(() => import("./income-expense-plot").catch(() => ({ default: ChartUnavailable })), {
  ssr: false,
  loading: ChartPlaceholder,
});

export function IncomeExpenseChart({ data }: { data: MonthlyPoint[] }) {
  const hasData = data.some((d) => d.income > 0 || d.expenses > 0);
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Income vs expenses</CardTitle>
        <CardDescription>Last 6 months · successful transactions</CardDescription>
        <CardAction>
          <LegendKey
            items={[
              { label: "Income", color: INCOME_COLOR },
              { label: "Expenses", color: EXPENSES_COLOR },
            ]}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-64 w-full" role="img" aria-label="Grouped column chart of monthly income and expenses for the last six months">
            <IncomeExpensePlot data={data} />
          </div>
        ) : (
          <p className="py-16 text-center text-sm text-muted-foreground">No completed transactions in this period yet.</p>
        )}
        <table className="sr-only">
          <caption>Monthly income and expenses</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Income</th>
              <th scope="col">Expenses</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.key}>
                <th scope="row">{d.label}</th>
                <td>{formatNaira(d.income)}</td>
                <td>{formatNaira(d.expenses)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
