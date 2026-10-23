/* ═══════════════════════════════════════════════════════════════════════
   MUSIC OPPORTUNITIES — SHARED SHAPES

   A sandbox that joins YouTube demand signals (charts) to the music that
   feeds the owned channels, and keeps a record of what was known when a
   decision was taken. Nothing here publishes, edits metadata or spends.

   Every record keeps its provenance: which source, which chart, which
   territory, which chart period, and when we collected it. A rank is
   only ever the measure the source defines — a Shorts chart ranks
   creations, not views, and the field names say so.
   ═══════════════════════════════════════════════════════════════════════ */

/** Where a chart reading came from. */
export type ChartSource = 'youtube-data-api' | 'chartmetric' | 'manual-import';

/** What the ranking measures, in the source's own terms. */
export type ChartMeasure =
  | 'most-popular-music-videos'   // Data API chart=mostPopular, category 10: YouTube's own ranking, measure unpublished
  | 'song-views-weekly'           // YouTube Charts Top Songs: views across a song's official versions
  | 'music-video-views-weekly'    // YouTube Charts Top Music Videos
  | 'music-video-views-daily'
  | 'shorts-creations-weekly'     // YouTube Charts Top Songs on Shorts: Shorts CREATED, not views
  | 'shorts-creations-daily'
  | 'artist-views-weekly'
  | 'trending-new-releases';

export type ChartEntry = {
  rank: number;
  /** Previous rank from the source, if it reports one. Null means unknown, not "new". */
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
  /** Only for video-level charts. */
  videoId: string | null;
  /** Channel that published the charted video, when known. */
  channelId: string | null;
  channelTitle: string | null;
  /** The source's own count for the period, in the chart's measure. */
  measureValue: number | null;
};

export type ChartObservation = {
  /** Stable id: source|measure|territory|period. Two readings of the same period replace, never duplicate. */
  id: string;
  source: ChartSource;
  measure: ChartMeasure;
  /** ISO 3166-1 alpha-2, or GLOBAL. */
  territory: string;
  /** The chart period as the source states it (e.g. 2026-10-17 for a week ending). For the Data API, the collection date. */
  period: string;
  periodLabel: string;
  sourceUrl: string;
  collectedAt: string;
  /** Free text for manual imports: who imported, from what. */
  note: string | null;
  entries: ChartEntry[];
};

/** A recording we can point at. From a verified source catalogue, or an owned-channel upload. */
export type CatalogueTrack = {
  /** `upload:<videoId>` or `source:<isrc or row id>` */
  id: string;
  origin: 'owned-upload' | 'source-catalogue';
  title: string;
  /** Lead artist credit as parsed or supplied. */
  artist: string | null;
  /** Bracketed descriptor from the title: "Lyric Video", "Remix", "Live". Parsed, not verified. */
  version: string | null;
  isrc: string | null;
  /** Owned channel this is published on, when origin is owned-upload. */
  channelSlug: string | null;
  channelName: string | null;
  videoId: string | null;
  publishedAt: string | null;
  /** Supplied by a source catalogue only; never inferred. */
  genre: string | null;
  language: string | null;
  releaseYear: number | null;
  territories: string | null;
  /** Catalogue says it is cleared for upload. Absent means unverified. */
  rightsNote: string | null;
};

export type MatchKind =
  | 'exact-upload'      // the charted video IS one of our uploads
  | 'isrc'              // same recording by identifier
  | 'title-artist'      // same title and artist credit; version unverified
  | 'title-only'        // same title, different or unknown artist: possible cover/version
  | 'artist';           // same artist credit, different track

export const MATCH_STRENGTH: Record<MatchKind, { label: string; rank: number; caveat: string }> = {
  'exact-upload': { label: 'Exact upload', rank: 0, caveat: 'The charted video is our upload.' },
  'isrc': { label: 'Same recording (ISRC)', rank: 1, caveat: 'Identifier match from the source catalogue. Version confirmed, rights not.' },
  'title-artist': { label: 'Same title and artist', rank: 2, caveat: 'Matched on normalised text. Could be a different version or recording of the same song.' },
  'title-only': { label: 'Same title, different artist', rank: 3, caveat: 'Possibly a cover or a shared title. Needs a human check before any action.' },
  'artist': { label: 'Same artist, different track', rank: 4, caveat: 'Artist-level connection only. The charted song is not in what we hold.' },
};

export type CatalogueMatch = {
  kind: MatchKind;
  track: CatalogueTrack;
  /** What was compared, so a reader can audit the match. */
  evidence: string;
};

export type Stage = 'monitor' | 'act-editorially' | 'consider-paid-test';

export type Opportunity = {
  /** Stable across refreshes: observation id + entry key. */
  id: string;
  observationId: string;
  signal: {
    source: ChartSource; measure: ChartMeasure; territory: string; period: string; periodLabel: string;
    sourceUrl: string; collectedAt: string; rank: number; previousRank: number | null; isNew: boolean | null;
    periodsOnChart: number | null; measureValue: number | null; title: string; artists: string[];
    videoId: string | null; channelTitle: string | null; isrc: string | null;
  };
  /** Same song seen in other stored readings (other periods or territories). Comparable observations only. */
  persistence: { periods: number; territories: string[]; firstSeen: string; lastSeen: string };
  matches: CatalogueMatch[];
  /** Recorded owned-upload figures for matched uploads, from the Owned Channels store. */
  ownedUploads: OwnedUploadEvidence[];
  stage: Stage;
  action: string;
  unknowns: string[];
};

export type OwnedUploadEvidence = {
  videoId: string; title: string; channelSlug: string; channelName: string;
  publishedAt: string;
  /** How this upload was connected to the signal. A baseline only counts towards the paid-test gate when the match is verified. */
  matchKind: MatchKind;
  /** Lifetime views at the latest owned reading. A counter, not a rate. */
  views: number | null;
  readingAt: string | null;
  /** Gain between two comparable readings, with the span in days. Null without a baseline. */
  gain: { views: number; days: number; baselineAt: string } | null;
};

/** What was known when a decision was recorded. Frozen; later readings are appended, never overwritten. */
export type Decision = {
  id: string;
  opportunityId: string;
  recordedAt: string;
  stage: Stage;
  /** The suggested action at the time. */
  suggestedAction: string;
  /** What was actually done, if anything. Free text, recorded by a person. */
  actualAction: string | null;
  notes: string | null;
  /** Evidence as it stood. */
  signal: Opportunity['signal'];
  matches: { kind: MatchKind; trackId: string; title: string; artist: string | null; videoId: string | null; channelName: string | null }[];
  ownedUploads: OwnedUploadEvidence[];
  /** Only for a paid-test consideration. Never includes a budget or a return. */
  test: {
    territory: string; whyTimely: string; creative: string; destination: string;
    organicBaseline: string; learningGoal: string; successCriteria: string; stopCriteria: string;
  } | null;
  /** Later readings of the same uploads, appended by refreshes. */
  followUps: { at: string; videoId: string; views: number | null }[];
};
