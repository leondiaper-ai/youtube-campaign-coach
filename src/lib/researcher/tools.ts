/**
 * RESEARCHER — TOOL LAYER
 *
 * The contract between our data and any reasoning model. Every tool returns
 * plain structured JSON that a model can consume without scraping a page.
 *
 * ── PORTABILITY IS THE POINT ──────────────────────────────────────────
 * Nothing in this file knows which model is calling it. The same functions
 * are reachable three ways:
 *   1. in-process, by our own model adapter (model.ts);
 *   2. over HTTP at POST /api/researcher/tools, by any external agent —
 *      Grok Bot with browsing, a Claude/GPT function-calling loop, a curl;
 *   3. later, by an MCP shim that simply forwards to the same registry.
 * That is what makes Grok replaceable. Do not let model-specific logic leak
 * in here — if a tool starts needing to know who is calling it, the
 * abstraction has already broken.
 *
 * ── WHAT DOES NOT BELONG HERE ─────────────────────────────────────────
 * Anything Watcher already computes. Cadence, health states, momentum,
 * conversion bands, opportunity detection and value modelling all exist in
 * src/lib and are imported, never reimplemented. This layer adds the things
 * Watcher genuinely cannot do: catalogue reconstruction, cohort comparison
 * and the persisted research record.
 */

import { ARTISTS, mergeArtistLists, type Artist } from '../artists';
import { listCustomArtists } from '../artistStore';
import { readLiveSnapByHandle } from '../kvCache';
import { readHistory } from '../snapshots';
import {
  fetchCatalogue, followUpStudy, formatProfile, gapStudy, median, reconstruct,
} from './catalogue';
import { readRecon, writeRecon, listFindings, listHypotheses, saveFinding, saveHypothesis } from './store';
import { runGate, type GateInput } from './gate';
import { sizeBandOf, type CatalogueRecon, type Finding, type Hypothesis } from './types';

/* ── Roster helpers ─────────────────────────────────────────────────── */

async function roster(): Promise<Artist[]> {
  return mergeArtistLists(ARTISTS, await listCustomArtists());
}

function bySlug(list: Artist[], slug: string): Artist | undefined {
  return list.find(a => a.slug === slug);
}

/* ── Reconstruction with cache ──────────────────────────────────────── */

async function reconFor(
  baseUrl: string,
  a: Artist,
  opts: { slim?: boolean; force?: boolean } = {},
): Promise<CatalogueRecon> {
  if (!opts.force) {
    const cached = await readRecon(a.slug);
    if (cached) return cached;
  }
  if (!a.channelHandle) throw new Error(`${a.slug} has no channelHandle`);
  const raw = await fetchCatalogue(baseUrl, a.channelHandle, { slim: opts.slim });
  const recon = reconstruct(a.slug, a.name, raw);
  await writeRecon(recon);
  return recon;
}

/**
 * Reconstructions are trimmed before they reach a model. A full recon for a
 * prolific channel is thousands of assets; sending that verbatim wastes the
 * context window on rows the model cannot hold in its head anyway, and
 * invites it to "spot patterns" in noise. The model gets the shape of the
 * catalogue plus the computed studies, and can ask for specific moments.
 */
function summariseRecon(r: CatalogueRecon) {
  return {
    artistSlug: r.artistSlug,
    artistName: r.artistName,
    channelTitle: r.channelTitle,
    subscribers: r.subscribers,
    sizeBand: sizeBandOf(r.subscribers),
    totalUploads: r.totalUploads,
    capped: r.capped,
    coverage: { firstUploadAt: r.firstUploadAt, lastUploadAt: r.lastUploadAt },
    heroCount: r.heroes.length,
    longFormTotal: r.longFormTotal,
    shortsTotal: r.shortsTotal,
    heroBaselineByAge: r.heroBaselineByAge,
    /** Most recent 12 moments — enough to see current architecture. */
    recentMoments: r.moments.slice(-12).map(m => ({
      hero: { title: m.hero.title, publishedAt: m.hero.publishedAt, views: m.hero.views, ageDays: m.hero.ageDays },
      daysToNextHero: m.daysToNextHero,
      longFormInGap: m.longFormInGap.length,
      shortsInGap: m.shortsInGap.length,
      gapFormats: m.longFormInGap.map(a => a.format),
      followUp7to14: m.followUp7to14,
      daysToFirstFollowUp: m.daysToFirstFollowUp,
      heroVsOwnBaseline: m.heroVsOwnBaseline == null ? null : Number(m.heroVsOwnBaseline.toFixed(2)),
      baselineN: m.baselineN,
    })),
    warnings: reconWarnings(r),
  };
}

