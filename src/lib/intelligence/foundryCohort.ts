/**
 * FOUNDRY COHORT — YouTube Music Foundry artists, kept together.
 *
 * The point of this file is small and deliberately stays small: it records
 * WHICH channels belong to which Foundry cohort, and carries a slot for a
 * hand-written editorial note about any of them.
 *
 * It stores no metrics. Watcher already holds subscribers, views, uploads
 * and cadence for these channels, and builds history from the day each was
 * added. Duplicating any of that here would create a second number that
 * eventually disagrees with the first.
 *
 * An earlier version of this file carried an immutable baseline system,
 * signal structures and follow-through models. That was over-built for the
 * job, and it is gone.
 *
 * ── ON IDENTIFIERS ────────────────────────────────────────────────────
 * Keyed on channel ID. Names and handles change; channel IDs do not. This
 * is not theoretical — the original cohort list named sixteen artists, of
 * which three matched no channel and one was spelled differently from the
 * channel it referred to.
 *
 * ── ON LANGUAGE ───────────────────────────────────────────────────────
 * We observe public channel behaviour for artists who happen to be in a
 * development programme. We have no visibility of that programme or its
 * selection, so nothing here computes "Foundry impact" and nothing implies
 * we know why a channel did what it did.
 */

/* Two intakes so far, and they stay separate in the data even though the
   page reads them together. A cohort is when YouTube selected an artist;
   collapsing that into one bucket would make it impossible to ever ask
   whether the two intakes behave differently. */
export type FoundryCohortId = 'foundry-2026-summer' | 'foundry-2026-fall';

export type FoundryCohort = {
  id: FoundryCohortId;
  label: string;
  /** Short form, for a per-row marker where the full label is too long. */
  short: string;
  year: number;
  drop: string;
};

export const FOUNDRY_COHORTS: Record<FoundryCohortId, FoundryCohort> = {
  'foundry-2026-summer': {
    id: 'foundry-2026-summer',
    label: 'YouTube Foundry 2026 — first cohort',
    short: 'Summer',
    year: 2026,
    drop: 'Summer',
  },
  'foundry-2026-fall': {
    id: 'foundry-2026-fall',
    label: 'YouTube Foundry 2026 — Fall',
    short: 'Fall',
    year: 2026,
    drop: 'Fall',
  },
};

export const FOUNDRY_COHORT_IDS = Object.keys(FOUNDRY_COHORTS) as FoundryCohortId[];

/**
 * The editorial layer — the actually valuable part.
 *
 * Written by hand when someone notices something, never generated. Three
 * kinds, matching the three things worth saying about a channel we're
 * watching. An artist with no note simply has none, and the page shows
 * nothing rather than padding.
 */
export type FoundryNoteKind = 'watching' | 'case-study' | 'reference';

export type FoundryNote = {
  kind: FoundryNoteKind;
  note: string;
  /** For 'reference' notes: the VMG artist this might be useful to. */
  forVmgArtist?: string;
};

/**
 * Where an artist is from, as stated in the Foundry cohort information.
 *
 * An array, not a single value, because some artists have a dual identity
 * that a single country would misrepresent — RaiNao is Puerto Rican, which
 * is also the United States, and flattening that either way loses something
 * real. Order matters: the first entry leads.
 *
 * `code` is ISO 3166-1 alpha-2, which is all the flag needs: a flag emoji is
 * just the two letters as regional indicators, so nothing has to store an
 * image or a per-country mapping.
 */
export type FoundryCountry = { code: string; name: string };

export type FoundryMember = {
  channelId: string;
  slug: string;          // Watcher slug
  name: string;
  handle: string;
  cohort: FoundryCohortId;
  /** In the Foundry cohort AND on the VMG roster. True for underscores. */
  vmgManaged: boolean;
  /** From the cohort information. Absent where we have not established it —
      absent, never guessed, and the page shows nothing rather than a flag
      that might be wrong. */
  countries?: FoundryCountry[];
  note?: FoundryNote;
};

