'use client';

import { useEffect, useState } from 'react';
import CoachLink from './CoachLink';
import {
  readCoachPlan,
  fmtCoachDate,
  fmtDaysFromNow,
  type CoachPlanSummary,
} from '@/lib/coachPlan';

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const MUTED = '#E9E2D3';

/**
 * Inline campaign-name chip for the Watcher header.
 *
 * The Watcher page is a server component, so the `fallback` prop carries
 * anything the server already has (e.g. a campaign string seeded on the
 * Artist record). Once mounted, this swaps in the campaign name from the
 * live Coach plan in localStorage — which is the source of truth whenever
 * the user has built a real timeline.
 */
export function CoachCampaignBadge({
  slug,
  fallback,
}: {
  slug: string;
  fallback?: string;
}) {
  const [campaign, setCampaign] = useState<string | null>(fallback ?? null);
  useEffect(() => {
    const plan = readCoachPlan(slug);
    if (plan?.campaignName) setCampaign(plan.campaignName);
    else if (fallback) setCampaign(fallback);
    else setCampaign(null);
  }, [slug, fallback]);

  if (!campaign) return null;
  return (
    <>
      <span className="text-ink/25">·</span>
      <span>{campaign}</span>
    </>
  );
}

/**
 * "Next moment" block on the Watcher page.
 *
 * Renders three different states depending on what the Coach plan looks like:
 *  1. Plan exists + upcoming moment → full card with label + date + days-out
 *  2. Plan exists but no upcoming moment → "plan is live, set the next drop"
 *  3. No plan at all → CTA to open the Coach
 *
 * The server-side fallbackLabel/fallbackDate are used pre-hydration so the
 * first paint still shows real content if the Artist record has anything.
 */
export function NextMomentFromCoach({
  slug,
  fallbackLabel,
  fallbackDate,
}: {
  slug: string;
  fallbackLabel?: string;
  fallbackDate?: string;
}) {
  const [coach, setCoach] = useState<CoachPlanSummary | null | undefined>(undefined);

  useEffect(() => {
    const hydrate = () => setCoach(readCoachPlan(slug));
    hydrate();
    window.addEventListener('focus', hydrate);
    return () => window.removeEventListener('focus', hydrate);
  }, [slug]);

  // Resolve the active next moment from the best available source.
  const momentLabel = coach?.nextMoment?.label ?? fallbackLabel ?? null;
  const momentDate = coach?.nextMoment?.date ?? fallbackDate ?? null;
  const days =
    momentDate
      ? Math.round(
          (new Date(momentDate + (momentDate.length === 10 ? 'T00:00:00' : '')).getTime() -
            new Date().setHours(0, 0, 0, 0)) /
            86400000
        )
      : null;
  const isAnchor = !!coach?.nextMoment?.isAnchor;
  const hasLivePlan = coach !== null && coach !== undefined;

  if (momentLabel && momentDate) {
    return (
      <>
        <h2 className="font-black text-lg mt-10 mb-3">Next moment</h2>
        <div
          className="rounded-xl border p-4 flex items-start justify-between gap-4"
          style={{ borderColor: MUTED, background: PAPER }}
        >
          <div className="min-w-0">
            <div className="text-[13px] font-bold">{momentLabel}</div>
            <div className="text-[11px] text-ink/55 mt-0.5 font-mono">
              {fmtCoachDate(momentDate)} · {momentDate}
              {days != null && ` · ${fmtDaysFromNow(days)}`}
              {isAnchor && <span className="text-ink/35"> · anchor</span>}
            </div>
            {coach?.campaignName && (
              <div className="text-[10px] uppercase tracking-[0.18em] text-ink/40 mt-2">
                From plan: {coach.campaignName}
              </div>
            )}
          </div>
          <CoachLink slug={slug} size="sm" />
        </div>
      </>
    );
  }

  if (hasLivePlan) {
    // Plan is loaded but every moment is behind us.
    return (
      <div
        className="mt-10 rounded-xl border p-4 flex items-center justify-between gap-4"
        style={{ borderColor: MUTED, background: PAPER }}
      >
        <div>
          <div className="text-[13px] font-bold">Plan is live — no upcoming moments</div>
          <div className="text-[11px] text-ink/55 mt-0.5">
            {coach?.campaignName
              ? `${coach.campaignName} has no drops scheduled ahead of today. Open Coach to plan the next one.`
              : 'Open Coach to set the next drop so Watcher can anchor against it.'}
          </div>
        </div>
        <CoachLink slug={slug} size="sm" />
      </div>
    );
  }

  // Pre-hydration OR no plan found.
  return (
    <div
      className="mt-10 rounded-xl border p-4 flex items-center justify-between gap-4"
      style={{ borderColor: MUTED, background: PAPER }}
    >
      <div>
        <div className="text-[13px] font-bold">No campaign timeline yet</div>
        <div className="text-[11px] text-ink/55 mt-0.5">
          Set one up in Coach to anchor Watcher against real moments.
        </div>
      </div>
      <CoachLink slug={slug} size="sm" />
    </div>
  );
}
