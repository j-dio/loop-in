type FlagKind = "share" | "dismiss";

const STORAGE_PREFIX = "loopin-setup";

function flagKey(kind: FlagKind, slug: string): string {
  return `${STORAGE_PREFIX}-${kind}-${slug}`;
}

/** Read a UI flag. Safe in any environment — returns false if storage is unavailable. */
export function getFlag(kind: FlagKind, slug: string): boolean {
  try {
    return localStorage.getItem(flagKey(kind, slug)) === "1";
  } catch {
    return false;
  }
}

/** Persist a UI flag. Silent no-op if storage is unavailable. */
export function setFlag(kind: FlagKind, slug: string): void {
  try {
    localStorage.setItem(flagKey(kind, slug), "1");
  } catch {
    /* storage unavailable (private mode / disabled) — no-op */
  }
}
