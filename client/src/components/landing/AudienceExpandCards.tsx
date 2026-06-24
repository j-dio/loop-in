import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ease } from "@/lib/motion";
import { cn } from "@/lib/utils";

type AudienceId = "builders" | "community";

const CARD_HEIGHT = 380;

const AUDIENCES = [
  {
    id: "builders" as const,
    label: "For builders",
    labelClass: "text-brand",
    accentClass: "border-brand",
    bulletClass: "font-bold text-brand",
    bullet: "⟳",
    headline: "Your app deserves to be found.",
    body: "Give your app a public board. Collect feedback, let signal rise through upvotes, and track everything on a Kanban roadmap — from inbox to shipped. Every supporter hears back the moment you do.",
    items: [
      "Public board — collect and upvote feedback",
      "AI digest — one click, backlog ranked by signal",
      "Kanban roadmap: Inbox → Planned → In Progress → Shipped",
      "Auto-notify everyone who cared when you ship",
    ],
  },
  {
    id: "community" as const,
    label: "For the community",
    labelClass: "text-muted-foreground",
    accentClass: "border-border",
    bulletClass: "text-foreground/30",
    bullet: "→",
    headline: "Stop missing what's being built.",
    body: "Indie apps get buried in social media posts. LoopIn is where you discover what's being built, follow the apps you love, and get notified when your feature request actually ships.",
    items: [
      "Explore a live directory of indie apps",
      "Follow apps and see their updates in your feed",
      "Submit feedback that devs can directly act on",
      "Get notified the moment your request ships",
    ],
  },
] as const;

/** Shared timing — label morph + card width stay in sync */
const morphTransition = { duration: 0.52, ease, type: "tween" as const };

function flexGrowFor(id: AudienceId, hovered: AudienceId | null) {
  if (hovered === null) return 1;
  return hovered === id ? 2.75 : 0.65;
}

function AudienceCardBody({ audience }: { audience: (typeof AUDIENCES)[number] }) {
  return (
    <>
      <h3 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
        {audience.headline}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
        {audience.body}
      </p>
      <ul className="mt-5 space-y-2.5">
        {audience.items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm">
            <span className={["mt-0.5 shrink-0", audience.bulletClass].join(" ")}>
              {audience.bullet}
            </span>
            <span className="text-muted-foreground">{item}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function InteractiveAudienceCard({
  audience,
  isExpanded,
  flexGrow,
  onMouseEnter,
}: {
  audience: (typeof AUDIENCES)[number];
  isExpanded: boolean;
  flexGrow: number;
  onMouseEnter: () => void;
}) {
  return (
    <motion.article
      onMouseEnter={onMouseEnter}
      animate={{ flexGrow }}
      transition={morphTransition}
      style={{ flexBasis: 0, height: CARD_HEIGHT }}
      className={cn(
        "relative min-w-0 cursor-pointer overflow-hidden rounded-2xl border bg-card p-5 sm:p-6",
        audience.accentClass,
        isExpanded ? "border-2" : "border",
      )}
    >
      {/* Label — always absolute so flex never reflows; slides center → top */}
      <motion.div
        className="absolute right-5 left-5 z-10 sm:right-6 sm:left-6"
        initial={false}
        animate={
          isExpanded ? { top: 20, y: 0 } : { top: "50%", y: "-50%" }
        }
        transition={morphTransition}
      >
        <div className="grid [&>*]:col-start-1 [&>*]:row-start-1">
          <motion.p
            className={cn(
              "font-display text-center text-2xl font-bold tracking-tight uppercase sm:text-3xl",
              audience.labelClass,
            )}
            initial={false}
            animate={{
              opacity: isExpanded ? 0 : 1,
              scale: isExpanded ? 0.9 : 1,
              filter: isExpanded ? "blur(3px)" : "blur(0px)",
            }}
            transition={{
              duration: 0.38,
              ease,
              delay: isExpanded ? 0 : 0.1,
            }}
            aria-hidden={isExpanded}
          >
            {audience.label}
          </motion.p>
          <motion.p
            className={cn(
              "font-mono text-left text-[11px] tracking-[0.22em] uppercase",
              audience.labelClass,
            )}
            initial={false}
            animate={{
              opacity: isExpanded ? 1 : 0,
              scale: isExpanded ? 1 : 1.06,
              filter: isExpanded ? "blur(0px)" : "blur(2px)",
            }}
            transition={{
              duration: 0.38,
              ease,
              delay: isExpanded ? 0.14 : 0,
            }}
            aria-hidden={!isExpanded}
          >
            {audience.label}
          </motion.p>
        </div>
      </motion.div>

      {/* Body — always mounted; fades in after label settles */}
      <motion.div
        className="absolute inset-x-5 bottom-5 overflow-y-auto sm:inset-x-6 sm:bottom-6"
        style={{ top: 40, pointerEvents: isExpanded ? "auto" : "none" }}
        initial={false}
        animate={{
          opacity: isExpanded ? 1 : 0,
          y: isExpanded ? 0 : 6,
        }}
        transition={{
          duration: 0.4,
          ease,
          delay: isExpanded ? 0.18 : 0,
        }}
        aria-hidden={!isExpanded}
      >
        <AudienceCardBody audience={audience} />
      </motion.div>
    </motion.article>
  );
}

export function AudienceExpandCards() {
  const reducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState<AudienceId | null>(null);
  const [isWide, setIsWide] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const interactive = isWide && !reducedMotion;
  const active = interactive ? hovered : null;

  return (
    <div
      className="mt-14 flex flex-col gap-4 md:flex-row"
      style={interactive ? { height: CARD_HEIGHT } : undefined}
      onMouseLeave={() => setHovered(null)}
    >
      {AUDIENCES.map((audience) => {
        const isExpanded = !interactive || active === audience.id;

        if (interactive) {
          return (
            <InteractiveAudienceCard
              key={audience.id}
              audience={audience}
              isExpanded={isExpanded}
              flexGrow={flexGrowFor(audience.id, active)}
              onMouseEnter={() => setHovered(audience.id)}
            />
          );
        }

        return (
          <article
            key={audience.id}
            className={cn(
              "min-w-0 flex-1 rounded-2xl border bg-card p-6 sm:p-8",
              audience.accentClass,
              "border-2",
            )}
          >
            <p
              className={cn(
                "font-mono text-[11px] tracking-[0.22em] uppercase",
                audience.labelClass,
              )}
            >
              {audience.label}
            </p>
            <div className="mt-4">
              <AudienceCardBody audience={audience} />
            </div>
          </article>
        );
      })}
    </div>
  );
}
