import { Navigate } from "react-router-dom";
import { motion, MotionConfig } from "framer-motion";
import { useWorkspace } from "@/context/WorkspaceContext";
import { getApiBase } from "@/lib/api";
import { LoopMark } from "@/components/brand/Logo";
import { Hero } from "@/components/landing/Hero";
import { LandingMarketing } from "@/components/landing/LandingMarketing";
import { CursorFollower } from "@/components/landing/CursorFollower";
import { SmoothScrollProvider, useSmoothScroll } from "@/lib/lenis";

/**
 * Logged-out marketing site. Lives inside SmoothScrollProvider so the hero CTAs
 * and nav anchors scroll through Lenis (momentum) rather than jumping.
 */
function LoggedOutMarketing({ api }: { api: string }) {
  const scrollTo = useSmoothScroll();
  return (
    <>
      <Hero onPrimary={() => scrollTo("#start")} />
      <LandingMarketing googleHref={`${api}/auth/google`} githubHref={`${api}/auth/github`} />
    </>
  );
}

export function Landing() {
  const { user, loading } = useWorkspace();
  const api = getApiBase();

  // ---- Loading ---------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        >
          <LoopMark className="size-9" />
        </motion.div>
        <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
          Loading…
        </p>
      </div>
    );
  }

  // ---- Logged out: marketing site -------------------------------------------
  if (!user) {
    return (
      <MotionConfig reducedMotion="user">
        <SmoothScrollProvider>
          {/* `.landing` scopes the stark monochrome theme to the marketing page */}
          <div className="landing min-h-dvh bg-background">
            <CursorFollower />
            <LoggedOutMarketing api={api} />
          </div>
        </SmoothScrollProvider>
      </MotionConfig>
    );
  }

  // ---- Logged in: redirect to Home feed ------------------------------------
  return <Navigate to="/home" replace />;
}
