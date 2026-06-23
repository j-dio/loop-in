import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { moderationEvents, users } from "../../db/schema";

/** Discriminator for an audited staff action. Mirrors the `moderation_action` pg enum. */
export type ModerationActionKind =
  | "moderation_status"
  | "board_status"
  | "pin"
  | "unpin"
  | "delete";

/**
 * Minimal executor surface shared by `db` and a transaction handle, so a moderation event can be
 * recorded INSIDE the same transaction as the mutation it audits (atomic — the audit row commits
 * or rolls back with the state change, never silently lost).
 */
type Executor = Pick<typeof db, "insert">;

export type RecordModerationEventInput = {
  workspaceId: string;
  postId: string;
  /** The staff member performing the action. Stored as-is; FK is `set null` if the user is later removed. */
  actorId: string;
  action: ModerationActionKind;
  /** Prior value for status transitions (`moderation_status` / `board_status`); null for pin/unpin/delete. */
  fromValue?: string | null;
  /** New value for status transitions; null for pin/unpin/delete. */
  toValue?: string | null;
};

/**
 * Append a moderation audit row. Pass a transaction handle as `exec` to bind the write to the
 * caller's transaction; defaults to the top-level `db` for standalone use. Never updates/deletes.
 */
export async function recordModerationEvent(
  input: RecordModerationEventInput,
  exec: Executor = db,
): Promise<void> {
  await exec.insert(moderationEvents).values({
    workspaceId: input.workspaceId,
    postId: input.postId,
    actorId: input.actorId,
    action: input.action,
    fromValue: input.fromValue ?? null,
    toValue: input.toValue ?? null,
  });
}

export type ModerationEventActor = {
  id: string;
  name: string;
  avatarUrl: string | null;
} | null;

export type ModerationEventDTO = {
  id: string;
  action: ModerationActionKind;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
  /** Null when the acting user has since been deleted (FK set null). */
  actor: ModerationEventActor;
};

/**
 * Read the audit trail for a single post, newest first. Staff-only — the caller must already have
 * verified workspace admin/owner access. `workspaceId` is part of the lookup as defense in depth so
 * a post id from another workspace can never surface another board's history.
 */
export async function listModerationEvents(input: {
  workspaceId: string;
  postId: string;
  limit: number;
}): Promise<ModerationEventDTO[]> {
  const rows = await db
    .select({
      id: moderationEvents.id,
      action: moderationEvents.action,
      fromValue: moderationEvents.fromValue,
      toValue: moderationEvents.toValue,
      createdAt: moderationEvents.createdAt,
      actorId: users.id,
      actorName: users.name,
      actorAvatar: users.avatarUrl,
    })
    .from(moderationEvents)
    // leftJoin: keep the event even if the actor user was deleted (actor_id set null).
    .leftJoin(users, eq(moderationEvents.actorId, users.id))
    .where(
      and(
        eq(moderationEvents.postId, input.postId),
        eq(moderationEvents.workspaceId, input.workspaceId),
      ),
    )
    .orderBy(desc(moderationEvents.createdAt))
    .limit(input.limit);

  return rows
    .filter((r) => r != null)
    .map((r) => ({
      id: r.id,
      action: r.action as ModerationActionKind,
      fromValue: r.fromValue,
      toValue: r.toValue,
      createdAt: r.createdAt.toISOString(),
      actor: r.actorId
        ? { id: r.actorId, name: r.actorName ?? "Unknown", avatarUrl: r.actorAvatar ?? null }
        : null,
    }));
}
