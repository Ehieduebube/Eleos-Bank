import { Skeleton } from "@/components/ui/skeleton";

export function OverviewSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading your dashboard">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* The balance card is navy, so its placeholder is too. */}
        <Skeleton brand className="h-64 rounded-2xl lg:col-span-3" />
        <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
      </div>
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Skeleton className="h-80 rounded-2xl lg:col-span-3" />
        <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
      </div>
    </div>
  );
}
