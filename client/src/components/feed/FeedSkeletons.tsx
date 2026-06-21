import { Skeleton } from "@/components/ui/skeleton";

/** Shared mono eyebrow label class used across feed sections. */
export const sectionLabel =
  "font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase";

export function SkeletonAppCard({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={
        compact
          ? "flex w-60 shrink-0 snap-start flex-col gap-4 rounded-xl border border-border bg-card p-5"
          : "flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-5"
      }
    >
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-20 rounded-md" />
      </div>
    </div>
  );
}

export function SkeletonFeedRow() {
  return (
    <div className="flex gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      <Skeleton className="size-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-40" />
      </div>
    </div>
  );
}
