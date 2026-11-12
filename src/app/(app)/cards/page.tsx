import type { Metadata } from "next";
import Link from "next/link";
import { CardControls } from "@/components/cards/card-controls";
import { CardTransactions } from "@/components/cards/card-transactions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isoDaysAgo, lagosDayKey, lagosMonthKey } from "@/lib/format";
import { getViewer } from "@/server/context";

export const metadata: Metadata = { title: "Cards" };

export default async function CardsPage() {
  const { user, repo } = await getViewer();
  const [card, transactions] = await Promise.all([
    repo.getCard(user.id),
    repo.listRecentTransactions(user.id, isoDaysAgo(120)),
  ]);
  if (!card) throw new Error("Virtual card was not provisioned.");

  const cardTxns = transactions.filter((t) => t.type === "card");
  const counted = cardTxns.filter((t) => t.status === "successful" || t.status === "pending");
  const now = new Date();
  const spentToday = counted.filter((t) => lagosDayKey(t.createdAt) === lagosDayKey(now)).reduce((s, t) => s + t.total, 0);
  const spentThisMonth = counted.filter((t) => lagosMonthKey(t.createdAt) === lagosMonthKey(now)).reduce((s, t) => s + t.total, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Cards" description="Manage your virtual card, spending limits and online payments." />
      <CardControls card={card} spentToday={spentToday} spentThisMonth={spentThisMonth} />
      <Card>
        <CardHeader>
          <CardTitle>Card transactions</CardTitle>
          <CardDescription>Last 120 days</CardDescription>
          <CardAction>
            <Button asChild variant="ghost" size="sm">
              <Link href="/transactions?type=card">View all</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <CardTransactions transactions={cardTxns.slice(0, 12)} />
        </CardContent>
      </Card>
    </div>
  );
}
