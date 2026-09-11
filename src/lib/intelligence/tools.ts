/**
 * INTELLIGENCE TOOLS
 *
 * The Deep Dive, resource, human-context, research-library and matching
 * surface, in the same shape as the existing coach and researcher
 * registries so the MCP server picks it up without special-casing.
 *
 * ── THE PERMISSION LINE ───────────────────────────────────────────────
 * Read is broad. Write is seven specific research actions and nothing else:
 *
 *   add_research_candidate       a new external example
 *   add_research_observation     more evidence on an existing one
 *   update_research_example      tags, mechanic, proposed scores
 *   verify_research_example      record the outcome of actually checking it
 *   supersede_research_example   replace a weaker proof of the same mechanic
 *   add_watchlist_item           park something to look at later
 *   propose_campaign_application connect an example to one of our artists
 *   record_research_run          the log of a run, including a run that did nothing
 *
 * There is no tool here that edits a Deep Dive, writes human context,
 * PROMOTES an example to a client-facing page, or mutates a campaign.
 * Promotion lives on /api/research-review behind a separate token the
 * model never holds. Those are human
 * acts, and the way to keep them human is for the capability not to exist
 * on this surface rather than for the prompt to ask nicely.
 *
 * ── SCORES ARE PROPOSED, NEVER SET ────────────────────────────────────
 * A model may propose the three research scores and the proposal is stored
 * with `scoredBy` recording that a model produced it. Scores alone no
 * longer reach the board: `boardStatus` in research.ts also requires that
 * somebody has VERIFIED the behaviour and that a source link exists. So a
 * model can score its own find generously and the worst outcome is a
 * library entry, not a slide. The world builder reports how many of its
 * shortlist rest on model-proposed scores.
 *
 * ── VERIFICATION IS A WRITE, PROMOTION IS NOT ─────────────────────────
 * `verify_research_example` lets a model record what it found when it went
 * and looked, and VERIFIED demands a URL and an evidence item before it
 * will accept the label. That is a claim about work done, which a model can
 * legitimately make. What it still cannot do is decide that something
 * belongs in front of a team — that falls out of the gate, and the gate is
 * code.
 */

import { saveCaseStudy, searchCaseStudies } from '../knowledge/store';
import { ARTISTS, mergeArtistLists } from '../artists';
import { listCustomArtists } from '../artistStore';
import { checkAliases } from './identity';
import {
  readLibrary, boardStatus, verificationOf, needsVerificationOf, seedById, isSeed,
  promotionOf, clientFacing,
  type ResearchVerification,
} from './research';
import type { CaseStudy } from '../knowledge/types';
import { listDeepDives } from './deepDiveStore';
import { deepDiveFor, getArtistNeeds, resolveArtist } from './needs';
import { readHumanContext } from './humanContext';
import { getResourceContext, listResourceContexts } from './resourceContexts';
import { getRelevantResearch, getResearchOpportunities } from './match';
import { buildFreshnessReport } from './freshness';
import { listRecommendations } from './recommendationId';
import { getCampaignProgress } from './campaignProgress';
import { listProgress, setProgress, PROGRESS_STATES, ProvenanceError } from './progressStore';
import { readLiveSnapByHandle } from '../kvCache';
import { buildWorld } from './worldBuilder';
import { buildRollout } from './rollout';
import { listResearchRuns, lastResearchRun, validateRun, saveResearchRun } from './researchRuns';
import { lookupExternalChannel, getExternalChannelUploads, newMeter, QuotaExceeded } from './externalLookup';
import {
  NEED_TAGS, TAG_ALIASES, partitionTags,
  type NeedTag,
} from './types';

export interface IntelCtx { baseUrl: string }

const TAG_HINT = `One of: ${NEED_TAGS.join(', ')}`;

