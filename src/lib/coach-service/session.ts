/**
 * COACH SESSION MEMORY
 *
 * Makes a run of questions feel like one conversation rather than a queue of
 * strangers each doing the work again.
 *
 * ── WHY NOT JUST REPLAY THE TRANSCRIPT ────────────────────────────────
 * The obvious implementation — keep every message and resend it — is the one
 * that gets expensive fastest. A tool-calling turn already resends the whole
 * exchange to the model, so an unbounded transcript multiplies against
 * itself: measured runs were ~16k tokens with no history at all. Six turns of
 * naive replay would be several times that, and most of it would be tool JSON
 * the model has already digested.
 *
 * So the session keeps two things instead:
 *
 *   1. The last few turns VERBATIM, because immediate pronoun resolution
 *      ("why does THAT matter") needs the actual words.
 *   2. A structured DIGEST of what has been established — entities, findings,
 *      hypotheses, open questions — which stays small as the conversation
 *      grows and is what makes turn 12 still know about turn 2.
 *
 * The digest is the interesting part. It is not a summary of the chat; it is
 * a list of things now taken as known, each carrying its evidence class, so a
 * later turn cannot quietly promote an earlier hypothesis into a fact.
 */

import { Redis } from '@upstash/redis';
import type { EvidenceItem } from './types';

async function kv(): Promise<Redis | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/* ── Shape ──────────────────────────────────────────────────────────── */

export interface SessionTurn {
  role: 'user' | 'coach';
  text: string;
  at: string;
  /** Tools this turn actually called. Used to report reuse savings. */
  tools?: string[];
}

/**
 * Something the conversation now treats as established.
 *
 * `kind` is load-bearing. A HYPOTHESIS carried forward must still read as a
 * hypothesis three turns later — the failure mode this whole system is built
 * to avoid is a guess hardening into a fact through repetition.
 */
export interface EstablishedItem {
  kind: 'FINDING' | 'INTERPRETATION' | 'HYPOTHESIS' | 'OPEN_QUESTION';
  text: string;
  /** Tool name or asset that supports it, where there is one. */
  sourceRef?: string | null;
  /** Which turn first established it, for debugging drift. */
  turn: number;
}

export interface CoachSession {
  sessionId: string;
  artistId: string;
  campaignId: string | null;
  startedAt: string;
  updatedAt: string;
  turns: SessionTurn[];
  /** Names the conversation has been about: videos, campaigns, formats. */
  entitiesDiscussed: string[];
  established: EstablishedItem[];
  /** Evidence surfaced anywhere in the session, deduplicated. */
  evidenceRefs: EvidenceItem[];
  /** Cached tool results — see TOOL_FRESHNESS below. */
  toolCache: Record<string, { at: string; result: unknown }>;
}

/* ── Bounds ─────────────────────────────────────────────────────────── */

/**
 * Four hours. Long enough for a working session with interruptions, short
 * enough that yesterday's cached catalogue never silently answers today's
 * question.
 */
const TTL_SECONDS = 4 * 60 * 60;

/** Turns kept word-for-word. Beyond this, only the digest survives. */
const VERBATIM_TURNS = 6;
/** Hard caps so a long session cannot grow the prompt without limit. */
const MAX_ESTABLISHED = 24;
const MAX_ENTITIES = 20;
const MAX_EVIDENCE = 20;
const MAX_TURNS_STORED = 40;
/** Verbatim turns are truncated — a 4,000-character answer replayed six times
    would defeat the point of bounding anything. */
const TURN_CHARS = 900;

const key = (id: string) => `coach:session:${id}`;

export function newSessionId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ── Tool freshness ─────────────────────────────────────────────────── */

/**
 * WHICH TOOL RESULTS MAY BE REUSED WITHIN A SESSION.
 *
 * The split is not about cost, it is about truth. A catalogue reconstruction
 * describes what was published and when; those dates are immutable and a
 * re-fetch five minutes later returns the same thing. Channel state, the
 * horizon and recent performance are all "as at now" — reusing them would let
 * the Coach answer a live question with a stale number, which is exactly the
 * failure the horizon work existed to prevent.
 *
 * When in doubt a tool is NOT reusable. The default is correctness.
 */
const REUSABLE_TOOLS = new Set([
  'reconstruct_catalogue',
  'get_release_moments',
  'run_gap_study',
  'run_followup_study',
  'compare_artists',
  'find_similar_artists',
  'get_artist_context',
  'get_channel_history',
  'search_research',
]);

export function isReusable(tool: string): boolean {
  return REUSABLE_TOOLS.has(tool);
}

export function cacheKey(tool: string, args: Record<string, unknown>): string {
  /* Sorted keys so {slug,limit} and {limit,slug} hit the same entry. */
  const stable = Object.keys(args ?? {}).sort()
    .map(k => `${k}=${JSON.stringify((args as any)[k])}`).join('&');
  return `${tool}|${stable}`;
}

