// Deterministic per-workspace identity color + monogram for cross-workspace UIs
// (e.g. the Explore feed). Same seed always yields the same hue — no schema
// change, no extra query. Seed on the workspace slug (unique + stable).

/** Stable hue (0–359) derived from a seed string via a small FNV-ish hash. */
export function workspaceHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

/**
 * Inline style for a workspace monogram tile. Mid-saturation solid fill with
 * white text reads clearly in both light and dark themes.
 */
export function workspaceTileStyle(seed: string): React.CSSProperties {
  const hue = workspaceHue(seed);
  return {
    backgroundColor: `hsl(${hue} 52% 42%)`,
    boxShadow: `inset 0 0 0 1px hsl(${hue} 52% 32%)`,
  };
}

/** First letter of the workspace name, uppercased. Falls back to "?". */
export function workspaceMonogram(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0]!.toUpperCase() : "?";
}
