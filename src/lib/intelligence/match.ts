/**
 * THE MATCHER
 *
 * Artist needs on one side, external research examples on the other, and
 * a set intersection in between. That is the whole thing, and it is
 * deliberately the whole thing.
 *
 * ── WHY NOT A MODEL ───────────────────────────────────────────────────
 * A model asked "which of these examples is relevant to CHVRCHES?" will
 * always produce an answer and always produce a reason, including for the
 * examples that are not relevant. The reason will be fluent. It will read
 * as analysis. And there is no way to tell from the output which matches
 * were real, because the confidence does not vary with the evidence.
 *
 * A tag intersection is worse at nuance and much better at being wrong
 * visibly: when nothing matches, nothing is returned, and "no external
 * example in the library addresses this need" is a true and useful answer
 * that a model will essentially never give.
 *
 * ── WHY NOT GENRE ─────────────────────────────────────────────────────
 * The failure this shape exists to prevent is "CHVRCHES are a synth band,
 * find synth bands". Genre is not in the vocabulary at all, so it cannot
 * be matched on. What is in the vocabulary is the strategic situation:
 * an under-used live archive, an empty follow-up window, a channel being
 * woken up. Aimyon and CHVRCHES have nothing in common musically and the
 * same problem structurally, which is the entire point.
 *
 * ── CANDIDATES, NOT RECOMMENDATIONS ───────────────────────────────────
 * Nothing here decides anything. It returns examples with the shared tags
 * named and the reasoning shown, so a person — or a model with the rest of
 * the context — can judge. The scores it reports were entered by whoever
 * scored the example; the matcher does not compute quality.
 */

import type { CaseStudy } from '../knowledge/types';
import { getArtistNeeds, type ArtistNeedsDetail } from './needs';
import { readLibrary, boardStatus, verificationOf, needsVerificationOf } from './research';
import {
  partitionTags,
  type MatchExplanation, type NeedTag, type ResearchScores,
} from './types';

function scoresOf(c: CaseStudy): ResearchScores | null {
  return c.scores
    ? {
        mechanicValue: c.scores.mechanicValue,
        culturalRelevance: c.scores.culturalRelevance,
        visualBoardValue: c.scores.visualBoardValue,
      }
    : null;
}

function freshnessDays(c: CaseStudy): number | null {
  const when = c.observedAt ?? c.discoveredAt;
  if (!when) return null;
  const t = new Date(when).getTime();
  return Number.isFinite(t) ? Math.round((Date.now() - t) / 86_400_000) : null;
}

export interface MatchResult {
  artistSlug: string;
  artistName: string;
  needs: ArtistNeedsDetail['needs'];
  deepDiveMissing: boolean;
  derivedCoverage: string[];
  /** Ordered best-first. Empty is a legitimate and common answer. */
  matches: MatchExplanation[];
  /** Needs with no example in the library at all. The research backlog. */
  unmatchedNeeds: { tag: NeedTag; from: string }[];
  /**
   * Parked leads that touch this artist's needs. NOT candidates — nobody
   * has assessed them. Listed so a dig can pick one up, never so a page can.
   */
  watchlistLeads: { id: string; subject: string; sharedTags: NeedTag[]; whatToCheck: string }[];
  libraryStats: { total: number; watchlist: number; tagged: number; scored: number; verified: number; boardEligible: number };
  /** Always populated. The caller must not present matches as conclusions. */
  guidance: string;
}

export interface MatchOptions {
  /** Only examples that clear the board bar. For team-facing output. */
  boardOnly?: boolean;
  /** Drop examples observed longer ago than this. Null = no limit. */
  maxAgeDays?: number | null;
  limit?: number;
  /** Restrict to these needs rather than all of them. */
  onlyTags?: string[];
}

