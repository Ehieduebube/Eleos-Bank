import { AmountFieldSkeleton, CardSkeleton, FieldSkeleton, PageHeaderSkeleton, PageSkeleton, PrimaryButtonSkeleton } from "@/components/shared/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export function BettingSkeleton() {
  return (
    <PageSkeleton label="Loading betting">
      <PageHeaderSkeleton title="w-56" description="w-72" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <CardSkeleton className="space-y-5 lg:col-span-2">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: 7 }, (_, i) => (
                <Skeleton key={i} className="h-11 rounded-xl" />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <FieldSkeleton label="w-28" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
          <AmountFieldSkeleton chips={5} />
          <PrimaryButtonSkeleton />
        </CardSkeleton>
        <div className="space-y-4">
          <CardSkeleton compact className="space-y-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardSkeleton>
        </div>
      </div>
    </PageSkeleton>
  );
}
