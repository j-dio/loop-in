import { Navigate, useLocation } from "react-router-dom";
import { useWorkspace } from "@/context/WorkspaceContext";

/** Redirects brand-new users (null onboarding state) to /welcome. Renders nothing otherwise. */
export function OnboardingGate() {
  const { user, loading } = useWorkspace();
  const location = useLocation();

  if (loading || !user) return null;
  if (user.onboardingCompletedAt !== null) return null;
  if (location.pathname === "/welcome") return null;

  return <Navigate to="/welcome" replace />;
}
