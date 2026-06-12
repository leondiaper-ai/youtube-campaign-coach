/**
 * Drive Assets — Google Drive asset scanning + classification for the
 * YouTube Campaign Coach.
 *
 * The Next.js app never talks to Google Drive directly. A connected Drive
 * MCP (search_files / list_recent_files / read_file_content / get_file_metadata)
 * scans a campaign's asset folder, the raw file list is classified here into
 * YouTube-native asset classes, and the resulting AssetLibrary is persisted per
 * campaign slug (see driveStore.ts).
 *
 * Everything in this file is PURE and deterministic so it can be unit-tested
 * without Drive access. Classification works from filenames + MIME types only —
 * the same signal the rest of the app uses (see contentStructure.ts).
 *
 * The page answers five questions, and the helpers map to them:
 *   1. What assets do we have?     → summarizeLibrary()
 *   2. What's missing?             → readinessScore() + mapAssetsToTimeline()
 *   3. What can we build?          → bankedOpportunities()
 *   4. Where does it sit?          → mapAssetsToTimeline()
 *   5. What should YouTube know?   → readinessScore().headline
 */

import type { GeneratedPlan, ParsedEvent, TimelineKind } from './planEngine';

// ── Types ────────────────────────────────────────────────────────────────

export type DriveMediaType = 'video' | 'image' | 'audio' | 'doc' | 'other';

/** YouTube-native asset classes, inferred from filenames. */
export type DriveAssetClass =
  | 'official_video'
  | 'visualiser'
  | 'lyric_video'
  | 'bts'
  | 'trailer'
  | 'shorts_cutdown'
  | 'live_performance'
  | 'interview'
  | 'documentary'
  | 'artwork'
  | 'photography'
  | 'audio'
  | 'press_doc'
  | 'other';

/**
 * How confident the classifier is about an asset's class.
 *  high   — explicit filename signal (e.g. "… Official Video", "… Short")
 *  medium — inferred from the containing folder name, or a reliable MIME class
 *  low    — bare media-type guess (e.g. any image → artwork)
 */
export type ClassConfidence = 'high' | 'medium' | 'low';

/** A single classified Drive file. */
export type DriveAsset = {
  id: string;
  name: string;
  mimeType: string;
  mediaType: DriveMediaType;
  assetClass: DriveAssetClass;
  /** Confidence in `assetClass`. Used so folder-derived guesses don't earn full credit. */
  classConfidence: ClassConfidence;
  sizeBytes?: number;
  modifiedTime?: string;
  webViewLink?: string;
};

/** Raw file shape as returned by the Drive MCP (loosely typed on purpose). */
export type RawDriveFile = {
  id: string;
  title?: string;
  name?: string;
  mimeType?: string;
  fileSize?: string | number;
  size?: string | number;
  modifiedTime?: string;
  viewUrl?: string;
  webViewLink?: string;
  /** Name of the containing sub-folder — used as a classification fallback. */
  folderPath?: string;
};

/** A scanned + classified asset folder, persisted per campaign slug. */
export type AssetLibrary = {
  slug: string;
  folderUrl: string;
  folderId?: string;
  folderName?: string;
  scannedAt: string;       // ISO timestamp
  assets: DriveAsset[];
  // ── Scan diff — what changed since the previous scan ──
  /** Timestamp of the previous scan (so the UI can say "3 new since June 2"). */
  previousScannedAt?: string;
  /** Asset IDs that are new since the previous scan. */
  newAssetIds?: string[];
  /** Asset IDs that were removed since the previous scan. */
  removedAssetIds?: string[];
};

// ── Asset class metadata ───────────────────────────────────────────────────

type ClassMeta = {
  label: string;
  /** Is this a primary "anchor" piece (the centre of a release)? */
  anchor: boolean;
  /** The YouTube output(s) this asset most naturally becomes. */
  youtubeOutputs: string[];
};

export const ASSET_CLASS_META: Record<DriveAssetClass, ClassMeta> = {
  official_video:   { label: 'Official Video',   anchor: true,  youtubeOutputs: ['Premiere / Official Video upload'] },
  visualiser:       { label: 'Visualiser',       anchor: true,  youtubeOutputs: ['Visualiser upload', 'Audio-led catalogue piece'] },
  lyric_video:      { label: 'Lyric Video',      anchor: true,  youtubeOutputs: ['Lyric Video upload'] },
  bts:              { label: 'Behind The Scenes', anchor: false, youtubeOutputs: ['BTS Short', 'Making-of longform'] },
  trailer:          { label: 'Trailer / Teaser', anchor: false, youtubeOutputs: ['Teaser Short', 'Announcement video'] },
  shorts_cutdown:   { label: 'Shorts Cutdown',   anchor: false, youtubeOutputs: ['Shorts pack'] },
  live_performance: { label: 'Live Performance', anchor: false, youtubeOutputs: ['Live performance upload', 'Performance Short'] },
  interview:        { label: 'Interview',        anchor: false, youtubeOutputs: ['Interview clip Short', 'Long-listen Community post'] },
  documentary:      { label: 'Documentary',      anchor: true,  youtubeOutputs: ['Documentary upload', 'Doc clip Shorts'] },
  artwork:          { label: 'Artwork / Key Art', anchor: false, youtubeOutputs: ['Thumbnail', 'Community post'] },
  photography:      { label: 'Photography',      anchor: false, youtubeOutputs: ['Community post', 'Thumbnail source'] },
  audio:            { label: 'Audio / Master',   anchor: false, youtubeOutputs: ['Audio for visualiser / lyric video'] },
  press_doc:        { label: 'Press / Document', anchor: false, youtubeOutputs: ['Reference only'] },
  other:            { label: 'Other',            anchor: false, youtubeOutputs: ['Reference only'] },
};

