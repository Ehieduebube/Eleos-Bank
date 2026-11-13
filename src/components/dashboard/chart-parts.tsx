"use client";

import { formatNaira, formatNairaCompact } from "@/lib/money";

/** Series colours of the income vs expenses chart (its legend and its lazy-loaded plot). */
export const INCOME_COLOR = "var(--chart-3)";
export const EXPENSES_COLOR = "var(--chart-1)";

export interface TooltipEntry {
  name?: unknown;
  value?: unknown;
  color?: string;
  dataKey?: unknown;
  payload?: Record<string, unknown>;
}

/** Shared tooltip body: text in text tokens, identity carried by the swatch. */
export function ChartTooltip({ active, label, payload, extra }: { active?: boolean; label?: string | number; payload?: ReadonlyArray<TooltipEntry>; extra?: (entry: TooltipEntry) => string | null }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-40 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-raised">
      {label !== undefined && <p className="mb-1.5 font-medium">{String(label)}</p>}
      <ul className="space-y-1">
        {payload.map((entry) => (
          <li key={String(entry.dataKey)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2.5 rounded-[3px]" style={{ background: entry.color }} aria-hidden="true" />
              {String(entry.name)}
            </span>
            <span className="tabular font-medium">{formatNaira(Number(entry.value ?? 0))}</span>
          </li>
        ))}
      </ul>
      {extra && payload[0] && extra(payload[0]) && <p className="mt-1.5 text-muted-foreground">{extra(payload[0])}</p>}
    </div>
  );
}

export const axisTick = { fill: "var(--muted-foreground)", fontSize: 11 } as const;

export function compactTick(value: number) {
  return value === 0 ? "₦0" : formatNairaCompact(value);
}

export function LegendKey({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: item.color }} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