export async function getRelevantResearch(
  artistInput: string,
  opts: MatchOptions = {},
): Promise<MatchResult> {
  const needsDetail = await getArtistNeeds(artistInput);

  let needs = needsDetail.needs;
  if (opts.onlyTags?.length) {
    const { valid } = partitionTags(opts.onlyTags);
    const wanted = new Set(valid);
    needs = needs.filter(n => wanted.has(n.tag));
  }
  const needByTag = new Map<NeedTag, { from: string; basis: string }>();
  for (const n of needs) if (!needByTag.has(n.tag)) needByTag.set(n.tag, { from: n.from, basis: n.basis });

  const library = await readLibrary();

  /* A rejected example stays in the store as a record of a judgement made.
     It must never come back out of the matcher.

     Watchlist items are excluded for a different reason: they are leads
     nobody has assessed, and returning one alongside real candidates
     invites it to be read as one. It is board-blocked either way, but
     "appears in the match list" and "is a proof example" are close enough
     in a list that the distinction gets lost. They come back separately,
     as `watchlistLeads`, which is also how getResearchOpportunities treats
     them — the two were disagreeing, and this is the side that is right. */
  const usable = library.filter(c => c.status !== 'REJECTED' && c.status !== 'WATCHLIST');
  const watchlist = library.filter(c => c.status === 'WATCHLIST');

  const matched: MatchExplanation[] = [];
  const tagsProven = new Set<NeedTag>();

  for (const c of usable) {
    const { valid: exampleTags } = partitionTags(c.usefulFor ?? []);
    const shared = exampleTags.filter(t => needByTag.has(t));
    if (!shared.length) continue;

    for (const t of shared) tagsProven.add(t);

    const age = freshnessDays(c);
    if (opts.maxAgeDays != null && age != null && age > opts.maxAgeDays) continue;

    const s = scoresOf(c);
    /* Board status is a property of the whole record, not of the scores —
       it also asks whether anyone has verified the behaviour and whether
       there is a link to follow. See research.ts. */
    const board = boardStatus(c);
    if (opts.boardOnly && !board.eligible) continue;

    matched.push({
      caseStudyId: c.id,
      subject: c.subject,
      mechanic: c.mechanic ?? null,
      sharedTags: shared,
      why: shared.map(t => {
        const need = needByTag.get(t)!;
        return `${t} — ${needsDetail.artistName}: ${need.from}. ${c.subject}: ${c.behaviourObserved}`;
      }),
      scores: s,
      scoredBy: c.scoredBy ?? null,
      boardEligible: board.eligible,
      boardBlockers: board.blockers,
      freshnessDays: age,
      sourceUrls: c.sourceUrls ?? [],
      limitations: c.limitations,
      verification: verificationOf(c),
      needsVerification: needsVerificationOf(c),
      thumbnailVideoId: c.thumbnailVideoId ?? null,
      archetype: c.archetype ?? null,
    });
  }

  /**
   * Ordering. Shared-tag count first, because an example that addresses
   * three of this artist's needs is more useful than one that addresses one
   * however well it is scored. Then mechanic value, then recency. Cultural
   * and visual scores are NOT in the sort — they gate the board, they do not
   * rank the library, and letting them rank it would quietly turn the
   * library into the board.
   */
  matched.sort((a, b) =>
    b.sharedTags.length - a.sharedTags.length
    || (b.scores?.mechanicValue ?? 0) - (a.scores?.mechanicValue ?? 0)
    || (a.freshnessDays ?? 99_999) - (b.freshnessDays ?? 99_999));

  const unmatchedNeeds = Array.from(needByTag.entries())
    .filter(([t]) => !tagsProven.has(t))
    .map(([tag, v]) => ({ tag, from: v.from }));

  const stats = {
    total: library.length,
    watchlist: watchlist.length,
    tagged: usable.filter(c => (c.usefulFor ?? []).length > 0).length,
    scored: usable.filter(c => c.scores).length,
    verified: usable.filter(c => verificationOf(c) === 'VERIFIED').length,
    boardEligible: usable.filter(c => boardStatus(c).eligible).length,
  };

  return {
    artistSlug: needsDetail.artistSlug,
    artistName: needsDetail.artistName,
    needs,
    deepDiveMissing: needsDetail.deepDiveMissing,
    derivedCoverage: needsDetail.derivedCoverage,
    matches: opts.limit ? matched.slice(0, opts.limit) : matched,
    unmatchedNeeds,
    watchlistLeads: watchlist
      .map(c => {
        const { valid } = partitionTags(c.usefulFor ?? []);
        return {
          id: c.id, subject: c.subject,
          sharedTags: valid.filter(t => needByTag.has(t)),
          whatToCheck: c.possibleLearning,
        };
      })
      .filter(w => w.sharedTags.length > 0),
    libraryStats: stats,
    guidance: buildGuidance(needsDetail, matched.length, stats, unmatchedNeeds.length),
  };
}

