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
};

export type Workspace = {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  primaryColor: string;
  visibility: "public" | "invite_only";
  createdAt: string;
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
    primaryColor?: string;
    visibility?: "public" | "invite_only";
  }) => Promise<Workspace>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function readStoredWorkspace(): Workspace | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Workspace;
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

  const value = useMemo(
    () => ({
      user,
      loading,
      workspaces,
      activeWorkspace,
      setActiveWorkspace,
      refreshSession,
      createWorkspace,
    }),
    [user, loading, workspaces, activeWorkspace, setActiveWorkspace, refreshSession, createWorkspace]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
