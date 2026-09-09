/**
 * QUALIFICATION — rejecting aggressively, and saying why
 *
 * Discovery produces hundreds of channels. The model must see almost none
 * of them. This module is the difference between a research system and an
 * expensive random walk.
 *
 * Two tiers, matching the quota arithmetic:
 *
 *   TRIAGE   from a batched channels.list — 1 unit per fifty channels.
 *            Rejects on size, dormancy, upload count, roster overlap and
 *            whether this looks like an artist channel at all. Most
 *            candidates die here, having cost essentially nothing.
 *
 *   ASSESS   from the catalogue — about 4 units per surviving channel.
 *            Applies the mission's own test: does this channel actually
 *            exhibit the behaviour the mission is asking about?
 *
 * Every rejection is recorded with the figure that caused it. A rejection
 * you cannot re-check is indistinguishable from a bug, and the rejections
 * are also the evidence that the funnel is working.
 */

import type { ChannelSummary } from '../youtube/discovery';
import type { ChannelProfile, Rejection, RejectionReason } from './types';
import type { MissionId } from './missions';

export const Q = {
  /** Below this a channel has too little behaviour to read. */
  minVideoCount: 12,
  /** Not a quality bar — a "is anyone watching this at all" bar. */
  minSubs: 5_000,
  /** Silent for this long and there is no current campaign to observe. */
  dormantDays: 270,
  /** The catalogue window we pull per qualified channel. */
  uploadWindow: 100,

  /* Mission tests. */
  postHeroMinFollowUps: 2,
  multiFormatMinDistinct: 4,
  multiFormatMinLongform: 8,
  liveMinCount: 3,
  liveMinShare: 0.08,
} as const;

/* ── Tier 1: triage from channels.list alone ─────────────────────────── */

/**
 * "Is this an artist channel?" has no API field, so this is a heuristic
 * over title and description, and it is written to reject the things that
 * dominate a music search — compilations, reaction channels, karaoke,
 * topic auto-channels and label aggregators.
 *
 * It will occasionally reject a real artist. That is the right direction
 * to be wrong in: a missed artist costs nothing, while a karaoke channel
 * reaching the model costs a 15k-token investigation and produces a
 * finding about karaoke.
 */
const NOT_ARTIST = new RegExp(
  [
    'topic$', 'vevo\\s*compilation', 'karaoke', 'lyrics?\\s*(channel|world|hub)',
    'reaction', 'react\\b', 'playlist', 'compilation', 'mix\\s*(tape)?\\s*(channel|hub)',
    '\\bradio\\b', '\\bnews\\b', 'podcast', 'tutorial', 'cover(s)?\\s*channel',
    'best\\s*of\\s*\\d{4}', 'top\\s*\\d+\\s*songs', 'nightcore', 'slowed\\s*\\+?\\s*reverb',
    '\\b(records|recordings|music group|entertainment)\\b',
  ].join('|'),
  'i',
);

export function triage(
  c: ChannelSummary,
  ctx: { rosterIds: Set<string>; alreadyScouted: Set<string>; reobserve?: boolean },
): Rejection | null {
  const rej = (reason: RejectionReason, detail: string): Rejection => ({
    channelId: c.channelId, channelTitle: c.title, reason, detail,
  });

  if (ctx.rosterIds.has(c.channelId)) {
    return rej('ALREADY_IN_ROSTER', 'This channel is already on the Watcher roster.');
  }
  /* Skipping known channels is right for a discovery sweep and wrong for
     an observation pass — the universe only becomes valuable by being
     looked at again. */
  if (!ctx.reobserve && ctx.alreadyScouted.has(c.channelId)) {
    return rej('ALREADY_IN_SCOUT', 'Already in the Scout universe from an earlier run.');
  }
  if (!c.uploadsPlaylistId) {
    return rej('NO_UPLOADS_PLAYLIST', 'No uploads playlist — nothing to analyse.');
  }
  if (NOT_ARTIST.test(c.title) || NOT_ARTIST.test(c.description.slice(0, 300))) {
    return rej('NOT_AN_ARTIST_CHANNEL', `Title or description matches a non-artist pattern: "${c.title}"`);
  }
  if ((c.videoCount ?? 0) < Q.minVideoCount) {
    return rej('TOO_FEW_UPLOADS', `${c.videoCount ?? 0} uploads, below the ${Q.minVideoCount} needed to read behaviour.`);
  }
  /* Null subs means hidden, not zero. Hidden is not a reason to reject. */
  if (c.subs != null && c.subs < Q.minSubs) {
    return rej('CHANNEL_TOO_SMALL', `${c.subs.toLocaleString()} subscribers, below ${Q.minSubs.toLocaleString()}.`);
  }
  return null;
}

