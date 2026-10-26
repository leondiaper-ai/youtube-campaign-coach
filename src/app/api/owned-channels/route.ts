import { OWNED_CHANNELS, validChannelId } from '@/lib/ownedChannels/channels';
import { ownedChannelsEnabled } from '@/lib/ownedChannels/gate';
import { collectOwnedChannel } from '@/lib/ownedChannels/collect';
import { ownedStore, readOwnedHistory, saveOwnedSnapshot } from '@/lib/ownedChannels/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;
export async function POST(req: Request) {
  if (!ownedChannelsEnabled()) return new Response(null, { status: 404 });
  // Preview relies on the project's existing Vercel Deployment Protection.
  // Reject cross-origin browser writes; never accept arbitrary channel IDs.
  const origin = req.headers.get('origin');
  if (!origin || origin !== new URL(req.url).origin) return new Response(null, { status: 403 });
  const body = await req.json().catch(() => null);
  const def = OWNED_CHANNELS.find(c => c.id === body?.channelId);
  if (!def || !validChannelId(def.id)) return Response.json({ error: 'Channel ID needs checking.' }, { status: 400 });
  const store = ownedStore();
  if (!store) return Response.json({ error: 'Preview storage is not configured.' }, { status: 503 });
  const lock = `owned:preview:lock:${def.id}`;
  const acquired = await store.set(lock, 'collecting', { nx: true, ex: 190 });
  if (!acquired) return Response.json({ error: 'This channel is already refreshing.' }, { status: 429 });
  try {
    const history = await readOwnedHistory(def.id);
    const latest = history.at(-1);
    if (latest && Date.now() - Date.parse(latest.collectedAt) < 3600000)
      return Response.json({ ok: true, cached: true });
    await saveOwnedSnapshot(await collectOwnedChannel(def.id));
    return Response.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error && /^(YouTube |Channel |This channel|Preview )/.test(e.message)
      ? e.message : 'Could not collect this channel. Please try again.';
    return Response.json({ error: message }, { status: 502 });
  } finally { await store.del(lock); }
}
