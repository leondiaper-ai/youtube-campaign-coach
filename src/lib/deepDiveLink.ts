/**
 * DEEP DIVE LINKS — which artists have a hand-built deck, and where it lives
 *
 * The decks are static HTML in /public/<dir>/index.html, served at the bare
 * path. Two registries already describe them and neither is sufficient alone:
 *
 *   - RESOURCE_GROUPS (lib/resources.ts) is the human-facing index at
 *     /resources. It has the URL and a blurb, but it is hand-maintained and
 *     two real artist decks are missing from it (TEN, Angus & Julia Stone).
 *   - SEEDED_DEEP_DIVES (lib/intelligence/deepDives) is the machine-readable
 *     transcription used by the Coach tools. It covers six decks only.
 *
 * Neither is keyed by artist slug, and the directory names are not slugs
 * either — TEN's deck is at /tenoffcl, Kings of Leon's at /kol. So the join
 * has to happen on the artist NAME, normalised.
 *
 * This module is the single lookup the artist page uses. It resolves by name
 * because that is the only key both registries and the live Redis roster
 * share. A missing artist returns null and the page shows no link at all —
 * a dead "deep dive" link is worse than no link, because it reads as though
 * the analysis exists and is broken.
 *
 * ── ADDING A DECK ─────────────────────────────────────────────────────
 * Add it to RESOURCE_GROUPS (so it appears at /resources too) and it will
 * be picked up here automatically. Only add it to EXTRA_DECKS below if it
 * deliberately should NOT appear on the /resources index.
 */

import { RESOURCE_GROUPS } from './resources';
import { normaliseName } from './intelligence/deepDives';

export interface DeepDiveLink {
  /** Path on this origin, e.g. "/chvrches". */
  href: string;
  /** The deck's own title, for the link's tooltip. */
  title: string;
  /** Month the deck was last revised, as recorded in the registry. */
  updated?: string;
  /**
   * True when the deck is reachable by anyone holding the URL — no login.
   * The action bar marks these, because the artist page itself is internal
   * and the two should not look alike.
   */
  publicLink?: boolean;
}

/**
 * Decks on disk that are absent from RESOURCE_GROUPS. Keyed by the artist
 * name as the roster spells it. These are real decks; they were simply never
 * added to the index. Listing them here is the narrow fix — the broader one
 * is to add them to RESOURCE_GROUPS, which is a content decision, not mine.
 */
const EXTRA_DECKS: Record<string, DeepDiveLink> = {
  ten: { href: '/tenoffcl', title: 'TEN × YouTube — the first 57 days' },
  angusjuliastone: {
    href: '/angusandjuliastone',
    title: 'Angus & Julia Stone × YouTube — Karaoke Bar',
  },
};

/*
 * There are also "-live" pages on disk (/amyl-live, /ktrap-live). These
 * used to be preferred here on the reasoning that a live page beats a
 * frozen one — which was wrong. They are working surfaces, not the deep
 * dive: the deep dive is the deck that was written and reviewed, and it
 * is what "Deep dive" has to open. They are deliberately NOT mapped.
 */

/** name → link, built once at module load from the artist-decks group. */
const BY_NAME: Record<string, DeepDiveLink> = (() => {
  const out: Record<string, DeepDiveLink> = {};

  const artistDecks = RESOURCE_GROUPS.find(g => g.heading === 'Artist decks');
  for (const item of artistDecks?.items ?? []) {
    /* Registry titles carry campaign suffixes the roster does not know
       about — "IDLES — TANGK", "K-Trap — TRAPO 2". Match on the artist part
       so those still resolve. */
    const artistPart = item.title.split('—')[0].trim();
    out[normaliseName(artistPart)] = {
      href: item.href,
      title: item.title,
      updated: item.updated,
      publicLink: item.external,
    };
  }

  for (const [key, link] of Object.entries(EXTRA_DECKS)) out[key] = link;

  return out;
})();

/**
 * The deck for an artist, or null when there isn't one.
 * Pass the artist's display name as the roster holds it.
 */
export function deepDiveFor(artistName: string | undefined | null): DeepDiveLink | null {
  if (!artistName) return null;
  return BY_NAME[normaliseName(artistName)] ?? null;
}

/** Every artist name that has a deck. Exported for the roster-wide audit. */
export function artistsWithDeepDives(): string[] {
  return Object.keys(BY_NAME);
}
