"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MonthlyPoint } from "@/lib/analytics";
import { formatNaira } from "@/lib/money";
import { ChartTooltip, LegendKey, axisTick, compactTick } from "./chart-parts";

const INCOME = "var(--chart-3)";
const EXPENSES = "var(--chart-1)";

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
              { label: "Income", color: INCOME },
              { label: "Expenses", color: EXPENSES },
            ]}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-64 w-full" role="img" aria-label="Grouped column chart of monthly income and expenses for the last six months">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeWidth={1} />
                <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--border)" }} tick={axisTick} dy={6} />
                <YAxis tickFormatter={compactTick} tickLine={false} axisLine={false} tick={axisTick} width={56} />
                <Tooltip cursor={{ fill: "var(--brand-soft)", opacity: 0.8 }} content={(props) => <ChartTooltip active={props.active} label={props.label} payload={props.payload} />} />
                <Bar dataKey="income" name="Income" fill={INCOME} radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="expenses" name="Expenses" fill={EXPENSES} radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
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
