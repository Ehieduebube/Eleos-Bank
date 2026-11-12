import { formatNaira } from "@/lib/money";
import type { Direction } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AmountProps {
  kobo: number;
  /** Show +/− and colour credits green. */
  direction?: Direction;
  hidden?: boolean;
  trimZeroKobo?: boolean;
  className?: string;
  /** Mute amounts of failed/reversed transactions. */
  muted?: boolean;
}

/** The one place money is rendered, so formatting and masking stay consistent. */
export function Amount({ kobo, direction, hidden = false, trimZeroKobo = false, className, muted = false }: AmountProps) {
  if (hidden) {
    return (
      <span className={cn("tabular", className)} aria-label="Amount hidden">
        ₦ ••••••
      </span>
    );
  }
  const text = formatNaira(kobo, { trimZeroKobo });
  const sign = direction === "credit" ? "+" : direction === "debit" ? "−" : "";
  return (
    <span
      className={cn(
        "tabular whitespace-nowrap",
        direction === "credit" && !muted && "text-success",
        muted && "text-muted-foreground line-through decoration-1",
        className,
      )}
    >
      {sign}
      {text}
    </span>
  );
}
