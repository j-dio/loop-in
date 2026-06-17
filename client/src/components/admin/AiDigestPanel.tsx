// client/src/components/admin/AiDigestPanel.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";

export type DigestItem = {
  priority_rank: number;
  title: string;
  rationale: string;
  implementation_notes: string;
  complexity: "S" | "M" | "L";
};
export type DigestData = { items: DigestItem[]; pattern_summary: string };

function ComplexityBadge({ c }: { c: "S" | "M" | "L" }) {
  const styles: Record<"S" | "M" | "L", string> = {
    S: "border-border text-muted-foreground",
    M: "border-brand/30 bg-brand-bright/15 text-brand",
    L: "border-destructive/30 bg-destructive/10 text-destructive",
  };
  return (
    <span className={`rounded-full border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide ${styles[c]}`}>{c}</span>
  );
}

export function AiDigestPanel({
  digest,
  loading,
  error,
  disabled,
  onGenerate,
}: {
  digest: DigestData | null;
  loading: boolean;
  error: string | null;
  disabled: boolean;
  onGenerate: () => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 p-4">
        <p className="font-mono text-xs tracking-[0.18em] text-brand uppercase">AI Digest</p>
        <Button type="button" size="sm" variant="outline" disabled={disabled || loading} onClick={onGenerate}>
          {loading ? "Generating…" : "Generate AI Digest"}
        </Button>
      </div>
      {error ? <p className="px-4 pb-4 text-sm text-destructive" role="alert">{error}</p> : null}
      {digest ? (
        <div className="border-t border-border">
          <div className="flex items-start justify-between gap-4 p-4">
            <p className="text-sm leading-relaxed">{digest.pattern_summary}</p>
            {digest.items.length > 0 ? (
              <Button type="button" variant="ghost" size="sm" className="shrink-0 text-xs" onClick={() => setOpen((v) => !v)}>
                {open ? "Collapse" : `Show ${digest.items.length}`}
              </Button>
            ) : null}
          </div>
          {open && digest.items.length > 0 ? (
            <ol className="divide-y divide-border border-t border-border">
              {digest.items.map((item, i) => (
                <li key={i} className="space-y-1.5 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">#{item.priority_rank}</span>
                    <span className="text-sm font-medium">{item.title}</span>
                    <ComplexityBadge c={item.complexity} />
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{item.rationale}</p>
                  <p className="text-xs italic leading-relaxed text-foreground/70">{item.implementation_notes}</p>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
