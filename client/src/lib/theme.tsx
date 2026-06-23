import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { runThemeTransition } from "@/lib/themeTransition";

type Theme = "light" | "dark";

const STORAGE_KEY = "loopin-theme";

// Direction of the full-viewport wipe when toggling themes. Matches the
// Skiper reference (rectangle / bottom-up).
const TRANSITION = { start: "bottom-up", blur: false } as const;

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* ignore */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Applies the theme: mutates the <html> class synchronously (so the View
  // Transition captures the new state) and persists it. State update keeps
  // React in sync; the useEffect re-apply is then a no-op.
  const commitTheme = useCallback((next: Theme) => {
    applyTheme(next);
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const setTheme = useCallback(
    (t: Theme) => {
      runThemeTransition(() => commitTheme(t), TRANSITION);
    },
    [commitTheme]
  );

  const toggleTheme = useCallback(() => {
    const next = themeRef.current === "dark" ? "light" : "dark";
    runThemeTransition(() => commitTheme(next), TRANSITION);
  }, [commitTheme]);

  const value = useMemo(
    () => ({ theme, toggleTheme, setTheme }),
    [theme, toggleTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with its provider; HMR-only warning
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
