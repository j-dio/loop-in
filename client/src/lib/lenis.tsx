import { createContext, useContext, useLayoutEffect, useRef } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type ScrollTo = (target: string | number | HTMLElement, opts?: { offset?: number }) => void;

const SmoothScrollContext = createContext<ScrollTo>((target) => {
  if (typeof target === "string") {
    document.querySelector(target)?.scrollIntoView({ behavior: "smooth" });
  }
});

/**
 * Provides qclay-style momentum scrolling via Lenis and keeps GSAP
 * ScrollTrigger in sync with it. Disabled entirely under prefers-reduced-motion
 * — `scrollTo` then falls back to native (instant-ish) smooth scrolling, so no
 * content ever depends on the smooth layer to become visible.
 */
export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => 1 - Math.pow(1 - t, 4), // ease-out-quart
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    lenis.on("scroll", ScrollTrigger.update);

    const onTick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(onTick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  const scrollTo: ScrollTo = (target, opts) => {
    const lenis = lenisRef.current;
    if (lenis) {
      lenis.scrollTo(target, { offset: opts?.offset ?? 0 });
      return;
    }
    const el =
      typeof target === "string" ? document.querySelector(target) : (target as HTMLElement);
    el?.scrollIntoView?.({ behavior: "smooth" });
  };

  return (
    <SmoothScrollContext.Provider value={scrollTo}>{children}</SmoothScrollContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSmoothScroll(): ScrollTo {
  return useContext(SmoothScrollContext);
}