export const INTEL_SPECS = [
  {
    name: 'list_deep_dives',
    description:
      'Every artist with a structured Deep Dive: the strategic analysis a person wrote after studying the channel. Returns slug, title, thesis and the need tags each one carries. START HERE when asked about one of our artists — the Deep Dive is the considered view and the raw metrics are not a substitute for it.',
    args: {},
  },
  {
    name: 'get_deep_dive_context',
    description:
      'The full Deep Dive for one artist: core thesis, channel strengths and gaps, campaign risks, strategic opportunities, recommended content directions and campaign architecture, existing successes, key evidence with its class and trust level, known constraints and plans, platform opportunities, open questions and limitations. This is HUMAN evidence — analysis someone did — and it must not be restated as observed fact. If no Deep Dive exists the response says so explicitly; do not substitute your own analysis for one.',
    args: { artist: 'string — roster slug or artist name' },
  },
  {
    name: 'list_resources',
    description:
      'The market-analysis and methodology library: campaign intelligence, benchmark library, channel behaviour work, methodology and API reference. Returns id, title, type and purpose.',
    args: {},
  },
  {
    name: 'get_resource_context',
    description:
      'The structured analysis inside one resource: purpose, key findings each with the population it rests on, benchmarks with their sample size, strategic principles, caveats, methodology notes and relevant artist examples. Use this instead of generic YouTube advice — this is what we actually measured. Benchmarks without a stated n are not in here by design.',
    args: { resource_id: 'string' },
  },
  {
    name: 'get_human_context',
    description:
      'What people have told us about an artist that no API can show: likely upcoming assets, team intentions, release plans, artist availability, content already filmed, YouTube partner asks, constraints and decisions already made. Every item carries who said it, when, and whether it is CURRENT or STALE. A STALE item is not evidence — it is a reason to go and ask.',
    args: { artist: 'string — roster slug or artist name' },
  },
  {
    name: 'get_artist_needs',
    description:
      'The strategic situations this artist is in, as a set of need tags, each with where it came from (a Deep Dive gap, a stated constraint, or a Watcher signal) and what it rests on. This is the input to matching. Read it before searching externally so you know what you are looking FOR.',
    args: { artist: 'string — roster slug or artist name' },
  },
  {
    name: 'get_relevant_research',
    description:
      'External research examples that address this artist\'s actual needs, matched on strategic situation and NOT on genre. Returns the shared tags, a line per tag explaining both sides, the example scores, whether it clears the team-facing bar, freshness and source links. Also returns unmatchedNeeds — needs with no proof example yet, which is the research worth doing. An empty result is a real answer.',
    args: {
      artist: 'string — roster slug or artist name',
      boardOnly: 'boolean, optional — only examples good enough to show a team',
      maxAgeDays: 'number, optional — drop examples observed longer ago than this',
      limit: 'number, optional',
    },
  },
  {
    name: 'search_research_library',
    description:
      'Free-text search across saved external examples. Call before adding a candidate so the same mechanic is not recorded three times under three artist names.',
    args: { query: 'string' },
  },
  {
    name: 'get_research_opportunities',
    description:
      'THE QUESTION THAT DIRECTS DIGGING. Which of this artist\'s strategic needs have NO showable external proof, split three ways: NO_PROOF (nothing in the library at all), UNVERIFIED (something claims to but nobody has checked it) and NOT_SHOWABLE (verified proof exists but cannot go in front of a team). Each gap comes with a concrete instruction. Work NO_PROOF first; UNVERIFIED usually needs a check rather than a new search, which is cheaper and often closes the need outright.',
    args: { artist: 'string — roster slug or artist name' },
  },
  {
    name: 'get_campaign_progress',
    description:
      'THE LIVING CAMPAIGN RECORD. Every actionable Deep Dive recommendation with its human-confirmed lifecycle state, what the team actually did and when, what Watcher has observed since, whether a result is yet arguable, and any retained learning. The Deep Dive itself is never rewritten — progress is measured against it. Read `freshness` to see which of the deck\'s dated figures have since moved.',
    args: { artist: 'string — roster slug or artist name' },
  },
  {
    name: 'list_recommendation_progress',
    description:
      'The raw progress records for an artist: state, who stated it, when, the note, attached evidence and the full transition history. Use get_campaign_progress instead unless you specifically need the unjoined record.',
    args: { artist: 'string — roster slug or artist name' },
  },
  {
    name: 'check_artist_aliases',
    description:
      'Health check on the deck-slug to roster-slug mapping. Returns each Deep Dive, the roster artist it points at, and whether that artist still exists. Run after any roster change: a broken alias shows up as an artist with a full Deep Dive reporting no needs, which reads exactly like missing data.',
    args: {},
  },
  {
    name: 'get_world_builder_payload',
    description:
      'Everything needed to build a one-page inspiration world for an artist, in one call: thesis, strongest evidence, strengths, gaps, constraints, known plans, open questions, a 3-6 example shortlist that clears the team-facing bar, and application prompts. Read `warnings` first — it says when the payload is too thin to build from.',
    args: { artist: 'string — roster slug or artist name', maxAgeDays: 'number, optional', limit: 'number, optional' },
  },
  {
    name: 'get_rollout',
    description:
      'THE CAMPAIGN\'S CURRENT QUESTION. The rollout for one artist: every plan item with its status (EXPLORING/RECOMMENDED/PLANNED/LIVE/COMPLETE — the last three only from a human record), its need tags, the research question it puts to you, the examples already promoted against it, how many verified examples are awaiting a person\'s review, proposed applications, and lastResearchedAt. `currentQuestion` is the one to research: it belongs to the first item not yet LIVE or COMPLETE and moves by itself when a person records progress. `lastRun` is the previous research run — compare `lastRun.stateSeen` with `stateNow` and stop with a NO_CHANGE run if nothing has moved and the last run is recent. Tag any candidate with the item\'s needTags and it attaches to that item automatically.',
    args: { artist: 'string — roster slug or artist name' },
  },
  {
    name: 'list_research_runs',
    description:
      'Previous research runs for an artist, newest first: what was researched, what was considered and rejected and why, what evidence was added, which gaps remained. Read before digging so a run does not repeat the last one\'s rejections.',
    args: { artist: 'string — roster slug or artist name', limit: 'number, optional — default 10' },
  },
  {
    name: 'lookup_external_channel',
    description:
      'Find a channel OUTSIDE our roster by name, using the YouTube Data API. Returns candidates with subscriber counts, uploadsPlaylistId, and the video that surfaced each one — the top result is often a label, topic or fan channel, so confirm you have the artist channel before treating anything on it as evidence. Costs about 100 YouTube quota units per query, drawn from a shared daily budget — look up channels you intend to verify, not channels you are curious about.',
    args: { query: 'string — artist or channel name' },
  },
  {
    name: 'get_external_channel_uploads',
    description:
      'Recent uploads for an external channel, from the YouTube Data API: publish dates, durations, current lifetime views, and the liveStreamingDetails fields (wasLive, scheduledStart, actualStart) that are the only public evidence a video was a Premiere or a stream. This — not a screenshot of a channel page — is what a VERIFIED claim about a publishing sequence should rest on. Needs the uploadsPlaylistId from lookup_external_channel. About 4 quota units per 100 uploads.',
    args: { uploadsPlaylistId: 'string', limit: 'number, optional — default 100, max 200' },
  },

  /* ── WRITE ─────────────────────────────────────────────────────────── */

  {
    name: 'add_research_candidate',
    description:
      'Saves an external artist example to the research library. Requires observable behaviour, not an impression: what they published, in what order, with source links. `whyNotObvious` and `limitations` are required and must not be padding — an example that cannot say what it fails to prove is not a case study. Saved as CANDIDATE; only a human promotes it further.',
    args: {
      subject: 'string — artist or channel name',
      channelId: 'string, optional',
      country: 'string, optional — ISO-3166 alpha-2, omit if unknown',
      mechanic: 'string — the tactic in a few words',
      archetype: 'string, optional — the reusable shape it belongs to',
      title: 'string',
      behaviourObserved: 'string — what they published, observable and sequenced',
      sequence: 'string[] — the architecture in order',
      evidence: 'object — {items:[{claim, sourceRef, observedAt}]}',
      sourceUrls: 'string[]',
      thumbnailVideoId: 'string, optional',
      observedAt: 'string, optional — when the behaviour happened, yyyy-mm-dd',
      usefulFor: `string[] — need tags this is proof for. ${TAG_HINT}`,
      whyInteresting: 'string',
      whyNotObvious: 'string',
      possibleLearning: 'string',
      limitations: 'string',
      confidence: 'LOW|MEDIUM|HIGH',
      producedBy: 'string',
    },
  },
  {
    name: 'add_research_observation',
    description:
      'Appends a further observation with its source to an existing research example. Use when you find more evidence for something already saved rather than saving a second record.',
    args: { id: 'string', claim: 'string', sourceRef: 'string', observedAt: 'string, optional' },
  },
  {
    name: 'update_research_example',
    description:
      'Updates the tags, mechanic, archetype or proposed scores on an existing example. Scores are 0-3 each: mechanicValue (is the tactic worth knowing), culturalRelevance (would this artist land with a team as credible), visualBoardValue (is there anything to look at). Scoring high on mechanic and low on culture is a normal and useful outcome — it keeps a good idea in the library without putting a weak proof artist on a page.',
    args: {
      id: 'string',
      usefulFor: `string[], optional. ${TAG_HINT}`,
      mechanic: 'string, optional',
      archetype: 'string, optional',
      mechanicValue: 'number, optional — 0-3',
      culturalRelevance: 'number, optional — 0-3',
      visualBoardValue: 'number, optional — 0-3',
      scoredBy: 'string, optional',
    },
  },
  {
    name: 'add_watchlist_item',
    description:
      'Parks a channel or behaviour worth revisiting without claiming it is a case study yet. Use this instead of lowering the bar on add_research_candidate.',
    args: { subject: 'string', channelId: 'string, optional', whyInteresting: 'string', whatToCheck: 'string', sourceUrls: 'string[]', producedBy: 'string' },
  },
  {
    name: 'record_recommendation_progress',
    description:
      'Records that a recommendation has moved state. IMPLEMENTED, RESULT and LEARNED are HUMAN-ONLY and will be refused for any other provenance — Watcher can see that uploads appeared, it cannot see that they appeared because of a recommendation, and intent is not in the public API. To record a relevant upload without claiming implementation, set provenance DERIVED and a state of PLANNED or leave the state unchanged; evidence accumulates either way. statedAt may be a month (yyyy-mm) when the exact day is genuinely unknown — preserve the uncertainty rather than inventing a date.',
    args: {
      artist: 'string',
      recommendationId: 'string — from get_campaign_progress or get_deep_dive_context',
      state: `One of: ${PROGRESS_STATES.join(', ')}`,
      statedBy: 'string — a named person for human-only states',
      statedAt: 'string — yyyy-mm-dd or yyyy-mm',
      note: 'string — what was actually done',
      provenance: 'HUMAN|DERIVED|INFERRED',
      evidenceRefs: 'object[], optional — [{kind, ref, note, attachedBy}]',
      supersedesId: 'string, optional — when a reworded recommendation broke the id link',
    },
  },
  {
    name: 'verify_research_example',
    description:
      'Records the outcome of actually checking an example against the channel. Set verification to VERIFIED only when you have retrieved the uploads and can state the sequence and dates; PARTIAL when some of it is confirmed; DISPUTED when it did not hold up. VERIFIED requires at least one source URL and one evidence item — an unsourced verification is just a stronger assertion. Verifying a seeded example is how it becomes usable; until then it can be matched but never shown.',
    args: {
      id: 'string',
      verification: 'UNVERIFIED|PARTIAL|VERIFIED|DISPUTED',
      behaviourObserved: 'string, optional — what they actually published, sequenced',
      sequence: 'string[], optional — the architecture in order',
      sourceUrls: 'string[], optional',
      observedAt: 'string, optional — when the behaviour happened, yyyy-mm-dd',
      thumbnailVideoId: 'string, optional',
      evidence: 'object, optional — {items:[{claim, sourceRef, observedAt}]}',
      stillOutstanding: 'string[], optional — what remains unchecked',
      verifiedBy: 'string',
    },
  },
  {
    name: 'supersede_research_example',
    description:
      'Replaces a weaker proof of a mechanic with a better one, instead of leaving two cards claiming the same thing. The old example is marked REJECTED with the reason and the id of what replaced it — it stays in the library as a record of a judgement made, and stops appearing in matches. Use this when a stronger or more current example of the SAME mechanic appears; do not use it to delete something you simply disagree with.',
    args: { oldId: 'string', newId: 'string', reason: 'string', decidedBy: 'string' },
  },
  {
    name: 'propose_campaign_application',
    description:
      'Proposes that a specific research example applies to one of our artists, with the reasoning. This is a PROPOSAL: it is recorded against the example and surfaced for a human, and it does not change any campaign. Conservative by design — say what would have to be true for it to work, not that it will.',
    args: { id: 'string', artist: 'string', application: 'string', whatWouldHaveToBeTrue: 'string', producedBy: 'string' },
  },
  {
    name: 'record_research_run',
    description:
      'Records that a research run happened — ALWAYS the last call of a run, including a run that decided to do nothing. outcome NO_CHANGE with a reason (what was compared, why it was not worth digging) is a good and common record. outcome RESEARCHED must list every example considered, including the ones REJECTED and why — the rejections are what stop the next run repeating them. evidenceAdded lists the library ids you saved, verified or scored. remainingGaps says which needs still have no proof. Changes nothing else: no example, no progress, no plan.',
    args: {
      artist: 'string',
      outcome: 'NO_CHANGE|RESEARCHED',
      reason: 'string — for NO_CHANGE what was compared and why nothing was done; for RESEARCHED one line on what was done',
      question: 'string — the current question when this run happened',
      rolloutItemId: 'string, optional — the rollout item id from get_rollout',
      stateSeen: 'object, optional — {campaignState, currentQuestion, spine:[]} as get_rollout returned them',
      considered: 'object[], optional — [{subject, decision: SAVED|VERIFIED|WATCHLISTED|REJECTED|DUPLICATE, why, exampleId, sourceUrl}]',
      evidenceAdded: 'string[], optional — library ids touched',
      remainingGaps: 'string[], optional — need tags or plain gaps still without proof',
      producedBy: 'string',
    },
  },
] as const;

