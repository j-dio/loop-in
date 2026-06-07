import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/context/WorkspaceContext";
import { apiFetch } from "@/lib/api";

export function AppShell() {
  const { activeWorkspace, user, refreshSession } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();

  const isOwner = Boolean(user && activeWorkspace && user.id === activeWorkspace.ownerId);
  const onAdminPage = location.pathname.endsWith("/admin");

  async function handleSignOut() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // server error — proceed with local state cleanup anyway
    }
    await refreshSession();
    navigate("/");
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link to="/" className="text-sm font-semibold hover:underline">
            LoopIn
          </Link>
          {activeWorkspace ? (
            <span className="truncate text-sm text-muted-foreground">{activeWorkspace.name}</span>
          ) : null}

          <div className="ml-auto flex items-center gap-3">
            {isOwner && !onAdminPage && activeWorkspace ? (
              <Link
                to={`/${encodeURIComponent(activeWorkspace.slug)}/admin`}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                Command Center →
              </Link>
            ) : null}
            {user ? (
              <>
                <span className="hidden max-w-[160px] truncate text-xs text-muted-foreground sm:block">
                  {user.name ?? user.email}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => void handleSignOut()}
                >
                  Sign out
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </header>

      {/* Body: sidebar + main */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-4 md:grid-cols-[240px_1fr]">
        <aside className="rounded-lg border p-3">
          <div className="text-sm font-medium">Sidebar</div>
          <div className="mt-2 text-xs text-muted-foreground">
            Placeholder links later.
          </div>
        </aside>

        <main className="min-h-[60dvh] min-w-0 rounded-lg border p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
