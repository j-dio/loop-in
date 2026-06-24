import { useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo, LoopMark } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HeroLoopGraphic } from "@/components/landing/HeroLoopGraphic";
import { useSmoothScroll } from "@/lib/lenis";

gsap.registerPlugin(ScrollTrigger);

type HeroProps = {
  onPrimary: () => void;
};

const NAV = [
  { label: "How it works", href: "#how" },
  { label: "Features", href: "#features" },
  { label: "The board", href: "#board" },
];

const TAGS = ["Discover", "Follow", "Submit", "Upvote", "Roadmap", "Ship"];

export function Hero({ onPrimary }: HeroProps) {
  const root = useRef<HTMLElement>(null);
  const scrollTo = useSmoothScroll();

  useLayoutEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context((self) => {
      // Reduced motion: no .from() runs, so the statically-rendered hero stays
      // fully visible. Nothing depends on the timeline to appear.
      if (prefersReduced) return;
      const q = self.selector!;

      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
      tl.from(q(".hero-rule"), { scaleX: 0, transformOrigin: "left", duration: 0.9, stagger: 0.1 })
        .from(q(".hero-eyebrow"), { opacity: 0, y: 12, duration: 0.5 }, "-=0.5")
        .from(q(".hero-line"), { yPercent: 120, duration: 1, stagger: 0.12 }, "-=0.3")
        .from(q(".hero-sub"), { opacity: 0, y: 18, duration: 0.6 }, "-=0.6")
        .from(q(".hero-cta"), { opacity: 0, y: 14, duration: 0.5, stagger: 0.08 }, "-=0.4")
        .from(q(".hero-tag"), { opacity: 0, y: 10, duration: 0.4, stagger: 0.05 }, "-=0.4")
        .from(
          q(".hero-sticker"),
          { opacity: 0, scale: 0.8, duration: 0.6, ease: "power2.out" },
          "-=0.9"
        )
        .from(
          q(".hero-figure"),
          { opacity: 0, scale: 0.92, duration: 0.8, ease: "power3.out" },
          "-=0.8"
        );

      gsap.to(q(".hero-copy"), {
        yPercent: 6,
        opacity: 0.4,
        scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
      });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={root}
      className="relative flex min-h-[100svh] flex-col bg-background text-foreground"
    >
      {/* Nav */}
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              onClick={(e) => {
                e.preventDefault();
                scrollTo(n.href);
              }}
              className="text-sm font-medium tracking-tight text-muted-foreground transition-colors hover:text-foreground"
            >
              {n.label}
            </a>
          ))}
          <Link to="/explore" className="nav-explore text-sm tracking-tight">
            Explore
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="brand"
            size="sm"
            className="rounded-full px-5"
            onClick={onPrimary}
          >
            Get started
          </Button>
        </div>
      </header>
      <div className="hero-rule mx-auto h-px w-full max-w-7xl origin-left bg-border" />

      {/* Main */}
      <div className="hero-copy relative mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-12">
        {/* Rotating sticker badge */}
        <div className="hero-sticker pointer-events-none absolute right-5 top-4 z-10 hidden size-28 sm:right-8 lg:block lg:size-36">
          <svg viewBox="0 0 120 120" className="animate-spin-slow size-full" aria-hidden>
            <defs>
              <path
                id="loop-badge"
                d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0"
                fill="none"
              />
            </defs>
            <text
              style={{ fill: "var(--brand)" }}
              fontFamily="var(--font-mono)"
              fontSize="9.5"
              letterSpacing="3.4"
            >
              <textPath href="#loop-badge" startOffset="0">
                SCROLL TO SEE THE LOOP • SCROLL TO SEE THE LOOP •
              </textPath>
            </text>
          </svg>
          <LoopMark className="absolute inset-0 m-auto size-9" />
        </div>

        <div className="lg:col-span-7">
        <p className="hero-eyebrow mb-7 font-mono text-xs tracking-[0.22em] text-brand uppercase">
          Built for the indie dev era
        </p>

        <h1 className="font-display max-w-[14ch] text-[clamp(2.75rem,8.5vw,7rem)] leading-[0.9] font-semibold tracking-[-0.03em]">
          <span className="block overflow-hidden">
            <span className="hero-line block">Close the</span>
          </span>
          <span className="block overflow-hidden">
            <span className="hero-line block">
              <span className="text-brand">loop</span> with
            </span>
          </span>
          <span className="block overflow-hidden">
            <span className="hero-line block">your users.</span>
          </span>
        </h1>

        <p className="hero-sub mt-9 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Indie apps get buried in social media posts. LoopIn gives every app a permanent
          home where users discover it, follow its journey, and submit feedback that
          actually shapes what ships.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-6">
          <Button
            variant="brand"
            size="xl"
            className="hero-cta group rounded-full px-7"
            onClick={onPrimary}
          >
            Get looped in
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Button>
          <a
            href="#how"
            onClick={(e) => {
              e.preventDefault();
              scrollTo("#how");
            }}
            className="hero-cta group inline-flex items-center gap-2 border-b border-foreground/30 pb-1 text-sm font-medium tracking-tight transition-colors hover:border-brand hover:text-brand"
          >
            See how it works
            <span className="transition-transform group-hover:translate-y-0.5">↓</span>
          </a>
        </div>
        </div>

        {/* Animated loop graphic */}
        <div className="hero-figure hidden lg:col-span-5 lg:block">
          <div className="mx-auto aspect-square w-full max-w-[26rem]">
            <HeroLoopGraphic />
          </div>
        </div>
      </div>

      {/* Bottom tag row */}
      <div className="hero-rule mx-auto h-px w-full max-w-7xl origin-left bg-border" />
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-7 gap-y-2 px-5 py-5 sm:px-8">
        {TAGS.map((t, i) => (
          <span key={t} className="hero-tag flex items-center gap-7">
            <span className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
              {t}
            </span>
            {i < TAGS.length - 1 ? <span className="text-brand">⟳</span> : null}
          </span>
        ))}
      </div>
    </section>
  );
}