/* Declared BEFORE the roster that reads it.
   The previous version declared this below FOUNDRY_MEMBERS, which calls it
   while initialising — a temporal dead zone error that threw on module
   load. TypeScript does not catch it, so it type-checked clean and then
   failed every production build for four commits. Order matters here. */
const VMG_MANAGED = new Set<string>(['underscores']);

/* Shorthand for the roster below, declared before it is read — see the note
   above on declaration order. */
const S: FoundryCohortId = 'foundry-2026-summer';

/** Hand-written notes, keyed by slug. Empty until something is genuinely
    worth saying — see FoundryNote above. */
const NOTES: Record<string, FoundryNote> = {};

/* ── COUNTRY ──────────────────────────────────────────────────────────
   Every tracked artist, from the Foundry cohort information. Written down
   rather than inferred: YouTube does not expose a channel's country
   anywhere we read, and deriving one from a channel title or the language
   of a video title would produce something that looks verified and is not.

   RaiNao was briefly carried as Puerto Rico / USA on an earlier reading of
   the cohort information; the full list gives Puerto Rico alone, so that is
   what it says. Zeina is Lebanon and Egypt, which is why this is an array —
   flattening it would drop half of a real identity.

   An artist missing here renders no flag at all rather than a placeholder,
   and FOUNDRY_COUNTRY_UNKNOWN below reports the gap. */
const COUNTRIES: Record<string, FoundryCountry[]> = {
  /* First 2026 cohort */
  rainao:         [{ code: 'PR', name: 'Puerto Rico' }],
  silicagel:      [{ code: 'KR', name: 'South Korea' }],
  soffiemusic:    [{ code: 'DE', name: 'Germany' }],
  theparadoxband: [{ code: 'US', name: 'USA' }],
  tks2g:          [{ code: 'FR', name: 'France' }],
  wasiaproject:   [{ code: 'GB', name: 'UK' }],
  wavetoearth:    [{ code: 'KR', name: 'South Korea' }],
  zippyfala:      [{ code: 'PL', name: 'Poland' }],
  amandamagalhaes:   [{ code: 'BR', name: 'Brazil' }],
  iamciza:           [{ code: 'ZA', name: 'South Africa' }],
  daminibhatla:      [{ code: 'IN', name: 'India' }],
  francothesir:      [{ code: 'BR', name: 'Brazil' }],
  garvitpriyansh:    [{ code: 'IN', name: 'India' }],
  hamiltonctg:       [{ code: 'CO', name: 'Colombia' }],
  hanroro6055:       [{ code: 'KR', name: 'South Korea' }],
  juliawolfnyc:      [{ code: 'US', name: 'USA' }],
  kelelaofficial:    [{ code: 'US', name: 'USA' }],
  mcluanna:          [{ code: 'BR', name: 'Brazil' }],
  mustbemeek:        [{ code: 'GB', name: 'UK' }],
  momoboydmusic7296: [{ code: 'US', name: 'USA' }],
  n4t4nya:           [{ code: 'GB', name: 'UK' }],
  weareoutstation:   [{ code: 'IN', name: 'India' }],

  /* Fall 2026 */
  aiobahn:        [{ code: 'JP', name: 'Japan' }],
  asfarshamsi:    [{ code: 'FR', name: 'France' }],
  baranskok:      [{ code: 'DE', name: 'Germany' }],
  flvckka:        [{ code: 'MX', name: 'Mexico' }],
  gabrieljacoby:  [{ code: 'US', name: 'USA' }],
  harhaofficial:  [{ code: 'JP', name: 'Japan' }],
  jonnymahoro:    [{ code: 'DE', name: 'Germany' }],
  josejr:         [{ code: 'BR', name: 'Brazil' }],
  kevisymaykyy:   [{ code: 'MX', name: 'Mexico' }],
  mariasss:       [{ code: 'BR', name: 'Brazil' }],
  maxmcnown:      [{ code: 'US', name: 'USA' }],
  takasetoya:     [{ code: 'JP', name: 'Japan' }],
  thisislorelei:  [{ code: 'US', name: 'USA' }],
  underscores:    [{ code: 'US', name: 'USA' }],
  yapimks:        [{ code: 'ES', name: 'Spain' }],
  /* The one dual identity in the cohort, and the reason this is an array. */
  zeinamates:     [{ code: 'LB', name: 'Lebanon' }, { code: 'EG', name: 'Egypt' }],
};

