/**
 * CAMPAIGN COACH — TOOL REGISTRY
 *
 * The complete surface the Grok Bot sees. Coach tools live here; research
 * tools are delegated to the researcher registry so there is one
 * implementation of each capability, not two.
 *
 * ── DESIGN RULE: CONCISE STRUCTURED RESPONSES, NOT RAW DUMPS ──────────
 * Every tool returns a shaped object sized for a model's context. Handing
 * a bot 3,000 raw uploads does not make it better informed, it makes it
 * worse — the signal is buried and the model starts pattern-matching noise.
 * Where detail is genuinely needed there is a narrower tool to ask for it.
 */

import { ARTISTS, mergeArtistLists, deriveFromLive, type Artist } from '../artists';
import { listCustomArtists } from '../artistStore';
import { readLiveSnapByHandle } from '../kvCache';
import { readHistory, deltaOver } from '../snapshots';
import { listPinned, type PinnedCampaign } from '../campaignStore';
import { callTool as callResearchTool, TOOL_SPECS as RESEARCH_SPECS } from '../researcher/tools';
import { fetchCatalogue, reconstruct } from '../researcher/catalogue';
import { readRecon, writeRecon } from '../researcher/store';
import { buildTimeline } from './timeline';
import { getHorizon } from './horizon';
import {
  listRecommendations, recordCoachFeedback, saveRecommendation,
  type CoachRecommendation,
} from './store';

export interface Ctx { baseUrl: string }

async function roster(): Promise<Artist[]> {
  return mergeArtistLists(ARTISTS, await listCustomArtists());
}

async function reconFor(baseUrl: string, a: Artist) {
  const cached = await readRecon(a.slug);
  if (cached) return cached;
  if (!a.channelHandle) throw new Error(`${a.slug} has no channelHandle`);
  const raw = await fetchCatalogue(baseUrl, a.channelHandle, { slim: false });
  const recon = reconstruct(a.slug, a.name, raw);
  await writeRecon(recon);
  return recon;
}

/* ── Coach tool specs ───────────────────────────────────────────────── */

export const COACH_SPECS = [
  {
    name: 'get_active_campaigns',
    description:
      'The candidate set of campaigns for triage: pinned campaigns plus any artist with a campaign start date. Returns compact per-campaign state including campaign day, whether it is inside the 7-14 day follow-up window, and whether forward release visibility exists. Use this to FILTER — most campaigns will need no intervention.',
    args: {},
  },
  {
    name: 'get_campaign_timeline',
    description:
      'THE CORE COACH TOOL. Living timeline for one artist: past assets with publish dates and formats, the current hero, days since it, follow-up window position, hero-to-hero gaps, known upcoming planned events, and explicit data notes. Read horizonKnown before recommending any new content.',
    args: { slug: 'string' },
  },
  {
    name: 'get_campaign_horizon',
    description:
      'WHAT IS PLANNED NEXT. Server-side forward campaign context: next major moment and days away, events in the next 7 / 7-14 / 30 day windows, planned long-form assets, and undated plans. Returns horizonConfidence (HIGH/MEDIUM/LOW/UNKNOWN) plus horizonReason. YOU MUST CALL THIS BEFORE ANY TIMING-SENSITIVE RECOMMENDATION. If confidence is LOW or UNKNOWN, do not give unqualified publishing timing.',
    args: { slug: 'string' },
  },
  {
    name: 'get_campaign_state',
    description:
      'Watcher deterministic state for one artist: channel health, classification, 7d and 30d channel movement from the daily snapshot series. This is LONGITUDINAL_OBSERVATION — the only true over-time data available.',
    args: { slug: 'string' },
  },
  {
    name: 'get_recent_video_performance',
    description:
      'The most recent uploads with CURRENT lifetime views and, for music videos, the ratio to this artist\'s own same-age hero median. These are lifetime snapshots, NOT velocity — never describe them as growth.',
    args: { slug: 'string', limit: 'number, optional' },
  },
  {
    name: 'get_coach_history',
    description:
      'Previous coaching recommendations for an artist WITH the human verdicts and reasons. Call this before recommending anything — if a similar call was already rejected, you need to know why.',
    args: { slug: 'string, optional' },
  },
  {
    name: 'record_coach_recommendation',
    description:
      'Persists a coaching recommendation and returns its id for human approve/modify/reject. Only call when something genuinely warrants ACTION_REQUIRED, DECISION_REQUIRED, OPPORTUNITY, RISK or an IMPORTANT LEARNING. If the campaign is behaving normally, do NOT record anything — say no intervention is required.',
    args: {
      artistSlug: 'string', status: 'ON_TRACK|WATCH|ACTION_REQUIRED|OPPORTUNITY|RISK',
      whatHappened: 'string', soWhat: 'string', recommendation: 'string', when: 'string',
      evidence: 'string', evidenceClasses: 'string[]', confidence: 'LOW|MEDIUM|HIGH',
      nextCheck: 'string', missingEvidence: 'string', producedBy: 'string',
    },
  },
  {
    name: 'record_coach_feedback',
    description:
      'Records the human verdict on a recommendation. reason is required for modify and reject — the reasoning is the valuable part.',
    args: {
      id: 'string', decision: 'approve|modify|reject', reason: 'string',
      missingContext: 'string, optional', candidateLearning: 'string, optional',
      modifiedRecommendation: 'string, optional',
    },
  },
] as const;

