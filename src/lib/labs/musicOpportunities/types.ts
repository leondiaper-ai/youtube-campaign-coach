/* ═══════════════════════════════════════════════════════════════════════
   MUSIC OPPORTUNITIES — SHARED SHAPES

   A research bank of YouTube demand evidence, connected to the music
   that feeds the owned channels and to what those channels achieve.
   Nothing here publishes, edits metadata or spends.

   Every record keeps its provenance: which source, which chart, which
   territory, which chart period, and when we collected it. A rank is
   only ever the measure the source defines — a Shorts chart ranks
   Shorts created, not views, and the field names say so. Collection
   date and chart period are separate fields and never substitute for
   one another.
   ═══════════════════════════════════════════════════════════════════════ */

/** Where a chart reading came from. */
export type ChartSource =
  | 'youtube-charts-page'   // charts.youtube.com, read from the rendered page in a browser; same data as its Download button
  | 'manual-import';        // a person pasted an export or copy of a chart

/** What the ranking measures, in the source's own terms. */
export type ChartMeasure =
  | 'song-views-weekly'           // YouTube Charts Top Songs: views across a song's official versions
  | 'music-video-views-weekly'    // YouTube Charts Top Music Videos: views of that video
  | 'music-video-views-daily'
  | 'shorts-creations-weekly'     // YouTube Charts Top Songs on Shorts: Shorts CREATED, count not published
  | 'shorts-creations-daily'
  | 'artist-views-weekly'
  | 'trending-new-releases';

/** Which kind of thing a chart ranks. A song chart does not identify a video format. */
export const MEASURE_ENTITY: Record<ChartMeasure, 'song' | 'video' | 'artist'> = {
  'song-views-weekly': 'song', 'music-video-views-weekly': 'video', 'music-video-views-daily': 'video',
  'shorts-creations-weekly': 'song', 'shorts-creations-daily': 'song', 'artist-views-weekly': 'artist', 'trending-new-releases': 'song',
};

export type ChartEntry = {
  rank: number;
  /** Previous rank from the source, if it reports one. Null means unknown or not on the previous chart. */
  previousRank: number | null;
  /** The source says this is a new entry. Null when the source does not say. */
  isNew: boolean | null;
  periodsOnChart: number | null;
  /** The track or video title as the source gives it. */
  title: string;
  /** Artist credit as the source gives it. Empty when the source only gives a combined title. */
  artists: string[];
  /** Only when the source supplies it. Never derived. */
  isrc: string | null;
  /** For video charts: the charted video. For song charts: the video the chart page links to — a representative, NOT the measured entity. */
  videoId: string | null;
  channelId: string | null;
  channelTitle: string | null;
  /** The source's own count for the period, in the chart's measure. Null when the source does not publish it (Shorts). */
  measureValue: number | null;
  /** Release date as the source states it, when it does. */
  releaseDate: string | null;
};

export type ChartObservation = {
  /** Stable id: source|measure|territory|period. Two readings of the same period replace, never duplicate. */
  id: string;
  source: ChartSource;
  measure: ChartMeasure;
  /** ISO 3166-1 alpha-2, or GLOBAL. */
  territory: string;
  /** Chart period end date (YYYY-MM-DD) as the source states it. */
  period: string;
  /** The range as the source shows it, e.g. "Oct 9 – 15, 2026". */
  periodLabel: string;
  sourceUrl: string;
  /** When WE read it. Not the chart period. */
  collectedAt: string;
  note: string | null;
  entries: ChartEntry[];
};

/* ── Classification ──────────────────────────────────────────────────
   A small vocabulary. Multiple labels allowed; "unknown" is the
   default. Every label says where it came from and how sure it is. */
export type Dimension = 'genre' | 'language' | 'era' | 'version' | 'presentation' | 'mood' | 'context';
export type Provenance = 'verified' | 'human' | 'inferred';
export type Confidence = 'high' | 'medium' | 'low';
export type Label = { dimension: Dimension; value: string; provenance: Provenance; confidence: Confidence; basis: string };

