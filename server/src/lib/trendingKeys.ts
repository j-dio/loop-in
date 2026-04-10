/** Redis sorted-set key for precomputed trending ranks per workspace. */
export function trendingRedisKey(workspaceId: string): string {
  return `trending:${workspaceId}`;
}