export const ALL_SPECS = [
  ...COACH_SPECS.map(s => ({ name: s.name, description: s.description, args: s.args as Record<string, string> })),
  ...RESEARCH_SPECS,
];

/* ── Dispatcher ─────────────────────────────────────────────────────── */

export async function callCoachTool(
  name: string,
  args: Record<string, any>,
  ctx: Ctx,
): Promise<unknown> {
  const list = await roster();
  const find = (slug: string) => list.find(a => a.slug === slug);

  switch (name) {
    case 'get_active_campaigns': {
      const pinned = await listPinned().catch(() => [] as PinnedCampaign[]);
      const pinnedSlugs = new Set(pinned.map((p: PinnedCampaign) => p.slug));
      const candidates = list.filter(a => pinnedSlugs.has(a.slug) || a.campaignStartDate);

      const out = [];
      for (const a of candidates.slice(0, 30)) {
        const snap = a.channelHandle ? await readLiveSnapByHandle(a.channelHandle) : null;
        const day = a.campaignStartDate
          ? Math.max(1, Math.floor((Date.now() - new Date(a.campaignStartDate).getTime()) / 86_400_000))
          : null;
        const h = await getHorizon(a.slug);
        out.push({
          slug: a.slug, name: a.name,
          campaign: a.campaign ?? null, campaignDay: day, phase: a.phase ?? null,
          pinned: pinnedSlugs.has(a.slug),
          lastUploadAt: snap?.lastUploadAt ?? null,
          daysSinceLastUpload: snap?.lastUploadAt
            ? Math.round((Date.now() - new Date(snap.lastUploadAt).getTime()) / 86_400_000) : null,
          uploads30d: snap?.uploads30d ?? null,
          nextPlanned: h.nextMajorMoment?.title ?? null,
          nextPlannedType: h.nextMajorMoment?.type ?? null,
          daysToNextPlanned: h.nextMajorMoment?.daysAway ?? null,
          horizonKnown: h.horizonKnown,
          horizonConfidence: h.horizonConfidence,
        });
      }
      return {
        n: out.length,
        campaigns: out,
        guidance: 'This is the CANDIDATE set, not a to-do list. Most of these will need no intervention. Filter to the few where something has actually changed, and say plainly that the rest are fine.',
      };
    }

    case 'get_campaign_horizon': {
      const a = find(args.slug);
      if (!a) return { error: `unknown artist ${args.slug}` };
      const h = await getHorizon(a.slug);
      return {
        ...h,
        artistName: a.name,
        campaignName: a.campaign ?? null,
        guidance: h.horizonKnown
          ? 'Forward plan is usable. Reason against these dates before recommending any new asset — check whether a major moment is close enough that new content would compete with it.'
          : 'Forward plan is NOT usable. Do not give an unqualified publishing-timing recommendation. Say what is missing and ask for the release schedule.',
      };
    }

    case 'get_campaign_timeline': {
      const a = find(args.slug);
      if (!a) return { error: `unknown artist ${args.slug}` };
      const recon = await reconFor(ctx.baseUrl, a);
      const tl = buildTimeline(a, recon);
      /* The persisted horizon is authoritative for FORWARD context and
         overrides the weak artist-record fallback baked into buildTimeline. */
      const h = await getHorizon(a.slug);
      return {
        ...tl,
        horizonKnown: h.horizonKnown,
        horizonConfidence: h.horizonConfidence,
        horizonReason: h.horizonReason,
        horizonSource: h.totalUpcoming ? 'campaign_horizon' : 'none',
        nextMajorMoment: h.nextMajorMoment,
        next7Days: h.next7Days,
        days7to14: h.days7to14,
        longFormPlannedIn7to14: h.longFormPlannedIn7to14,
        plannedLongFormNext30: h.plannedLongFormNext30,
        undatedPlans: h.undated,
        horizonWarnings: h.warnings,
        /* Trimmed: the model gets the shape, not 300 rows. */
        events: tl.events.slice(-40),
        eventsTruncated: Math.max(0, tl.events.length - 40),
      };
    }

    case 'get_campaign_state': {
      const a = find(args.slug);
      if (!a?.channelHandle) return { error: `unknown or handle-less artist ${args.slug}` };
      const snap = await readLiveSnapByHandle(a.channelHandle);
      if (!snap) return { error: 'no cached snapshot for this artist yet' };
      const hist = await readHistory((snap as any).channelId ?? '');
      const derived = deriveFromLive(snap, {});
      return {
        artistSlug: a.slug,
        evidenceClass: 'LONGITUDINAL_OBSERVATION',
        channelState: derived?.status ?? null,
        subs: snap.subs, views: snap.views,
        uploads30d: snap.uploads30d, shorts30d: snap.shorts30d,
        lastUploadAt: snap.lastUploadAt,
        historyDepthDays: hist.length,
        movement: hist.length >= 8 ? {
          subs7d: deltaOver(hist, 7, 'subs'),
          views7d: deltaOver(hist, 7, 'views'),
          subs30d: hist.length >= 31 ? deltaOver(hist, 30, 'subs') : null,
          views30d: hist.length >= 31 ? deltaOver(hist, 30, 'views') : null,
        } : null,
        note: hist.length < 8
          ? `Only ${hist.length} days of channel history. Movement claims are not supportable — say so rather than estimating.`
          : 'Movement figures are channel-level only. They cannot be attributed to any individual video.',
      };
    }

    case 'get_recent_video_performance': {
      const a = find(args.slug);
      if (!a) return { error: `unknown artist ${args.slug}` };
      const recon = await reconFor(ctx.baseUrl, a);
      const tl = buildTimeline(a, recon);
      const limit = Math.min(Number(args.limit ?? 10), 25);
      return {
        artistSlug: a.slug,
        evidenceClass: 'CURRENT_OBSERVATION',
        warning: 'Lifetime view totals as at fetch time. A newer asset has had less time to accumulate. Do NOT read these as velocity, first-week performance or growth.',
        uploads: tl.events
          .filter(e => e.status === 'happened')
          .slice(-limit)
          .map(e => ({
            date: e.date, daysAgo: Math.abs(e.daysFromNow), kind: e.kind,
            title: e.title, currentViews: e.currentViews,
            vsOwnBaseline: e.vsOwnBaseline == null ? null : Number(e.vsOwnBaseline.toFixed(2)),
          })),
      };
    }

    case 'get_coach_history': {
      const recs = await listRecommendations(args.slug);
      return {
        n: recs.length,
        recommendations: recs.slice(0, 20).map(r => ({
          id: r.id, at: r.createdAt, artistSlug: r.artistSlug,
          status: r.status, recommendation: r.recommendation,
          confidence: r.confidence,
          humanDecision: r.feedback?.decision ?? 'pending',
          humanReason: r.feedback?.reason ?? null,
          missingContext: r.feedback?.missingContext ?? null,
          candidateLearning: r.feedback?.candidateLearning ?? null,
        })),
        guidance: 'Rejections are campaign context, not universal rules. A reason that was valid last month may not apply now — re-check the timeline rather than assuming the constraint still holds.',
      };
    }

    case 'record_coach_recommendation': {
      const a = find(args.artistSlug);
      if (!a) return { error: `unknown artist ${args.artistSlug}` };
      if (!args.missingEvidence || String(args.missingEvidence).trim().length < 10) {
        return { error: 'missingEvidence is required — state what you could not see. If you believe nothing is missing, say so explicitly and why.' };
      }
      const day = a.campaignStartDate
        ? Math.max(1, Math.floor((Date.now() - new Date(a.campaignStartDate).getTime()) / 86_400_000))
        : null;
      const rec: CoachRecommendation = {
        id: `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
        artistSlug: a.slug, artistName: a.name,
        campaignName: a.campaign ?? null, campaignDay: day, phase: a.phase ?? null,
        status: args.status ?? 'WATCH',
        whatHappened: String(args.whatHappened ?? ''),
        soWhat: String(args.soWhat ?? ''),
        recommendation: String(args.recommendation ?? ''),
        when: String(args.when ?? ''),
        evidence: String(args.evidence ?? ''),
        evidenceClasses: args.evidenceClasses ?? [],
        confidence: args.confidence ?? 'LOW',
        nextCheck: String(args.nextCheck ?? ''),
        missingEvidence: String(args.missingEvidence),
        producedBy: String(args.producedBy ?? 'grok'),
      };
      await saveRecommendation(rec);
      return { stored: true, id: rec.id, reviewUrl: `${ctx.baseUrl}/coach-bot#${rec.id}` };
    }

    case 'record_coach_feedback': {
      if (!args.id || !args.decision) return { error: 'id and decision required' };
      if (args.decision !== 'approve' && !String(args.reason ?? '').trim()) {
        return { error: 'reason is required when modifying or rejecting' };
      }
      const updated = await recordCoachFeedback(args.id, {
        decision: args.decision,
        reason: String(args.reason ?? ''),
        missingContext: args.missingContext,
        candidateLearning: args.candidateLearning,
        modifiedRecommendation: args.modifiedRecommendation,
        at: new Date().toISOString(),
      });
      if (!updated) return { error: 'recommendation not found' };
      return { stored: true, id: updated.id, decision: updated.feedback?.decision };
    }

    default:
      /* Anything not a coach tool is a research tool. */
      return callResearchTool(name, args, ctx);
  }
}
