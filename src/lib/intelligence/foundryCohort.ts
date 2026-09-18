/**
 * FOUNDRY COHORT — YouTube Music Foundry artists, tracked longitudinally.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHERE THE DATA LIVES
 *
 * Watcher stays the source of truth for every channel and video number.
 * This module owns exactly two things Watcher has no opinion about:
 *
 *   1. MEMBERSHIP — which channels are in which Foundry cohort.
 *   2. BASELINE   — what each channel looked like on the day we started
 *                   watching, frozen so it can never drift.
 *
 * Everything else — subscribers, views, cadence, formats, latest upload —
 * is read live from Watcher at request time. There is deliberately no
 * second copy of it here. A duplicated metric is a metric that will
 * eventually disagree with itself, and then nobody trusts either number.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY CHANNEL ID IS THE JOIN KEY
 *
 * Artist names and handles change; channel IDs do not. The roster below
 * is keyed on the UC id, with slug and display name carried alongside for
 * convenience only. If an artist renames, the row keeps working and the
 * display name is the thing that updates.
 *
 * This matters more than it sounds. The brief listed the cohort by name;
 * three of those names did not resolve to anything in Watcher, and one
 * resolved under a different spelling. Names are not identifiers.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT THIS MODULE WILL NOT DO
 *
 * It will not compute "Foundry impact". We observe public channel
 * behaviour for artists who happen to be in a development programme; we
 * have no visibility of what the programme does, and growth in a tracked
 * window has many causes. The only claim this module supports is
 * SINCE TRACKING — a measured change over a stated period — and the
 * naming throughout reflects that on purpose.
 */

/* ══════════════════════════════════════════════════════════════════════
   COHORT DEFINITION
   ══════════════════════════════════════════════════════════════════════ */

export type FoundryCohortId = 'foundry-2026-fall' | 'foundry-2026-summer';

export type FoundryCohort = {
  id: FoundryCohortId;
  label: string;        // human-readable, for display
  year: number;
  season: 'Spring' | 'Summer' | 'Fall' | 'Winter';
  /** When WE started watching. Not when the artist joined Foundry — we
      have no reliable visibility of that date and must not imply we do. */
  trackingStarted: string;   // yyyy-mm-dd
};

export const FOUNDRY_COHORTS: Record<FoundryCohortId, FoundryCohort> = {
  'foundry-2026-fall': {
    id: 'foundry-2026-fall',
    label: 'YouTube Foundry 2026 — Fall',
    year: 2026,
    season: 'Fall',
    trackingStarted: '2026-09-18',
  },
  'foundry-2026-summer': {
    id: 'foundry-2026-summer',
    label: 'YouTube Foundry 2026 — Summer',
    year: 2026,
    season: 'Summer',
    trackingStarted: '',
  },
};

export type FoundryCaseStudyStatus = 'watching' | 'candidate' | 'in_progress' | 'published';

export type FoundryMember = {
  channelId: string;          // UC… — the primary key, everywhere
  slug: string;               // Watcher slug, for /api/artist-live
  name: string;               // display name as Watcher holds it
  handle: string | null;
  cohort: FoundryCohortId;

  /* Left null until verified from a source we can point at. The brief was
     explicit that country and genre must not appear as headline facts
     before that, so they are null rather than guessed, and the UI omits
     any field that is null rather than printing a dash. */
  country: string | null;
  lane: string | null;

  /** Editorial, manually curated. Never algorithmic — see the note on
      comparables at the bottom of this file. */
  comparableVmgArtists: { slug: string; name: string; why: string }[];

  caseStudyStatus: FoundryCaseStudyStatus;
  /** Editorial note for CHANNELS TO WATCH. Empty until a real behaviour
      is worth pointing at; an empty string renders nothing. */
  editorialNote: string;
};

/**
 * THE FALL 2026 ROSTER.
 *
 * Every channel id below was read back from Watcher rather than typed in,
 * so each one is known to resolve. The brief named sixteen artists; these
 * are the thirteen that exist in Watcher today. The three unresolved names
 * are recorded in FOUNDRY_UNRESOLVED rather than silently dropped, because
 * a cohort that quietly shrinks is worse than one that says what's missing.
 */
