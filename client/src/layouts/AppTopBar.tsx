import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { UserAvatar } from "@/components/UserAvatar";
import { ProfileDialog } from "@/components/ProfileDialog";
import { NotificationBell } from "@/components/NotificationBell";
import { useWorkspace } from "@/context/WorkspaceContext";
import { setReturnTo } from "@/lib/returnTo";
import { cn } from "@/lib/utils";

export function AppTopBar({ onToggleMobileNav }: { onToggleMobileNav: () => void }) {
  const { user, workspaces, activeWorkspace } = useWorkspace();
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();
  const isAdmin = /^\/[^/]+\/admin(\/|$)/.test(location.pathname);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        {isAdmin && (
          <button
            type="button"
            onClick={onToggleMobileNav}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary/60 hover:text-foreground md:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>
        )}
        <Link to="/" className="shrink-0" aria-label="Loop In home">
          <Logo />
        </Link>
        {workspaces.length > 0 && activeWorkspace ? (
          <>
            <span className="hidden text-border sm:inline" aria-hidden>/</span>
            <div className="hidden sm:block">
              <WorkspaceSwitcher />
            </div>
          </>
        ) : null}

        <nav className="ml-2 hidden items-center gap-1 sm:flex">
          {([["/home", "Home"], ["/explore", "Explore"]] as const).map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={() => {}}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">New app</span>
          </Button>
          <NotificationBell />
          <ThemeToggle />
          {user ? (
            <>
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                className="flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2 text-left transition-colors hover:bg-secondary/60"
                aria-label="Edit your profile"
              >
                <UserAvatar
                  name={user.name}
                  avatarUrl={user.avatarUrl}
                  seed={user.id}
                  sizeClassName="size-8"
                />
                <span className="hidden max-w-[140px] truncate font-mono text-xs tracking-wide text-muted-foreground sm:block">
                  {user.name ?? user.email}
                </span>
              </button>
              <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
            </>
          ) : (
            <Button type="button" variant="brand" size="sm" asChild>
              <Link
                to="/"
                onClick={() => setReturnTo(window.location.pathname + window.location.search)}
              >
                Sign in
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
