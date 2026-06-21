import { Link, useLocation, useParams } from "react-router-dom";
import {
  Inbox,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  PanelLeftClose,
  PanelLeft,
  Settings,
  User,
} from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type NavLink = { to: string; label: string; icon: React.ReactNode; active: boolean };

const ADMIN_PATH_RE = /^\/[^/]+\/admin(\/|$)/;

function useNavLinks(): NavLink[] {
  const { activeWorkspace, user } = useWorkspace();
  const location = useLocation();
  const params = useParams<{ slug?: string }>();
  const slug = activeWorkspace?.slug ?? params.slug;

  if (!slug) return [];

  const onAdmin = ADMIN_PATH_RE.test(location.pathname);

  if (onAdmin) {
    const currentSection = new URLSearchParams(location.search).get("section") ?? "triage";
    return [
      {
        to: `/${encodeURIComponent(slug)}/admin?section=triage`,
        label: "Triage",
        icon: <Inbox className="size-4" />,
        active: currentSection === "triage",
      },
      {
        to: `/${encodeURIComponent(slug)}/admin?section=kanban`,
        label: "Board",
        icon: <LayoutDashboard className="size-4" />,
        active: currentSection === "kanban",
      },
      {
        to: `/${encodeURIComponent(slug)}/admin?section=updates`,
        label: "Updates",
        icon: <Megaphone className="size-4" />,
        active: currentSection === "updates",
      },
      {
        to: `/${encodeURIComponent(slug)}/admin?section=settings`,
        label: "Settings",
        icon: <Settings className="size-4" />,
        active: currentSection === "settings",
      },
      {
        to: `/${encodeURIComponent(slug)}/admin?section=profile`,
        label: "Profile",
        icon: <User className="size-4" />,
        active: currentSection === "profile",
      },
    ];
  }

  const isOwner = Boolean(user && activeWorkspace && user.id === activeWorkspace.ownerId);
  const canAdmin = isOwner || activeWorkspace?.role === "admin" || activeWorkspace?.role === "owner";
  const links: NavLink[] = [
    {
      to: `/${encodeURIComponent(slug)}`,
      label: "Board",
      icon: <MessageSquare className="size-4" />,
      active: true,
    },
  ];
  if (canAdmin) {
    links.push({
      to: `/${encodeURIComponent(slug)}/admin`,
      label: "Command center",
      icon: <LayoutDashboard className="size-4" />,
      active: false,
    });
  }
  return links;
}

function NavBody({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const links = useNavLinks();
  return (
    <nav className="space-y-1" aria-label="Workspace pages">
      {links.map((l) => {
        const item = (
          <Link
            key={l.to}
            to={l.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
              collapsed && "justify-center px-0",
              l.active
                ? "bg-brand-bright/15 font-medium text-brand"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            )}
          >
            {l.icon}
            {!collapsed && <span>{l.label}</span>}
          </Link>
        );
        if (!collapsed) return item;
        return (
          <Tooltip key={l.to}>
            <TooltipTrigger asChild>{item}</TooltipTrigger>
            <TooltipContent side="right">{l.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

export function AppSidebar({
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      {/* Desktop rail */}
      <aside
        className={cn(
          "sticky top-14 hidden h-[calc(100dvh-3.5rem)] shrink-0 border-r border-border bg-sidebar p-3 transition-[width] md:block",
          collapsed ? "w-16" : "w-[15.5rem]"
        )}
      >
        <div className={cn("mb-3 flex", collapsed ? "justify-center" : "justify-end")}>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title="Toggle sidebar ([)"
          >
            {collapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>
        <NavBody collapsed={collapsed} />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={(o) => !o && onCloseMobile()}>
        <SheetContent>
          <NavBody collapsed={false} onNavigate={onCloseMobile} />
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
