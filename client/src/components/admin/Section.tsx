import type { ReactNode } from "react";

/** Stacked settings/members section: mono amber eyebrow + hairline divider. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border py-6 first:border-t-0 first:pt-0">
      <h2 className="mb-4 font-mono text-xs tracking-[0.18em] text-brand uppercase">{title}</h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}
