import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { Card, CardContent } from "@/components/ui/card";
import { getViewer } from "@/server/context";
import { parseTransactionQuery } from "@/server/repository/query";

export const metadata: Metadata = { title: "Transactions" };

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, repo } = await getViewer();
  const params = await searchParams;
  const query = parseTransactionQuery(params);
  const ref = typeof params.ref === "string" ? params.ref.slice(0, 64) : null;
  const [page, selected] = await Promise.all([repo.listTransactions(user.id, query), ref ? repo.getTransaction(user.id, ref) : Promise.resolve(null)]);

  return (
    <div className="space-y-6">
      <PageHeader title="Transactions" description="Search, filter and export your transaction history." />
      <Card>
        <CardContent className="space-y-5">
          <Suspense>
            <TransactionFilters />
          </Suspense>
          <Suspense>
            <TransactionsTable key={`${JSON.stringify(query)}-${ref ?? ""}`} page={page} initialSelected={selected} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
