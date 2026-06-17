export type PostDTO = {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  category: "bug" | "feature_request" | "ui_tweak";
  moderationStatus: "pending" | "approved" | "spam" | "rejected";
  boardStatus: "inbox" | "under_review" | "planned" | "in_progress" | "shipped";
  isAnonymous: boolean;
  upvoteCount: number;
  createdAt: string;
  author: { id?: string; name: string; avatarUrl: string | null };
  latestUpdate: { content: string; createdAt: string } | null;
};

export type PostSort = "trending" | "top" | "newest";
