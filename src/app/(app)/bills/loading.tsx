import { AmountFieldSkeleton, CardSkeleton, FieldSkeleton, PageHeaderSkeleton, PageSkeleton, PrimaryButtonSkeleton, TabsSkeleton } from "@/components/shared/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function BillsLoading() {
  return (
    <PageSkeleton label="Loading bills">
      <PageHeaderSkeleton title="w-36" description="w-80" />
      <CardSkeleton className="max-w-3xl space-y-5">
        <TabsSkeleton count={4} />
        <FieldSkeleton label="w-36" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        </div>
        <div className="space-y-2">
          <FieldSkeleton label="w-28" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
        <AmountFieldSkeleton chips={5} />
        <PrimaryButtonSkeleton />
      </CardSkeleton>
    </PageSkeleton>
  );
}
