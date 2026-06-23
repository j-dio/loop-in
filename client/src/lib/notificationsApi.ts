import { apiFetch } from "./api";

export type NotificationData = {
  postTitle?: string;
  appName?: string;
  appSlug?: string;
  actorName?: string;
  commentPreview?: string;
  boardStatus?: string;
  role?: "admin" | "member";
};

export type NotificationType =
  | "post_approved"
  | "post_planned"
  | "post_in_progress"
  | "post_shipped"
  | "post_update"
  | "post_comment"
  | "app_shipped"
  | "app_update"
  | "workspace_invite";

export type Notification = {
  id: string;
  type: NotificationType;
  workspaceId: string;
  postId: string | null;
  actorId: string | null;
  data: NotificationData;
  readAt: string | null;
  createdAt: string;
};

export type NotificationsListResult = {
  items: Notification[];
  nextCursor: string | null;
};

export async function fetchNotifications(params: {
  limit?: number;
  cursor?: string;
  filter?: "all" | "unread";
}): Promise<NotificationsListResult> {
  const q = new URLSearchParams();
  if (params.limit) q.set("limit", String(params.limit));
  if (params.cursor) q.set("cursor", params.cursor);
  if (params.filter) q.set("filter", params.filter);
  return apiFetch(`/api/notifications?${q.toString()}`);
}

export async function fetchUnreadCount(): Promise<{ count: number }> {
  return apiFetch("/api/notifications/unread-count");
}

export async function markOneRead(id: string): Promise<{ ok: true }> {
  return apiFetch(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "POST" });
}

export async function markAllRead(): Promise<{ ok: true }> {
  return apiFetch("/api/notifications/read-all", { method: "POST" });
}

export function notificationDeepLink(
  n: Pick<Notification, "type" | "postId" | "data">
): string {
  const slug = n.data.appSlug ?? "";
  if (n.postId && slug) return `/${slug}/post/${n.postId}`;
  // Admins land on the admin console; members land on the public board.
  if (n.type === "workspace_invite" && slug) {
    return n.data.role === "admin" ? `/${slug}/admin` : `/${slug}`;
  }
  return slug ? `/${slug}` : "/";
}

export function notificationText(n: Pick<Notification, "type" | "data">): string {
  const { data, type } = n;
  const title = data.postTitle ? `"${data.postTitle}"` : "your post";
  const app = data.appName ?? "An app";
  const actor = data.actorName ?? "Someone";
  switch (type) {
    case "post_approved":    return `Your post ${title} was approved`;
    case "post_planned":     return `Your post ${title} is now planned`;
    case "post_in_progress": return `Your post ${title} is in progress`;
    case "post_shipped":     return `Your post ${title} shipped!`;
    case "post_update":      return `${actor} posted an update on ${title}`;
    case "post_comment":     return `${actor} commented on ${title}`;
    case "app_shipped":      return `${app} shipped: ${title}`;
    case "app_update":       return `${app} posted an update on ${title}`;
    case "workspace_invite": {
      const seat = data.role === "member" ? "a member" : "an admin";
      return `${actor} added you as ${seat} of ${app}`;
    }
    default:                 return "New notification";
  }
}

export function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}
