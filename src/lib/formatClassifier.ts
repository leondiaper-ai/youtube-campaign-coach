/**
 * Content format classifier for Campaign Behaviour View.
 *
 * Classifies YouTube uploads into actionable format categories
 * that music marketing teams can understand at a glance.
 *
 * Two-level classification:
 *   Level 1: Short vs Long-form (duration-based)
 *   Level 2: Long-form sub-type (title/metadata-based)
 */

import type { RecentUpload } from './artists';

// ── Format types ─────────────────────────────────────────────────────────

export type UploadFormat =
  | 'short'
  | 'omv'        // Official Music Video
  | 'lyric'      // Lyric Video
  | 'visualiser' // Visualiser / Visual
  | 'live'       // Live / Performance
  | 'bts'        // Behind The Scenes / Documentary / Making Of
  | 'audio'      // Audio-only
  | 'longform';  // Other long-form (catch-all)

export type FormatMeta = {
  format: UploadFormat;
  label: string;        // Human-readable label
  shortLabel: string;   // Abbreviated label for markers
  isShort: boolean;
  isLongform: boolean;
};

// ── Format metadata lookup ───────────────────────────────────────────────

const FORMAT_META: Record<UploadFormat, Omit<FormatMeta, 'format'>> = {
  short:      { label: 'Short',                  shortLabel: 'S',    isShort: true,  isLongform: false },
  omv:        { label: 'Official Music Video',   shortLabel: 'OMV',  isShort: false, isLongform: true },
  lyric:      { label: 'Lyric Video',            shortLabel: 'LYR',  isShort: false, isLongform: true },
  visualiser: { label: 'Visualiser',             shortLabel: 'VIS',  isShort: false, isLongform: true },
  live:       { label: 'Live / Performance',     shortLabel: 'LIVE', isShort: false, isLongform: true },
  bts:        { label: 'Behind The Scenes',      shortLabel: 'BTS',  isShort: false, isLongform: true },
  audio:      { label: 'Audio',                  shortLabel: 'AUD',  isShort: false, isLongform: true },
  longform:   { label: 'Long-form',              shortLabel: 'LF',   isShort: false, isLongform: true },
};

export function getFormatMeta(format: UploadFormat): FormatMeta {
  return { format, ...FORMAT_META[format] };
}

// ── Format colours (design-system aligned) ───────────────────────────────

export const FORMAT_COLORS: Record<UploadFormat, string> = {
  short:      '#8A847A',  // smoke — understated
  omv:        '#FF4A1C',  // signal — primary content, most prominent
  lyric:      '#2C25FF',  // electric — distinct from OMV
  visualiser: '#1FBE7A',  // mint
  live:       '#FFD24C',  // sun — warm, energetic
  bts:        '#F08A3C',  // warm orange
  audio:      '#A78BFA',  // soft purple
  longform:   '#6B7280',  // neutral grey
};

// ── Classifier ───────────────────────────────────────────────────────────

/**
 * Classify a single upload into a format category.
 *
 * Priority order matters: more specific patterns match first.
 * Short detection uses duration (≤60s) as the primary signal.
 * Long-form sub-classification uses title + description keywords.
 */
export function classifyUploadFormat(upload: RecentUpload): UploadFormat {
  // ── Level 1: Short detection ───────────────────────────────────────
  if (upload.durationSec > 0 && upload.durationSec <= 60) return 'short';

  // Also check title for #shorts marker (some videos have duration > 60 but are Shorts)
  const titleLower = upload.title.toLowerCase();
  if (/#shorts?\b/.test(titleLower)) return 'short';

  // ── Level 2: Long-form sub-classification ──────────────────────────
  const haystack = `${upload.title} ${upload.description}`.toLowerCase();

  // Live / Performance — check BEFORE official to avoid "Official Live Video" → omv
  if (/\b(live\s+(session|performance|video|at|from|in\b)|performance\s+video|stripped\s+back|acoustic\s+session|tiny\s+desk|colors?\s+show|plugged|vevo\s+live|live\s+lounge)\b/.test(haystack)) {
    return 'live';
  }
  // Also flag if the upload was actually a live broadcast
  if (upload.actualStart && upload.live !== 'upcoming') return 'live';

  // Behind The Scenes / Documentary / Making Of
  if (/\b(behind\s+the\s+scenes|making\s+of|bts|the\s+making|in\s+the\s+studio|documentary|studio\s+session|recording\s+session)\b/.test(haystack)) {
    return 'bts';
  }

  // Official Music Video
  if (/\b(official\s+(music\s+)?video|music\s+video)\b/.test(haystack)) return 'omv';

  // Lyric Video
  if (/\b(lyric(?:s)?\s+video|\(lyric(?:s)?\))\b/.test(haystack)) return 'lyric';

  // Visualiser
  if (/\b(visuali[sz]er|visuali[sz]ation|visual(?:\s+video)?)\b/.test(haystack)) return 'visualiser';

  // Audio
  if (/\b(official\s+audio|audio\s+only|\baudio\b)\b/.test(haystack)) return 'audio';

  // Catch-all: other long-form
  return 'longform';
}

// ── Enriched upload type for the behaviour view ──────────────────────────

export type ClassifiedUpload = {
  id: string;
  title: string;
  publishedAt: string;
  format: UploadFormat;
  formatMeta: FormatMeta;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  durationSec: number;
  daysSincePrevious: number | null;  // null for first upload in window
  isCollab: boolean;
};

/**
 * Classify and enrich a list of uploads for the campaign behaviour view.
 * Sorts by publishedAt ascending and computes daysSincePrevious.
 */
export function classifyUploads(
  uploads: RecentUpload[],
  windowStart: string,
  windowEnd: string,
): ClassifiedUpload[] {
  const startTs = new Date(windowStart).getTime();
  const endTs = new Date(windowEnd).getTime();

  // Filter to observation window
  const inWindow = uploads.filter((u) => {
    const ts = new Date(u.publishedAt).getTime();
    return ts >= startTs && ts <= endTs;
  });

  // Sort ascending by publish date
  inWindow.sort((a, b) =>
    new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
  );

  return inWindow.map((u, i) => {
    const format = classifyUploadFormat(u);
    const prevDate = i > 0 ? new Date(inWindow[i - 1].publishedAt).getTime() : null;
    const thisDate = new Date(u.publishedAt).getTime();
    const daysSincePrevious = prevDate
      ? Math.round((thisDate - prevDate) / 86400000)
      : null;

    return {
      id: u.id,
      title: u.title,
      publishedAt: u.publishedAt,
      format,
      formatMeta: getFormatMeta(format),
      viewCount: u.viewCount,
      likeCount: u.likeCount,
      commentCount: u.commentCount,
      durationSec: u.durationSec,
      daysSincePrevious,
      isCollab: u.isCollab ?? false,
    };
  });
}
