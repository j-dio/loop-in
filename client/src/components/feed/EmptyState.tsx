import { type LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}

/** Centered empty/placeholder state — icon tile + title + subtext + optional action. */
export function EmptyState({ icon: Icon, title, children, action }: EmptyStateProps) {
  return (
    <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="font-display text-base font-semibold tracking-tight text-foreground">{title}</p>
      {children ? (
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{children}</p>
      ) : null}
      {action}
    </div>
  );
}
