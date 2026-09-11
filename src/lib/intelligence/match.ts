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

import { listCaseStudies } from '../knowledge/store';
import type { CaseStudy } from '../knowledge/types';
import { getArtistNeeds, type ArtistNeedsDetail } from './needs';
import {
  boardEligible, boardBlockers, partitionTags,
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
  libraryStats: { total: number; tagged: number; scored: number; boardEligible: number };
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

  const library = await listCaseStudies().catch(() => [] as CaseStudy[]);

  /* A rejected example stays in the store as a record of a judgement made.
     It must never come back out of the matcher. */
  const usable = library.filter(c => c.status !== 'REJECTED');

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
    const eligible = boardEligible(s);
    if (opts.boardOnly && !eligible) continue;

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
      boardEligible: eligible,
      boardBlockers: eligible ? [] : boardBlockers(s),
      freshnessDays: age,
      sourceUrls: c.sourceUrls ?? [],
      limitations: c.limitations,
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

  const scored = usable.filter(c => c.scores).length;
  const stats = {
    total: library.length,
    tagged: usable.filter(c => (c.usefulFor ?? []).length > 0).length,
    scored,
    boardEligible: usable.filter(c => boardEligible(scoresOf(c))).length,
  };

  return {
    artistSlug: needsDetail.artistSlug,
    artistName: needsDetail.artistName,
    needs,
    deepDiveMissing: needsDetail.deepDiveMissing,
    derivedCoverage: needsDetail.derivedCoverage,
    matches: opts.limit ? matched.slice(0, opts.limit) : matched,
    unmatchedNeeds,
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
