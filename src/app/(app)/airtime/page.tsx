import type { Metadata } from "next";
import { Suspense } from "react";
import { Smartphone, Wifi } from "lucide-react";
import { AirtimePanel, DataPanel } from "@/components/payments/airtime-forms";
import { PageHeader } from "@/components/shared/page-header";
import { UrlTabs } from "@/components/shared/url-tabs";
import { Card, CardContent } from "@/components/ui/card";
import { getViewer } from "@/server/context";

export const metadata: Metadata = { title: "Airtime & Data" };

export default async function AirtimePage() {
  const { profile } = await getViewer();
  return (
    <div className="space-y-6">
      <PageHeader title="Airtime & data" description="Top up any MTN, Airtel, Glo or 9mobile line." />
      <Card className="max-w-3xl">
        <CardContent>
          <Suspense>
            <UrlTabs
              defaultValue="airtime"
              tabs={[
                { value: "airtime", label: <><Smartphone className="size-4" /> Airtime</>, content: <AirtimePanel ownPhone={profile.phone} /> },
                { value: "data", label: <><Wifi className="size-4" /> Data</>, content: <DataPanel ownPhone={profile.phone} /> },
              ]}
            />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
