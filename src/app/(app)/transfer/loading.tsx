import { AmountFieldSkeleton, CardSkeleton, FieldSkeleton, PageHeaderSkeleton, PageSkeleton, PrimaryButtonSkeleton } from "@/components/shared/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function TransferLoading() {
  return (
    <PageSkeleton label="Loading transfer">
      <PageHeaderSkeleton title="w-44" description="w-64" action="w-[12.5rem]" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <CardSkeleton className="space-y-6 lg:col-span-2">
          <div className="space-y-3">
            <Skeleton className="h-4 w-44" />
            <div className="flex gap-3 overflow-hidden">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[5.5rem] w-36 shrink-0 rounded-xl" />
              ))}
            </div>
          </div>
          <FieldSkeleton label="w-32" />
          <FieldSkeleton label="w-28" />
          <AmountFieldSkeleton chips={0} />
          <FieldSkeleton label="w-36" />
          <PrimaryButtonSkeleton />
        </CardSkeleton>
        <div className="space-y-4">
          <CardSkeleton compact className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-40" />
          </CardSkeleton>
        </div>
      </div>
    </PageSkeleton>
  );
}
