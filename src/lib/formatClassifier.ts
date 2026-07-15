/**
 * Content format classifier for Campaign Behaviour View — V5 Content Intelligence
 *
 * Classifies YouTube uploads into actionable format categories
 * that music marketing teams can understand at a glance.
 *
 * Three-level classification:
 *   Level 1: Short vs Long-form (duration-based)
 *   Level 2: Long-form sub-type (title/description-based)
 *   Level 3: Short sub-type (title/description-based, for hover detail)
 *
 * Also extracts a short content title for two-line chart markers.
 */

import type { RecentUpload } from './artists';

// ── Format types ─────────────────────────────────────────────────────────

export type UploadFormat =
  | 'short'
  | 'omv'        // Official Music Video
  | 'lyric'      // Lyric Video
  | 'visualiser' // Visualiser / Visual
  | 'live'       // Live Performance
  | 'acoustic'   // Acoustic / Stripped / Unplugged
  | 'bts'        // Behind The Scenes / Making Of
  | 'documentary'// Documentary (separate from BTS)
  | 'interview'  // Interview / Track Breakdown
  | 'audio'      // Audio-only
  | 'tour'       // Tour / Festival content
  | 'longform';  // Other long-form (catch-all)

export type ShortType =
  | 'teaser'
  | 'performance_clip'
  | 'mv_clip'
  | 'bts'
  | 'announcement'
  | 'tour_festival'
  | 'lyric_snippet'
  | 'talking_to_camera'
  | 'fan_content'
  | 'meme_trend'
  | 'other';

export type FormatMeta = {
  format: UploadFormat;
  label: string;        // Human-readable label
  shortLabel: string;   // Abbreviated label for markers
  isShort: boolean;
  isLongform: boolean;
};

// ── Format metadata lookup ───────────────────────────────────────────────

const FORMAT_META: Record<UploadFormat, Omit<FormatMeta, 'format'>> = {
  short:       { label: 'Short',                    shortLabel: 'S',     isShort: true,  isLongform: false },
  omv:         { label: 'Official Music Video',     shortLabel: 'OMV',   isShort: false, isLongform: true },
  lyric:       { label: 'Lyric Video',              shortLabel: 'LYR',   isShort: false, isLongform: true },
  visualiser:  { label: 'Visualiser',               shortLabel: 'VIS',   isShort: false, isLongform: true },
  live:        { label: 'Live Performance',         shortLabel: 'LIVE',  isShort: false, isLongform: true },
  acoustic:    { label: 'Acoustic',                 shortLabel: 'ACOU',  isShort: false, isLongform: true },
  bts:         { label: 'Behind The Scenes',        shortLabel: 'BTS',   isShort: false, isLongform: true },
  documentary: { label: 'Documentary',              shortLabel: 'DOC',   isShort: false, isLongform: true },
  interview:   { label: 'Interview',                shortLabel: 'INT',   isShort: false, isLongform: true },
  audio:       { label: 'Audio',                    shortLabel: 'AUD',   isShort: false, isLongform: true },
  tour:        { label: 'Tour / Festival',          shortLabel: 'TOUR',  isShort: false, isLongform: true },
  longform:    { label: 'Long-form',                shortLabel: 'LF',    isShort: false, isLongform: true },
};

export function getFormatMeta(format: UploadFormat): FormatMeta {
  return { format, ...FORMAT_META[format] };
}

// ── Format colours (design-system aligned) ───────────────────────────────

export const FORMAT_COLORS: Record<UploadFormat, string> = {
  short:       '#8A847A',  // smoke — understated
  omv:         '#FF4A1C',  // signal — primary content, most prominent
  lyric:       '#2C25FF',  // electric — distinct from OMV
  visualiser:  '#1FBE7A',  // mint
  live:        '#FFD24C',  // sun — warm, energetic
  acoustic:    '#D4A574',  // warm tan — intimate tone
  bts:         '#F08A3C',  // warm orange
  documentary: '#0891B2',  // cyan — storytelling
  interview:   '#6366F1',  // indigo
  audio:       '#A78BFA',  // soft purple
  tour:        '#E879A8',  // warm pink — event energy
  longform:    '#6B7280',  // neutral grey
};

// ── Short type labels ────────────────────────────────────────────────────

