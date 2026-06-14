import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "@/context/WorkspaceContext";

export function AuthCallback() {
  const navigate = useNavigate();
  const { refreshSession } = useWorkspace();

  useEffect(() => {
    void refreshSession().then(() => {
      const pendingToken = sessionStorage.getItem("pending-invite-token");
      if (pendingToken) {
        navigate(`/invite/accept?token=${encodeURIComponent(pendingToken)}`, { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    });
  }, [navigate, refreshSession]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-4">
      <p className="text-sm text-muted-foreground">Finishing sign-in…</p>
    </div>
  );
}
