/**
 * CAMPAIGN MEMORY — HTTP SURFACE
 *
 * Read what a campaign has established, and record the one thing the model is
 * not allowed to write: a human decision. Keeping DECISION off the model's
 * tool surface and behind an explicit endpoint is what preserves the
 * difference between "the Coach suggested" and "we agreed".
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  listMemory, recordDecision, recordMemory, MEMORY_KINDS, type MemoryKind,
} from '@/lib/coach-service/memory';

export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};
const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: CORS });

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) return json({ error: 'slug is required' }, 400);
  const items = await listMemory(slug);
  return json({ slug, n: items.length, items });
}

/** Record a human-authored item, including the DECISION and OUTCOME kinds. */
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'BAD_JSON' }, 400); }
  const { slug, kind, text, sourceRef, relatesTo, campaignId } = body ?? {};
  if (!slug || !text) return json({ error: 'slug and text are required' }, 400);
  const k = String(kind ?? 'CONTEXT').toUpperCase() as MemoryKind;
  if (!MEMORY_KINDS.includes(k)) return json({ error: `unknown kind ${kind}` }, 400);
  const item = await recordMemory({
    artistId: slug, campaignId: campaignId ?? null, kind: k, text: String(text),
    sourceRef: sourceRef ?? null, relatesTo: relatesTo ?? null, createdBy: 'human',
  });
  return json(item);
}

/** Accept / modify / reject something the Coach proposed. */
export async function PATCH(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'BAD_JSON' }, 400); }
  const { slug, memoryId, decision, note } = body ?? {};
  if (!slug || !memoryId || !decision) {
    return json({ error: 'slug, memoryId and decision are required' }, 400);
  }
  const d = String(decision).toUpperCase();
  if (!['ACCEPTED', 'MODIFIED', 'REJECTED'].includes(d)) {
    return json({ error: 'decision must be ACCEPTED, MODIFIED or REJECTED' }, 400);
  }
  const item = await recordDecision({ artistId: slug, memoryId, decision: d as any, note });
  if (!item) return json({ error: 'memory item not found' }, 404);
  return json(item);
}
