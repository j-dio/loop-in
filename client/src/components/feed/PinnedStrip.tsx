import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { PostCard } from "@/components/PostCard";
import type { PostDTO } from "@/lib/postTypes";

type Props = {
  slug: string;
  canManage: boolean;
  upvotedIds: Set<string>;
  signedIn: boolean;
  canUpvote: boolean;
  onUpvoteChange: (postId: string, upvoteCount: number, upvoted: boolean) => void;
  refreshKey?: number;
  onPinChange?: () => void;
  /** Reports how many posts are pinned after each fetch, so the parent can hide its header. */
  onLoaded?: (count: number) => void;
};

export function PinnedStrip({
  slug,
  canManage,
  upvotedIds,
  signedIn,
  canUpvote,
  onUpvoteChange,
  refreshKey = 0,
  onPinChange,
  onLoaded,
}: Props) {
  const [pinnedPosts, setPinnedPosts] = useState<PostDTO[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<{ posts: PostDTO[] }>(
          `/api/workspaces/${encodeURIComponent(slug)}/posts/pinned`
        );
        if (!cancelled) {
          setPinnedPosts(data.posts);
          onLoaded?.(data.posts.length);
        }
      } catch {
        /* silently ignore — pinned strip is non-critical */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, refreshKey, onLoaded]);

  if (pinnedPosts.length === 0) return null;

  return (
    <section aria-label="Pinned posts" className="mx-auto w-full max-w-3xl">
      <ul className="space-y-3">
        {pinnedPosts.map((post) => (
          <li key={post.id}>
            <PostCard
              post={post}
              workspaceSlug={slug}
              upvoted={upvotedIds.has(post.id)}
              signedIn={signedIn}
              canUpvote={canUpvote}
              onUpvoteChange={onUpvoteChange}
              showFounderBadge={canManage}
              canManage={canManage}
              onPinChange={onPinChange}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
