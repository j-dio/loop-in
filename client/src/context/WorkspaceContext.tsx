import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "@/lib/api";

const STORAGE_KEY = "loopin-active-workspace";

export type User = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  onboardingCompletedAt: string | null;
};

export type Workspace = {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  primaryColor: string;
  logoUrl: string | null;
  visibility: "public" | "invite_only";
  requireApproval: boolean;
  createdAt: string;
  /** The current user's role in this workspace. Present on the list endpoint. */
  role?: "owner" | "admin" | "member";
};

type WorkspaceContextValue = {
  user: User | null;
  loading: boolean;
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (w: Workspace | null) => void;
  refreshSession: () => Promise<void>;
  createWorkspace: (input: {
    name: string;
    slug: string;
    tagline: string;
    platform: "web" | "mobile" | "desktop" | "other";
    category: string;
    primaryColor?: string;
    visibility?: "public" | "invite_only";
  }) => Promise<Workspace>;
  completeOnboarding: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function readStoredWorkspace(): Workspace | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const w = JSON.parse(raw) as Workspace;
    return { ...w, requireApproval: w.requireApproval ?? true };
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(() => readStoredWorkspace());
  const [loading, setLoading] = useState(true);

  const setActiveWorkspace = useCallback((w: Workspace | null) => {
    setActiveWorkspaceState(w);
    if (w) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(w));
    else sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const me = await apiFetch<{ user: User | null }>("/auth/me");
      setUser(me.user);
      if (me.user) {
        const data = await apiFetch<{ workspaces: Workspace[] }>("/api/workspaces");
        setWorkspaces(data.workspaces);
        setActiveWorkspaceState((prev) => {
          if (!prev) return prev;
          const next = data.workspaces.find((w) => w.id === prev.id);
          if (!next) return prev;
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      } else {
        setWorkspaces([]);
        setActiveWorkspace(null);
      }
    } catch {
      setUser(null);
      setWorkspaces([]);
      setActiveWorkspace(null);
    } finally {
      setLoading(false);
    }
  }, [setActiveWorkspace]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (!activeWorkspace || workspaces.length === 0) return;
    const stillMember = workspaces.some((w) => w.id === activeWorkspace.id);
    if (!stillMember) {
      setActiveWorkspace(null);
    }
  }, [workspaces, activeWorkspace, setActiveWorkspace]);

  const createWorkspace = useCallback(
    async (input: {
      name: string;
      slug: string;
      tagline: string;
      platform: "web" | "mobile" | "desktop" | "other";
      category: string;
      primaryColor?: string;
      visibility?: "public" | "invite_only";
    }) => {
      const data = await apiFetch<{ workspace: Workspace }>("/api/workspaces", {
        method: "POST",
        body: JSON.stringify(input),
      });
      const w = data.workspace;
      setWorkspaces((prev) => [...prev.filter((x) => x.id !== w.id), w]);
      return w;
    },
    []
  );

  const completeOnboarding = useCallback(async () => {
    // The endpoint returns the fresh user (with a non-null onboardingCompletedAt). Apply it
    // optimistically instead of calling refreshSession: completing onboarding doesn't change
    // workspaces, and refreshSession's failure path wipes `user` to null + its loading flash
    // blanks the Welcome screen — both of which let OnboardingGate bounce back to /welcome.
    const res = await apiFetch<{ user: User }>("/api/users/me/onboarding/complete", {
      method: "POST",
    });
    setUser(res.user);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      workspaces,
      activeWorkspace,
      setActiveWorkspace,
      refreshSession,
      createWorkspace,
      completeOnboarding,
    }),
    [user, loading, workspaces, activeWorkspace, setActiveWorkspace, refreshSession, createWorkspace, completeOnboarding]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with its provider; HMR-only warning
export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
