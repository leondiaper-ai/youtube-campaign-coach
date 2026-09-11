/**
 * WORLD BUILDER PAYLOAD
 *
 * Ingredients for a one-page inspiration world, assembled in one call so
 * whatever builds the page does not have to re-research the artist or
 * re-derive the strategy.
 *
 * ── WHAT THIS DOES AND DOES NOT DECIDE ────────────────────────────────
 * It decides which ingredients are ON THE TABLE: the thesis, the strongest
 * evidence, the gaps, the constraints, and a shortlist of external examples
 * that clear the board bar. It does not decide what the page says. The
 * translation from "Wet Leg built a named session series" to "what if
 * CHVRCHES in churches became a series" is a creative act and belongs to
 * whoever is writing the page.
 *
 * The distinction matters because the alternative — precomputing the
 * creative leap and handing it over as a finished idea — produces pages
 * that copy campaigns. `possibleApplication` below is therefore a prompt
 * about the artist's own situation, not a suggestion of what to make.
 *
 * ── WHY 3-6 ───────────────────────────────────────────────────────────
 * A page with ten references is a mood board; a page with three is an
 * argument. The floor exists because one example reads as a hunch. If
 * fewer than three clear the bar we say so and return what there is rather
 * than padding with library-only examples, which is exactly the failure the
 * two-score rule exists to prevent.
 */

import { getRelevantResearch, getResearchOpportunities } from './match';
import { deepDiveFor, resolveArtist } from './needs';
import { readHumanContext } from './humanContext';
import { getHorizon } from '../coach-bot/horizon';
import { readLiveSnapByHandle } from '../kvCache';
import type { DeepDiveEvidence, MatchExplanation } from './types';

export interface WorldBuilderPayload {
  artist: {
    slug: string;
    name: string;
    /** Live channel figures where a snapshot exists. Nulls stay null. */
    channel: { subscribers: number | null; lifetimeViews: number | null; lastUploadAt: string | null; snapshotAt: string | null } | null;
  };

  artistIntelligence: {
    deepDiveTitle: string | null;
    deepDiveUpdated: string | null;
    deckUrl: string | null;
    thesis: string | null;
    strongestEvidence: DeepDiveEvidence[];
    strengths: string[];
    gaps: string[];
    constraints: string[];
    /** Dated, from the campaign horizon. Separate from deck-stated plans. */
    knownPlans: { source: 'horizon' | 'deep_dive' | 'human_context'; text: string; freshness?: string }[];
    openQuestions: string[];
  };

  researchShortlist: {
    subject: string;
    mechanic: string | null;
    archetype: string | null;
    thumbnailVideoId: string | null;
    /** The three judgements, surfaced so the page can order by them. */
    mechanicScore: number | null;
    culturalScore: number | null;
    visualScore: number | null;
    verification: string;
    evidence: string;
    freshnessDays: number | null;
    whyRelevant: string[];
    sourceUrls: string[];
    limitations: string;
  }[];

  /** A question about this artist, not an instruction. See the header. */
  possibleApplication: string[];

  /**
   * What the page CANNOT say yet. Carried in the payload rather than left
   * for someone to notice, because a page built from five strong references
   * looks complete whether or not the artist's biggest gap is among them.
   */
  openOpportunities: {
    /** Needs with no showable external proof, and what to go and find. */
    unmatchedNeeds: { tag: string; kind: string; need: string; whatToLookFor: string }[];
    /** Leads parked but not assessed. Not for the page; for the next dig. */
    watchlist: { id: string; subject: string; whatToCheck: string }[];
    /** Shortlist entries resting on scores a model proposed, not a person. */
    modelScoredCount: number;
  };

  /** Everything the page must not overstate. Travels with the payload. */
  limitations: string[];
  /** Populated when the payload is thin. Read it before building anything. */
  warnings: string[];
}

