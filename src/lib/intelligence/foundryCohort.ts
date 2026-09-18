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

export type FoundryMember = {
  channelId: string;
  slug: string;          // Watcher slug
  name: string;
  handle: string;
  cohort: FoundryCohortId;
  /** In the Foundry cohort AND on the VMG roster. True for underscores. */
  vmgManaged: boolean;
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
    note: NOTES[slug],
  };
}

/** Named for a cohort but not yet resolved to a channel in Watcher. Empty
    as of 18 September — every named artist now has a channel. Kept as a
    concept because the next intake will arrive as names before handles, and
    the page explains a count gap rather than letting someone notice it. */
export const FOUNDRY_UNRESOLVED: string[] = [];

/** One cohort, or every tracked Foundry artist when asked for 'all'. */
export const membersOf = (cohort: FoundryCohortId | 'all') =>
  cohort === 'all' ? FOUNDRY_MEMBERS : FOUNDRY_MEMBERS.filter(a => a.cohort === cohort);