/** Tracked artists with no country established yet — for review, so the gap
    is visible rather than silently empty on the page. */
export const FOUNDRY_COUNTRY_UNKNOWN = () =>
  FOUNDRY_MEMBERS.filter(a => !a.countries?.length).map(a => a.name);

/**
 * THE FALL 2026 ROSTER.
 * Every channel ID was read back from Watcher rather than typed in.
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


  /* ── THE FIRST 2026 COHORT (Summer) ──────────────────────────────────
     Selected before the Fall intake and added here on 18 September. Every
     channel ID and handle was read off the channel itself and then checked
     against what Watcher stored on add — not typed from the brief. Six
     arrived as channel IDs and two as handles; all eight resolved to a
     channel whose own title matches the artist. */
  m('UC-eDoMjP2VBrXtNOkNgxQiQ', 'rainao',         'RaiNao',         '@rainao',         S),
  /* Watcher holds the channel's own title, which carries the Korean name. */
  m('UCXteMTpHAvyDP05G0QULuZA', 'silicagel',      'Silica Gel 실리카겔', '@silicagel',   S),
  m('UCshXgyGxsBzR8mVk7IC1K_Q', 'soffiemusic',    'SOFFIE',         '@soffiemusic',    S),
  m('UCAgPDQ0haCpdUm7FGQoYStw', 'theparadoxband', 'The Paradox',    '@theparadoxband', S),
  m('UCiRWTc0sdBm-G37iVA4idEg', 'tks2g',          'TKS 2G',         '@tks2g',          S),
  m('UCgIjUYl5i3LDBRFPHkiLULA', 'wasiaproject',   'Wasia Project',  '@wasiaproject',   S),
  m('UCBJNpcJaUcVyw4LlqGRMpcQ', 'wavetoearth',    'wave to earth',  '@wavetoearth',    S),
  /* The handle is @zippyfala, not @zippyogar. */
  m('UCpw7wrI_lazxjBTkkZVQ0Dg', 'zippyfala',      'Zippy Ogar',     '@zippyfala',      S),

  /* ── The rest of the first 2026 cohort ───────────────────────────────
     Added 18 September. These arrived as names only, so each was resolved by
     search and then opened before it was trusted — a name is not an
     identifier, and several of these are words before they are artists.
     Three were confirmed by what the channel actually publishes rather than
     by its title alone: HAMILTON CTG describes itself as the official
     Hamilton channel and features Ryan Castro; Amanda Magalhães' own bio
     places her in Brazilian music; Natanya and MEEK are artist channels
     publishing official videos under those exact names.

     Two are deliberately absent — see FOUNDRY_NEEDS_HANDLE below. */
  m('UCrQ6yz1cWXPHqZdC-c_-a6w', 'amandamagalhaes', 'Amanda Magalhães', '@amandamagalhaes', S),
  m('UC73PP9j19LxoWc-tml8NE3A', 'iamciza',         'CIZA',             '@iamciza',         S),
  m('UC7n0h20zOhCc2E2kLN9WJ4w', 'daminibhatla',    'Damini Bhatla',    '@daminibhatla',    S),
  m('UCy9PEH_oOYSusHmi5yGvAQg', 'francothesir',    'Franco, The Sir!', '@francothesir',    S),
  m('UCGC7az4IFm1nITBjqm3vv1g', 'garvitpriyansh',  'Garvit - Priyansh','@garvitpriyansh',  S),
  m('UCUmXhDO53cPrsm7Ep8Kiv3Q', 'hamiltonctg',     'HAMILTON CTG',     '@hamiltonctg',     S),
  m('UCrDa_5OU-rhvXqWlPx5hgKQ', 'hanroro6055',     '한로로 HANRORO',     '@hanroro6055',     S),
  m('UCO5E5lH8cR9v2ya0BpdoAwA', 'juliawolfnyc',    'JULIA WOLF',       '@juliawolfnyc',    S),
  m('UCI2aWCbAUZDzZZ5a5GDtRew', 'kelelaofficial',  'Kelela',           '@kelelaofficial',  S),
  m('UCByhdSOQn-WYVmvWaaFyB2g', 'mcluanna',        'MC LUANNA',        '@mcluanna',        S),
  m('UCF5FUiJFoRPdnfcjbHvTkAQ', 'mustbemeek',      'MEEK',             '@mustbemeek',      S),
  m('UC3p9yNSjfmIGGRe9JAdtwtg', 'momoboydmusic7296','MomoBoydMusic',   '@momoboydmusic7296', S),
  m('UCKxHLGYw0x0c2hgRr1rJ79A', 'n4t4nya',         'Natanya',          '@n4t4nya',         S),
  m('UCRiaNJzUFL63WPC8Ues0j4g', 'weareoutstation', 'OutStation',       '@weareoutstation', S),

  /* The last three, resolved 18 September from handles. They were named in
     the Fall list from the start and sat unresolved because nobody had a
     handle for them — which is precisely why this file is keyed on channel
     ID and not on names. Watcher holds Takase Toya's channel under its own
     bilingual title. */
  m('UC9eX-yFQNy_puCqa-QIKD0Q', 'takasetoya',    '高瀬統也 - Takase Toya', '@takasetoya'),
  m('UClS8Nj7Ia_MuQ_Go52DR9QA', 'thisislorelei', 'This Is Lorelei',      '@thisislorelei'),
  m('UCu_CZvWjKZx1G2w6uWRRJEA', 'yapimks',       'Yapi',                 '@yapimks'),
];

