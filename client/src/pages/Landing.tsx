import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, MotionConfig } from "framer-motion";
import { ArrowRight, LogOut, Plus } from "lucide-react";
import { useWorkspace, type Workspace } from "@/context/WorkspaceContext";
import { ApiError, apiFetch, getApiBase } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Logo, LoopMark } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Hero } from "@/components/landing/Hero";
import { LandingMarketing } from "@/components/landing/LandingMarketing";
import { CursorFollower } from "@/components/landing/CursorFollower";
import { SmoothScrollProvider, useSmoothScroll } from "@/lib/lenis";
import { fadeUp, staggerContainer } from "@/lib/motion";

/**
 * Logged-out marketing site. Lives inside SmoothScrollProvider so the hero CTAs
 * and nav anchors scroll through Lenis (momentum) rather than jumping.
 */
function LoggedOutMarketing({ api }: { api: string }) {
  const scrollTo = useSmoothScroll();
  return (
    <>
      <Hero onPrimary={() => scrollTo("#start")} />
      <LandingMarketing googleHref={`${api}/auth/google`} githubHref={`${api}/auth/github`} />
    </>
  );
}

function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function roleOf(w: Workspace, userId: string): "Owner" | "Admin" | "Member" {
  const r = w.role ?? (w.ownerId === userId ? "owner" : "member");
  return (r.charAt(0).toUpperCase() + r.slice(1)) as "Owner" | "Admin" | "Member";
}

const visibilityLabel = (w: Workspace) =>
  w.visibility === "public" ? "Public" : "Invite-only";

function sinceLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : `Since ${d.toLocaleDateString(undefined, { month: "short", year: "numeric" })}`;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="border border-border px-2 py-0.5 font-mono text-[11px] tracking-wide text-foreground/80">
      {children}
    </span>
  );
}

