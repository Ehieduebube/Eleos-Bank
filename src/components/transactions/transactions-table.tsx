"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { useBalanceVisibility } from "@/components/layout/balance-visibility";
import { Amount } from "@/components/shared/amount";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { TransactionIcon } from "@/components/shared/transaction-icon";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatTime } from "@/lib/format";
import { TYPE_LABELS, counterpartyLabel } from "@/lib/transaction-meta";
import type { Transaction, TransactionPage } from "@/lib/types";
import { TransactionDetailDialog } from "./transaction-detail-dialog";
import { TransactionRow } from "./transaction-row";

export function TransactionsTable({ page, initialSelected }: { page: TransactionPage; initialSelected: Transaction | null }) {
  const { hidden } = useBalanceVisibility();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [selected, setSelected] = useState<Transaction | null>(initialSelected);

  const pageHref = (n: number) => {
    const next = new URLSearchParams(params.toString());
    next.delete("ref");
    if (n <= 1) next.delete("page");
    else next.set("page", String(n));
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const close = () => {
    setSelected(null);
    if (params.get("ref")) {
      const next = new URLSearchParams(params.toString());
      next.delete("ref");
      router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  };

  if (page.total === 0) {
    return <EmptyState icon={SearchX} title="No transactions found" description="Try a different search term, or clear the filters to see everything." />;
  }

  const first = (page.page - 1) * page.pageSize + 1;
  const last = Math.min(page.total, page.page * page.pageSize);

  return (
    <>
      {/* Mobile / tablet list */}
      <ul className="divide-y divide-border/70 md:hidden">
        {page.items.map((txn) => (
          <li key={txn.id}>
            <TransactionRow txn={txn} onSelect={setSelected} hideAmount={hidden} />
          </li>
        ))}
      </ul>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[38%]">Description</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.items.map((txn) => (
              <TableRow
                key={txn.id}
                tabIndex={0}
                role="button"
                aria-label={`Open ${txn.description}`}
                onClick={() => setSelected(txn)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(txn);
                  }
                }}
                className="cursor-pointer outline-none focus-visible:bg-muted"
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <TransactionIcon type={txn.type} className="size-9" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{txn.description}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {counterpartyLabel(txn) || "—"} · <span className="font-mono">{txn.reference}</span>
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{TYPE_LABELS[txn.type]}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className="block">{formatDate(txn.createdAt)}</span>
                  <span className="block text-xs text-muted-foreground">{formatTime(txn.createdAt)}</span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={txn.status} />
                </TableCell>
                <TableCell className="text-right">
                  <Amount kobo={txn.total} direction={txn.direction} hidden={hidden} muted={txn.status === "failed" || txn.status === "reversed"} className="font-semibold" />
                  {txn.fee > 0 && !hidden && <span className="block text-xs text-muted-foreground">incl. fee <Amount kobo={txn.fee} /></span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <nav aria-label="Pagination" className="mt-4 flex flex-col items-center justify-between gap-3 border-t pt-4 sm:flex-row">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{first}</span>–<span className="font-medium text-foreground">{last}</span> of{" "}
          <span className="font-medium text-foreground">{page.total}</span>
        </p>
        <div className="flex items-center gap-2">
          {page.page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(page.page - 1)} scroll={false}>
                <ChevronLeft className="size-4" /> Previous
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <ChevronLeft className="size-4" /> Previous
            </Button>
          )}
          <span className="text-sm text-muted-foreground tabular">
            Page {page.page} of {page.pageCount}
          </span>
          {page.page < page.pageCount ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(page.page + 1)} scroll={false}>
                Next <ChevronRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Next <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      </nav>

      <TransactionDetailDialog transaction={selected} open={!!selected} onOpenChange={(open) => !open && close()} />
    </>
  );
}
