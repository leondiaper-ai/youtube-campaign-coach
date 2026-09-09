/**
 * THE ASSISTANT HOME — DATA ASSEMBLY
 *
 * One question, answered from stores that already exist:
 *
 *   What has my YouTube assistant done for me?
 *
 * ── TWO RULES THIS FILE ENFORCES ─────────────────────────────────────
 *
 * 1. Reading the page costs nothing. Every field below comes from Redis.
 *    No model call, no YouTube call. Work happens when the strategist
 *    presses a button, never because they opened a tab.
 *
 * 2. Nothing is invented to fill a section. If Scout has found nothing,
 *    the page says Scout has found nothing and shows what it is currently
 *    researching instead. An assistant that manufactures a finding to look
 *    busy is worse than an empty one, because the empty one can still be
 *    trusted.
 */

import { ARTISTS, mergeArtistLists, type Artist } from '../artists';
import { listCustomArtists } from '../artistStore';
import { listPinned } from '../campaignStore';
import { readOverview } from '../coach-service/store';
import type { CoachOverview } from '../coach-service/types';
import { listCaseStudies, listRecentFindings } from '../knowledge/store';
import { listScoutChannels } from '../scout/channelStore';
import { listRunSummaries, scoutActivity } from '../scout/runStore';
import { MISSIONS, ACTIVE_MISSIONS } from '../scout/missions';
import type { Finding, CaseStudy } from '../knowledge/types';
import type { ScoutChannel } from '../scout/types';

/* ── My campaigns ────────────────────────────────────────────────────── */

export type ReportStatus = 'READY' | 'NEEDS_REFRESH' | 'NOT_GENERATED';

/** A read older than this has probably been overtaken by the campaign. */
const STALE_HOURS = 72;

export interface CampaignRow {
  slug: string;
  name: string;
  campaignName: string | null;
  reportStatus: ReportStatus;
  /** Present only when a read exists. */
  read: {
    headline: string;
    status: string;
    confidence: string;
    next: string;
    generatedAt: string;
    ageHours: number;
  } | null;
  /** Deterministic, from the roster. Not a model opinion. */
  campaignDay: number | null;
}

function ageHours(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
}

function campaignDay(a: Artist): number | null {
  if (!a.campaignStartDate) return null;
  const d = Math.floor((Date.now() - new Date(a.campaignStartDate).getTime()) / 86_400_000);
  return d >= 0 ? d : null;
}

async function campaignRows(): Promise<{ rows: CampaignRow[]; overviews: Record<string, CoachOverview> }> {
  const artists = mergeArtistLists(ARTISTS, await listCustomArtists());
  const pinned = await listPinned();

  /* Pinned campaigns are the strategist's own priority list, so they are
     the right scope. Falling back to "anything with a campaign" would
     reintroduce the whole roster, which is what Channel Health is for. */
  const bySlug = new Map(artists.map(a => [a.slug, a]));
  const scope = pinned
    .map(p => bySlug.get(p.slug))
    .filter((a): a is Artist => !!a);

  const overviews: Record<string, CoachOverview> = {};
  const rows: CampaignRow[] = [];

  const reads = await Promise.all(scope.map(async a => ({ a, o: await readOverview(a.slug) })));

  for (const { a, o } of reads) {
    if (o) overviews[a.slug] = o;
    const age = o ? ageHours(o.generatedAt) : null;
    rows.push({
      slug: a.slug,
      name: a.name,
      campaignName: a.campaign ?? null,
      reportStatus: !o ? 'NOT_GENERATED' : (age! > STALE_HOURS ? 'NEEDS_REFRESH' : 'READY'),
      read: o ? {
        headline: o.headline,
        status: o.status,
        confidence: o.confidence,
        next: o.recommendation,
        generatedAt: o.generatedAt,
        ageHours: age!,
      } : null,
      campaignDay: campaignDay(a),
    });
  }

  /* Campaigns needing attention first, then ones with a ready read, then
     the rest. The strategist should not have to scan for the one that
     changed. */
  const rank = (r: CampaignRow) => {
    if (r.read && (r.read.status === 'ACTION_REQUIRED' || r.read.status === 'RISK')) return 0;
    if (r.read && (r.read.status === 'OPPORTUNITY' || r.read.status === 'WATCH')) return 1;
    if (r.reportStatus === 'READY') return 2;
    if (r.reportStatus === 'NEEDS_REFRESH') return 3;
    return 4;
  };
  rows.sort((a, b) => rank(a) - rank(b));

  return { rows, overviews };
}

/* ── Scout ───────────────────────────────────────────────────────────── */

export interface ScoutSection {
  /** Material discoveries. Empty is a legitimate and common state. */
  found: { finding: Finding; caseStudy: CaseStudy | null }[];
  /** Channels qualified and being observed, not yet resolved either way. */
  watching: {
    channelId: string;
    title: string;
    missions: string[];
    whyWatching: string;
    observationCount: number;
    lastObservedAt: string | null;
  }[];
  missions: {
    id: string;
    question: string;
    channelsDiscovered: number;
    channelsWatched: number;
    investigations: number;
    findings: number;
    caseStudies: number;
  }[];
  activity: Awaited<ReturnType<typeof scoutActivity>>;
  universeSize: number;
}

