import { AmountFieldSkeleton, CardSkeleton, FieldSkeleton, PageHeaderSkeleton, PageSkeleton, PrimaryButtonSkeleton, TabsSkeleton } from "@/components/shared/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function AirtimeLoading() {
  return (
    <PageSkeleton label="Loading airtime and data">
      <PageHeaderSkeleton title="w-52" description="w-72" />
      <CardSkeleton className="max-w-3xl space-y-5">
        <TabsSkeleton count={2} tabWidth="sm:w-[5.5rem]" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <div className="grid grid-cols-4 gap-2 sm:max-w-md">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        </div>
        <FieldSkeleton label="w-28" />
        <AmountFieldSkeleton chips={6} />
        <PrimaryButtonSkeleton />
      </CardSkeleton>
    </PageSkeleton>
  );
}
