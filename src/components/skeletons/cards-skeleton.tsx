import { CardSkeleton, ListRowsSkeleton, PageHeaderSkeleton, PageSkeleton } from "@/components/shared/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/** A card-controls row: icon, label and hint, and a switch. */
function ControlRow() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="size-9 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-48 max-w-full" />
      </div>
      <Skeleton className="h-5 w-9 shrink-0 rounded-full" />
    </div>
  );
}

export function CardsSkeleton() {
  return (
    <PageSkeleton label="Loading cards">
      <PageHeaderSkeleton title="w-28" description="w-96" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {/* The virtual card is navy, so its placeholder is too. */}
          <Skeleton brand className="mx-auto aspect-[1.586] w-full max-w-sm rounded-2xl" />
          <Skeleton className="mx-auto h-3 w-32" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
        <div className="space-y-4">
          <CardSkeleton compact className="space-y-5">
            <Skeleton className="h-4 w-28" />
            <ControlRow />
            <ControlRow />
          </CardSkeleton>
          <CardSkeleton compact className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-56 max-w-full" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-2 w-full rounded-full" />
          </CardSkeleton>
        </div>
      </div>
      <CardSkeleton className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-7 w-16 rounded-lg" />
        </div>
        <ListRowsSkeleton rows={8} />
      </CardSkeleton>
    </PageSkeleton>
  );
}
