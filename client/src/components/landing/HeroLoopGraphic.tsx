import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * The hero's right-hand centerpiece: the interlocking-loop brand mark blown up,
 * with amber "signal" dots orbiting each loop (feedback circulating), a slow
 * outer ring, and pulsing rings. Ink lines use `currentColor` so they flip with
 * the theme; amber stays amber. Reduced motion renders the final static state.
 */
export function HeroLoopGraphic() {
  const root = useRef<SVGSVGElement>(null);

  useLayoutEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context((self) => {
      const q = self.selector!;
      const loops = q(".hg-loop");
      // r = 70  →  circumference ≈ 440
      gsap.set(loops, { strokeDasharray: 440, strokeDashoffset: reduced ? 0 : 440 });
      if (reduced) return;

      gsap.to(loops, {
        strokeDashoffset: 0,
        duration: 1.6,
        ease: "power2.inOut",
        stagger: 0.2,
        delay: 0.3,
      });
      gsap.to(q(".hg-orbit-a"), {
        rotate: 360,
        svgOrigin: "165 200",
        duration: 9,
        repeat: -1,
        ease: "none",
      });
      gsap.to(q(".hg-orbit-b"), {
        rotate: -360,
        svgOrigin: "235 200",
        duration: 11,
        repeat: -1,
        ease: "none",
      });
      gsap.to(q(".hg-outer"), {
        rotate: 360,
        svgOrigin: "200 200",
        duration: 70,
        repeat: -1,
        ease: "none",
      });
      gsap.fromTo(
        q(".hg-pulse"),
        { scale: 0.82, opacity: 0.5, svgOrigin: "200 200" },
        {
          scale: 1.3,
          opacity: 0,
          svgOrigin: "200 200",
          duration: 3.6,
          repeat: -1,
          ease: "power1.out",
          stagger: 1.2,
        }
      );
      gsap.to(root.current, { y: -10, duration: 4.5, repeat: -1, yoyo: true, ease: "sine.inOut" });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <svg
      ref={root}
      viewBox="0 0 400 400"
      fill="none"
      className="h-full w-full"
      aria-hidden
    >
      {/* slow dashed outer ring */}
      <circle
        className="hg-outer"
        cx="200"
        cy="200"
        r="150"
        stroke="currentColor"
        strokeOpacity="0.16"
        strokeWidth="1"
        strokeDasharray="2 9"
      />
      {/* pulsing rings */}
      <circle className="hg-pulse" cx="200" cy="200" r="105" stroke="var(--brand)" strokeWidth="1" />
      <circle className="hg-pulse" cx="200" cy="200" r="105" stroke="var(--brand)" strokeWidth="1" />

      {/* the two interlocking loops (draw on) */}
      <circle
        className="hg-loop"
        cx="165"
        cy="200"
        r="70"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle
        className="hg-loop"
        cx="235"
        cy="200"
        r="70"
        stroke="var(--brand)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* orbiting signal dots */}
      <g className="hg-orbit-a">
        <circle cx="165" cy="130" r="5.5" fill="var(--brand)" />
      </g>
      <g className="hg-orbit-b">
        <circle cx="235" cy="130" r="4" fill="currentColor" />
      </g>

      {/* static texture: tick marks at the cardinal points of the outer ring */}
      {[0, 90, 180, 270].map((deg) => (
        <line
          key={deg}
          x1="200"
          y1="44"
          x2="200"
          y2="52"
          stroke="currentColor"
          strokeOpacity="0.3"
          strokeWidth="1.5"
          transform={`rotate(${deg} 200 200)`}
        />
      ))}
    </svg>
  );
}
