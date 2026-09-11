/**
 * RESEARCH REVIEW — the human gate, as an endpoint
 *
 * Grok can find, verify and score an example. It cannot put one in front of
 * a client. This is the only place a promotion is written, and it is
 * deliberately NOT a tool: it is not in the intel registry, not on the MCP
 * server, and it is gated by REVIEW_TOKEN — a different secret from
 * MCP_TOKEN, so the credential the model holds cannot reach it.
 *
 *   GET  ?artist=chvrches   the queue: verified, scored, unpromoted examples
 *                           plus what has already been promoted or rejected
 *   POST {id, decision, by, note}   PROMOTE or REJECT one example
 *
 * Both need the token. The queue includes unpublished judgements about
 * other artists, and the whole point of the page is that it is not public.
 * Fails closed when REVIEW_TOKEN is unset.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readLibrary, boardStatus, promotionOf, awaitingPromotion, verificationOf } from '@/lib/intelligence/research';
import { saveCaseStudy } from '@/lib/knowledge/store';
import { resolveArtist } from '@/lib/intelligence/needs';
import { ROLLOUT_PLANS } from '@/lib/intelligence/rollout';
import { canonicaliseTag } from '@/lib/intelligence/types';

export const dynamic = 'force-dynamic';

function authorised(req: NextRequest): boolean {
  const expected = process.env.REVIEW_TOKEN;
  if (!expected) return false;
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  return !!bearer && bearer === expected;
}

const DENY = () => NextResponse.json(
  { error: process.env.REVIEW_TOKEN
    ? 'Unauthorised. Send Authorization: Bearer <REVIEW_TOKEN>.'
    : 'REVIEW_TOKEN is not configured, so review is disabled.' },
  { status: 401 },
);

/** Which rollout items an example would attach to, by tag. */
function attachesTo(slug: string, tags: string[]): string[] {
  const plan = ROLLOUT_PLANS[slug] ?? [];
  const have = new Set(tags.map(t => canonicaliseTag(t)).filter(Boolean));
  return plan.filter(p => p.needTags.some(t => have.has(t))).map(p => p.title);
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) return DENY();
  const input = req.nextUrl.searchParams.get('artist') ?? 'chvrches';
  const who = await resolveArtist(input);
  const all = await readLibrary();

  const view = (c: (typeof all)[number]) => ({
    id: c.id, subject: c.subject, title: c.title, mechanic: c.mechanic ?? null,
    behaviourObserved: c.behaviourObserved, sequence: c.sequence,
    whyInteresting: c.whyInteresting, whyNotObvious: c.whyNotObvious,
    possibleLearning: c.possibleLearning, limitations: c.limitations,
    usefulFor: c.usefulFor ?? [], attachesTo: attachesTo(who.slug, c.usefulFor ?? []),
    scores: c.scores ?? null, scoredBy: c.scoredBy ?? null,
    verification: verificationOf(c),
    verifiedBy: (c as any).verifiedBy ?? null, verifiedAt: (c as any).verifiedAt ?? null,
    sourceUrls: c.sourceUrls ?? [], observedAt: c.observedAt ?? null,
    thumbnailVideoId: c.thumbnailVideoId ?? null,
    evidence: c.evidence, proposals: (c.proposals ?? []).filter(p => p.artistSlug === who.slug),
    promotion: c.promotion ?? null,
    boardBlockers: boardStatus(c).blockers,
  });

  const relevant = all.filter(c => attachesTo(who.slug, c.usefulFor ?? []).length > 0 || (c.proposals ?? []).some(p => p.artistSlug === who.slug));
  return NextResponse.json({
    artistSlug: who.slug, artistName: who.name,
    queue: relevant.filter(awaitingPromotion).map(view),
    promoted: relevant.filter(c => promotionOf(c) === 'PROMOTED').map(view),
    rejected: relevant.filter(c => promotionOf(c) === 'REJECTED').map(view),
    /* Not yet reviewable: matched by tag but still short of the board gate.
       Listed so "empty queue" cannot be mistaken for "no research". */
    notYetEligible: relevant.filter(c => !boardStatus(c).eligible && promotionOf(c) === 'AWAITING')
      .map(c => ({ id: c.id, subject: c.subject, blockers: boardStatus(c).blockers })),
  });
}

export async function POST(req: NextRequest) {
  if (!authorised(req)) return DENY();
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }

  const id = String(body?.id ?? '');
  const decision = String(body?.decision ?? '').toUpperCase();
  const by = String(body?.by ?? '').trim();
  const note = body?.note ? String(body.note) : null;

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (decision !== 'PROMOTED' && decision !== 'REJECTED' && decision !== 'CLEAR') {
    return NextResponse.json({ error: 'decision must be PROMOTED, REJECTED or CLEAR' }, { status: 400 });
  }
  if (!by) return NextResponse.json({ error: 'by is required — a promotion is a named person\'s decision' }, { status: 400 });

  const all = await readLibrary();
  const c = all.find(x => x.id === id);
  if (!c) return NextResponse.json({ error: `unknown example ${id}` }, { status: 404 });

  if (decision === 'PROMOTED' && !boardStatus(c).eligible) {
    /* The gate is not a formality a person can wave through: promoting an
       unverified example would put an unchecked claim on a client page
       with a person's name on it. */
    return NextResponse.json({
      error: 'This example has not cleared the board gate, so it cannot be promoted.',
      blockers: boardStatus(c).blockers,
    }, { status: 409 });
  }

  c.promotion = decision === 'CLEAR' ? null : { status: decision, by, at: new Date().toISOString(), note };
  c.lastReviewedAt = new Date().toISOString();
  await saveCaseStudy(c);
  return NextResponse.json({ stored: true, id: c.id, promotion: c.promotion });
}
