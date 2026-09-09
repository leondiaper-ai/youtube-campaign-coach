/**
 * DESCRIBING AN OUTSIDE CHANNEL IN WATCHER'S OWN LANGUAGE
 *
 * This is the strategic point of Scout. If external channels get analysed
 * by a separate system with separate definitions, then "their follow-up
 * behaviour" and "our follow-up behaviour" are two different measurements
 * that happen to share a name, and no comparison between them means
 * anything.
 *
 * So the classifier is `classifyUploadFormat` — the same function that
 * runs on our own roster — and the concepts are the ones already in the
 * Coach: heroes, gaps, follow-up windows, format mix, cadence.
 *
 * ── WHAT WE REFUSE TO COMPUTE ────────────────────────────────────────
 * No velocity, no rate, no trend, no per-video history. Every view count
 * here is a lifetime total read once. For a channel we have not been
 * observing there is no earlier reading to compare against, and the
 * tempting shortcut — dividing lifetime views by video age — produces a
 * number that looks like velocity and is not. An older video has had
 * longer to accumulate; that is arithmetic, not performance.
 *
 * The one honest scale reference is the channel's own median long-form
 * views, which at least compares like with like within a single channel.
 */

import { classifyUploadFormat } from '../formatClassifier';
import type { RecentUpload } from '../artists';
import type { DiscoveredVideo } from '../youtube/discovery';
import type { ChannelProfile } from './types';

/** Adapt the discovery shape to what the shared classifier expects. */
function asUpload(v: DiscoveredVideo): RecentUpload {
  return {
    id: v.id,
    title: v.title,
    description: v.description,
    publishedAt: v.publishedAt,
    durationSec: v.durationSec,
    live: v.actualStart ? 'none' : 'none',
    scheduledStart: v.scheduledStart,
    actualStart: v.actualStart,
    captions: false,
    viewCount: v.views,
    likeCount: v.likes,
    commentCount: v.comments,
  };
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

const DAY = 86_400_000;

export function buildProfile(channelId: string, videos: DiscoveredVideo[]): ChannelProfile {
  /* Oldest first — sequencing analysis has to read in campaign order. */
  const vids = [...videos].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));

  const classified = vids.map(v => ({ v, format: classifyUploadFormat(asUpload(v)) }));

  const formatCounts: Record<string, number> = {};
  for (const { format } of classified) formatCounts[format] = (formatCounts[format] ?? 0) + 1;

  const shorts = classified.filter(c => c.format === 'short');
  const longform = classified.filter(c => c.format !== 'short');
  /* `wasLive` is the API's own flag, so this needs no inference. The
     classifier's 'live' label is a title heuristic and catches sessions
     that were never streamed, so both count. */
  const live = classified.filter(c => c.format === 'live' || c.v.wasLive);

  /* Gaps between consecutive uploads, in days. Median rather than mean:
     one two-year dormancy would swamp a mean and say nothing about how the
     channel behaves when it is active. */
  const gaps: number[] = [];
  for (let i = 1; i < vids.length; i++) {
    const d = (new Date(vids[i].publishedAt).getTime() - new Date(vids[i - 1].publishedAt).getTime()) / DAY;
    if (d >= 0) gaps.push(d);
  }

  const now = Date.now();
  const uploadsLast90d = vids.filter(
    v => now - new Date(v.publishedAt).getTime() <= 90 * DAY,
  ).length;

  const heroes = classified
    .filter(c => c.format === 'omv')
    .map(c => ({ id: c.v.id, title: c.v.title, publishedAt: c.v.publishedAt, views: c.v.views }))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  /* Post-hero: what followed the most recent hero, and how soon. This is
     the whole POST_HERO mission, and it is pure date arithmetic. */
  let postHero: ChannelProfile['postHero'] = null;
  if (heroes.length) {
    const hero = heroes[0];
    const heroTime = new Date(hero.publishedAt).getTime();
    const followUps = classified
      .filter(c => c.v.id !== hero.id && new Date(c.v.publishedAt).getTime() > heroTime)
      .map(c => ({
        id: c.v.id,
        title: c.v.title,
        format: c.format,
        daysAfter: Math.round((new Date(c.v.publishedAt).getTime() - heroTime) / DAY),
        views: c.v.views,
      }))
      .filter(f => f.daysAfter <= 60)
      .sort((a, b) => a.daysAfter - b.daysAfter);

    postHero = {
      heroId: hero.id,
      heroTitle: hero.title,
      heroPublishedAt: hero.publishedAt,
      followUps,
      longFormWithin21d: followUps.filter(
        f => f.format !== 'short' && f.daysAfter >= 1 && f.daysAfter <= 21,
      ).length,
    };
  }

  return {
    channelId,
    uploadsAnalysed: vids.length,
    windowStart: vids[0]?.publishedAt ?? '',
    windowEnd: vids[vids.length - 1]?.publishedAt ?? '',
    formatCounts,
    distinctFormats: Object.keys(formatCounts).length,
    shortsCount: shorts.length,
    longformCount: longform.length,
    liveCount: live.length,
    medianGapDays: median(gaps),
    uploadsLast90d,
    heroes: heroes.slice(0, 8),
    postHero,
    medianLongformViews: median(longform.map(c => c.v.views).filter(n => n > 0)),
    timeline: classified
      .slice()
      .reverse()
      .map(c => ({
        date: c.v.publishedAt.slice(0, 10),
        format: c.format,
        views: c.v.views,
        title: c.v.title.slice(0, 70),
      })),
  };
}

