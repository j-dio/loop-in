import { motion } from "framer-motion";
import { ArrowBigUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { GithubIcon, GoogleIcon } from "@/components/brand/AuthIcons";
import { AudienceExpandCards } from "@/components/landing/AudienceExpandCards";
import { fadeUp, staggerContainer, ease } from "@/lib/motion";

const viewport = { once: true, amount: 0.25 } as const;

const STEPS = [
  {
    n: "01",
    title: "They submit",
    body: "Users post ideas, bugs, and requests on a public board — with screenshots, anonymously if they prefer.",
  },
  {
    n: "02",
    title: "The best rise",
    body: "Upvotes and a trending score push real signal to the top, so you build what actually matters — not just the loudest voice.",
  },
  {
    n: "03",
    title: "You ship & tell",
    body: "Triage, drag across the roadmap, post an update. Everyone who cared gets an email the moment it ships.",
  },
];

const FEATURES = [
  {
    n: "01",
    tag: "Roadmap",
    title: "A roadmap they can watch",
    body: "Drag feedback from Inbox to Under review, Planned, In progress, Shipped. The board updates live for everyone.",
  },
  {
    n: "02",
    tag: "AI",
    title: "A backlog that prioritizes itself",
    body: "Turn a noisy pile of requests into a ranked plan in one click — with complexity and rationale for each item.",
  },
  {
    n: "03",
    tag: "Updates",
    title: "Official updates that stand out",
    body: "Post status updates that read as official on the thread and preview right on the feed.",
  },
  {
    n: "04",
    tag: "Notify",
    title: "The loop closes itself",
    body: "Authors hear back automatically on approval, status changes, and ship. No manual chasing, ever.",
  },
  {
    n: "05",
    tag: "Explore",
    title: "A directory of apps being built in the open",
    body: "Browse a live feed of public apps, sorted by followers or newest. Follow what catches your eye — their updates land directly in your feed.",
  },
  {
    n: "06",
    tag: "Spaces",
    title: "A board per product or community",
    body: "Run many workspaces with roles, invites, and public or invite-only access. Works for teams, solo builders, and open communities alike.",
  },
];

// The lifecycle, as an oversized word-highlight list (qclay-inspired).
const STAGES = [
  { prefix: "From", word: "Submitted" },
  { prefix: "To", word: "Upvoted" },
  { prefix: "To", word: "Planned" },
  { prefix: "To", word: "In progress" },
  { prefix: "To", word: "Shipped" },
];

const PREVIEW_ROWS = [
  { t: "Bulk-edit on the dashboard", v: 312, s: "In progress", tone: "var(--brand)" },
  { t: "Keyboard shortcuts everywhere", v: 204, s: "Planned", tone: "var(--muted-foreground)" },
  { t: "Native dark mode", v: 168, s: "Shipped", tone: "var(--foreground)" },
];

type LandingMarketingProps = {
  googleHref: string;
  githubHref: string;
};

export function LandingMarketing({ googleHref, githubHref }: LandingMarketingProps) {
  return (
    <div className="bg-background text-foreground">
      {/* Two audiences ------------------------------------------------------- */}
      <section className="border-t border-border bg-secondary/40">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
          <motion.p
            initial="hidden"
            whileInView="show"
            viewport={viewport}
            variants={fadeUp}
            className="font-mono text-xs tracking-[0.22em] text-brand uppercase"
          >
            Two problems, one platform
          </motion.p>
          <motion.div initial="hidden" whileInView="show" viewport={viewport} variants={fadeUp}>
            <AudienceExpandCards />
          </motion.div>
        </div>
      </section>

      {/* The loop ------------------------------------------------------------ */}
      <section id="how" className="border-t border-border">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={viewport}
            variants={staggerContainer(0.1)}
            className="grid gap-6 lg:grid-cols-12"
          >
            <motion.p
              variants={fadeUp}
              className="font-mono text-xs tracking-[0.22em] text-brand uppercase lg:col-span-3"
            >
              How it works
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="font-display text-3xl leading-[0.98] font-semibold tracking-[-0.02em] text-balance sm:text-5xl lg:col-span-9"
            >
              One continuous loop, from a stray idea to a shipped feature.
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={viewport}
            variants={staggerContainer(0.14)}
            className="mt-14"
          >
            {STEPS.map((s) => (
              <motion.div
                key={s.n}
                variants={fadeUp}
                className="grid grid-cols-1 items-start gap-3 border-t border-border py-12 lg:grid-cols-12 lg:gap-6"
              >
                <span className="font-display text-ghost text-7xl leading-none font-bold lg:col-span-2">
                  {s.n}
                </span>
                <h3 className="font-display text-2xl font-semibold tracking-tight lg:col-span-4">
                  {s.title}
                </h3>
                <p className="max-w-prose leading-relaxed text-muted-foreground lg:col-span-6">
                  {s.body}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Lifecycle word-highlight ------------------------------------------- */}
      <section className="border-t border-border bg-secondary/40">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
          <p className="font-mono text-xs tracking-[0.22em] text-brand uppercase">The lifecycle</p>
          <div className="mt-10">
            {STAGES.map((s, i) => (
              <motion.div
                key={s.word}
                initial="rest"
                whileInView="lit"
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.5, ease, delay: i * 0.04 }}
                variants={{ rest: { opacity: 0, y: 24 }, lit: { opacity: 1, y: 0 } }}
                className="font-display flex items-baseline gap-[0.4ch] text-[clamp(2.25rem,9vw,7.5rem)] leading-[0.96] font-bold tracking-[-0.02em]"
              >
                <span className="text-muted-foreground/40">{s.prefix}</span>
                <motion.span
                  variants={{
                    rest: { color: "var(--muted-foreground)" },
                    lit: { color: "var(--brand)" },
                  }}
                  transition={{ duration: 0.5, ease, delay: i * 0.04 + 0.1 }}
                >
                  {s.word}
                </motion.span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features ------------------------------------------------------------ */}
      <section id="features" className="border-t border-border">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <motion.h2
            initial="hidden"
            whileInView="show"
            viewport={viewport}
            variants={fadeUp}
            className="font-display max-w-2xl py-24 text-3xl leading-[1.02] font-semibold tracking-[-0.02em] text-balance sm:text-5xl lg:py-32"
          >
            Built to take feedback{" "}
            <span className="text-muted-foreground">seriously.</span>
          </motion.h2>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={viewport}
            variants={staggerContainer(0.08)}
            className="-mt-10 pb-12"
          >
            {FEATURES.map((f) => (
              <motion.div
                key={f.n}
                variants={fadeUp}
                className="group grid grid-cols-1 items-baseline gap-2 border-t border-border py-8 transition-colors hover:bg-secondary/40 lg:grid-cols-12 lg:gap-6 lg:px-3"
              >
                <span className="font-mono text-sm text-muted-foreground lg:col-span-1">{f.n}</span>
                <h3 className="font-display text-xl font-semibold tracking-tight transition-colors group-hover:text-brand lg:col-span-4">
                  {f.title}
                </h3>
                <span className="font-mono text-[11px] tracking-[0.18em] text-brand uppercase lg:col-span-1">
                  {f.tag}
                </span>
                <p className="max-w-prose leading-relaxed text-muted-foreground lg:col-span-6">
                  {f.body}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Product figure ------------------------------------------------------ */}
      <section id="board" className="border-t border-border bg-grid">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-24 sm:px-8 lg:grid-cols-12 lg:py-32">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={viewport}
            variants={staggerContainer(0.1)}
            className="lg:col-span-5"
          >
            <motion.p
              variants={fadeUp}
              className="font-mono text-xs tracking-[0.22em] text-brand uppercase"
            >
              The board
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="font-display mt-4 text-3xl leading-[1.02] font-semibold tracking-[-0.02em] text-balance sm:text-4xl"
            >
              A home for feedback that feels good to use.
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-5 max-w-md leading-relaxed text-muted-foreground">
              Sort by trending, top, or newest. Search every post. Upvote with a tap. Threaded
              comments and official updates keep the conversation in one place.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={viewport}
            variants={fadeUp}
            className="lg:col-span-7"
          >
            {/* offset registration frame instead of a soft shadow */}
            <div className="relative">
              <div className="absolute inset-0 translate-x-3 translate-y-3 border border-brand/40" aria-hidden />
              <div className="relative border border-border bg-card p-4">
                <div className="mb-3 flex items-center gap-1.5 border-b border-border pb-3">
                  <span className="size-2.5 rounded-full bg-brand/70" />
                  <span className="size-2.5 rounded-full bg-muted-foreground/50" />
                  <span className="size-2.5 rounded-full bg-foreground/40" />
                  <span className="ml-2 font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
                    /acme · board
                  </span>
                </div>
                <div className="space-y-2.5">
                  {PREVIEW_ROWS.map((p) => (
                    <div
                      key={p.t}
                      className="flex items-center gap-3 border border-border bg-background p-3"
                    >
                      <span className="flex h-11 w-10 shrink-0 flex-col items-center justify-center border border-border text-xs font-semibold text-brand">
                        <ArrowBigUp className="size-4 fill-current" />
                        {p.v}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.t}</span>
                      <span
                        className="shrink-0 border px-2 py-0.5 font-mono text-[11px] tracking-wide"
                        style={{ color: p.tone, borderColor: "var(--border)" }}
                      >
                        {p.s}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-6 font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
              Fig. 01 — The public board
            </p>
          </motion.div>
        </div>
      </section>

      {/* Final CTA — the one dark, dramatic beat ---------------------------- */}
      <section
        id="start"
        className="relative overflow-hidden border-t border-border bg-[#0b0b0c] text-[#f3f3f0]"
      >
        <div className="relative z-10 mx-auto grid max-w-7xl gap-8 px-5 py-28 sm:px-8 lg:grid-cols-12 lg:py-36">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={viewport}
            variants={staggerContainer(0.1)}
            className="lg:col-span-8"
          >
            <motion.p
              variants={fadeUp}
              className="font-mono text-xs tracking-[0.22em] text-brand uppercase"
            >
              Get started
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="font-display mt-6 text-5xl leading-[0.92] font-bold tracking-[-0.03em] text-balance sm:text-7xl"
            >
              Ready to close
              <br />
              the <span className="text-brand">loop?</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-7 max-w-md text-[#f3f3f0]/60">
              Create a workspace in seconds. Free to start — sign in and spin up your first board.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center gap-3">
              <Button variant="brand" size="xl" className="rounded-full px-7" asChild>
                <a href={googleHref}>
                  <GoogleIcon className="size-4" />
                  Continue with Google
                </a>
              </Button>
              <Button
                variant="ghost"
                size="xl"
                className="rounded-full border border-white/20 px-7 text-[#f3f3f0] hover:bg-white/10 hover:text-white"
                asChild
              >
                <a href={githubHref}>
                  <GithubIcon className="size-4" />
                  Continue with GitHub
                </a>
              </Button>
            </motion.div>
          </motion.div>

          <div className="hidden items-end justify-end lg:col-span-4 lg:flex">
            <span className="font-display text-ghost text-[8rem] leading-none font-bold">02</span>
          </div>
        </div>
      </section>

      {/* Footer -------------------------------------------------------------- */}
      <footer className="bg-background">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-5 py-10 sm:flex-row sm:items-center sm:px-8">
          <Logo size="sm" />
          <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
            Close the loop with your users
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} Loop In
          </p>
        </div>
      </footer>
    </div>
  );
}
