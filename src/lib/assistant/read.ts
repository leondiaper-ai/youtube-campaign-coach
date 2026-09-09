/**
 * THE CAMPAIGN READ
 *
 * Generates a `CoachOverview` — the same shape the UI, the share formats
 * and the MCP surface already consume — but from asset-level evidence
 * rather than campaign state alone.
 *
 * ── THE STATUS MODEL ─────────────────────────────────────────────────
 * All six existing reads returned ON_TRACK, which is either the truth or a
 * ladder that cannot discriminate. Looking at the five available states:
 *
 *   ON_TRACK         used for everything, including "nothing to say"
 *   WATCH            something to keep an eye on
 *   OPPORTUNITY      something available that isn't being taken
 *   ACTION_REQUIRED  do something
 *   RISK             ...also do something
 *
 * RISK and ACTION_REQUIRED are the same instruction with different
 * emotional temperature, and a reader treats them identically. And
 * ON_TRACK is doing two jobs at once — "this campaign is going well" and
 * "I have nothing useful to say" — which are very different messages to
 * receive on a Monday morning.
 *
 * So the read uses four states and the prompt defines them by what the
 * reader should DO:
 *
 *   ON_TRACK         nothing material; no action, and none implied
 *   WATCH            a specific thing to check on a specific date
 *   OPPORTUNITY      something available now that is not being used
 *   ACTION_REQUIRED  something is wrong or closing
 *
 * RISK is not used. The `CoachStatus` type keeps it, because the MCP
 * contract and existing stored reads depend on the type, but nothing new
 * emits it. That is the smallest useful model: four states, each with a
 * distinct instruction.
 */

import { runResearch, resolveProvider, type ToolRegistry } from '../researcher/model';
import type { CoachOverview, CoachStatus, CoachConfidence, EvidenceItem } from '../coach-service/types';
import { writeOverview } from '../coach-service/store';
import {
  observed, derived, gate, capConfidence, assertAllClassified,
  type EvidenceRecord,
} from '../knowledge/evidence';
import { saveCampaignRead, toOverview, type CampaignRead, type ReadStatus } from './readStore';
import { correctionsFor } from '../knowledge/inbox';
import { buildCampaignEvidence, renderCampaignEvidence, type CampaignEvidence } from './campaignProfile';
import type { Artist } from '../artists';

/* No tools. The evidence is computed; the model reads it. */
const NO_TOOLS: ToolRegistry = { specs: [], call: async () => ({}) };

const SYSTEM = `
You are a YouTube campaign strategist at a major music company, writing a
short read on one of your own artists for the person who runs the campaign.

You are given a reconstructed asset history: every upload with its date,
format and lifetime view count, grouped into release windows around each
hero, plus a comparison with the artist's previous release and whatever
forward plan is recorded.

Hold to these:

1. Describe what was PUBLISHED, with dates. "A live session went up 9 days
   after the video" is a read. "The campaign is progressing well" is not.
2. The most valuable observation available to you is usually a difference
   between this release and their last one — a format that supported the
   previous hero and is missing from this one, a gap that has widened, an
   architecture that has changed. Look there first.
3. Never compare the view count of a recent asset against an older one.
   The older one has had longer to accumulate. Compare architecture,
   dates and sequence, which are unaffected by age.
4. Claim nothing about retention, traffic sources, impressions, CTR,
   browse/suggested, unique viewers, subscriber attribution, or whether
   Shorts drove long-form viewing. That data does not exist here.
5. If no forward plan is recorded, say that timing advice is not possible
   rather than inventing a release date.
6. Banned phrases, because they say nothing: "steady state", "progressing
   well", "on track", "continue monitoring", "maintain momentum". If the
   honest answer is that nothing needs doing, say that plainly and use
   status ON_TRACK.

Having nothing material to report is a legitimate and common outcome.
`.trim();