/**
 * Data-quality warnings travel WITH the data, not in a separate report the
 * model may never read. Each one is a reason to distrust a conclusion drawn
 * from this artist, and they are phrased so they can be copied straight into
 * a finding's caveats.
 */
function reconWarnings(r: CatalogueRecon): string[] {
  const w: string[] = [];
  if (r.capped) w.push('Catalogue fetch hit the API cap — this is NOT the full upload history.');
  if (r.heroes.length < 3) w.push(`Only ${r.heroes.length} official music videos identified; gap and follow-up analysis is unreliable below about 3.`);
  const singleBuckets = Object.entries(r.heroBaselineByAge).filter(([, v]) => v && v.n < 2);
  if (singleBuckets.length) w.push(`Age buckets with a single hero (${singleBuckets.map(([k]) => k).join(', ')}) cannot produce a baseline ratio.`);
  if (r.subscribers == null) w.push('Subscriber count unavailable — size-band cohort assignment defaulted.');
  return w;
}

/* ── Tool registry ──────────────────────────────────────────────────── */

export interface ToolCtx { baseUrl: string }

export type ToolName =
  | 'list_roster'
  | 'get_artist_context'
  | 'get_channel_history'
  | 'reconstruct_catalogue'
  | 'get_release_moments'
  | 'find_similar_artists'
  | 'run_followup_study'
  | 'run_gap_study'
  | 'compare_artists'
  | 'search_research'
  | 'record_finding'
  | 'record_hypothesis';

export const TOOL_SPECS: { name: ToolName; description: string; args: Record<string, string> }[] = [
  { name: 'list_roster', description: 'Every tracked artist with slug, name, handle, type and campaign fields. Start here to see what is available.', args: { managedOnly: 'boolean, optional' } },
  { name: 'get_artist_context', description: 'One artist: roster metadata, latest live channel snapshot, and Watcher-derived state. Does not include catalogue.', args: { slug: 'string' } },
  { name: 'get_channel_history', description: 'Daily channel snapshots (subs, views, uploads30d) up to 180 days. This is the only true time series available. Sparse for recently added artists.', args: { slug: 'string' } },
  { name: 'reconstruct_catalogue', description: 'Reconstructs release architecture from the full public upload history: heroes, gaps, follow-ups, per-age baselines. Cached 12h. Expensive on first call.', args: { slug: 'string', slim: 'boolean, optional — faster/cheaper but weaker format classification' } },
  { name: 'get_release_moments', description: 'Full detail for one artist\'s release moments including every asset in each gap. Use after reconstruct_catalogue when you need specifics.', args: { slug: 'string', limit: 'number, optional' } },
  { name: 'find_similar_artists', description: 'Peer set by subscriber size band and managed/observed type. NOTE: the roster has no genre field, so peers are matched on size and behaviour only.', args: { slug: 'string', limit: 'number, optional' } },
  { name: 'run_followup_study', description: 'Seed question 2. Compares heroes with a 7-14 day long-form follow-up against those without, using each hero vs its own artist age-matched baseline. Returns association plus mandatory caveats.', args: { slugs: 'string[]' } },
  { name: 'run_gap_study', description: 'Seed question 1. Hero-to-hero gap lengths and what was published inside them.', args: { slugs: 'string[]' } },
  { name: 'compare_artists', description: 'Side-by-side format architecture and release cadence for several artists.', args: { slugs: 'string[]' } },
  { name: 'search_research', description: 'Existing findings and hypotheses in the knowledge store. Call before proposing something to avoid restating known material.', args: { query: 'string, optional' } },
  { name: 'record_finding', description: 'Writes a finding to the knowledge store. It is scored by the quality gate and SUPPRESSED if it fails. Supply full evidence.', args: { claim: 'string', whyItMatters: 'string', evidence: 'object', confidence: 'low|medium|high', counterEvidence: 'string|null', nextTest: 'string', potentialAction: 'string|null', status: 'string', selfNonObvious: '0-2', selfDecisionChanging: '0-2' } },
  { name: 'record_hypothesis', description: 'Records a testable hypothesis with an explicit falsifier.', args: { statement: 'string', falsifier: 'string' } },
];

