/**
 * Slugs that must never be a workspace slug — they collide with static routes (a workspace at
 * /:slug is shadowed by any static route of the same name) or with infra/reserved words.
 * Creation-only guard; existing-workspace reads/PATCH are unaffected.
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
