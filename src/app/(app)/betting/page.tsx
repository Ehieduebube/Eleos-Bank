import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { BettingPanel } from "@/components/payments/betting-form";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getViewer } from "@/server/context";

export const metadata: Metadata = { title: "Betting" };

export default async function BettingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await getViewer();
  const params = await searchParams;
  const provider = typeof params.provider === "string" ? params.provider : undefined;
  return (
    <div className="space-y-6">
      <PageHeader title="Fund a betting wallet" description="SportyBet, Bet9ja and other supported platforms." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent>
            <BettingPanel initialProvider={provider} />
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-success" aria-hidden="true" /> Bet responsibly
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Betting is for adults 18+. Set a budget and stick to it. If gambling stops being fun, take a break and talk to someone you trust.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
