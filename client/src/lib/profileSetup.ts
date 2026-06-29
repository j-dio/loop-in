import type { WorkspaceProfileDTO } from "./profileTypes";

type FlagKind = "share" | "dismiss";

const STORAGE_PREFIX = "loopin-setup";

function flagKey(kind: FlagKind, slug: string): string {
  return `${STORAGE_PREFIX}-${kind}-${slug}`;
}

/** Read a UI flag. Safe in any environment — returns false if storage is unavailable. */
export function getFlag(kind: FlagKind, slug: string): boolean {
  try {
    return localStorage.getItem(flagKey(kind, slug)) === "1";
  } catch {
    return false;
  }
}

/** Persist a UI flag. Silent no-op if storage is unavailable. */
export function setFlag(kind: FlagKind, slug: string): void {
  try {
    localStorage.setItem(flagKey(kind, slug), "1");
  } catch {
    /* storage unavailable (private mode / disabled) — no-op */
  }
}

export type SetupStepId = "website" | "screenshots" | "description" | "logo" | "share";

export interface SetupStep {
  id: SetupStepId;
  label: string;
  done: boolean;
  optional: boolean;
  href?: string;
  action?: "share";
}

export interface SetupState {
  steps: SetupStep[];
  requiredDone: number;
  requiredTotal: number;
  allRequiredDone: boolean;
  showCard: boolean;
}

export function computeSetup(
  profile: WorkspaceProfileDTO,
  slug: string,
  canSetup: boolean,
): SetupState {
  const { workspace: w, screenshots, links } = profile;
  const adminProfile = `/${slug}/admin?section=profile`;
  const adminSettings = `/${slug}/admin?section=settings`;

  // Tagline is intentionally absent: it is required at creation, so it would always render
  // pre-checked and never be actionable. The real deferred profile fields are website, screenshots,
  // and description. `logo` (optional) and `share` (a one-time action) are shown but never counted
  // toward completion — sharing is not "setup", and gating completion on it strands builders who
  // simply don't want to share.
  const steps: SetupStep[] = [
    {
      id: "website",
      label: "Add your website & links",
      done: !!w.websiteUrl || links.length > 0,
      optional: false,
      href: adminProfile,
    },
    {
      id: "screenshots",
      label: "Upload screenshots",
      done: screenshots.length > 0,
      optional: false,
      href: adminProfile,
    },
    {
      id: "description",
      label: "Write a description",
      done: !!w.description && w.description.trim().length > 0,
      optional: false,
      href: adminProfile,
    },
    {
      id: "logo",
      label: "Add a logo",
      done: !!w.logoUrl,
      optional: true,
      href: adminSettings,
    },
    {
      id: "share",
      label: "Share your board",
      done: getFlag("share", slug),
      optional: false,
      action: "share",
    },
  ];

  // Counted = required field steps only: not optional (logo) and not an action (share).
  const required = steps.filter((s) => !s.optional && !s.action);
  const requiredDone = required.filter((s) => s.done).length;
  const requiredTotal = required.length;
  const allRequiredDone = requiredDone === requiredTotal;
  const showCard = canSetup && !getFlag("dismiss", slug) && !allRequiredDone;

  return { steps, requiredDone, requiredTotal, allRequiredDone, showCard };
}
