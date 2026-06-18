import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowBigUp, Megaphone } from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
  boardLabel,
  boardTone,
  categoryLabel,
  categoryTone,
  moderationLabel,
  moderationTone,
} from "@/lib/postDisplay";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/UserAvatar";
import type { PostDTO } from "@/lib/postTypes";

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
  showFounderBadge?: boolean;
};

export function PostCard({
  post,
  workspaceSlug,
  pendingHighlight,
  upvoted,
  signedIn,
  canUpvote,
  onUpvoteChange,
  showFounderBadge,
}: Props) {
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
      className={cn(
        "group flex gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-brand/40 sm:gap-4 sm:p-5",
        pendingHighlight && "border-brand/40 ring-1 ring-brand/15"
      )}
    >
      {/* Author + upvote rail */}
      <div className="flex shrink-0 flex-col items-center gap-2">
        <UserAvatar
          name={post.author.name}
          avatarUrl={post.author.avatarUrl}
          seed={post.author.id}
          anonymous={!post.author.id}
          sizeClassName="size-9"
        />
        <button
          type="button"
          disabled={Boolean(upvoteDisabledReason) || upvoteBusy}
          title={upvoteDisabledReason ?? (localUpvoted ? "Remove upvote" : "Upvote")}
          onClick={handleUpvoteClick}
          aria-pressed={localUpvoted}
          className={cn(
            "flex min-w-12 flex-col items-center gap-0.5 rounded-xl border px-2 py-2 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60",
            localUpvoted
              ? "border-brand/40 bg-brand-bright/15 text-brand"
              : "border-border text-muted-foreground hover:border-brand/30 hover:text-brand"
          )}
        >
          <ArrowBigUp
            className={cn(
              "size-5 transition-transform",
              localUpvoted ? "fill-current" : "group-hover:-translate-y-0.5"
            )}
            strokeWidth={2}
            aria-hidden
          />
          <span className="tabular-nums">{localCount}</span>
        </button>
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Link
            to={`/${encodeURIComponent(workspaceSlug)}/post/${post.id}`}
            className="text-base font-semibold tracking-tight decoration-brand/40 underline-offset-4 hover:underline"
          >
            {post.title}
          </Link>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={categoryTone(post.category)}>{categoryLabel(post.category)}</Badge>
            {post.moderationStatus !== "approved" ? (
              <Badge tone={moderationTone(post.moderationStatus)}>
                {moderationLabel(post.moderationStatus)}
              </Badge>
            ) : null}
            <Badge tone={boardTone(post.boardStatus)}>{boardLabel(post.boardStatus)}</Badge>
          </div>
        </div>

        {post.imageUrl ? (
          <div className="mt-3 flex justify-center overflow-hidden rounded-xl border border-border bg-muted/30">
            <img
              src={post.imageUrl}
              alt={post.title}
              className="h-auto max-h-[30rem] w-full object-contain"
              loading="lazy"
              onError={(e) => {
                // Hide the container if the image fails to load (deleted object, expired host, etc.)
                const wrap = e.currentTarget.parentElement;
                if (wrap) wrap.style.display = "none";
              }}
            />
          </div>
        ) : null}

        {snippet(post.description) ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {snippet(post.description)}
          </p>
        ) : null}

        {post.latestUpdate ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-brand/20 bg-brand-bright/10 px-3 py-2">
            <Megaphone className="mt-0.5 size-3.5 shrink-0 text-brand" aria-hidden />
            <p className="text-xs leading-relaxed text-brand/90">
              {snippet(post.latestUpdate.content, 120)}
            </p>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {showFounderBadge ? <Badge tone="brand">Founder</Badge> : null}
          <span>{post.author.name}</span>
          <span aria-hidden>·</span>
          <time dateTime={post.createdAt}>
            {new Date(post.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </time>
        </div>
      </div>
    </article>
  );
}
