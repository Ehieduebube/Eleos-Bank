"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyPoint } from "@/lib/analytics";
import { ChartTooltip, axisTick, compactTick } from "./chart-parts";

/** The Recharts plot of DailySpendChart, in its own module so it can be lazy-loaded (see IncomeExpensePlot). */
export default function DailySpendPlot({ data }: { data: DailyPoint[] }) {
  return (
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
  );
}
