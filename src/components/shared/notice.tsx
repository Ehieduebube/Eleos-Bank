import { Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Inline callout for something the user should know before acting (e.g. a frozen card, an expired link). */
export function Notice({ children, className, tone = "warning" }: { children: ReactNode; className?: string; tone?: "warning" | "info" }) {
  const Icon = tone === "warning" ? TriangleAlert : Info;
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[0.8125rem] leading-relaxed",
        tone === "warning" ? "border-warning/25 bg-warning-soft text-foreground" : "border-brand-soft-border bg-brand-soft text-foreground",
        className,
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", tone === "warning" ? "text-warning" : "text-brand-vivid")} aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
