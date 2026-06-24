import type { AppPlatform, LinkDTO, LinkKind, ScreenshotDTO, WorkspaceProfileDTO } from "@/lib/profileTypes";

/**
 * API origin for fetch(). In dev, align `localhost` vs `127.0.0.1` with the page:
 * auth cookies are host-scoped, so `http://localhost:5173` + `http://127.0.0.1:3001`
 * would send no cookies and every protected POST would 401.
 */
export function getApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
  if (typeof window === "undefined") return fromEnv;
  try {
    const api = new URL(fromEnv);
    const pageHost = window.location.hostname;
    if (
      (api.hostname === "localhost" || api.hostname === "127.0.0.1") &&
      (pageHost === "localhost" || pageHost === "127.0.0.1") &&
      api.hostname !== pageHost
    ) {
      api.hostname = pageHost;
      return api.origin;
    }
  } catch {
    /* ignore invalid VITE_API_URL */
  }
  return fromEnv;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBase();
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  async function request(): Promise<Response> {
    return fetch(`${base}${path}`, {
      ...init,
      credentials: "include",
      headers,
    });
  }

  let res = await request();

  /**
   * Access JWT is short-lived; refresh_token is only sent to `/auth/*` (cookie path).
   * Expired access → POST /api/... returns 401 even though the session is still valid.
   * Rotate access (and refresh) once, then retry the original request.
   */
  const canTryRefresh =
    res.status === 401 &&
    path !== "/auth/refresh" &&
    path !== "/auth/logout" &&
    !path.startsWith("/auth/google");

  if (canTryRefresh) {
    const refreshRes = await fetch(`${base}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (refreshRes.ok) {
      res = await request();
    }
  }

  if (!res.ok) {
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      /* keep text */
    }
    throw new ApiError(res.status, body);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

/** Body for `PATCH /api/workspaces/:slug` (owner only). */
export type UpdateWorkspaceBody = {
  name?: string;
  primaryColor?: string;
  visibility?: "public" | "invite_only";
  require_approval?: boolean;
  tagline?: string | null;
  description?: string | null;
  platform?: AppPlatform | null;
  category?: string | null;
  website_url?: string | null;
};

export async function updateWorkspace(
  slug: string,
  body: UpdateWorkspaceBody
): Promise<{
  workspace: {
    id: string;
    ownerId: string;
    name: string;
    slug: string;
    primaryColor: string;
    visibility: "public" | "invite_only";
    requireApproval: boolean;
    createdAt: string;
  };
}> {
  return apiFetch(`/api/workspaces/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

const ws = (slug: string) => `/api/workspaces/${encodeURIComponent(slug)}`;

export async function getWorkspaceProfile(slug: string): Promise<WorkspaceProfileDTO> {
  return apiFetch(`${ws(slug)}/profile`);
}

type ScreenshotPresignResponse = {
  upload_url: string;
  image_url: string;
  upload_headers: Record<string, string>;
};

export async function presignScreenshot(
  slug: string,
  body: { filename: string; content_type: string }
): Promise<ScreenshotPresignResponse> {
  return apiFetch(`${ws(slug)}/screenshots/presign`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function addScreenshot(slug: string, url: string): Promise<{ screenshot: ScreenshotDTO }> {
  return apiFetch(`${ws(slug)}/screenshots`, { method: "POST", body: JSON.stringify({ url }) });
}

export async function deleteScreenshot(slug: string, id: string): Promise<{ ok: true }> {
  return apiFetch(`${ws(slug)}/screenshots/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function reorderScreenshots(slug: string, ids: string[]): Promise<{ ok: true }> {
  return apiFetch(`${ws(slug)}/screenshots/reorder`, {
    method: "PATCH",
    body: JSON.stringify({ ids }),
  });
}

export async function addProfileLink(
  slug: string,
  body: { kind: LinkKind; url: string }
): Promise<{ link: LinkDTO }> {
  return apiFetch(`${ws(slug)}/links`, { method: "POST", body: JSON.stringify(body) });
}

export async function deleteProfileLink(slug: string, id: string): Promise<{ ok: true }> {
  return apiFetch(`${ws(slug)}/links/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export type ModerationActionKind =
  | "moderation_status"
  | "board_status"
  | "pin"
  | "unpin"
  | "delete";

export type ModerationEventDTO = {
  id: string;
  action: ModerationActionKind;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
  /** Null when the acting admin has since been deleted. */
  actor: { id: string; name: string; avatarUrl: string | null } | null;
};

/** Staff-only: the moderation audit trail for a single post (newest first). */
export async function listModerationEvents(
  slug: string,
  postId: string
): Promise<ModerationEventDTO[]> {
  const res = await apiFetch<{ events: ModerationEventDTO[] }>(
    `${ws(slug)}/posts/${encodeURIComponent(postId)}/moderation-events`
  );
  return res.events;
}

export type FollowResult = { following: boolean; followerCount: number };

export async function followWorkspace(slug: string): Promise<FollowResult> {
  return apiFetch(`${ws(slug)}/follow`, { method: "POST" });
}

export async function unfollowWorkspace(slug: string): Promise<FollowResult> {
  return apiFetch(`${ws(slug)}/follow`, { method: "DELETE" });
}

export async function deleteWorkspace(slug: string): Promise<{ ok: true }> {
  return apiFetch(ws(slug), { method: "DELETE" });
}

export type ExplorePostItem = {
  type: "post";
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  category: "bug" | "feature_request" | "ui_tweak";
  boardStatus: "inbox" | "under_review" | "planned" | "in_progress" | "shipped";
  upvoteCount: number;
  createdAt: string;
  author: { id?: string; name: string; avatarUrl: string | null };
  workspace: { name: string; slug: string; logoUrl: string | null };
};

export type ExploreUpdateItem = {
  type: "update";
  id: string;
  createdAt: string;
  content: string;
  post: { id: string; title: string };
  author: { id?: string; name: string; avatarUrl: string | null };
  workspace: { name: string; slug: string; logoUrl: string | null };
};

export type ExploreAnnouncementItem = {
  type: "announcement";
  id: string;
  createdAt: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  upvoteCount: number;
  author: { id?: string; name: string; avatarUrl: string | null };
  workspace: { name: string; slug: string; logoUrl: string | null };
};

export type FollowingFeedItem = ExplorePostItem | ExploreUpdateItem | ExploreAnnouncementItem;