export function Landing() {
  const navigate = useNavigate();
  const {
    user,
    loading,
    workspaces,
    activeWorkspace,
    setActiveWorkspace,
    createWorkspace,
    refreshSession,
  } = useWorkspace();
  const api = getApiBase();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  async function handleSignOut() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      /* proceed with local cleanup anyway */
    }
    await refreshSession();
  }

  const onNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugifyName(value));
  };

  const openWorkspace = (s: string) => {
    const w = workspaces.find((x) => x.slug === s);
    if (!w) return;
    setActiveWorkspace(w);
    navigate(`/${w.slug}`);
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const n = name.trim();
    const s = slug.trim();
    if (!n || !s) {
      setCreateError("Name and slug are required.");
      return;
    }
    setCreating(true);
    try {
      const w = await createWorkspace({ name: n, slug: s });
      setActiveWorkspace(w);
      navigate(`/${w.slug}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setCreateError("That slug is already taken. Try another.");
      } else if (err instanceof ApiError && typeof err.body === "object" && err.body !== null) {
        const o = err.body as { error?: string };
        setCreateError(o.error ?? "Could not create workspace.");
      } else {
        setCreateError("Could not create workspace.");
      }
    } finally {
      setCreating(false);
    }
  };

  // ---- Loading ---------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        >
          <LoopMark className="size-9" />
        </motion.div>
        <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
          Loading…
        </p>
      </div>
    );
  }

  // ---- Logged out: marketing site -------------------------------------------
  if (!user) {
    return (
      <MotionConfig reducedMotion="user">
        <SmoothScrollProvider>
          {/* `.landing` scopes the stark monochrome theme to the marketing page */}
          <div className="landing min-h-dvh bg-background">
            <CursorFollower />
            <LoggedOutMarketing api={api} />
          </div>
        </SmoothScrollProvider>
      </MotionConfig>
    );
  }

  // ---- Logged in: workspace home --------------------------------------------
  const featured =
    (activeWorkspace && workspaces.find((w) => w.id === activeWorkspace.id)) ||
    workspaces[0] ||
    null;
  const secondary = featured ? workspaces.filter((w) => w.id !== featured.id) : workspaces;
  const canManage = featured ? roleOf(featured, user.id) !== "Member" : false;

  return (
    <MotionConfig reducedMotion="user">
      {/* `.landing` scopes the stark monochrome theme (same as the marketing page) */}
      <div className="landing min-h-dvh bg-background text-foreground">
        {/* Nav */}
        <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Logo />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <span className="hidden max-w-[200px] truncate font-mono text-xs tracking-wide text-muted-foreground sm:block">
              {user.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full"
              onClick={() => void handleSignOut()}
            >
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </header>
        <div className="mx-auto h-px w-full max-w-7xl bg-border" />

        <main className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
          <motion.div initial="hidden" animate="show" variants={staggerContainer(0.09)}>
            <motion.p
              variants={fadeUp}
              className="font-mono text-xs tracking-[0.22em] text-brand uppercase"
            >
              Your workspaces · {workspaces.length}
            </motion.p>
            <motion.h1
              variants={fadeUp}
              className="font-display mt-4 text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.95] font-semibold tracking-[-0.03em]"
            >
              Welcome back.
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-4 max-w-md text-muted-foreground">
              Jump back into a board, or spin up a new one.
            </motion.p>

            {workspaces.length === 0 ? (
              <motion.div
                variants={fadeUp}
                className="mt-14 border border-dashed border-border p-12 text-center sm:p-16"
              >
                <LoopMark className="mx-auto size-10 opacity-70" />
                <h2 className="font-display mt-6 text-2xl font-semibold tracking-tight">
                  No workspaces yet
                </h2>
                <p className="mx-auto mt-3 max-w-sm text-muted-foreground">
                  Create your first feedback board — it gets its own public URL and starts empty,
                  ready for ideas.
                </p>
                <Button
                  variant="brand"
                  size="xl"
                  className="mt-8 rounded-full px-7"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="size-4" />
                  Create your first workspace
                </Button>
              </motion.div>
            ) : (
              <div className="mt-14 grid gap-10 lg:grid-cols-12 lg:gap-12">
                {/* Featured workspace */}
                {featured ? (
                  <motion.div variants={fadeUp} className="lg:col-span-7">
                    <div className="relative">
                      <div
                        className="absolute inset-0 translate-x-3 translate-y-3 border border-brand/40"
                        aria-hidden
                      />
                      <div className="relative flex flex-col border border-border bg-card p-8 sm:p-10">
                        <p className="font-mono text-[11px] tracking-[0.22em] text-brand uppercase">
                          {activeWorkspace?.id === featured.id ? "Active workspace" : "Jump back in"}
                        </p>
                        <h2 className="font-display mt-4 text-[clamp(2rem,4vw,3.25rem)] leading-[0.98] font-semibold tracking-[-0.02em] break-words">
                          {featured.name}
                        </h2>
                        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
                          <Chip>{roleOf(featured, user.id)}</Chip>
                          <Chip>{visibilityLabel(featured)}</Chip>
                          <span className="font-mono text-xs text-muted-foreground">
                            /{featured.slug}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            · {sinceLabel(featured.createdAt)}
                          </span>
                        </div>
                        <div className="mt-8 flex flex-wrap items-center gap-5">
                          <Button
                            variant="brand"
                            size="xl"
                            className="group rounded-full px-7"
                            onClick={() => openWorkspace(featured.slug)}
                          >
                            Open board
                            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                          </Button>
                          {canManage ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveWorkspace(featured);
                                navigate(`/${featured.slug}/admin`);
                              }}
                              className="group inline-flex items-center gap-1.5 border-b border-foreground/30 pb-0.5 text-sm font-medium transition-colors hover:border-brand hover:text-brand"
                            >
                              Admin &amp; settings
                              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : null}

                {/* Secondary list + new */}
                <motion.div variants={fadeUp} className="lg:col-span-5">
                  {secondary.length > 0 ? (
                    <>
                      <p className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
                        {featured ? "Other workspaces" : "Workspaces"}
                      </p>
                      <ul className="mt-2">
                        {secondary.map((w, i) => (
                          <li key={w.id}>
                            <button
                              type="button"
                              onClick={() => openWorkspace(w.slug)}
                              className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-border py-5 text-left"
                            >
                              <span className="font-display text-ghost text-2xl font-bold">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate font-display text-lg font-semibold tracking-tight transition-colors group-hover:text-brand">
                                  {w.name}
                                </span>
                                <span className="block truncate font-mono text-xs text-muted-foreground">
                                  /{w.slug} · {roleOf(w, user.id)}
                                </span>
                              </span>
                              <ArrowRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-brand" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="group mt-6 flex w-full items-center justify-between gap-4 border border-dashed border-border p-5 text-left transition-colors hover:border-brand hover:bg-secondary/40"
                  >
                    <span>
                      <span className="block font-display text-base font-semibold tracking-tight group-hover:text-brand">
                        New workspace
                      </span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        Spin up a fresh board
                      </span>
                    </span>
                    <span className="flex size-9 items-center justify-center rounded-full border border-border text-brand transition-colors group-hover:border-brand">
                      <Plus className="size-4" />
                    </span>
                  </button>
                </motion.div>
              </div>
            )}
          </motion.div>
        </main>

        {/* Create workspace dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl font-semibold tracking-tight">
                Create a workspace
              </DialogTitle>
              <DialogDescription>
                Spin up a fresh feedback board with its own public URL.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ws-name">Name</Label>
                <Input
                  id="ws-name"
                  value={name}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder="Acme Feedback"
                  autoComplete="organization"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ws-slug">Slug (URL)</Label>
                <Input
                  id="ws-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value);
                  }}
                  placeholder="acme-feedback"
                  spellCheck={false}
                  className="font-mono"
                />
              </div>
              {createError ? (
                <p className="text-sm text-destructive" role="alert">
                  {createError}
                </p>
              ) : null}
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="brand" disabled={creating} className="rounded-full px-6">
                  {creating ? "Creating…" : "Create workspace"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MotionConfig>
  );
}
