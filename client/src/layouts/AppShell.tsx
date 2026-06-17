import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LayoutDashboard, LogOut, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo, LoopMark } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useWorkspace } from "@/context/WorkspaceContext";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export function AppShell() {
  const { activeWorkspace, user, workspaces, refreshSession } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();

  const isOwner = Boolean(user && activeWorkspace && user.id === activeWorkspace.ownerId);
  const onAdminPage = location.pathname.endsWith("/admin");
  const slug = activeWorkspace?.slug;

  async function handleSignOut() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      /* proceed with local state cleanup anyway */
    }
    await refreshSession();
    navigate("/");
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="shrink-0" aria-label="Loop In home">
            <Logo />
          </Link>
          {activeWorkspace ? (
            <>
              <span className="text-border" aria-hidden>
                /
              </span>
              <span className="truncate font-mono text-xs tracking-wide text-muted-foreground">
                {activeWorkspace.name}
              </span>
            </>
          ) : null}

          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            {user ? (
              <>
                <span className="hidden max-w-[160px] truncate px-1 text-xs text-muted-foreground sm:block">
                  {user.name ?? user.email}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleSignOut()}
                >
                  <LogOut className="size-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </Button>
              </>
            ) : (
              <Button type="button" variant="brand" size="sm" asChild>
                <Link to="/">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 md:grid-cols-[220px_1fr]">
        <aside className="hidden md:block">
          <div className="sticky top-20 space-y-6">
            {slug ? (
              <nav className="space-y-1" aria-label="Workspace pages">
                <NavItem
                  to={`/${encodeURIComponent(slug)}`}
                  icon={<MessageSquare className="size-4" />}
                  label="Board"
                  active={!onAdminPage}
                />
                {isOwner ? (
                  <NavItem
                    to={`/${encodeURIComponent(slug)}/admin`}
                    icon={<LayoutDashboard className="size-4" />}
                    label="Command center"
                    active={onAdminPage}
                  />
                ) : null}
              </nav>
            ) : null}

            <div>
              <p className="mb-2 px-2 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
                Workspaces
              </p>
              {workspaces.length > 0 ? (
                <nav className="space-y-0.5" aria-label="Workspaces">
                  {workspaces.map((w) => {
                    const isActive = w.id === activeWorkspace?.id;
                    return (
                      <Link
                        key={w.id}
                        to={`/${encodeURIComponent(w.slug)}`}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
                          isActive
                            ? "bg-secondary font-medium text-foreground"
                            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                        )}
                      >
                        <LoopMark
                          className="size-4 shrink-0"
                          stroke={isActive ? "var(--brand)" : "var(--muted-foreground)"}
                        />
                        <span className="min-w-0 truncate">{w.name}</span>
                      </Link>
                    );
                  })}
                </nav>
              ) : user ? (
                <p className="px-2 text-xs text-muted-foreground">
                  No workspaces yet.{" "}
                  <Link to="/" className="text-brand hover:underline">
                    Create one
                  </Link>
                </p>
              ) : (
                <p className="px-2 text-xs text-muted-foreground">
                  <Link to="/" className="text-brand hover:underline">
                    Sign in
                  </Link>{" "}
                  to see your workspaces.
                </p>
              )}
            </div>
          </div>
        </aside>

        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-[60dvh] min-w-0"
        >
          <Outlet />
        </motion.main>
      </div>
    </div>
  );
}

function NavItem({
  to,
  icon,
  label,
  active,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
        active
          ? "bg-brand-bright/15 font-medium text-brand"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </Link>
  );
}
