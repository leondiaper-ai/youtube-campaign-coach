/**
 * DETERMINISTIC TRIAGE
 *
 * Runs across the whole roster. Costs nothing: no YouTube API call, no
 * model call, no catalogue reconstruction. Everything here comes out of
 * stores we already write to on a cron —
 *
 *   snap:{channelId}          180 days of daily channel snapshots
 *   weekly-snapshots:{slug}   52 weeks of classification + WoW
 *   live:{channelId}          the last cached LiveSnap
 *   horizon / planStore       dated forward moments
 *
 * ── WHY THAT CONSTRAINT MATTERS ───────────────────────────────────────
 * It is what lets this scale. At 177 channels the scan is a few chunked
 * Redis reads; at 2,000 it is more of the same, and the expensive stage
 * downstream still only sees a handful of artists. If the scan needed the
 * YouTube API we would be rate-limited at roughly this roster size, and if
 * it needed a model we would be paying £5 a morning to be told that 170
 * channels are behaving normally.
 *
 * ── ON THE SIGNALS THAT ARE NOT HERE ──────────────────────────────────
 * Campaign phase transition is absent because `artist.phase` is a static
 * seed field — 133 of 177 artists are 'PRE', which is a default rather than
 * an observation. Format-mix change is absent because it needs the
 * catalogue, which is an API call per artist; it belongs in the
 * investigation stage, and the investigator has the tools for it.
 *
 * Every threshold below is deliberately blunt and stated in one place, so
 * that when the scan is too noisy there is one file to tune.
 */

import { ARTISTS, mergeArtistLists, isManaged, type Artist } from '../artists';
import { listCustomArtists } from '../artistStore';
import { readAllLiveSnaps, type CachedSnap } from '../kvCache';
import { readHistories, deltaOver, type ChannelSnapshot } from '../snapshots';
import { getRecentSnapshots, type WeeklyChannelSnapshot } from '../weeklySnapshotStore';
import { getHorizon } from '../coach-bot/horizon';
import { classifyUploadFormat } from '../formatClassifier';
import type { Candidate, Signal, SignalType } from './types';

/* ── Thresholds. One place. ──────────────────────────────────────────── */

/**
 * These were calibrated against a real full-roster scan, not chosen in the
 * abstract. The first pass fired on 117 of 177 channels, which is not a
 * triage layer — it is the roster with extra steps. What the data showed:
 *
 *   cadence   26 of 63 hits were swings of fewer than 6 uploads
 *   quiet     15 of 44 hits were 31–43 days, which is an ordinary gap
 *             between campaigns for a music channel
 *   asset     ratios ran from 2.4× to 342×; the 342× was a channel whose
 *             recent long-form median was near zero, so the ratio measured
 *             the emptiness of the baseline rather than the strength of the
 *             asset
 *
 * So every threshold below now requires BOTH a relative and an absolute
 * move. A ratio on its own is a measure of how small the denominator was.
 */
export const T = {
  /** Week-over-week view-delta ratio that counts as acceleration. */
  viewAccelRatio: 2.0,
  /** …and deceleration. Both need a non-trivial prior week to be meaningful. */
  viewDecelRatio: 0.4,
  /** Below this, a 7-day view delta is too small for a ratio to mean anything. */
  minViewDelta: 500,
  /** Subscriber move as a share of base that counts as a surge. */
  subsSurgePct: 0.02,
  /** …with an absolute floor, so tiny channels don't dominate. */
  subsSurgeAbs: 100,
  /** Net subscriber loss over 7d. Any loss is worth noticing. */
  subsDeclineAbs: -25,
  /** Upload-count change over 30d. Both conditions must hold. */
  cadenceDelta: 6,
  cadenceRatio: 2.0,
  /** A cadence signal on a near-silent baseline needs real volume now. */
  cadenceMinActive: 8,
  /** Days of silence before "went quiet" fires. A month is an ordinary gap. */
  quietDays: 60,
  /** …and only where the channel previously sustained real activity. */
  quietPriorUploads: 4,
  /** Strong-asset rule: all four must hold, or the ratio is meaningless. */
  assetRatio: 3.0,
  assetMinLongform: 6,
  /** Same-format peers required before 'unusual' means anything. */
  assetMinPeers: 3,
  assetMinMedianViews: 2_000,
  assetMinViews: 10_000,
  assetMaxAgeDays: 45,
  /** A release this many days out is worth preparing for. */
  releaseHorizonDays: 21,
  /** Minimum stored history before ratio signals are trusted at all. */
  minHistoryDays: 10,
} as const;

