import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "@/context/WorkspaceContext";
import { ApiError } from "@/lib/api";
import { isReservedSlug } from "@/lib/reservedSlugs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function slugifyName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
}

export function CreateAppWizard({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { user, createWorkspace, setActiveWorkspace, completeOnboarding } = useWorkspace();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [tagline, setTagline] = useState("");
  const [category, setCategory] = useState("");
  const [platform, setPlatform] = useState<"web" | "mobile" | "desktop" | "other">("web");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function reset() {
    setName("");
    setSlug("");
    setSlugTouched(false);
    setTagline("");
    setCategory("");
    setPlatform("web");
    setCreating(false);
    setCreateError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  const onNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugifyName(value));
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const n = name.trim();
    const s = slug.trim();
    const t = tagline.trim();

    if (!n || !s) { setCreateError("Name and slug are required."); return; }
    if (!t) { setCreateError("Tagline is required."); return; }
    if (!category) { setCreateError("Category is required."); return; }
    if (!platform) { setCreateError("Platform is required."); return; }
    if (isReservedSlug(s)) { setCreateError("That URL is reserved — pick another."); return; }

    setCreating(true);
    try {
      const w = await createWorkspace({ name: n, slug: s, tagline: t, platform, category });
      setActiveWorkspace(w);
      if (user?.onboardingCompletedAt == null) {
        await completeOnboarding();
      }
      handleOpenChange(false);
      navigate(`/${w.slug}/admin?section=profile`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setCreateError("That slug is already taken. Try another.");
      } else if (err instanceof ApiError && typeof err.body === "object" && err.body !== null) {
        const o = err.body as { error?: string; details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] } };
        const fieldErrors = o.details?.fieldErrors ?? {};
        const firstFieldError = Object.values(fieldErrors).flat()[0];
        const firstFormError = o.details?.formErrors?.[0];
        setCreateError(firstFieldError ?? firstFormError ?? o.error ?? "Could not create workspace.");
      } else {
        setCreateError("Could not create workspace.");
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-semibold tracking-tight">Create an app</DialogTitle>
          <DialogDescription>Set up your public feedback board.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreateWorkspace} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ws-name">Name</Label>
            <Input id="ws-name" value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="Acme Feedback" autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-slug">Slug (URL)</Label>
            <Input
              id="ws-slug"
              value={slug}
              onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); }}
              placeholder="acme-feedback"
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-tagline">Tagline</Label>
            <Input
              id="ws-tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="One sentence about your app"
              maxLength={140}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-category">Category</Label>
            <select
              id="ws-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus-visible:outline-none"
            >
              <option value="" disabled>Select a category</option>
              <option value="Productivity">Productivity</option>
              <option value="Developer Tools">Developer Tools</option>
              <option value="Social">Social</option>
              <option value="Finance">Finance</option>
              <option value="Health">Health</option>
              <option value="Education">Education</option>
              <option value="Entertainment">Entertainment</option>
              <option value="Games">Games</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-platform">Platform</Label>
            <select
              id="ws-platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as "web" | "mobile" | "desktop" | "other")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus-visible:outline-none"
            >
              <option value="web">Web</option>
              <option value="mobile">Mobile</option>
              <option value="desktop">Desktop</option>
              <option value="other">Other</option>
            </select>
          </div>
          {createError ? <p className="text-sm text-destructive" role="alert">{createError}</p> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="brand" disabled={creating}>{creating ? "Creating…" : "Create app"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
