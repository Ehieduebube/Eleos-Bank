import type { Metadata } from "next";
import { Droplet, Router, Tv, Zap } from "lucide-react";
import { CablePanel, ElectricityPanel, InternetPanel, UtilityPanel } from "@/components/payments/bill-forms";
import { PageHeader } from "@/components/shared/page-header";
import { UrlTabs } from "@/components/shared/url-tabs";
import { Card, CardContent } from "@/components/ui/card";
import { getViewer } from "@/server/context";

export const metadata: Metadata = { title: "Bills" };

export default async function BillsPage() {
  await getViewer();
  return (
    <div className="space-y-6">
      <PageHeader title="Pay bills" description="Electricity, cable TV, internet and other utilities." />
      <Card className="max-w-3xl">
        <CardContent>
          <UrlTabs
            defaultValue="electricity"
            tabs={[
              { value: "electricity", label: <><Zap className="size-4" /> Electricity</>, content: <ElectricityPanel /> },
              { value: "cable", label: <><Tv className="size-4" /> Cable TV</>, content: <CablePanel /> },
              { value: "internet", label: <><Router className="size-4" /> Internet</>, content: <InternetPanel /> },
              { value: "utilities", label: <><Droplet className="size-4" /> Water & waste</>, content: <UtilityPanel /> },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
