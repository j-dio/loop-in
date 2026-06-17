import type { ReactNode } from "react";

type Props = {
  eyebrow: string;
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
};

/** Shared route header: mono amber eyebrow -> grotesque title -> meta + actions -> hairline rule. */
export function PageHeader({ eyebrow, title, meta, actions }: Props) {
  return (
    <div className="border-b border-border pb-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs tracking-[0.22em] text-brand uppercase">{eyebrow}</p>
          <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            {title}
          </h1>
          {meta ? (
            <p className="mt-2 font-mono text-xs tracking-wide text-muted-foreground">{meta}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
