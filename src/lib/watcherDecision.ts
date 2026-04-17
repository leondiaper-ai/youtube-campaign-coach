import type { Artist, LiveSnap } from './artists';
import type { Opportunity } from './opportunities';
import type { ConversionResult } from './conversion';

// ─────────────────────────────────────────────────────────────────────────────
// WATCHER DECISION — upgrades Watcher from "suggest actions" to "make decisions".
//
// Four outputs:
//   FIX        — something is broken or blocking performance
//   CORRECT    — something is suboptimal and should change
//   MAINTAIN   — things are working, do not interfere
//   ACCELERATE — double down on what is already working
//
// Four verdicts against the plan (artist.phase + next moment):
//   ON_TRACK     — executing as planned, no change required
//   DRIFT        — plan exists but execution is off
//   RISK         — upcoming moment not supported by channel state
//   OPPORTUNITY  — something working that can be scaled
//
// Rules:
//  - DO NOT suggest actions that are already being executed well
//  - DO NOT recommend additional formats if cadence is already strong
//  - PRIORITISE protecting momentum over adding complexity
//  - DEFAULT to MAINTAIN when signals are healthy
// ─────────────────────────────────────────────────────────────────────────────

export type DecisionType = 'FIX' | 'CORRECT' | 'MAINTAIN' | 'ACCELERATE';
export type Verdict = 'ON_TRACK' | 'DRIFT' | 'RISK' | 'OPPORTUNITY';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface WatcherDecision {
  type: DecisionType;
  verdict: Verdict;
  headline: string;
  signals: string[];
  expectedImpact: string;
  ifIgnored: string;
  confidence: Confidence;
}

export const DECISION_COLOR: Record<DecisionType, { bg: string; fg: string; dot: string }> = {
  FIX:        { bg: '#FFE2D8', fg: '#8A1F0C', dot: '#FF4A1C' },
  CORRECT:    { bg: '#FFEAD6', fg: '#8A4A1A', dot: '#F08A3C' },
  MAINTAIN:   { bg: '#E6F8EE', fg: '#0C6A3F', dot: '#1FBE7A' },
  ACCELERATE: { bg: '#DCE8FF', fg: '#1C3B8A', dot: '#2C6BFF' },
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  ON_TRACK:    'ON TRACK',
  DRIFT:       'DRIFT',
  RISK:        'RISK',
  OPPORTUNITY: 'OPPORTUNITY',
};

const ACTIVE_PHASES: Artist['phase'][] = ['START', 'RELEASE', 'PUSH', 'PEAK'];

function daysAgo(iso?: string | null) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export interface DecisionInput {
  artist: Artist;
  live: LiveSnap | null;
  opps: Opportunity[];
  daysToNextMoment: number | null;
  subs7: { delta: number; pct: number } | null;
  subs30: { delta: number; pct: number } | null;
  views7: { delta: number; pct: number } | null;
  history: unknown[]; // length used for confidence only
  conv7?: ConversionResult | null;
  conv30?: ConversionResult | null;
}

