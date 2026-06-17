import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * qclay-style interactive cursor: an amber dot that snaps to the pointer and a
 * trailing ring that lerps behind it and swells over interactive elements.
 * Only runs on fine pointers (mouse) and when motion is allowed — touch devices
 * and reduced-motion users keep the native cursor untouched.
 */
export function CursorFollower() {
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced || !ring.current || !dot.current) return;

    const root = document.querySelector<HTMLElement>(".landing");
    root?.classList.add("cursor-active");

    gsap.set([ring.current, dot.current], { xPercent: -50, yPercent: -50 });

    const xRing = gsap.quickTo(ring.current, "x", { duration: 0.55, ease: "power3.out" });
    const yRing = gsap.quickTo(ring.current, "y", { duration: 0.55, ease: "power3.out" });
    const xDot = gsap.quickTo(dot.current, "x", { duration: 0.12, ease: "power3.out" });
    const yDot = gsap.quickTo(dot.current, "y", { duration: 0.12, ease: "power3.out" });

    const move = (e: PointerEvent) => {
      xRing(e.clientX);
      yRing(e.clientY);
      xDot(e.clientX);
      yDot(e.clientY);
    };
    window.addEventListener("pointermove", move, { passive: true });

    const enter = () =>
      gsap.to(ring.current, { scale: 2.3, opacity: 0.9, duration: 0.3, ease: "power3.out" });
    const leave = () =>
      gsap.to(ring.current, { scale: 1, opacity: 1, duration: 0.3, ease: "power3.out" });

    const targets = root
      ? Array.from(root.querySelectorAll<HTMLElement>("a, button, [data-cursor]"))
      : [];
    targets.forEach((t) => {
      t.addEventListener("pointerenter", enter);
      t.addEventListener("pointerleave", leave);
    });

    return () => {
      window.removeEventListener("pointermove", move);
      targets.forEach((t) => {
        t.removeEventListener("pointerenter", enter);
        t.removeEventListener("pointerleave", leave);
      });
      root?.classList.remove("cursor-active");
    };
  }, []);

  return (
    <>
      <div ref={ring} className="loop-cursor-ring" aria-hidden />
      <div ref={dot} className="loop-cursor-dot" aria-hidden />
    </>
  );
}