const CONTRACT = `
Reply with a JSON object and nothing else. No prose around it, no fence.

{
  "status": "ON_TRACK" | "WATCH" | "OPPORTUNITY" | "ACTION_REQUIRED",
  "headline": "<one sentence naming the specific thing, with a date or figure>",
  "whatHappened": "<what was actually published and when — two or three sentences>",
  "whatChanged": "<what differs from this artist's previous release behaviour, or 'Nothing material differs from their previous release.'>",
  "interpretation": "<why that matters — one or two sentences>",
  "recommendation": "<the single most useful action; only 'No action — nothing material.' when status is ON_TRACK>",
  "timing": "<when, only if a recorded date supports it; otherwise ''>",
  "watchFor": "<for WATCH: the specific thing to check and roughly when; otherwise ''>",
  "evidence": ["<a dated, checkable statement>", "<another>"],
  "missingContext": "<what you could not see. Never blank>",
  "nextCheck": "<what to look at next, and roughly when>",
  "confidence": "LOW" | "MEDIUM" | "HIGH"
}

Status by what the reader should do. These are not moods — each one is a
commitment about the other fields, and they must agree:

  ON_TRACK         nothing material. recommendation MUST be
                   "No action — nothing material." and watchFor MUST be "".
  WATCH            you found something but it is not yet actionable.
                   watchFor MUST name the specific thing and roughly when.
                   recommendation MUST describe what to watch, NOT say
                   "no action" — you have just told me there is something.
  OPPORTUNITY      something is available now and is not being used.
                   recommendation MUST be the thing to do.
  ACTION_REQUIRED  something is wrong or a window is closing.
                   recommendation MUST be the thing to do, and timing MUST
                   say by when.

If you found something real, do not then say no action is needed. If nothing
needs doing, use ON_TRACK. Reporting a finding and disclaiming it in the same
breath is the one output that is worse than saying nothing.
`.trim();

function extractJson(text: string): any | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; } } }
  }
  return null;
}

const VALID: ReadStatus[] = ['ON_TRACK', 'WATCH', 'OPPORTUNITY', 'ACTION_REQUIRED'];

const PROMPT_VERSION = 'campaign-read/v2-asset-level';

/**
 * Enforces the status contract after the fact.
 *
 * The first live run produced K-Trap as WATCH with recommendation "No
 * action — nothing material", which is a finding and a disclaimer of that
 * finding in one breath. Instructing the model not to do it is necessary
 * and not sufficient; this makes the two fields agree whatever it returns.
 */
function reconcile(
  status: ReadStatus, recommendation: string, watchFor: string, whatChanged: string,
): { status: ReadStatus; recommendation: string; watchFor: string; note: string | null } {
  const noAction = !recommendation || /^no action/i.test(recommendation.trim());

  if (status === 'ON_TRACK') {
    /* ON_TRACK with a real recommendation is the same contradiction the
       other way round: it found something and filed it as fine. */
    return noAction
      ? { status, recommendation: 'No action — nothing material.', watchFor: '', note: null }
      : { status: 'WATCH', recommendation, watchFor: watchFor || recommendation,
          note: 'Raised from ON_TRACK: a recommendation was given.' };
  }

  if (status === 'WATCH' && noAction) {
    /* It found something. Use what it found rather than the disclaimer. */
    const w = watchFor || whatChanged;
    return w
      ? { status, recommendation: `Watch: ${w}`, watchFor: w, note: 'Recommendation replaced: WATCH cannot carry "no action".' }
      : { status: 'ON_TRACK', recommendation: 'No action — nothing material.', watchFor: '',
          note: 'Lowered to ON_TRACK: WATCH was claimed with nothing to watch.' };
  }

  if ((status === 'OPPORTUNITY' || status === 'ACTION_REQUIRED') && noAction) {
    return { status: 'WATCH', recommendation: `Watch: ${whatChanged || 'see evidence'}`,
      watchFor: watchFor || whatChanged,
      note: `Lowered from ${status}: no action was given.` };
  }

  return { status, recommendation, watchFor, note: null };
}

export interface ReadResult {
  ok: boolean;
  record?: CampaignRead;
  overview?: CoachOverview;
  evidence?: CampaignEvidence;
  detail?: string;
  tokens: number;
  latencyMs: number;
}

/**
 * Turns the computed evidence into classified records BEFORE the model sees
 * it, so that what comes back can be checked against what went in.
 *
 * The split matters: upload dates and view counts are OBSERVED, everything
 * the format classifier and release-window logic produced is DERIVED, and
 * the model's reading of them will be INFERRED. Three different kinds of
 * claim that a flat evidence list would blur into one.
 */
