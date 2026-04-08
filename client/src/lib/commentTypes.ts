export type CommentDTO = {
  id: string;
  postId: string;
  workspaceId: string;
  content: string;
  isOfficialReply: boolean;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null };
};