export async function buildWorld(
  artistInput: string,
  opts: { maxAgeDays?: number | null; limit?: number } = {},
): Promise<WorldBuilderPayload> {
  const who = await resolveArtist(artistInput);
  const { dive } = await deepDiveFor(who.slug);

  const research = await getRelevantResearch(who.slug, {
    boardOnly: true,
    maxAgeDays: opts.maxAgeDays ?? null,
    limit: opts.limit ?? 6,
  });

  const snap = who.artist?.channelHandle
    ? await readLiveSnapByHandle(who.artist.channelHandle).catch(() => null)
    : null;

  const human = await readHumanContext(who.slug).catch(() => []);
  const horizon = who.artist ? await getHorizon(who.slug).catch(() => null) : null;

  const knownPlans: WorldBuilderPayload['artistIntelligence']['knownPlans'] = [];
  if (horizon?.nextMajorMoment) {
    knownPlans.push({
      source: 'horizon',
      text: `${horizon.nextMajorMoment.title} (${horizon.nextMajorMoment.type}), ${horizon.nextMajorMoment.daysAway} days away.`,
      freshness: horizon.horizonConfidence,
    });
  }
  for (const p of dive?.knownCampaignPlans ?? []) knownPlans.push({ source: 'deep_dive', text: p });
  for (const h of human) {
    if (h.kind === 'RELEASE_PLAN' || h.kind === 'LIKELY_ASSET' || h.kind === 'ALREADY_FILMING' || h.kind === 'TEAM_INTENTION') {
      knownPlans.push({ source: 'human_context', text: `${h.text} (stated by ${h.statedBy}, ${h.statedAt})`, freshness: h.freshness });
    }
  }

  const constraints = [
    ...(dive?.knownConstraints ?? []),
    ...human.filter(h => h.kind === 'CONSTRAINT' || h.kind === 'ARTIST_AVAILABILITY')
      .map(h => `${h.text} (${h.statedBy}, ${h.statedAt}${h.freshness === 'STALE' ? ' — STALE, needs reconfirming' : ''})`),
  ];

  const shortlist = research.matches.map(toShortlistItem);
  const opportunities = await getResearchOpportunities(who.slug).catch(() => null);

  const warnings: string[] = [];
  if (!dive) warnings.push(`No Deep Dive exists for ${who.name}. There is no thesis, no stated gaps and no constraints — do not invent them to fill the page.`);
  if (who.rosterMissing) warnings.push(`${who.name} did not resolve against the live roster, so no channel figures are included.`);
  if (!snap) warnings.push('No cached channel snapshot. Any figure on the page must come from the Deep Dive and be labelled with its capture date.');
  if (shortlist.length < 3) {
    warnings.push(
      `Only ${shortlist.length} external example(s) clear the board bar for this artist. `
      + `The library holds ${research.libraryStats.total} records, ${research.libraryStats.boardEligible} board-eligible overall. `
      + 'Build the page with fewer references rather than promoting a library-only example — the bar exists because a weak proof artist undermines a strong mechanic.',
    );
  }
  if (research.unmatchedNeeds.length) {
    warnings.push(`${research.unmatchedNeeds.length} of this artist's needs have no proof example: ${research.unmatchedNeeds.map(u => u.tag).join(', ')}.`);
  }
  for (const h of human.filter(h => h.freshness === 'STALE')) {
    warnings.push(`STALE human context, last confirmed ${h.statedAt}: "${h.text}". Treat as unconfirmed.`);
  }

  return {
    artist: {
      slug: who.slug,
      name: who.name,
      channel: snap ? {
        subscribers: (snap as any).subs ?? null,
        lifetimeViews: (snap as any).views ?? null,
        lastUploadAt: (snap as any).lastUploadAt ?? null,
        snapshotAt: (snap as any).cachedAt ?? null,
      } : null,
    },
    artistIntelligence: {
      deepDiveTitle: dive?.title ?? null,
      deepDiveUpdated: dive?.deckUpdated ?? null,
      deckUrl: dive?.deckUrl ?? null,
      thesis: dive?.coreThesis ?? null,
      /* The trusted ones only. A page built on an AMBIGUOUS figure will
         present it as confidently as any other, because pages have no
         typography for doubt. */
      strongestEvidence: (dive?.keyEvidence ?? []).filter(e => e.trust === 'TRUSTED').slice(0, 8),
      strengths: (dive?.channelStrengths ?? []).map(p => `${p.point} — ${p.basis}`),
      gaps: (dive?.channelGaps ?? []).map(p => `${p.point} — ${p.basis}`),
      constraints,
      knownPlans,
      openQuestions: dive?.openQuestions ?? [],
    },
    researchShortlist: shortlist,
    openOpportunities: {
      unmatchedNeeds: (opportunities?.gaps ?? []).map(g => ({
        tag: g.tag, kind: g.kind, need: g.need, whatToLookFor: g.whatToLookFor,
      })),
      watchlist: opportunities?.watchlist ?? [],
      modelScoredCount: research.matches.filter(m => /model/i.test(m.scoredBy ?? '')).length,
    },
    possibleApplication: applicationPrompts(who.name, research.matches, dive?.channelGaps?.length ?? 0),
    limitations: [
      ...(dive?.limitations ?? []),
      'Every external example is what another artist did. It is evidence that a mechanic exists and has been executed, not evidence it will work here.',
      'All view figures anywhere in this payload are lifetime totals. They are not velocity and must not be divided by asset age.',
      'Nothing in this payload is a YouTube Studio metric. There is no retention, traffic-source, impression or unique-viewer data available to this system.',
      'A shared need tag means the strategic situation is comparable. It says nothing about audience, market, budget or whether the artists suit each other.',
    ],
    warnings,
  };
}

function toShortlistItem(m: MatchExplanation): WorldBuilderPayload['researchShortlist'][number] {
  return {
    subject: m.subject,
    mechanic: m.mechanic,
    archetype: m.archetype,
    thumbnailVideoId: m.thumbnailVideoId,
    culturalScore: m.scores?.culturalRelevance ?? null,
    visualScore: m.scores?.visualBoardValue ?? null,
    mechanicScore: m.scores?.mechanicValue ?? null,
    verification: m.verification,
    evidence: m.why[0] ?? '',
    freshnessDays: m.freshnessDays,
    whyRelevant: m.why,
    sourceUrls: m.sourceUrls,
    limitations: m.limitations,
  };
}

/**
 * Written as questions rather than proposals, on purpose. "Wet Leg built a
 * named session series, so CHVRCHES should build a named session series" is
 * the copy-the-campaign failure in one sentence. "CHVRCHES have 15 live
 * uploads and no series — what would a returnable series look like using
 * only what already exists?" is the same input pointed at the artist.
 */
function applicationPrompts(name: string, matches: MatchExplanation[], gapCount: number): string[] {
  const out: string[] = [];
  for (const m of matches.slice(0, 6)) {
    for (const tag of m.sharedTags.slice(0, 1)) {
      out.push(
        `${m.subject} proves a mechanic for "${tag}". What is the version of that which could only be ${name}, `
        + 'built from what they already have rather than from what the other artist had?',
      );
    }
  }
  if (!out.length) {
    out.push(
      gapCount
        ? `No external proof example matched. Build the page from ${name}'s own gaps and successes, and say plainly that no comparable external example has been found yet.`
        : `Nothing matched and there is no Deep Dive. There is not enough here to build a page for ${name}.`,
    );
  }
  return out;
}
