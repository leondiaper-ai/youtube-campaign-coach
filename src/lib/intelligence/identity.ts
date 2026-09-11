/**
 * CANONICAL ARTIST IDENTITY
 *
 * One artist, three names for them, and until now no place that said so.
 *
 *   roster slug   derived from the YouTube handle: `idlesband`,
 *                 `palayeroyale`, `amylandthesniffers6771`
 *   deck slug     what a person would type: `idles`, `palaye`, `amyl`
 *   display name  "Amyl and The Sniffers"
 *
 * The previous build bridged these on a normalised name match. That works
 * until it doesn't: two artists with similar names, a roster entry renamed,
 * a deck for an artist whose channel title differs from their billing. A
 * fuzzy join that is right 95% of the time is worse than an explicit one,
 * because the 5% is silent and looks like missing data.
 *
 * So the mapping is written down. Each entry was checked against the live
 * roster on 11 Sep 2026 — all six decks resolved, none were missing.
 *
 * ── THE FALLBACK STAYS, DEMOTED ───────────────────────────────────────
 * Name matching is not deleted, because a new deck added tomorrow should
 * still resolve rather than returning nothing until someone edits a table.
 * It is now the SECOND path, and `resolvedBy` says which one fired, so an
 * artist resolving by name is a visible prompt to add an alias rather than
 * an invisible piece of luck.
 */

/**
 * deck slug → roster slug.
 *
 * Verified 11 Sep 2026 against the live roster (181 artists) via
 * /api/artists. Re-verify after any roster migration: `checkAliases()`
 * below does it, and is exposed through the tool layer.
 */
export const DECK_TO_ROSTER: Record<string, string> = {
  chvrches: 'chvrches',
  idles: 'idlesband',
  kingsofleon: 'kingsofleon',
  'k-trap': 'k-trap',
  amyl: 'amylandthesniffers6771',
  palaye: 'palayeroyale',
};

/** roster slug → deck slug. Built from the above so they cannot diverge. */
export const ROSTER_TO_DECK: Record<string, string> =
  Object.fromEntries(Object.entries(DECK_TO_ROSTER).map(([deck, roster]) => [roster, deck]));

/**
 * Extra spellings a person or a model might type for an artist we know.
 * Not a fuzzy matcher — a list of things actually worth accepting. Keys are
 * normalised (lowercase, alphanumerics only) before lookup.
 */
export const ARTIST_ALIASES: Record<string, string> = {
  churches: 'chvrches',
  kol: 'kingsofleon',
  ktrap: 'k-trap',
  amylandthesniffers: 'amyl',
  amylsniffers: 'amyl',
  palayeroyale: 'palaye',
  idlesband: 'idles',
  theidles: 'idles',
};

export function normaliseKey(s: string): string {
  return s.toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]/g, '');
}

/** The deck slug for any accepted spelling, or null. */
export function deckSlugFor(input: string): string | null {
  const raw = input.trim();
  if (DECK_TO_ROSTER[raw]) return raw;
  if (ROSTER_TO_DECK[raw]) return ROSTER_TO_DECK[raw];
  const k = normaliseKey(raw);
  if (ARTIST_ALIASES[k]) return ARTIST_ALIASES[k];
  if (DECK_TO_ROSTER[k]) return k;
  if (ROSTER_TO_DECK[k]) return ROSTER_TO_DECK[k];
  return null;
}

/** The roster slug for any accepted spelling, or null. */
export function rosterSlugFor(input: string): string | null {
  const deck = deckSlugFor(input);
  return deck ? DECK_TO_ROSTER[deck] ?? null : null;
}

export interface AliasCheck {
  deckSlug: string;
  expectedRosterSlug: string;
  foundOnRoster: boolean;
  rosterName: string | null;
  /** Set when the table points somewhere that no longer exists. */
  problem: string | null;
}

/**
 * Checks every alias against a roster snapshot. A table that is never
 * checked is a table that quietly rots, and the failure mode — an artist
 * with a full Deep Dive reporting no needs — is one we have already had
 * once.
 */
export function checkAliases(roster: { slug: string; name: string }[]): AliasCheck[] {
  const bySlug = new Map(roster.map(a => [a.slug, a]));
  return Object.entries(DECK_TO_ROSTER).map(([deckSlug, expected]) => {
    const found = bySlug.get(expected);
    return {
      deckSlug,
      expectedRosterSlug: expected,
      foundOnRoster: Boolean(found),
      rosterName: found?.name ?? null,
      problem: found
        ? null
        : `Alias points at "${expected}", which is not on the roster. The Deep Dive for "${deckSlug}" `
          + 'will fall back to a name match, or resolve to nothing. Fix DECK_TO_ROSTER.',
    };
  });
}