function classifyEvidence(e: CampaignEvidence): {
  observedEvidence: EvidenceRecord[];
  derivedEvidence: EvidenceRecord[];
  sourceReferences: string[];
} {
  const p = e.profile;
  const asOf = p.windowEnd || null;
  const obs: EvidenceRecord[] = [];
  const der: EvidenceRecord[] = [];
  const refs: string[] = [`channel:${e.slug}`, 'full-catalogue'];

  obs.push(observed(
    `${p.uploadsAnalysed} uploads read, ${p.windowStart.slice(0, 10)} to ${p.windowEnd.slice(0, 10)}`,
    `full-catalogue:${e.slug}`, asOf,
  ));
  obs.push(observed(
    `${p.uploadsLast90d} uploads in the last 90 days`, `full-catalogue:${e.slug}`, asOf,
  ));

  for (const h of p.heroes.slice(0, 3)) {
    obs.push(observed(
      `"${h.title}" published ${h.publishedAt.slice(0, 10)}, ${h.views.toLocaleString()} lifetime views`,
      `video:${h.id}`, h.publishedAt,
    ));
    refs.push(`video:${h.id}`);
  }

  /* Format and hero classification are heuristics over titles and
     durations. On a thin catalogue they are guesses with a confident
     shape, so the sample size decides the trust level rather than being
     left for the reader to infer. */
  const thin = p.uploadsAnalysed < 20;
  der.push(derived(
    `Format mix: ${Object.entries(p.formatCounts).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(', ')}`,
    'formatClassifier',
    thin ? 'PARTIAL' : 'TRUSTED',
    thin ? `Classified from ${p.uploadsAnalysed} uploads — a small sample for a format profile.` : undefined,
  ));

  if (!p.heroes.length) {
    der.push(derived(
      'No upload classifies as a hero release',
      'formatClassifier',
      'AMBIGUOUS',
      'Hero detection is a title heuristic. Absence may mean no hero, or a hero whose title does not read as one.',
    ));
  }

  for (const w of (p.releaseWindows ?? []).slice(0, 2)) {
    der.push(derived(
      `Around "${w.heroTitle}" (${w.heroDate.slice(0, 10)}): ${w.supportFormats.join(', ') || 'no non-Shorts support'}, ` +
      `${w.supportCount} non-Shorts and ${w.shortsInWindow} Shorts within −7/+21 days`,
      'buildProfile:releaseWindows',
    ));
  }

  const c = e.comparison;
  if (c.summary) {
    der.push(derived(`Against their previous release: ${c.summary}`, 'compareToPrevious'));
  }
  if (c.medianHeroGapDays != null) {
    der.push(derived(
      `Median gap between this artist's heroes: ${c.medianHeroGapDays.toFixed(0)} days`,
      'compareToPrevious',
      p.heroes.length < 3 ? 'PARTIAL' : 'TRUSTED',
      p.heroes.length < 3 ? `Based on ${p.heroes.length} hero${p.heroes.length === 1 ? '' : 'es'} — too few for a stable median.` : undefined,
    ));
  }

  /* A plan is HUMAN evidence. Its absence is not evidence of anything and
     is recorded as a limitation, not as a finding. */
  if (e.horizon.known && e.horizon.next) {
    obs.push({
      claim: e.horizon.next.date
        ? `Next recorded moment: ${e.horizon.next.title} on ${e.horizon.next.date} (${e.horizon.next.status})`
        : `Next recorded moment: ${e.horizon.next.title} — undated (${e.horizon.next.status})`,
      evidenceClass: 'HUMAN',
      trust: e.horizon.confidence === 'HIGH' ? 'TRUSTED' : 'PARTIAL',
      sourceRef: `planStore:${e.slug}`,
      observedAt: null,
      limitation: e.horizon.confidence === 'HIGH' ? undefined
        : `Plan confidence is ${e.horizon.confidence}${e.horizon.reason ? ` — ${e.horizon.reason}` : ''}.`,
    });
    refs.push(`planStore:${e.slug}`);
  }

  if (e.campaignStartDate) {
    obs.push({
      claim: `Campaign start recorded as ${e.campaignStartDate} (day ${e.campaignDay})`,
      evidenceClass: 'HUMAN', trust: 'TRUSTED',
      sourceRef: `artist:${e.slug}.campaignStartDate`, observedAt: null,
    });
  }

  assertAllClassified([...obs, ...der]);
  return { observedEvidence: obs, derivedEvidence: der, sourceReferences: refs };
}

function limitationsFor(e: CampaignEvidence, caveats: string[]): string[] {
  const out = [...caveats];
  if (!e.horizon.known) {
    out.push(
      `No reliable forward plan recorded (${e.horizon.confidence}). The plan is unknown — ` +
      `this is not evidence that no campaign is running.`,
    );
  }
  if (!e.campaignStartDate) {
    out.push('No campaign start date recorded, so campaign-window analysis was not possible.');
  }
  out.push(
    'All view figures are lifetime totals read once. They are not velocity, and older assets ' +
    'have had longer to accumulate.',
  );
  out.push(
    'Upload dates are upload dates. Where a song was released earlier than its upload, that is not visible here.',
  );
  return out;
}

