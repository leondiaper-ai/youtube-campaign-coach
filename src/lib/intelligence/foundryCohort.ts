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

export type FoundryCohortId = 'foundry-2026-fall';

export type FoundryCohort = {
  id: FoundryCohortId;
  label: string;
  year: number;
  drop: string;
};

export const FOUNDRY_COHORTS: Record<FoundryCohortId, FoundryCohort> = {
  'foundry-2026-fall': {
    id: 'foundry-2026-fall',
    label: 'YouTube Foundry 2026 — Fall',
    year: 2026,
    drop: 'Fall',
  },
};

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
];

function m(channelId: string, slug: string, name: string, handle: string): FoundryMember {
  return {
    channelId, slug, name, handle,
    cohort: 'foundry-2026-fall',
    vmgManaged: VMG_MANAGED.has(slug),
    note: NOTES[slug],
  };
}

/** Named for this cohort but not yet resolved to a channel in Watcher.
    Kept visible so the count difference is explained rather than noticed. */
export const FOUNDRY_UNRESOLVED = ['Takase Toya', 'This Is Lorelei', 'Yapi'];

export const membersOf = (cohort: FoundryCohortId) =>
  FOUNDRY_MEMBERS.filter(a => a.cohort === cohort);
