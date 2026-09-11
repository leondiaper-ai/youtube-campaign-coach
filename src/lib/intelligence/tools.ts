/**
 * INTELLIGENCE TOOLS
 *
 * The Deep Dive, resource, human-context, research-library and matching
 * surface, in the same shape as the existing coach and researcher
 * registries so the MCP server picks it up without special-casing.
 *
 * ── THE PERMISSION LINE ───────────────────────────────────────────────
 * Read is broad. Write is five specific research actions and nothing else:
 *
 *   add_research_candidate      a new external example
 *   add_research_observation    more evidence on an existing one
 *   update_research_example     tags, mechanic, proposed scores
 *   add_watchlist_item          park something to look at later
 *   propose_campaign_application connect an example to one of our artists
 *
 * There is no tool here that edits a Deep Dive, writes human context,
 * promotes an example to the board, or mutates a campaign. Those are human
 * acts, and the way to keep them human is for the capability not to exist
 * on this surface rather than for the prompt to ask nicely.
 *
 * ── SCORES ARE PROPOSED, NEVER SET ────────────────────────────────────
 * A model may propose the three research scores and its proposal is stored
 * with `scoredBy` recording that a model produced it. `boardEligible` is
 * computed from whatever scores are present, so an unratified proposal can
 * reach the board — which is a deliberate trade: the alternative is a
 * library that stays unscored forever. `scoredBy` makes it visible, and the
 * world builder reports how many of its shortlist were model-scored.
 */

import { listCaseStudies, saveCaseStudy, searchCaseStudies } from '../knowledge/store';
import type { CaseStudy } from '../knowledge/types';
import { listDeepDives } from './deepDiveStore';
import { deepDiveFor, getArtistNeeds, resolveArtist } from './needs';
import { readHumanContext } from './humanContext';
import { getResourceContext, listResourceContexts } from './resourceContexts';
import { getRelevantResearch } from './match';
import { buildWorld } from './worldBuilder';
import {
  NEED_TAGS, partitionTags, boardEligible, boardBlockers,
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
    name: 'get_world_builder_payload',
    description:
      'Everything needed to build a one-page inspiration world for an artist, in one call: thesis, strongest evidence, strengths, gaps, constraints, known plans, open questions, a 3-6 example shortlist that clears the team-facing bar, and application prompts. Read `warnings` first — it says when the payload is too thin to build from.',
    args: { artist: 'string — roster slug or artist name', maxAgeDays: 'number, optional', limit: 'number, optional' },
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
    name: 'propose_campaign_application',
    description:
      'Proposes that a specific research example applies to one of our artists, with the reasoning. This is a PROPOSAL: it is recorded against the example and surfaced for a human, and it does not change any campaign. Conservative by design — say what would have to be true for it to work, not that it will.',
    args: { id: 'string', artist: 'string', application: 'string', whatWouldHaveToBeTrue: 'string', producedBy: 'string' },
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
  const all = await listCaseStudies();
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
  return {
    id: c.id, subject: c.subject, title: c.title, mechanic: c.mechanic ?? null,
    archetype: c.archetype ?? null, usefulFor: c.usefulFor ?? [],
    status: c.status, confidence: c.confidence,
    behaviourObserved: c.behaviourObserved, sequence: c.sequence,
    whyInteresting: c.whyInteresting, whyNotObvious: c.whyNotObvious,
    possibleLearning: c.possibleLearning, limitations: c.limitations,
    scores: s, scoredBy: c.scoredBy ?? null,
    boardEligible: boardEligible(s), boardBlockers: boardEligible(s) ? [] : boardBlockers(s),
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
      return {
        found: true,
        source,
        rosterMissing: who.rosterMissing,
        evidenceClass: 'HUMAN',
        note: 'This is analysis a person wrote, not measurement. Quote it as our view. Figures inside it were captured on dataCapturedAt and may have moved.',
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

    case 'get_world_builder_payload':
      return buildWorld(String(args.artist ?? ''), {
        maxAgeDays: args.maxAgeDays == null ? null : Number(args.maxAgeDays),
        limit: args.limit == null ? undefined : Number(args.limit),
      });

    /* ── WRITE ───────────────────────────────────────────────────────── */

    case 'add_research_candidate': {
      const required = ['subject', 'mechanic', 'title', 'behaviourObserved', 'whyInteresting', 'whyNotObvious', 'possibleLearning', 'limitations'];
      const missing = required.filter(k => !String(args[k] ?? '').trim());
      if (missing.length) return { error: `missing required fields: ${missing.join(', ')}` };

      const urls: string[] = Array.isArray(args.sourceUrls) ? args.sourceUrls.filter(Boolean) : [];
      if (!urls.length) {
        return { error: 'sourceUrls is required. An external example with no link cannot be checked by anyone, which makes it an assertion rather than research.' };
      }

      const { valid, unknown } = partitionTags(Array.isArray(args.usefulFor) ? args.usefulFor : []);
      if (!valid.length) {
        return {
          error: 'usefulFor must contain at least one recognised need tag, otherwise this example can never be matched to an artist and will sit in the library unreachable.',
          unknownTagsSupplied: unknown,
          validTags: NEED_TAGS,
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
        unknownTagsIgnored: unknown,
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
      if (Array.isArray(args.usefulFor)) {
        const p = partitionTags(args.usefulFor);
        unknown = p.unknown;
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

      const eligible = boardEligible(c.scores ?? null);
      return {
        stored: true, id: c.id, unknownTagsIgnored: unknown,
        scores: c.scores ?? null, scoredBy: c.scoredBy ?? null,
        boardEligible: eligible,
        boardBlockers: eligible ? [] : boardBlockers(c.scores ?? null),
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
      c.lastReviewedAt = now;
      await saveCaseStudy(c);
      return {
        stored: true, id: c.id, artistSlug: who.slug,
        appliedToCampaign: false,
        note: 'Recorded against the research example as INFERRED. No campaign state changed. A human must decide whether this becomes a recommendation.',
      };
    }

    default:
      return { error: `unknown tool ${name}`, available: INTEL_SPECS.map(s => s.name) };
  }
}

export const INTEL_TOOL_NAMES = new Set<string>(INTEL_SPECS.map(s => s.name));
