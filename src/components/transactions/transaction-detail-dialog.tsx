"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Printer, RefreshCw, Zap } from "lucide-react";
import { refreshTransactionStatusAction } from "@/actions/payments";
import { Amount } from "@/components/shared/amount";
import { CopyButton } from "@/components/shared/copy-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { TransactionIcon } from "@/components/shared/transaction-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { receiptRows } from "@/lib/receipt";
import type { SummaryRow, Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SummaryList({ rows, className }: { rows: SummaryRow[]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-border/70", className)}>
      {rows.map((row) => (
        <div key={`${row.label}-${row.value}`} className="flex items-start justify-between gap-4 py-2.5 text-sm">
          <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
          <dd className={cn("min-w-0 text-right [overflow-wrap:anywhere]", row.emphasis && "font-semibold text-foreground", row.mono && "font-mono text-[0.8125rem]")}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function TokenPanel({ token, units }: { token: string; units?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-brand-glow/45 bg-brand-soft p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-brand-vivid uppercase">
        <Zap className="size-3.5" aria-hidden="true" /> Meter token
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="font-mono text-lg font-semibold tracking-wider break-all text-foreground">{token}</p>
        <CopyButton value={token.replace(/-/g, "")} label="Copy token" />
      </div>
      {units && <p className="mt-1 text-xs text-muted-foreground">{units}</p>}
    </div>
  );
}

export function TransactionDetailDialog({ transaction, open, onOpenChange }: { transaction: Transaction | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [current, setCurrent] = useState<Transaction | null>(transaction);
  const [pending, startTransition] = useTransition();
  const [lastId, setLastId] = useState<string | null>(transaction?.id ?? null);

  // Keep local copy in sync when a different transaction is opened.
  if (transaction && transaction.id !== lastId) {
    setLastId(transaction.id);
    setCurrent(transaction);
  }

  const txn = current ?? transaction;
  if (!txn) return null;

  const checkStatus = () =>
    startTransition(async () => {
      const result = await refreshTransactionStatusAction(txn.id);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setCurrent(result.data);
      if (result.data.status === "pending") toast.info("Still awaiting provider confirmation. Try again shortly.");
      else toast.success(`Transaction ${result.data.status}`);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <TransactionIcon type={txn.type} className="size-12" />
          <DialogTitle className="mt-2 text-base">{txn.description}</DialogTitle>
          <DialogDescription className="sr-only">Transaction details and receipt</DialogDescription>
          <Amount kobo={txn.total} direction={txn.direction} className="text-2xl font-semibold tracking-tight" muted={txn.status === "failed" || txn.status === "reversed"} />
          <StatusBadge status={txn.status} />
        </DialogHeader>

        {txn.failureReason && (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-destructive">{txn.failureReason}</p>
        )}
        {txn.status === "pending" && (
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-foreground">
            Awaiting provider confirmation. The amount is held from your balance and will be returned automatically if the payment fails.
          </p>
        )}
        {typeof txn.details.token === "string" && <TokenPanel token={txn.details.token} units={txn.details.units as string | undefined} />}

        <SummaryList rows={receiptRows(txn)} />

        <DialogFooter className="gap-2 sm:justify-between">
          {txn.status === "pending" ? (
            <Button variant="outline" onClick={checkStatus} disabled={pending}>
              <RefreshCw className={cn("size-4", pending && "animate-spin")} /> {pending ? "Checking…" : "Check status"}
            </Button>
          ) : (
            <CopyButton value={txn.reference} label="Copy reference" variant="outline" className="size-9" />
          )}
          <Button asChild>
            <Link href={`/receipt/${txn.id}`} target="_blank" rel="noopener">
              <Printer className="size-4" /> View receipt
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
