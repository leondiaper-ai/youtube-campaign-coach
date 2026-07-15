"use client";

/**
 * ToolIntro — shared bridge component between the landing page and each tool.
 * Keeps the editorial language of the site, then hands off to the tool UI below.
 *
 * Usage:
 *   <ToolIntro
 *     number="03"
 *     accent="mint"
 *     name="YouTube Campaign Coach"
 *     purpose="Structure YouTube planning and campaign execution around release moments."
 *     inputs={["Release window", "Channel context", "Asset inventory"]}
 *     outputs={["Posting plan", "Moment mapping", "Priority queue"]}
 *     ctaLabel="Start planning"
 *     ctaHref="#tool"
 *   />
 */

import { ReactNode } from "react";

type Accent = "electric" | "sun" | "mint" | "signal" | "blush";

const accentMap: Record<Accent, { bg: string; text: string; chip: string }> = {
  electric: { bg: "bg-[#2C25FF]", text: "text-[#FAF7F2]", chip: "bg-[#2C25FF] text-[#FAF7F2]" },
  sun:      { bg: "bg-[#FFD24C]", text: "text-[#0E0E0E]", chip: "bg-[#FFD24C] text-[#0E0E0E]" },
  mint:     { bg: "bg-[#1FBE7A]", text: "text-[#0E0E0E]", chip: "bg-[#1FBE7A] text-[#0E0E0E]" },
  signal:   { bg: "bg-[#FF4A1C]", text: "text-[#FAF7F2]", chip: "bg-[#FF4A1C] text-[#FAF7F2]" },
  blush:    { bg: "bg-[#FFD3C9]", text: "text-[#0E0E0E]", chip: "bg-[#FFD3C9] text-[#0E0E0E]" },
};

interface ToolIntroProps {
  number: string;
  name: string;
  purpose: string;
  inputs: string[];
  outputs: string[];
  ctaLabel?: string;
  ctaHref?: string;
  accent?: Accent;
  /** Optional slot rendered below the CTA row (e.g. small meta). */
  footer?: ReactNode;
}

export default function ToolIntro({
  number,
  name,
  purpose,
  inputs,
  outputs,
  ctaLabel = "Run analysis",
  ctaHref = "#tool",
  accent = "electric",
  footer,
}: ToolIntroProps) {
  const a = accentMap[accent];

  return (
    <section
      className="relative bg-[#FAF7F2] text-[#0E0E0E] border-b border-black/10"
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="mx-auto max-w-[1440px] px-6 md:px-10 pt-16 md:pt-24 pb-14 md:pb-20">
        {/* Eyebrow */}
        <div className="flex items-center justify-between mb-10">
          <span className="text-[0.72rem] tracking-[0.18em] uppercase font-semibold text-black/60">
            Tool {number} — Decision System
          </span>
          <a
            href="http://localhost:3000/#tools"
            className="text-[0.72rem] tracking-[0.18em] uppercase font-semibold text-black/60 hover:text-[#FF4A1C] transition-colors"
          >
            ← Back to system
          </a>
        </div>

        {/* Accent chip + name */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
          <div className="max-w-3xl">
            <div
              className={`inline-flex items-center gap-2 ${a.chip} rounded-full px-3 py-1.5 text-[10px] font-bold tracking-widest mb-6 shadow-[3px_3px_0_0_rgba(14,14,14,1)]`}
            >
              <span>{number}</span>
              <span className="opacity-60">/</span>
              <span className="uppercase">{accent}</span>
            </div>

            <h1
              className="font-extrabold leading-[0.92] tracking-[-0.04em] text-[clamp(2.5rem,7vw,5.5rem)]"
            >
              {name}
            </h1>
            <p className="mt-5 text-lg md:text-xl text-black/75 leading-snug max-w-xl">
              {purpose}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 md:justify-end">
            <a
              href={ctaHref}
              className="group inline-flex items-center gap-2 rounded-full bg-[#0E0E0E] text-[#FAF7F2] px-6 py-3 text-sm font-medium hover:bg-[#FF4A1C] transition-colors"
            >
              {ctaLabel}
              <span className="transition-transform group-hover:translate-x-1">↓</span>
            </a>
          </div>
        </div>

        {/* In / Out grid */}
        <div className="mt-14 grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-black/10 bg-[#F6F1E7] p-6">
            <div className="text-[0.72rem] tracking-[0.18em] uppercase font-semibold text-black/50 mb-3">
              In
            </div>
            <ul className="space-y-1.5">
              {inputs.map((i) => (
                <li key={i} className="flex gap-2 text-base">
                  <span className="text-black/30">—</span>
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-black/10 bg-[#F6F1E7] p-6">
            <div className="text-[0.72rem] tracking-[0.18em] uppercase font-semibold text-black/50 mb-3">
              Out
            </div>
            <ul className="space-y-1.5">
              {outputs.map((o) => (
                <li key={o} className="flex gap-2 text-base">
                  <span className="text-[#FF4A1C]">→</span>
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {footer && <div className="mt-10">{footer}</div>}
      </div>

      {/* Soft handoff divider into the tool below */}
      <div className="h-10 bg-gradient-to-b from-[#FAF7F2] to-transparent pointer-events-none" />
    </section>
  );
}
