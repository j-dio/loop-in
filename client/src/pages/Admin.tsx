import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { type DropResult } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { TriageInbox } from "@/components/admin/TriageInbox";
import { KanbanBoard, type ColumnsState, type BoardColumnId } from "@/components/admin/KanbanBoard";
import { AiDigestPanel, type DigestData } from "@/components/admin/AiDigestPanel";
import { WorkspaceSettings, type SettingsDraft } from "@/components/admin/WorkspaceSettings";
import { WorkspaceLogoSection } from "@/components/admin/WorkspaceLogoSection";
import { MembersPanel, type InviteRole } from "@/components/admin/MembersPanel";
import { AnnouncementsManager } from "@/components/admin/AnnouncementsManager";
import { ProfileFieldsForm } from "@/components/admin/ProfileFieldsForm";
import { ScreenshotManager } from "@/components/admin/ScreenshotManager";
import { LinksManager } from "@/components/admin/LinksManager";
import { useWorkspace } from "@/context/WorkspaceContext";
import { ApiError, apiFetch, deleteWorkspace, updateWorkspace } from "@/lib/api";
import type { PostDTO } from "@/lib/postTypes";

type WorkspaceRole = "owner" | "admin" | "member";

type MemberRow = {
  userId: string;
  email: string;
  name: string | null;
  role: WorkspaceRole;
  joinedAt: string;
};

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

function errorTextFromApiBody(e: unknown, fallback: string): string {
  if (e instanceof ApiError && typeof e.body === "object" && e.body && "error" in e.body) {
    return String((e.body as { error: string }).error);
  }
  return fallback;
}

type PostMemberInviteResponse =
  | { member: MemberRow }
  | { pending: true; email: string };

type AdminSection = "triage" | "kanban" | "updates" | "settings" | "profile";

const SECTION_LABELS: Record<AdminSection, string> = {
  triage: "Triage",
  kanban: "Board",
  updates: "Updates",
  settings: "Settings",
  profile: "Profile",
};

const VALID_SECTIONS = ["triage", "kanban", "updates", "settings", "profile"] as const;