/* ── Tier 2: the mission's own test, from the catalogue ──────────────── */

export interface MissionVerdict {
  passed: boolean;
  /** One line with figures — the deterministic case for investigating. */
  evidence: string;
  /** 0–1, orders the investigation queue. */
  score: number;
  reason?: RejectionReason;
  detail?: string;
}

function scale(v: number, soft: number, hard: number): number {
  if (v <= soft) return 0;
  return Math.min(1, (v - soft) / (hard - soft));
}

export function testMission(
  missionId: MissionId, p: ChannelProfile, title: string,
): MissionVerdict {
  const now = Date.now();
  const lastUpload = p.windowEnd ? new Date(p.windowEnd).getTime() : 0;
  const dormantDays = lastUpload ? Math.floor((now - lastUpload) / 86_400_000) : 9999;

  if (dormantDays > Q.dormantDays) {
    return {
      passed: false, evidence: '', score: 0,
      reason: 'DORMANT',
      detail: `Last upload ${dormantDays} days ago — no current campaign to observe.`,
    };
  }

  if (missionId === 'POST_HERO') {
    const ph = p.postHero;
    if (!ph) {
      return {
        passed: false, evidence: '', score: 0,
        reason: 'NO_RELEVANT_FORMATS',
        detail: 'No upload in the analysed window classifies as a hero release.',
      };
    }
    if (ph.longFormWithin21d < Q.postHeroMinFollowUps) {
      return {
        passed: false, evidence: '', score: 0,
        reason: 'MISSION_TEST_FAILED',
        detail: `Only ${ph.longFormWithin21d} long-form upload(s) in the 21 days after "${ph.heroTitle}"; needs ${Q.postHeroMinFollowUps}.`,
      };
    }
    return {
      passed: true,
      evidence:
        `${ph.longFormWithin21d} long-form uploads in the 21 days after the hero "${ph.heroTitle}" ` +
        `(${ph.heroPublishedAt.slice(0, 10)}); ${ph.followUps.length} uploads within 60 days.`,
      score: scale(ph.longFormWithin21d, 1, 6),
    };
  }

  if (missionId === 'MULTI_FORMAT') {
    if (p.longformCount < Q.multiFormatMinLongform) {
      return {
        passed: false, evidence: '', score: 0,
        reason: 'NO_RELEVANT_FORMATS',
        detail: `${p.longformCount} long-form uploads, below the ${Q.multiFormatMinLongform} needed to read a format system.`,
      };
    }
    if (p.distinctFormats < Q.multiFormatMinDistinct) {
      return {
        passed: false, evidence: '', score: 0,
        reason: 'MISSION_TEST_FAILED',
        detail: `${p.distinctFormats} distinct formats, below ${Q.multiFormatMinDistinct}.`,
      };
    }
    const mix = Object.entries(p.formatCounts)
      .sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(', ');
    return {
      passed: true,
      evidence: `${p.distinctFormats} distinct formats across ${p.uploadsAnalysed} uploads — ${mix}.`,
      score: scale(p.distinctFormats, 3, 8),
    };
  }

  if (missionId === 'LIVE') {
    const share = p.uploadsAnalysed ? p.liveCount / p.uploadsAnalysed : 0;
    if (p.liveCount < Q.liveMinCount) {
      return {
        passed: false, evidence: '', score: 0,
        reason: 'NO_RELEVANT_FORMATS',
        detail: `${p.liveCount} live/performance uploads, below ${Q.liveMinCount}.`,
      };
    }
    if (share < Q.liveMinShare) {
      return {
        passed: false, evidence: '', score: 0,
        reason: 'MISSION_TEST_FAILED',
        detail: `Live is ${(share * 100).toFixed(1)}% of uploads, below the ${(Q.liveMinShare * 100).toFixed(0)}% that suggests deliberate use.`,
      };
    }
    return {
      passed: true,
      evidence:
        `${p.liveCount} live/performance uploads of ${p.uploadsAnalysed} analysed ` +
        `(${(share * 100).toFixed(0)}%), alongside ${p.heroes.length} hero release(s).`,
      score: scale(share, Q.liveMinShare, 0.4),
    };
  }

  return {
    passed: false, evidence: '', score: 0,
    reason: 'MISSION_TEST_FAILED',
    detail: `Mission ${missionId} has no deterministic test — it is not active in V1.`,
  };
}
