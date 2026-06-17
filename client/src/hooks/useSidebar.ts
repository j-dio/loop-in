import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "loopin-sidebar";

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "collapsed";
  } catch {
    return false;
  }
}

/** Rail collapse state (persisted) + mobile drawer open state (ephemeral). */
export function useSidebar() {
  const [collapsed, setCollapsedState] = useState<boolean>(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const setCollapsed = useCallback((v: boolean) => {
    setCollapsedState(v);
    try {
      window.localStorage.setItem(STORAGE_KEY, v ? "collapsed" : "expanded");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = useCallback(() => setCollapsed(!collapsed), [collapsed, setCollapsed]);

  // `[` toggles the rail (ignore when typing in an input/textarea/select).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "[") return;
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (t?.isContentEditable) return;
      toggleCollapsed();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCollapsed]);

  return { collapsed, toggleCollapsed, setCollapsed, mobileOpen, setMobileOpen };
}
