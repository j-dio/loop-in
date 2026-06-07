import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowBigUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api";
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
  /** From feed batch (`upvotedPostIds`); updated after successful toggles. */
  upvoted: boolean;
  signedIn: boolean;
  canUpvote: boolean;
  onUpvoteChange?: (postId: string, upvoteCount: number, upvoted: boolean) => void;
};

export function PostCard({
  post,
  workspaceSlug,
  pendingHighlight,
  upvoted,
  signedIn,
  canUpvote,
  onUpvoteChange,
}: Props) {
  const mod = post.moderationStatus;
  const modKind =
    mod === "approved" ? "accent" : mod === "pending" ? "warn" : ("muted" as const);

  const [localUpvoted, setLocalUpvoted] = useState(upvoted);
  const [localCount, setLocalCount] = useState(post.upvoteCount);
  const [upvoteBusy, setUpvoteBusy] = useState(false);

  useEffect(() => {
    setLocalUpvoted(upvoted);
  }, [upvoted, post.id]);

  useEffect(() => {
    setLocalCount(post.upvoteCount);
  }, [post.upvoteCount, post.id]);

  const approvedForUpvote = post.moderationStatus === "approved";
  const upvoteDisabledReason = !approvedForUpvote
    ? "Upvotes apply after the post is approved"
    : !signedIn
      ? "Sign in to upvote"
      : !canUpvote
        ? "Only workspace members can upvote"
        : null;

  async function handleUpvoteClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!approvedForUpvote || !signedIn || !canUpvote || upvoteBusy) return;

    const prevU = localUpvoted;
    const prevC = localCount;
    setLocalUpvoted(!prevU);
    setLocalCount(prevC + (prevU ? -1 : 1));
    setUpvoteBusy(true);

    const path = `/api/workspaces/${encodeURIComponent(workspaceSlug)}/posts/${encodeURIComponent(post.id)}/upvote`;
    try {
      const data = await apiFetch<{ upvoted: boolean; upvoteCount: number }>(path, {
        method: "POST",
      });
      setLocalUpvoted(data.upvoted);
      setLocalCount(data.upvoteCount);
      onUpvoteChange?.(post.id, data.upvoteCount, data.upvoted);
    } catch (err) {
      setLocalUpvoted(prevU);
      setLocalCount(prevC);
      if (err instanceof ApiError && err.status === 401) {
        /* session expired — apiFetch already tried refresh */
      }
    } finally {
      setUpvoteBusy(false);
    }
  }

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
      {post.imageUrl ? (
        <div className="mt-3 overflow-hidden rounded-md border bg-muted/30">
          <img
            src={post.imageUrl}
            alt=""
            className="max-h-40 w-full object-cover"
            loading="lazy"
          />
        </div>
      ) : null}
      {snippet(post.description) ? (
        <p className="mt-2 text-sm text-muted-foreground">{snippet(post.description)}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={Boolean(upvoteDisabledReason) || upvoteBusy}
            title={upvoteDisabledReason ?? (localUpvoted ? "Remove upvote" : "Upvote")}
            className={`h-8 gap-1 px-2 font-normal ${
              localUpvoted
                ? "text-primary bg-primary/10 hover:bg-primary/15"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={handleUpvoteClick}
            aria-pressed={localUpvoted}
          >
            <ArrowBigUp
              className={`size-4 shrink-0 ${localUpvoted ? "fill-current" : ""}`}
              strokeWidth={2}
              aria-hidden
            />
            <span className="tabular-nums">{localCount}</span>
          </Button>
        </div>
        <span aria-hidden>·</span>
        <span>{post.author.name}</span>
        <span>·</span>
        <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString()}</time>
      </div>
    </article>
  );
}
