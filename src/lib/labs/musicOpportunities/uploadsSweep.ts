/* ═══════════════════════════════════════════════════════════════════════
   UPLOAD INVENTORY — ONE CHANNEL, INCREMENTAL, PLAYLIST ONLY

   The Owned Channels store keeps a bounded working set per channel
   (newest 300 + top 100), which is right for monitoring and wrong for
   matching: the upload that connects to a chart entry is usually
   neither new nor top. So the sandbox keeps its own title index of
   EVERY public upload — id, title, published date — read from the
   uploads playlist at one quota unit per 50 rows, with no videos.list
   and no search.list.

   First sweep of a 6,500-upload channel: ~130 units, ~20–40 seconds.
   Every later sweep walks newest-first and stops at the first id it
   already holds, so a channel adding 50 a day costs 1–2 units a day.
   Nine channels: roughly 400 units once, then a handful a day.
   ═══════════════════════════════════════════════════════════════════════ */

import { OWNED_CHANNELS, validChannelId } from '@/lib/ownedChannels/channels';
import { readUploads, writeUploads, type UploadRow } from './store';

const MAX_PAGES = 240; // 12,000 uploads; a stop against a runaway channel, not a sample size

type Item = { snippet?: { title?: string; publishedAt?: string; resourceId?: { videoId?: string } }; contentDetails?: { videoId?: string; videoPublishedAt?: string }; status?: { privacyStatus?: string } };

export async function sweepUploads(channelId: string): Promise<{ added: number; total: number; units: number; complete: boolean; incremental: boolean }> {
  const def = OWNED_CHANNELS.find(c => c.id === channelId);
  if (!def || !validChannelId(channelId)) throw new Error('Channel ID needs checking.');
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error('YouTube access is not configured for this preview.');
  let units = 0;
  async function get(resource: string, params: Record<string, string>) {
    const query = new URLSearchParams({ ...params, key: apiKey! });
    const response = await fetch(`https://www.googleapis.com/youtube/v3/${resource}?${query}`, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
    units++;
    if (resource === 'playlistItems' && response.status === 404) return { items: [] as Item[] };
    if (!response.ok) throw new Error(`YouTube returned ${response.status}; the inventory was not changed.`);
    return response.json() as Promise<{ items: Item[]; nextPageToken?: string }>;
  }
  const ch = await get('channels', { part: 'contentDetails,statistics', id: channelId }) as unknown as { items: { id: string; contentDetails?: { relatedPlaylists?: { uploads?: string } }; statistics?: { videoCount?: string } }[] };
  const channel = ch.items?.[0];
  if (channel?.id !== channelId) throw new Error('Channel not found. Check the supplied ID.');
  const playlistId = channel.contentDetails?.relatedPlaylists?.uploads;
  const videoCount = channel.statistics?.videoCount != null ? Number(channel.statistics.videoCount) : null;
  const existing = await readUploads(channelId);
  const known = new Map(existing.rows.map(r => [r.id, r]));
  const incremental = existing.rows.length > 0 && existing.meta?.complete === true;
  const now = new Date().toISOString();
  const fresh: UploadRow[] = [];
  let token: string | undefined, reachedEnd = !playlistId, stoppedAtKnown = false;
  for (let page = 0; playlistId && page < MAX_PAGES; page++) {
    const result = await get('playlistItems', { part: 'snippet,contentDetails,status', maxResults: '50', playlistId, ...(token ? { pageToken: token } : {}) });
    for (const item of result.items) {
      const id = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId;
      const at = item.contentDetails?.videoPublishedAt ?? item.snippet?.publishedAt;
      if (!id || !at) continue;
      if (item.status?.privacyStatus && item.status.privacyStatus !== 'public') continue;
      if (incremental && known.has(id)) { stoppedAtKnown = true; break; }
      fresh.push({ id, title: item.snippet?.title ?? id, publishedAt: at });
    }
    if (stoppedAtKnown) break;
    token = result.nextPageToken;
    if (!token) { reachedEnd = true; break; }
  }
  /* An incremental walk that stopped at a known id is complete by
     construction; a full walk is complete only if it reached the end. */
  const complete = incremental ? (stoppedAtKnown || reachedEnd) : reachedEnd;
  const merged = incremental ? [...fresh, ...existing.rows] : fresh;
  const dedup = Array.from(new Map(merged.map(r => [r.id, r])).values())
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  await writeUploads(channelId, dedup, {
    channelId, complete, videoCount, sweptAt: now,
    firstSweptAt: existing.meta?.firstSweptAt ?? now,
    lastIncrementalAt: incremental ? now : existing.meta?.lastIncrementalAt ?? null,
  });
  return { added: fresh.length, total: dedup.length, units, complete, incremental };
}
