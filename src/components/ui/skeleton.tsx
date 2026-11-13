import { cn } from "cn"

/**
 * Loading placeholder with the Eleos brand shimmer. `brand` renders it on the navy brand
 * surface, for placeholders of navy cards such as the balance card.
 */
function Skeleton({ className, brand = false, ...props }: React.ComponentProps<"div"> & { brand?: boolean }) {
  return (
    <div
      data-slot="skeleton"
      className={cn("rounded-md", brand ? "skeleton-shimmer-brand shadow-glow-surface" : "skeleton-shimmer", className)}
      {...props}
    />
  )
}

export { Skeleton }
