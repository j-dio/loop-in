import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowBigUp, ArrowLeft, Megaphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  boardLabel,
  boardTone,
  categoryLabel,
  categoryTone,
  moderationLabel,
  moderationTone,
} from "@/lib/postDisplay";
import { useWorkspace } from "@/context/WorkspaceContext";
import { ApiError, apiFetch } from "@/lib/api";
import type { CommentDTO } from "@/lib/commentTypes";
import type { PostDTO } from "@/lib/postTypes";
import type { PostUpdateDTO } from "@/lib/postUpdateTypes";

const POLL_MS = 30_000;

export function Thread() {
  const { slug, id: postId } = useParams();
  const { workspaces, setActiveWorkspace, activeWorkspace, user } = useWorkspace();

  const [post, setPost] = useState<PostDTO | null>(null);
  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [updates, setUpdates] = useState<PostUpdateDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [updateBody, setUpdateBody] = useState("");
  const [submittingUpdate, setSubmittingUpdate] = useState(false);
  const [updateSubmitError, setUpdateSubmitError] = useState<string | null>(null);
  const [upvoted, setUpvoted] = useState(false);
  const [upvoteCount, setUpvoteCount] = useState(0);
  const [upvoteBusy, setUpvoteBusy] = useState(false);
  const [viewerIsAdminOrOwner, setViewerIsAdminOrOwner] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    const match = workspaces.find((w) => w.slug === slug);
    if (match && match.id !== activeWorkspace?.id) {
      setActiveWorkspace(match);
    }
  }, [slug, workspaces, setActiveWorkspace, activeWorkspace?.id]);

  const isMember = Boolean(slug && user && workspaces.some((w) => w.slug === slug));

  useEffect(() => {
    if (!slug || !user || !isMember) {
      setViewerIsAdminOrOwner(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<{ role: string }>(
          `/api/workspaces/${encodeURIComponent(slug)}/my-role`
        );
        if (cancelled) return;
        setViewerIsAdminOrOwner(data.role === "admin" || data.role === "owner");
      } catch {
        if (!cancelled) setViewerIsAdminOrOwner(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, user, isMember]);

  const loadPost = useCallback(async () => {
    if (!slug || !postId) return;
    const data = await apiFetch<{ post: PostDTO }>(
      `/api/workspaces/${encodeURIComponent(slug)}/posts/${encodeURIComponent(postId)}`
    );
    setPost(data.post);
    setUpvoteCount(data.post.upvoteCount);
  }, [slug, postId]);

  const loadUpvoteState = useCallback(async () => {
    if (!slug || !postId) return;
    try {
      const data = await apiFetch<{ upvoted: boolean }>(
        `/api/workspaces/${encodeURIComponent(slug)}/posts/${encodeURIComponent(postId)}/upvote`
      );
      setUpvoted(data.upvoted);
    } catch {
      /* ignore — thread still usable */
    }
  }, [slug, postId]);

  const loadComments = useCallback(async () => {
    if (!slug || !postId) return;
    const data = await apiFetch<{ comments: CommentDTO[] }>(
      `/api/workspaces/${encodeURIComponent(slug)}/posts/${encodeURIComponent(postId)}/comments`
    );
    setComments(data.comments);
  }, [slug, postId]);

  const loadUpdates = useCallback(async () => {
    if (!slug || !postId) return;
    const data = await apiFetch<{ updates: PostUpdateDTO[] }>(
      `/api/workspaces/${encodeURIComponent(slug)}/posts/${encodeURIComponent(postId)}/updates`
    );
    setUpdates(data.updates);
  }, [slug, postId]);

  const refreshAll = useCallback(async () => {
    if (!slug || !postId) return;
    await Promise.all([loadPost(), loadComments(), loadUpvoteState(), loadUpdates()]);
  }, [slug, postId, loadPost, loadComments, loadUpvoteState, loadUpdates]);

  useEffect(() => {
    if (!slug || !postId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        await refreshAll();
        if (!cancelled) setLoading(false);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          setError("Sign in to view this workspace.");
        } else if (e instanceof ApiError && e.status === 403) {
          setError("You cannot view this post.");
        } else if (e instanceof ApiError && e.status === 404) {
          setError("Post not found.");
        } else {
          setError("Could not load thread.");
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, postId, refreshAll]);

  useEffect(() => {
    if (!slug || !postId || loading || error) return;
    const t = window.setInterval(() => {
      void refreshAll();
    }, POLL_MS);
    return () => window.clearInterval(t);
  }, [slug, postId, loading, error, refreshAll]);

  useEffect(() => {
    if (post) setUpvoteCount(post.upvoteCount);
  }, [post]);

  async function handleUpvoteClick() {
    if (!slug || !postId || !post || !user || !isMember || upvoteBusy) return;
    const approvedForUpvote = post.moderationStatus === "approved";
    if (!approvedForUpvote) return;

    const prevU = upvoted;
    const prevC = upvoteCount;
    setUpvoted(!prevU);
    setUpvoteCount(prevC + (prevU ? -1 : 1));
    setUpvoteBusy(true);

    const path = `/api/workspaces/${encodeURIComponent(slug)}/posts/${encodeURIComponent(postId)}/upvote`;
    try {
      const data = await apiFetch<{ upvoted: boolean; upvoteCount: number }>(path, {
        method: "POST",
      });
      setUpvoted(data.upvoted);
      setUpvoteCount(data.upvoteCount);
      setPost((p) => (p ? { ...p, upvoteCount: data.upvoteCount } : p));
    } catch {
      setUpvoted(prevU);
      setUpvoteCount(prevC);
    } finally {
      setUpvoteBusy(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!slug || !postId || deletingCommentId) return;
    setDeletingCommentId(commentId);
    try {
      await apiFetch(
        `/api/workspaces/${encodeURIComponent(slug)}/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
        { method: "DELETE" }
      );
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      /* keep comment; user can retry */
    } finally {
      setDeletingCommentId(null);
    }
  }

  async function handleSubmitUpdate(e: FormEvent) {
    e.preventDefault();
    if (!slug || !postId || !viewerIsAdminOrOwner || submittingUpdate) return;
    const trimmed = updateBody.trim();
    if (!trimmed) return;

    setSubmittingUpdate(true);
    setUpdateSubmitError(null);
    try {
      await apiFetch<{ update: PostUpdateDTO }>(
        `/api/workspaces/${encodeURIComponent(slug)}/posts/${encodeURIComponent(postId)}/updates`,
        { method: "POST", body: JSON.stringify({ content: trimmed }) }
      );
      setUpdateBody("");
      await loadUpdates();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUpdateSubmitError("Your session expired. Please sign in again.");
      } else {
        setUpdateSubmitError("Failed to post update. Please try again.");
      }
    } finally {
      setSubmittingUpdate(false);
    }
  }

  async function handleSubmitComment(e: FormEvent) {
    e.preventDefault();
    if (!slug || !postId || !isMember || submitting) return;
    const trimmed = commentBody.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiFetch<{ comment: CommentDTO }>(
        `/api/workspaces/${encodeURIComponent(slug)}/posts/${encodeURIComponent(postId)}/comments`,
        { method: "POST", body: JSON.stringify({ content: trimmed }) }
      );
      setCommentBody("");
      await loadComments();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setSubmitError("Your session expired. Please sign in again.");
      } else {
        setSubmitError("Failed to post comment. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!slug || !postId) {
    return <p className="text-muted-foreground text-sm">Missing workspace or post.</p>;
  }

  const upvoteDisabledReason = !post
    ? null
    : post.moderationStatus !== "approved"
      ? "Upvotes apply after the post is approved"
      : !user
        ? "Sign in to upvote"
        : !isMember
          ? "Only workspace members can upvote"
          : null;

  return (
    <div className="space-y-8">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link to={`/${encodeURIComponent(slug)}`}>
            <ArrowLeft className="size-4" />
            Back to board
          </Link>
        </Button>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading thread…</p>
      ) : post ? (
        <>
          <article className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <div className="flex gap-4">
              <button
                type="button"
                disabled={Boolean(upvoteDisabledReason) || upvoteBusy}
                title={upvoteDisabledReason ?? (upvoted ? "Remove upvote" : "Upvote")}
                onClick={() => void handleUpvoteClick()}
                aria-pressed={upvoted}
                className={cn(
                  "flex h-fit min-w-14 shrink-0 flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60",
                  upvoted
                    ? "border-brand/40 bg-brand-bright/15 text-brand"
                    : "border-border text-muted-foreground hover:border-brand/30 hover:text-brand"
                )}
              >
                <ArrowBigUp
                  className={cn("size-5", upvoted && "fill-current")}
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="tabular-nums">{upvoteCount}</span>
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{post.title}</h1>
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
                  <div className="mt-4 overflow-hidden rounded-xl border border-border bg-muted/30">
                    <img
                      src={post.imageUrl}
                      alt=""
                      className="max-h-[min(70vh,520px)] w-full object-contain"
                      loading="lazy"
                    />
                  </div>
                ) : null}
                {post.description ? (
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {post.description}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{post.author.name}</span>
                  <span aria-hidden>·</span>
                  <time dateTime={post.createdAt}>
                    {new Date(post.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </div>
              </div>
            </div>
          </article>

          {(updates.length > 0 || viewerIsAdminOrOwner) && (
            <section className="space-y-3" aria-labelledby="updates-heading">
              <h2 id="updates-heading" className="flex items-center gap-2 text-xl font-medium tracking-tight">
                <Megaphone className="size-5 shrink-0 text-brand" aria-hidden />
                Status updates
              </h2>
              {updates.length === 0 ? (
                <p className="text-muted-foreground text-sm">No updates yet.</p>
              ) : (
                <ul className="space-y-3">
                  {updates.map((u) => (
                    <li key={u.id}>
                      <article className="rounded-xl border border-brand/30 bg-brand-bright/8 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="brand">
                            <Megaphone className="size-3" />
                            Official update
                          </Badge>
                          <span className="text-sm font-medium">{u.author.name}</span>
                          <span className="text-xs text-muted-foreground">
                            <time dateTime={u.createdAt}>{new Date(u.createdAt).toLocaleString()}</time>
                          </span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm">{u.content}</p>
                      </article>
                    </li>
                  ))}
                </ul>
              )}
              {viewerIsAdminOrOwner && (
                <form onSubmit={(e) => void handleSubmitUpdate(e)} className="space-y-3 pt-1">
                  <label htmlFor="thread-update" className="text-sm font-medium">
                    Post an official update
                  </label>
                  <Textarea
                    id="thread-update"
                    value={updateBody}
                    onChange={(e) => { setUpdateBody(e.target.value); setUpdateSubmitError(null); }}
                    placeholder="Share a status update with your users…"
                    rows={3}
                    maxLength={10000}
                    disabled={submittingUpdate}
                  />
                  {updateSubmitError ? (
                    <p className="text-destructive text-sm" role="alert">
                      {updateSubmitError}
                    </p>
                  ) : null}
                  <Button type="submit" disabled={submittingUpdate || !updateBody.trim()}>
                    {submittingUpdate ? "Posting…" : "Post update"}
                  </Button>
                </form>
              )}
            </section>
          )}

          <section className="space-y-3" aria-labelledby="comments-heading">
            <h2 id="comments-heading" className="text-xl font-medium tracking-tight">
              Comments {comments.length > 0 ? <span className="text-muted-foreground">· {comments.length}</span> : null}
            </h2>
            {comments.length === 0 ? (
              <p className="text-muted-foreground text-sm">No comments yet.</p>
            ) : (
              <ul className="space-y-3">
                {comments.map((c) => {
                  const canDelete =
                    Boolean(user) &&
                    (c.author.id === user!.id || viewerIsAdminOrOwner);
                  const showFounderBadge =
                    c.isOfficialReply ||
                    (viewerIsAdminOrOwner && Boolean(user) && c.author.id === user!.id);
                  return (
                    <li key={c.id} className="group">
                      <article
                        className={`relative rounded-xl border border-border bg-card p-4 ${
                          showFounderBadge ? "border-l-4 border-l-brand pl-3" : ""
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2 pr-10">
                          {showFounderBadge ? <Badge tone="brand">Founder</Badge> : null}
                          <span className="text-sm font-medium">{c.author.name}</span>
                          <span className="text-xs text-muted-foreground">
                            <time dateTime={c.createdAt}>{new Date(c.createdAt).toLocaleString()}</time>
                          </span>
                        </div>
                        {canDelete ? (
                          <button
                            type="button"
                            className="absolute right-3 top-3 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-destructive group-hover:opacity-100"
                            title="Delete comment"
                            aria-label="Delete comment"
                            disabled={deletingCommentId === c.id}
                            onClick={() => void handleDeleteComment(c.id)}
                          >
                            <Trash2 className="size-3.5" strokeWidth={2} aria-hidden />
                          </button>
                        ) : null}
                        <p className="mt-2 whitespace-pre-wrap text-sm">{c.content}</p>
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="border-t pt-6" aria-label="Add a comment">
            {isMember ? (
              <form onSubmit={(e) => void handleSubmitComment(e)} className="space-y-3">
                <label htmlFor="thread-comment" className="text-sm font-medium">
                  Add a comment
                </label>
                <Textarea
                  id="thread-comment"
                  value={commentBody}
                  onChange={(e) => { setCommentBody(e.target.value); setSubmitError(null); }}
                  placeholder="Write a comment…"
                  rows={4}
                  maxLength={10000}
                  disabled={submitting}
                />
                {submitError ? (
                  <p className="text-destructive text-sm" role="alert">
                    {submitError}
                  </p>
                ) : null}
                <Button type="submit" disabled={submitting || !commentBody.trim()}>
                  {submitting ? "Posting…" : "Post comment"}
                </Button>
              </form>
            ) : user ? (
              <p className="text-muted-foreground text-sm">
                Only workspace members can comment. Join this workspace to participate.
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">
                <Button variant="link" className="h-auto p-0" asChild>
                  <Link to="/">Sign in</Link>
                </Button>{" "}
                and join the workspace to comment.
              </p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