export function decideWatcher(input: DecisionInput): WatcherDecision {
  const { artist, live, opps, daysToNextMoment, subs7, history, conv7, conv30 } = input;

  // Anchor conversion = tightest window with actual data, preferring 7d.
  const convAnchor =
    conv7 && conv7.band !== 'INSUFFICIENT'
      ? conv7
      : conv30 && conv30.band !== 'INSUFFICIENT'
      ? conv30
      : null;
  const convWeak = convAnchor?.band === 'WEAK' || convAnchor?.band === 'SOFT';
  const convStrong = convAnchor?.band === 'STRONG' || convAnchor?.band === 'HEALTHY';
  const convPurge = convAnchor?.band === 'PURGE';
  const convLine = convAnchor
    ? `Conversion ${convAnchor.ratePer1k.toFixed(1)}/1k views over ${convAnchor.spanDays}d (${convAnchor.band.toLowerCase()}).`
    : null;

  // ── Confidence ───────────────────────────────────────────────────────────
  const isLive = !!(live && !live.error && live.subs != null);
  const confidence: Confidence = !isLive ? 'LOW' : history.length >= 3 ? 'HIGH' : 'MEDIUM';

  // If we don't even have live data, the only honest call is MAINTAIN/LOW.
  if (!isLive) {
    return {
      type: 'MAINTAIN',
      verdict: 'ON_TRACK',
      headline: 'Hold current plan. Live data unavailable.',
      signals: ['Watcher is running on seed data only.'],
      expectedImpact: 'No change. Decision will sharpen once the live fetch returns.',
      ifIgnored: 'No downside — the system is simply waiting for signal.',
      confidence,
    };
  }

  // ── Signal extraction ────────────────────────────────────────────────────
  const uploads30d = live!.uploads30d ?? 0;
  const shorts30d = live!.shorts30d ?? 0;
  const lastUp = daysAgo(live!.lastUploadAt);
  const isActivePhase = ACTIVE_PHASES.includes(artist.phase);
  const nearMoment = daysToNextMoment != null && daysToNextMoment >= 0 && daysToNextMoment <= 14;
  const momentLabel = (artist.nextMomentLabel ?? '').toLowerCase();

  const cold = lastUp == null || lastUp > 30 || uploads30d === 0;
  // Strong cadence ≈ weekly output the algorithm rewards for this phase
  const strongCadence =
    uploads30d >= 6 || (isActivePhase && uploads30d >= 4 && (lastUp ?? 999) <= 7);
  const weakCadence = uploads30d <= 2 || (lastUp ?? 999) > 14;

  // Subs growing: either 0.5%+ growth OR 50+ absolute gain (protects smaller channels)
  const subsGrowing = subs7 != null && subs7.delta > 0 && (subs7.pct >= 0.005 || subs7.delta >= 50);
  const subsFlat = subs7 != null && subs7.delta <= 0;

  const channelOpps = opps.filter((o) => !o.videoId);
  const highChannel = channelOpps.filter((o) => o.impact === 'HIGH');
  const midChannel = channelOpps.filter((o) => o.impact === 'MEDIUM');
  const videoOpps = opps.filter((o) => !!o.videoId);
  const highVideo = videoOpps.filter((o) => o.impact === 'HIGH');

  // Helper: pull the headline signal from a list of opportunities
  const oppHeadline = (o: Opportunity) => `${o.subtype} — ${o.signal}`;

  // ── 1. FIX ───────────────────────────────────────────────────────────────
  // Something is broken or actively blocking performance.
  if (cold && (isActivePhase || nearMoment)) {
    return {
      type: 'FIX',
      verdict: 'RISK',
      headline: nearMoment
        ? `Channel is cold with ${daysToNextMoment}d to ${momentLabel}. Ship something this week.`
        : `Channel is cold inside an active ${artist.phase} phase. Ship something this week.`,
      signals: [
        lastUp != null ? `Last upload ${lastUp}d ago.` : 'No uploads detected in 30d.',
        `${uploads30d} uploads / 30d.`,
        nearMoment
          ? `${daysToNextMoment}d to ${momentLabel}.`
          : `Active phase: ${artist.phase}.`,
      ],
      expectedImpact:
        'Breaking silence in the 2 weeks before a drop typically lifts announce-day viewership by 2–3× vs dormant channels.',
      ifIgnored:
        'YouTube deprioritises cold channels in subscriber feeds — the next upload launches into a shrunk audience.',
      confidence,
    };
  }

  if (cold) {
    return {
      type: 'FIX',
      verdict: 'DRIFT',
      headline: 'Channel has gone cold. Post one Short this week.',
      signals: [
        lastUp != null ? `Last upload ${lastUp}d ago.` : 'No uploads detected in 30d.',
        `${uploads30d} uploads / 30d.`,
      ],
      expectedImpact:
        'A single catalogue Short is enough to restart the subscriber notification surface and preserve baseline watch-time.',
      ifIgnored:
        'Watch-time bleeds week over week; the channel will be starting from zero on the next campaign.',
      confidence,
    };
  }

  if (nearMoment && weakCadence) {
    return {
      type: 'FIX',
      verdict: 'RISK',
      headline: `${daysToNextMoment}d to ${momentLabel} and the cadence won't carry it.`,
      signals: [
        `${uploads30d} uploads / 30d (last ${lastUp}d ago).`,
        shorts30d === 0 ? 'No Shorts in the 30d window.' : `${shorts30d} Shorts / 30d.`,
        `${daysToNextMoment}d to ${momentLabel}.`,
      ],
      expectedImpact:
        'Posting a teaser or catalogue Short this week re-engages subscribers before the drop — the ceiling on announce day moves with it.',
      ifIgnored:
        'Drop launches into a subscriber base YouTube has stopped re-surfacing — first-48h views stay capped.',
      confidence,
    };
  }

  // ── 1b. FIX — conversion purge ───────────────────────────────────────────
  // Channel is losing net subs *despite* new views. This is a real structural
  // problem the Cockpit should surface even if cadence + opportunities look fine.
  if (convPurge && convAnchor) {
    return {
      type: 'FIX',
      verdict: 'DRIFT',
      headline: 'Losing subscribers despite new views. Check recent uploads for off-brand content.',
      signals: [
        convLine!,
        `${convAnchor.subsDelta.toLocaleString()} subs net · +${convAnchor.viewsDelta.toLocaleString()} new views in ${convAnchor.spanDays}d.`,
        `${uploads30d} uploads / 30d, ${shorts30d} Shorts.`,
      ],
      expectedImpact:
        'Identifying which video triggered the unsub spike and pulling or reframing it typically halts the decline within a week.',
      ifIgnored:
        'Subscribers keep leaving faster than they arrive — the next release launches into a shrinking audience.',
      confidence,
    };
  }

  // ── 2. CORRECT ───────────────────────────────────────────────────────────
  // Working, but suboptimal — something should change.
  if (highChannel.length > 0 && !subsGrowing) {
    const top = highChannel[0];
    return {
      type: 'CORRECT',
      verdict: 'DRIFT',
      headline: top.action,
      signals: [
        oppHeadline(top),
        subs7
          ? `Subs ${subs7.delta >= 0 ? '+' : ''}${subs7.delta.toLocaleString()} in 7d — not converting.`
          : 'Subscriber trend flat in the last 7d.',
        `${uploads30d} uploads / 30d, ${shorts30d} Shorts.`,
      ],
      expectedImpact: top.impactRange,
      ifIgnored:
        'Uploads continue but the structural gap keeps capping reach — effort in, no compounding.',
      confidence,
    };
  }

  // ── 2b. CORRECT — cadence OK, conversion leaking ─────────────────────────
  // Strong output, views coming in, but the viewer → subscriber flywheel isn't
  // spinning. That points at packaging (channel trailer, end-screens, hooks),
  // not cadence — and pushing more uploads won't fix it.
  // Guard: skip if subs are actually growing — conversion rate can be low on
  // niche/smaller channels while still being healthy.
  if (strongCadence && convWeak && convAnchor && !subsGrowing) {
    return {
      type: 'CORRECT',
      verdict: 'DRIFT',
      headline: 'Views arriving but not converting. Fix packaging before adding more uploads.',
      signals: [
        convLine!,
        `${uploads30d} uploads / 30d — cadence already strong.`,
        subs7
          ? `Subs ${subs7.delta >= 0 ? '+' : ''}${subs7.delta.toLocaleString()} in 7d.`
          : 'Subscriber trend flat.',
      ],
      expectedImpact:
        'Tightening channel trailer, end-screens, and top-video pinned links typically lifts subs/1k views by 30–60% within two weeks.',
      ifIgnored:
        'New viewers keep arriving and leaving — effort goes in, compounding stays flat.',
      confidence,
    };
  }

  // ── 3. ACCELERATE ────────────────────────────────────────────────────────
  // Something is already working — double down rather than add complexity.
  if (subsGrowing && strongCadence && highVideo.length > 0) {
    const top = highVideo[0];
    return {
      type: 'ACCELERATE',
      verdict: 'OPPORTUNITY',
      headline: 'Growth is compounding.',
      signals: [
        `Subs +${subs7!.delta.toLocaleString()} (${(subs7!.pct * 100).toFixed(1)}%) in 7d.`,
        `${uploads30d} uploads / 30d — cadence is strong.`,
        oppHeadline(top),
      ],
      expectedImpact:
        'Scaling a proven top performer (lyric cut, Short, visualizer) rides existing algorithmic momentum at a fraction of the cost of new content.',
      ifIgnored:
        'The momentum window closes in days — the track cools and the easy upside is gone.',
      confidence,
    };
  }

  if (subsGrowing && strongCadence) {
    return {
      type: 'ACCELERATE',
      verdict: 'OPPORTUNITY',
      headline: 'Growth is compounding.',
      signals: [
        `Subs +${subs7!.delta.toLocaleString()} (${(subs7!.pct * 100).toFixed(1)}%) in 7d.`,
        `${uploads30d} uploads / 30d, ${shorts30d} Shorts.`,
        convLine ?? (lastUp != null ? `Last upload ${lastUp}d ago.` : 'Recent upload window active.'),
      ],
      expectedImpact:
        'Staying the course while subs are lifting compounds the next moment — layering on top of what works is cheaper than manufacturing new reach.',
      ifIgnored:
        'Breaking cadence now resets the algorithm feedback loop; lift plateaus.',
      confidence,
    };
  }

  // ── 3b. ACCELERATE — strong conversion, cadence lagging ──────────────────
  // When every visitor is converting, the constraint is view volume, not
  // content quality. Push more uploads / pushes — the audience will convert.
  if (convStrong && !cold && convAnchor) {
    return {
      type: 'ACCELERATE',
      verdict: 'OPPORTUNITY',
      headline: 'Conversion is strong.',
      signals: [
        convLine!,
        `${uploads30d} uploads / 30d — cadence has headroom to push.`,
        subs7
          ? `Subs ${subs7.delta >= 0 ? '+' : ''}${subs7.delta.toLocaleString()} in 7d.`
          : 'Subscriber trend baselining.',
      ],
      expectedImpact:
        'When conversion is already strong, every extra 1,000 views translates predictably into subs — scaling Shorts or collabs is the cheapest unit of growth.',
      ifIgnored:
        'The channel keeps converting well but at low volume — a leverage opportunity goes unused.',
      confidence,
    };
  }

  // ── 4. MAINTAIN (default healthy) ────────────────────────────────────────
  // Strong cadence, no HIGH channel gap, no material drift → hold.
  if (strongCadence && highChannel.length === 0) {
    return {
      type: 'MAINTAIN',
      verdict: 'ON_TRACK',
      headline: 'Channel is warm. Keep current cadence.',
      signals: [
        `${uploads30d} uploads / 30d, ${shorts30d} Shorts.`,
        lastUp != null ? `Last upload ${lastUp}d ago.` : 'Recent upload window active.',
        subs7
          ? `Subs ${subs7.delta >= 0 ? '+' : ''}${subs7.delta.toLocaleString()} in 7d.`
          : 'Subscriber trend still baselining.',
      ],
      expectedImpact:
        'Holding a working plan protects the compounding effect going into the next drop.',
      ifIgnored:
        'Injecting extra formats or posts right now adds noise without new signal — effort with no lift.',
      confidence,
    };
  }

  // Soft middle: not broken, not strong — nudge one thing if there's a clear mid-impact gap.
  if (midChannel.length > 0) {
    const top = midChannel[0];
    return {
      type: 'CORRECT',
      verdict: 'DRIFT',
      headline: top.action,
      signals: [oppHeadline(top), `${uploads30d} uploads / 30d.`],
      expectedImpact: top.impactRange,
      ifIgnored:
        'Nothing urgent fails — the channel just keeps running at the current ceiling.',
      confidence,
    };
  }

  // Final default: healthy but quiet signals → MAINTAIN.
  return {
    type: 'MAINTAIN',
    verdict: 'ON_TRACK',
    headline: 'Hold the plan. No gap between reality and expectations.',
    signals: [
      `${uploads30d} uploads / 30d, ${shorts30d} Shorts.`,
      lastUp != null ? `Last upload ${lastUp}d ago.` : 'Upload window baseline.',
      subs7
        ? `Subs ${subs7.delta >= 0 ? '+' : ''}${subs7.delta.toLocaleString()} in 7d.`
        : 'Subscriber trend still baselining.',
    ],
    expectedImpact:
      'Staying the course preserves whatever lift the current plan is producing.',
    ifIgnored:
      'No downside — the channel continues at its current run-rate.',
    confidence,
  };
}
