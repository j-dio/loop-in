import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Compass, Hammer } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useWorkspace } from "@/context/WorkspaceContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/brand/Logo";
import { AppCard, type AppCardWorkspace } from "@/components/feed/AppCard";
import { SkeletonAppCard } from "@/components/feed/FeedSkeletons";
import { CreateAppWizard } from "@/components/CreateAppWizard";
import { Button } from "@/components/ui/button";
import { fadeUp, staggerContainer } from "@/lib/motion";

type Stage = "fork" | "follow";

export function Welcome() {
  const navigate = useNavigate();
  const { user, loading, completeOnboarding } = useWorkspace();
  const [stage, setStage] = useState<Stage>("fork");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Follow stage state
  const [workspaces, setWorkspaces] = useState<AppCardWorkspace[]>([]);
  const [followLoading, setFollowLoading] = useState(false);

  // Fetch suggested apps when entering the follow stage
  useEffect(() => {
    if (stage !== "follow") return;
    let cancelled = false;
    void (async () => {
      setFollowLoading(true);
      try {
        const data = await apiFetch<{ workspaces: AppCardWorkspace[] }>(
          "/api/explore/workspaces?sort=active&limit=12"
        );
        if (!cancelled) setWorkspaces(data.workspaces);
      } catch {
        if (!cancelled) setWorkspaces([]);
      } finally {
        if (!cancelled) setFollowLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stage]);

  if (loading) return null;
  // Redirect declaratively — never call navigate() during render.
  if (!user) return <Navigate to="/" replace />;

  async function finish() {
    if (finishing) return;
    setFinishing(true);
    try {
      await completeOnboarding();
    } catch {
      // best-effort — navigate anyway
    }
    navigate("/home");
  }

  function handleFollowChange(
    slug: string,
    data: { following: boolean; followerCount: number }
  ) {
    setWorkspaces((prev) =>
      prev.map((w) =>
        w.slug === slug
          ? { ...w, isFollowing: data.following, followerCount: data.followerCount }
          : w
      )
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* Minimal top bar — brand mark + theme only, no app nav (focused first run) */}
      <header className="flex h-14 items-center justify-between border-b border-border px-5 sm:px-8">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-5 py-14 sm:px-8">
        {stage === "fork" && (
          <ForkStage
            onFollowDiscover={() => setStage("follow")}
            onBuildApp={() => setWizardOpen(true)}
            onSkip={finish}
            finishing={finishing}
          />
        )}

        {stage === "follow" && (
          <FollowStage
            workspaces={workspaces}
            loading={followLoading}
            onFollowChange={handleFollowChange}
            onBack={() => setStage("fork")}
            onDone={finish}
            finishing={finishing}
          />
        )}
      </main>

      <CreateAppWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fork stage
// ---------------------------------------------------------------------------

function ForkStage({
  onFollowDiscover,
  onBuildApp,
  onSkip,
  finishing,
}: {
  onFollowDiscover: () => void;
  onBuildApp: () => void;
  onSkip: () => void;
  finishing: boolean;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={staggerContainer(0.1)}
      className="w-full max-w-xl space-y-10"
    >
      <motion.div variants={fadeUp} className="space-y-3 text-center">
        <p className="font-mono text-xs tracking-[0.22em] text-brand uppercase">Get started</p>
        <h1 className="font-display text-[clamp(2rem,5vw,2.75rem)] leading-[1.02] font-semibold tracking-[-0.02em]">
          Welcome to Loop In
        </h1>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
          Two ways in. Follow the apps you use and never miss an update, or open a board and start
          collecting feedback. You can do both later — pick where to start.
        </p>
      </motion.div>

      <motion.div variants={fadeUp} className="grid gap-4 sm:grid-cols-2">
        <ChoiceCard
          icon={<Compass className="size-6" />}
          eyebrow="Follower"
          title="Follow & discover"
          description="Browse what people are building and follow the apps that matter to you."
          onClick={onFollowDiscover}
        />
        <ChoiceCard
          icon={<Hammer className="size-6" />}
          eyebrow="Builder"
          title="I'm building an app"
          description="Spin up a public feedback board for your project in under a minute."
          onClick={onBuildApp}
        />
      </motion.div>

      <motion.div variants={fadeUp} className="flex justify-center">
        <button
          type="button"
          onClick={onSkip}
          disabled={finishing}
          className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          {finishing ? "One moment…" : "Just exploring"}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </motion.div>
    </motion.div>
  );
}

function ChoiceCard({
  icon,
  eyebrow,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="group relative text-left">
      {/* Signature stark offset rule — reveals on hover (matches Landing). */}
      <span
        className="absolute inset-0 translate-x-2 translate-y-2 border border-brand/40 opacity-0 transition-all duration-200 group-hover:translate-x-1.5 group-hover:translate-y-1.5 group-hover:opacity-100"
        aria-hidden
      />
      <span className="relative flex h-full flex-col gap-4 rounded-xl border border-border bg-card p-6 transition-colors group-hover:border-brand/60 group-focus-visible:border-brand/60">
        <span className="flex size-11 items-center justify-center rounded-xl border border-border text-brand transition-colors group-hover:border-brand/50">
          {icon}
        </span>
        <span className="space-y-1.5">
          <span className="block font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
            {eyebrow}
          </span>
          <span className="block font-display text-lg font-semibold tracking-tight">{title}</span>
          <span className="block text-xs leading-relaxed text-muted-foreground">{description}</span>
        </span>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-1 font-mono text-xs tracking-wide text-brand">
          Continue
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
        </span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Follow stage
// ---------------------------------------------------------------------------

function FollowStage({
  workspaces,
  loading,
  onFollowChange,
  onBack,
  onDone,
  finishing,
}: {
  workspaces: AppCardWorkspace[];
  loading: boolean;
  onFollowChange: (slug: string, data: { following: boolean; followerCount: number }) => void;
  onBack: () => void;
  onDone: () => void;
  finishing: boolean;
}) {
  const followingCount = workspaces.filter((w) => w.isFollowing).length;

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={staggerContainer(0.08)}
      className="w-full max-w-3xl space-y-8"
    >
      <motion.div variants={fadeUp} className="space-y-3 text-center">
        <p className="font-mono text-xs tracking-[0.22em] text-brand uppercase">Discover</p>
        <h1 className="font-display text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.02] font-semibold tracking-[-0.02em]">
          Follow apps you care about
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          Your Home feed surfaces their latest updates and posts. Follow a few to fill it — you can
          always find more in Explore.
        </p>
      </motion.div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonAppCard key={i} />
          ))}
        </div>
      ) : workspaces.length > 0 ? (
        <motion.div variants={fadeUp} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((w) => (
            <AppCard key={w.slug} workspace={w} onFollowChange={onFollowChange} />
          ))}
        </motion.div>
      ) : (
        <motion.p variants={fadeUp} className="text-center text-sm text-muted-foreground">
          No apps to suggest right now — you can discover them anytime from Explore.
        </motion.p>
      )}

      <motion.div variants={fadeUp} className="flex flex-col items-center gap-3 pt-2">
        <Button
          variant="brand"
          size="xl"
          onClick={onDone}
          disabled={finishing}
          className="w-full max-w-xs rounded-full"
        >
          {finishing
            ? "Setting up…"
            : followingCount > 0
              ? `Continue with ${followingCount} ${followingCount === 1 ? "app" : "apps"}`
              : "Continue to Home"}
        </Button>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <button
            type="button"
            onClick={onBack}
            disabled={finishing}
            className="transition-colors hover:text-foreground disabled:opacity-50"
          >
            ← Back
          </button>
          <span aria-hidden className="text-border">·</span>
          <button
            type="button"
            onClick={onDone}
            disabled={finishing}
            className="transition-colors hover:text-foreground disabled:opacity-50"
          >
            Skip for now
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