async function scoutSection(): Promise<ScoutSection> {
  const [findings, caseStudies, channels, runs, activity] = await Promise.all([
    listRecentFindings(40),
    listCaseStudies(),
    listScoutChannels(400),
    listRunSummaries(20),
    scoutActivity(7),
  ]);

  const csByFinding = new Map(caseStudies.map(c => [c.sourceFindingId ?? '', c]));

  const found = findings
    .filter(f => f.origin === 'SCOUT' && f.status !== 'DISMISSED')
    .slice(0, 5)
    .map(f => ({ finding: f, caseStudy: csByFinding.get(f.id) ?? null }));

  /* WATCHING is the difference between a research system and a chatbot: it
     shows Scout holding a lead open across runs rather than producing a
     one-off answer and forgetting it. */
  const watching = channels
    .filter(c => c.status === 'WATCHING' || c.status === 'INTERESTING')
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 8)
    .map((c: ScoutChannel) => ({
      channelId: c.channelId,
      title: c.title,
      missions: c.missionIds,
      whyWatching: c.whyWatching,
      observationCount: c.observationCount,
      lastObservedAt: c.lastObservedAt,
    }));

  const perMission = ACTIVE_MISSIONS.map(m => {
    const totals = { discovered: 0, investigations: 0, findings: 0, caseStudies: 0 };
    for (const r of runs) {
      for (const rm of r.missions) {
        if (rm.missionId !== m.id) continue;
        totals.discovered += rm.uniqueChannels;
        totals.investigations += rm.investigated;
        totals.findings += rm.findings;
        totals.caseStudies += rm.caseStudies;
      }
    }
    return {
      id: m.id,
      question: m.question,
      channelsDiscovered: totals.discovered,
      channelsWatched: channels.filter(c => c.missionIds.includes(m.id)).length,
      investigations: totals.investigations,
      findings: totals.findings,
      caseStudies: totals.caseStudies,
    };
  });

  return {
    found,
    watching,
    missions: perMission,
    activity,
    universeSize: channels.length,
  };
}

/* ── Today ───────────────────────────────────────────────────────────── */

export interface TodayLine {
  text: string;
  /** True when it warrants the eye. Most lines are just status. */
  attention: boolean;
}

/**
 * Deliberately not a signal feed. Watcher already reports cadence, views
 * and subscriber movement, and it reports them better. This says only what
 * the ASSISTANT has done, is holding, or has found.
 */
function todayLines(rows: CampaignRow[], scout: ScoutSection): TodayLine[] {
  const out: TodayLine[] = [];

  const ready = rows.filter(r => r.reportStatus === 'READY').length;
  const needsAttention = rows.filter(
    r => r.read && (r.read.status === 'ACTION_REQUIRED' || r.read.status === 'RISK'),
  ).length;
  const stale = rows.filter(r => r.reportStatus === 'NEEDS_REFRESH').length;
  const missing = rows.filter(r => r.reportStatus === 'NOT_GENERATED').length;

  out.push({ text: ready === 1 ? '1 campaign read ready' : `${ready} campaign reads ready`, attention: false });
  if (needsAttention) {
    out.push({
      text: needsAttention === 1 ? '1 campaign may need attention' : `${needsAttention} campaigns may need attention`,
      attention: true,
    });
  }
  if (stale) out.push({ text: `${stale} read${stale === 1 ? '' : 's'} older than 3 days`, attention: false });
  if (missing) out.push({ text: `${missing} campaign${missing === 1 ? '' : 's'} with no read yet`, attention: false });

  const w = scout.watching.length;
  out.push({
    text: w
      ? `Scout is following ${w} external investigation${w === 1 ? '' : 's'}`
      : 'Scout has no open investigations',
    attention: false,
  });

  out.push({
    text: scout.found.length
      ? `${scout.found.length} Scout finding${scout.found.length === 1 ? '' : 's'} to review`
      : 'No material Scout findings yet',
    attention: scout.found.length > 0,
  });

  return out;
}

/* ── The payload ─────────────────────────────────────────────────────── */

export interface AssistantHome {
  generatedAt: string;
  today: TodayLine[];
  campaigns: CampaignRow[];
  /** Full reads, keyed by slug, so opening a report needs no second call. */
  overviews: Record<string, CoachOverview>;
  scout: ScoutSection;
  /** Missions that exist but are not running, with the reason. */
  inactiveMissions: { id: string; question: string; rationale: string }[];
  lastScoutRun: string | null;
}

export async function buildAssistantHome(): Promise<AssistantHome> {
  const [{ rows, overviews }, scout] = await Promise.all([campaignRows(), scoutSection()]);

  return {
    generatedAt: new Date().toISOString(),
    today: todayLines(rows, scout),
    campaigns: rows,
    overviews,
    scout,
    inactiveMissions: MISSIONS.filter(m => !m.active).map(m => ({
      id: m.id, question: m.question, rationale: m.rationale,
    })),
    lastScoutRun: scout.activity.lastRunAt,
  };
}
