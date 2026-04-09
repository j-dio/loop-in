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
