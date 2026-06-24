import { Skeleton } from "@/components/ui/skeleton";

/** Shared mono eyebrow label class used across feed sections. */
export const sectionLabel =
  "font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase";

/** Tile skeleton — matches the de-boxed AppCard (rail + Home/Welcome grids). */
export function SkeletonAppCard({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={
        "flex flex-col gap-4 rounded-lg border border-border bg-card/40 p-5" +
        (compact ? " w-64 shrink-0" : "")
      }
    >
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border/70 pt-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-20 rounded-md" />
      </div>
    </div>
  );
}

/** Directory row skeleton — matches the editorial AppRow. */
export function SkeletonAppRow() {
  return (
    <div className="flex items-center gap-4 py-4 sm:gap-6">
      <Skeleton className="hidden h-4 w-8 sm:block" />
      <Skeleton className="size-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
      <Skeleton className="h-7 w-20 shrink-0 rounded-md" />
    </div>
  );
}

/** Bare feed-row skeleton — matches the editorial PostRow / PulseCard rows. */
export function SkeletonFeedRow() {
  return (
    <div className="flex gap-4 py-5">
      <Skeleton className="size-10 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}
