/**
 * Keep in sync with server/src/modules/workspaces/reservedSlugs.ts (server is the authority).
 *
 * Slugs that must never be a workspace slug — they collide with static routes or reserved words.
 * Used for instant client-side form validation before hitting the API.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "home", "explore", "welcome", "notifications", "admin", "auth", "api", "invite",
  "settings", "post", "posts", "uploads", "me", "login", "logout", "signin", "signup",
  "oauth", "callback", "new", "create", "app", "apps", "board", "thread", "profile",
  "static", "assets", "public", "favicon", "robots", "sitemap", "null", "undefined",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.trim().toLowerCase());
}
