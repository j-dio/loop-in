import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/context/WorkspaceContext";
import { ApiError, apiFetch, updateWorkspace } from "@/lib/api";
import type { PostDTO } from "@/lib/postTypes";

type WorkspaceRole = "owner" | "admin" | "member";

type MemberRow = {
  userId: string;
  email: string;
  name: string | null;
  role: WorkspaceRole;
  joinedAt: string;
};

const BOARD_COLUMNS = [
  { id: "inbox" as const, label: "Inbox" },
  { id: "under_review" as const, label: "Under Review" },
  { id: "planned" as const, label: "Planned" },
  { id: "in_progress" as const, label: "In Progress" },
  { id: "shipped" as const, label: "Shipped" },
];

type BoardColumnId = (typeof BOARD_COLUMNS)[number]["id"];

type ColumnsState = Record<BoardColumnId, PostDTO[]>;

function emptyColumns(): ColumnsState {
  return {
    inbox: [],
    under_review: [],
    planned: [],
    in_progress: [],
    shipped: [],
  };
}

function groupKanbanPosts(posts: PostDTO[]): ColumnsState {
  const next = emptyColumns();
  for (const p of posts) {
    if (next[p.boardStatus]) {
      next[p.boardStatus].push(p);
    }
  }
  return next;
}

function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

function formatCategory(c: PostDTO["category"]) {
  if (c === "bug") return "Bug";
  if (c === "feature_request") return "Feature";
  return "UI";
}

function errorTextFromApiBody(e: unknown, fallback: string): string {
  if (e instanceof ApiError && typeof e.body === "object" && e.body && "error" in e.body) {
    return String((e.body as { error: string }).error);
  }
  return fallback;
}

type PostMemberInviteResponse =
  | { member: MemberRow }
  | { pending: true; email: string };

type SettingsDraft = {
  name: string;
  visibility: "public" | "invite_only";
  requireApproval: boolean;
  primaryColor: string;
};

