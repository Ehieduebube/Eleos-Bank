"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyPoint } from "@/lib/analytics";
import { formatNaira } from "@/lib/money";
import { ChartTooltip, axisTick, compactTick } from "./chart-parts";

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
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeWidth={1} />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--border)" }} tick={axisTick} interval="preserveStartEnd" minTickGap={18} dy={6} />
              <YAxis tickFormatter={compactTick} tickLine={false} axisLine={false} tick={axisTick} width={52} />
              <Tooltip
                cursor={{ fill: "var(--brand-soft)", opacity: 0.8 }}
                content={(props) => (
                  <ChartTooltip
                    active={props.active}
                    label={props.label}
                    payload={props.payload}
                    extra={(entry) => {
                      const n = Number(entry.payload?.count ?? 0);
                      return `${n} payment${n === 1 ? "" : "s"}`;
                    }}
                  />
                )}
              />
              <Bar dataKey="spent" name="Spent" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
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
