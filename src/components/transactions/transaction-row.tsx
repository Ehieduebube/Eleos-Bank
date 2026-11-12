import { Amount } from "@/components/shared/amount";
import { StatusBadge } from "@/components/shared/status-badge";
import { TransactionIcon } from "@/components/shared/transaction-icon";
import { formatTime, relativeDayLabel } from "@/lib/format";
import { counterpartyLabel } from "@/lib/transaction-meta";
import type { Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Compact transaction line used in lists (dashboard, mobile history, card history). */
export function TransactionRow({ txn, onSelect, hideAmount = false, className }: { txn: Transaction; onSelect?: (txn: Transaction) => void; hideAmount?: boolean; className?: string }) {
  const settledAway = txn.status === "failed" || txn.status === "reversed";
  const content = (
    <>
      <TransactionIcon type={txn.type} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{txn.description}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {counterpartyLabel(txn) || txn.reference} · {relativeDayLabel(txn.createdAt)}, {formatTime(txn.createdAt)}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <Amount kobo={txn.total} direction={txn.direction} hidden={hideAmount} muted={settledAway} className="text-sm font-semibold" />
        {txn.status !== "successful" && <StatusBadge status={txn.status} className="h-5 text-[0.7rem]" />}
      </span>
    </>
  );
  if (!onSelect) return <div className={cn("flex items-center gap-3 py-3", className)}>{content}</div>;
  return (
    <button
      type="button"
      onClick={() => onSelect(txn)}
      className={cn(
        "-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors outline-none hover:bg-brand-soft/60 focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      aria-label={`${txn.description}, ${txn.status}`}
    >
      {content}
    </button>
  );
}