export const VOCAB: Record<Dimension, readonly string[]> = {
  genre: ['pop', 'hip-hop/rap', 'r&b/soul', 'rock', 'metal/hard rock', 'electronic/dance', 'drum & bass', 'country', 'folk/americana', 'regional mexican', 'reggaeton/urbano', 'latin pop', 'afrobeats', 'k-pop', 'punjabi/south asian', 'gospel/worship', 'soundtrack/kids', 'other'],
  language: ['en', 'es', 'pt', 'hi', 'pa', 'ko', 'ro', 'de', 'fr', 'ta', 'other'],
  era: ['new (released within 12 months)', 'recent (1–3 years)', 'catalogue (3–15 years)', 'heritage (15+ years)'],
  version: ['original/studio', 'remix', 'live', 'slowed/sped-up edit', 'acoustic', 'cover', 'other edit'],
  presentation: ['official music video', 'lyric video', 'visualiser', 'live performance video', 'audio/static', 'other'],
  mood: ['energetic', 'calm', 'melancholic', 'uplifting', 'dark', 'romantic'],
  context: ['study/focus', 'party/club', 'workout', 'seasonal', 'worship', 'sleep/relax'],
};

/* ── The research bank: one record per thing ─────────────────────── */
export type Appearance = {
  observationId: string; source: ChartSource; measure: ChartMeasure; territory: string; period: string; periodLabel: string;
  collectedAt: string; rank: number; previousRank: number | null; periodsOnChart: number | null; measureValue: number | null;
  /** Video the chart row pointed at. For song charts this is representative only. */
  videoId: string | null;
};

export type SongRecord = {
  /** isrc:… when the source gave one; otherwise text:<normalised title>|<lead artist>. */
  key: string;
  title: string;
  artists: string[];
  isrc: string | null;
  releaseDate: string | null;
  labels: Label[];
  appearances: Appearance[];
  /** Distinct video ids the song's chart rows pointed at. Several ids mean several versions/uploads carried it. */
  linkedVideoIds: string[];
};

export type VideoRecord = {
  videoId: string;
  title: string;
  artists: string[];
  releaseDate: string | null;
  /** Song this video was listed under, when a song chart linked to it. */
  songKey: string | null;
  labels: Label[];
  /** Video-chart appearances only. A song-chart link is not an appearance of the video. */
  appearances: Appearance[];
};

/** Persistence within one chart series; breadth across territories reported separately. */
export type Persistence = {
  /** (source|measure|territory) → distinct periods seen, first/last period, best rank */
  bySeries: { source: ChartSource; measure: ChartMeasure; territory: string; periods: string[]; bestRank: number; latestRank: number | null; latestPeriod: string }[];
  territories: string[];
  measures: ChartMeasure[];
};

/* ── Catalogue ───────────────────────────────────────────────────── */
export type CatalogueTrack = {
  /** `upload:<videoId>` or `source:<isrc or row id>` */
  id: string;
  origin: 'owned-upload' | 'source-catalogue';
  title: string;
  artist: string | null;
  /** Bracketed descriptor from the title: "Lyric Video", "Remix", "Live". Parsed, not verified. */
  version: string | null;
  isrc: string | null;
  channelSlug: string | null;
  channelName: string | null;
  videoId: string | null;
  publishedAt: string | null;
  /** Lifetime views at the inventory's reading, when the inventory carried them. */
  views: number | null;
  durationSec: number | null;
  genre: string | null;
  language: string | null;
  releaseYear: number | null;
  territories: string | null;
  rightsNote: string | null;
  labels: Label[];
};

export type MatchKind = 'exact-upload' | 'isrc' | 'title-artist' | 'title-only' | 'artist';

export const MATCH_STRENGTH: Record<MatchKind, { label: string; rank: number; caveat: string }> = {
  'exact-upload': { label: 'Exact upload', rank: 0, caveat: 'The charted video is our upload.' },
  'isrc': { label: 'Same recording (ISRC)', rank: 1, caveat: 'Identifier match from the source catalogue. Version confirmed, rights not.' },
  'title-artist': { label: 'Same title and artist', rank: 2, caveat: 'Matched on normalised text. Could be a different version or recording of the same song.' },
  'title-only': { label: 'Same title, different artist', rank: 3, caveat: 'Possibly a cover or a shared title. Needs a human check before any action.' },
  'artist': { label: 'Same artist, different track', rank: 4, caveat: 'Artist-level connection only. The charted song is not in what we hold.' },
};

