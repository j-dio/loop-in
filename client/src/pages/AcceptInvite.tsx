import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, apiFetch, getApiBase } from "@/lib/api";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { GoogleIcon, GithubIcon } from "@/components/brand/AuthIcons";

type InviteInfo = {
  workspaceName: string;
  workspaceSlug: string;
  inviterName: string;
  email: string;
  expiresAt: string;
};

type PageState =
  | { status: "loading" }
  | { status: "loaded"; info: InviteInfo }
  | { status: "not_found" }
  | { status: "expired" }
  | { status: "error"; message: string }
  | { status: "accepting" }
  | { status: "done"; workspaceSlug: string; workspaceName: string }
  | { status: "already_member"; workspaceSlug: string };

export function AcceptInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshSession } = useWorkspace();
  const token = params.get("token") ?? "";
  const api = getApiBase();

  const [state, setState] = useState<PageState>({ status: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ status: "not_found" });
      return;
    }

    apiFetch<{ invite: InviteInfo }>(`/api/workspaces/invites/${encodeURIComponent(token)}`)
      .then((data) => setState({ status: "loaded", info: data.invite }))
      .catch((err: unknown) => {
        if (err instanceof ApiError) {
          if (err.status === 404) setState({ status: "not_found" });
          else if (err.status === 410) setState({ status: "expired" });
          else setState({ status: "error", message: "Failed to load invite." });
        } else {
          setState({ status: "error", message: "Failed to load invite." });
        }
      });
  }, [token]);

  async function handleAccept() {
    setState({ status: "accepting" });
    try {
      const data = await apiFetch<{ workspaceSlug: string; workspaceName: string }>(
        "/api/workspaces/invites/accept",
        { method: "POST", body: JSON.stringify({ token }) }
      );
      await refreshSession();
      setState({ status: "done", workspaceSlug: data.workspaceSlug, workspaceName: data.workspaceName });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          const info = state.status === "loaded" ? state.info : null;
          setState({ status: "already_member", workspaceSlug: info?.workspaceSlug ?? "" });
        } else if (err.status === 403) {
          setState({ status: "error", message: "This invite was sent to a different email address." });
        } else if (err.status === 410) {
          setState({ status: "expired" });
        } else {
          setState({ status: "error", message: "Failed to accept invite. Please try again." });
        }
      } else {
        setState({ status: "error", message: "Failed to accept invite. Please try again." });
      }
    }
  }

  function handleSignIn() {
    // Store token so user can return after OAuth
    sessionStorage.setItem("pending-invite-token", token);
    window.location.href = `${api}/auth/google`;
  }

  // After accepting, auto-navigate to the workspace
  useEffect(() => {
    if (state.status === "done") {
      const timer = setTimeout(() => navigate(`/${state.workspaceSlug}`), 1500);
      return () => clearTimeout(timer);
    }
  }, [state, navigate]);

  // If user just signed in and there's a stored invite token, redirect back
  useEffect(() => {
    if (user) {
      const stored = sessionStorage.getItem("pending-invite-token");
      if (stored && stored === token) {
        sessionStorage.removeItem("pending-invite-token");
      }
    }
  }, [user, token]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 py-12">
      <Logo size="lg" />
      <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-8 text-center">
        {state.status === "loading" && (
          <p className="text-sm text-muted-foreground">Loading invite…</p>
        )}

        {state.status === "loaded" && (
          <>
            <div className="space-y-2">
              <h1 className="font-display font-semibold text-2xl tracking-tight">You're invited!</h1>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{state.info.inviterName}</span> invited
                you to join{" "}
                <span className="font-medium text-foreground">{state.info.workspaceName}</span>.
              </p>
              {user && user.email !== state.info.email && (
                <p className="mt-2 rounded-lg border border-brand/30 bg-brand-bright/10 p-2 text-xs text-brand">
                  This invite was sent to <strong>{state.info.email}</strong>, but you're signed in as{" "}
                  <strong>{user.email}</strong>. Accepting will fail if the emails don't match.
                </p>
              )}
            </div>

            {user ? (
              <div className="space-y-3">
                <Button variant="brand" onClick={handleAccept} className="w-full">
                  Join {state.info.workspaceName}
                </Button>
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Not now — go home
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Sign in to accept this invite.</p>
                <Button variant="brand" onClick={handleSignIn} className="w-full">
                  <GoogleIcon className="size-4" />
                  Continue with Google
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    window.location.href = `${api}/auth/github`;
                  }}
                >
                  <GithubIcon className="size-4" />
                  Continue with GitHub
                </Button>
              </div>
            )}
          </>
        )}

        {state.status === "accepting" && (
          <p className="text-sm text-muted-foreground">Joining workspace…</p>
        )}

        {state.status === "done" && (
          <>
            <h1 className="font-display font-semibold text-2xl tracking-tight">You're in!</h1>
            <p className="text-sm text-muted-foreground">
              Welcome to {state.workspaceName}. Redirecting…
            </p>
          </>
        )}

        {state.status === "already_member" && (
          <>
            <h1 className="font-display font-semibold text-xl tracking-tight">Already a member</h1>
            <p className="text-sm text-muted-foreground">You're already in this workspace.</p>
            {state.workspaceSlug && (
              <Button variant="brand" onClick={() => navigate(`/${state.workspaceSlug}`)} className="w-full">
                Go to workspace
              </Button>
            )}
          </>
        )}

        {state.status === "not_found" && (
          <>
            <h1 className="font-display font-semibold text-xl tracking-tight">Invite not found</h1>
            <p className="text-sm text-muted-foreground">
              This invite link is invalid or has already been used.
            </p>
            <Button variant="outline" onClick={() => navigate("/")} className="w-full">
              Go home
            </Button>
          </>
        )}

        {state.status === "expired" && (
          <>
            <h1 className="font-display font-semibold text-xl tracking-tight">Invite expired</h1>
            <p className="text-sm text-muted-foreground">
              This invite link has expired. Ask the workspace admin to send a new one.
            </p>
            <Button variant="outline" onClick={() => navigate("/")} className="w-full">
              Go home
            </Button>
          </>
        )}

        {state.status === "error" && (
          <>
            <h1 className="font-display font-semibold text-xl tracking-tight">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">{state.message}</p>
            <Button variant="outline" onClick={() => navigate("/")} className="w-full">
              Go home
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