/**
 * The evidence block handed to the model. Written as plain figures rather
 * than prose so there is nothing for the model to take on trust: every
 * sentence it writes has to be traceable to a line in here.
 */
export function renderProfile(p: ChannelProfile, title: string): string {
  const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : String(n);

  const lines: string[] = [
    `CHANNEL: ${title}`,
    `Uploads analysed: ${p.uploadsAnalysed} (${p.windowStart.slice(0, 10)} to ${p.windowEnd.slice(0, 10)})`,
    `Uploads in the last 90 days: ${p.uploadsLast90d}`,
    `Median gap between uploads: ${p.medianGapDays == null ? 'unknown' : `${p.medianGapDays.toFixed(1)} days`}`,
    `Format mix: ${Object.entries(p.formatCounts).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(', ')}`,
    `Distinct formats: ${p.distinctFormats} · long-form ${p.longformCount} · Shorts ${p.shortsCount} · live/performance ${p.liveCount}`,
    `Median long-form views: ${p.medianLongformViews == null ? 'unknown' : fmt(p.medianLongformViews)}`,
  ];

  if (p.heroes.length) {
    lines.push('', 'HERO RELEASES (most recent first):');
    for (const h of p.heroes) {
      lines.push(`  ${h.publishedAt.slice(0, 10)}  ${fmt(h.views)} views  ${h.title}`);
    }
  }

  if (p.postHero) {
    lines.push(
      '',
      `AFTER THE MOST RECENT HERO — "${p.postHero.heroTitle}" (${p.postHero.heroPublishedAt.slice(0, 10)}):`,
      `  Long-form published 1–21 days after: ${p.postHero.longFormWithin21d}`,
    );
    if (p.postHero.followUps.length) {
      for (const f of p.postHero.followUps.slice(0, 20)) {
        lines.push(`  +${String(f.daysAfter).padStart(3)}d  ${f.format.padEnd(11)} ${fmt(f.views).padStart(7)}  ${f.title}`);
      }
    } else {
      lines.push('  Nothing was published in the 60 days after the hero.');
    }
  }

  if (p.timeline.length) {
    /* The dated sequence, newest first. Capped at 60 rows: enough to cover
       a campaign and its run-up, short enough to leave the model room to
       reason rather than to recite. */
    lines.push('', 'UPLOAD SEQUENCE (newest first — date, format, views, title):');
    for (const t of p.timeline.slice(0, 60)) {
      lines.push(`  ${t.date}  ${t.format.padEnd(11)} ${fmt(t.views).padStart(7)}  ${t.title}`);
    }
    if (p.timeline.length > 60) {
      lines.push(`  … ${p.timeline.length - 60} older uploads not shown.`);
    }
  }

  lines.push(
    '',
    'EVIDENCE LIMITS: every view figure above is a lifetime total read once, today.',
    'There is no time series for this channel — we have not been observing it.',
    'Older videos have had longer to accumulate views. Do not treat any of these',
    'numbers as velocity, and do not divide views by age.',
  );

  return lines.join('\n');
}
