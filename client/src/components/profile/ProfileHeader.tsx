import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Apple, Globe, Link as LinkIcon, Play } from "lucide-react";
import { ApiError, getWorkspaceProfile } from "@/lib/api";
import { WorkspaceTile } from "@/components/WorkspaceTile";
import { Badge } from "@/components/ui/badge";
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

export function ProfileHeader({ slug, isOwner }: { slug: string; isOwner: boolean }) {
  const [data, setData] = useState<WorkspaceProfileDTO | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    void (async () => {
      try {
        const profile = await getWorkspaceProfile(slug);
        if (!cancelled) setData(profile);
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

  if (!loaded) {
    return <div className="h-28 animate-pulse rounded-2xl border border-border bg-card" aria-hidden />;
  }
  if (!data) return null;

  const { workspace: w, screenshots, links } = data;
  const isSparse =
    !w.tagline &&
    !w.description &&
    !w.platform &&
    !w.category &&
    !w.websiteUrl &&
    screenshots.length === 0 &&
    links.length === 0;

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start gap-4">
        <WorkspaceTile name={w.name} seed={w.slug} logoUrl={w.logoUrl} sizeClassName="size-16" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold leading-tight">{w.name}</h1>
          {w.tagline ? <p className="mt-1 text-muted-foreground">{w.tagline}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {w.platform ? <Badge tone="outline">{PLATFORM_LABEL[w.platform]}</Badge> : null}
            {w.category ? <Badge tone="neutral">{w.category}</Badge> : null}
          </div>
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

      {isOwner && isSparse ? (
        <div className="mt-5 rounded-xl border border-dashed border-brand/40 bg-brand-bright/10 px-4 py-3 text-sm">
          <span className="text-muted-foreground">Your app profile is empty. </span>
          <Link to={`/${slug}/admin`} className="font-medium text-brand hover:underline">
            Complete your profile →
          </Link>
        </div>
      ) : null}
    </section>
  );
}
