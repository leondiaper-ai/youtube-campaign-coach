/**
 * Nudge Engine
 *
 * Generates contextual "what needs attention now" nudges based on:
 * - Matched execution state (what's done, missing, late)
 * - Channel state (healthy, cold, weak conversion, etc.)
 * - Campaign timeline position (which phase, how far through)
 * - Recent upload patterns (cadence, content mix)
 *
 * Nudges are ranked by urgency and capped at 3 to avoid overload.
 */

import type { MatchResult, MatchedAction, MatchedWeek } from './matchEngine';
import type { ChannelContext, PhaseName } from '../planEngine';
import type { ChannelState } from '../artists';

// ── Types ─────────────────────────────────────────────────────────────────

export type NudgeUrgency = 'critical' | 'important' | 'suggestion';

export type Nudge = {
  id: string;
  urgency: NudgeUrgency;
  title: string;
  detail: string;
  /** Which actions triggered this nudge (if any) */
  relatedActions?: MatchedAction[];
};

export type NudgeContext = {
  matchResult: MatchResult;
  channelCtx: ChannelContext | null;
  currentPhase: PhaseName | null;
  /** Live channel metrics */
  liveMetrics?: {
    subs?: number;
    views7Delta?: number | null;
    subs7Delta?: number | null;
    uploads30d?: number;
    shorts30d?: number;
    lastUploadDaysAgo?: number;
  } | null;
};

// ── Main function ─────────────────────────────────────────────────────────

const MAX_NUDGES = 3;

