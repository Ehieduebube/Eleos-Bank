"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlyPoint } from "@/lib/analytics";
import { ChartTooltip, EXPENSES_COLOR, INCOME_COLOR, axisTick, compactTick } from "./chart-parts";

/**
 * The Recharts plot of IncomeExpenseChart, in its own module so it can be lazy-loaded:
 * Recharts is the dashboard's heaviest dependency and draws nothing on the server anyway
 * (ResponsiveContainer has to measure its box in the browser first).
 */
export default function IncomeExpensePlot({ data }: { data: MonthlyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeWidth={1} />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--border)" }} tick={axisTick} dy={6} />
        <YAxis tickFormatter={compactTick} tickLine={false} axisLine={false} tick={axisTick} width={56} />
        <Tooltip cursor={{ fill: "var(--brand-soft)", opacity: 0.8 }} content={(props) => <ChartTooltip active={props.active} label={props.label} payload={props.payload} />} />
        <Bar dataKey="income" name="Income" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="expenses" name="Expenses" fill={EXPENSES_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}