/* ── Strength scaling ────────────────────────────────────────────────── */

/** Map a ratio onto 0–1 without letting one freak number saturate the list. */
function scale(value: number, soft: number, hard: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= soft) return 0;
  return Math.min(1, (value - soft) / (hard - soft));
}

function fmt(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

/* ── Per-artist signal detection ─────────────────────────────────────── */

/**
 * Split the daily history into "last 7 days" and "the 7 before that" and
 * compare. `deltaOver` anchors to the newest snapshot rather than to now,
 * which is what we want: if the cron is a day behind, both windows shift
 * together and the ratio stays honest.
 */
function viewMomentum(history: ChannelSnapshot[]): Signal | null {
  if (history.length < T.minHistoryDays) return null;

  const recent = deltaOver(history, 7, 'views');
  if (!recent || recent.delta < T.minViewDelta) return null;

  /* Prior window: drop the last 7 days and measure the 7 before that. */
  const cutoff = new Date(history[history.length - 1].ts).getTime() - 7 * 86400_000;
  const older = history.filter(h => new Date(h.ts).getTime() <= cutoff);
  const prior = deltaOver(older, 7, 'views');
  if (!prior || prior.delta < T.minViewDelta) return null;

  const ratio = recent.delta / prior.delta;
  const base = {
    sourceRef: `snap:${history[0].ts}..${history[history.length - 1].ts}`,
    historyDays: history.length,
  };

  if (ratio >= T.viewAccelRatio) {
    return {
      type: 'VIEW_ACCELERATION',
      reason: `Views accelerating — ${fmt(recent.delta)} in the last 7 days vs ${fmt(prior.delta)} the week before (${ratio.toFixed(1)}×)`,
      strength: scale(ratio, T.viewAccelRatio, 8),
      ...base,
    };
  }
  if (ratio <= T.viewDecelRatio) {
    return {
      type: 'VIEW_DECELERATION',
      reason: `Views decelerating — ${fmt(recent.delta)} in the last 7 days vs ${fmt(prior.delta)} the week before (${ratio.toFixed(2)}×)`,
      strength: scale(1 / Math.max(ratio, 0.01), 1 / T.viewDecelRatio, 10),
      ...base,
    };
  }
  return null;
}

function subscriberMovement(history: ChannelSnapshot[]): Signal | null {
  if (history.length < T.minHistoryDays) return null;
  const d = deltaOver(history, 7, 'subs');
  if (!d || d.baseline.subs == null) return null;

  const base = d.baseline.subs || 1;
  const pct = d.delta / base;
  const ref = {
    sourceRef: `snap:subs:${d.baseline.ts}..${d.last.ts}`,
    historyDays: history.length,
  };

  if (d.delta >= T.subsSurgeAbs && pct >= T.subsSurgePct) {
    return {
      type: 'SUBSCRIBER_SURGE',
      reason: `Subscribers +${fmt(d.delta)} in 7 days (${(pct * 100).toFixed(1)}% of base)`,
      strength: scale(pct, T.subsSurgePct, 0.15),
      ...ref,
    };
  }
  if (d.delta <= T.subsDeclineAbs) {
    return {
      type: 'SUBSCRIBER_DECLINE',
      reason: `Subscribers ${fmt(d.delta)} in 7 days — net loss against ${fmt(base)} base`,
      strength: scale(Math.abs(pct), 0, 0.02),
      ...ref,
    };
  }
  return null;
}

/**
 * The cheapest genuinely new signal available: the weekly store has been
 * recording `currentClassification` for a year and nothing has ever diffed
 * consecutive weeks. A channel crossing GROWING → WEAK_CONVERSION is a
 * state change a strategist would want to know about and would currently
 * only catch by remembering last week's board.
 */
function classificationChange(weekly: WeeklyChannelSnapshot[]): Signal | null {
  if (weekly.length < 2) return null;
  const [now, prev, before] = weekly; // newest first
  if (!now.currentClassification || !prev.currentClassification) return null;
  if (now.currentClassification === prev.currentClassification) return null;

  /* A → B → A is a channel sitting on a threshold, not a channel changing
     behaviour. Reporting a flap as a state change would train the reader
     to ignore the signal, which costs more than missing it. */
  if (before?.currentClassification === now.currentClassification) return null;

  const worse = ['GROWING', 'WEAK_CONVERSION', 'UNDERFED', 'COLD'];
  const direction =
    worse.indexOf(now.currentClassification) > worse.indexOf(prev.currentClassification)
      ? 'declined' : 'improved';

  return {
    type: 'CLASSIFICATION_CHANGE',
    reason: `Classification ${direction}: ${prev.currentClassification} → ${now.currentClassification} between ${prev.weekId} and ${now.weekId}`,
    strength: direction === 'declined' ? 0.6 : 0.45,
    sourceRef: `weekly-snapshots:${now.weekId}`,
    historyDays: weekly.length * 7,
  };
}

/**
 * `uploads30d` is stored every day, so today's rolling-30 count against the
 * count 30 days ago is a real cadence change — not a level reading.
 */
function cadenceChange(history: ChannelSnapshot[]): Signal | null {
  if (history.length < 35) return null;
  const last = history[history.length - 1];
  const cutoff = new Date(last.ts).getTime() - 30 * 86400_000;
  const then = [...history].reverse().find(h => new Date(h.ts).getTime() <= cutoff);
  if (!then) return null;

  const diff = last.uploads30d - then.uploads30d;
  if (Math.abs(diff) < T.cadenceDelta) return null;

  /* A ratio alone would fire on 1 → 4. An absolute alone would fire on
     19 → 28, which for a channel publishing weekly is a normal fortnight.
     Requiring both leaves genuine changes of behaviour. */
  const hi = Math.max(last.uploads30d, then.uploads30d);
  const lo = Math.min(last.uploads30d, then.uploads30d);
  if (lo > 0 && hi / lo < T.cadenceRatio) return null;
  /* A zero on one side is as often a thin snapshot as a real stop, so the
     active side has to carry real volume before we believe it. */
  if (lo === 0 && hi < T.cadenceMinActive) return null;

  return {
    type: 'CADENCE_CHANGE',
    reason: `Upload cadence ${diff > 0 ? 'up' : 'down'} — ${then.uploads30d} uploads/30d on ${then.ts}, ${last.uploads30d} now`,
    strength: scale(Math.abs(diff), T.cadenceDelta, 20),
    sourceRef: `snap:uploads30d:${then.ts}..${last.ts}`,
    historyDays: history.length,
  };
}

function wentQuiet(snap: CachedSnap | undefined, history: ChannelSnapshot[]): Signal | null {
  const lastUpload = snap?.lastUploadAt;
  if (!lastUpload) return null;
  const days = Math.floor((Date.now() - new Date(lastUpload).getTime()) / 86400_000);
  if (days < T.quietDays) return null;

  /* Only interesting if they were previously active — a channel that has
     always been dormant is not news, it is a catalogue channel. */
  const wasActive = history.some(h => h.uploads30d >= T.quietPriorUploads);
  if (!wasActive) return null;

  return {
    type: 'WENT_QUIET',
    reason: `No upload for ${days} days, on a channel that previously sustained ${T.quietPriorUploads}+ uploads/30d`,
    strength: scale(days, T.quietDays, 180),
    sourceRef: `lastUploadAt:${lastUpload}`,
    historyDays: history.length,
  };
}

/**
 * Descended from the outperformance rule in `opportunities.ts` — a top asset
 * against the median of recent long-form — but with the guards that rule
 * never needed and this one does.
 *
 * On the first full-roster scan this fired at 342× for a channel whose
 * recent long-form median was a few hundred views. The ratio was arithmetically
 * correct and completely uninformative: it measured how empty the baseline
 * was, not how strong the asset was. So the baseline now has to be a real
 * baseline (enough uploads, a non-trivial median) and the asset has to be
 * large in absolute terms as well as relative ones.
 */
function strongAsset(snap: CachedSnap | undefined): Signal | null {
  const recent = (snap?.recentUploads ?? [])
    .filter(v => v.live !== 'upcoming' && (v.durationSec ?? 0) > 60)
    .slice(0, 10);
  if (recent.length < T.assetMinLongform) return null;

  /* ── The comparison has to be like-for-like ───────────────────────
     Against an undifferentiated long-form median, this fired on David
     Guetta (a festival set at 21.6× the median) and Tomorrowland (an
     aftermovie at 23.7×). Both are arithmetically true and neither is a
     finding: they say that music videos and festival sets outperform
     vlogs, which is a fact about formats, not about the artist.

     So the top asset is now compared against the median of ITS OWN
     format. `classifyUploadFormat` works off the RecentUpload we already
     hold, so this costs nothing extra — no catalogue call. */
  const top = recent.reduce((a, b) => ((a.viewCount ?? 0) >= (b.viewCount ?? 0) ? a : b));
  const topViews = top.viewCount ?? 0;
  if (topViews < T.assetMinViews) return null;

  const topFormat = classifyUploadFormat(top);
  const peers = recent
    .filter(v => v.id !== top.id && classifyUploadFormat(v) === topFormat)
    .map(v => v.viewCount ?? 0)
    .filter(n => n > 0)
    .sort((a, b) => a - b);

  /* Too few same-format peers is not a weak signal, it is no signal.
     A first-of-its-kind asset has nothing to be unusual against. */
  if (peers.length < T.assetMinPeers) return null;

  const median = peers[Math.floor(peers.length / 2)];
  if (median < T.assetMinMedianViews) return null;

  const ratio = topViews / median;
  if (ratio < T.assetRatio) return null;

  /* Only worth a strategist's time while it is still recent enough to act on. */
  const ageDays = Math.floor((Date.now() - new Date(top.publishedAt).getTime()) / 86400_000);
  if (ageDays > T.assetMaxAgeDays) return null;

  return {
    type: 'STRONG_ASSET',
    reason: `"${top.title}" at ${fmt(topViews)} views is ${ratio.toFixed(1)}× this artist's median ${topFormat} (${fmt(median)} across ${peers.length} comparable uploads), ${ageDays} days old`,
    strength: scale(ratio, T.assetRatio, 15),
    sourceRef: `video:${top.id}`,
    historyDays: 0,
  };
}

function heroAndHorizon(
  horizon: Awaited<ReturnType<typeof getHorizon>> | null,
): Signal[] {
  if (!horizon || !horizon.horizonKnown) return [];
  const out: Signal[] = [];
  const next = horizon.nextMajorMoment;
  if (next && next.daysAway != null && next.daysAway >= 0 && next.daysAway <= T.releaseHorizonDays) {
    out.push({
      type: 'RELEASE_APPROACHING',
      reason: `${next.title} (${next.type}) in ${next.daysAway} days, status ${next.status}`,
      /* Closer is stronger, but a confirmed date beats a tentative one. */
      strength: (1 - next.daysAway / T.releaseHorizonDays) * (next.status === 'CONFIRMED' ? 1 : 0.7),
      sourceRef: `horizon:${next.eventId}`,
      historyDays: 0,
    });
  }
  return out;
}

/* ── The scan ────────────────────────────────────────────────────────── */

export interface ScanResult {
  candidates: Candidate[];
  channelsScanned: number;
  channelsWithData: number;
  scanMs: number;
  notes: string[];
}

/**
 * `strategicImportance` is read off the relationship metadata we actually
 * have, not off a model's opinion. A managed artist with a named campaign
 * outranks an observed market channel, which is the whole point of the
 * priority rule in the brief: a small signal on a priority campaign should
 * beat a large one on a channel nobody is working.
 */
function strategicImportance(a: Artist): number {
  let s = 0.2;
  if (isManaged(a)) s += 0.35;
  if (a.ownership === 'virgin') s += 0.15;
  if (a.campaign) s += 0.15;
  if (a.campaignStartDate) s += 0.15;
  return Math.min(1, s);
}

function campaignRelevance(a: Artist, horizonKnown: boolean): number {
  if (!a.campaignStartDate) return horizonKnown ? 0.5 : 0.2;
  const days = Math.floor((Date.now() - new Date(a.campaignStartDate).getTime()) / 86400_000);
  if (days < 0) return 0.8;           // campaign hasn't started — pre-launch matters
  if (days <= 60) return 1;           // live campaign
  if (days <= 120) return 0.6;
  return 0.3;
}

export async function scanRoster(opts: { horizonForAll?: boolean } = {}): Promise<ScanResult> {
  const t0 = Date.now();
  const notes: string[] = [];

  const artists = mergeArtistLists(ARTISTS, await listCustomArtists());
  const handles = artists.map(a => a.channelHandle).filter((h): h is string => !!h);

  /* Two bulk reads cover the whole roster. Both are chunked internally. */
  const snaps = await readAllLiveSnaps(handles);

  const byHandle = new Map<string, Artist>();
  for (const a of artists) if (a.channelHandle) byHandle.set(a.channelHandle, a);

  const channelIds: string[] = [];
  const idBySlug = new Map<string, string>();
  for (const a of artists) {
    const s = a.channelHandle ? snaps.get(a.channelHandle) : undefined;
    if (s?.channelId) { channelIds.push(s.channelId); idBySlug.set(a.slug, s.channelId); }
  }
  const histories = await readHistories(channelIds);

  if (snaps.size === 0) notes.push('No cached channel snapshots found — the scan had nothing to read.');

  /* Horizon and weekly snapshots are per-artist reads. Restrict them to
     artists where they can actually say something, or the scan stops being
     cheap: horizon needs a plan, weekly snapshots are managed-only. */
  const horizonSlugs = artists
    .filter(a => opts.horizonForAll || a.campaign || a.campaignStartDate || a.nextMomentDate)
    .map(a => a.slug);
  const horizons = new Map<string, Awaited<ReturnType<typeof getHorizon>>>();
  await Promise.all(horizonSlugs.map(async slug => {
    try { horizons.set(slug, await getHorizon(slug)); } catch { /* horizon is optional */ }
  }));

  const weeklySlugs = artists.filter(isManaged).map(a => a.slug);
  const weeklies = new Map<string, WeeklyChannelSnapshot[]>();
  await Promise.all(weeklySlugs.map(async slug => {
    try { weeklies.set(slug, await getRecentSnapshots(slug, 3)); } catch { /* optional */ }
  }));

  const candidates: Candidate[] = [];
  let withData = 0;

  for (const a of artists) {
    const snap = a.channelHandle ? snaps.get(a.channelHandle) : undefined;
    const cid = idBySlug.get(a.slug);
    const history = (cid ? histories.get(cid) : undefined) ?? [];
    const weekly = weeklies.get(a.slug) ?? [];
    const horizon = horizons.get(a.slug) ?? null;

    if (snap || history.length) withData++;

    const signals: Signal[] = [
      viewMomentum(history),
      subscriberMovement(history),
      classificationChange(weekly),
      cadenceChange(history),
      wentQuiet(snap, history),
      strongAsset(snap),
      ...heroAndHorizon(horizon),
    ].filter((s): s is Signal => s !== null);

    if (!signals.length) continue;

    signals.sort((x, y) => y.strength - x.strength);
    const lead = signals[0];

    /* Multiple independent signals on one artist is itself evidence that
       something is happening, so the combined strength is bumped — but
       sub-linearly, or a noisy channel would always top the list. */
    const combined = Math.min(1, lead.strength + (signals.length - 1) * 0.08);

    const importance = strategicImportance(a);
    const relevance = campaignRelevance(a, horizon?.horizonKnown ?? false);

    candidates.push({
      artistId: a.slug,
      artistName: a.name,
      campaignId: a.campaign ?? null,
      signals,
      leadSignal: lead,
      /* Novelty is filled in by the ranker, which has the finding history.
         The scan has no memory by design. */
      priority: 0,
      priorityBreakdown: {
        signalStrength: combined,
        strategicImportance: importance,
        campaignRelevance: relevance,
        novelty: 1,
      },
    });
  }

  return {
    candidates,
    channelsScanned: artists.length,
    channelsWithData: withData,
    scanMs: Date.now() - t0,
    notes,
  };
}

export const SIGNAL_LABEL: Record<SignalType, string> = {
  VIEW_ACCELERATION: 'Views accelerating',
  VIEW_DECELERATION: 'Views decelerating',
  SUBSCRIBER_SURGE: 'Subscriber surge',
  SUBSCRIBER_DECLINE: 'Subscriber decline',
  CLASSIFICATION_CHANGE: 'Classification changed',
  CADENCE_CHANGE: 'Cadence changed',
  HERO_RELEASED: 'Hero released',
  RELEASE_APPROACHING: 'Release approaching',
  FOLLOW_UP_WINDOW_OPEN: 'Follow-up window open',
  STRONG_ASSET: 'Unusually strong asset',
  WENT_QUIET: 'Went quiet',
  CATALOGUE_MOVEMENT: 'Catalogue movement',
};