export async function callTool(
  name: ToolName | string,
  args: Record<string, any>,
  ctx: ToolCtx,
): Promise<unknown> {
  const list = await roster();

  switch (name) {
    case 'list_roster': {
      const items = args.managedOnly ? list.filter(a => a.artistType === 'managed') : list;
      return {
        n: items.length,
        note: 'No genre or market field exists on the roster. Do not infer genre from artist names.',
        artists: items.map(a => ({
          slug: a.slug, name: a.name, handle: a.channelHandle ?? null,
          artistType: a.artistType ?? null, phase: a.phase ?? null,
          campaign: a.campaign ?? null, campaignStartDate: a.campaignStartDate ?? null,
        })),
      };
    }

    case 'get_artist_context': {
      const a = bySlug(list, args.slug);
      if (!a) return { error: `unknown artist ${args.slug}` };
      const snap = a.channelHandle ? await readLiveSnapByHandle(a.channelHandle) : null;
      return {
        artist: a,
        live: snap ? {
          subs: snap.subs, views: snap.views, uploads30d: snap.uploads30d,
          shorts30d: snap.shorts30d, lastUploadAt: snap.lastUploadAt, cachedAt: snap.cachedAt,
        } : null,
        sizeBand: sizeBandOf(snap?.subs ?? null),
        note: snap ? null : 'No cached live snapshot — this artist may not have synced yet.',
      };
    }

    case 'get_channel_history': {
      const a = bySlug(list, args.slug);
      if (!a?.channelHandle) return { error: `unknown or handle-less artist ${args.slug}` };
      const snap = await readLiveSnapByHandle(a.channelHandle);
      if (!snap) return { error: 'no cached snapshot, cannot resolve channelId' };
      const hist = await readHistory((snap as any).channelId ?? '');
      return {
        n: hist.length,
        note: hist.length < 14
          ? 'Fewer than 14 days of history — movement claims are not supportable from this series.'
          : 'Daily channel totals only. There is no per-video history anywhere in this system.',
        history: hist,
      };
    }

    case 'reconstruct_catalogue': {
      const a = bySlug(list, args.slug);
      if (!a) return { error: `unknown artist ${args.slug}` };
      const r = await reconFor(ctx.baseUrl, a, { slim: args.slim === true });
      return summariseRecon(r);
    }

    case 'get_release_moments': {
      const a = bySlug(list, args.slug);
      if (!a) return { error: `unknown artist ${args.slug}` };
      const r = await reconFor(ctx.baseUrl, a, {});
      const limit = Math.min(Number(args.limit ?? 20), 60);
      return {
        artistSlug: r.artistSlug,
        warnings: reconWarnings(r),
        moments: r.moments.slice(-limit).map(m => ({
          hero: m.hero,
          daysToNextHero: m.daysToNextHero,
          followUp7to14: m.followUp7to14,
          daysToFirstFollowUp: m.daysToFirstFollowUp,
          heroVsOwnBaseline: m.heroVsOwnBaseline,
          baselineN: m.baselineN,
          longFormInGap: m.longFormInGap.map(x => ({ title: x.title, format: x.format, publishedAt: x.publishedAt, views: x.views, ageDays: x.ageDays })),
          shortsInGap: m.shortsInGap.length,
        })),
      };
    }

    case 'find_similar_artists': {
      const a = bySlug(list, args.slug);
      if (!a?.channelHandle) return { error: `unknown artist ${args.slug}` };
      const self = await readLiveSnapByHandle(a.channelHandle);
      const band = sizeBandOf(self?.subs ?? null);
      const peers: { slug: string; name: string; subs: number | null; band: string }[] = [];
      for (const other of list) {
        if (other.slug === a.slug || !other.channelHandle) continue;
        const s = await readLiveSnapByHandle(other.channelHandle);
        if (!s) continue;
        if (sizeBandOf(s.subs ?? null) === band) {
          peers.push({ slug: other.slug, name: other.name, subs: s.subs ?? null, band });
        }
      }
      return {
        of: a.slug, band, n: peers.length,
        peers: peers.slice(0, Math.min(Number(args.limit ?? 15), 40)),
        caveat: 'Peers are matched on subscriber size band and nothing else. There is no genre, market or career-stage field on the roster, so these are size peers, not creative peers.',
      };
    }

    case 'run_followup_study':
    case 'run_gap_study':
    case 'compare_artists': {
      const slugs: string[] = Array.isArray(args.slugs) ? args.slugs : [];
      if (!slugs.length) return { error: 'slugs[] required' };
      const recons: CatalogueRecon[] = [];
      const failed: { slug: string; error: string }[] = [];
      for (const s of slugs.slice(0, 25)) {
        const a = bySlug(list, s);
        if (!a) { failed.push({ slug: s, error: 'unknown artist' }); continue; }
        try { recons.push(await reconFor(ctx.baseUrl, a, { slim: true })); }
        catch (e) { failed.push({ slug: s, error: String((e as Error).message) }); }
      }
      if (!recons.length) return { error: 'no catalogues could be reconstructed', failed };

      if (name === 'run_followup_study') {
        return { study: followUpStudy(recons), artistsAnalysed: recons.map(r => r.artistSlug), failed,
                 warnings: recons.flatMap(reconWarnings) };
      }
      if (name === 'run_gap_study') {
        return { study: gapStudy(recons), artistsAnalysed: recons.map(r => r.artistSlug), failed,
                 warnings: recons.flatMap(reconWarnings) };
      }
      return {
        artists: recons.map(r => ({
          ...formatProfile(r),
          artistName: r.artistName,
          subscribers: r.subscribers,
          sizeBand: sizeBandOf(r.subscribers),
          heroCount: r.heroes.length,
          medianGapDays: r.moments.filter(m => m.daysToNextHero !== null).length
            ? median(r.moments.filter(m => m.daysToNextHero !== null).map(m => m.daysToNextHero!))
            : null,
          warnings: reconWarnings(r),
        })),
        failed,
      };
    }

    case 'search_research': {
      const q = String(args.query ?? '').toLowerCase();
      const findings = await listFindings();
      const hyps = await listHypotheses();
      const match = (s: string) => !q || s.toLowerCase().includes(q);
      return {
        findings: findings.filter(f => match(f.claim) || match(f.whyItMatters))
          .map(f => ({ id: f.id, claim: f.claim, status: f.status, confidence: f.confidence,
                       sampleSize: f.evidence.sampleSize, humanDecision: f.humanFeedback?.decision ?? null })),
        hypotheses: hyps.filter(h => match(h.statement))
          .map(h => ({ id: h.id, statement: h.statement, status: h.status, origin: h.origin })),
      };
    }

    case 'record_finding': {
      const gateInput: GateInput = {
        claim: String(args.claim ?? ''),
        whyItMatters: String(args.whyItMatters ?? ''),
        evidence: {
          basis: String(args.evidence?.basis ?? ''),
          artists: args.evidence?.artists ?? [],
          sampleSize: Number(args.evidence?.sampleSize ?? 0),
          metrics: args.evidence?.metrics ?? [],
          caveats: args.evidence?.caveats ?? [],
        },
        counterEvidence: args.counterEvidence ?? null,
        nextTest: String(args.nextTest ?? ''),
        potentialAction: args.potentialAction ?? null,
        selfNonObvious: Number(args.selfNonObvious ?? 0),
        selfDecisionChanging: Number(args.selfDecisionChanging ?? 0),
      };
      const gate = runGate(gateInput);
      const now = new Date().toISOString();
      const finding: Finding = {
        id: `fnd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        createdAt: now, updatedAt: now,
        claim: gateInput.claim,
        whyItMatters: gateInput.whyItMatters,
        evidence: gateInput.evidence,
        confidence: (args.confidence ?? 'low'),
        counterEvidence: gateInput.counterEvidence,
        nextTest: gateInput.nextTest,
        potentialAction: gateInput.potentialAction,
        status: (args.status ?? 'observation'),
        questionId: args.questionId,
        gate,
        producedBy: String(args.producedBy ?? 'unknown'),
      };
      /** Suppressed findings are still stored — the record of what the system
       *  got wrong is how the gate gets tuned. They are simply not surfaced. */
      await saveFinding(finding);
      return {
        stored: true, surfaced: gate.passed, id: finding.id,
        gate,
        message: gate.passed
          ? 'Finding passed the quality gate.'
          : `SUPPRESSED. ${gate.reasons.join(' ')} Revise and resubmit, or drop it — do not weaken the claim just to get it through.`,
      };
    }

    case 'record_hypothesis': {
      const now = new Date().toISOString();
      const h: Hypothesis = {
        id: `hyp_${Date.now().toString(36)}`,
        createdAt: now, updatedAt: now,
        statement: String(args.statement ?? ''),
        status: 'hypothesis',
        supportingFindingIds: args.supportingFindingIds ?? [],
        contradictingFindingIds: [],
        falsifier: String(args.falsifier ?? ''),
        origin: 'researcher',
        notes: args.notes,
      };
      if (!h.statement || !h.falsifier) {
        return { error: 'both statement and falsifier are required — a hypothesis with no falsifier is not testable' };
      }
      await saveHypothesis(h);
      return { stored: true, id: h.id };
    }

    default:
      return { error: `unknown tool ${name}`, available: TOOL_SPECS.map(t => t.name) };
  }
}
