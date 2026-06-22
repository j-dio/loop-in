import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { PostCard } from "@/components/PostCard";
import type { PostDTO } from "@/lib/postTypes";

type Props = {
  slug: string;
  isOwner: boolean;
  upvotedIds: Set<string>;
  signedIn: boolean;
  canUpvote: boolean;
  onUpvoteChange: (postId: string, upvoteCount: number, upvoted: boolean) => void;
  refreshKey?: number;
};

export function PinnedStrip({
  slug,
  isOwner,
  upvotedIds,
  signedIn,
  canUpvote,
  onUpvoteChange,
  refreshKey = 0,
}: Props) {
  const [pinnedPosts, setPinnedPosts] = useState<PostDTO[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<{ posts: PostDTO[] }>(
          `/api/workspaces/${encodeURIComponent(slug)}/posts/pinned`
        );
        if (!cancelled) setPinnedPosts(data.posts);
      } catch {
        /* silently ignore — pinned strip is non-critical */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, refreshKey]);

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
              showFounderBadge={isOwner}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