export function Admin() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const raw = searchParams.get("section");
  const section: AdminSection = VALID_SECTIONS.includes(raw as AdminSection) ? (raw as AdminSection) : "triage";
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
  const [triagePosts, setTriagePosts] = useState<PostDTO[]>([]);
  const [kanbanColumns, setKanbanColumns] = useState<ColumnsState>(() => emptyColumns());
  const [triageLoading, setTriageLoading] = useState(false);
  const [kanbanLoading, setKanbanLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  const [digestData, setDigestData] = useState<DigestData | null>(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [digestError, setDigestError] = useState<string | null>(null);

  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null
  );
  const settingsDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canEditWorkspaceSettings = commandCenterRole === "owner";
  const canInviteMembers =
    commandCenterRole === "admin" || commandCenterRole === "owner";

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<{ id: string; email: string; inviterName: string; expiresAt: string }[]>([]);
  const [cancellingInviteId, setCancellingInviteId] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("admin");
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
      setMembers(data.members);
      setAccess("allowed");
      // Fetch pending invites in parallel (non-fatal)
      apiFetch<{ invites: { id: string; email: string; inviterName: string; expiresAt: string }[] }>(
        `/api/workspaces/${encodeURIComponent(slug)}/invites`
      )
        .then((d) => setPendingInvites(d.invites))
        .catch(() => { /* not critical */ });
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

  const generateAiDigest = useCallback(async () => {
    if (!slug) return;
    setDigestLoading(true);
    setDigestError(null);
    try {
      const data = await apiFetch<{ digest: DigestData }>(
        `/api/workspaces/${encodeURIComponent(slug)}/ai/digest`,
        { method: "POST" }
      );
      setDigestData(data.digest);
    } catch (e) {
      if (e instanceof ApiError) {
        const msg =
          typeof e.body === "object" && e.body && "error" in e.body
            ? String((e.body as { error: string }).error)
            : e.status === 503
              ? "AI features are not configured on this server."
              : "Could not generate digest. Please try again.";
        setDigestError(msg);
      } else {
        setDigestError("Could not generate digest. Please try again.");
      }
    } finally {
      setDigestLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (access !== "allowed" || !slug) return;
    if (section === "triage") void loadTriage();
    else if (section === "kanban") void loadKanban();
  }, [access, slug, section, loadTriage, loadKanban]);

  useEffect(() => {
    if (section !== "settings" || !slug) return;
    const w = workspaces.find((x) => x.slug === slug);
    if (!w) return;
    setSettingsDraft({
      name: w.name,
      visibility: w.visibility,
      requireApproval: w.requireApproval,
    });
  }, [section, slug, workspaces]);

  useEffect(() => {
    setSettingsFeedback(null);
  }, [section, slug]);

  async function saveWorkspaceSettings() {
    if (!slug || !settingsDraft || !canEditWorkspaceSettings) return;
    const name = settingsDraft.name.trim();
    if (!name) {
      setSettingsFeedback({ kind: "err", text: "Workspace name is required." });
      return;
    }
    setSettingsSaving(true);
    setSettingsFeedback(null);
    try {
      await updateWorkspace(slug, {
        name,
        visibility: settingsDraft.visibility,
        require_approval: settingsDraft.requireApproval,
      });
      await refreshSession();
      if (settingsDismissRef.current) clearTimeout(settingsDismissRef.current);
      setSettingsFeedback({ kind: "ok", text: "Settings saved." });
      settingsDismissRef.current = setTimeout(() => setSettingsFeedback(null), 4000);
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

  async function handleDeleteWorkspace() {
    if (!slug) return;
    setDeletingWorkspace(true);
    try {
      await deleteWorkspace(slug);
      await refreshSession();
      navigate("/home");
    } catch (e) {
      setSettingsFeedback({
        kind: "err",
        text: errorTextFromApiBody(e, "Could not delete workspace."),
      });
    } finally {
      setDeletingWorkspace(false);
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
        { method: "POST", body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }) }
      );
      if ("pending" in data && data.pending) {
        setInviteFeedback({
          kind: "ok",
          text: "Invite email sent. They'll join when they accept.",
        });
        // Refresh pending invites list
        apiFetch<{ invites: { id: string; email: string; inviterName: string; expiresAt: string }[] }>(
          `/api/workspaces/${encodeURIComponent(slug)}/invites`
        )
          .then((d) => setPendingInvites(d.invites))
          .catch(() => { /* non-fatal */ });
      } else {
        setInviteFeedback({ kind: "ok", text: "Member added successfully." });
        const freshData = await apiFetch<{ members: MemberRow[] }>(
          `/api/workspaces/${encodeURIComponent(slug)}/members`
        );
        setMembers(freshData.members);
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

  async function removeMember(userId: string) {
    if (!slug) return;
    setRemovingId(userId);
    try {
      await apiFetch(`/api/workspaces/${encodeURIComponent(slug)}/members/${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch (err) {
      setInviteFeedback({
        kind: "err",
        text: errorTextFromApiBody(err, "Could not remove member."),
      });
    } finally {
      setRemovingId(null);
    }
  }

  async function cancelInvite(inviteId: string) {
    if (!slug) return;
    setCancellingInviteId(inviteId);
    try {
      await apiFetch(`/api/workspaces/${encodeURIComponent(slug)}/invites/${encodeURIComponent(inviteId)}`, {
        method: "DELETE",
      });
      setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (err) {
      setInviteFeedback({ kind: "err", text: errorTextFromApiBody(err, "Could not cancel invite.") });
    } finally {
      setCancellingInviteId(null);
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

  async function moderateMany(
    ids: string[],
    moderation_status: "approved" | "spam" | "rejected"
  ): Promise<{ failed: string[] }> {
    if (!slug) return { failed: ids };
    const failed: string[] = [];
    for (const postId of ids) {
      setModeratingId(postId);
      try {
        await apiFetch<{ post: PostDTO }>(
          `/api/workspaces/${encodeURIComponent(slug)}/posts/${encodeURIComponent(postId)}/moderate`,
          { method: "PATCH", body: JSON.stringify({ moderation_status }) }
        );
        setTriagePosts((prev) => prev.filter((p) => p.id !== postId));
      } catch {
        failed.push(postId);
      }
    }
    setModeratingId(null);
    setActionError(failed.length > 0 ? `${failed.length} of ${ids.length} could not be moderated.` : null);
    await loadKanban(); // reload ONCE after the batch
    return { failed };
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
      <PageHeader
        eyebrow={SECTION_LABELS[section] ?? "Admin"}
        title={workspaceLabel || "Command center"}
        meta={<><span>/{slug}</span></>}
        actions={
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to={`/${encodeURIComponent(slug)}`}>View public board</Link>
          </Button>
        }
      />

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

      {section === "settings" ? (
        <div className="max-w-2xl space-y-8">
          <WorkspaceSettings
            draft={settingsDraft}
            slug={slug}
            canEdit={canEditWorkspaceSettings}
            saving={settingsSaving}
            feedback={settingsFeedback}
            onChange={(patch) => setSettingsDraft((d) => (d ? { ...d, ...patch } : d))}
            onSubmit={() => void saveWorkspaceSettings()}
            onDelete={canEditWorkspaceSettings ? () => handleDeleteWorkspace() : undefined}
            deleting={deletingWorkspace}
          />
          <WorkspaceLogoSection canManage={canInviteMembers} />
          {canInviteMembers ? (
            <MembersPanel
              members={members}
              pendingInvites={pendingInvites}
              currentUserId={user?.id ?? ""}
              canInvite={canInviteMembers}
              removingId={removingId}
              cancellingInviteId={cancellingInviteId}
              inviteEmail={inviteEmail}
              inviteRole={inviteRole}
              inviteSubmitting={inviteSubmitting}
              inviteFeedback={inviteFeedback}
              onRemove={(userId) => void removeMember(userId)}
              onCancelInvite={(inviteId) => void cancelInvite(inviteId)}
              onInviteEmailChange={setInviteEmail}
              onInviteRoleChange={setInviteRole}
              onSubmitInvite={(ev) => void submitMemberInvite(ev)}
            />
          ) : null}
        </div>
      ) : section === "profile" ? (
        <div className="max-w-2xl">
          <ProfileFieldsForm slug={slug} canEdit={canEditWorkspaceSettings} />
          <ScreenshotManager slug={slug} />
          <LinksManager slug={slug} />
        </div>
      ) : section === "triage" ? (
        <TriageInbox
          posts={triagePosts}
          slug={slug}
          loading={triageLoading}
          moderatingId={moderatingId}
          requireApproval={activeWorkspace?.requireApproval ?? true}
          onModerate={moderate}
          onBulkModerate={moderateMany}
        />
      ) : section === "updates" ? (
        <AnnouncementsManager slug={slug} />
      ) : (
        <div className="space-y-4">
          <AiDigestPanel
            digest={digestData}
            loading={digestLoading}
            error={digestError}
            disabled={kanbanLoading}
            onGenerate={() => void generateAiDigest()}
          />
          <KanbanBoard
            columns={kanbanColumns}
            slug={slug}
            loading={kanbanLoading}
            statusUpdatingId={statusUpdatingId}
            onDragEnd={(r) => void onKanbanDragEnd(r)}
          />
        </div>
      )}
    </div>
  );
}
