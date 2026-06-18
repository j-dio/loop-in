export const SCREENSHOT_LIMIT = 5;

/** True when the workspace has room for another screenshot. */
export function canAddScreenshot(currentCount: number): boolean {
  return currentCount < SCREENSHOT_LIMIT;
}

/**
 * A reorder is valid only when the proposed id list is an exact permutation of the
 * current id set: same length, no duplicates, no foreign ids, no missing ids.
 */
export function reorderIdsMatch(currentIds: string[], proposedIds: string[]): boolean {
  if (currentIds.length !== proposedIds.length) return false;
  const proposedSet = new Set(proposedIds);
  if (proposedSet.size !== proposedIds.length) return false; // duplicates
  for (const id of currentIds) {
    if (!proposedSet.has(id)) return false;
  }
  return true;
}
