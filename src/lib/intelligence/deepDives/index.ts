/**
 * THE SEEDED DEEP DIVES
 *
 * One entry per deck that has been transcribed. Adding a deck means adding
 * a file here and a line below — deliberately manual, because the thing
 * being registered is an argument about an artist and it should be reviewed
 * like one.
 *
 * ── A NOTE ON SLUGS ───────────────────────────────────────────────────
 * The static ARTISTS array holds seven artists; the rest of the roster is
 * loaded from Redis at runtime, so a slug cannot be verified from the repo.
 * The keys below are the slugs the decks themselves declare. Where one does
 * not resolve against the live roster, `resolveArtist` in ../needs.ts falls
 * back to a normalised name match and the tool layer REPORTS the mismatch
 * rather than returning an empty Deep Dive, which would read as "this
 * artist has no analysis" when it means "we looked under the wrong name".
 */

import type { DeepDiveContext } from '../types';
import { CHVRCHES_DEEP_DIVE } from './chvrches';
import { IDLES_DEEP_DIVE } from './idles';
import { KOL_DEEP_DIVE } from './kol';
import { KTRAP_DEEP_DIVE } from './ktrap';
import { AMYL_DEEP_DIVE } from './amyl';
import { PALAYE_DEEP_DIVE } from './palaye';

const ALL: DeepDiveContext[] = [
  CHVRCHES_DEEP_DIVE,
  IDLES_DEEP_DIVE,
  KOL_DEEP_DIVE,
  KTRAP_DEEP_DIVE,
  AMYL_DEEP_DIVE,
  PALAYE_DEEP_DIVE,
];

export const SEEDED_DEEP_DIVES: Record<string, DeepDiveContext> =
  Object.fromEntries(ALL.map(d => [d.artistSlug, d]));

/** Normalised artist names → slug, for resolving a Deep Dive without a slug. */
export const DEEP_DIVE_BY_NAME: Record<string, string> =
  Object.fromEntries(ALL.map(d => [normaliseName(d.artistName), d.artistSlug]));

export function normaliseName(s: string): string {
  return s.toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]/g, '');
}
