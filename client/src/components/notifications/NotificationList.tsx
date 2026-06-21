import type { Notification } from "@/lib/notificationsApi";
import { NotificationItem } from "./NotificationItem";

type Props = {
  items: Notification[];
  onMarkRead: (id: string) => void;
  emptyMessage?: string;
};

export function NotificationList({
  items,
  onMarkRead,
  emptyMessage = "No notifications yet.",
}: Props) {
  if (items.length === 0) {
    return (
      <p className="px-3 py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
    );
  }

  return (
    <div className="space-y-0.5 p-1">
      {items.map((item) => (
        <NotificationItem key={item.id} item={item} onMarkRead={onMarkRead} />
      ))}
    </div>
  );
}
