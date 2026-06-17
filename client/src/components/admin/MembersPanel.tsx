import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Section } from "@/components/admin/Section";

type WorkspaceRole = "owner" | "admin" | "member";

type MemberRow = {
  userId: string;
  email: string;
  name: string | null;
  role: WorkspaceRole;
  joinedAt: string;
};

type Invite = {
  id: string;
  email: string;
  inviterName: string;
  expiresAt: string;
};

export function MembersPanel({
  members,
  pendingInvites,
  currentUserId,
  canInvite,
  removingId,
  cancellingInviteId,
  inviteEmail,
  inviteSubmitting,
  inviteFeedback,
  onRemove,
  onCancelInvite,
  onInviteEmailChange,
  onSubmitInvite,
}: {
  members: MemberRow[];
  pendingInvites: Invite[];
  currentUserId: string;
  canInvite: boolean;
  removingId: string | null;
  cancellingInviteId: string | null;
  inviteEmail: string;
  inviteSubmitting: boolean;
  inviteFeedback: { kind: "ok" | "err"; text: string } | null;
  onRemove: (userId: string) => void;
  onCancelInvite: (inviteId: string) => void;
  onInviteEmailChange: (email: string) => void;
  onSubmitInvite: (e: FormEvent) => void;
}) {
  return (
    <div className="max-w-2xl">
      {members.length > 0 ? (
        <Section title="Members">
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li key={m.userId} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.name ?? m.email}</p>
                  {m.name ? (
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
                </div>
                {m.role !== "owner" && m.userId !== currentUserId ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-destructive hover:text-destructive"
                    disabled={removingId === m.userId}
                    onClick={() => onRemove(m.userId)}
                  >
                    {removingId === m.userId ? "Removing…" : "Remove"}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {pendingInvites.length > 0 ? (
        <Section title="Pending Invites">
          <ul className="divide-y divide-border">
            {pendingInvites.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-destructive hover:text-destructive"
                  disabled={cancellingInviteId === inv.id}
                  onClick={() => onCancelInvite(inv.id)}
                >
                  {cancellingInviteId === inv.id ? "Cancelling…" : "Cancel"}
                </Button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {canInvite ? (
        <Section title="Invite member">
          <p className="text-sm text-muted-foreground">
            Add someone by email. If they do not have a LoopIn account yet, they will join this
            workspace when they first sign in with this email.
          </p>
          <form className="space-y-4" onSubmit={onSubmitInvite}>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                autoComplete="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(ev) => onInviteEmailChange(ev.target.value)}
                disabled={inviteSubmitting}
              />
            </div>
            {inviteFeedback ? (
              <p
                className={
                  inviteFeedback.kind === "ok" ? "text-brand text-sm" : "text-destructive text-sm"
                }
                role={inviteFeedback.kind === "err" ? "alert" : "status"}
              >
                {inviteFeedback.text}
              </p>
            ) : null}
            <Button type="submit" disabled={inviteSubmitting || !inviteEmail.trim()}>
              {inviteSubmitting ? "Sending…" : "Send invite"}
            </Button>
          </form>
        </Section>
      ) : null}
    </div>
  );
}
