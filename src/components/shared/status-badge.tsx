import { CircleCheck, CircleX, Clock, Undo2 } from "lucide-react";
import { STATUS_LABELS } from "@/lib/transaction-meta";
import type { TransactionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<TransactionStatus, { className: string; Icon: typeof CircleCheck }> = {
  successful: { className: "bg-success-soft text-success", Icon: CircleCheck },
  pending: { className: "bg-warning-soft text-warning", Icon: Clock },
  failed: { className: "bg-danger-soft text-destructive", Icon: CircleX },
  reversed: { className: "bg-brand-soft text-brand-vivid", Icon: Undo2 },
};

/** Status is always icon + label, never colour alone. */
export function StatusBadge({ status, className }: { status: TransactionStatus; className?: string }) {
  const { className: tone, Icon } = STYLES[status];
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap", tone, className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}
