import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Compass, Hammer } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useWorkspace } from "@/context/WorkspaceContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AppCard, type AppCardWorkspace } from "@/components/feed/AppCard";
import { CreateAppWizard } from "@/components/CreateAppWizard";
import { Button } from "@/components/ui/button";

type Stage = "fork" | "follow";

export function Welcome() {
  const navigate = useNavigate();
  const { completeOnboarding } = useWorkspace();
  const [stage, setStage] = useState<Stage>("fork");
  const [wizardOpen, setWizardOpen] = useState(false);

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

  async function finish() {
    await completeOnboarding();
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
      {/* Minimal top bar */}
      <header className="flex h-12 items-center justify-between border-b border-border px-4">
        <span className="font-display text-base font-semibold tracking-tight">
          ◉ Loop In
        </span>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col items-center px-4 py-12">
        {stage === "fork" && (
          <ForkStage
            onFollowDiscover={() => setStage("follow")}
            onBuildApp={() => setWizardOpen(true)}
            onSkip={finish}
          />
        )}

        {stage === "follow" && (
          <FollowStage
            workspaces={workspaces}
            loading={followLoading}
            onFollowChange={handleFollowChange}
            onDone={finish}
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
}: {
  onFollowDiscover: () => void;
  onBuildApp: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="w-full max-w-lg space-y-8">
      <div className="space-y-2 text-center">
        <p className="font-mono text-xs tracking-widest uppercase text-brand">
          Get started
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Welcome to Loop In
        </h1>
        <p className="text-sm text-muted-foreground">
          What brings you here today?
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ChoiceCard
          icon={<Compass className="size-7" />}
          title="Follow & discover apps"
          description="Browse what others are building and follow the ones that interest you."
          onClick={onFollowDiscover}
        />
        <ChoiceCard
          icon={<Hammer className="size-7" />}
          title="I'm building an app"
          description="Set up a feedback board for your project in under a minute."
          onClick={onBuildApp}
        />
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Just exploring →
        </button>
      </div>
    </div>
  );
}

function ChoiceCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-4 rounded-xl border border-border bg-card p-6 text-left transition-all hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="text-brand">{icon}</span>
      <div className="space-y-1">
        <p className="font-display text-base font-semibold tracking-tight">{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
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
  onDone,
}: {
  workspaces: AppCardWorkspace[];
  loading: boolean;
  onFollowChange: (slug: string, data: { following: boolean; followerCount: number }) => void;
  onDone: () => void;
}) {
  return (
    <div className="w-full max-w-3xl space-y-8">
      <div className="space-y-2 text-center">
        <p className="font-mono text-xs tracking-widest uppercase text-brand">
          Discover
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Follow apps you care about
        </h1>
        <p className="text-sm text-muted-foreground">
          Your Following feed will surface their latest updates and posts.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-border bg-card"
            />
          ))}
        </div>
      ) : workspaces.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((w) => (
            <AppCard key={w.slug} workspace={w} onFollowChange={onFollowChange} />
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          No apps to suggest right now — check back later.
        </p>
      )}

      <div className="flex flex-col items-center gap-3 pt-2">
        <Button variant="brand" onClick={onDone} className="w-full max-w-xs">
          Done
        </Button>
        <button
          type="button"
          onClick={onDone}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
