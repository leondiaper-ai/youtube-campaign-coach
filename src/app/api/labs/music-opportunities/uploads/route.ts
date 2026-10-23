import { OWNED_CHANNELS, validChannelId } from '@/lib/ownedChannels/channels';
import { labsEnabled, sameOrigin } from '@/lib/labs/musicOpportunities/gate';
import { labsStore, withLock } from '@/lib/labs/musicOpportunities/store';
import { sweepUploads } from '@/lib/labs/musicOpportunities/uploadsSweep';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

/** POST { channelId }. One channel per request; incremental after the first full sweep. Production: 404. */
export async function POST(req: Request) {
  if (!labsEnabled()) return new Response(null, { status: 404 });
  if (!sameOrigin(req)) return new Response(null, { status: 403 });
  if (!labsStore()) return Response.json({ error: 'Preview storage is not configured.' }, { status: 503 });
  const body = await req.json().catch(() => null) as { channelId?: string } | null;
  const def = OWNED_CHANNELS.find(c => c.id === body?.channelId);
  if (!def || !validChannelId(def.id)) return Response.json({ error: 'Channel ID needs checking.' }, { status: 400 });
  try {
    return Response.json({ ok: true, ...await withLock(`uploads:${def.id}`, 190, () => sweepUploads(def.id)) });
  } catch (e) {
    const message = e instanceof Error && /^(YouTube |Channel |Already |Preview )/.test(e.message) ? e.message : 'Could not read this channel. The inventory was not changed.';
    return Response.json({ error: message }, { status: /^Already/.test(message) ? 429 : 502 });
  }
}
