import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, MessageSquare, PanelLeftClose, PanelLeft } from "lucide-react";
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

function useNavLinks(): NavLink[] {
  const { activeWorkspace, user } = useWorkspace();
  const location = useLocation();
  const slug = activeWorkspace?.slug;
  if (!slug) return [];
  const onAdmin = location.pathname.endsWith("/admin");
  const isOwner = Boolean(user && activeWorkspace && user.id === activeWorkspace.ownerId);
  const canAdmin = isOwner || activeWorkspace.role === "admin" || activeWorkspace.role === "owner";
  const links: NavLink[] = [
    {
      to: `/${encodeURIComponent(slug)}`,
      label: "Board",
      icon: <MessageSquare className="size-4" />,
      active: !onAdmin,
    },
  ];
  if (canAdmin) {
    links.push({
      to: `/${encodeURIComponent(slug)}/admin`,
      label: "Command center",
      icon: <LayoutDashboard className="size-4" />,
      active: onAdmin,
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
