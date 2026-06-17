import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useWorkspace } from "@/context/WorkspaceContext";
import { LoopMark } from "@/components/brand/Logo";

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
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
      >
        <LoopMark className="size-9" />
      </motion.div>
      <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
        Finishing sign-in…
      </p>
    </div>
  );
}
