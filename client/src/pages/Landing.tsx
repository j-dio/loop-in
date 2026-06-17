import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, MotionConfig } from "framer-motion";
import { ArrowRight, LogOut } from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { ApiError, apiFetch, getApiBase } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function Landing() {
  const navigate = useNavigate();
  const { user, loading, workspaces, setActiveWorkspace, createWorkspace, refreshSession } =
    useWorkspace();
  const api = getApiBase();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <span className="hidden max-w-[180px] truncate text-sm text-muted-foreground sm:block">
            {user.email}
          </span>
          <Button variant="ghost" size="sm" onClick={() => void handleSignOut()}>
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-16">
        <motion.div initial="hidden" animate="show" variants={staggerContainer(0.08)}>
          <motion.p
            variants={fadeUp}
            className="font-mono text-xs tracking-widest text-brand uppercase"
          >
            Your workspaces
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="mt-3 font-serif text-4xl font-medium tracking-tight"
          >
            Welcome back.
          </motion.h1>

          <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            {/* Workspace list */}
            <motion.div variants={fadeUp}>
              {workspaces.length === 0 ? (
                <div className="border border-dashed border-border p-10 text-center">
                  <LoopMark className="mx-auto size-8 opacity-60" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    You're not in any workspace yet. Create your first one →
                  </p>
                </div>
              ) : (
                <ul className="border-t border-border">
                  {workspaces.map((w, i) => {
                    const isOwner = w.ownerId === user.id;
                    return (
                      <li key={w.id}>
                        <button
                          type="button"
                          onClick={() => openWorkspace(w.slug)}
                          className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-border py-5 text-left transition-colors hover:bg-secondary/40"
                        >
                          <span className="font-mono text-sm text-muted-foreground">
                            0{i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-lg font-medium tracking-tight transition-colors group-hover:text-brand">
                              {w.name}
                            </p>
                            <p className="truncate font-mono text-xs text-muted-foreground">
                              /{w.slug} · {isOwner ? "Owner" : "Member"}
                            </p>
                          </div>
                          <ArrowRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-brand" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </motion.div>

            {/* Create workspace */}
            <motion.div variants={fadeUp}>
              <div className="border border-border bg-card p-6">
                <p className="font-mono text-[11px] tracking-widest text-brand uppercase">
                  New
                </p>
                <h2 className="mt-2 font-serif text-2xl font-medium tracking-tight">
                  Create a workspace
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Spin up a fresh feedback board with its own public URL.
                </p>
                <form onSubmit={handleCreateWorkspace} className="mt-5 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ws-name">Name</Label>
                    <Input
                      id="ws-name"
                      value={name}
                      onChange={(e) => onNameChange(e.target.value)}
                      placeholder="Acme Feedback"
                      autoComplete="organization"
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
                  <Button type="submit" variant="brand" disabled={creating} className="w-full rounded-none">
                    {creating ? "Creating…" : "Create workspace"}
                  </Button>
                </form>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
