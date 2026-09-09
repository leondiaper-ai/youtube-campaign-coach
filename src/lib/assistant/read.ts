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
  "recommendation": "<the single most useful action, or 'No action — nothing material.'>",
  "timing": "<when, only if a recorded date supports it; otherwise ''>",
  "evidence": ["<a dated, checkable statement>", "<another>"],
  "missingContext": "<what you could not see. Never blank>",
  "nextCheck": "<what to look at next, and roughly when>",
  "confidence": "LOW" | "MEDIUM" | "HIGH"
}

Status by what the reader should do:
  ON_TRACK         nothing material; no action, none implied
  WATCH            one specific thing to check, on a specific date
  OPPORTUNITY      something available now that is not being used
  ACTION_REQUIRED  something is wrong, or a window is closing
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

const VALID: CoachStatus[] = ['ON_TRACK', 'WATCH', 'OPPORTUNITY', 'ACTION_REQUIRED'];

export interface ReadResult {
  ok: boolean;
  overview?: CoachOverview;
  evidence?: CampaignEvidence;
  detail?: string;
  tokens: number;
  latencyMs: number;
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
  } catch (e) {
    return {
      ok: false, tokens: 0, latencyMs: Date.now() - t0,
      detail: `Could not reconstruct the catalogue: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  if (!evidence) {
    return {
      ok: false, tokens: 0, latencyMs: Date.now() - t0,
      detail: 'No channel handle or no uploads to analyse.',
    };
  }

  const user = [
    renderCampaignEvidence(evidence),
    '',
    CONTRACT,
  ].join('\n');

  let res;
  try {
    res = await runResearch(SYSTEM, user, { baseUrl } as any, cfg, NO_TOOLS);
  } catch (e) {
    return {
      ok: false, evidence, tokens: 0, latencyMs: Date.now() - t0,
      detail: e instanceof Error ? e.message : String(e),
    };
  }

  const parsed = extractJson(res.text);
  if (!parsed) {
    return {
      ok: false, evidence, tokens: res.usage.totalTokens, latencyMs: Date.now() - t0,
      detail: 'Response contained no parseable object.',
    };
  }

  const status: CoachStatus = VALID.includes(parsed.status) ? parsed.status : 'ON_TRACK';
  const confidence: CoachConfidence =
    parsed.confidence === 'HIGH' ? 'HIGH' : parsed.confidence === 'MEDIUM' ? 'MEDIUM' : 'LOW';

  /* Evidence carries provenance. Anything the model wrote as a claim is
     PUBLIC_YOUTUBE, because that is where the underlying figures came
     from; the interpretation around it is not evidence and is not listed. */
  const evidenceItems: EvidenceItem[] = (Array.isArray(parsed.evidence) ? parsed.evidence : [])
    .slice(0, 6)
    .map((c: unknown) => ({
      sourceType: 'PUBLIC_YOUTUBE' as const,
      claim: String(c),
      sourceRef: `catalogue:${artist.slug}`,
    }));

  const whatChanged = String(parsed.whatChanged ?? '').trim();

  const overview: CoachOverview = {
    artistId: artist.slug,
    artistName: artist.name,
    campaignId: artist.campaign ?? null,
    campaignName: artist.campaign ?? null,
    generatedAt: new Date().toISOString(),
    status,
    headline: String(parsed.headline ?? '').trim(),
    whatHappened: String(parsed.whatHappened ?? '').trim(),
    /* whatChanged is folded into interpretation because CoachOverview has
       no field for it and the MCP contract should not change for this.
       The UI reads it back out of the same place. */
    interpretation: [whatChanged, String(parsed.interpretation ?? '').trim()]
      .filter(Boolean).join(' ')
      .trim(),
    recommendation: String(parsed.recommendation ?? 'No action — nothing material.').trim(),
    timing: String(parsed.timing ?? '').trim(),
    evidenceSummary: whatChanged,
    evidence: evidenceItems,
    confidence,
    missingContext: String(parsed.missingContext ?? '').trim() || 'Not stated.',
    nextCheck: String(parsed.nextCheck ?? '').trim(),
    suggestedActions: [],
    producedBy: `${res.provider}/${res.model} · asset-level`,
    toolsUsed: ['full-catalogue', 'buildProfile', 'horizon'],
    usage: res.usage,
    horizonConfidence: evidence.horizon.confidence,
  };

  await writeOverview(overview);

  return {
    ok: true, overview, evidence,
    tokens: res.usage.totalTokens, latencyMs: Date.now() - t0,
  };
}
