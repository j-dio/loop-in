import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { listModerationEvents, type ModerationEventDTO } from "@/lib/api";
import type { PostDTO } from "@/lib/postTypes";
import { boardLabel, moderationLabel } from "@/lib/postDisplay";
import { UserAvatar } from "@/components/UserAvatar";

/** Human-readable sentence for one audit event (actor name is rendered separately). */
function describeEvent(e: ModerationEventDTO): string {
  switch (e.action) {
    case "moderation_status": {
      const from = e.fromValue ? moderationLabel(e.fromValue as PostDTO["moderationStatus"]) : "—";
      const to = e.toValue ? moderationLabel(e.toValue as PostDTO["moderationStatus"]) : "—";
      return `changed moderation from ${from} to ${to}`;
    }
    case "board_status": {
      const from = e.fromValue ? boardLabel(e.fromValue as PostDTO["boardStatus"]) : "—";
      const to = e.toValue ? boardLabel(e.toValue as PostDTO["boardStatus"]) : "—";
      return `moved this from ${from} to ${to}`;
    }
    case "pin":
      return "pinned this post";
    case "unpin":
      return "unpinned this post";
    case "delete":
      return "deleted this post";
    default:
      return "took an action";
  }
}

type Props = { slug: string; postId: string };

/**
 * Staff-only moderation audit trail for a post. Self-contained: fetches on mount (only ever
 * rendered for admins/owners, so the endpoint's auth is never hit by non-staff). Fails quietly —
 * the trail is supplementary, never a hard error on the thread.
 */
export function ModerationHistory({ slug, postId }: Props) {
  const [events, setEvents] = useState<ModerationEventDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEvents(null);
    setError(null);
    void (async () => {
      try {
        const ev = await listModerationEvents(slug, postId);
        if (!cancelled) setEvents(ev);
      } catch {
        if (cancelled) return;
        // 403 shouldn't happen (gated on staff), but never surface it as a scary error.
        setError("Could not load moderation history.");
        setEvents([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, postId]);

  return (
    <section className="space-y-3 border-t pt-6" aria-labelledby="modhistory-heading">
      <h2
        id="modhistory-heading"
        className="flex items-center gap-2 text-xl font-medium tracking-tight"
      >
        <History className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        Moderation history
      </h2>

      {events === null ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : error ? (
        <p className="text-muted-foreground text-sm">{error}</p>
      ) : events.length === 0 ? (
        <p className="text-muted-foreground text-sm">No moderation actions recorded yet.</p>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => (
            <li key={e.id} className="flex items-start gap-3">
              <UserAvatar
                name={e.actor?.name ?? null}
                avatarUrl={e.actor?.avatarUrl ?? null}
                seed={e.actor?.id}
                sizeClassName="size-7"
              />
              <p className="text-sm leading-snug">
                <span className="font-medium">{e.actor?.name ?? "Deleted user"}</span>{" "}
                <span className="text-muted-foreground">{describeEvent(e)}</span>
                <span className="text-muted-foreground">
                  {" · "}
                  <time dateTime={e.createdAt}>{new Date(e.createdAt).toLocaleString()}</time>
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
