import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Section } from "@/components/admin/Section";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type SettingsDraft = {
  name: string;
  visibility: "public" | "invite_only";
  requireApproval: boolean;
};

type Feedback = { kind: "ok" | "err"; text: string } | null;

export function WorkspaceSettings({
  draft,
  slug,
  canEdit,
  saving,
  feedback,
  onChange,
  onSubmit,
  onDelete,
  deleting,
}: {
  draft: SettingsDraft | null;
  slug: string;
  canEdit: boolean;
  saving: boolean;
  feedback: Feedback;
  onChange: (patch: Partial<SettingsDraft>) => void;
  onSubmit: () => void;
  onDelete?: () => Promise<void>;
  deleting?: boolean;
}) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");

  if (!draft) return <p className="text-sm text-muted-foreground">Loading workspace…</p>;

  async function handleConfirmDelete() {
    if (!onDelete) return;
    await onDelete();
    setDeleteDialogOpen(false);
  }

  return (
    <>
      <form
        className="max-w-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        {!canEdit ? (
          <p className="mb-4 text-sm text-muted-foreground" role="status">
            Only the workspace owner can change these settings. Admins can use Triage and Kanban.
          </p>
        ) : null}

        <Section title="General">
          <div className="space-y-2">
            <Label htmlFor="ws-slug">URL slug</Label>
            <Input id="ws-slug" value={slug} readOnly disabled className="bg-muted/50 font-mono" />
            <p className="text-xs text-muted-foreground">Slug is fixed so existing links keep working.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-name">Workspace name</Label>
            <Input
              id="ws-name"
              value={draft.name}
              onChange={(e) => onChange({ name: e.target.value })}
              required
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-visibility">Visibility</Label>
            <select
              id="ws-visibility"
              className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              value={draft.visibility}
              onChange={(e) => onChange({ visibility: e.target.value as SettingsDraft["visibility"] })}
              disabled={!canEdit}
            >
              <option value="public">Public — anyone with the link can view and submit</option>
              <option value="invite_only">Invite only — members only</option>
            </select>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-border p-4">
            <input
              id="ws-require-approval"
              type="checkbox"
              className="mt-1 size-4 rounded border-input"
              checked={draft.requireApproval}
              onChange={(e) => onChange({ requireApproval: e.target.checked })}
              disabled={!canEdit}
            />
            <div className="min-w-0 space-y-1">
              <Label htmlFor="ws-require-approval" className="cursor-pointer">
                Require approval for new posts
              </Label>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {draft.requireApproval
                  ? "New posts require approval before appearing on the board."
                  : "New posts appear immediately. Use triage to remove spam after the fact."}
              </p>
            </div>
          </div>
        </Section>

        {feedback ? (
          <div
            role={feedback.kind === "err" ? "alert" : "status"}
            className={
              feedback.kind === "ok"
                ? "rounded-lg border border-brand/30 bg-brand-bright/10 px-4 py-3 text-sm text-brand"
                : "rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            }
          >
            {feedback.text}
          </div>
        ) : null}
        <Button type="submit" className="mt-4" disabled={!canEdit || saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </form>

      {canEdit && onDelete ? (
        <div className="max-w-2xl rounded-xl border border-destructive/30 p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-destructive">Danger zone</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Permanently delete this workspace and all its posts, comments, members, and data. This cannot be undone.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => { setConfirmSlug(""); setDeleteDialogOpen(true); }}
          >
            Delete workspace
          </Button>
        </div>
      ) : null}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete workspace</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{slug}</strong> and all its data. Type{" "}
              <strong className="font-mono">{slug}</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmSlug}
            onChange={(e) => setConfirmSlug(e.target.value)}
            placeholder={slug}
            className="font-mono"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmDelete()}
              disabled={confirmSlug !== slug || deleting}
            >
              {deleting ? "Deleting…" : "Delete workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