function m(
  channelId: string, slug: string, name: string, handle: string,
  cohort: FoundryCohortId = 'foundry-2026-fall',
): FoundryMember {
  return {
    channelId, slug, name, handle, cohort,
    vmgManaged: VMG_MANAGED.has(slug),
    countries: COUNTRIES[slug],
    note: NOTES[slug],
  };
}

/** Named for a cohort but not yet resolved to a channel in Watcher. Empty
    as of 18 September — every named artist now has a channel. Kept as a
    concept because the next intake will arrive as names before handles, and
    the page explains a count gap rather than letting someone notice it. */
export const FOUNDRY_UNRESOLVED: string[] = [];

/**
 * Named in the cohort but NOT tracked, because a search does not settle
 * which channel is theirs and a wrong channel is worse than a missing one.
 * Each needs a handle or a channel ID from someone who knows.
 *
 *   Antara and Ankita Nandy — the sisters have two separate channels,
 *     ANTARA NANDY and ANKITA NANDY, and the cohort names them as a pair.
 *     Which one the entry refers to, or whether a joint channel exists, is
 *     not something search answers.
 *   Draganov — no channel matching a Moroccan artist appears in the
 *     results; the top hits are unrelated channels with similar names, and
 *     the auto-generated "Draganov - Topic" gives no channel of their own.
 */
export const FOUNDRY_NEEDS_HANDLE = [
  'Antara and Ankita Nandy',
  'Draganov',
];

/** One cohort, or every tracked Foundry artist when asked for 'all'. */
export const membersOf = (cohort: FoundryCohortId | 'all') =>
  cohort === 'all' ? FOUNDRY_MEMBERS : FOUNDRY_MEMBERS.filter(a => a.cohort === cohort);
