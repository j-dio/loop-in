// client/src/layouts/AppShell.tsx
import { Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { AppTopBar } from "@/layouts/AppTopBar";
import { AppSidebar } from "@/layouts/AppSidebar";
import { useSidebar } from "@/hooks/useSidebar";

export function AppShell() {
  const location = useLocation();
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebar();

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <AppTopBar onToggleMobileNav={() => setMobileOpen(true)} />
      <div className="flex flex-1">
        <AppSidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onToggleCollapsed={toggleCollapsed}
          onCloseMobile={() => setMobileOpen(false)}
        />
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8"
        >
          <Outlet />
        </motion.main>
      </div>
    </div>
  );
}
