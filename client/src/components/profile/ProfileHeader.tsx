import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Apple, Globe, Link as LinkIcon, Play, Settings } from "lucide-react";
import { ApiError, getWorkspaceProfile } from "@/lib/api";
import { computeSetup, setFlag } from "@/lib/profileSetup";
import { WorkspaceTile } from "@/components/WorkspaceTile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FollowButton } from "@/components/FollowButton";
import { useShareBoard } from "@/components/profile/useShareBoard";
import { ShareButton } from "@/components/profile/ShareButton";
import { SetupChecklist } from "@/components/profile/SetupChecklist";
import type { LinkDTO, WorkspaceProfileDTO } from "@/lib/profileTypes";

const PLATFORM_LABEL: Record<NonNullable<WorkspaceProfileDTO["workspace"]["platform"]>, string> = {
  web: "Web",
  mobile: "Mobile",
  desktop: "Desktop",
  other: "Other",
};

function linkMeta(kind: LinkDTO["kind"]): { label: string; Icon: typeof Globe } {
  switch (kind) {
    case "github":
      return { label: "GitHub", Icon: LinkIcon };
    case "appstore":
      return { label: "App Store", Icon: Apple };
    case "playstore":
      return { label: "Play Store", Icon: Play };
    case "x":
      return { label: "X", Icon: LinkIcon };
    default:
      return { label: "Link", Icon: LinkIcon };
  }
}

export function ProfileHeader({ slug, canManage }: { slug: string; canManage: boolean }) {
  const [data, setData] = useState<WorkspaceProfileDTO | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    void (async () => {
      try {
        const profile = await getWorkspaceProfile(slug);
        if (!cancelled) {
          setData(profile);
          setFollowerCount(profile.followerCount);
        }
      } catch (e) {
        // invite_only without access (403) or missing (404): render nothing.
        if (!(e instanceof ApiError)) throw e;
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const [sharedTick, setSharedTick] = useState(0);
  const { share, copied } = useShareBoard(slug, () => {
    setFlag("share", slug);
    setSharedTick((t) => t + 1);
  });
  /* eslint-disable react-hooks/exhaustive-deps */
  // sharedTick forces recompute after a successful share (computeSetup re-reads localStorage flags).
  const setup = useMemo(
    () => (data ? computeSetup(data, slug, canManage) : null),
    [data, slug, canManage, sharedTick],
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  if (!loaded) {
    return <div className="h-28 animate-pulse border-b border-border" aria-hidden />;
  }
  if (!data) return null;

  const { workspace: w, screenshots, links } = data;

  return (
    <section className="border-b border-border pb-8">
      <div className="flex items-start gap-5">
        <WorkspaceTile
          name={w.name}
          seed={w.slug}
          logoUrl={w.logoUrl}
          sizeClassName="size-16 sm:size-20"
          monogramClassName="text-2xl sm:text-3xl"
        />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[clamp(1.6rem,3.4vw,2.5rem)] font-semibold leading-[1.04] tracking-tight">
            {w.name}
          </h1>
          {w.tagline ? <p className="mt-1.5 text-pretty text-muted-foreground">{w.tagline}</p> : null}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {w.platform ? <Badge tone="outline">{PLATFORM_LABEL[w.platform]}</Badge> : null}
            {w.category ? <Badge tone="neutral">{w.category}</Badge> : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {canManage ? (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to={`/${slug}/admin`}>
                <Settings className="size-3.5" />
                Manage
              </Link>
            </Button>
          ) : (
            <FollowButton
              slug={slug}
              initialFollowing={data.isFollowing}
              initialCount={data.followerCount}
              onChange={(s) => setFollowerCount(s.followerCount)}
            />
          )}
          <ShareButton copied={copied} onClick={share} />
          <span className="font-mono text-xs text-muted-foreground">
            {followerCount} {followerCount === 1 ? "follower" : "followers"}
          </span>
        </div>
      </div>

      {w.description ? (
        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
          {w.description}
        </p>
      ) : null}

      {w.websiteUrl || links.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {w.websiteUrl ? (
            <a
              href={w.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium hover:border-brand/40 hover:text-brand"
            >
              <Globe className="size-3.5" />
              Website
            </a>
          ) : null}
          {links.map((l) => {
            const { label, Icon } = linkMeta(l.kind);
            return (
              <a
                key={l.id}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium hover:border-brand/40 hover:text-brand"
              >
                <Icon className="size-3.5" />
                {label}
              </a>
            );
          })}
        </div>
      ) : null}

      {screenshots.length > 0 ? (
        <div className="mt-5 flex gap-3 overflow-x-auto pb-1">
          {screenshots.map((s) => (
            <img
              key={s.id}
              src={s.url}
              alt=""
              loading="lazy"
              className="h-44 w-auto shrink-0 rounded-xl border border-border object-cover"
            />
          ))}
        </div>
      ) : null}

      {setup && setup.showCard ? (
        <SetupChecklist slug={slug} state={setup} onShare={share} />
      ) : null}
    </section>
  );
}
