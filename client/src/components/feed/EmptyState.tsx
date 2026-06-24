import { type LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}

/**
 * Editorial empty state — a quiet, rule-framed band rather than a boxed card.
 * Left-aligned with the icon set in a hairline square; type carries it.
 */
export function EmptyState({ icon: Icon, title, children, action }: EmptyStateProps) {
  return (
    <div className="mt-4 flex items-start gap-4 border-y border-border py-10">
      <span className="flex size-10 shrink-0 items-center justify-center border border-border text-muted-foreground">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="font-display text-base font-semibold tracking-tight text-foreground">
          {title}
        </p>
        {children ? (
          <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">{children}</p>
        ) : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}
