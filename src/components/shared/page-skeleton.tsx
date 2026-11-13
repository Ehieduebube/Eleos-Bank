import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/*
 * Building blocks for the routes' loading.tsx files. Every route has its own skeleton that
 * mirrors that page's layout (header, cards, grid), so a refresh or a navigation never shows
 * a different page's shape before the real content streams in.
 */

/** Root of a route skeleton; announces the loading state to assistive technology. */
export function PageSkeleton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label={label}>
      {children}
    </div>
  );
}

/** Mirrors <PageHeader>: title, description and an optional action button (widths are classes). */
export function PageHeaderSkeleton({ title, description, action }: { title: string; description: string; action?: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2.5">
        <Skeleton className={cn("h-8 max-w-full", title)} />
        <Skeleton className={cn("h-4 max-w-full", description)} />
      </div>
      {action && <Skeleton className={cn("h-9 rounded-lg", action)} />}
    </div>
  );
}

/** Mirrors <Card>: the same surface, border, radius and padding. `compact` matches `<Card size="sm">`. */
export function CardSkeleton({ className, compact = false, children }: { className?: string; compact?: boolean; children?: ReactNode }) {
  return <div className={cn("rounded-2xl border border-border bg-card shadow-card", compact ? "p-3.5" : "p-5", className)}>{children}</div>;
}

/** A labelled form field. `input` sets the control's height (amount inputs are taller). */
export function FieldSkeleton({ label = "w-28", input = "h-10" }: { label?: string; input?: string }) {
  return (
    <div className="space-y-2">
      <Skeleton className={cn("h-4", label)} />
      <Skeleton className={cn("w-full rounded-lg", input)} />
    </div>
  );
}

/** An amount field with its row of quick-amount chips. */
export function AmountFieldSkeleton({ chips }: { chips: number }) {
  return (
    <div className="space-y-2">
      <FieldSkeleton label="w-16" input="h-14" />
      <div className="flex flex-wrap gap-2 pt-1">
        {Array.from({ length: chips }, (_, i) => (
          <Skeleton key={i} className="h-8 w-[4.5rem] rounded-full" />
        ))}
      </div>
    </div>
  );
}

/** Mirrors <UrlTabs>' list: a two-column grid on phones (an odd last tab spans the row), one row from sm. */
export function TabsSkeleton({ count, tabWidth = "sm:w-28" }: { count: number; tabWidth?: string }) {
  return (
    <div className="grid w-full grid-cols-2 gap-1 rounded-lg bg-muted p-[3px] sm:inline-flex sm:w-fit">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={cn("h-9 rounded-md last:odd:col-span-2 sm:h-[2.125rem]", tabWidth)} />
      ))}
    </div>
  );
}

/** The navy primary button ("Continue", "Add beneficiary"). */
export function PrimaryButtonSkeleton({ className }: { className?: string }) {
  return <Skeleton brand className={cn("h-11 w-full rounded-xl shadow-glow-sm", className)} />;
}

/** Rows of a transaction-style list: icon, two lines of text and an amount. */
export function ListRowsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="divide-y divide-border/70">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="size-10 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
