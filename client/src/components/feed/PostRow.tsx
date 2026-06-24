import { Link } from "react-router-dom";
import { WorkspaceTile } from "@/components/WorkspaceTile";
import type { ExplorePostItem } from "@/lib/api";
import { snippet } from "./text";

interface PostRowProps {
  item: ExplorePostItem;
}

/**
 * Editorial following-feed row — workspace identity, post title, snippet. No boxed card;
 * parent supplies the dividing hairline (`divide-y divide-border`). Shared by Home
 * (following mode) and Explore (Following tab).
 */
export function PostRow({ item }: PostRowProps) {
  return (
    <Link
      to={`/${encodeURIComponent(item.workspace.slug)}/post/${item.id}`}
      className="group flex gap-4 py-5 transition-colors sm:gap-5"
    >
      <WorkspaceTile
        name={item.workspace.name}
        seed={item.workspace.slug}
        logoUrl={item.workspace.logoUrl}
        sizeClassName="size-10"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 font-mono text-[11px] tracking-wide text-muted-foreground">
          <span className="truncate text-foreground/70">{item.workspace.name}</span>
          <span className="shrink-0 text-muted-foreground/60">/{item.workspace.slug}</span>
        </div>
        <p className="mt-1.5 font-display text-base font-semibold tracking-tight text-foreground transition-colors group-hover:text-brand">
          {item.title}
        </p>
        {snippet(item.description) ? (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {snippet(item.description)}
          </p>
        ) : null}
        {item.imageUrl ? (
          <div className="mt-3 flex overflow-hidden rounded-lg border border-border bg-muted/30">
            <img
              src={item.imageUrl}
              alt={item.title}
              loading="lazy"
              className="h-auto max-h-72 w-full object-contain"
              onError={(e) => {
                const wrap = e.currentTarget.parentElement;
                if (wrap) wrap.style.display = "none";
              }}
            />
          </div>
        ) : null}
      </div>
    </Link>
  );
}
