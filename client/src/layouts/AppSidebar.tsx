import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Compass,
  Home,
  Inbox,
  LayoutDashboard,
  Megaphone,
  PanelLeftClose,
  PanelLeft,
  Settings,
  User,
} from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { WorkspaceTile } from "@/components/WorkspaceTile";
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
  const { activeWorkspace } = useWorkspace();
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

  return [];
}

function NavBody({ collapsed }: { collapsed: boolean }) {
  const links = useNavLinks();
  return (
    <nav className="space-y-1" aria-label="Workspace pages">
      {links.map((l) => {
        const item = (
          <Link
            key={l.to}
            to={l.to}
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

/** Mobile drawer: global nav + your apps everywhere, plus admin section nav on /admin. */
const drawerLink = "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors";
const drawerInactive = "text-muted-foreground hover:bg-secondary/60 hover:text-foreground";
const drawerActive = "bg-brand-bright/15 font-medium text-brand";
const drawerEyebrow = "px-2.5 pb-1 font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase";

const GLOBAL_LINKS = [
  { to: "/home", label: "Home", icon: <Home className="size-4" /> },
  { to: "/explore", label: "Explore", icon: <Compass className="size-4" /> },
] as const;

function MobileNavBody({ onNavigate }: { onNavigate: () => void }) {
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const adminLinks = useNavLinks();

  return (
    <div className="space-y-6">
      <nav className="space-y-1" aria-label="Browse">
        <p className={drawerEyebrow}>Browse</p>
        {GLOBAL_LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            onClick={onNavigate}
            className={cn(drawerLink, location.pathname === l.to ? drawerActive : drawerInactive)}
          >
            {l.icon}
            <span>{l.label}</span>
          </Link>
        ))}
      </nav>

      {workspaces.length > 0 && (
        <nav className="space-y-1" aria-label="Your apps">
          <p className={drawerEyebrow}>Your apps</p>
          {workspaces.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => {
                setActiveWorkspace(w);
                navigate(`/${encodeURIComponent(w.slug)}`);
                onNavigate();
              }}
              className={cn(
                drawerLink,
                "w-full text-left",
                w.id === activeWorkspace?.id ? drawerActive : drawerInactive
              )}
            >
              <WorkspaceTile
                name={w.name}
                seed={w.slug}
                logoUrl={w.logoUrl}
                sizeClassName="size-6"
                monogramClassName="text-[11px]"
                className="rounded-md"
              />
              <span className="min-w-0 truncate">{w.name}</span>
            </button>
          ))}
        </nav>
      )}

      {adminLinks.length > 0 && (
        <nav className="space-y-1" aria-label="Manage">
          <p className={drawerEyebrow}>Manage</p>
          {adminLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={onNavigate}
              className={cn(drawerLink, l.active ? drawerActive : drawerInactive)}
            >
              {l.icon}
              <span>{l.label}</span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

export function AppSidebar({
  isAdmin,
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile,
}: {
  isAdmin: boolean;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      {/* Desktop rail — admin only */}
      {isAdmin && (
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
      )}

      {/* Mobile drawer — every page */}
      <Sheet open={mobileOpen} onOpenChange={(o) => !o && onCloseMobile()}>
        <SheetContent>
          <MobileNavBody onNavigate={onCloseMobile} />
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