export type IntelToolName = (typeof INTEL_SPECS)[number]['name'];

/* ── Helpers ────────────────────────────────────────────────────────── */

/**
 * `EvidenceItem` carries no observation date of its own — it is
 * {sourceType, claim, sourceRef}. Rather than widen a type the coach
 * service depends on, the date is folded into sourceRef, which is defined
 * as "whatever makes it re-checkable" and for external research is exactly
 * the reference plus when it was true.
 */
function evidenceItem(claim: string, sourceRef: string, observedAt?: string | null, external = true) {
  return {
    sourceType: (external ? 'EXTERNAL' : 'PUBLIC_YOUTUBE') as 'EXTERNAL' | 'PUBLIC_YOUTUBE',
    claim,
    sourceRef: observedAt ? `${sourceRef} (observed ${observedAt})` : sourceRef,
  };
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

async function byId(id: string): Promise<CaseStudy | null> {
  const all = await readLibrary();
  return all.find(c => c.id === id) ?? null;
}

function scoreOf(v: unknown, current: number | undefined): number | undefined {
  if (v == null) return current;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 3) throw new Error(`Scores must be 0-3, got ${v}`);
  return Math.round(n);
}

function publicView(c: CaseStudy) {
  const s = c.scores ?? null;
  const board = boardStatus(c);
  return {
    id: c.id, subject: c.subject, title: c.title, mechanic: c.mechanic ?? null,
    archetype: c.archetype ?? null, usefulFor: c.usefulFor ?? [],
    status: c.status, confidence: c.confidence,
    behaviourObserved: c.behaviourObserved, sequence: c.sequence,
    whyInteresting: c.whyInteresting, whyNotObvious: c.whyNotObvious,
    possibleLearning: c.possibleLearning, limitations: c.limitations,
    scores: s, scoredBy: c.scoredBy ?? null,
    boardEligible: board.eligible, boardBlockers: board.blockers,
    verification: verificationOf(c), needsVerification: needsVerificationOf(c),
    promotion: promotionOf(c), clientFacing: clientFacing(c).eligible,
    proposals: c.proposals ?? [],
    seeded: isSeed(c.id),
    country: c.country ?? null, observedAt: c.observedAt ?? null,
    discoveredAt: c.discoveredAt, sourceUrls: c.sourceUrls ?? [],
    thumbnailVideoId: c.thumbnailVideoId ?? null,
    evidenceCount: c.evidence.length,
  };
}

