import { useCallback, useEffect, useState } from "react";
import { fetchUnreadCount } from "@/lib/notificationsApi";
import { useWorkspace } from "@/context/WorkspaceContext";

const NOTIFICATIONS_EVENT = "notifications-changed";

export function dispatchNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_EVENT));
}

export function useUnreadCount() {
  const { user } = useWorkspace();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setCount(0);
      return;
    }
    try {
      const res = await fetchUnreadCount();
      setCount(res.count);
    } catch {
      /* silent */
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // setState is async (inside an awaited fetch) — not a sync cascade
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const interval = setInterval(() => void refresh(), 60_000);
    const onFocus = () => void refresh();
    const onChanged = () => void refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener(NOTIFICATIONS_EVENT, onChanged);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(NOTIFICATIONS_EVENT, onChanged);
    };
  }, [user, refresh]);

  return { count: user ? count : 0, refresh };
}
