import { useEffect, useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { addProfileLink, deleteProfileLink, getWorkspaceProfile } from "@/lib/api";
import { Section } from "@/components/admin/Section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LinkDTO, LinkKind } from "@/lib/profileTypes";

const KINDS: { value: LinkKind; label: string }[] = [
  { value: "github", label: "GitHub" },
  { value: "appstore", label: "App Store" },
  { value: "playstore", label: "Play Store" },
  { value: "x", label: "X" },
  { value: "other", label: "Other" },
];

export function LinksManager({ slug }: { slug: string }) {
  const [links, setLinks] = useState<LinkDTO[]>([]);
  const [kind, setKind] = useState<LinkKind>("github");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const p = await getWorkspaceProfile(slug);
      if (!cancelled) setLinks(p.links);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function add() {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { link } = await addProfileLink(slug, { kind, url: url.trim() });
      setLinks((prev) => [...prev, link]);
      setUrl("");
    } catch {
      setError("Couldn’t add the link. URL must start with http/https.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteProfileLink(slug, id);
      setLinks((prev) => prev.filter((l) => l.id !== id));
    } catch {
      setError("Couldn’t remove the link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Links">
      {links.length > 0 ? (
        <ul className="space-y-2">
          {links.map((l) => (
            <li key={l.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
              <span className="w-24 shrink-0 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                {l.kind}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{l.url}</span>
              <button
                type="button"
                onClick={() => void remove(l.id)}
                disabled={busy}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remove link"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No links yet.</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          value={kind}
          onChange={(e) => setKind(e.target.value as LinkKind)}
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <Input
          type="url"
          className="min-w-[14rem] flex-1"
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button type="button" variant="outline" size="sm" disabled={busy || !url.trim()} onClick={() => void add()}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </Section>
  );
}