export const FOUNDRY_MEMBERS: FoundryMember[] = [
  m('UC3XZCxTQ55JkT35W27Jtbyg', 'aiobahn',       'Aiobahn',        '@aiobahn'),
  m('UCNRIBdtJ0rfI78V1lv038LQ', 'asfarshamsi',   'Asfar Shamsi',   '@asfarshamsi'),
  m('UCi3VhRuylB_mqaRs2i4m6UQ', 'baranskok',     'Baran Kok',      '@baranskok'),
  m('UCTfE-OcwBm-RZeg_rK7PZhQ', 'flvckka',       'FLVCKKA',        '@flvckka'),
  m('UCAXlAURrll1ILNrflTFNPkA', 'gabrieljacoby', 'gabriel jacoby', '@gabrieljacoby'),
  m('UCDGQhwHu_zcp62fS51dMY4g', 'harhaofficial', 'harha',          '@harha_official'),
  m('UC0ZkmzJLuxAe0Sjb_ZRUyHw', 'jonnymahoro',   'Jonny Mahoro',   '@jonnymahoro'),
  m('UCav7d45yHhVXmVqPI8G_MqQ', 'josejr',        'José Jr',        '@jose_jr'),
  m('UCXd_WcWuCEqJ9B0UJAWGXlQ', 'kevisymaykyy',  'KEVIS Y MAYKYY', '@kevisymaykyy'),
  m('UC9OT6NW4KTE75YbqkPpgYNA', 'mariasss',      'Mariasss',       '@mariasss'),
  m('UCrutg3fZvLPjQCKZjLeA8Ng', 'maxmcnown',     'Max McNown',     '@maxmcnown'),
  m('UC7Dr19bFdqkkfREMITgY9Vg', 'underscores',   'underscores',    '@underscores'),
  m('UCakRh4eU8scBO-SzfEKFm9w', 'zeinamates',    'Zeina',          '@zeinamates'),
];

function m(channelId: string, slug: string, name: string, handle: string): FoundryMember {
  return {
    channelId, slug, name, handle,
    cohort: 'foundry-2026-fall',
    country: null, lane: null,
    comparableVmgArtists: [],
    caseStudyStatus: 'watching',
    editorialNote: '',
  };
}

/**
 * Named in the brief, not found in Watcher. Surfaced by the API so the
 * gap is visible rather than being mistaken for a cohort of thirteen.
 * Each needs a channel adding to Watcher before it can join the roster.
 */
export const FOUNDRY_UNRESOLVED = [
  { name: 'Takase Toya',    note: 'no matching channel in Watcher' },
  { name: 'This Is Lorelei', note: 'no matching channel in Watcher' },
  { name: 'Yapi',           note: 'no matching channel in Watcher' },
];

/** The brief spelled this "KEVIS Y MAYYKI"; Watcher holds "KEVIS Y MAYKYY".
    Recorded so the discrepancy is resolved deliberately rather than by
    whoever edits the roster next. */
export const FOUNDRY_SPELLING_NOTES = [
  { watcher: 'KEVIS Y MAYKYY', brief: 'KEVIS Y MAYYKI', channelId: 'UCXd_WcWuCEqJ9B0UJAWGXlQ' },
];

export const membersOf = (cohort: FoundryCohortId) =>
  FOUNDRY_MEMBERS.filter(a => a.cohort === cohort);

export const memberByChannelId = (id: string) =>
  FOUNDRY_MEMBERS.find(a => a.channelId === id) ?? null;

/* ══════════════════════════════════════════════════════════════════════
   BASELINE — the anchor for "since tracking"
   ══════════════════════════════════════════════════════════════════════ */

export type FoundryBaseline = {
  channelId: string;
  capturedAt: string;          // ISO — the moment this was frozen
  subscribers: number | null;
  totalViews: number | null;
  videoCount: number | null;
  lastUploadAt: string | null;
  uploadsLast7Days: number | null;
  uploadsLast14Days: number | null;
  shortsLast14Days: number | null;
  longformLast14Days: number | null;
  /** What Watcher knew at capture time. A baseline taken on day one of
      tracking has no history behind it, and a reader deserves to know
      that before drawing a trend through it. */
  watcherHistoryDays: number | null;
};

