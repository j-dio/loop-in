import { useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-0.5 -right-0.5 flex min-w-[1.1rem] items-center justify-center rounded-full bg-brand-bright px-0.5 font-mono text-[10px] font-bold leading-4 text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function NotificationBell() {
  const { user } = useWorkspace();
  const { count } = useUnreadCount();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const ariaLabel = `Notifications${count > 0 ? ` (${count} unread)` : ""}`;
  const btnCls = cn(
    "relative flex items-center justify-center rounded-lg p-1.5",
    "text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
  );

  if (!isDesktop) {
    return (
      <Link to="/notifications" className={btnCls} aria-label={ariaLabel}>
        <Bell className="size-5" />
        <Badge count={count} />
      </Link>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={btnCls} aria-label={ariaLabel}>
          <Bell className="size-5" />
          <Badge count={count} />
        </button>
      </PopoverTrigger>
      {/* Anchor the pane to the screen's top-right edge (FB-style), independent of
          where the bell sits in the topbar cluster. top-14 = header height. */}
      <PopoverAnchor asChild>
        <span className="pointer-events-none fixed top-14 right-4 sm:right-6" aria-hidden />
      </PopoverAnchor>
      <PopoverContent className="p-0" align="end" sideOffset={8}>
        <NotificationPanel onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
