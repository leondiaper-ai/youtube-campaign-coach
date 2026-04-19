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
  // Optional per-video context (populated by video-level detectors)
  videoId?: string;
  videoTitle?: string;
  videoViews?: number;
  // Optional list of related videos (used for channel-level card drill-downs)
  relatedVideos?: { id: string; title: string; viewCount?: number }[];
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

// NOTE: artist.phase is a static seed value — NOT derived from real campaign
// state. Use observable signals (uploads, moment proximity) instead.

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
      impact: hasNearMoment ? 'HIGH' : 'MEDIUM',
      impactRange:
        hasNearMoment
          ? 'Dormant channels lose algorithm favour — inactive periods cut reach on the next drop by 30–50%. During an active campaign this directly costs announce-day views.'
          : 'Even between campaigns, a silent channel bleeds baseline watch-time and subscriber growth. One upload a week keeps the channel warm for the next moment.',
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
      impactRange:
        'Channels that post in the two weeks before a moment see 2–3× the announce-day viewership of dormant ones. YouTube re-surfaces recent uploaders to their subscriber base, so every quiet day before the drop caps your launch ceiling.',
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
      impact: hasNearMoment || uploads30d >= 4 ? 'HIGH' : 'MEDIUM',
      impactRange:
        'Shorts are YouTube\'s fastest-growing surface and have separate discovery from long-form. Active music channels typically see 500K–1M+ Shorts views from 2–3 cuts per release, most of which converts subscribers who never would\'ve clicked a 3-minute video.',
      action:
        'Cut 2–3 vertical Shorts from the latest upload — hook, best moment, reaction.',
      source: 'live',
    });
  }

  // 4. Captions missing on recent uploads
  const captionsMissing = snap.captionsMissing30d ?? 0;
  const missingList = snap.missingCaptionsVideos ?? [];
  if (uploads30d >= 2 && captionsMissing >= Math.ceil(uploads30d / 2)) {
    out.push({
      id: `captions:${artist.slug}`,
      artistSlug: artist.slug,
      artistName: artist.name,
      type: 'Missing support',
      subtype: 'No published caption track on recent uploads',
      signal: `${captionsMissing} of the last ${uploads30d} uploads rely on auto-ASR only — no reviewed/published caption track.`,
      impact: 'MEDIUM',
      impactRange:
        'A published caption track gets indexed by YouTube search (auto-ASR doesn\'t), and YouTube can auto-translate it into 100+ languages. For music in particular, roughly 15–25% of a channel\'s watch-time comes from non-native-language regions — captions unlock that audience.',
      action:
        'Open YT Studio → Subtitles, review the auto-generated transcript for accuracy (especially lyrics + artist names), and hit publish.',
      source: 'live',
      relatedVideos: missingList.slice(0, 8),
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
          impactRange:
            'A proven long-form hit already has audience validation. Cutting a Short from it gets algorithmic push on the new-content surface while driving viewers back to the long-form, compounding both.',
          action: 'Cut 1–2 Shorts from the top-performing upload this week.',
          source: 'live',
        });
      }
    }
  }

  // --- Per-video detectors (full catalogue scan: recent + all-time) ---
  // Scan ALL available longform videos — not just the top 5.
  // The watcher UI handles prioritisation and display limits.
  const byId = new Map<string, NonNullable<LiveSnap['recentUploads']>[number]>();
  for (const u of snap.recentUploads ?? []) {
    if (u.live === 'none' && u.durationSec > 60) byId.set(u.id, u);
  }
  for (const u of snap.topEverVideos ?? []) {
    if (u.live === 'none' && u.durationSec > 60) byId.set(u.id, u);
  }
  const topPerformers = Array.from(byId.values())
    .sort((a, b) => b.viewCount - a.viewCount);

  for (const v of topPerformers) {
    const fmtV = v.viewCount.toLocaleString();

    // 7. Top video missing a lyric companion
    // Skip if this video IS a lyric video (e.g. "Official Lyric Video")
    const titleLower = v.title.toLowerCase();
    const isLyricVideo = /\blyric(s)?\b/.test(titleLower);
    if (!v.hasLyricSibling && !isLyricVideo) {
      out.push({
        id: `vid-no-lyric:${artist.slug}:${v.id}`,
        artistSlug: artist.slug,
        artistName: artist.name,
        type: 'Underused asset',
        subtype: 'Top video has no lyric cut',
        signal: `"${v.title}" at ${fmtV} views with no lyric/lyrics companion uploaded.`,
        impact: 'HIGH',
        impactRange:
          'Lyric variants capture the "I want to sing along" viewer who won\'t sit through a cinematic music video. For tracks with memorable lyrics, a lyric cut adds 20–50% incremental watch-time on top of the main video and gets its own playlist surface.',
        action:
          'Commission a lyric video or generate a typographic cut and upload as a companion to the main track.',
        source: 'live',
        videoId: v.id,
        videoTitle: v.title,
        videoViews: v.viewCount,
      });
    }

    // 8. Top video missing a visualizer / audio-only companion
    // Skip if this video IS a visualizer or audio-only track
    const isVisualizerVideo = /\b(visuali[sz]er|audio)\b/.test(titleLower);
    if (!v.hasVisualizerSibling && !v.hasAudioSibling && !isVisualizerVideo) {
      out.push({
        id: `vid-no-viz:${artist.slug}:${v.id}`,
        artistSlug: artist.slug,
        artistName: artist.name,
        type: 'Underused asset',
        subtype: 'Top video has no visualizer / audio cut',
        signal: `"${v.title}" has no visualizer or audio-only variant to soak up passive listening.`,
        impact: 'MEDIUM',
        impactRange:
          'A visualizer or audio-only version becomes the background-listen / study / party-playlist variant — viewers loop it passively where they wouldn\'t re-watch a music video. Typically 30–60% incremental watch-time on top of the main track.',
        action:
          'Render a 16:9 visualizer loop or an audio-only version for the same track and upload as a companion.',
        source: 'live',
        videoId: v.id,
        videoTitle: v.title,
        videoViews: v.viewCount,
      });
    }

    // 9. Top video has no Short companion
    if (!v.hasShortSibling) {
      out.push({
        id: `vid-no-short:${artist.slug}:${v.id}`,
        artistSlug: artist.slug,
        artistName: artist.name,
        type: 'Format gap',
        subtype: 'Top video has no Short companion',
        signal: `"${v.title}" at ${fmtV} views but no Short within 14d of publish.`,
        impact: 'HIGH',
        impactRange:
          'This track is already proven — audience, watch-time, comments. A Short cut rides that validation to the new-content algorithm, reaches mobile viewers who skip long-form, and funnels them back to the main video. Highest-ROI content move on the channel.',
        action:
          'Cut a 30–60s vertical from the best moment of this video and upload it as a Short this week.',
        source: 'live',
        videoId: v.id,
        videoTitle: v.title,
        videoViews: v.viewCount,
      });
    }

    // 10. Top video missing captions (accessibility + reach)
    if (!v.captions) {
      out.push({
        id: `vid-no-cc:${artist.slug}:${v.id}`,
        artistSlug: artist.slug,
        artistName: artist.name,
        type: 'Missing support',
        subtype: 'Top video has no published caption track',
        signal: `"${v.title}" driving ${fmtV} views — auto-ASR only, no reviewed track published.`,
        impact: 'MEDIUM',
        impactRange:
          'A published caption track gets indexed by YouTube search and can be auto-translated into 100+ languages. On a top video already driving mass views, this opens international reach and mute-autoplay retention without touching the creative.',
        action: 'Auto-generate captions in YT Studio, review, and publish.',
        source: 'live',
        videoId: v.id,
        videoTitle: v.title,
        videoViews: v.viewCount,
      });
    }

    // 11. Comment demand — recurring requests in top comments
    const comments = v.topComments ?? [];
    if (comments.length >= 3) {
      const joined = comments.map((c) => c.text.toLowerCase()).join(' | ');
      type Pattern = { label: string; rx: RegExp; action: string };
      const patterns: Pattern[] = [
        { label: 'lyric video', rx: /\blyric/, action: 'Ship a lyric cut — fans are asking.' },
        { label: 'instrumental', rx: /\binstrumental\b/, action: 'Upload an instrumental version.' },
        { label: 'acoustic / stripped', rx: /\bacoustic|stripped\b/, action: 'Film a stripped/acoustic performance cut.' },
        { label: 'remix', rx: /\bremix\b/, action: 'Open a remix pack or source a hot edit.' },
        { label: 'tour / live dates', rx: /\btour|dates|coming to\b/, action: 'Reply with tour info + pin a dates comment.' },
        { label: 'merch', rx: /\bmerch|hoodie|t-?shirt\b/, action: 'Surface merch link in pinned comment + description.' },
        { label: 'spotify / streaming', rx: /\bspotify|apple music|streaming\b/, action: 'Pin the streaming link, add to description.' },
      ];
      const hits = patterns.filter((p) => {
        const matches = comments.filter((c) => p.rx.test(c.text.toLowerCase())).length;
        return matches >= 2; // at least two top comments mention it
      });
      if (hits.length) {
        const top = hits[0];
        out.push({
          id: `vid-demand:${artist.slug}:${v.id}:${top.label}`,
          artistSlug: artist.slug,
          artistName: artist.name,
          type: 'Missing support',
          subtype: `Comment demand: ${top.label}`,
          signal: `Multiple top comments on "${v.title}" request ${top.label}.`,
          impact: 'HIGH',
          impactRange:
            'When multiple top comments request the same thing, that\'s a verified demand signal from the most engaged segment of the audience. Shipping it converts comment-watchers into repeat viewers and earns a disproportionate bump in engagement metrics.',
          action: top.action,
          source: 'live',
          videoId: v.id,
          videoTitle: v.title,
          videoViews: v.viewCount,
        });
      }
    }
  }

  // 6. No upcoming premiere / scheduled live
  if (upcoming === 0 && uploads30d >= 2) {
    out.push({
      id: `no-upcoming:${artist.slug}`,
      artistSlug: artist.slug,
      artistName: artist.name,
      type: 'Underused asset',
      subtype: 'No premiere or live scheduled',
      signal:
        'Nothing scheduled as an upcoming premiere or live on the channel.',
      impact: 'LOW',
      impactRange:
        'Premieres concentrate audience into a single live moment, driving 3–5× normal comment rate and live-chat engagement. That signal tells the algorithm the upload is a "moment" and boosts distribution for the first 48 hours.',
      action:
        'Schedule the next upload as a Premiere to concentrate launch attention.',
      source: 'live',
    });
  }

  return out;
}
