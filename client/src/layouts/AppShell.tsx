import { Outlet } from 'react-router-dom';

export function AppShell() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Top Nav */}
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          <div className='text-sm font-semibold'>Nav</div>
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

        <main className="min-h-[60dvh] rounded-lg border p-4">
          <Outlet />
        </main>
      </div>
    </div>
    
  )
}