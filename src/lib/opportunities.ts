import type { Artist, LiveSnap } from './artists';

export type OpportunityImpact = 'HIGH' | 'MEDIUM' | 'LOW';
export type OpportunityType =
  | 'Cold channel'
  | 'Format gap'
  | 'Missing support'
  | 'Underused asset';

export type Opportunity = {
  id: string;
  artistSlug: string;
  artistName: string;
  type: OpportunityType;
  subtype: string;
  signal: string;
  impact: OpportunityImpact;
  impactRange: string;
  action: string;
  source: 'live';
};

export const IMPACT_RANK: Record<OpportunityImpact, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

export const IMPACT_COLOR: Record<OpportunityImpact, { bg: string; fg: string; dot: string }> = {
  HIGH: { bg: '#FFE2D8', fg: '#8A1F0C', dot: '#FF4A1C' },
  MEDIUM: { bg: '#FFEAD6', fg: '#8A4A1A', dot: '#F08A3C' },
  LOW: { bg: '#FFF5D6', fg: '#7A5A00', dot: '#FFD24C' },
};

const ACTIVE_PHASES: Artist['phase'][] = ['START', 'RELEASE', 'PUSH', 'PEAK'];

function daysAgo(iso?: string | null) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

/**
 * All detection is derived from YouTube Data API v3 signals pulled in
 * fetchChannelSnap. No seed data, no external feeds.
 */
export function detectOpportunities(
  artist: Artist,
  snap: LiveSnap | null,
  daysToNextMoment: number | null
): Opportunity[] {
  if (!snap || snap.error || snap.subs == null) return [];
  const out: Opportunity[] = [];
  const uploads30d = snap.uploads30d ?? 0;
  const shorts30d = snap.shorts30d ?? 0;
  const upcoming = snap.upcomingCount ?? 0;
  const lastUp = daysAgo(snap.lastUploadAt);
  const isActive = ACTIVE_PHASES.includes(artist.phase);
  const hasNearMoment =
    daysToNextMoment != null && daysToNextMoment >= 0 && daysToNextMoment <= 14;

  // 1. Cold channel — no upload in 30d OR zero uploads in 30d window
  if (lastUp == null || lastUp > 30 || uploads30d === 0) {
    out.push({
      id: `cold:${artist.slug}`,
      artistSlug: artist.slug,
      artistName: artist.name,
      type: 'Cold channel',
      subtype: 'Channel has gone cold',
      signal:
        lastUp != null
          ? `Last upload ${lastUp}d ago. ${uploads30d} uploads in 30d.`
          : `No uploads detected in the last 30d.`,
      impact: isActive || hasNearMoment ? 'HIGH' : 'MEDIUM',
      impactRange:
        isActive || hasNearMoment
          ? 'Blocks campaign traction'
          : 'Erodes baseline watch-time',
      action:
        'Ship one upload this week — a Short from catalogue is enough to warm the channel.',
      source: 'live',
    });
  }

  // 2. Quiet before a near-term moment
  if (hasNearMoment && (lastUp ?? 999) > 14 && (lastUp == null || lastUp <= 30)) {
    out.push({
      id: `quiet-pre-moment:${artist.slug}`,
      artistSlug: artist.slug,
      artistName: artist.name,
      type: 'Missing support',
      subtype: 'Quiet before next moment',
      signal: `Next moment in ${daysToNextMoment}d but last upload was ${lastUp}d ago.`,
      impact: 'HIGH',
      impactRange: 'Reduces announce-day reach',
      action: 'Post a teaser or catalogue Short this week to re-engage before the drop.',
      source: 'live',
    });
  }

  // 3. No Shorts on an active channel
  if (uploads30d >= 2 && shorts30d === 0) {
    out.push({
      id: `no-shorts:${artist.slug}`,
      artistSlug: artist.slug,
      artistName: artist.name,
      type: 'Format gap',
      subtype: 'No Shorts in the last 30 days',
      signal: `${uploads30d} uploads in 30d but 0 are Shorts (≤60s).`,
      impact: isActive ? 'HIGH' : 'MEDIUM',
      impactRange: isActive ? '+500K–1M Shorts views' : '+discovery surface',
      action:
        'Cut 2–3 vertical Shorts from the latest upload — hook, best moment, reaction.',
      source: 'live',
    });
  }

  // 4. Captions missing on recent uploads
  const captionsMissing = snap.captionsMissing30d ?? 0;
  if (uploads30d >= 2 && captionsMissing >= Math.ceil(uploads30d / 2)) {
    out.push({
      id: `captions:${artist.slug}`,
      artistSlug: artist.slug,
      artistName: artist.name,
      type: 'Missing support',
      subtype: 'Captions missing on recent uploads',
      signal: `${captionsMissing} of the last ${uploads30d} uploads have no captions.`,
      impact: 'MEDIUM',
      impactRange: 'Limits reach + accessibility',
      action: 'Auto-generate captions, review, and publish on recent uploads.',
      source: 'live',
    });
  }

  // 5. Top recent upload has no Short companion
  const recent = (snap.recentUploads ?? [])
    .filter((u) => u.live === 'none' && u.durationSec > 60)
    .slice(0, 10);
  if (recent.length >= 3) {
    const views = recent.map((u) => u.viewCount);
    const top = recent[0 + views.indexOf(Math.max(...views))] ?? recent[0];
    const median = [...views].sort((a, b) => a - b)[Math.floor(views.length / 2)];
    // If the top long-form is 2x+ the median and there's no Short within 14d of it, flag it
    if (top && median > 0 && top.viewCount >= median * 2) {
      const topTs = new Date(top.publishedAt).getTime();
      const hasCompanionShort = (snap.recentUploads ?? []).some(
        (u) =>
          u.durationSec > 0 &&
          u.durationSec <= 60 &&
          Math.abs(new Date(u.publishedAt).getTime() - topTs) <= 14 * 86400000
      );
      if (!hasCompanionShort) {
        out.push({
          id: `top-no-short:${artist.slug}`,
          artistSlug: artist.slug,
          artistName: artist.name,
          type: 'Underused asset',
          subtype: 'Top recent upload has no Short companion',
          signal: `"${top.title}" is outperforming (${top.viewCount.toLocaleString()} views) but has no Short within 14d.`,
          impact: 'HIGH',
          impactRange: '+Shorts views, +discovery',
          action: 'Cut 1–2 Shorts from the top-performing upload this week.',
          source: 'live',
        });
      }
    }
  }

  // 6. No upcoming premiere / scheduled live
  if (upcoming === 0 && (uploads30d >= 2 || isActive)) {
    out.push({
      id: `no-upcoming:${artist.slug}`,
      artistSlug: artist.slug,
      artistName: artist.name,
      type: 'Underused asset',
      subtype: 'No premiere or live scheduled',
      signal:
        'Nothing scheduled as an upcoming premiere or live on the channel.',
      impact: 'LOW',
      impactRange: 'Premieres lift session time + comments',
      action:
        'Schedule the next upload as a Premiere to concentrate launch attention.',
      source: 'live',
    });
  }

  return out;
}
