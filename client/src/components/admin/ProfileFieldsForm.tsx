import { useEffect, useState, type FormEvent } from "react";
import { getWorkspaceProfile, updateWorkspace } from "@/lib/api";
import { Section } from "@/components/admin/Section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AppPlatform } from "@/lib/profileTypes";

type Draft = {
  tagline: string;
  description: string;
  platform: "" | AppPlatform;
  category: string;
  website_url: string;
};

const PLATFORMS: AppPlatform[] = ["web", "mobile", "desktop", "other"];

export function ProfileFieldsForm({ slug, canEdit }: { slug: string; canEdit: boolean }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const p = await getWorkspaceProfile(slug);
      if (cancelled) return;
      setDraft({
        tagline: p.workspace.tagline ?? "",
        description: p.workspace.description ?? "",
        platform: p.workspace.platform ?? "",
        category: p.workspace.category ?? "",
        website_url: p.workspace.websiteUrl ?? "",
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    setFeedback(null);
    try {
      await updateWorkspace(slug, {
        tagline: draft.tagline.trim() || null,
        description: draft.description.trim() || null,
        platform: draft.platform === "" ? null : draft.platform,
        category: draft.category.trim() || null,
        website_url: draft.website_url.trim() || null,
      });
      setFeedback({ kind: "ok", text: "Profile saved." });
    } catch {
      setFeedback({ kind: "err", text: "Could not save. Check the website URL is valid (http/https)." });
    } finally {
      setSaving(false);
    }
  }

  if (!draft) {
    return (
      <Section title="App profile">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Section>
    );
  }

  return (
    <Section title="App profile">
      {!canEdit ? (
        <p className="text-sm text-muted-foreground">Only the workspace owner can edit profile details.</p>
      ) : (
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="pf-tagline">
              Tagline <span className="opacity-60">(max 140)</span>
            </label>
            <Input
              id="pf-tagline"
              maxLength={140}
              value={draft.tagline}
              onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
              placeholder="One line that says what your app does"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="pf-desc">
              Description
            </label>
            <Textarea
              id="pf-desc"
              rows={5}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="What is this product? Who is it for?"
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="pf-platform">
                Platform
              </label>
              <select
                id="pf-platform"
                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={draft.platform}
                onChange={(e) => setDraft({ ...draft, platform: e.target.value as Draft["platform"] })}
              >
                <option value="">—</option>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[12rem] flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="pf-category">
                Category <span className="opacity-60">(max 50)</span>
              </label>
              <Input
                id="pf-category"
                maxLength={50}
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                placeholder="e.g. Productivity, Dev tools"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="pf-website">
              Website URL
            </label>
            <Input
              id="pf-website"
              type="url"
              value={draft.website_url}
              onChange={(e) => setDraft({ ...draft, website_url: e.target.value })}
              placeholder="https://example.com"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="brand" disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </Button>
            {feedback ? (
              <span className={feedback.kind === "ok" ? "text-xs text-brand" : "text-xs text-destructive"}>
                {feedback.text}
              </span>
            ) : null}
          </div>
        </form>
      )}
    </Section>
  );
}
