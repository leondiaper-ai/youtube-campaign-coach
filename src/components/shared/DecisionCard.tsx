"use client";

/**
 * DecisionCard — the single reusable output component across all tools.
 * This is the most important element on screen when a tool produces a result.
 *
 * Semantic colours:
 *   artist   → electric blue
 *   track    → sun yellow
 *   youtube  → mint green
 *   decision → signal red
 *
 * Status tones:
 *   PUSH / ACCELERATE  → mint
 *   TEST               → sun
 *   HOLD               → blush/neutral
 *   FIX / ALERT        → signal
 */

import { ReactNode } from "react";

export type DecisionStatus =
  | "PUSH"
  | "TEST"
  | "HOLD"
  | "ACCELERATE"
  | "FIX"
  | "ALERT"
  | "BUILDING"
  | "UNEVEN";

export type DecisionDomain = "artist" | "track" | "youtube" | "decision";

interface Signal {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
}

interface DecisionCardProps {
  status: DecisionStatus;
  domain?: DecisionDomain;
  insight: string;
  signals?: Signal[];
  action: string;
  /** Optional small label above the status row. */
  context?: string;
  className?: string;
  children?: ReactNode;
}

const statusStyle: Record<DecisionStatus, string> = {
  PUSH:       "bg-[#1FBE7A] text-[#0E0E0E]",
  ACCELERATE: "bg-[#1FBE7A] text-[#0E0E0E]",
  TEST:       "bg-[#FFD24C] text-[#0E0E0E]",
  BUILDING:   "bg-[#2C25FF] text-[#FAF7F2]",
  UNEVEN:     "bg-[#FFD3C9] text-[#0E0E0E]",
  HOLD:       "bg-[#0E0E0E] text-[#FAF7F2]",
  FIX:        "bg-[#FF4A1C] text-[#FAF7F2]",
  ALERT:      "bg-[#FF4A1C] text-[#FAF7F2]",
};

const domainStripe: Record<DecisionDomain, string> = {
  artist:   "bg-[#2C25FF]",
  track:    "bg-[#FFD24C]",
  youtube:  "bg-[#1FBE7A]",
  decision: "bg-[#FF4A1C]",
};

const toneClass: Record<NonNullable<Signal["tone"]>, string> = {
  positive: "text-[#1FBE7A]",
  negative: "text-[#FF4A1C]",
  neutral:  "text-black/70",
};

export default function DecisionCard({
  status,
  domain = "decision",
  insight,
  signals = [],
  action,
  context,
  className = "",
  children,
}: DecisionCardProps) {
  return (
    <article
      className={`group relative rounded-3xl border border-black/10 bg-[#FAF7F2] text-[#0E0E0E] overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[10px_10px_0_0_rgba(14,14,14,1)] ${className}`}
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Domain stripe */}
      <div className={`h-1.5 w-full ${domainStripe[domain]}`} />

      <div className="p-7 md:p-9">
        {/* Context + status row */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-[0.72rem] tracking-[0.18em] uppercase font-semibold text-black/50">
            {context ?? `${domain} · decision`}
          </span>
          <span
            className={`${statusStyle[status]} text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full`}
          >
            {status}
          </span>
        </div>

        {/* Insight — the headline */}
        <p className="font-extrabold leading-[1.05] tracking-[-0.03em] text-2xl md:text-4xl max-w-[22ch]">
          {insight}
        </p>

        {/* Signals */}
        {signals.length > 0 && (
          <div className="mt-8 pt-6 border-t border-black/10 grid grid-cols-3 gap-4">
            {signals.slice(0, 3).map((s) => (
              <div key={s.label}>
                <div className="text-[10px] uppercase tracking-wider text-black/50 mb-1">
                  {s.label}
                </div>
                <div
                  className={`font-extrabold text-xl tracking-tight ${
                    s.tone ? toneClass[s.tone] : "text-black"
                  }`}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action */}
        <div className="mt-8 flex items-start gap-3 rounded-2xl bg-[#F6F1E7] border border-black/10 p-5">
          <span className="text-[#FF4A1C] text-xl leading-none mt-0.5">→</span>
          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-black/50 mb-1">
              Recommended action
            </div>
            <div className="text-base md:text-lg font-medium leading-snug">
              {action}
            </div>
          </div>
        </div>

        {children}
      </div>
    </article>
  );
}
