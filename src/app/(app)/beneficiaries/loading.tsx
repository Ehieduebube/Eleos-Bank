import { PageHeaderSkeleton, PageSkeleton, PrimaryButtonSkeleton } from "@/components/shared/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function BeneficiariesLoading() {
  return (
    <PageSkeleton label="Loading beneficiaries">
      <PageHeaderSkeleton title="w-44" description="w-80" />
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <PrimaryButtonSkeleton className="h-10 rounded-lg sm:w-40" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
              <Skeleton className="size-11 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="size-8 shrink-0 rounded-lg" />
              <Skeleton className="size-8 shrink-0 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </PageSkeleton>
  );
}