/** Shape of a live row: baseline + current + the delta between them. */
export type FoundryRow = {
  member: FoundryMember;
  current: {
    subscribers: number | null;
    totalViews: number | null;
    videoCount: number | null;
    lastUploadAt: string | null;
    daysSinceUpload: number | null;
    uploadsLast7Days: number | null;
    uploadsLast14Days: number | null;
    shortsLast14Days: number | null;
    longformLast14Days: number | null;
    views7: number | null;
    views30: number | null;
    subs30: number | null;
    activity: FoundryActivity;
  } | null;
  baseline: FoundryBaseline | null;
  /** Null until there is genuinely a gap between baseline and now. On the
      first day of tracking every delta is zero, and showing a row of
      zeroes invites someone to read it as "no growth" rather than
      "no elapsed time". */
  sinceTracking: {
    days: number;
    subscribers: number | null;
    totalViews: number | null;
    uploads: number | null;
  } | null;
};

export type FoundryActivity = 'ACTIVE' | 'STEADY' | 'SLOW' | 'DORMANT';

/**
 * Activity from observable cadence only. The thresholds are deliberately
 * coarse — this is a reading aid for a cohort table, not a judgement of
 * an artist, and a four-way split is about as much as fourteen days of
 * upload counts can honestly support.
 */
export function activityOf(daysSinceUpload: number | null, uploads14: number | null): FoundryActivity {
  const d = daysSinceUpload ?? 9999;
  const u = uploads14 ?? 0;
  if (d <= 7 && u >= 3) return 'ACTIVE';
  if (d <= 14) return 'STEADY';
  if (d <= 45) return 'SLOW';
  return 'DORMANT';
}

/* ══════════════════════════════════════════════════════════════════════
   SIGNALS — cohort-level findings, empty until earned
   ══════════════════════════════════════════════════════════════════════ */

export type FoundrySignal = {
  id: string;
  /** e.g. "11 / 16" — always a count over a stated denominator, never a
      percentage. The sample is small enough that a percentage would imply
      precision the cohort size cannot carry. */
  figure: string;
  headline: string;
  detail: string;
  /** Every signal must name the window it was measured over and the date
      it was computed, or it is not publishable. */
  measuredOver: string;
  computedAt: string;
  method: string;
};

/**
 * Deliberately empty.
 *
 * The brief gave examples of the KIND of finding wanted here — Shorts
 * within 72 hours of long-form, a second long-form inside 14 days — and
 * was explicit that they are not current findings. Tracking began today.
 * Nothing in a single snapshot can support a cohort claim, so this array
 * stays empty and the page says so, rather than shipping a plausible
 * number that nobody measured.
 */
export const FOUNDRY_SIGNALS: FoundrySignal[] = [];

/* ══════════════════════════════════════════════════════════════════════
   FOLLOW-THROUGH — the 7–14 day window, structured now, computed later
   ══════════════════════════════════════════════════════════════════════ */

export type FollowThroughEvent = {
  channelId: string;
  anchorVideoId: string;
  anchorPublishedAt: string;
  anchorFormat: string;
  /** Did another meaningful asset land 7–14 days after the anchor?
      Null until the window has fully elapsed — an open window is not a
      failure, and scoring it as one would bias the cohort read downward
      exactly the way our own 22/23 finding must not be biased upward. */
  followedUp: boolean | null;
  followUpVideoId: string | null;
  followUpPublishedAt: string | null;
  windowClosesAt: string;
};

export const FOUNDRY_FOLLOW_THROUGH: FollowThroughEvent[] = [];

/* ══════════════════════════════════════════════════════════════════════
   COMPARABLES

   Manually curated, always. The temptation is to compute similarity from
   subscriber count and upload cadence and call it a lane — but a lane is
   a scene, an audience and a way of making things, none of which are in
   the numbers we hold. An algorithm here would produce confident pairings
   that a label team would quite reasonably act on.

   The framing is also load-bearing: a comparable is "a useful reference
   for this team", never "this artist should be in Foundry". We have no
   visibility of YouTube's selection and must never imply otherwise.
   ══════════════════════════════════════════════════════════════════════ */

export function comparablesFor(channelId: string) {
  return memberByChannelId(channelId)?.comparableVmgArtists ?? [];
}
