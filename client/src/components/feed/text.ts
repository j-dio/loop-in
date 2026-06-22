/**
 * Truncate `text` to `max` characters, appending an ellipsis if trimmed.
 * Returns null when the input is falsy so callers can render nothing safely.
 */
export function snippet(text: string | null, max = 160): string | null {
  if (!text) return null;
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}
