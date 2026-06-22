/** A board may pin at most 3 posts. Toggling a post that's already pinned is always allowed. */
export const MAX_PINNED = 3;

export function canPin(currentPinnedCount: number, alreadyPinned: boolean): boolean {
  return alreadyPinned || currentPinnedCount < MAX_PINNED;
}
