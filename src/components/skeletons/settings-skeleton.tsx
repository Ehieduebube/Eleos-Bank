import { CardSkeleton, FieldSkeleton, PageHeaderSkeleton, PageSkeleton, TabsSkeleton } from "@/components/shared/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export function SettingsSkeleton() {
  return (
    <PageSkeleton label="Loading settings">
      <PageHeaderSkeleton title="w-32" description="w-80" />
      <TabsSkeleton count={5} tabWidth="sm:w-24" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <CardSkeleton className="space-y-5 lg:col-span-2">
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <FieldSkeleton label="w-20" />
          <FieldSkeleton label="w-28" />
          <FieldSkeleton label="w-28" />
          <Skeleton className="ml-auto h-9 w-32 rounded-lg" />
        </CardSkeleton>
        <CardSkeleton className="h-fit space-y-4">
          <Skeleton className="h-5 w-32" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </CardSkeleton>
      </div>
    </PageSkeleton>
  );
}