/* ── Store ──────────────────────────────────────────────────────────── */

export async function loadSession(sessionId: string): Promise<CoachSession | null> {
  const store = await kv();
  if (!store) return null;
  return (await store.get<CoachSession>(key(sessionId))) ?? null;
}

export async function saveSession(s: CoachSession): Promise<void> {
  const store = await kv();
  if (!store) return;
  s.updatedAt = new Date().toISOString();
  s.turns = s.turns.slice(-MAX_TURNS_STORED);
  s.established = dedupeEstablished(s.established).slice(-MAX_ESTABLISHED);
  s.entitiesDiscussed = Array.from(new Set(s.entitiesDiscussed)).slice(-MAX_ENTITIES);
  s.evidenceRefs = dedupeEvidence(s.evidenceRefs).slice(-MAX_EVIDENCE);
  await store.set(key(s.sessionId), s, { ex: TTL_SECONDS });
}

export function emptySession(sessionId: string, artistId: string, campaignId: string | null): CoachSession {
  const now = new Date().toISOString();
  return {
    sessionId, artistId, campaignId,
    startedAt: now, updatedAt: now,
    turns: [], entitiesDiscussed: [], established: [], evidenceRefs: [], toolCache: {},
  };
}

/**
 * Later duplicates win, so a turn that upgrades a HYPOTHESIS to a FINDING
 * replaces it rather than leaving both in the digest — which would otherwise
 * read as the Coach contradicting itself.
 */
function dedupeEstablished(items: EstablishedItem[]): EstablishedItem[] {
  const seen = new Map<string, EstablishedItem>();
  for (const i of items) {
    if (!i.text?.trim()) continue;
    seen.set(i.text.trim().toLowerCase().slice(0, 120), i);
  }
  return Array.from(seen.values());
}

function dedupeEvidence(items: EvidenceItem[]): EvidenceItem[] {
  const seen = new Map<string, EvidenceItem>();
  for (const i of items) {
    if (!i.claim?.trim()) continue;
    seen.set(i.claim.trim().toLowerCase().slice(0, 120), i);
  }
  return Array.from(seen.values());
}

/* ── The context block ──────────────────────────────────────────────── */

/**
 * Rendered into the prompt ahead of the new question. Reads as a briefing to
 * a colleague who was in the room, which is the effect we want: it should be
 * obvious to the model that re-deriving all of this would be wasted work.
 */
export function buildSessionContext(s: CoachSession): string {
  if (!s.turns.length) return '';

  const lines: string[] = [
    '═══ THIS CONVERSATION SO FAR ═══',
    '',
    'You are continuing an existing conversation about this artist. Do NOT',
    'restate what is already established below, and do NOT re-derive it with',
    'tools unless the new question genuinely needs fresher or different data.',
    'Answer the follow-up as a continuation — the user can see the answers above.',
    '',
  ];

  if (s.entitiesDiscussed.length) {
    lines.push(`ALREADY DISCUSSED: ${s.entitiesDiscussed.join(' · ')}`, '');
  }

  const byKind = (k: EstablishedItem['kind']) => s.established.filter(e => e.kind === k);

  const findings = [...byKind('FINDING'), ...byKind('INTERPRETATION')];
  if (findings.length) {
    lines.push('ESTABLISHED IN THIS SESSION:');
    for (const f of findings) {
      lines.push(`· [${f.kind}] ${f.text}${f.sourceRef ? ` (${f.sourceRef})` : ''}`);
    }
    lines.push('');
  }

  const hyps = byKind('HYPOTHESIS');
  if (hyps.length) {
    lines.push('HYPOTHESES RAISED — still untested, do not treat as fact:');
    for (const h of hyps) lines.push(`· ${h.text}`);
    lines.push('');
  }

  const open = byKind('OPEN_QUESTION');
  if (open.length) {
    lines.push('OPEN QUESTIONS:');
    for (const q of open) lines.push(`· ${q.text}`);
    lines.push('');
  }

  const recent = s.turns.slice(-VERBATIM_TURNS);
  if (recent.length) {
    lines.push('MOST RECENT EXCHANGE:');
    for (const t of recent) {
      const who = t.role === 'user' ? 'USER' : 'COACH';
      lines.push(`${who}: ${t.text.slice(0, TURN_CHARS)}${t.text.length > TURN_CHARS ? '…' : ''}`);
    }
    lines.push('');
  }

  const cached = Object.keys(s.toolCache);
  if (cached.length) {
    lines.push(
      'EVIDENCE ALREADY GATHERED THIS SESSION (reused automatically if you call',
      'the same tool again — historical/architectural data only; live channel',
      'state, horizon and recent performance are always re-fetched):',
      cached.map(c => `· ${c.split('|')[0]}`).filter((v, i, a) => a.indexOf(v) === i).join('\n'),
      '',
    );
  }

  return lines.join('\n');
}
