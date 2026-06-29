import { useState } from "react";

async function copyToClipboard(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    // Insecure context or no Clipboard API — legacy fallback.
    try {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * Share the current board's public URL. Uses the native share sheet when
 * available (mostly mobile), otherwise copies to clipboard with a transient
 * `copied` flag. Calls `onShared` once on any successful share/copy.
 */
export function useShareBoard(slug: string, onShared?: () => void): {
  share: () => Promise<void>;
  copied: boolean;
} {
  const [copied, setCopied] = useState(false);

  async function share(): Promise<void> {
    const url = `${window.location.origin}/${slug}`;

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: document.title, url });
        onShared?.();
        return;
      } catch (err) {
        // User cancelled the native sheet — do not mark shared, do not fall through.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Any other native-share error falls through to clipboard copy.
      }
    }

    const ok = await copyToClipboard(url);
    if (ok) {
      onShared?.();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  return { share, copied };
}
