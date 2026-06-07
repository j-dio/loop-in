import { Link, Outlet } from "react-router-dom";
import { useWorkspace } from "@/context/WorkspaceContext";

export function AppShell() {
  const { activeWorkspace } = useWorkspace();

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
    
  )
}