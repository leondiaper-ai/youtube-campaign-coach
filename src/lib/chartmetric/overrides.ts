/* ═══════════════════════════════════════════════════════════════════
   CHARTMETRIC — MANUAL ARTIST OVERRIDES

   Chartmetric's /get-ids endpoint maps a YouTube channel to their
   artist record. It is exact when it works, and it is the only
   automatic route we use — we do not fall back to name search, because
   name search is how "Morad" became a Persian channel.

   But /get-ids has coverage gaps: Chartmetric holds the artist, and
   holds the channel, and simply has not linked the two. When that
   happens the artist is invisible to every audience view even though
   the data plainly exists on Chartmetric's own site.

   This file is the narrow, auditable escape hatch. Each entry is a
   Chartmetric artist id that a NAMED HUMAN read off the Chartmetric UI
   for a KNOWN channel. It is not a guess, not a search result, and not
   inferred from an artist's name.

   RULES FOR ADDING AN ENTRY
     1. Open app.chartmetric.com, find the artist, confirm it is the
        right one, and take the id from the URL.
     2. Record who confirmed it and when. If nobody is named, it does
        not go in.
     3. The pipeline still stores Chartmetric's own artist_name next to
        the result, so a wrong id shows up as a wrong name on the page
        rather than as silently wrong numbers.

   An override is a statement that a human checked. It is not a way to
   make a stubborn artist appear.
   ═══════════════════════════════════════════════════════════════════ */

export type CmOverride = {
  /** Chartmetric artist id, read from the artist's Chartmetric URL. */
  cmArtistId: number;
  /** Who confirmed it, so the claim has an owner. */
  verifiedBy: string;
  /** ISO date of that confirmation. */
  verifiedOn: string;
  /** Why the automatic route did not work. */
  note: string;
};

/**
 * Keyed by YouTube channel id — the same key resolveCmArtist() works
 * in, so an override short-circuits exactly the lookup that failed.
 */
export const CM_ARTIST_OVERRIDES: Record<string, CmOverride> = {
  // K-Trap. /get-ids returns no cm_artist for this channel, re-checked
  // with a forced refresh on 2026-09-25. Chartmetric does hold him.
  UCqIJW85jvRWdVRR_ecMX02w: {
    cmArtistId: 523770,
    verifiedBy: 'Leon Diaper',
    verifiedOn: '2026-09-25',
    note: 'Chartmetric has the artist and the channel but has not linked them; /get-ids returns null. Id taken from app.chartmetric.com/artist/523770.',
  },
};

export const cmOverrideFor = (channelId: string): CmOverride | null =>
  CM_ARTIST_OVERRIDES[channelId] ?? null;