function buildGuidance(
  n: ArtistNeedsDetail, matchCount: number,
  stats: MatchResult['libraryStats'], unmatched: number,
): string {
  const parts: string[] = [];
  if (n.deepDiveMissing) {
    parts.push(
      `There is no Deep Dive for ${n.artistName}, so the needs below are derived from Watcher data alone. `
      + 'That is a much thinner basis than an analysed artist and the matches should be treated as suggestions to check, not as a read of the campaign.',
    );
  }
  if (n.rosterMissing) {
    parts.push(`${n.artistName} did not resolve against the live roster, so no channel data was available. Only Deep Dive needs are represented.`);
  }
  if (!stats.total) {
    parts.push('The research library is empty. Nothing can match until external examples are saved into it.');
  } else if (!matchCount) {
    parts.push(
      `No example in the library (${stats.total} records, ${stats.tagged} tagged) addresses any of these needs. `
      + 'That is a real answer: it means the research to do is specific, not that the artist has no needs.',
    );
  }
  if (unmatched) parts.push(`${unmatched} need(s) have no proof example at all — these are the research gaps worth going and filling.`);
  parts.push('These are CANDIDATES. The shared tag says the situation is comparable; it does not say the tactic will transfer. Judgement about whether it suits this artist has not been made here.');
  return parts.join(' ');
}

/* ══ The inverse question ════════════════════════════════════════════ */

/**
 * "What are we still missing for this artist?"
 *
 * The matcher answers what we have. This answers what we do not, and it is
 * the more useful of the two for directing research. A researcher told to
 * "find interesting YouTube behaviour" produces interesting YouTube
 * behaviour; a researcher told "CHVRCHES have an empty 7-14 day window and
 * we hold no external proof of anyone solving one well" produces something
 * that can be used.
 *
 * Three tiers, because "missing" is not one thing:
 *   NO_PROOF       nothing in the library addresses this need at all
 *   UNVERIFIED     something claims to, but nobody has checked it
 *   NOT_SHOWABLE   verified proof exists but cannot go in front of a team
 *
 * The third is the one that would otherwise hide. A need with a strong but
 * unshowable example looks solved in every count and is not, if the output
 * is a page someone has to present.
 */
export type GapKind = 'NO_PROOF' | 'UNVERIFIED' | 'NOT_SHOWABLE';

export interface ResearchGap {
  tag: NeedTag;
  kind: GapKind;
  /** The artist's need, in the Deep Dive's words. */
  need: string;
  basis: string;
  /** What exists today, if anything. */
  existing: { id: string; subject: string; verification: string; blockers: string[] }[];
  /** A concrete instruction, not "research this". */
  whatToLookFor: string;
}

export interface ResearchOpportunities {
  artistSlug: string;
  artistName: string;
  deepDiveMissing: boolean;
  /**
   * Whether the Deep Dive figures behind these needs still hold. A need is
   * NOT retired because a campaign started — implementation beginning is
   * not evidence the need was met — but a researcher should know the
   * situation has moved before going looking.
   */
  deepDiveFreshness: { overall: string; warnings: string[] } | null;
  gaps: ResearchGap[];
  /** Needs that already have verified, showable proof. Nothing to do. */
  covered: { tag: NeedTag; subject: string }[];
  watchlist: { id: string; subject: string; whatToCheck: string }[];
  guidance: string;
}

