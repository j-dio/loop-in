import { Link } from "react-router-dom";
import { Megaphone } from "lucide-react";
import { WorkspaceTile } from "@/components/WorkspaceTile";
import { snippet } from "./text";

export interface PulseCardItem {
  id: string;
  content: string;
  createdAt: Date | string;
  post: { id: string; title: string };
  workspace: { name: string; slug: string; logoUrl: string | null };
}

interface PulseCardProps {
  item: PulseCardItem;
}

/**
 * Status-update card rendered in the Following feed.
 * Shows an amber "Update" mono tag, the parent post title, and a body snippet.
 */
export function PulseCard({ item }: PulseCardProps) {
  const { workspace, post, content } = item;
  return (
    <Link
      to={`/${encodeURIComponent(workspace.slug)}/post/${post.id}`}
      className="group flex gap-4 rounded-xl border border-brand/30 bg-brand-bright/5 p-4 transition-all hover:-translate-y-0.5 hover:border-brand/50 sm:p-5"
    >
      <WorkspaceTile
        name={workspace.name}
        seed={workspace.slug}
        logoUrl={workspace.logoUrl}
        sizeClassName="size-11"
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.18em] text-brand uppercase">
          <Megaphone className="size-3.5" /> Update · {workspace.name}
        </p>
        <p className="mt-1.5 text-base font-semibold tracking-tight text-foreground">
          {post.title}
        </p>
        {snippet(content) ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {snippet(content)}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
