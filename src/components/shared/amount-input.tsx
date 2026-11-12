"use client";

import { forwardRef, type ComponentProps } from "react";
import { formatAmountTyping, formatNaira, parseNairaToKobo } from "@/lib/money";
import { cn } from "@/lib/utils";
import { TILE_TRANSITION, tileClass } from "@/components/shared/tile-classes";

type AmountInputProps = Omit<ComponentProps<"input">, "onChange" | "value" | "type" | "size"> & {
  value: string;
  onValueChange: (value: string) => void;
  size?: "default" | "lg";
};

/** Naira amount field: ₦ prefix, live thousands separators, max two decimals. */
export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(function AmountInput(
  { value, onValueChange, className, size = "default", ...props },
  ref,
) {
  return (
    <div className="relative">
      <span
        className={cn(
          "pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-medium text-muted-foreground",
          size === "lg" ? "text-lg" : "text-sm",
        )}
        aria-hidden="true"
      >
        ₦
      </span>
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={value}
        onChange={(e) => onValueChange(formatAmountTyping(e.target.value))}
        className={cn(
          "tabular w-full min-w-0 rounded-lg border border-input bg-card pr-3 font-medium transition-colors outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30",
          size === "lg" ? "h-14 pl-8 text-2xl tracking-tight" : "h-10 pl-7 text-base md:text-sm",
          className,
        )}
        {...props}
      />
    </div>
  );
});

/** Quick-pick amount chips. */
export function AmountPresets({ presets, onPick, current }: { presets: number[]; onPick: (value: string) => void; current?: string }) {
  const currentKobo = current ? parseNairaToKobo(current) : null;
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested amounts">
      {presets.map((naira) => {
        const active = currentKobo === naira * 100;
        return (
          <button
            key={naira}
            type="button"
            onClick={() => onPick(formatAmountTyping(String(naira)))}
            aria-pressed={active}
            className={cn(
              `h-8 rounded-full border px-3 text-[0.8125rem] font-medium ${TILE_TRANSITION} outline-none focus-visible:ring-3 focus-visible:ring-ring/50`,
              tileClass(active),
            )}
          >
            {formatNaira(naira * 100, { trimZeroKobo: true })}
          </button>
        );
      })}
    </div>
  );
}
