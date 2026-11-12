import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { TransferPanel } from "@/components/payments/transfer-form";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { describeFee, LIMITS } from "@/lib/fees";
import { formatNaira } from "@/lib/money";
import { getViewer } from "@/server/context";

export const metadata: Metadata = { title: "Transfer" };

export default async function TransferPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, repo, account } = await getViewer();
  const params = await searchParams;
  const beneficiaries = await repo.listBeneficiaries(user.id);
  const beneficiaryId = typeof params.beneficiary === "string" ? params.beneficiary : undefined;
  const initial = beneficiaryId ? beneficiaries.find((b) => b.id === beneficiaryId) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Send money"
        description="Transfer to any Nigerian bank account."
        actions={
          <Button asChild variant="outline">
            <Link href="/beneficiaries">
              <Users className="size-4" /> Manage beneficiaries
            </Link>
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent>
            <TransferPanel balance={account.balance} beneficiaries={beneficiaries} initial={initial} />
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Fees & limits</CardTitle>
              <CardDescription>Applied to every bank transfer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{describeFee("transfer")}</p>
              <p className="text-muted-foreground">
                Per transfer: {formatNaira(LIMITS.transfer.min, { trimZeroKobo: true })} – {formatNaira(LIMITS.transfer.max, { trimZeroKobo: true })}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
