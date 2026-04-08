import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "@/context/WorkspaceContext";
import { ApiError, getApiBase } from "@/lib/api";
import { Button } from "@/components/ui/button";

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
  const { user, loading, workspaces, setActiveWorkspace, createWorkspace } = useWorkspace();
  const api = getApiBase();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState("");

  const onNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugifyName(value));
  };

  const handleSelectWorkspace = () => {
    const w = workspaces.find((x) => x.slug === selectedSlug);
    if (!w) return;
    setActiveWorkspace(w);
    navigate(`/${w.slug}`, { replace: false });
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
      navigate(`/${w.slug}`, { replace: false });
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

  if (loading) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">LoopIn</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to open your workspaces.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="default">
            <a href={`${api}/auth/google`}>Continue with Google</a>
          </Button>
          <Button asChild variant="outline">
            <a href={`${api}/auth/github`}>Continue with GitHub</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-8 px-4 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your workspaces</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Signed in as <span className="text-foreground">{user.email}</span>
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Open a workspace</h2>
        {workspaces.length === 0 ? (
          <p className="text-sm text-muted-foreground">You are not in any workspace yet. Create one below.</p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Workspace</span>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={selectedSlug}
                onChange={(e) => setSelectedSlug(e.target.value)}
              >
                <option value="">Select…</option>
                {workspaces.map((w) => (
                  <option key={w.id} value={w.slug}>
                    {w.name} ({w.slug})
                  </option>
                ))}
              </select>
            </label>
            <Button type="button" disabled={!selectedSlug} onClick={handleSelectWorkspace}>
              Go
            </Button>
          </div>
        )}
      </section>

      <section className="space-y-3 border-t pt-6">
        <h2 className="text-sm font-medium">Create workspace</h2>
        <form onSubmit={handleCreateWorkspace} className="space-y-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Name</span>
            <input
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Acme Feedback"
              autoComplete="organization"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Slug (URL)</span>
            <input
              className="h-9 rounded-md border border-input bg-background px-3 font-mono text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="acme-feedback"
              spellCheck={false}
            />
          </label>
          {createError ? <p className="text-sm text-destructive">{createError}</p> : null}
          <Button type="submit" disabled={creating}>
            {creating ? "Creating…" : "Create workspace"}
          </Button>
        </form>
      </section>
    </div>
  );
}
