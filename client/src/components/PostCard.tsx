import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowBigUp, Megaphone, Pin } from "lucide-react";
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

function snippet(text: string | null, max = 200) {
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
  /** Owner-only pin/unpin affordance. */
  canManage?: boolean;
  onPinChange?: () => void;
};

/**
 * Editorial feed row (Signal Stark): hairline-separated rows, not boxed cards.
 * A slim borderless upvote control hangs at the left margin; the title carries the row.
 * The parent list supplies the dividing rule (`divide-y divide-border`).
 */
export function PostCard({
  post,
  workspaceSlug,
  pendingHighlight,
  upvoted,
  signedIn,
  canUpvote,
  onUpvoteChange,
  showFounderBadge,
  canManage,
  onPinChange,
}: Props) {
  const [localUpvoted, setLocalUpvoted] = useState(upvoted);
  const [localCount, setLocalCount] = useState(post.upvoteCount);
  const [upvoteBusy, setUpvoteBusy] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

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

  async function handlePinToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pinBusy) return;
    setPinBusy(true);
    setPinError(null);
    const path = `/api/workspaces/${encodeURIComponent(workspaceSlug)}/posts/${encodeURIComponent(post.id)}/pin`;
    try {
      await apiFetch<{ ok: true }>(path, {
        method: "PATCH",
        body: JSON.stringify({ pinned: !post.pinnedAt }),
      });
      onPinChange?.();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setPinError("You can pin at most 3 posts. Unpin one first.");
      }
    } finally {
      setPinBusy(false);
    }
  }

  return (
    <article
      className={cn(
        "group relative flex gap-4 py-5 transition-colors sm:gap-5",
        pendingHighlight && "pl-4"
      )}
    >
      {pendingHighlight ? (
        <span
          className="absolute inset-y-4 left-0 w-0.5 rounded-full bg-brand"
          aria-hidden
        />
      ) : null}

      {/* Upvote — slim, borderless, amber when active */}
      <button
        type="button"
        disabled={Boolean(upvoteDisabledReason) || upvoteBusy}
        title={upvoteDisabledReason ?? (localUpvoted ? "Remove upvote" : "Upvote")}
        onClick={handleUpvoteClick}
        aria-pressed={localUpvoted}
        className={cn(
          "flex h-fit min-w-10 shrink-0 flex-col items-center gap-0.5 pt-0.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          localUpvoted ? "text-brand" : "text-muted-foreground hover:text-brand"
        )}
      >
        <ArrowBigUp
          className={cn(
            "size-6 transition-transform",
            localUpvoted ? "fill-current" : "group-hover:-translate-y-0.5"
          )}
          strokeWidth={1.75}
          aria-hidden
        />
        <span className="tabular-nums">{localCount}</span>
      </button>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <Link
            to={`/${encodeURIComponent(workspaceSlug)}/post/${post.id}`}
            className="font-display text-lg font-semibold leading-snug tracking-tight transition-colors group-hover:text-brand"
          >
            {post.title}
          </Link>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {post.type === "announcement" ? (
              <Badge tone="brand">
                <Megaphone aria-hidden />
                Announcement
              </Badge>
            ) : null}
            {post.pinnedAt ? (
              <Badge tone="outline">
                <Pin aria-hidden />
                Pinned
              </Badge>
            ) : null}
            {post.category !== null ? (
              <Badge tone={categoryTone(post.category)}>{categoryLabel(post.category)}</Badge>
            ) : null}
            {post.moderationStatus !== "approved" ? (
              <Badge tone={moderationTone(post.moderationStatus)}>
                {moderationLabel(post.moderationStatus)}
              </Badge>
            ) : null}
            <Badge tone={boardTone(post.boardStatus)}>{boardLabel(post.boardStatus)}</Badge>
            {canManage ? (
              <button
                type="button"
                onClick={handlePinToggle}
                disabled={pinBusy}
                title={post.pinnedAt ? "Unpin post" : "Pin post"}
                aria-label={post.pinnedAt ? "Unpin post" : "Pin post"}
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  post.pinnedAt
                    ? "text-brand hover:bg-brand/10"
                    : "text-muted-foreground/60 hover:bg-muted hover:text-brand"
                )}
              >
                <Pin className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
        {pinError ? <p className="mt-1 text-xs text-destructive">{pinError}</p> : null}

        {snippet(post.description) ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {snippet(post.description)}
          </p>
        ) : null}

        {post.imageUrl ? (
          <div className="mt-3 flex overflow-hidden rounded-lg border border-border bg-muted/30">
            <img
              src={post.imageUrl}
              alt={post.title}
              className="h-auto max-h-[26rem] w-full object-contain"
              loading="lazy"
              onError={(e) => {
                const wrap = e.currentTarget.parentElement;
                if (wrap) wrap.style.display = "none";
              }}
            />
          </div>
        ) : null}

        {post.latestUpdate ? (
          <div className="mt-3 flex items-start gap-2 border-l-2 border-brand/50 pl-3 text-brand/90">
            <Megaphone className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <p className="text-xs leading-relaxed">{snippet(post.latestUpdate.content, 120)}</p>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <UserAvatar
            name={post.author.name}
            avatarUrl={post.author.avatarUrl}
            seed={post.author.id}
            anonymous={!post.author.id}
            sizeClassName="size-5"
          />
          <span className="font-medium text-foreground/70">{post.author.name}</span>
          {showFounderBadge ? <Badge tone="brand">Founder</Badge> : null}
          <span aria-hidden className="text-muted-foreground/40">
            ·
          </span>
          <time dateTime={post.createdAt} className="tabular-nums">
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
