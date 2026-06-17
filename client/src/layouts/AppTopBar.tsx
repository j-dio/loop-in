import { Link, useNavigate } from "react-router-dom";
import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { useWorkspace } from "@/context/WorkspaceContext";
import { apiFetch } from "@/lib/api";

export function AppTopBar({ onToggleMobileNav }: { onToggleMobileNav: () => void }) {
  const { user, activeWorkspace, refreshSession } = useWorkspace();
  const navigate = useNavigate();

  async function handleSignOut() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      /* proceed with local cleanup anyway */
    }
    await refreshSession();
    navigate("/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onToggleMobileNav}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary/60 hover:text-foreground md:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </button>
        <Link to="/" className="shrink-0" aria-label="Loop In home">
          <Logo />
        </Link>
        {activeWorkspace ? (
          <>
            <span className="hidden text-border sm:inline" aria-hidden>/</span>
            <div className="hidden sm:block">
              <WorkspaceSwitcher />
            </div>
          </>
        ) : null}

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          {user ? (
            <>
              <span className="hidden max-w-[160px] truncate px-1 font-mono text-xs tracking-wide text-muted-foreground sm:block">
                {user.name ?? user.email}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => void handleSignOut()}>
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
  );
}
