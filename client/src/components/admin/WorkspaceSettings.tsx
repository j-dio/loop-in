import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Section } from "@/components/admin/Section";

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
}: {
  draft: SettingsDraft | null;
  slug: string;
  canEdit: boolean;
  saving: boolean;
  feedback: Feedback;
  onChange: (patch: Partial<SettingsDraft>) => void;
  onSubmit: () => void;
}) {
  if (!draft) return <p className="text-sm text-muted-foreground">Loading workspace…</p>;
  return (
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
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
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
        <p
          className={feedback.kind === "ok" ? "text-sm text-brand" : "text-sm text-destructive"}
          role={feedback.kind === "err" ? "alert" : "status"}
        >
          {feedback.text}
        </p>
      ) : null}
      <Button type="submit" className="mt-4" disabled={!canEdit || saving}>
        {saving ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
