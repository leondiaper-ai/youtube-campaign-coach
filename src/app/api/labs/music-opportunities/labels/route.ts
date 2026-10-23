import { labsEnabled, sameOrigin } from '@/lib/labs/musicOpportunities/gate';
import { labsStore, removeHumanLabel, writeHumanLabel } from '@/lib/labs/musicOpportunities/store';
import { VOCAB, type Dimension, type HumanLabel } from '@/lib/labs/musicOpportunities/types';

export const dynamic = 'force-dynamic';
const clip = (v: unknown, n = 200) => typeof v === 'string' ? v.trim().slice(0, n) : '';

/**
 * POST { subject, dimension, value, by, note? }  — record a human label
 * DELETE { subject, dimension, value }            — remove one
 * subject: a song key (text:…|…, isrc:…), artist:<normalised name>, upload:<videoId> or video:<videoId>.
 * Values must come from the vocabulary; "unknown" is the absence of a label, not a value. Production: 404.
 */
export async function POST(req: Request) {
  if (!labsEnabled()) return new Response(null, { status: 404 });
  if (!sameOrigin(req)) return new Response(null, { status: 403 });
  if (!labsStore()) return Response.json({ error: 'Preview storage is not configured.' }, { status: 503 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const subject = clip(body?.subject, 300), dimension = clip(body?.dimension, 20) as Dimension, value = clip(body?.value, 60), by = clip(body?.by, 60) || 'reviewer';
  if (!subject || !/^(text:|isrc:|artist:|upload:|video:)/.test(subject)) return Response.json({ error: 'Subject must be a song key, artist:, upload: or video: reference.' }, { status: 400 });
  if (!(dimension in VOCAB)) return Response.json({ error: 'Unknown dimension.' }, { status: 400 });
  if (!VOCAB[dimension].includes(value)) return Response.json({ error: `Value must be one of: ${VOCAB[dimension].join(', ')}.` }, { status: 400 });
  const label: HumanLabel = { subject, dimension, value, by, at: new Date().toISOString(), note: clip(body?.note, 200) || null };
  const list = await writeHumanLabel(label);
  return Response.json({ ok: true, count: list.length });
}

export async function DELETE(req: Request) {
  if (!labsEnabled()) return new Response(null, { status: 404 });
  if (!sameOrigin(req)) return new Response(null, { status: 403 });
  if (!labsStore()) return Response.json({ error: 'Preview storage is not configured.' }, { status: 503 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const subject = clip(body?.subject, 300), dimension = clip(body?.dimension, 20), value = clip(body?.value, 60);
  if (!subject || !dimension || !value) return Response.json({ error: 'subject, dimension and value are required.' }, { status: 400 });
  const list = await removeHumanLabel(subject, dimension, value);
  return Response.json({ ok: true, count: list.length });
}