export function generateNudges(ctx: NudgeContext): Nudge[] {
  const nudges: Nudge[] = [];
  const { matchResult, channelCtx, currentPhase, liveMetrics } = ctx;

  // ── 1. Late actions (critical) ──────────────────────────────────────
  const lateActions = matchResult.weeks
    .flatMap((w) => w.actions)
    .filter((a) => a.status === 'late');

  if (lateActions.length > 0) {
    const mostLate = lateActions.sort(
      (a, b) => (b.daysFromDue ?? 0) - (a.daysFromDue ?? 0)
    )[0];
    const days = mostLate.daysFromDue ?? 0;
    nudges.push({
      id: 'late-actions',
      urgency: 'critical',
      title: `${lateActions.length} action${lateActions.length > 1 ? 's' : ''} overdue`,
      detail: lateActions.length === 1
        ? `"${mostLate.title}" is ${days} days overdue. Upload it now or remove it from the plan.`
        : `Most overdue: "${mostLate.title}" (${days} days). Review and either upload or adjust the plan.`,
      relatedActions: lateActions.slice(0, 3),
    });
  }

  // ── 2. Missing actions (important) ──────────────────────────────────
  const missingActions = matchResult.weeks
    .flatMap((w) => w.actions)
    .filter((a) => a.status === 'missing');

  if (missingActions.length > 0 && lateActions.length === 0) {
    nudges.push({
      id: 'missing-actions',
      urgency: 'important',
      title: `${missingActions.length} planned upload${missingActions.length > 1 ? 's' : ''} not found`,
      detail: `"${missingActions[0].title}" was expected but hasn't appeared yet. It may be slightly delayed or titled differently.`,
      relatedActions: missingActions.slice(0, 3),
    });
  }

  // ── 3. Channel gone cold during campaign (critical) ─────────────────
  const state = channelCtx?.state as ChannelState | undefined;
  const lastUploadDays = liveMetrics?.lastUploadDaysAgo ?? channelCtx?.lastUploadDaysAgo;

  if (lastUploadDays != null && lastUploadDays > 14) {
    nudges.push({
      id: 'channel-cold',
      urgency: 'critical',
      title: 'Channel has gone silent',
      detail: `No uploads in ${lastUploadDays} days. The campaign plan is running but the channel isn't. Upload something — even a short — to restart momentum.`,
    });
  }

  // ── 4. Low execution rate (important) ───────────────────────────────
  const { stats } = matchResult;
  const pastDueCount = stats.completed + stats.live + stats.missing + stats.late;
  if (pastDueCount >= 3 && stats.completionRate < 40) {
    nudges.push({
      id: 'low-execution',
      urgency: 'important',
      title: `Only ${Math.round(stats.completionRate)}% of planned content uploaded`,
      detail: 'The plan is significantly behind. Consider simplifying — focus on the highest-impact actions and remove the rest.',
    });
  }

  // ── 5. Weak conversion during SCALE/EXTEND (important) ──────────────
  if (
    state === 'WEAK CONVERSION' &&
    (currentPhase === 'SCALE' || currentPhase === 'EXTEND')
  ) {
    nudges.push({
      id: 'weak-conversion',
      urgency: 'important',
      title: 'Views aren\'t converting to subscribers',
      detail: 'The channel is getting attention but not growing. Add a clear call-to-action, pin a subscribe comment, and consider a "best of" compilation short.',
    });
  }

  // ── 6. Upcoming this week (suggestion) ──────────────────────────────
  const upcomingThisWeek = matchResult.weeks
    .flatMap((w) => w.actions)
    .filter((a) => {
      if (a.status !== 'planned') return false;
      const d = a.daysFromDue;
      return d != null && d >= -7 && d <= 0;
    });

  if (upcomingThisWeek.length > 0 && nudges.length < MAX_NUDGES) {
    const nextUp = upcomingThisWeek[0];
    const daysUntil = Math.abs(nextUp.daysFromDue ?? 0);
    nudges.push({
      id: 'upcoming-this-week',
      urgency: 'suggestion',
      title: `Next up: "${nextUp.title}"`,
      detail: daysUntil === 0
        ? 'This is due today.'
        : `Due in ${daysUntil} day${daysUntil > 1 ? 's' : ''}. Start preparing if you haven't already.`,
      relatedActions: [nextUp],
    });
  }

  // ── 7. No shorts in BUILD phase (suggestion) ───────────────────────
  if (currentPhase === 'BUILD') {
    const shortsUploaded = matchResult.weeks
      .flatMap((w) => w.actions)
      .filter((a) => a.format === 'short' && (a.status === 'completed' || a.status === 'live'))
      .length;

    const shortsLive = liveMetrics?.shorts30d ?? 0;

    if (shortsUploaded === 0 && shortsLive < 2 && nudges.length < MAX_NUDGES) {
      nudges.push({
        id: 'no-shorts-build',
        urgency: 'suggestion',
        title: 'No shorts yet in BUILD phase',
        detail: 'Shorts during BUILD create the audience warm-up that makes releases land harder. Start with behind-the-scenes clips or teasers.',
      });
    }
  }

  // ── 8. Lots of extra uploads — channel is active beyond the plan ────
  if (stats.extraUploads > 3 && nudges.length < MAX_NUDGES) {
    nudges.push({
      id: 'extra-uploads',
      urgency: 'suggestion',
      title: `${stats.extraUploads} uploads outside the plan`,
      detail: 'The channel is more active than the plan accounts for. Consider updating the plan to reflect what\'s actually happening.',
    });
  }

  // ── 9. Phase-specific channel state nudges ──────────────────────────
  if (state === 'COLD' && currentPhase === 'BUILD' && nudges.length < MAX_NUDGES) {
    nudges.push({
      id: 'cold-build',
      urgency: 'important',
      title: 'Channel is cold entering BUILD',
      detail: 'Start with 2-3 low-effort shorts to signal the algorithm you\'re active before ramping up to larger content.',
    });
  }

  if (state === 'AT RISK' && nudges.length < MAX_NUDGES) {
    nudges.push({
      id: 'at-risk',
      urgency: 'important',
      title: 'Channel health is at risk',
      detail: 'Upload cadence has dropped off. The campaign plan only works if content keeps flowing. Prioritise getting something live this week.',
    });
  }

  // Sort by urgency (critical first) and cap
  const urgencyOrder: Record<NudgeUrgency, number> = {
    critical: 0,
    important: 1,
    suggestion: 2,
  };

  return nudges
    .sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])
    .slice(0, MAX_NUDGES);
}
