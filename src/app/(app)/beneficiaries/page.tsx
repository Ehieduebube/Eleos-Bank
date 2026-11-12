import type { Metadata } from "next";
import { BeneficiaryList } from "@/components/beneficiaries/beneficiary-list";
import { PageHeader } from "@/components/shared/page-header";
import { getViewer } from "@/server/context";

export const metadata: Metadata = { title: "Beneficiaries" };

export default async function BeneficiariesPage() {
  const { user, repo } = await getViewer();
  const beneficiaries = await repo.listBeneficiaries(user.id);
  return (
    <div className="space-y-6">
      <PageHeader title="Beneficiaries" description={`${beneficiaries.length} saved account${beneficiaries.length === 1 ? "" : "s"} · account numbers are masked for your privacy`} />
      <BeneficiaryList beneficiaries={beneficiaries} />
    </div>
  );
}
