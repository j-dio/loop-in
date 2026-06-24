import { Link } from "react-router-dom";
import { Megaphone, Radio } from "lucide-react";
import { WorkspaceTile } from "@/components/WorkspaceTile";
import { snippet } from "./text";
import type { ExploreUpdateItem, ExploreAnnouncementItem } from "@/lib/api";

export type PulseCardItem = ExploreUpdateItem | ExploreAnnouncementItem;

interface PulseCardProps {
  item: PulseCardItem;
}

/**
 * Editorial pulse row (Signal Stark) for the Following / Pulse feeds.
 * Builder news — no boxed card; an amber left rule signals an official update/announcement.
 * Parent supplies the dividing hairline (`divide-y divide-border`).
 *   - "update"       → "Update" eyebrow, parent post title, body snippet
 *   - "announcement" → "Announcement" eyebrow, post title, description snippet
 */
export function PulseCard({ item }: PulseCardProps) {
  const { workspace } = item;
  const isAnnouncement = item.type === "announcement";
  const to = isAnnouncement
    ? `/${encodeURIComponent(workspace.slug)}/post/${item.id}`
    : `/${encodeURIComponent(workspace.slug)}/post/${item.post.id}`;
  const title = isAnnouncement ? item.title : item.post.title;
  const body = isAnnouncement ? snippet(item.description) : snippet(item.content);
  const Icon = isAnnouncement ? Megaphone : Radio;
  const eyebrow = isAnnouncement ? "Announcement" : "Update";

  return (
    <Link to={to} className="group flex gap-4 border-l-2 border-brand/60 py-5 pl-4 transition-colors hover:border-brand sm:gap-5">
      <WorkspaceTile
        name={workspace.name}
        seed={workspace.slug}
        logoUrl={workspace.logoUrl}
        sizeClassName="size-10"
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.18em] text-brand uppercase">
          <Icon className="size-3.5" aria-hidden /> {eyebrow} · {workspace.name}
        </p>
        <p className="mt-1.5 font-display text-base font-semibold tracking-tight text-foreground transition-colors group-hover:text-brand">
          {title}
        </p>
        {body ? (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
        ) : null}
        {isAnnouncement && item.imageUrl ? (
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
        {isAnnouncement && item.upvoteCount > 0 ? (
          <p className="mt-2 font-mono text-[11px] text-muted-foreground tabular-nums">
            {item.upvoteCount} {item.upvoteCount === 1 ? "upvote" : "upvotes"}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
