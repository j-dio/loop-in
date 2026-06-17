/**
 * Preserve where a logged-out visitor was before they bounce through the OAuth flow, so we can send
 * them back there afterward instead of dumping everyone on the home page.
 *
 * Stored in localStorage (survives the full-page OAuth redirect, same origin on return).
 */
const KEY = "loopin-return-to";

/** Call right before navigating a visitor toward sign-in. Stores a path (must start with "/"). */
export function setReturnTo(path: string): void {
  try {
    if (path && path.startsWith("/") && !path.startsWith("//") && path !== "/") {
      localStorage.setItem(KEY, path);
    }
  } catch {
    /* ignore storage failures */
  }
}

/** Read-and-clear the stored return path. Returns "/" when none/invalid. */
export function consumeReturnTo(): string {
  try {
    const v = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    if (v && v.startsWith("/") && !v.startsWith("//")) return v;
  } catch {
    /* ignore */
  }
  return "/";
}
