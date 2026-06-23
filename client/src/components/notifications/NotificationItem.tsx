import { Link } from "react-router-dom";
import { Calendar, CheckCircle2, Megaphone, MessageCircle, Rocket, UserPlus, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/UserAvatar";
import { WorkspaceTile } from "@/components/WorkspaceTile";
import type { Notification, NotificationType } from "@/lib/notificationsApi";
import {
  formatRelativeTime,
  markOneRead,
  notificationDeepLink,
  notificationText,
} from "@/lib/notificationsApi";
import { dispatchNotificationsChanged } from "@/hooks/useUnreadCount";

// Palette stays on the "Signal Stark" identity: amber (brand) accents + neutrals,
// no off-system semantic green/blue. Icon SHAPE carries the type; hue carries weight —
// brand-bright = celebratory (approved/shipped), brand = progress/announcement, muted = quiet.
function TypeIcon({ type }: { type: NotificationType }) {
  const cls = "size-3";
  switch (type) {
    case "post_approved":    return <CheckCircle2 className={cn(cls, "text-brand-bright")} strokeWidth={2} />;
    case "post_planned":     return <Calendar className={cn(cls, "text-brand")} strokeWidth={2} />;
    case "post_in_progress": return <Zap className={cn(cls, "text-brand")} strokeWidth={2} />;
    case "post_shipped":     return <Rocket className={cn(cls, "text-brand-bright")} strokeWidth={2} />;
    case "post_update":      return <Megaphone className={cn(cls, "text-brand")} strokeWidth={2} />;
    case "post_comment":     return <MessageCircle className={cn(cls, "text-muted-foreground")} strokeWidth={2} />;
    case "app_shipped":      return <Rocket className={cn(cls, "text-brand-bright")} strokeWidth={2} />;
    case "app_update":       return <Megaphone className={cn(cls, "text-brand")} strokeWidth={2} />;
    case "workspace_invite": return <UserPlus className={cn(cls, "text-brand")} strokeWidth={2} />;
    default:                 return null;
  }
}

function ItemAvatar({ item }: { item: Notification }) {
  const { type, data, actorId } = item;

  const badge = (
    <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full border border-popover bg-background">
      <TypeIcon type={type} />
    </span>
  );

  if ((type === "post_comment" || type === "post_update" || type === "workspace_invite") && data.actorName) {
    return (
      <span className="relative shrink-0">
        <UserAvatar name={data.actorName} seed={actorId ?? undefined} sizeClassName="size-9" />
        {badge}
      </span>
    );
  }

  if (type === "app_shipped" || type === "app_update") {
    return (
      <span className="relative shrink-0">
        <WorkspaceTile
          name={data.appName ?? "App"}
          seed={data.appSlug}
          sizeClassName="size-9"
          monogramClassName="text-sm"
        />
        {badge}
      </span>
    );
  }

  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
      <TypeIcon type={type} />
    </span>
  );
}

export type NotificationItemProps = {
  item: Notification;
  onMarkRead: (id: string) => void;
};

export function NotificationItem({ item, onMarkRead }: NotificationItemProps) {
  // Read-state is owned by the parent list (single source of truth) so bulk
  // actions like "mark all read" stay in sync — no local copy to drift.
  const isUnread = !item.readAt;
  const href = notificationDeepLink(item);
  const text = notificationText(item);

  async function handleClick() {
    if (!isUnread) return;
    onMarkRead(item.id); // optimistic flip in the parent
    try {
      await markOneRead(item.id);
      dispatchNotificationsChanged();
    } catch {
      /* best-effort; a later poll/refetch reconciles */
    }
  }

  return (
    <Link
      to={href}
      onClick={() => void handleClick()}
      className={cn(
        "flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-secondary/60",
        isUnread && "bg-brand-bright/5"
      )}
    >
      <ItemAvatar item={item} />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm leading-snug",
            isUnread ? "font-medium text-foreground" : "text-muted-foreground"
          )}
        >
          {text}
        </p>
        {item.data.commentPreview && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {item.data.commentPreview}
          </p>
        )}
        <p className="mt-0.5 font-mono text-xs text-muted-foreground/70">
          {formatRelativeTime(item.createdAt)}
        </p>
      </div>
      {isUnread && (
        <span className="mt-2 size-2 shrink-0 rounded-full bg-brand-bright" aria-label="Unread" />
      )}
    </Link>
  );
}
