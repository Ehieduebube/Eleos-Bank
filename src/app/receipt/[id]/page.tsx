import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { ReceiptActions } from "@/components/receipt/receipt-actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { SummaryList, TokenPanel } from "@/components/transactions/transaction-detail-dialog";
import { formatDateTime, maskAccountNumber } from "@/lib/format";
import { formatNaira } from "@/lib/money";
import { receiptRows, resultHeadline } from "@/lib/receipt";
import { getViewer } from "@/server/context";

export const metadata: Metadata = { title: "Receipt" };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, repo, account } = await getViewer();
  // Ownership enforced by the repository: another user's id or reference resolves to null.
  const txn = await repo.getTransaction(user.id, decodeURIComponent(id).slice(0, 64));
  if (!txn) notFound();

  return (
    <div className="min-h-dvh bg-surface-sunken px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-lg space-y-4">
        <ReceiptActions />
        <article className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-card print:border-0 print:shadow-none sm:p-8">
          <div className="bg-brand-gradient-x absolute inset-x-0 top-0 h-1" aria-hidden="true" />
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-[5.5rem] font-black tracking-widest text-foreground/[0.035] select-none -rotate-12"
            aria-hidden="true"
          >
            DEMO
          </div>
          <header className="relative flex items-start justify-between gap-4 border-b pb-5">
            <div>
              <Logo />
              <p className="mt-2 text-xs text-muted-foreground">Transaction receipt</p>
            </div>
            <StatusBadge status={txn.status} />
          </header>

          <div className="relative py-6 text-center">
            <p className="text-sm text-muted-foreground">{resultHeadline(txn)}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight tabular">{formatNaira(txn.total)}</p>
            <p className="mt-1 text-sm">{txn.description}</p>
          </div>

          {typeof txn.details.token === "string" && (
            <div className="relative mb-5">
              <TokenPanel token={txn.details.token} units={txn.details.units as string | undefined} />
            </div>
          )}
          {txn.failureReason && <p className="relative mb-5 rounded-lg bg-danger-soft px-3 py-2 text-sm text-destructive">{txn.failureReason}</p>}

          <div className="relative">
            <h2 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Details</h2>
            <SummaryList rows={receiptRows(txn)} />
            <h2 className="mt-5 mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{txn.direction === "debit" ? "Paid from" : "Paid to"}</h2>
            <SummaryList
              rows={[
                { label: "Account name", value: account.accountName },
                { label: "Account number", value: maskAccountNumber(account.accountNumber), mono: true },
                { label: "Bank", value: account.bankName },
              ]}
            />
          </div>

          <footer className="relative mt-6 border-t pt-4 text-center text-[0.7rem] leading-relaxed text-muted-foreground">
            {/* Kept deliberately: a printable transfer receipt must never pass as real proof of payment. */}
            Generated {formatDateTime(new Date().toISOString())} WAT · Demo receipt — not proof of payment.
          </footer>
        </article>
      </div>
    </div>
  );
}
