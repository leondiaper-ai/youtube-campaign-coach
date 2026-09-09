/**
 * IS THIS AN ARTIST CHANNEL?
 *
 * The Assistant page made this urgent: five of seven channels Scout was
 * watching were T-Series, Sony Music India, Times Music, Think Music India
 * and Lyrical Lemonade. Label aggregators and a media brand, not artists.
 *
 * ── WHY THEY PASSED ──────────────────────────────────────────────────
 * The old test was a regex over title and description that rejected the
 * words "records", "recordings", "music group" and "entertainment". None of
 * those five contains any of them. The regex was a list of the aggregators
 * I happened to think of, which is not a classifier — it is a denylist
 * wearing one, and it fails on the next name nobody thought of.
 *
 * Adding those five names would repeat the mistake. What is needed is a
 * test on how the channel BEHAVES, and there are two structural signals in
 * data we already hold.
 *
 * ── SIGNAL 1: TITLE SELF-REFERENCE ───────────────────────────────────
 * An artist's uploads are mostly about that artist, so the channel name
 * recurs across their own video titles — "AMYL AND THE SNIFFERS - U Should
 * Not Be Doing That". An aggregator's titles are full of OTHER people's
 * names, and the channel's own name appears rarely or never.
 *
 * This is the strongest available signal and it costs nothing: we already
 * hold the titles.
 *
 * ── SIGNAL 2: SCALE OF OUTPUT ────────────────────────────────────────
 * An artist channel with 20,000 uploads does not exist. A label channel
 * with 20,000 uploads is ordinary. Volume alone is weak — a prolific
 * artist can pass 1,000 — so it only contributes, and only at extremes.
 *
 * ── WHY AMBIGUOUS IS A REAL ANSWER ───────────────────────────────────
 * A VEVO channel ("ArtistNameVEVO") is a label-operated channel carrying
 * one artist, and is legitimately interesting. A collective or a project
 * with a name unrelated to its uploads reads like an aggregator and is not.
 * Rather than force those into a binary, they return AMBIGUOUS and stay in
 * the universe as CANDIDATE — visible, not promoted, and available for a
 * human to resolve. Pretending a heuristic is a decision is how five label
 * channels ended up on a page labelled "watching".
 */

import type { ChannelSummary } from '../youtube/discovery';

export type ArtistVerdict = 'ARTIST' | 'NON_ARTIST' | 'AMBIGUOUS';

export interface ArtistCheck {
  verdict: ArtistVerdict;
  /** The figure behind the verdict, so it can be re-checked. */
  reason: string;
  /** 0–1 share of recent titles containing the channel name. */
  selfReference: number | null;
}

/**
 * Names that are structurally not one artist, whatever else they are.
 *
 * Tested against the channel NAME only. The first live test applied it to
 * descriptions too and rejected Madonna, Spotify and Aditya Music Tamil on
 * that basis — an artist's description routinely says "subscribe for news"
 * or links a playlist, and neither makes the channel a playlist channel.
 * A name containing "karaoke" is decisive; a description mentioning it is
 * not, and the difference is the whole distinction between a fact about
 * the channel and a word that happened to appear near it.
 */
const HARD_NON_ARTIST = new RegExp(
  [
    'topic$', 'karaoke', 'reaction', 'react\\b', 'nightcore',
    'slowed\\s*\\+?\\s*reverb', 'playlist', 'compilation', 'best\\s*of\\s*\\d{4}',
    'top\\s*\\d+\\s*songs', 'tutorial', 'podcast', '\\bnews\\b',
    'lyrics?\\s*(channel|world|hub)', 'mix\\s*(tape)?\\s*(channel|hub)',
  ].join('|'),
  'i',
);

/** Words that make a channel likely to be a company rather than an act. */
const COMPANY_HINT = new RegExp(
  '\\b(records|recordings|record\\s*label|music\\s*group|entertainment|' +
  'label|studios?|productions?|media|network|official\\s*channel\\s*of)\\b',
  'i',
);

