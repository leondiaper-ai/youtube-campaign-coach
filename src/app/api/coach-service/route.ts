/**
 * COACH SERVICE — HTTP SURFACE
 *
 * The one entry point every frontend uses. React pages, static decks in
 * /public, and anything added later all hit this route; none of them holds a
 * model key, and no end user needs a Grok account. The xAI credential lives
 * only in the deployment environment and is never sent to a browser.
 *
 * CORS is open because the decks in /public are served from this same origin
 * today but are routinely opened from file:// and from other hosts during
 * review. The route is read-mostly and returns no credentials; the sensitive
 * write paths remain on the authenticated MCP endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  askCoach, getAttentionBoard, getCoachOverview, runCoachInvestigation,
} from '@/lib/coach-service/service';
import { INVESTIGATION_TYPES, type InvestigationType } from '@/lib/coach-service/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: CORS });

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * GET is the attention board and the single-artist overview — the two reads a
 * surface performs on load. Neither triggers a model run unless refresh=1 is
 * passed explicitly, so opening Watcher costs nothing.
 */
export async function GET(req: NextRequest) {
  const baseUrl = new URL(req.url).origin;
  const slug = req.nextUrl.searchParams.get('slug');
  const refresh = req.nextUrl.searchParams.get('refresh') === '1';

  if (!slug) return json(await getAttentionBoard({ baseUrl }));

  const r = await getCoachOverview(slug, { baseUrl }, { refresh });
  if (!r.ok) return json({ error: r.reason, detail: r.detail }, r.reason === 'NOT_CONFIGURED' ? 503 : 400);
  return json(r.data);
}

export async function POST(req: NextRequest) {
  const baseUrl = new URL(req.url).origin;
  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'BAD_JSON' }, 400); }

  const { artistId, campaignId, question, investigationType } = body ?? {};
  if (!artistId) return json({ error: 'artistId is required' }, 400);

  /* An unrecognised investigationType falls back to CUSTOM rather than
     erroring: the label is model-generated and may drift, but the user's
     click should still produce an answer. */
  const type: InvestigationType = INVESTIGATION_TYPES.includes(investigationType)
    ? investigationType
    : 'CUSTOM';

  const r = (type === 'CUSTOM' && question)
    ? await askCoach({ artistId, campaignId, question }, { baseUrl })
    : await runCoachInvestigation({ artistId, campaignId, investigationType: type, question }, { baseUrl });

  if (!r.ok) return json({ error: r.reason, detail: r.detail }, r.reason === 'NOT_CONFIGURED' ? 503 : 400);
  return json(r.data);
}
