"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ScrollText } from "lucide-react";
import { useBalanceVisibility } from "@/components/layout/balance-visibility";
import { EmptyState } from "@/components/shared/empty-state";
import { TransactionDetailDialog } from "@/components/transactions/transaction-detail-dialog";
import { TransactionRow } from "@/components/transactions/transaction-row";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Transaction } from "@/lib/types";

export function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  const { hidden } = useBalanceVisibility();
  const [selected, setSelected] = useState<Transaction | null>(null);
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>Your latest transactions</CardDescription>
        <CardAction>
          <Button asChild variant="ghost" size="sm">
            <Link href="/transactions">
              View all <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <EmptyState icon={ScrollText} title="No transactions yet" description="Transfers and payments will appear here." />
        ) : (
          <ul className="divide-y divide-border/70">
            {transactions.map((txn) => (
              <li key={txn.id}>
                <TransactionRow txn={txn} onSelect={setSelected} hideAmount={hidden} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <TransactionDetailDialog transaction={selected} open={!!selected} onOpenChange={(open) => !open && setSelected(null)} />
    </Card>
  );
}
