import { Link } from "react-router-dom";
import type { PostDTO } from "@/lib/postTypes";

function badgeClass(kind: "muted" | "accent" | "warn") {
  if (kind === "accent") return "bg-primary/10 text-primary border-primary/20";
  if (kind === "warn") return "bg-amber-500/10 text-amber-900 dark:text-amber-200 border-amber-500/25";
  return "bg-muted text-muted-foreground border-border";
}

function formatCategory(c: PostDTO["category"]) {
  if (c === "bug") return "Bug";
  if (c === "feature_request") return "Feature";
  return "UI";
}

function formatBoard(s: PostDTO["boardStatus"]) {
  return s.replace(/_/g, " ");
}

function formatModeration(s: PostDTO["moderationStatus"]) {
  return s.replace(/_/g, " ");
}

function snippet(text: string | null, max = 180) {
  if (!text) return null;
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

type Props = {
  post: PostDTO;
  workspaceSlug: string;
  pendingHighlight?: boolean;
};

export function PostCard({ post, workspaceSlug, pendingHighlight }: Props) {
  const mod = post.moderationStatus;
  const modKind =
    mod === "approved" ? "accent" : mod === "pending" ? "warn" : ("muted" as const);

  return (
    <article
      className={`rounded-lg border bg-card p-4 shadow-xs transition-colors ${
        pendingHighlight ? "border-amber-500/40 ring-1 ring-amber-500/20" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link
          to={`/${encodeURIComponent(workspaceSlug)}/post/${post.id}`}
          className="text-base font-semibold hover:underline"
        >
          {post.title}
        </Link>
        <div className="flex flex-wrap gap-1.5">
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass("muted")}`}>
            {formatCategory(post.category)}
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass(modKind)}`}>
            {formatModeration(mod)}
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass("muted")}`}>
            {formatBoard(post.boardStatus)}
          </span>
        </div>
      </div>
      {snippet(post.description) ? (
        <p className="mt-2 text-sm text-muted-foreground">{snippet(post.description)}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{post.author.name}</span>
        <span>·</span>
        <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString()}</time>
        <span>·</span>
        <span>{post.upvoteCount} upvotes</span>
      </div>
    </article>
  );
}
