// client/src/components/admin/TriageInbox.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { categoryLabel, categoryTone } from "@/lib/postDisplay";
import { cn } from "@/lib/utils";
import type { PostDTO } from "@/lib/postTypes";

type ModStatus = "approved" | "spam" | "rejected";
type Sort = "newest" | "oldest" | "top";

type Props = {
  posts: PostDTO[];
  slug: string;
  loading: boolean;
  moderatingId: string | null;
  onModerate: (postId: string, status: ModStatus) => void | Promise<void>;
  onBulkModerate: (ids: string[], status: ModStatus) => Promise<{ failed: string[] }>;
};

export function TriageInbox({ posts, slug, loading, moderatingId, onModerate, onBulkModerate }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [sort, setSort] = useState<Sort>("newest");

  const sorted = [...posts].sort((a, b) => {
    if (sort === "top") return b.upvoteCount - a.upvoteCount;
    const da = new Date(a.createdAt).getTime();
    const db = new Date(b.createdAt).getTime();
    return sort === "oldest" ? da - db : db - da;
  });

  const allSelected = sorted.length > 0 && sorted.every((p) => selected.has(p.id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(sorted.map((p) => p.id)));

  async function bulk(status: ModStatus) {
    const ids = [...selected];
    const { failed } = await onBulkModerate(ids, status);
    setSelected(new Set(failed)); // keep only the rows that failed selected
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading triage…</p>;
  if (posts.length === 0)
    return <p className="text-sm text-muted-foreground">No posts waiting for review. Inbox zero.</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            ref={(el) => { if (el) el.indeterminate = selected.size > 0 && !allSelected; }}
            checked={allSelected}
            onChange={toggleAll}
            className="size-4 rounded border-input"
          />
          <span className="font-mono text-xs tracking-wide uppercase">{posts.length} pending</span>
        </label>
        <Segmented
          size="sm"
          options={[["newest", "Newest"], ["oldest", "Oldest"], ["top", "Top"]] as const}
          value={sort}
          onChange={(v) => setSort(v as Sort)}
        />
      </div>

      {selected.size > 0 ? (
        <div className="sticky top-14 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-brand/30 bg-brand-bright/10 px-3 py-2">
          <span className="font-mono text-xs tracking-wide text-brand uppercase">{selected.size} selected</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="brand" onClick={() => void bulk("approved")}>Approve</Button>
            <Button size="sm" variant="secondary" onClick={() => void bulk("rejected")}>Reject</Button>
            <Button size="sm" variant="outline" onClick={() => void bulk("spam")}>Spam</Button>
          </div>
        </div>
      ) : null}

      <ul className="divide-y divide-border">
        {sorted.map((post) => (
          <li
            key={post.id}
            className={cn(
              "group flex items-start gap-3 py-3 transition-colors",
              moderatingId === post.id && "opacity-60"
            )}
          >
            <input
              type="checkbox"
              checked={selected.has(post.id)}
              onChange={() => toggle(post.id)}
              className="mt-1 size-4 rounded border-input"
              aria-label={`Select ${post.title}`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={categoryTone(post.category)}>{categoryLabel(post.category)}</Badge>
                <Link
                  to={`/${encodeURIComponent(slug)}/post/${encodeURIComponent(post.id)}`}
                  className="font-medium tracking-tight hover:text-brand hover:underline"
                >
                  {post.title}
                </Link>
              </div>
              {post.description ? (
                <p className="mt-1 line-clamp-2 max-w-2xl text-sm text-muted-foreground">{post.description}</p>
              ) : null}
              <p className="mt-1 font-mono text-[11px] tracking-wide text-muted-foreground">
                {post.author.name} · {new Date(post.createdAt).toLocaleString()} · {post.upvoteCount} upvotes
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              <Button size="sm" variant="brand" disabled={moderatingId === post.id} onClick={() => void onModerate(post.id, "approved")}>Approve</Button>
              <Button size="sm" variant="secondary" disabled={moderatingId === post.id} onClick={() => void onModerate(post.id, "rejected")}>Reject</Button>
              <Button size="sm" variant="outline" disabled={moderatingId === post.id} onClick={() => void onModerate(post.id, "spam")}>Spam</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