/* ── Dispatcher ─────────────────────────────────────────────────────── */

export async function callIntelTool(
  name: string, args: Record<string, any>, _ctx: IntelCtx,
): Promise<unknown> {
  switch (name) {
    /* ── READ ────────────────────────────────────────────────────────── */

    case 'list_deep_dives': {
      const dives = await listDeepDives();
      return {
        n: dives.length,
        deepDives: dives,
        note: 'Need tags are the vocabulary the matcher uses. An artist not listed here has no written analysis — that is an absence of analysis, not an absence of needs.',
      };
    }

    case 'get_deep_dive_context': {
      const input = String(args.artist ?? '');
      const who = await resolveArtist(input);
      const { dive, source } = await deepDiveFor(input);
      if (!dive) {
        return {
          artist: input,
          found: false,
          resolvedTo: who.slug,
          available: (await listDeepDives()).map(d => ({ slug: d.artistSlug, name: d.artistName })),
          note: 'No Deep Dive exists for this artist. Do not generate one from metrics and present it as our view — say plainly that no analysis exists and work from Watcher data, labelled as such.',
        };
      }
      const snap = who.artist?.channelHandle
        ? await readLiveSnapByHandle(who.artist.channelHandle).catch(() => null)
        : null;
      return {
        found: true,
        source,
        rosterMissing: who.rosterMissing,
        evidenceClass: 'HUMAN',
        note: 'This is analysis a person wrote, not measurement. Quote it as our view. Figures inside it were captured on dataCapturedAt and may have moved.',
        /* Minted at read time. The deck is never edited to add them. */
        recommendations: listRecommendations(dive),
        /* CURRENT / CHANGED / STALE / UNKNOWN per time-sensitive claim.
           CHANGED means the analysis was true then and the campaign has
           moved — never that the Deep Dive is wrong. */
        freshness: buildFreshnessReport(dive, {
          lastUploadAt: (snap as any)?.lastUploadAt ?? null,
          subs: (snap as any)?.subs ?? null,
          views: (snap as any)?.views ?? null,
          uploads30d: (snap as any)?.uploads30d ?? null,
          checkedAt: (snap as any)?.cachedAt ?? null,
        }),
        deepDive: dive,
      };
    }

    case 'list_resources':
      return { n: listResourceContexts().length, resources: listResourceContexts() };

    case 'get_resource_context': {
      const r = getResourceContext(String(args.resource_id ?? ''));
      if (!r) return { error: `unknown resource ${args.resource_id}`, available: listResourceContexts().map(x => x.resourceId) };
      return {
        resource: r,
        note: 'Every benchmark here states the population it was computed over. A benchmark quoted without its n is being misused.',
      };
    }

    case 'get_human_context': {
      const who = await resolveArtist(String(args.artist ?? ''));
      const items = await readHumanContext(who.slug);
      return {
        artistSlug: who.slug, artistName: who.name, n: items.length,
        items,
        note: items.length
          ? 'HUMAN evidence. STALE items were true once and have not been confirmed since — treat them as a question, not a fact.'
          : 'Nothing has been recorded. That means nobody has told us, NOT that there is no plan. Absence of a plan record is not evidence of no campaign.',
      };
    }

    case 'get_artist_needs':
      return getArtistNeeds(String(args.artist ?? ''));

    case 'get_relevant_research':
      return getRelevantResearch(String(args.artist ?? ''), {
        boardOnly: args.boardOnly === true,
        maxAgeDays: args.maxAgeDays == null ? null : Number(args.maxAgeDays),
        limit: args.limit == null ? undefined : Number(args.limit),
      });

    case 'search_research_library': {
      const hits = await searchCaseStudies(String(args.query ?? ''));
      return { n: hits.length, examples: hits.map(publicView) };
    }

    case 'get_research_opportunities':
      return getResearchOpportunities(String(args.artist ?? ''));

    case 'get_campaign_progress':
      return getCampaignProgress(String(args.artist ?? ''));

    case 'list_recommendation_progress': {
      const who = await resolveArtist(String(args.artist ?? ''));
      const items = await listProgress(who.slug);
      return {
        artistSlug: who.slug, artistName: who.name, n: items.length, items,
        note: items.length
          ? 'IMPLEMENTED, RESULT and LEARNED were asserted by a named human. Uploads attached as evidence support an implementation; they never establish one.'
          : 'No progress has been recorded. That means nobody has told us what was done, NOT that nothing was done.',
      };
    }

    case 'check_artist_aliases': {
      const list = await mergeArtistLists(ARTISTS, await listCustomArtists());
      const checks = checkAliases(list.map(a => ({ slug: a.slug, name: a.name })));
      const broken = checks.filter(c => c.problem);
      return {
        rosterSize: list.length,
        checks,
        broken: broken.length,
        note: broken.length
          ? 'One or more aliases point at a roster slug that no longer exists. Fix DECK_TO_ROSTER in identity.ts.'
          : 'Every Deep Dive maps to exactly one live roster artist.',
      };
    }

    case 'get_world_builder_payload':
      return buildWorld(String(args.artist ?? ''), {
        maxAgeDays: args.maxAgeDays == null ? null : Number(args.maxAgeDays),
        limit: args.limit == null ? undefined : Number(args.limit),
      });

    case 'get_rollout': {
      const who = await resolveArtist(String(args.artist ?? ''));
      const [progress, library, runs] = await Promise.all([
        getCampaignProgress(who.slug),
        readLibrary().catch(() => []),
        listResearchRuns(who.slug, 5),
      ]);
      const rollout = buildRollout(progress, library, runs);
      const live = progress.recommendations.some(
        r => r.statusProvenance === 'HUMAN' && ['IMPLEMENTED', 'OBSERVING', 'RESULT', 'LEARNED'].includes(r.status),
      );
      const stateNow = {
        campaignState: live ? 'CAMPAIGN_LIVE' : 'NOT_CONFIRMED_LIVE',
        currentQuestion: rollout.currentQuestion?.question ?? null,
        spine: rollout.items.filter(i => i.spine).map(i => `${i.title}:${i.spineStatus}`),
      };
      const lastRun = runs[0] ?? null;
      const daysSinceLastRun = lastRun
        ? Math.round((Date.now() - new Date(lastRun.ranAt).getTime()) / 86_400_000) : null;
      const moved = lastRun
        ? JSON.stringify(lastRun.stateSeen) !== JSON.stringify(stateNow) : true;
      return {
        artistSlug: who.slug, artistName: who.name,
        currentQuestion: rollout.currentQuestion,
        stateNow,
        lastRun,
        daysSinceLastRun,
        /* A plain flag the routine can act on without re-deriving it. */
        stateChangedSinceLastRun: moved,
        items: rollout.items.map(it => ({
          id: it.id, ordinal: it.ordinal, title: it.title, status: it.status, commitment: it.commitment,
          origin: it.origin, spine: it.spine, spineStatus: it.spineStatus, needTags: it.needTags,
          recommendationId: it.recommendationId,
          /* The human-authored recommendation. Read-only on this surface. */
          recommendation: it.recommendation,
          campaignEvidence: it.campaignEvidence,
          research: it.grokResearch,
        })),
        limitations: rollout.limitations,
        note: 'Examples listed under research.examples are promoted and client-facing. research.awaitingPromotion counts '
          + 'verified examples a person has not reviewed yet — do not re-research those needs, and do not try to promote '
          + 'them; there is no tool for that here. Tag candidates with an item\'s needTags to attach them to it.',
      };
    }

    case 'list_research_runs': {
      const who = await resolveArtist(String(args.artist ?? ''));
      const runs = await listResearchRuns(who.slug, args.limit == null ? 10 : Number(args.limit));
      return { artistSlug: who.slug, n: runs.length, runs, note: runs.length ? null : 'No research run has been recorded for this artist.' };
    }

    case 'lookup_external_channel': {
      const q = String(args.query ?? '').trim();
      if (!q) return { error: 'query is required' };
      const meter = newMeter();
      try {
        const out = await lookupExternalChannel(q, meter);
        return { ...out, quotaUnits: meter.spent };
      } catch (e) {
        if (e instanceof QuotaExceeded) return { error: `YouTube quota exhausted for today: ${e.message}. Stop looking up channels; record the run and try again tomorrow.` };
        throw e;
      }
    }

    case 'get_external_channel_uploads': {
      const pl = String(args.uploadsPlaylistId ?? '').trim();
      if (!pl) return { error: 'uploadsPlaylistId is required — take it from lookup_external_channel' };
      const meter = newMeter();
      try {
        const out = await getExternalChannelUploads(pl, meter, args.limit == null ? 100 : Number(args.limit));
        return { ...out, quotaUnits: meter.spent };
      } catch (e) {
        if (e instanceof QuotaExceeded) return { error: `YouTube quota exhausted for today: ${e.message}. Record the run and try again tomorrow.` };
        throw e;
      }
    }

    /* ── WRITE ───────────────────────────────────────────────────────── */

    case 'add_research_candidate': {
      const required = ['subject', 'mechanic', 'title', 'behaviourObserved', 'whyInteresting', 'whyNotObvious', 'possibleLearning', 'limitations'];
      const missing = required.filter(k => !String(args[k] ?? '').trim());
      if (missing.length) return { error: `missing required fields: ${missing.join(', ')}` };

      const urls: string[] = Array.isArray(args.sourceUrls) ? args.sourceUrls.filter(Boolean) : [];
      if (!urls.length) {
        return { error: 'sourceUrls is required. An external example with no link cannot be checked by anyone, which makes it an assertion rather than research.' };
      }

      const { valid, unknown, aliased } = partitionTags(Array.isArray(args.usefulFor) ? args.usefulFor : []);
      if (!valid.length) {
        return {
          error: 'usefulFor must contain at least one recognised need tag, otherwise this example can never be matched to an artist and will sit in the library unreachable.',
          unknownTagsSupplied: unknown,
          validTags: NEED_TAGS,
          acceptedAliases: TAG_ALIASES,
        };
      }

      const now = new Date().toISOString();
      const rawEvidence = Array.isArray(args.evidence?.items) ? args.evidence.items : [];
      const c: CaseStudy = {
        id: newId('cs'),
        subject: String(args.subject),
        channelId: args.channelId ?? null,
        missionId: null,
        title: String(args.title),
        behaviourObserved: String(args.behaviourObserved),
        sequence: Array.isArray(args.sequence) ? args.sequence.map(String) : [],
        evidence: rawEvidence.map((e: any) =>
          evidenceItem(String(e.claim ?? ''), String(e.sourceRef ?? ''), e.observedAt)),
        whyInteresting: String(args.whyInteresting),
        whyNotObvious: String(args.whyNotObvious),
        possibleLearning: String(args.possibleLearning),
        limitations: String(args.limitations),
        status: 'CANDIDATE',
        confidence: (args.confidence ?? 'LOW'),
        discoveredAt: now,
        lastReviewedAt: now,
        mechanic: String(args.mechanic),
        archetype: args.archetype ?? null,
        usefulFor: valid as NeedTag[],
        country: args.country ?? null,
        observedAt: args.observedAt ?? null,
        sourceUrls: urls,
        thumbnailVideoId: args.thumbnailVideoId ?? null,
        scores: null,
        scoredBy: null,
      };
      await saveCaseStudy(c);
      return {
        stored: true, id: c.id, status: c.status,
        unknownTagsIgnored: unknown, tagsAliased: aliased,
        note: 'Saved as CANDIDATE and unscored, so it will not reach a team-facing page. Call update_research_example to propose scores.',
      };
    }

    case 'add_research_observation': {
      const c = await byId(String(args.id ?? ''));
      if (!c) return { error: `unknown research example ${args.id}` };
      if (!String(args.claim ?? '').trim() || !String(args.sourceRef ?? '').trim()) {
        return { error: 'both claim and sourceRef are required — an observation with no source is an opinion' };
      }
      c.evidence = [...c.evidence,
        evidenceItem(String(args.claim), String(args.sourceRef), args.observedAt)];
      c.lastReviewedAt = new Date().toISOString();
      await saveCaseStudy(c);
      return { stored: true, id: c.id, evidenceCount: c.evidence.length };
    }

    case 'update_research_example': {
      const c = await byId(String(args.id ?? ''));
      if (!c) return { error: `unknown research example ${args.id}` };

      let unknown: string[] = [];
      let aliased: { from: string; to: NeedTag }[] = [];
      if (Array.isArray(args.usefulFor)) {
        const p = partitionTags(args.usefulFor);
        unknown = p.unknown; aliased = p.aliased;
        if (p.valid.length) c.usefulFor = p.valid as NeedTag[];
      }
      if (args.mechanic != null) c.mechanic = String(args.mechanic);
      if (args.archetype != null) c.archetype = String(args.archetype);

      const touchesScores = ['mechanicValue', 'culturalRelevance', 'visualBoardValue'].some(k => args[k] != null);
      if (touchesScores) {
        const cur = c.scores ?? { mechanicValue: 0, culturalRelevance: 0, visualBoardValue: 0 };
        c.scores = {
          mechanicValue: scoreOf(args.mechanicValue, cur.mechanicValue)!,
          culturalRelevance: scoreOf(args.culturalRelevance, cur.culturalRelevance)!,
          visualBoardValue: scoreOf(args.visualBoardValue, cur.visualBoardValue)!,
        };
        c.scoredBy = String(args.scoredBy ?? 'model (proposed, not ratified)');
      }
      c.lastReviewedAt = new Date().toISOString();
      await saveCaseStudy(c);

      const board = boardStatus(c);
      return {
        stored: true, id: c.id, unknownTagsIgnored: unknown, tagsAliased: aliased,
        scores: c.scores ?? null, scoredBy: c.scoredBy ?? null,
        verification: verificationOf(c),
        boardEligible: board.eligible,
        boardBlockers: board.blockers,
        note: 'Scores you supply are recorded as PROPOSED. A low cultural or visual score with a high mechanic score is a correct outcome, not a failure — it keeps the idea and leaves the proof artist off the page.',
      };
    }

    case 'add_watchlist_item': {
      if (!String(args.subject ?? '').trim() || !String(args.whatToCheck ?? '').trim()) {
        return { error: 'subject and whatToCheck are required — a watchlist item with nothing to check is a bookmark' };
      }
      const now = new Date().toISOString();
      const c: CaseStudy = {
        id: newId('wl'),
        subject: String(args.subject),
        channelId: args.channelId ?? null,
        missionId: null,
        title: `Watchlist: ${args.subject}`,
        behaviourObserved: 'Not yet observed in detail — parked for a later look.',
        sequence: [],
        evidence: [],
        whyInteresting: String(args.whyInteresting ?? ''),
        whyNotObvious: 'Not assessed. This is a watchlist item, not a case study.',
        possibleLearning: String(args.whatToCheck),
        limitations: 'Nothing here has been verified. This record exists to remember a lead, and must not be cited as evidence of anything.',
        status: 'WATCHLIST',
        confidence: 'LOW',
        discoveredAt: now,
        lastReviewedAt: now,
        sourceUrls: Array.isArray(args.sourceUrls) ? args.sourceUrls : [],
        usefulFor: [],
        scores: null,
        scoredBy: null,
      };
      await saveCaseStudy(c);
      return { stored: true, id: c.id, status: 'WATCHLIST' };
    }

    case 'record_recommendation_progress': {
      const who = await resolveArtist(String(args.artist ?? ''));
      try {
        const rec = await setProgress({
          artistSlug: who.slug,
          recommendationId: String(args.recommendationId ?? ''),
          state: args.state,
          statedBy: String(args.statedBy ?? ''),
          statedAt: String(args.statedAt ?? ''),
          note: String(args.note ?? ''),
          provenance: args.provenance,
          evidenceRefs: Array.isArray(args.evidenceRefs) ? args.evidenceRefs : [],
          supersedesId: args.supersedesId ?? null,
        });
        return { stored: true, recommendationId: rec.recommendationId, state: rec.state, statedBy: rec.statedBy };
      } catch (e) {
        if (e instanceof ProvenanceError) return { error: e.message, refused: true };
        throw e;
      }
    }

    case 'verify_research_example': {
      const c = await byId(String(args.id ?? ''));
      if (!c) return { error: `unknown research example ${args.id}` };
      const v = String(args.verification ?? '') as ResearchVerification;
      if (!['UNVERIFIED', 'PARTIAL', 'VERIFIED', 'DISPUTED'].includes(v)) {
        return { error: 'verification must be one of UNVERIFIED, PARTIAL, VERIFIED, DISPUTED' };
      }
      if (!String(args.verifiedBy ?? '').trim()) {
        return { error: 'verifiedBy is required — an unattributed verification cannot be questioned later' };
      }

      const urls = Array.isArray(args.sourceUrls) ? args.sourceUrls.filter(Boolean) : (c.sourceUrls ?? []);
      const newEvidence = (Array.isArray(args.evidence?.items) ? args.evidence.items : [])
        .map((e: any) => evidenceItem(String(e.claim ?? ''), String(e.sourceRef ?? ''), e.observedAt));

      if (v === 'VERIFIED' && (!urls.length || !(c.evidence.length + newEvidence.length))) {
        return {
          error: 'VERIFIED requires at least one source URL and at least one evidence item. Without both this is '
            + 'an assertion with a stronger label on it, which is worse than an honest UNVERIFIED.',
        };
      }

      const rec = c as CaseStudy & Record<string, unknown>;
      rec.verification = v;
      rec.verifiedBy = String(args.verifiedBy);
      rec.verifiedAt = new Date().toISOString();
      rec.needsVerification = Array.isArray(args.stillOutstanding) ? args.stillOutstanding : [];
      if (args.behaviourObserved) c.behaviourObserved = String(args.behaviourObserved);
      if (Array.isArray(args.sequence)) c.sequence = args.sequence.map(String);
      if (urls.length) c.sourceUrls = urls;
      if (args.observedAt) c.observedAt = String(args.observedAt);
      if (args.thumbnailVideoId) c.thumbnailVideoId = String(args.thumbnailVideoId);
      if (newEvidence.length) c.evidence = [...c.evidence, ...newEvidence];
      if (v === 'DISPUTED') c.status = 'REJECTED';
      else if (v === 'VERIFIED' && c.status === 'CANDIDATE') c.status = 'STRONG_EXAMPLE';
      c.lastReviewedAt = new Date().toISOString();

      await saveCaseStudy(c);
      const board = boardStatus(c);
      const wasSeed = isSeed(c.id);
      return {
        stored: true, id: c.id, verification: v, status: c.status,
        boardEligible: board.eligible, boardBlockers: board.blockers,
        clientFacing: false,
        promotion: 'AWAITING — a person reviews verified, scored examples before they appear on any client-facing page. There is no tool here to promote it.',
        replacedSeed: wasSeed,
        note: wasSeed
          ? 'This overwrites the seeded record. The hard-coded version is no longer used for this id.'
          : null,
      };
    }

    case 'supersede_research_example': {
      const oldOne = await byId(String(args.oldId ?? ''));
      const newOne = await byId(String(args.newId ?? ''));
      if (!oldOne) return { error: `unknown example ${args.oldId}` };
      if (!newOne) return { error: `unknown replacement ${args.newId}` };
      if (oldOne.id === newOne.id) return { error: 'an example cannot supersede itself' };
      if (!String(args.reason ?? '').trim()) {
        return { error: 'reason is required — the reasoning is the part worth keeping' };
      }

      /* The old record is not deleted. A library that forgets what it
         rejected repeats the rejection, and the reason is often the most
         useful sentence in the file. */
      oldOne.status = 'REJECTED';
      oldOne.limitations =
        `SUPERSEDED by ${newOne.id} (${newOne.subject}) on ${new Date().toISOString().slice(0, 10)}: `
        + `${String(args.reason)} — decided by ${String(args.decidedBy ?? 'unknown')}. `
        + `Original limitations: ${oldOne.limitations}`;
      oldOne.lastReviewedAt = new Date().toISOString();
      await saveCaseStudy(oldOne);

      return {
        stored: true, supersededId: oldOne.id, replacementId: newOne.id,
        note: 'The superseded example is kept as REJECTED and will not appear in matches. Nothing was deleted.',
      };
    }

    case 'propose_campaign_application': {
      const c = await byId(String(args.id ?? ''));
      if (!c) return { error: `unknown research example ${args.id}` };
      if (!String(args.whatWouldHaveToBeTrue ?? '').trim()) {
        return { error: 'whatWouldHaveToBeTrue is required. A proposal that names no condition is a prediction, and this system does not make those.' };
      }
      const who = await resolveArtist(String(args.artist ?? ''));
      const now = new Date().toISOString();
      /* Recorded on the example rather than on the campaign. A proposal is
         not campaign state and must not appear as one until a human moves
         it there. */
      c.evidence = [...c.evidence, {
        sourceType: 'COACH_INFERENCE' as const,
        claim: `PROPOSED APPLICATION to ${who.name}: ${String(args.application ?? '')} — conditional on: ${String(args.whatWouldHaveToBeTrue)}`,
        sourceRef: `proposal:${String(args.producedBy ?? 'unknown')}`,
      }];
      /* Structured as well, so the rollout can show it beside the human
         recommendation without parsing prose back out of an evidence line. */
      c.proposals = [...(c.proposals ?? []), {
        artistSlug: who.slug,
        application: String(args.application ?? ''),
        whatWouldHaveToBeTrue: String(args.whatWouldHaveToBeTrue),
        proposedBy: String(args.producedBy ?? 'unknown'),
        at: now,
      }];
      c.lastReviewedAt = now;
      await saveCaseStudy(c);
      return {
        stored: true, id: c.id, artistSlug: who.slug,
        appliedToCampaign: false,
        note: 'Recorded against the research example as INFERRED. No campaign state changed. A human must decide whether this becomes a recommendation.',
      };
    }

    case 'record_research_run': {
      const who = await resolveArtist(String(args.artist ?? ''));
      const v = validateRun({
        artistSlug: who.slug,
        outcome: args.outcome, reason: args.reason, question: args.question,
        rolloutItemId: args.rolloutItemId, stateSeen: args.stateSeen, considered: args.considered,
        evidenceAdded: args.evidenceAdded, remainingGaps: args.remainingGaps, producedBy: args.producedBy,
      });
      if (!v.ok) return { error: v.error };
      const { stored } = await saveResearchRun(v.run);
      return {
        stored, id: v.run.id, ranAt: v.run.ranAt, outcome: v.run.outcome,
        note: stored ? 'Run recorded. Nothing else changed.' : 'No store configured — run not persisted.',
      };
    }

    default:
      return { error: `unknown tool ${name}`, available: INTEL_SPECS.map(s => s.name) };
  }
}

export const INTEL_TOOL_NAMES = new Set<string>(INTEL_SPECS.map(s => s.name));

/**
 * Every tool that mutates anything. The HTTP surface refuses these over GET
 * and the boundary suite checks the list against the dispatcher, so a write
 * tool cannot be added without being named here.
 */
export const INTEL_WRITE_TOOLS = new Set<string>([
  'add_research_candidate', 'add_research_observation', 'update_research_example',
  'add_watchlist_item', 'record_recommendation_progress', 'verify_research_example',
  'supersede_research_example', 'propose_campaign_application', 'record_research_run',
]);
