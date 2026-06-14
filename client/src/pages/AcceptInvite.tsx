import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, apiFetch, getApiBase } from "@/lib/api";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Button } from "@/components/ui/button";

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-xl shadow-md p-8 max-width-sm w-full max-w-md text-center space-y-4">
        {state.status === "loading" && (
          <p className="text-gray-500">Loading invite...</p>
        )}

        {state.status === "loaded" && (
          <>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-gray-900">You're invited!</h1>
              <p className="text-gray-600">
                <span className="font-medium">{state.info.inviterName}</span> invited you to join{" "}
                <span className="font-medium">{state.info.workspaceName}</span>.
              </p>
              {user && user.email !== state.info.email && (
                <p className="text-sm text-amber-600 mt-2">
                  Note: This invite was sent to <strong>{state.info.email}</strong>, but you're signed in as <strong>{user.email}</strong>. Accepting will fail if the emails don't match.
                </p>
              )}
            </div>

            {user ? (
              <Button onClick={handleAccept} className="w-full">
                Join {state.info.workspaceName}
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-500">Sign in to accept this invite.</p>
                <Button onClick={handleSignIn} className="w-full">
                  Sign in with Google
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => { window.location.href = `${api}/auth/github`; }}
                >
                  Sign in with GitHub
                </Button>
              </div>
            )}
          </>
        )}

        {state.status === "accepting" && (
          <p className="text-gray-500">Joining workspace...</p>
        )}

        {state.status === "done" && (
          <>
            <h1 className="text-2xl font-bold text-gray-900">You're in!</h1>
            <p className="text-gray-600">Welcome to {state.workspaceName}. Redirecting...</p>
          </>
        )}

        {state.status === "already_member" && (
          <>
            <h1 className="text-xl font-bold text-gray-900">Already a member</h1>
            <p className="text-gray-600">You're already in this workspace.</p>
            {state.workspaceSlug && (
              <Button onClick={() => navigate(`/${state.workspaceSlug}`)} className="w-full">
                Go to Workspace
              </Button>
            )}
          </>
        )}

        {state.status === "not_found" && (
          <>
            <h1 className="text-xl font-bold text-gray-900">Invite not found</h1>
            <p className="text-gray-600">This invite link is invalid or has already been used.</p>
            <Button variant="outline" onClick={() => navigate("/")} className="w-full">
              Go Home
            </Button>
          </>
        )}

        {state.status === "expired" && (
          <>
            <h1 className="text-xl font-bold text-gray-900">Invite expired</h1>
            <p className="text-gray-600">This invite link has expired. Ask the workspace admin to send a new one.</p>
            <Button variant="outline" onClick={() => navigate("/")} className="w-full">
              Go Home
            </Button>
          </>
        )}

        {state.status === "error" && (
          <>
            <h1 className="text-xl font-bold text-gray-900">Something went wrong</h1>
            <p className="text-gray-600">{state.message}</p>
            <Button variant="outline" onClick={() => navigate("/")} className="w-full">
              Go Home
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
