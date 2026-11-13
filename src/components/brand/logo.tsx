import { cn } from "@/lib/utils";

/** Eleos mark: a rounded tile with three ascending bars and an emerald arc. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="9" className="fill-navy" />
      <rect x="8" y="17" width="3.5" height="7" rx="1.75" fill="white" opacity="0.55" />
      <rect x="14.25" y="13" width="3.5" height="11" rx="1.75" fill="white" opacity="0.8" />
      <rect x="20.5" y="9" width="3.5" height="15" rx="1.75" fill="white" />
      <path d="M7 10.5c3.2-3.4 8.6-4.6 13-2.6" stroke="#34d399" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/**
 * Mark + wordmark. `inverse` is for navy surfaces: the tile is the same colour as
 * the background there, so the unchanged mark gets a hairline frame and soft glow
 * to keep its edge visible, and the wordmark turns white.
 */
export function Logo({
  className,
  markClassName,
  wordmarkClassName,
  showWordmark = true,
  inverse = false,
}: {
  className?: string;
  /** Size the mark (default `size-8`). The inverse frame follows it. */
  markClassName?: string;
  wordmarkClassName?: string;
  showWordmark?: boolean;
  inverse?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {inverse ? (
        // 28.125% = the tile's 9/32 corner radius, so the frame fits the mark at any size.
        <span className="inline-flex rounded-[28.125%] shadow-[0_0_0_1px_rgb(255_255_255/0.16),0_6px_16px_-6px_rgb(0_0_0/0.55),0_0_20px_-4px_oklch(0.56_0.16_264.48/0.6)]">
          <LogoMark className={markClassName} />
        </span>
      ) : (
        <LogoMark className={markClassName} />
      )}
      {showWordmark && (
        <span className={cn("text-[1.05rem] font-semibold tracking-tight", inverse ? "text-white" : "text-foreground", wordmarkClassName)}>
          Eleos
        </span>
      )}
    </span>
  );
}
