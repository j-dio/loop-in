import { Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { getApiBase } from "@/lib/api";
import { Logo, LoopMark } from "@/components/brand/Logo";
import { GoogleIcon, GithubIcon } from "@/components/brand/AuthIcons";
import { HeroLoopGraphic } from "@/components/landing/HeroLoopGraphic";
import { ease, fadeUp, staggerContainer } from "@/lib/motion";

const stagger = staggerContainer(0.09);

const up: Variants = fadeUp;

const slideLeft: Variants = {
  hidden: { opacity: 0, x: -32 },
  show: { opacity: 1, x: 0, transition: { duration: 0.7, ease } },
};

export function SignIn() {
  const { user, loading } = useWorkspace();
  const api = getApiBase();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f4f4f1]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        >
          <LoopMark className="size-8" />
        </motion.div>
      </div>
    );
  }

  if (user) return <Navigate to="/home" replace />;

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* ── LEFT — Brand panel (always dark) ───────────────────────────── */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={slideLeft}
        className="relative hidden flex-col overflow-hidden bg-[#0b0b0c] text-[#f4f4f1] lg:flex lg:w-[58%]"
      >
        {/* Amber top rule */}
        <div className="h-[2px] w-full bg-[var(--brand)]" />

        {/* Ghost index number */}
        <span
          aria-hidden
          className="font-display pointer-events-none absolute right-10 top-10 select-none text-[11rem] font-bold leading-none"
          style={{ color: "rgba(244,244,241,0.035)" }}
        >
          01
        </span>

        {/* Top nav row */}
        <div className="relative z-10 flex items-center px-12 pt-9">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.2em] text-[#f4f4f1]/40 uppercase transition-colors hover:text-[var(--brand)]"
          >
            <ArrowLeft className="size-3" />
            Back
          </Link>
        </div>

        {/* Main copy */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={stagger}
          className="relative z-10 flex flex-col px-12 pt-12"
        >
          <motion.p
            variants={up}
            className="font-mono text-[11px] tracking-[0.24em] text-[var(--brand)] uppercase"
          >
            Signal from noise
          </motion.p>
          <motion.h1
            variants={up}
            className="font-display mt-6 text-[clamp(3.5rem,5.5vw,5rem)] font-semibold leading-[0.9] tracking-[-0.03em]"
          >
            Close the
            <br />
            <span style={{ color: "var(--brand)" }}>loop.</span>
          </motion.h1>
          <motion.p
            variants={up}
            className="mt-6 max-w-[30ch] text-sm leading-relaxed"
            style={{ color: "rgba(244,244,241,0.5)" }}
          >
            Feedback your users submit. Signal your team acts on.
            Updates that close the loop — automatically.
          </motion.p>
        </motion.div>

        {/* Loop graphic — centerpiece */}
        <div className="relative z-10 flex flex-1 items-center justify-center px-16 py-6">
          <div className="aspect-square w-full max-w-[300px]">
            <HeroLoopGraphic />
          </div>
        </div>

        {/* Bottom strip */}
        <div
          className="relative z-10 flex items-center justify-between border-t px-12 py-5"
          style={{ borderColor: "rgba(244,244,241,0.08)" }}
        >
          <span
            className="font-mono text-[10px] tracking-[0.24em] uppercase"
            style={{ color: "rgba(244,244,241,0.25)" }}
          >
            LoopIn · Feedback that ships
          </span>
          {/* Signal dots */}
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-[var(--brand)]" />
            <span
              className="size-1.5 rounded-full"
              style={{ background: "rgba(244,244,241,0.18)" }}
            />
            <span
              className="size-1.5 rounded-full"
              style={{ background: "rgba(244,244,241,0.18)" }}
            />
          </span>
        </div>
      </motion.div>

      {/* ── RIGHT — Auth panel (always light) ──────────────────────────── */}
      <div className="flex flex-1 flex-col bg-[#f4f4f1]">
        {/* Mobile amber top rule */}
        <div className="h-[2px] w-full bg-[var(--brand)] lg:hidden" />

        <div className="flex flex-1 flex-col px-8 py-8 sm:px-12 sm:py-10">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <Logo size="sm" />
            <Link
              to="/"
              className="lg:hidden inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.2em] text-[#0b0b0c]/40 uppercase transition-colors hover:text-[var(--brand)]"
            >
              <ArrowLeft className="size-3" />
              Back
            </Link>
          </div>

          {/* Center auth content */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger}
            className="flex flex-1 flex-col justify-center"
          >
            <div className="mx-auto w-full max-w-[340px]">
              {/* Headline */}
              <motion.div variants={up} className="mb-10">
                <h2 className="font-display text-[2rem] font-semibold leading-none tracking-[-0.02em] text-[#0b0b0c]">
                  Sign in.
                </h2>
                <p className="mt-2.5 text-sm leading-relaxed text-[#0b0b0c]/50">
                  New here? Your account is created on first sign-in.
                </p>
              </motion.div>

              {/* Continue-with label */}
              <motion.p
                variants={up}
                className="mb-4 font-mono text-[10px] tracking-[0.24em] text-[#0b0b0c]/35 uppercase"
              >
                Continue with
              </motion.p>

              {/* Auth buttons */}
              <motion.div variants={stagger} className="space-y-2.5">
                <motion.a
                  variants={up}
                  href={`${api}/auth/google`}
                  className="group flex h-[52px] w-full items-center gap-3 border border-[#0b0b0c]/15 bg-white px-5 text-sm font-medium text-[#0b0b0c] transition-all hover:border-[var(--brand)] hover:text-[var(--brand)]"
                >
                  <GoogleIcon className="size-4 shrink-0" />
                  <span className="flex-1">Google</span>
                  <ArrowRight className="size-3.5 text-[#0b0b0c]/30 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--brand)]" />
                </motion.a>

                <motion.a
                  variants={up}
                  href={`${api}/auth/github`}
                  className="group flex h-[52px] w-full items-center gap-3 border border-[#0b0b0c]/15 bg-white px-5 text-sm font-medium text-[#0b0b0c] transition-all hover:border-[var(--brand)] hover:text-[var(--brand)]"
                >
                  <GithubIcon className="size-4 shrink-0" />
                  <span className="flex-1">GitHub</span>
                  <ArrowRight className="size-3.5 text-[#0b0b0c]/30 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--brand)]" />
                </motion.a>
              </motion.div>

              {/* Terms */}
              <motion.div
                variants={up}
                className="mt-8 border-t border-[#0b0b0c]/10 pt-6"
              >
                <p className="text-xs leading-relaxed text-[#0b0b0c]/40">
                  By signing in you agree to the{" "}
                  <span className="cursor-default underline underline-offset-2 transition-colors hover:text-[#0b0b0c]">
                    Terms of Service
                  </span>{" "}
                  and{" "}
                  <span className="cursor-default underline underline-offset-2 transition-colors hover:text-[#0b0b0c]">
                    Privacy Policy
                  </span>
                  .
                </p>
              </motion.div>
            </div>
          </motion.div>

          {/* Footer */}
          <div className="border-t border-[#0b0b0c]/10 pt-5">
            <p className="font-mono text-[10px] tracking-[0.2em] text-[#0b0b0c]/30 uppercase">
              © {new Date().getFullYear()} Loop In
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