export function Admin() {
  const { slug } = useParams();
  const {
    user,
    loading: sessionLoading,
    workspaces,
    setActiveWorkspace,
    activeWorkspace,
    refreshSession,
  } = useWorkspace();

  const [access, setAccess] = useState<"unknown" | "allowed" | "forbidden" | "no_session">(
    "unknown"
  );
  const [commandCenterRole, setCommandCenterRole] = useState<WorkspaceRole | null>(null);
  const [tab, setTab] = useState<"triage" | "kanban" | "settings">("triage");
  const [triagePosts, setTriagePosts] = useState<PostDTO[]>([]);
  const [kanbanColumns, setKanbanColumns] = useState<ColumnsState>(() => emptyColumns());
  const [triageLoading, setTriageLoading] = useState(false);
  const [kanbanLoading, setKanbanLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null
  );

  const canEditWorkspaceSettings = commandCenterRole === "owner";
  const canInviteMembers =
    commandCenterRole === "admin" || commandCenterRole === "owner";

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null
  );

  useEffect(() => {
    if (!slug) return;
    const match = workspaces.find((w) => w.slug === slug);
    if (match && match.id !== activeWorkspace?.id) {
      setActiveWorkspace(match);
    }
  }, [slug, workspaces, setActiveWorkspace, activeWorkspace?.id]);

  const isMember = Boolean(slug && user && workspaces.some((w) => w.slug === slug));

  const verifyAccess = useCallback(async () => {
    if (!slug || !user) {
      setAccess("no_session");
      setCommandCenterRole(null);
      return;
    }
    try {
      const data = await apiFetch<{ members: MemberRow[] }>(
        `/api/workspaces/${encodeURIComponent(slug)}/members`
      );
      const me = data.members.find((m) => m.userId === user.id);
      setCommandCenterRole(me?.role ?? null);
      setAccess("allowed");
    } catch (e) {
      setCommandCenterRole(null);
      if (e instanceof ApiError && (e.status === 403 || e.status === 401)) {
        setAccess("forbidden");
      } else {
        setAccess("forbidden");
      }
    }
  }, [slug, user]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      setAccess("no_session");
      return;
    }
    void verifyAccess();
  }, [sessionLoading, user, verifyAccess]);

  const loadTriage = useCallback(async () => {
    if (!slug || access !== "allowed") return;
    setTriageLoading(true);
    setListError(null);
    try {
      const data = await apiFetch<{ posts: PostDTO[] }>(
        `/api/workspaces/${encodeURIComponent(slug)}/posts/admin/triage`
      );
      setTriagePosts(data.posts);
    } catch {
      setListError("Could not load triage queue.");
    } finally {
      setTriageLoading(false);
    }
  }, [slug, access]);

  const loadKanban = useCallback(async () => {
    if (!slug || access !== "allowed") return;
    setKanbanLoading(true);
    setListError(null);
    try {
      const data = await apiFetch<{ posts: PostDTO[] }>(
        `/api/workspaces/${encodeURIComponent(slug)}/posts/admin/kanban`
      );
      setKanbanColumns(groupKanbanPosts(data.posts));
    } catch {
      setListError("Could not load Kanban.");
    } finally {
      setKanbanLoading(false);
    }
  }, [slug, access]);

  useEffect(() => {
    if (access !== "allowed" || !slug) return;
    if (tab === "triage") void loadTriage();
    else if (tab === "kanban") void loadKanban();
  }, [access, slug, tab, loadTriage, loadKanban]);

  useEffect(() => {
    if (tab !== "settings" || !slug) return;
    const w = workspaces.find((x) => x.slug === slug);
    if (!w) return;
    setSettingsDraft({
      name: w.name,
      visibility: w.visibility,
      requireApproval: w.requireApproval,
      primaryColor: w.primaryColor,
    });
    setSettingsFeedback(null);
  }, [tab, slug, workspaces]);

  async function saveWorkspaceSettings() {
    if (!slug || !settingsDraft || !canEditWorkspaceSettings) return;
    const name = settingsDraft.name.trim();
    if (!name) {
      setSettingsFeedback({ kind: "err", text: "Workspace name is required." });
      return;
    }
    let primaryColor = settingsDraft.primaryColor.trim();
    if (!primaryColor.startsWith("#")) primaryColor = `#${primaryColor}`;
    if (!/^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
      setSettingsFeedback({
        kind: "err",
        text: "Primary color must be a hex value like #0F172A.",
      });
      return;
    }

    setSettingsSaving(true);
    setSettingsFeedback(null);
    try {
      await updateWorkspace(slug, {
        name,
        primaryColor,
        visibility: settingsDraft.visibility,
        require_approval: settingsDraft.requireApproval,
      });
      await refreshSession();
      setSettingsFeedback({ kind: "ok", text: "Settings saved." });
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 403
          ? "Only the workspace owner can change settings."
          : e instanceof ApiError && typeof e.body === "object" && e.body && "error" in e.body
            ? String((e.body as { error: string }).error)
            : "Could not save settings.";
      setSettingsFeedback({ kind: "err", text: msg });
    } finally {
      setSettingsSaving(false);
    }
  }

  async function submitMemberInvite(e: FormEvent) {
    e.preventDefault();
    if (!slug || !inviteEmail.trim()) return;
    setInviteSubmitting(true);
    setInviteFeedback(null);
    try {
      const data = await apiFetch<PostMemberInviteResponse>(
        `/api/workspaces/${encodeURIComponent(slug)}/members`,
        { method: "POST", body: JSON.stringify({ email: inviteEmail.trim() }) }
      );
      if ("pending" in data && data.pending) {
        setInviteFeedback({
          kind: "ok",
          text: "Invite saved. They'll be added automatically when they sign in to LoopIn.",
        });
      } else {
        setInviteFeedback({ kind: "ok", text: "Member added successfully." });
      }
      setInviteEmail("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setInviteFeedback({ kind: "err", text: errorTextFromApiBody(err, "Request could not be completed.") });
      } else {
        setInviteFeedback({
          kind: "err",
          text: errorTextFromApiBody(err, "Could not send invite."),
        });
      }
    } finally {
      setInviteSubmitting(false);
    }
  }

  async function moderate(postId: string, moderation_status: "approved" | "spam" | "rejected") {
    if (!slug) return;
    setModeratingId(postId);
    setActionError(null);
    try {
      await apiFetch<{ post: PostDTO }>(
        `/api/workspaces/${encodeURIComponent(slug)}/posts/${encodeURIComponent(postId)}/moderate`,
        { method: "PATCH", body: JSON.stringify({ moderation_status }) }
      );
      setTriagePosts((prev) => prev.filter((p) => p.id !== postId));
      await loadKanban();
    } catch (e) {
      setActionError(
        e instanceof ApiError && typeof e.body === "object" && e.body && "error" in e.body
          ? String((e.body as { error: string }).error)
          : "Moderation failed."
      );
    } finally {
      setModeratingId(null);
    }
  }

  const onKanbanDragEnd = useCallback(
    async (result: DropResult) => {
      const { destination, source, draggableId } = result;
      if (!destination) return;
      if (destination.droppableId === source.droppableId && destination.index === source.index) {
        return;
      }

      const destCol = destination.droppableId as BoardColumnId;
      const sourceCol = source.droppableId as BoardColumnId;

      let previousSnapshot: ColumnsState | null = null;
      setKanbanColumns((cols) => {
        previousSnapshot = {
          inbox: [...cols.inbox],
          under_review: [...cols.under_review],
          planned: [...cols.planned],
          in_progress: [...cols.in_progress],
          shipped: [...cols.shipped],
        };

        if (sourceCol === destCol) {
          const reordered = reorder(cols[sourceCol], source.index, destination.index);
          return { ...cols, [sourceCol]: reordered };
        }

        const start = [...cols[sourceCol]];
        const finish = [...cols[destCol]];
        const [moved] = start.splice(source.index, 1);
        const updated: PostDTO = { ...moved, boardStatus: destCol };
        finish.splice(destination.index, 0, updated);
        return { ...cols, [sourceCol]: start, [destCol]: finish };
      });

      if (sourceCol === destCol) return;

      if (!slug) return;
      setStatusUpdatingId(draggableId);
      setActionError(null);
      try {
        await apiFetch<{ post: PostDTO }>(
          `/api/workspaces/${encodeURIComponent(slug)}/posts/${encodeURIComponent(draggableId)}/status`,
          { method: "PATCH", body: JSON.stringify({ board_status: destCol }) }
        );
      } catch {
        setActionError("Could not update column. Reverted.");
        if (previousSnapshot) setKanbanColumns(previousSnapshot);
        else void loadKanban();
      } finally {
        setStatusUpdatingId(null);
      }
    },
    [slug, loadKanban]
  );

  const workspaceLabel = useMemo(() => {
    if (!slug) return "";
    const w = workspaces.find((x) => x.slug === slug);
    return w ? w.name : slug;
  }, [slug, workspaces]);

  if (!slug) {
    return <p className="text-muted-foreground text-sm">Missing workspace slug.</p>;
  }

  if (sessionLoading || (user && access === "unknown")) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (!user || access === "no_session") {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-card p-6">
        <h1 className="text-lg font-semibold">Command center</h1>
        <p className="text-muted-foreground text-sm">
          Sign in as a workspace owner or admin to open the command center.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/">Back to home</Link>
        </Button>
      </div>
    );
  }

  if (!isMember) {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-card p-6">
        <h1 className="text-lg font-semibold">Command center</h1>
        <p className="text-muted-foreground text-sm">You are not a member of this workspace.</p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/">Back to home</Link>
        </Button>
      </div>
    );
  }

  if (access === "forbidden") {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-card p-6">
        <h1 className="text-lg font-semibold">Command center</h1>
        <p className="text-muted-foreground text-sm" role="alert">
          Only workspace owners and admins can use the command center.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/${encodeURIComponent(slug)}`}>Back to board</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Command center</h1>
          <p className="text-muted-foreground text-sm">
            <span className="font-mono text-foreground">{slug}</span>
            {workspaceLabel ? (
              <span className="text-foreground"> · {workspaceLabel}</span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to={`/${encodeURIComponent(slug)}`}>View as public</Link>
          </Button>
        </div>
      </div>

      <div className="flex rounded-lg border p-0.5 w-fit flex-wrap gap-0.5">
        {(
          [
            ["triage", "Triage"],
            ["kanban", "Kanban"],
            ["settings", "Settings"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            variant={tab === value ? "default" : "ghost"}
            size="sm"
            className="h-7 rounded-md px-2.5"
            onClick={() => setTab(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {listError ? (
        <p className="text-destructive text-sm" role="alert">
          {listError}
        </p>
      ) : null}
      {actionError ? (
        <p className="text-destructive text-sm" role="alert">
          {actionError}
        </p>
      ) : null}

      {tab === "settings" ? (
        <div className="max-w-md space-y-6">
        <div className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-xs">
          <div>
            <h2 className="text-base font-semibold">Workspace settings</h2>
            <p className="mt-1 text-muted-foreground text-sm">
              Changes apply to this workspace only. Stay on this tab after saving.
            </p>
          </div>

          {!canEditWorkspaceSettings ? (
            <p className="text-muted-foreground text-sm" role="status">
              Only the workspace owner can change these settings. Admins can use Triage and Kanban.
            </p>
          ) : null}

          {settingsDraft ? (
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                void saveWorkspaceSettings();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="ws-slug">URL slug</Label>
                <Input id="ws-slug" value={slug} readOnly disabled className="font-mono bg-muted/50" />
                <p className="text-muted-foreground text-xs">
                  Slug is fixed so existing links keep working.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ws-name">Workspace name</Label>
                <Input
                  id="ws-name"
                  value={settingsDraft.name}
                  onChange={(e) =>
                    setSettingsDraft((d) => (d ? { ...d, name: e.target.value } : d))
                  }
                  required
                  disabled={!canEditWorkspaceSettings}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ws-visibility">Visibility</Label>
                <select
                  id="ws-visibility"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={settingsDraft.visibility}
                  onChange={(e) =>
                    setSettingsDraft((d) =>
                      d
                        ? {
                            ...d,
                            visibility: e.target.value as "public" | "invite_only",
                          }
                        : d
                    )
                  }
                  disabled={!canEditWorkspaceSettings}
                >
                  <option value="public">Public — anyone with the link can view and submit</option>
                  <option value="invite_only">Invite only — members only</option>
                </select>
              </div>

              <div className="space-y-3 rounded-md border border-border p-4">
                <div className="flex items-start gap-3">
                  <input
                    id="ws-require-approval"
                    type="checkbox"
                    className="mt-1 size-4 rounded border-input"
                    checked={settingsDraft.requireApproval}
                    onChange={(e) =>
                      setSettingsDraft((d) =>
                        d ? { ...d, requireApproval: e.target.checked } : d
                      )
                    }
                    disabled={!canEditWorkspaceSettings}
                  />
                  <div className="min-w-0 space-y-1">
                    <Label htmlFor="ws-require-approval" className="cursor-pointer">
                      Require approval for new posts
                    </Label>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {settingsDraft.requireApproval
                        ? "New posts require approval before appearing on the board."
                        : "New posts appear immediately. Use triage to remove spam after the fact."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ws-primary">Primary color</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="ws-primary"
                    type="text"
                    placeholder="#0F172A"
                    value={settingsDraft.primaryColor}
                    onChange={(e) =>
                      setSettingsDraft((d) => (d ? { ...d, primaryColor: e.target.value } : d))
                    }
                    className="max-w-36 font-mono"
                    disabled={!canEditWorkspaceSettings}
                  />
                  <input
                    type="color"
                    aria-label="Pick primary color"
                    className="h-9 w-14 cursor-pointer rounded-md border border-input bg-background p-1 disabled:opacity-50"
                    value={
                      /^#[0-9A-Fa-f]{6}$/.test(settingsDraft.primaryColor.trim())
                        ? settingsDraft.primaryColor.trim()
                        : "#0F172A"
                    }
                    onChange={(e) =>
                      setSettingsDraft((d) => (d ? { ...d, primaryColor: e.target.value } : d))
                    }
                    disabled={!canEditWorkspaceSettings}
                  />
                </div>
              </div>

              {settingsFeedback ? (
                <p
                  className={
                    settingsFeedback.kind === "ok"
                      ? "text-sm text-emerald-600 dark:text-emerald-400"
                      : "text-destructive text-sm"
                  }
                  role={settingsFeedback.kind === "err" ? "alert" : "status"}
                >
                  {settingsFeedback.text}
                </p>
              ) : null}

              <Button type="submit" disabled={!canEditWorkspaceSettings || settingsSaving}>
                {settingsSaving ? "Saving…" : "Save settings"}
              </Button>
            </form>
          ) : (
            <p className="text-muted-foreground text-sm">Loading workspace…</p>
          )}
        </div>

        {canInviteMembers ? (
          <div className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-xs">
            <div>
              <h2 className="text-base font-semibold">Invite member</h2>
              <p className="mt-1 text-muted-foreground text-sm">
                Add someone by email. If they do not have a LoopIn account yet, they will join this
                workspace when they first sign in with this email.
              </p>
            </div>
            <form className="space-y-4" onSubmit={(ev) => void submitMemberInvite(ev)}>
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  autoComplete="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={(ev) => setInviteEmail(ev.target.value)}
                  disabled={inviteSubmitting}
                />
              </div>
              {inviteFeedback ? (
                <p
                  className={
                    inviteFeedback.kind === "ok"
                      ? "text-sm text-emerald-600 dark:text-emerald-400"
                      : "text-destructive text-sm"
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
          </div>
        ) : null}
        </div>
      ) : tab === "triage" ? (
        triageLoading ? (
          <p className="text-muted-foreground text-sm">Loading triage…</p>
        ) : triagePosts.length === 0 ? (
          <p className="text-muted-foreground text-sm">No posts waiting for review.</p>
        ) : (
          <ul className="space-y-3">
            {triagePosts.map((post) => (
              <li
                key={post.id}
                className="rounded-lg border border-border bg-card p-4 shadow-xs"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {formatCategory(post.category)}
                      </span>
                      <Link
                        to={`/${encodeURIComponent(slug)}/post/${encodeURIComponent(post.id)}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Open thread
                      </Link>
                    </div>
                    <h2 className="text-base font-semibold leading-snug">{post.title}</h2>
                    {post.description ? (
                      <p className="text-muted-foreground line-clamp-3 text-sm whitespace-pre-wrap">
                        {post.description}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {post.author.name} · {new Date(post.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={moderatingId === post.id}
                      onClick={() => void moderate(post.id, "approved")}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={moderatingId === post.id}
                      onClick={() => void moderate(post.id, "rejected")}
                    >
                      Reject
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={moderatingId === post.id}
                      onClick={() => void moderate(post.id, "spam")}
                    >
                      Spam
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : kanbanLoading ? (
        <p className="text-muted-foreground text-sm">Loading Kanban…</p>
      ) : (
        <DragDropContext onDragEnd={(r) => void onKanbanDragEnd(r)}>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {BOARD_COLUMNS.map((col) => (
              <div key={col.id} className="w-64 shrink-0">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {col.label}
                </h3>
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[120px] rounded-lg border border-dashed p-2 transition-colors ${
                        snapshot.isDraggingOver ? "border-primary/50 bg-primary/5" : "border-border"
                      }`}
                    >
                      {kanbanColumns[col.id].map((post, index) => (
                        <Draggable key={post.id} draggableId={post.id} index={index}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={`mb-2 rounded-md border bg-card p-2 text-sm shadow-xs ${
                                dragSnapshot.isDragging ? "ring-2 ring-primary/30" : ""
                              } ${statusUpdatingId === post.id ? "opacity-60" : ""}`}
                            >
                              <Link
                                to={`/${encodeURIComponent(slug)}/post/${encodeURIComponent(post.id)}`}
                                className="font-medium text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {post.title}
                              </Link>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatCategory(post.category)} · {post.upvoteCount} upvotes
                              </p>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      )}
    </div>
  );
}
