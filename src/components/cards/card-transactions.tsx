"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { useBalanceVisibility } from "@/components/layout/balance-visibility";
import { EmptyState } from "@/components/shared/empty-state";
import { TransactionDetailDialog } from "@/components/transactions/transaction-detail-dialog";
import { TransactionRow } from "@/components/transactions/transaction-row";
import type { Transaction } from "@/lib/types";

export function CardTransactions({ transactions }: { transactions: Transaction[] }) {
  const { hidden } = useBalanceVisibility();
  const [selected, setSelected] = useState<Transaction | null>(null);
  if (transactions.length === 0) {
    return <EmptyState icon={CreditCard} title="No card activity yet" description="Purchases on this card will appear here." />;
  }
  return (
    <>
      <ul className="divide-y divide-border/70">
        {transactions.map((txn) => (
          <li key={txn.id}>
            <TransactionRow txn={txn} onSelect={setSelected} hideAmount={hidden} />
          </li>
        ))}
      </ul>
      <TransactionDetailDialog transaction={selected} open={!!selected} onOpenChange={(open) => !open && setSelected(null)} />
    </>
  );
}
