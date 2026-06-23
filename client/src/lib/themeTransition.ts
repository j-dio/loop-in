/**
 * Progressive theme-change reveal via the View Transitions API.
 *
 * The new theme wipes in over the old one behind a moving straight edge
 * (clip-path polygon) — a full-viewport directional sweep. Falls back to an
 * instant swap when the browser lacks `startViewTransition` or the user
 * prefers reduced motion.
 *
 * Ported from rudrodip's theme-toggle-effect / Skiper UI:
 * https://developer.chrome.com/docs/web-platform/view-transitions/
 */

const STYLE_ID = "theme-transition-styles";
const EASE_VAR_ID = "theme-transition-easing";

export type AnimationStart =
  | "bottom-up"
  | "top-down"
  | "left-right"
  | "right-left"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type ThemeAnimationConfig = {
  start?: AnimationStart;
  blur?: boolean;
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The clip-path the wipe grows from / to, per direction. */
function getClipPath(start: AnimationStart) {
  const full = "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)";
  switch (start) {
    case "bottom-up":
      return { from: "polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)", to: full };
    case "top-down":
      return { from: "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)", to: full };
    case "left-right":
      return { from: "polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)", to: full };
    case "right-left":
      return { from: "polygon(100% 0%, 100% 0%, 100% 100%, 100% 100%)", to: full };
    case "top-left":
      return { from: "polygon(0% 0%, 0% 0%, 0% 0%, 0% 0%)", to: full };
    case "top-right":
      return { from: "polygon(100% 0%, 100% 0%, 100% 0%, 100% 0%)", to: full };
    case "bottom-left":
      return { from: "polygon(0% 100%, 0% 100%, 0% 100%, 0% 100%)", to: full };
    case "bottom-right":
      return { from: "polygon(100% 100%, 100% 100%, 100% 100%, 100% 100%)", to: full };
  }
}

/** Ensures the --expo-out easing custom property exists once on :root. */
function ensureEasing() {
  if (typeof document === "undefined") return;
  if (document.getElementById(EASE_VAR_ID)) return;
  const el = document.createElement("style");
  el.id = EASE_VAR_ID;
  el.textContent = `:root { --expo-out: cubic-bezier(0.16, 1, 0.3, 1); }`;
  document.head.appendChild(el);
}

function injectStyles({ start = "bottom-up", blur = false }: ThemeAnimationConfig) {
  if (typeof document === "undefined") return;

  const clip = getClipPath(start);
  const css = `
    ::view-transition-group(root) {
      animation-duration: 0.7s;
      animation-timing-function: var(--expo-out);
    }
    ::view-transition-old(root),
    .dark::view-transition-old(root) {
      animation: none;
      z-index: -1;
    }
    ::view-transition-new(root) {
      animation-name: theme-reveal;
      ${blur ? "filter: blur(2px);" : ""}
    }
    @keyframes theme-reveal {
      from {
        clip-path: ${clip.from};
        ${blur ? "filter: blur(8px);" : ""}
      }
      ${blur ? "50% { filter: blur(4px); }" : ""}
      to {
        clip-path: ${clip.to};
        ${blur ? "filter: blur(0px);" : ""}
      }
    }
  `;

  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

/**
 * Runs `swap` (the actual theme mutation) inside a view transition that wipes
 * the new theme in with a directional sweep. When the API is unavailable or
 * reduced motion is set, `swap` runs immediately.
 */
export function runThemeTransition(swap: () => void, config: ThemeAnimationConfig = {}) {
  const canAnimate =
    typeof document !== "undefined" &&
    typeof document.startViewTransition === "function" &&
    !prefersReducedMotion();

  if (!canAnimate) {
    swap();
    return;
  }

  ensureEasing();
  injectStyles(config);
  document.startViewTransition(swap);
}
