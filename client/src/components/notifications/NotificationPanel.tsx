import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationList } from "./NotificationList";
import type { Notification } from "@/lib/notificationsApi";
import { fetchNotifications, markAllRead } from "@/lib/notificationsApi";
import { dispatchNotificationsChanged } from "@/hooks/useUnreadCount";

const TABS = [
  ["all", "All"],
  ["unread", "Unread"],
] as const;

type Tab = "all" | "unread";

export function NotificationPanel({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState<Tab>("all");
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async (filter: Tab) => {
    setLoading(true);
    try {
      const res = await fetchNotifications({ limit: 10, filter });
      setItems(res.items);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

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
      void load(tab);
    } finally {
      setMarkingAll(false);
    }
  }

  const displayed = tab === "unread" ? items.filter((n) => !n.readAt) : items;
  const hasUnread = items.some((n) => !n.readAt);

  return (
    <div className="flex w-80 flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-display text-sm font-semibold tracking-wide">Notifications</h2>
        {hasUnread && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleMarkAll()}
            disabled={markingAll}
            className="h-7 px-2 text-xs"
          >
            Mark all read
          </Button>
        )}
      </div>

      <div className="border-b border-border px-4 py-2">
        <Segmented
          options={TABS}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          size="sm"
        />
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {loading ? (
          <div className="space-y-3 px-3 py-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <NotificationList
            items={displayed}
            onMarkRead={handleMarkRead}
            emptyMessage={tab === "unread" ? "You're all caught up!" : "No notifications yet."}
          />
        )}
      </div>

      <div className="border-t border-border px-4 py-2.5">
        <Link
          to="/notifications"
          onClick={onClose}
          className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          See all
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
