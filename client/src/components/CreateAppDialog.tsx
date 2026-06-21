import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "@/context/WorkspaceContext";
import { ApiError } from "@/lib/api";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function CreateAppDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { createWorkspace, setActiveWorkspace } = useWorkspace();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function reset() {
    setName("");
    setSlug("");
    setSlugTouched(false);
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
    if (!n || !s) {
      setCreateError("Name and slug are required.");
      return;
    }
    setCreating(true);
    try {
      const w = await createWorkspace({ name: n, slug: s });
      setActiveWorkspace(w);
      onOpenChange(false);
      reset();
      navigate(`/${w.slug}/admin`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setCreateError("That slug is already taken. Try another.");
      } else if (err instanceof ApiError && typeof err.body === "object" && err.body !== null) {
        const o = err.body as {
          error?: string;
          details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
        };
        const fieldErrors = o.details?.fieldErrors ?? {};
        const firstFieldError = Object.values(fieldErrors).flat()[0];
        const firstFormError = o.details?.formErrors?.[0];
        setCreateError(
          firstFieldError ?? firstFormError ?? o.error ?? "Could not create workspace."
        );
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
                // Strip anything the server's kebab-case rule rejects so invalid
                // characters (spaces, parens, uppercase) can never be submitted.
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
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
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="brand"
              disabled={creating}
              className="rounded-full px-6"
            >
              {creating ? "Creating…" : "Create workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