export async function prepareCampaignRead(
  artist: Artist, baseUrl: string,
): Promise<ReadResult> {
  const t0 = Date.now();

  const cfg = resolveProvider();
  if (!cfg) return { ok: false, detail: 'No model provider configured.', tokens: 0, latencyMs: 0 };

  let evidence: CampaignEvidence | null;
  try {
    evidence = await buildCampaignEvidence(artist, baseUrl);
  } catch (err) {
    return {
      ok: false, tokens: 0, latencyMs: Date.now() - t0,
      detail: `Could not reconstruct the catalogue: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (!evidence) {
    return {
      ok: false, tokens: 0, latencyMs: Date.now() - t0,
      detail: 'No channel handle or no uploads to analyse.',
    };
  }

  const { observedEvidence, derivedEvidence, sourceReferences } = classifyEvidence(evidence);
  const g = gate([...observedEvidence, ...derivedEvidence]);

  /* Anything a human has explicitly marked wrong about this artist. This
     is the mechanism that stops the system rediscovering a known mistake
     every time it runs. */
  const corrections = await correctionsFor(artist.slug);

  const user = [
    renderCampaignEvidence(evidence),
    corrections.length
      ? `\nCORRECTIONS PREVIOUSLY RECORDED BY A HUMAN — these override anything above:\n` +
        corrections.slice(0, 6).map(c => `  - ${c.correction ?? c.note}`).join('\n')
      : '',
    g.caveats.length
      ? `\nEVIDENCE LIMITATIONS you must respect and may quote:\n${g.caveats.map(c => `  - ${c}`).join('\n')}`
      : '',
    '',
    CONTRACT,
  ].filter(Boolean).join('\n');

  let res;
  try {
    res = await runResearch(SYSTEM, user, { baseUrl } as any, cfg, NO_TOOLS);
  } catch (err) {
    return {
      ok: false, evidence, tokens: 0, latencyMs: Date.now() - t0,
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  const parsed = extractJson(res.text);
  if (!parsed) {
    return {
      ok: false, evidence, tokens: res.usage.totalTokens, latencyMs: Date.now() - t0,
      detail: 'Response contained no parseable object.',
    };
  }

  const rawStatus: ReadStatus = VALID.includes(parsed.status) ? parsed.status : 'ON_TRACK';
  const whatChanged = String(parsed.whatChanged ?? '').trim();

  const rec = reconcile(
    rawStatus,
    String(parsed.recommendation ?? '').trim(),
    String(parsed.watchFor ?? parsed.nextCheck ?? '').trim(),
    whatChanged,
  );

  const statedConfidence: CoachConfidence =
    parsed.confidence === 'HIGH' ? 'HIGH' : parsed.confidence === 'MEDIUM' ? 'MEDIUM' : 'LOW';
  const capped = capConfidence(statedConfidence, g);

  const limitations = limitationsFor(evidence, g.caveats);
  if (rec.note) limitations.push(`Status reconciled — ${rec.note}`);

  const record: CampaignRead = {
    id: `read_${artist.slug}_${Date.now().toString(36)}`,
    artistId: artist.slug,
    artistName: artist.name,
    campaignName: artist.campaign ?? null,
    generatedAt: new Date().toISOString(),
    evidenceAsOf: evidence.profile.windowEnd || new Date().toISOString(),
    observedEvidence,
    derivedEvidence,
    read: String(parsed.headline ?? '').trim(),
    whatChanged: whatChanged || 'Nothing material differs from their previous release.',
    status: rec.status,
    nextAction: /^no action/i.test(rec.recommendation) ? null : rec.recommendation,
    watchFor: rec.watchFor || null,
    sourceReferences,
    limitations,
    confidence: capped.confidence,
    confidenceCappedBecause: capped.capped ? (capped.reason ?? null) : null,
    model: `${res.provider}/${res.model}`,
    promptVersion: PROMPT_VERSION,
    humanReviewStatus: 'UNREVIEWED',
    humanNote: null,
    reviewedAt: null,
  };

  await saveCampaignRead(record);

  /* Mirror into the old store so the MCP endpoint and anything still
     reading CoachOverview keeps working. */
  const overview = toOverview(record);
  overview.whatHappened = String(parsed.whatHappened ?? '').trim() || overview.whatHappened;
  await writeOverview(overview);

  return {
    ok: true, record, overview, evidence,
    tokens: res.usage.totalTokens, latencyMs: Date.now() - t0,
  };
}
