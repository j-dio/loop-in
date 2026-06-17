export type PostUpdateDTO = {
  id: string;
  postId: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null };
};