export const SHORT_TYPE_LABELS: Record<ShortType, string> = {
  teaser:           'Teaser',
  performance_clip: 'Performance Clip',
  mv_clip:          'Music Video Clip',
  bts:              'Behind The Scenes',
  announcement:     'Announcement',
  tour_festival:    'Tour / Festival',
  lyric_snippet:    'Lyric Snippet',
  talking_to_camera:'Talking To Camera',
  fan_content:      'Fan Content',
  meme_trend:       'Meme / Trend',
  other:            'Short',
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
  const haystack = `${upload.title} ${upload.description ?? ''}`.toLowerCase();

  // Acoustic / Stripped / Unplugged — check BEFORE live to avoid
  // "Acoustic Live Session" → live when acoustic is the primary format
  if (/\b(acoustic\s*(version|video|session|performance)?|stripped\s*(back|down|version)?|unplugged)\b/.test(haystack)) {
    return 'acoustic';
  }

  // Live / Performance — check BEFORE official to avoid "Official Live Video" → omv
  if (/\b(live\s+(session|performance|video|at|from|in\b)|performance\s+video|tiny\s+desk|colors?\s+show|plugged|vevo\s+live|live\s+lounge)\b/.test(haystack)) {
    return 'live';
  }
  // Also flag if the upload was actually a live broadcast
  if (upload.actualStart && upload.live !== 'upcoming') return 'live';

  // Tour / Festival
  if (/\b(tour\s+(diary|vlog|video|recap|highlights?)|festival\s+(recap|highlights?|set|performance)|on\s+tour|tour\s+life|backstage\s+at)\b/.test(haystack)) {
    return 'tour';
  }

  // Documentary (check before BTS — more specific)
  if (/\b(documentary|the\s+story\s+of|the\s+journey|mini[-\s]?doc|short\s+film|film)\b/.test(haystack) &&
      !/\bshort\s+film\b/.test(haystack)) {
    return 'documentary';
  }

  // Interview / Track Breakdown
  if (/\b(interview|track\s+breakdown|song\s+breakdown|track\s+by\s+track|explained|commentary|q\s*&?\s*a|reacts?\s+to)\b/.test(haystack)) {
    return 'interview';
  }

  // Behind The Scenes / Making Of
  if (/\b(behind\s+the\s+scenes|making\s+of|bts|the\s+making|in\s+the\s+studio|studio\s+session|recording\s+session)\b/.test(haystack)) {
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

/**
 * Classify a Short into a more specific sub-type for hover detail.
 */
export function classifyShortType(upload: RecentUpload): ShortType {
  const haystack = `${upload.title} ${upload.description ?? ''}`.toLowerCase();

  // Teaser / Preview
  if (/\b(teaser|preview|coming\s+soon|sneak\s+peek|snippet|out\s+now|pre[-\s]?save)\b/.test(haystack)) {
    return 'teaser';
  }

  // Music video clip
  if (/\b(music\s+video|official\s+video|mv\s+clip|video\s+clip)\b/.test(haystack)) {
    return 'mv_clip';
  }

  // Performance clip
  if (/\b(performance|live|concert|stage|perform|play(?:ing|ed)?\s+(live|on))\b/.test(haystack)) {
    return 'performance_clip';
  }

  // BTS
  if (/\b(behind\s+the\s+scenes|bts|making\s+of|studio|in\s+the\s+studio|recording)\b/.test(haystack)) {
    return 'bts';
  }

  // Announcement
  if (/\b(announc|reveal|new\s+(album|single|ep|song)|drop(?:ping|s)?|release\s+date)\b/.test(haystack)) {
    return 'announcement';
  }

  // Tour / Festival
  if (/\b(tour|festival|concert|gig|venue|backstage|on\s+the\s+road)\b/.test(haystack)) {
    return 'tour_festival';
  }

  // Lyric snippet
  if (/\b(lyric|lyrics|verse|chorus|hook|bar(?:s)?)\b/.test(haystack)) {
    return 'lyric_snippet';
  }

  // Talking to camera
  if (/\b(vlog|talking|chat|update|message\s+to|thank\s+you|thanks)\b/.test(haystack)) {
    return 'talking_to_camera';
  }

  // Fan content
  if (/\b(fan|react|cover|duet|challenge|trend)\b/.test(haystack)) {
    if (/\b(react|cover|duet)\b/.test(haystack)) return 'fan_content';
  }

  // Meme / Trend
  if (/\b(meme|trend|viral|fyp|foryou)\b/.test(haystack)) {
    return 'meme_trend';
  }

  return 'other';
}

// ── Short title extraction ──────────────────────────────────────────────

/**
 * Extract a concise content title for chart markers.
 *
 * Strips artist name prefix and format identifiers, returning just
 * the song/content name. E.g.:
 *   "Koffee - Rapture (Official Music Video)" → "Rapture"
 *   "Nickelback - San Quentin (Official Lyric Video)" → "San Quentin"
 *   "Bloc Party - Sex Magik Live at Glastonbury" → "Sex Magik"
 */
export function extractShortTitle(fullTitle: string, artistName?: string): string {
  let title = fullTitle.trim();

  // Step 1: Remove artist name prefix (Artist - , Artist | , Artist: )
  if (artistName) {
    // Build a pattern that matches the artist name followed by a separator
    const escaped = artistName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefixPattern = new RegExp(
      `^${escaped}(?:\\s+(?:feat\\.?|ft\\.?|x|&|and|with)\\s+[^\\-–—|:]+)?\\s*[-–—|:]\\s*`,
      'i'
    );
    title = title.replace(prefixPattern, '');
  } else {
    // No artist name — try to split on common separators
    const sepMatch = title.match(/^[^-–—|]+?\s*[-–—|]\s+(.+)$/);
    if (sepMatch) {
      title = sepMatch[1];
    }
  }

  // Step 2: Remove format identifiers in parentheses or brackets
  title = title.replace(
    /\s*[\(\[](official\s*(music\s*)?video|lyric(?:s)?\s*video|visuali[sz]er|audio|official\s+audio|live(?:\s+(?:at|from|in)\s+[^\)]+)?|acoustic(?:\s+version)?|behind\s+the\s+scenes|making\s+of|bts|official|hd|4k|hq|\d+p|remastered|explicit|clean|full\s+video|music\s+video|mv)[\)\]]/gi,
    ''
  );

  // Step 3: Remove trailing format keywords not in parens
  title = title.replace(
    /\s*(?:official\s*(music\s*)?video|lyric(?:s)?\s*video|visuali[sz]er|official\s+audio|audio)\s*$/gi,
    ''
  );

  // Step 4: Remove "ft./feat." suffix if it ends the cleaned title
  title = title.replace(/\s+(?:feat\.?|ft\.?)\s+.*$/i, '');

  // Step 5: Trim and enforce max length
  title = title.trim();

  // Remove trailing punctuation that looks wrong on its own
  title = title.replace(/[-–—|:,]\s*$/, '').trim();

  if (!title) {
    title = fullTitle.trim();
  }

  // Truncate to ~24 chars for chart labels
  if (title.length > 24) {
    // Try to break at a word boundary
    const truncated = title.slice(0, 22).replace(/\s+\S*$/, '');
    title = (truncated || title.slice(0, 22)) + '…';
  }

  return title.toUpperCase();
}

// ── Enriched upload type for the behaviour view ──────────────────────────

export type ClassifiedUpload = {
  id: string;
  title: string;
  shortTitle: string;                   // Extracted content name for markers
  publishedAt: string;
  format: UploadFormat;
  formatMeta: FormatMeta;
  shortType?: ShortType;                // Sub-classification for shorts
  shortTypeLabel?: string;              // Human-readable short type label
  viewCount: number;
  likeCount: number;
  commentCount: number;
  durationSec: number;
  daysSincePrevious: number | null;     // null for first upload in window
  isCollab: boolean;
};

/**
 * Classify and enrich a list of uploads for the campaign behaviour view.
 * Sorts by publishedAt ascending and computes daysSincePrevious.
 *
 * @param artistName — artist name for short title extraction
 */
export function classifyUploads(
  uploads: RecentUpload[],
  windowStart: string,
  windowEnd: string,
  artistName?: string,
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

    const isShort = format === 'short';
    const shortType = isShort ? classifyShortType(u) : undefined;
    const shortTypeLabel = shortType ? SHORT_TYPE_LABELS[shortType] : undefined;
    const shortTitle = extractShortTitle(u.title, artistName);

    return {
      id: u.id,
      title: u.title,
      shortTitle,
      publishedAt: u.publishedAt,
      format,
      formatMeta: getFormatMeta(format),
      shortType,
      shortTypeLabel,
      viewCount: u.viewCount,
      likeCount: u.likeCount,
      commentCount: u.commentCount,
      durationSec: u.durationSec,
      daysSincePrevious,
      isCollab: u.isCollab ?? false,
    };
  });
}
