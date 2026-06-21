import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationList } from "@/components/notifications/NotificationList";
import type { Notification } from "@/lib/notificationsApi";
import { fetchNotifications, markAllRead } from "@/lib/notificationsApi";
import { dispatchNotificationsChanged } from "@/hooks/useUnreadCount";
import { useWorkspace } from "@/context/WorkspaceContext";

const TABS = [
  ["all", "All"],
  ["unread", "Unread"],
] as const;

type Tab = "all" | "unread";

function groupByTime(
  items: Notification[]
): Array<{ label: string; items: Notification[] }> {
  const now = Date.now();
  const today: Notification[] = [];
  const week: Notification[] = [];
  const earlier: Notification[] = [];

  for (const n of items) {
    const hours = (now - new Date(n.createdAt).getTime()) / 3_600_000;
    if (hours < 24) today.push(n);
    else if (hours < 168) week.push(n);
    else earlier.push(n);
  }

  const groups: Array<{ label: string; items: Notification[] }> = [];
  if (today.length) groups.push({ label: "Today", items: today });
  if (week.length) groups.push({ label: "This week", items: week });
  if (earlier.length) groups.push({ label: "Earlier", items: earlier });
  return groups;
}

function SkeletonRows() {
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-1 py-2">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Notifications() {
  const { user } = useWorkspace();
  const [tab, setTab] = useState<Tab>("all");
  const [items, setItems] = useState<Notification[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const activeTab = useRef(tab);
  activeTab.current = tab;

  const loadPage = useCallback(async (filter: Tab, cur: string | null) => {
    const isFirst = cur == null;
    if (isFirst) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await fetchNotifications({
        limit: 20,
        cursor: cur ?? undefined,
        filter,
      });
      setItems((prev) => (isFirst ? res.items : [...prev, ...res.items]));
      setCursor(res.nextCursor);
      setHasMore(res.nextCursor != null);
    } catch {
      /* silent */
    } finally {
      if (isFirst) setLoading(false);
      else setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(tab, null);
  }, [tab, loadPage]);

  function handleMarkRead(id: string) {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
    );
  }

  async function handleMarkAll() {
    if (markingAll) return;
    setMarkingAll(true);
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    try {
      await markAllRead();
      dispatchNotificationsChanged();
    } catch {
      void loadPage(activeTab.current, null);
    } finally {
      setMarkingAll(false);
    }
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <p className="text-sm text-muted-foreground">
          <Link to="/" className="text-brand underline">Sign in</Link> to view notifications.
        </p>
      </div>
    );
  }

  const displayed = tab === "unread" ? items.filter((n) => !n.readAt) : items;
  const groups = groupByTime(displayed);
  const hasUnread = items.some((n) => !n.readAt);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        actions={
          hasUnread ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleMarkAll()}
              disabled={markingAll}
            >
              Mark all read
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 mt-5">
        <Segmented
          options={TABS}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          size="sm"
        />
      </div>

      {loading ? (
        <SkeletonRows />
      ) : displayed.length === 0 ? (
        <div className="rounded-xl border border-border py-16 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-secondary">
            <Bell className="size-6 text-muted-foreground" />
          </div>
          <p className="font-display text-sm font-semibold">
            {tab === "unread" ? "You're all caught up!" : "No notifications yet"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {tab === "unread"
              ? "Check back later for updates."
              : "Follow apps on Explore to get notified about releases and updates."}
          </p>
          {tab === "all" && (
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link to="/explore">Explore apps</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border">
          {groups.map((group, gi) => (
            <div key={group.label}>
              {groups.length > 1 && (
                <div
                  className={cn(
                    "px-4 py-2 font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground/60",
                    gi > 0 && "border-t border-border"
                  )}
                >
                  {group.label}
                </div>
              )}
              <NotificationList items={group.items} onMarkRead={handleMarkRead} />
            </div>
          ))}
          {hasMore && (
            <div className="border-t border-border p-3 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void loadPage(tab, cursor)}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
