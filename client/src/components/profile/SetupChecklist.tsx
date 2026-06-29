import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Circle, X } from "lucide-react";
import { setFlag, type SetupState, type SetupStep } from "@/lib/profileSetup";

const rowClass = "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors";

function StepIcon({ done }: { done: boolean }) {
  return done ? (
    <Check className="size-4 shrink-0 text-brand" />
  ) : (
    <Circle className="size-4 shrink-0 text-muted-foreground/40" />
  );
}

function StepLabel({ step }: { step: SetupStep }) {
  return (
    <>
      <span className={step.done ? "text-muted-foreground line-through" : "text-foreground"}>
        {step.label}
      </span>
      {step.optional ? (
        <span className="ml-1.5 rounded-full border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          optional
        </span>
      ) : null}
    </>
  );
}

function StepRow({ step, onShare }: { step: SetupStep; onShare: () => void }) {
  if (step.done) {
    return (
      <li className={rowClass}>
        <StepIcon done />
        <StepLabel step={step} />
      </li>
    );
  }

  if (step.action === "share") {
    return (
      <li>
        <button
          type="button"
          onClick={onShare}
          className={`${rowClass} w-full text-left hover:bg-brand-bright/10`}
        >
          <StepIcon done={false} />
          <StepLabel step={step} />
          <ArrowRight className="ml-auto size-3.5 shrink-0 text-brand" />
        </button>
      </li>
    );
  }

  return (
    <li>
      <Link to={step.href ?? "#"} className={`${rowClass} hover:bg-brand-bright/10`}>
        <StepIcon done={false} />
        <StepLabel step={step} />
        <ArrowRight className="ml-auto size-3.5 shrink-0 text-brand" />
      </Link>
    </li>
  );
}

export function SetupChecklist({
  slug,
  state,
  onShare,
}: {
  slug: string;
  state: SetupState;
  onShare: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  function handleDismiss() {
    setFlag("dismiss", slug);
    setDismissed(true);
  }

  const pct = Math.round((state.requiredDone / state.requiredTotal) * 100);

  return (
    <div className="mt-5 rounded-xl border border-brand/30 bg-brand-bright/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.18em] text-brand uppercase">Get started</p>
          <h2 className="font-display text-base font-semibold tracking-tight">
            Finish setting up your board
          </h2>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss setup checklist"
          className="rounded-lg p-1 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-brand transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {state.requiredDone}/{state.requiredTotal}
        </span>
      </div>

      <ul className="mt-3 space-y-1">
        {state.steps.map((step) => (
          <StepRow key={step.id} step={step} onShare={onShare} />
        ))}
      </ul>
    </div>
  );
}