// ── MIME → media type ──────────────────────────────────────────────────────

const DOC_MIMES = new Set([
  'application/pdf',
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.presentation',
  'application/vnd.google-apps.spreadsheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
]);

export function mediaTypeFromMime(mime: string | undefined, name = ''): DriveMediaType {
  const m = (mime ?? '').toLowerCase();
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('audio/')) return 'audio';
  if (DOC_MIMES.has(m) || m.startsWith('text/')) return 'doc';
  // Fall back to extension sniffing when MIME is missing/folder-ish
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (['mp4', 'mov', 'm4v', 'avi', 'mkv', 'webm', 'prores'].includes(ext)) return 'video';
  if (['jpg', 'jpeg', 'png', 'tif', 'tiff', 'gif', 'webp', 'psd', 'ai', 'eps'].includes(ext)) return 'image';
  if (['wav', 'mp3', 'aiff', 'aif', 'flac', 'm4a'].includes(ext)) return 'audio';
  if (['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'csv'].includes(ext)) return 'doc';
  return 'other';
}

// ── Filename classification ────────────────────────────────────────────────
//
// Order matters — most specific signals are tested first. Patterns are kept
// deliberately close to contentStructure.ts so Drive assets and YouTube
// uploads are described in the same vocabulary.

const CLASS_PATTERNS: [RegExp, DriveAssetClass][] = [
  [/\b(official\s*(music\s*)?video|official\s*vid|\bomv\b|\bovid\b)\b/i, 'official_video'],
  // Production edits — "Edit 19b", "DC Edit 2 - Graded", "Director's Cut" etc.
  [/\bedit\s*\d/i, 'official_video'],
  [/\b(dc|director'?s?\s*cut)\b/i, 'official_video'],
  [/\bgraded\b/i, 'official_video'],
  [/\bvisuali[sz]er\b/i, 'visualiser'],
  [/\blyric(s)?\b/i, 'lyric_video'],
  [/\b(documentary|mini[\s-]?doc|\bdoc\b)\b/i, 'documentary'],
  [/\b(behind\s*the\s*scenes|\bbts\b|making\s*of)\b/i, 'bts'],
  [/\b(trailer|teaser|announce(ment)?)\d*\b/i, 'trailer'],
  [/\b(short(s)?|cut[\s_-]?down|cutdown|vertical|9x16|9[:x]16|reel|tiktok|\btt\b)\b/i, 'shorts_cutdown'],
  [/\b(live\s*(session|performance|at|from)|acoustic|stripped\s*back|session)\b/i, 'live_performance'],
  [/\b(interview|conversation|q\s*&\s*a|q\s*and\s*a|press\s*junket)\b/i, 'interview'],
  [/\b(artwork|key\s*art|cover\s*art|packshot|pack\s*shot|single\s*art|poster|thumb(nail)?|cover)\b/i, 'artwork'],
  [/\b(press\s*shot|portrait|gallery|photo(graphy)?|headshot)\b/i, 'photography'],
  [/\b(master|instrumental|stem|wav|audio|mixdown)\b/i, 'audio'],
  [/\b(press\s*release|one[\s-]?pager|fact\s*sheet|asset\s*list|bio|deck|brief)\b/i, 'press_doc'],
];

// Folder-name → class hints. Lower priority than explicit filename signals,
// but higher than the bare media-type fallback. Lets a "Recording BTS" or
// "Shorts : Vertical Cuts" folder classify its otherwise-unlabelled files.
const FOLDER_PATTERNS: [RegExp, DriveAssetClass][] = [
  [/official\s*(music\s*)?video|official\s*vid|\bomv\b/i, 'official_video'],
  [/short|vertical|cut[\s_-]?down|cutdown|reel/i, 'shorts_cutdown'],
  [/visuali[sz]er/i, 'visualiser'],
  [/lyric/i, 'lyric_video'],
  [/documentary|mini[\s-]?doc/i, 'documentary'],
  [/vlog|behind\s*the\s*scenes|\bbts\b|recording|making|studio/i, 'bts'],
  [/performance|\blive\b/i, 'live_performance'],
  [/interview|press\s*junket/i, 'interview'],
  [/still|photo|gallery|portrait/i, 'photography'],
  [/artwork|key\s*art|cover/i, 'artwork'],
];

export type ClassResult = { assetClass: DriveAssetClass; confidence: ClassConfidence };

/**
 * Classify a single Drive file into a YouTube-native asset class, with a
 * confidence level.
 *
 * Priority: explicit filename signal (high) → containing-folder signal
 * (medium) → media type (high for audio, medium for docs, low otherwise).
 * An unlabelled video falls back to 'other' (NOT official_video) so the
 * anchor count is never inflated by raw footage.
 */
export function classifyDriveAssetDetailed(
  name: string,
  mime: string | undefined,
  folderPath?: string,
): ClassResult {
  const n = name ?? '';
  // Normalise separators to spaces so word-boundary patterns still match tokens
  // embedded in real-world filenames like "Track_Visualizer_V04.mp4" or
  // "Asset02_365_9x16_V02.mov" — underscores/dots are word chars, which would
  // otherwise defeat the \b anchors in the class patterns.
  const nNorm = n.replace(/[_.\-]+/g, ' ');
  for (const [re, cls] of CLASS_PATTERNS) {
    if (re.test(nNorm) || re.test(n)) return { assetClass: cls, confidence: 'high' };
  }
  // Contextual fallback — the containing folder often names the asset type,
  // but this is weaker evidence than the filename itself.
  if (folderPath) {
    for (const [re, cls] of FOLDER_PATTERNS) {
      if (re.test(folderPath)) return { assetClass: cls, confidence: 'medium' };
    }
  }
  // Media-type fallback so nothing is lost.
  const media = mediaTypeFromMime(mime, n);
  if (media === 'audio') return { assetClass: 'audio', confidence: 'high' };   // MIME is authoritative
  if (media === 'doc') return { assetClass: 'press_doc', confidence: 'medium' };
  if (media === 'image') return { assetClass: 'artwork', confidence: 'low' };  // could be photography
  return { assetClass: 'other', confidence: 'low' }; // unlabelled video/unknown
}

/** Back-compat: class only. */
export function classifyDriveAsset(
  name: string,
  mime: string | undefined,
  folderPath?: string,
): DriveAssetClass {
  return classifyDriveAssetDetailed(name, mime, folderPath).assetClass;
}

function toSizeBytes(v: string | number | undefined): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === 'number' ? v : parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

/** Normalise + classify a raw Drive file into a DriveAsset. */
export function buildAsset(raw: RawDriveFile): DriveAsset {
  const name = raw.name ?? raw.title ?? 'Untitled';
  const mime = raw.mimeType ?? '';
  const { assetClass, confidence } = classifyDriveAssetDetailed(name, mime, raw.folderPath);
  return {
    id: raw.id,
    name,
    mimeType: mime,
    mediaType: mediaTypeFromMime(mime, name),
    assetClass,
    classConfidence: confidence,
    sizeBytes: toSizeBytes(raw.fileSize ?? raw.size),
    modifiedTime: raw.modifiedTime,
    webViewLink: raw.webViewLink ?? raw.viewUrl,
  };
}

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const SKIP_MIMES = new Set([FOLDER_MIME, 'application/vnd.google-apps.shortcut']);

/** Non-asset files (folders, shortcuts, OS aliases) are dropped. */
function isAsset(f: RawDriveFile): boolean {
  const m = f.mimeType ?? '';
  if (SKIP_MIMES.has(m)) return false;
  if (m.includes('alias')) return false; // application/drive-fs.osx.alias
  return true;
}

/** Build an AssetLibrary from raw Drive files (folders/aliases are dropped). */
export function buildLibrary(
  slug: string,
  folderUrl: string,
  rawFiles: RawDriveFile[],
  opts: { folderId?: string; folderName?: string; scannedAt?: string } = {},
): AssetLibrary {
  const assets = rawFiles
    .filter(isAsset)
    .map(buildAsset);
  return {
    slug,
    folderUrl,
    folderId: opts.folderId,
    folderName: opts.folderName,
    scannedAt: opts.scannedAt ?? new Date().toISOString(),
    assets,
  };
}

// ── 1 + 2. Library summary ─────────────────────────────────────────────────

export type LibrarySummary = {
  total: number;
  videos: number;
  images: number;
  audio: number;
  docs: number;
  byClass: { cls: DriveAssetClass; label: string; count: number; anchor: boolean }[];
  lastUpdated: string | null;   // ISO date of most recently modified asset
  anchorCount: number;          // count of anchor-class assets present
  formatVariety: number;        // distinct non-doc asset classes present
};

export function summarizeLibrary(lib: AssetLibrary): LibrarySummary {
  const counts = new Map<DriveAssetClass, number>();
  let videos = 0, images = 0, audio = 0, docs = 0;
  let lastUpdated: number | null = null;

  for (const a of lib.assets) {
    counts.set(a.assetClass, (counts.get(a.assetClass) ?? 0) + 1);
    if (a.mediaType === 'video') videos++;
    else if (a.mediaType === 'image') images++;
    else if (a.mediaType === 'audio') audio++;
    else if (a.mediaType === 'doc') docs++;
    if (a.modifiedTime) {
      const t = new Date(a.modifiedTime).getTime();
      if (Number.isFinite(t) && (lastUpdated == null || t > lastUpdated)) lastUpdated = t;
    }
  }

  const byClass = Array.from(counts.entries())
    .map(([cls, count]) => ({
      cls,
      label: ASSET_CLASS_META[cls].label,
      count,
      anchor: ASSET_CLASS_META[cls].anchor,
    }))
    .sort((a, b) => b.count - a.count);

  const anchorCount = lib.assets.filter((a) => ASSET_CLASS_META[a.assetClass].anchor).length;
  const formatVariety = new Set(
    lib.assets.filter((a) => a.mediaType !== 'doc').map((a) => a.assetClass),
  ).size;

  return {
    total: lib.assets.length,
    videos, images, audio, docs,
    byClass,
    lastUpdated: lastUpdated != null ? new Date(lastUpdated).toISOString() : null,
    anchorCount,
    formatVariety,
  };
}

// ── 3. Banked content opportunities ────────────────────────────────────────
//
// Translate the raw asset pile into YouTube outputs that could be shipped.
// "Banked" = we already hold the raw material. "Recommended" = a standard
// output the campaign should have but no source asset exists for yet.

export type OpportunityStatus = 'banked' | 'partial' | 'recommended';

export type ContentOpportunity = {
  output: string;
  status: OpportunityStatus;
  /** Asset classes that feed this output. */
  sourceClasses: DriveAssetClass[];
  /** How many held assets feed it. */
  assetCount: number;
  note: string;
};

export function bankedOpportunities(lib: AssetLibrary): ContentOpportunity[] {
  const has = (cls: DriveAssetClass) => lib.assets.filter((a) => a.assetClass === cls);
  const out: ContentOpportunity[] = [];

  const ov = has('official_video');
  if (ov.length) {
    out.push({
      output: 'Premiere — Official Video',
      status: 'banked',
      sourceClasses: ['official_video'],
      assetCount: ov.length,
      note: `${ov.length} official video file${ov.length > 1 ? 's' : ''} ready to schedule as a Premiere.`,
    });
  } else {
    out.push({
      output: 'Premiere — Official Video',
      status: 'recommended',
      sourceClasses: ['official_video'],
      assetCount: 0,
      note: 'No official video in the folder — the campaign anchor is missing.',
    });
  }

  const shorts = has('shorts_cutdown');
  const shortSources = [...has('bts'), ...has('live_performance'), ...has('trailer'), ...has('interview')];
  if (shorts.length) {
    out.push({
      output: 'Shorts pack',
      status: 'banked',
      sourceClasses: ['shorts_cutdown'],
      assetCount: shorts.length,
      note: `${shorts.length} vertical cutdown${shorts.length > 1 ? 's' : ''} ready to post as Shorts.`,
    });
  } else if (shortSources.length) {
    out.push({
      output: 'Shorts pack',
      status: 'partial',
      sourceClasses: Array.from(new Set(shortSources.map((a) => a.assetClass))),
      assetCount: shortSources.length,
      note: `No cut Shorts yet, but ${shortSources.length} longform source${shortSources.length > 1 ? 's' : ''} (BTS / live / trailer) can be cut down.`,
    });
  } else {
    out.push({
      output: 'Shorts pack',
      status: 'recommended',
      sourceClasses: ['shorts_cutdown'],
      assetCount: 0,
      note: 'No vertical material — Shorts drive discovery and should be cut from any video asset.',
    });
  }

  // Visualiser / lyric — catalogue depth
  const vis = has('visualiser');
  const lyric = has('lyric_video');
  const audio = has('audio');
  if (vis.length || lyric.length) {
    out.push({
      output: 'Catalogue depth — Visualiser / Lyric Video',
      status: 'banked',
      sourceClasses: [...(vis.length ? ['visualiser' as const] : []), ...(lyric.length ? ['lyric_video' as const] : [])],
      assetCount: vis.length + lyric.length,
      note: `${vis.length + lyric.length} catalogue piece${vis.length + lyric.length > 1 ? 's' : ''} to extend the release window.`,
    });
  } else if (audio.length) {
    out.push({
      output: 'Catalogue depth — Visualiser / Lyric Video',
      status: 'partial',
      sourceClasses: ['audio'],
      assetCount: audio.length,
      note: `Audio masters present — a visualiser or lyric video can be produced to add depth.`,
    });
  }

  const bts = has('bts');
  if (bts.length) {
    out.push({
      output: 'BTS / Making-of',
      status: 'banked',
      sourceClasses: ['bts'],
      assetCount: bts.length,
      note: `${bts.length} BTS asset${bts.length > 1 ? 's' : ''} for connection content and Shorts.`,
    });
  }

  const live = has('live_performance');
  if (live.length) {
    out.push({
      output: 'Live performance upload',
      status: 'banked',
      sourceClasses: ['live_performance'],
      assetCount: live.length,
      note: `${live.length} live capture${live.length > 1 ? 's' : ''} ready as performance content.`,
    });
  }

  const doc = has('documentary');
  if (doc.length) {
    out.push({
      output: 'Documentary moment',
      status: 'banked',
      sourceClasses: ['documentary'],
      assetCount: doc.length,
      note: `${doc.length} documentary asset${doc.length > 1 ? 's' : ''} — a second campaign peak.`,
    });
  }

  const art = [...has('artwork'), ...has('photography')];
  if (art.length) {
    out.push({
      output: 'Community posts & thumbnails',
      status: 'banked',
      sourceClasses: Array.from(new Set(art.map((a) => a.assetClass))),
      assetCount: art.length,
      note: `${art.length} image asset${art.length > 1 ? 's' : ''} for Community posts, thumbnails and packaging.`,
    });
  }

  return out;
}

// ── 4. Timeline + asset mapping (identity-aware) ────────────────────────────
//
// V2 matching: an asset only satisfies a SPECIFIC milestone when there's an
// identity link between the asset (filename + folder) and the milestone
// (title + known release titles). Class-only matches are campaign-level
// inventory and can never flip a milestone to ready — so one official video
// for "Song One" does not make "Song Two" and "Song Three" ready.
//
// Readiness is split so the two very different "partial" states are not equal:
//   anchor_partial  — the release anchor is present, only support is missing
//   support_partial — the anchor is MISSING, only support material exists
// anchor_partial must always outweigh support_partial.

export type MilestoneReadiness = 'ready' | 'anchor_partial' | 'support_partial' | 'missing' | 'na';

export type MilestoneMapping = {
  dateISO: string;
  title: string;
  kind: TimelineKind;
  /** Assets identity-matched to THIS milestone (can make it ready). */
  assets: DriveAsset[];
  /** Class-relevant assets that belong to a different milestone (inventory only). */
  classOnlyAssets: DriveAsset[];
  /** Asset classes expected for this kind of moment. */
  expected: DriveAssetClass[];
  /** Expected classes present among identity-matched assets. */
  present: DriveAssetClass[];
  /** Expected classes missing. */
  missing: DriveAssetClass[];
  /** Is a release anchor identity-matched to this milestone? */
  anchorPresent: boolean;
  readiness: MilestoneReadiness;
};

/**
 * Per-campaign tuning for mapping + scoring. All optional — defaults apply when
 * a campaign provides nothing. Lets a visualiser-led or official-video-led
 * campaign declare what its milestones need without any campaign-specific code.
 */
export type AssetMappingConfig = {
  /** Override the default expected asset classes for specific moment kinds. */
  expectedByKind?: Partial<Record<TimelineKind, DriveAssetClass[]>>;
  /** Campaign-wide expected classes, unioned into every RELEASE milestone. */
  expectedAssetTypes?: DriveAssetClass[];
  /** Extra classes treated as valid release anchors (e.g. trailer / live). */
  anchorAssetTypes?: DriveAssetClass[];
  /** Known release / single titles — strengthen identity matching. */
  knownTitles?: string[];
};

/** Default expected asset classes by timeline-moment kind. */
const DEFAULT_EXPECTED: Partial<Record<TimelineKind, DriveAssetClass[]>> = {
  singleRelease: ['official_video', 'shorts_cutdown', 'visualiser'],
  albumRelease: ['official_video', 'shorts_cutdown', 'bts', 'artwork'],
  albumAnnounce: ['trailer', 'artwork', 'shorts_cutdown'],
  documentaryRelease: ['documentary', 'trailer', 'shorts_cutdown'],
  documentaryTease: ['trailer', 'shorts_cutdown'],
  tourAnnounce: ['live_performance', 'shorts_cutdown', 'photography'],
  tourDate: ['live_performance', 'shorts_cutdown', 'photography'],
  liveShow: ['live_performance', 'shorts_cutdown', 'photography'],
  festival: ['live_performance', 'shorts_cutdown', 'photography'],
  promoTrip: ['interview', 'shorts_cutdown'],
  podcast: ['interview', 'shorts_cutdown'],
};

const RELEASE_KINDS = new Set<TimelineKind>(['singleRelease', 'albumRelease', 'documentaryRelease']);

/** Classes that count as real support content (for support_partial + variety). */
const SUPPORT_FORMATS: DriveAssetClass[] = [
  'shorts_cutdown', 'bts', 'live_performance', 'interview', 'documentary', 'trailer',
];

/** Is `cls` a release anchor for this campaign? */
function isAnchorClass(cls: DriveAssetClass, config?: AssetMappingConfig): boolean {
  return ASSET_CLASS_META[cls].anchor || !!config?.anchorAssetTypes?.includes(cls);
}

/** Asset classes that a given timeline moment ideally needs. */
function expectedClassesFor(kind: TimelineKind, config?: AssetMappingConfig): DriveAssetClass[] {
  const base = config?.expectedByKind?.[kind] ?? DEFAULT_EXPECTED[kind] ?? ['shorts_cutdown'];
  const extra = (config?.expectedAssetTypes && RELEASE_KINDS.has(kind))
    ? config.expectedAssetTypes
    : [];
  return Array.from(new Set([...base, ...extra]));
}

// ── Identity matching ──────────────────────────────────────────────────────
//
// Generic release/format words are stripped so only DISTINCTIVE tokens (song
// names, project names) drive identity. This is what stops one song's assets
// leaking onto another song's milestone.
const STOP = new Set([
  'the', 'and', 'a', 'an', 'for', 'out', 'now', 'feat', 'ft', 'with', 'x',
  'release', 'single', 'singles', 'album', 'ep', 'deluxe', 'version', 'vol', 'part', 'edit',
  'video', 'official', 'omv', 'ovid', 'mv', 'visualiser', 'visualizer', 'lyric', 'lyrics',
  'bts', 'short', 'shorts', 'clip', 'clips', 'cutdown', 'cut', 'teaser', 'trailer',
  'announce', 'announcement', 'session', 'sessions', 'recording', 'studio', 'performance',
  'performances', 'vlog', 'vlogs', 'acoustic', 'posted', 'final', 'master', 'masters',
  'audio', 'music', 'song', 'songs', 'track', 'tracks', 'day', 'date', 'tour', 'live',
  'subbed', 'subtitled', 'reel', 'vertical', 'day', 'episode',
]);

function tokenize(s: string): Set<string> {
  // Split camelCase / concatenated tokens so export-style filenames like
  // "ThatsAYear" or "AnnaLille" line up with spaced titles ("That's A Year").
  const split = s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')      // lower/digit → Upper
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');   // Upper → Upper+lower (e.g. "AYear" → "A Year")
  return new Set((split.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length >= 3 && !STOP.has(t)));
}

/** Distinctive identity tokens for a milestone, canonicalised via known titles. */
function milestoneIdentity(title: string, config?: AssetMappingConfig): Set<string> {
  const t = tokenize(title);
  for (const known of config?.knownTitles ?? []) {
    const kt = tokenize(known);
    let overlaps = false;
    kt.forEach((x) => { if (t.has(x)) overlaps = true; });
    if (overlaps) kt.forEach((x) => t.add(x));
  }
  return t;
}

/** Identity tokens for an asset (filename). */
function assetIdentity(a: DriveAsset): Set<string> {
  return tokenize(a.name);
}

function shareToken(a: Set<string>, b: Set<string>): boolean {
  let found = false;
  a.forEach((x) => { if (b.has(x)) found = true; });
  return found;
}

export function mapAssetsToTimeline(
  lib: AssetLibrary,
  plan: GeneratedPlan,
  config?: AssetMappingConfig,
): MilestoneMapping[] {
  const events: ParsedEvent[] = plan.events ?? [];
  const milestoneTokens = events.map((ev) => milestoneIdentity(ev.title, config));
  const assetTokenSets = lib.assets.map(assetIdentity);

  // For each asset, which milestone indices it identity-matches.
  const assetTargets = lib.assets.map((_, ai) => {
    const at = assetTokenSets[ai];
    const targets: number[] = [];
    if (at.size > 0) {
      events.forEach((_ev, ei) => {
        if (shareToken(at, milestoneTokens[ei])) targets.push(ei);
      });
    }
    return targets;
  });

  // "Floating" assets match no milestone by name. Attributing them to EVERY
  // milestone is only safe when there's a single milestone (no ambiguity about
  // which moment they belong to). With multiple milestones, a pile of session
  // footage must NOT be stamped onto every one — that's the "✓ Shorts · 19
  // files matched" overconfidence bug. There, floating assets stay
  // campaign-level inventory (surfaced via Asset Snapshot + Support Inventory).
  const allowFloating = events.length <= 1;

  return events.map((ev, ei) => {
    const expected = expectedClassesFor(ev.kind, config);

    // Qualifying assets = identity-matched to THIS milestone (always), plus
    // floating assets ONLY when attribution is unambiguous (single release).
    // Assets that identity-match a different milestone are excluded.
    const qualifying: DriveAsset[] = [];
    const classOnly: DriveAsset[] = [];
    lib.assets.forEach((a, ai) => {
      const targets = assetTargets[ai];
      const identityHere = targets.includes(ei);
      const floating = targets.length === 0 && allowFloating;
      if (identityHere || floating) qualifying.push(a);
      else if (expected.includes(a.assetClass)) classOnly.push(a);
    });

    const presentSet = new Set(qualifying.map((a) => a.assetClass));
    const present = expected.filter((c) => presentSet.has(c));
    const missing = expected.filter((c) => !presentSet.has(c));

    const anchorPresent = qualifying.some((a) => isAnchorClass(a.assetClass, config));
    const supportPresent = qualifying.some(
      (a) => a.assetClass !== 'press_doc' && a.assetClass !== 'other',
    );

    let readiness: MilestoneReadiness;
    if (expected.length === 0) readiness = 'na';
    else if (anchorPresent && missing.length === 0) readiness = 'ready';
    else if (anchorPresent) readiness = 'anchor_partial';
    else if (supportPresent) readiness = 'support_partial';
    else readiness = 'missing';

    return {
      dateISO: ev.dateISO, title: ev.title, kind: ev.kind,
      assets: qualifying, classOnlyAssets: classOnly,
      expected, present, missing, anchorPresent, readiness,
    };
  });
}

// ── 5. Campaign readiness score (V2) ────────────────────────────────────────
//
// Design goals (see scoring critique): anchor is a GATE not 40% of a sum;
// folder-named Shorts are sources not finished deliverables; variety is
// anchor-gated; weak/stale/duplicate assets are down-weighted; the score is
// smooth (no single asset swings it hard); no-plan falls back to library-only
// readiness without faking milestone coverage.

export type ReadinessFactor = { label: string; points: number; max: number; detail: string };

export type ReadinessScore = {
  score: number;            // 0–100
  band: 'Ready' | 'On track' | 'Building' | 'Thin';
  headline: string;         // what YouTube should know next
  factors: ReadinessFactor[];
  /** True when no milestone has its own matched anchor (score is gated). */
  anchorGated: boolean;
};

// Milestone weighting — anchor_partial must dominate support_partial.
const READINESS_WEIGHT: Record<MilestoneReadiness, number> = {
  ready: 1, anchor_partial: 0.8, support_partial: 0.35, missing: 0, na: 0,
};

// Factor maxima (sum = 100). Anchor is the dominant factor.
const MAX_ANCHOR = 55, MAX_SHORTS = 18, MAX_VARIETY = 16, MAX_PACK = 11;
const ON_TRACK = 60;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const sat = (x: number, k: number) => x / (x + k); // smooth saturating 0..1

function confWeight(c: ClassConfidence): number {
  return c === 'high' ? 1 : c === 'medium' ? 0.7 : 0.4;
}
function recencyWeight(iso?: string): number {
  if (!iso) return 0.8;
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (!Number.isFinite(d) || d < 0) return 0.8;
  if (d <= 180) return 1;
  if (d <= 365) return 0.85;
  if (d <= 730) return 0.7;
  return 0.55;
}
function assetWeight(a: DriveAsset): number {
  return confWeight(a.classConfidence) * recencyWeight(a.modifiedTime);
}
// Normalised name for duplicate detection.
function normName(name: string): string {
  return name.toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/\bv\d+\b|\(\d+\)|_\d+\b|\bcopy\b|\bfinal\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
/** Weighted, duplicate-collapsed count of assets matching `pred`. */
function weightedCount(assets: DriveAsset[], pred: (a: DriveAsset) => boolean): number {
  const groups = new Map<string, number>();
  for (const a of assets) {
    if (!pred(a)) continue;
    const k = normName(a.name) || a.id;
    groups.set(k, Math.max(groups.get(k) ?? 0, assetWeight(a)));
  }
  let sum = 0;
  groups.forEach((v) => { sum += v; });
  return sum;
}

const isFinishedShort = (a: DriveAsset) =>
  a.assetClass === 'shorts_cutdown' && a.classConfidence === 'high';
const isShortSource = (a: DriveAsset) =>
  (a.assetClass === 'shorts_cutdown' && a.classConfidence !== 'high') ||
  ['bts', 'live_performance', 'trailer', 'interview'].includes(a.assetClass);

export function readinessScore(
  lib: AssetLibrary,
  plan: GeneratedPlan | null,
  config?: AssetMappingConfig,
): ReadinessScore {
  const assets = lib.assets;
  const total = assets.length;

  // ── Anchor coverage + gate ────────────────────────────────────────────
  const releaseMappings = plan
    ? mapAssetsToTimeline(lib, plan, config).filter((m) => RELEASE_KINDS.has(m.kind))
    : [];
  const hasPlan = releaseMappings.length > 0;

  let anchorScore: number;
  let campaignHasAnchor: boolean;
  let anchorDetail: string;

  if (hasPlan) {
    const milestonesWithAnchor = releaseMappings.filter((m) => m.anchorPresent).length;
    campaignHasAnchor = milestonesWithAnchor > 0;
    anchorScore = releaseMappings.reduce((s, m) => s + READINESS_WEIGHT[m.readiness], 0)
      / releaseMappings.length;
    anchorDetail = `${milestonesWithAnchor}/${releaseMappings.length} release milestone${releaseMappings.length === 1 ? '' : 's'} have their own matched anchor.`;
  } else {
    // No timeline — library readiness only, no faked milestone coverage.
    const anchorWeighted = weightedCount(assets, (a) => isAnchorClass(a.assetClass, config));
    campaignHasAnchor = anchorWeighted > 0.3;
    anchorScore = campaignHasAnchor ? 0.6 : 0;
    anchorDetail = campaignHasAnchor
      ? 'Anchor asset(s) held — no campaign timeline to map coverage against.'
      : 'No release anchor in the library, and no campaign timeline.';
  }

  // ── Shorts pipeline (finished vs source) ─────────────────────────────
  const finished = weightedCount(assets, isFinishedShort);
  const sources = weightedCount(assets, isShortSource);
  const finishedScore = sat(finished, 1.5);     // smooth, diminishing
  const sourceScore = 0.5 * sat(sources, 3);    // sources cap at 0.5
  const shortsScore = Math.max(finishedScore, sourceScore);

  // ── Format variety (anchor-gated) ────────────────────────────────────
  const supportDistinct = SUPPORT_FORMATS.filter(
    (c) => weightedCount(assets, (a) => a.assetClass === c) > 0.3,
  ).length;
  const varietyScore = campaignHasAnchor
    ? clamp01(0.4 + supportDistinct * 0.2)
    : Math.min(0.5, supportDistinct * 0.16); // capped without an anchor

  // ── Packaging ────────────────────────────────────────────────────────
  const images = weightedCount(assets, (a) => a.mediaType === 'image');
  const packScore = sat(images, 2);

  // ── Assemble ─────────────────────────────────────────────────────────
  const factors: ReadinessFactor[] = [
    {
      label: 'Anchor coverage', max: MAX_ANCHOR, points: Math.round(MAX_ANCHOR * anchorScore),
      detail: anchorDetail,
    },
    {
      label: 'Shorts pipeline', max: MAX_SHORTS, points: Math.round(MAX_SHORTS * shortsScore),
      detail: finished >= 0.5
        ? `${Math.round(finished)} finished Short${finished >= 1.5 ? 's' : ''} ready${sources >= 0.5 ? `, plus source clips` : ''}.`
        : sources >= 0.5
          ? `No finished Shorts — ${Math.round(sources)} source clip${sources >= 1.5 ? 's' : ''} (BTS/live/clips) to cut from.`
          : 'No vertical material — discovery risk.',
    },
    {
      label: 'Format variety', max: MAX_VARIETY, points: Math.round(MAX_VARIETY * varietyScore),
      detail: campaignHasAnchor
        ? `${supportDistinct} support format${supportDistinct === 1 ? '' : 's'} orbiting the anchor.`
        : `${supportDistinct} support format${supportDistinct === 1 ? '' : 's'} — capped until a release anchor exists.`,
    },
    {
      label: 'Packaging & artwork', max: MAX_PACK, points: Math.round(MAX_PACK * packScore),
      detail: images >= 0.5
        ? `${Math.round(images)} image asset${images >= 1.5 ? 's' : ''} for thumbnails and Community.`
        : 'No artwork — thumbnails and Community packaging unsupported.',
    },
  ];

  let score = factors.reduce((s, f) => s + f.points, 0);
  // ── Anchor gate: no matched anchor ⇒ never "On track". ────────────────
  if (!campaignHasAnchor) score = Math.min(score, ON_TRACK - 1);
  score = Math.max(0, Math.min(100, score));

  const band: ReadinessScore['band'] =
    score >= 80 ? 'Ready' : score >= ON_TRACK ? 'On track' : score >= 35 ? 'Building' : 'Thin';

  // ── Headline — "what should YouTube know about next?" ─────────────────
  let headline: string;
  if (total === 0) {
    headline = 'No assets scanned yet — connect the campaign folder to begin.';
  } else if (!campaignHasAnchor) {
    const strongInventory = total >= 4 && (shortsScore > 0.3 || supportDistinct >= 2);
    headline = strongInventory
      ? `Sizable support library (${total} assets) but no release anchor yet — secure an official video, visualiser or lyric video.`
      : 'No release anchor yet — secure an official video, visualiser or lyric video before scheduling.';
  } else if (anchorScore < 0.75) {
    headline = 'Anchors are landing but coverage is uneven — close the gaps on releases still missing their video.';
  } else if (shortsScore < 0.45) {
    headline = 'Anchors are in place — the next move is cutting finished Shorts to drive discovery.';
  } else if (packScore < 0.5) {
    headline = 'Strong core — add artwork/photography for thumbnails and Community packaging.';
  } else {
    headline = 'Asset library is campaign-ready — schedule the Premiere and stagger the Shorts pack.';
  }

  return { score, band, headline, factors, anchorGated: !campaignHasAnchor };
}

// ── 6. Support inventory (independent of anchor gating) ──────────────────────
//
// Answers a DIFFERENT question to Release Readiness: how much usable supporting
// content exists to sustain a channel between release moments? This score is
// NOT anchor-gated and must never imply the campaign is release-ready — it only
// describes the depth of BTS / live / Shorts-source / imagery material.

export type SupportBand = 'Weak' | 'Building' | 'Strong' | 'Deep';

export type SupportInventory = {
  score: number;          // 0–100
  band: SupportBand;
  /** One-line read on whether there's enough to sustain between releases. */
  depth: string;
  /** Best-available support formats, strongest first. */
  bestFormats: { label: string; count: number }[];
};

/** Is this asset usable supporting material (not an anchor, not a doc/other)? */
function isSupportAsset(a: DriveAsset): boolean {
  if (a.mediaType === 'image') return true;
  return ['shorts_cutdown', 'bts', 'live_performance', 'interview', 'trailer', 'audio'].includes(a.assetClass);
}

// Distinct support categories used for breadth.
const SUPPORT_CATEGORIES: { key: string; label: string; pred: (a: DriveAsset) => boolean }[] = [
  { key: 'shorts', label: 'Shorts source', pred: (a) => a.assetClass === 'shorts_cutdown' },
  { key: 'bts', label: 'Behind The Scenes', pred: (a) => a.assetClass === 'bts' },
  { key: 'live', label: 'Live Performance', pred: (a) => a.assetClass === 'live_performance' },
  { key: 'interview', label: 'Interview', pred: (a) => a.assetClass === 'interview' },
  { key: 'trailer', label: 'Trailer / Teaser', pred: (a) => a.assetClass === 'trailer' },
  { key: 'images', label: 'Artwork / Images', pred: (a) => a.mediaType === 'image' },
  { key: 'audio', label: 'Audio / Master', pred: (a) => a.assetClass === 'audio' },
];

export function supportInventory(lib: AssetLibrary): SupportInventory {
  const assets = lib.assets;

  // Breadth — distinct support categories actually present.
  const present = SUPPORT_CATEGORIES
    .map((c) => ({ ...c, weight: weightedCount(assets, c.pred), count: assets.filter(c.pred).length }))
    .filter((c) => c.weight > 0.3);
  const breadthScore = clamp01(present.length / 5); // 5 distinct categories = full breadth

  // Depth — total weighted, de-duplicated support volume.
  const volume = weightedCount(assets, isSupportAsset);
  const depthScore = sat(volume, 8); // 8 weighted units ≈ 0.5; lots → toward 1

  const score = Math.max(0, Math.min(100, Math.round(100 * (0.5 * breadthScore + 0.5 * depthScore))));
  const band: SupportBand =
    score >= 80 ? 'Deep' : score >= 55 ? 'Strong' : score >= 30 ? 'Building' : 'Weak';

  const bestFormats = present
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4)
    .map((c) => ({ label: c.label, count: c.count }));

  const depth =
    band === 'Deep' ? 'Deep support library — easily sustains activity between releases.'
    : band === 'Strong' ? 'Strong support library — plenty to sustain the channel between drops.'
    : band === 'Building' ? 'Some support material — partial cover between release moments.'
    : 'Little support material — gaps likely between release moments.';

  return { score, band, depth, bestFormats };
}

// ── Drive folder URL parsing ────────────────────────────────────────────────

/** Extract a folder ID from a Google Drive folder URL. */
export function parseDriveFolderId(url: string): string | null {
  if (!url) return null;
  const m =
    url.match(/\/folders\/([a-zA-Z0-9_-]+)/) ??
    url.match(/[?&]id=([a-zA-Z0-9_-]+)/) ??
    url.match(/\/drive\/u\/\d+\/folders\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}
