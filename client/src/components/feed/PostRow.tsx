import { Link } from "react-router-dom";
import { WorkspaceTile } from "@/components/WorkspaceTile";
import type { ExplorePostItem } from "@/lib/api";

function snippet(text: string | null, max = 160) {
  if (!text) return null;
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

interface PostRowProps {
  item: ExplorePostItem;
}

/**
 * A single following-feed post row — workspace tile + title + description snippet.
 * Used by both Home (following mode) and Explore (Following tab) to keep markup DRY.
 */
export function PostRow({ item }: PostRowProps) {
  return (
    <Link
      to={`/${encodeURIComponent(item.workspace.slug)}/post/${item.id}`}
      className="group flex gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-brand/40 sm:p-5"
    >
      <WorkspaceTile
        name={item.workspace.name}
        seed={item.workspace.slug}
        logoUrl={item.workspace.logoUrl}
        sizeClassName="size-11"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-display truncate text-sm font-semibold tracking-tight group-hover:text-brand">
            {item.workspace.name}
          </span>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">
            /{item.workspace.slug}
          </span>
        </div>
        <p className="mt-1.5 text-base font-semibold tracking-tight text-foreground">
          {item.title}
        </p>
        {snippet(item.description) ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {snippet(item.description)}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
