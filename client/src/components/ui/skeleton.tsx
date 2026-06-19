import { cn } from "@/lib/utils";

/** Low-key loading placeholder. Composed into page-specific skeletons (e.g. Explore). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} aria-hidden />;
}
