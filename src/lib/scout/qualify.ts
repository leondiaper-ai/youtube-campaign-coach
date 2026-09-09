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
import { checkArtistChannel, type ArtistVerdict } from './artistCheck';

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
  /** Distinct NON-SHORT formats around a single hero. */
  multiFormatMinAroundHero: 3,
  /** Heroes that must show that clustering, so it is architecture not luck. */
  multiFormatMinHeroes: 2,
  liveMinCount: 3,
  liveMinShare: 0.08,
} as const;

/* ── Tier 1: triage from channels.list alone ─────────────────────────── */

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
  /* Triage has no upload titles yet, so this can only reject the clear
     cases. Ambiguity is resolved later, against real titles. */
  const artist = checkArtistChannel(c);
  if (artist.verdict === 'NON_ARTIST') {
    return rej('NOT_AN_ARTIST_CHANNEL', artist.reason);
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
    /* The question is whether formats are deployed AROUND A RELEASE, not
       whether the channel posts a variety of things. The first version
       asked the second question and consequently qualified label
       aggregators, whose whole business is posting a variety of things. */
    const windows = (p.releaseWindows ?? []).filter(
      w => w.supportFormats.length >= Q.multiFormatMinAroundHero,
    );

    if (!(p.releaseWindows ?? []).length) {
      return {
        passed: false, evidence: '', score: 0,
        reason: 'NO_RELEVANT_FORMATS',
        detail: 'No hero release in the analysed window to cluster formats around.',
      };
    }
    if (windows.length < Q.multiFormatMinHeroes) {
      const best = (p.releaseWindows ?? [])
        .reduce((a, b) => (a && a.supportFormats.length >= b.supportFormats.length ? a : b));
      return {
        passed: false, evidence: '', score: 0,
        reason: 'MISSION_TEST_FAILED',
        detail:
          `${windows.length} of ${(p.releaseWindows ?? []).length} releases had ` +
          `${Q.multiFormatMinAroundHero}+ distinct support formats within −7/+21 days ` +
          `(best: "${best.heroTitle}" with ${best.supportFormats.length}). ` +
          `Needs ${Q.multiFormatMinHeroes} to read as repeated architecture.`,
      };
    }

    const detail = windows.slice(0, 3).map(w =>
      `"${w.heroTitle}" (${w.heroDate.slice(0, 10)}): ${w.supportFormats.join(', ')}`,
    ).join('; ');

    return {
      passed: true,
      evidence:
        `${windows.length} releases with ${Q.multiFormatMinAroundHero}+ distinct support formats ` +
        `inside a −7/+21 day window — ${detail}.`,
      score: scale(windows.length, 1, 5),
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