export async function getResearchOpportunities(artistInput: string): Promise<ResearchOpportunities> {
  const needsDetail = await getArtistNeeds(artistInput);
  const library = (await readLibrary()).filter(c => c.status !== 'REJECTED');

  const byTag = new Map<NeedTag, CaseStudy[]>();
  for (const c of library) {
    if (c.status === 'WATCHLIST') continue;
    const { valid } = partitionTags(c.usefulFor ?? []);
    for (const t of valid) byTag.set(t, [...(byTag.get(t) ?? []), c]);
  }

  const gaps: ResearchGap[] = [];
  const covered: { tag: NeedTag; subject: string }[] = [];
  const seen = new Set<NeedTag>();

  for (const n of needsDetail.needs) {
    if (seen.has(n.tag)) continue;
    seen.add(n.tag);

    const candidates = byTag.get(n.tag) ?? [];
    const showable = candidates.find(c => boardStatus(c).eligible);
    if (showable) { covered.push({ tag: n.tag, subject: showable.subject }); continue; }

    const kind: GapKind = !candidates.length
      ? 'NO_PROOF'
      : candidates.some(c => verificationOf(c) !== 'VERIFIED') ? 'UNVERIFIED' : 'NOT_SHOWABLE';

    gaps.push({
      tag: n.tag,
      kind,
      need: n.from,
      basis: n.basis,
      existing: candidates.map(c => ({
        id: c.id, subject: c.subject, verification: verificationOf(c),
        blockers: boardStatus(c).blockers,
      })),
      whatToLookFor: instructionFor(kind, n.tag, candidates.map(c => c.subject)),
    });
  }

  const watchlist = library
    .filter(c => c.status === 'WATCHLIST')
    .map(c => ({ id: c.id, subject: c.subject, whatToCheck: c.possibleLearning }));

  /* NO_PROOF first: a need with nothing at all is a bigger hole than one
     with an unverified claim against it. */
  const order: Record<GapKind, number> = { NO_PROOF: 0, UNVERIFIED: 1, NOT_SHOWABLE: 2 };
  gaps.sort((a, b) => order[a.kind] - order[b.kind]);

  return {
    artistSlug: needsDetail.artistSlug,
    artistName: needsDetail.artistName,
    deepDiveMissing: needsDetail.deepDiveMissing,
    deepDiveFreshness: needsDetail.deepDiveFreshness
      ? { overall: needsDetail.deepDiveFreshness.overall, warnings: needsDetail.deepDiveFreshness.warnings }
      : null,
    gaps,
    covered,
    watchlist,
    guidance:
      `${gaps.length} of ${seen.size} needs lack showable external proof; ${covered.length} are covered. `
      + 'Work the NO_PROOF list first — those are situations where we have nothing at all. '
      + 'UNVERIFIED items do not need new discovery, they need somebody to go and check a claim we already hold, '
      + 'which is cheaper and often finishes the job.',
  };
}

function instructionFor(kind: GapKind, tag: NeedTag, subjects: string[]): string {
  if (kind === 'UNVERIFIED') {
    return `Do not search for a new example first. Verify ${subjects.join(', ')} against the channel — `
      + 'pull the uploads, confirm the dates and the order, and record source links. If it holds up, this need is closed.';
  }
  if (kind === 'NOT_SHOWABLE') {
    return `Proof exists (${subjects.join(', ')}) but cannot be shown to a team. Look for a second example of the `
      + `same "${tag}" mechanic from an artist with more cultural weight or a stronger visual identity. `
      + 'The mechanic is already established; what is missing is a presentable proof of it.';
  }
  return `Nothing in the library addresses "${tag}". Find an artist who has visibly and recently solved this `
    + 'situation on their own channel, with an upload sequence you can point at. Culturally credible and '
    + 'visually distinctive, or it will only ever be a library entry.';
}