export type CatalogueMatch = { kind: MatchKind; track: CatalogueTrack; evidence: string };

export type Stage = 'monitor' | 'act-editorially' | 'consider-paid-test';

export type OwnedUploadEvidence = {
  videoId: string; title: string; channelSlug: string; channelName: string; publishedAt: string;
  matchKind: MatchKind;
  views: number | null;
  readingAt: string | null;
  gain: { views: number; days: number; baselineAt: string } | null;
};

/** A direct connection between a charted song and what we hold. */
export type Opportunity = {
  id: string;
  observationId: string;
  signal: {
    source: ChartSource; measure: ChartMeasure; territory: string; period: string; periodLabel: string;
    sourceUrl: string; collectedAt: string; rank: number; previousRank: number | null; isNew: boolean | null;
    periodsOnChart: number | null; measureValue: number | null; title: string; artists: string[];
    videoId: string | null; channelTitle: string | null; isrc: string | null;
  };
  persistence: { periods: number; territories: string[]; firstSeen: string; lastSeen: string };
  matches: CatalogueMatch[];
  ownedUploads: OwnedUploadEvidence[];
  stage: Stage;
  action: string;
  unknowns: string[];
};

/* ── Patterns ────────────────────────────────────────────────────── */
export type Pattern = {
  id: string;
  dimension: Dimension;
  value: string;
  measure: ChartMeasure;
  territory: string;
  /** Distinct songs/videos carrying the label in the latest reading of this series. */
  entities: number;
  /** Of the latest reading's rows, how many carried this label; the denominator is rows with ANY label on this dimension. */
  share: number | null;
  /** True when the label is the chart's norm (≥80% of labelled rows) rather than a pattern within it. */
  baseline: boolean;
  labelledRows: number;
  totalRows: number;
  artists: number;
  /** Share of the labelled rows held by the single most frequent artist credit. */
  topArtistShare: number;
  topArtist: string | null;
  periodsObserved: number;
  /** Rows carrying the label that appeared in every stored period of the series. Null with one stored period. */
  persistentEntities: number | null;
  examples: { title: string; artists: string[]; rank: number; videoId: string | null; songKey: string }[];
  /** Human | verified | inferred counts behind the labels used. */
  provenance: Record<Provenance, number>;
  caveats: string[];
};

/** A contextual (hypothesis-strength) connection between a pattern and tracks we hold. */
export type ContextualMatch = {
  patternId: string;
  channelSlug: string;
  channelName: string;
  /** Tracks on that channel carrying the same label, with the label's provenance. */
  tracks: { track: CatalogueTrack; label: Label }[];
  /** How much of the channel's catalogue carries the label, to show the channel actually programmes it. */
  channelShare: number;
  channelLabelled: number;
  channelTotal: number;
  hypothesis: string;
  caveats: string[];
};

/* ── Decisions ───────────────────────────────────────────────────── */
export type Decision = {
  id: string;
  opportunityId: string;
  recordedAt: string;
  stage: Stage;
  suggestedAction: string;
  actualAction: string | null;
  notes: string | null;
  signal: Opportunity['signal'];
  matches: { kind: MatchKind; trackId: string; title: string; artist: string | null; videoId: string | null; channelName: string | null }[];
  ownedUploads: OwnedUploadEvidence[];
  test: {
    territory: string; whyTimely: string; creative: string; destination: string;
    organicBaseline: string; learningGoal: string; successCriteria: string; stopCriteria: string;
  } | null;
  followUps: { at: string; videoId: string; views: number | null }[];
};

/** A human label, stored. subject is a songKey, `artist:<normalised>` or `upload:<videoId>`. */
export type HumanLabel = { subject: string; dimension: Dimension; value: string; by: string; at: string; note: string | null };
