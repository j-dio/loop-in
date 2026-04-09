import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowBigUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/context/WorkspaceContext";
import { ApiError, apiFetch } from "@/lib/api";
import type { CommentDTO } from "@/lib/commentTypes";
import type { PostDTO } from "@/lib/postTypes";

const POLL_MS = 30_000;

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

export function Thread() {
  const { slug, id: postId } = useParams();
  const { workspaces, setActiveWorkspace, activeWorkspace, user } = useWorkspace();

  const [post, setPost] = useState<PostDTO | null>(null);
  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [upvoted, setUpvoted] = useState(false);
  const [upvoteCount, setUpvoteCount] = useState(0);
  const [upvoteBusy, setUpvoteBusy] = useState(false);

  useEffect(() => {
    if (!slug) return;
    const match = workspaces.find((w) => w.slug === slug);
    if (match && match.id !== activeWorkspace?.id) {
      setActiveWorkspace(match);
    }
  }, [slug, workspaces, setActiveWorkspace, activeWorkspace?.id]);

  const isMember = Boolean(slug && user && workspaces.some((w) => w.slug === slug));

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

  const refreshAll = useCallback(async () => {
    if (!slug || !postId) return;
    await Promise.all([loadPost(), loadComments(), loadUpvoteState()]);
  }, [slug, postId, loadPost, loadComments, loadUpvoteState]);

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
    if (!post) return;
    setUpvoteCount(post.upvoteCount);
  }, [post?.id, post?.upvoteCount]);

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

  async function handleSubmitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!slug || !postId || !isMember || submitting) return;
    const trimmed = commentBody.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      await apiFetch<{ comment: CommentDTO }>(
        `/api/workspaces/${encodeURIComponent(slug)}/posts/${encodeURIComponent(postId)}/comments`,
        { method: "POST", body: JSON.stringify({ content: trimmed }) }
      );
      setCommentBody("");
      await loadComments();
    } catch {
      /* keep draft; polling may still refresh */
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
        <Button variant="ghost" size="sm" className="mb-2 -ml-2 h-8 px-2" asChild>
          <Link to={`/${encodeURIComponent(slug)}`}>← Back to board</Link>
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
          <article className="rounded-lg border bg-card p-5 shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h1 className="text-xl font-semibold">{post.title}</h1>
              <div className="flex flex-wrap gap-1.5">
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass("muted")}`}>
                  {formatCategory(post.category)}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                    post.moderationStatus === "approved"
                      ? badgeClass("accent")
                      : post.moderationStatus === "pending"
                        ? badgeClass("warn")
                        : badgeClass("muted")
                  }`}
                >
                  {formatModeration(post.moderationStatus)}
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass("muted")}`}>
                  {formatBoard(post.boardStatus)}
                </span>
              </div>
            </div>
            {post.description ? (
              <p className="mt-4 whitespace-pre-wrap text-sm text-foreground">{post.description}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={Boolean(upvoteDisabledReason) || upvoteBusy}
                title={upvoteDisabledReason ?? (upvoted ? "Remove upvote" : "Upvote")}
                className={`h-8 gap-1 px-2 font-normal ${
                  upvoted
                    ? "text-primary bg-primary/10 hover:bg-primary/15"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => void handleUpvoteClick()}
                aria-pressed={upvoted}
              >
                <ArrowBigUp
                  className={`size-4 shrink-0 ${upvoted ? "fill-current" : ""}`}
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="tabular-nums">{upvoteCount}</span>
              </Button>
              <span aria-hidden>·</span>
              <span>{post.author.name}</span>
              <span>·</span>
              <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString()}</time>
            </div>
          </article>

          <section className="space-y-3" aria-labelledby="comments-heading">
            <h2 id="comments-heading" className="text-lg font-semibold">
              Comments
            </h2>
            {comments.length === 0 ? (
              <p className="text-muted-foreground text-sm">No comments yet.</p>
            ) : (
              <ul className="space-y-3">
                {comments.map((c) => (
                  <li key={c.id}>
                    <article
                      className={`rounded-lg border bg-card p-4 shadow-xs ${
                        c.isOfficialReply
                          ? "border-l-4 border-l-primary pl-3"
                          : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {c.isOfficialReply ? (
                          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            Founder
                          </span>
                        ) : null}
                        <span className="text-sm font-medium">{c.author.name}</span>
                        <span className="text-xs text-muted-foreground">
                          <time dateTime={c.createdAt}>{new Date(c.createdAt).toLocaleString()}</time>
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm">{c.content}</p>
                    </article>
                  </li>
                ))}
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
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Write a comment…"
                  rows={4}
                  maxLength={10000}
                  disabled={submitting}
                />
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
