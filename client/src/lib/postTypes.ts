export type PostDTO = {
  id: string;
  workspaceId: string;
  type: "feedback" | "announcement";
  title: string;
  description: string | null;
  imageUrl: string | null;
  category: "bug" | "feature_request" | "ui_tweak" | null;
  moderationStatus: "pending" | "approved" | "spam" | "rejected";
  boardStatus: "inbox" | "under_review" | "planned" | "in_progress" | "shipped";
  pinnedAt: string | null;
  isAnonymous: boolean;
  upvoteCount: number;
  createdAt: string;
  author: { id?: string; name: string; avatarUrl: string | null };
  // Server-computed: true when the requester authored this post, even for anonymous posts
  // where author.id is masked. Lets the author delete their own anonymous post.
  viewerIsAuthor?: boolean;
  latestUpdate: { content: string; createdAt: string } | null;
};

export type PostSort = "trending" | "top" | "newest";