const STOP = new Set([
  'the', 'a', 'an', 'and', 'of', 'official', 'music', 'vevo', 'tv', 'channel', 'hd',
]);

/** Distinctive tokens from a channel name, lowercased. */
function nameTokens(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !STOP.has(t));
}

/**
 * The share of recent video titles that mention the channel's own name.
 *
 * A single distinctive token is enough — "gorillaz" in "Gorillaz - New
 * Gold" — but a two-token name only counts if at least one distinctive
 * token appears, or "Sony Music India" would match every title containing
 * "india".
 */
export function selfReferenceRate(channelTitle: string, titles: string[]): number | null {
  const tokens = nameTokens(channelTitle);
  if (!tokens.length || titles.length < 8) return null;
  const hits = titles.filter(t => {
    const lower = t.toLowerCase();
    return tokens.some(tok => lower.includes(tok));
  }).length;
  return hits / titles.length;
}

export const ARTIST_CHECK = {
  /** At or above this share of self-referencing titles, treat as an artist. */
  artistRate: 0.5,
  /** Below this, the channel is publishing other people's work. */
  aggregatorRate: 0.2,
  /** No artist channel has this many uploads. */
  hardVideoCap: 5_000,
  /** Above this, volume counts against, but is not decisive alone. */
  softVideoCap: 1_500,
} as const;

/**
 * Verdict from channel metadata plus recent video titles.
 *
 * `titles` is optional because triage runs before any catalogue pull. With
 * no titles the check can only reject the obvious and must otherwise return
 * AMBIGUOUS — which is correct: at that point we genuinely do not know.
 */
export function checkArtistChannel(
  c: ChannelSummary, titles?: string[],
): ArtistCheck {
  const desc = (c.description ?? '').slice(0, 400);

  if (HARD_NON_ARTIST.test(c.title)) {
    return {
      verdict: 'NON_ARTIST', selfReference: null,
      reason: `Channel name matches a structurally non-artist pattern: "${c.title}".`,
    };
  }

  if ((c.videoCount ?? 0) > ARTIST_CHECK.hardVideoCap) {
    return {
      verdict: 'NON_ARTIST', selfReference: null,
      reason: `${(c.videoCount ?? 0).toLocaleString()} uploads — beyond any single artist's catalogue.`,
    };
  }

  const rate = titles ? selfReferenceRate(c.title, titles) : null;

  if (rate == null) {
    /* No titles yet, or a name with no distinctive tokens. Company wording
       is the only remaining evidence, and it is suggestive rather than
       conclusive — plenty of artists have "Studios" in a description. */
    const company = COMPANY_HINT.test(c.title) || COMPANY_HINT.test(desc);
    return {
      verdict: 'AMBIGUOUS', selfReference: null,
      reason: company
        ? `Company wording in name or description, and no upload titles read yet.`
        : `Not yet assessed against upload titles.`,
    };
  }

  const pct = (rate * 100).toFixed(0);

  if (rate < ARTIST_CHECK.aggregatorRate) {
    return {
      verdict: 'NON_ARTIST', selfReference: rate,
      reason: `Only ${pct}% of recent titles mention "${c.title}" — the channel is publishing other people's work.`,
    };
  }

  if (rate >= ARTIST_CHECK.artistRate && (c.videoCount ?? 0) <= ARTIST_CHECK.hardVideoCap) {
    /* High self-reference on a very large catalogue is still odd — a
       long-running label whose name is in every title, for instance. */
    if ((c.videoCount ?? 0) > ARTIST_CHECK.softVideoCap) {
      return {
        verdict: 'AMBIGUOUS', selfReference: rate,
        reason: `${pct}% of titles self-reference, but ${(c.videoCount ?? 0).toLocaleString()} uploads is high for one artist.`,
      };
    }
    return {
      verdict: 'ARTIST', selfReference: rate,
      reason: `${pct}% of recent titles mention "${c.title}".`,
    };
  }

  return {
    verdict: 'AMBIGUOUS', selfReference: rate,
    reason: `${pct}% of recent titles self-reference — between the artist and aggregator thresholds.`,
  };
}
