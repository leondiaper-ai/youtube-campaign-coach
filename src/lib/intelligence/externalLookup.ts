/**
 * EXTERNAL CHANNEL LOOKUP — the two tools verification cannot happen without
 *
 * Every other read tool in this layer is scoped to our own roster. That was
 * correct for matching and useless for verification: asked to confirm what
 * Aimyon published, a model with only roster tools has two options, and
 * both are bad. Fail on all four examples, or write a plausible YouTube URL
 * from memory. The second is the dangerous one, because a fabricated source
 * link is indistinguishable from a real one until somebody clicks it.
 *
 * So verification gets exactly two tools, both read-only, both metered
 * against the same daily YouTube quota ledger Scout uses, and both returning
 * raw public facts with no interpretation attached.
 *
 * ── WHAT THESE DELIBERATELY DO NOT DO ─────────────────────────────────
 * There is no discovery here. `lookup_external_channel` takes a name and
 * returns candidate channels; it cannot be used to sweep for interesting
 * behaviour, because the verification run's tool allowlist is the only way
 * in and that allowlist has no discovery mission attached. The distinction
 * matters: a search of 100 units aimed at "find Aimyon's channel" and a
 * search of 100 units aimed at "find me something interesting" cost the
 * same and are completely different activities.
 *
 * ── PREMIERES AND LIVE ────────────────────────────────────────────────
 * `wasLive`, `scheduledStart` and `actualStart` come from
 * liveStreamingDetails and are the only public evidence that something was
 * a Premiere or a stream. Three of the four seeded claims rest on exactly
 * that, which is why these fields are returned rather than summarised away.
 */

import {
  searchMusicVideos, fetchChannelsBatch, fetchRecentUploads,
  newMeter, QuotaExceeded, type QuotaMeter,
} from '../youtube/discovery';

export interface ExternalChannelCandidate {
  channelId: string;
  title: string;
  handle: string | null;
  subscribers: number | null;
  videoCount: number | null;
  uploadsPlaylistId: string | null;
  /** The video that surfaced it, so a wrong match is visible. */
  viaVideoTitle: string | null;
  url: string;
}

/**
 * Name → candidate channels. Returns several rather than one, because the
 * top result for an artist name is frequently a label channel, a topic
 * channel or a cover version, and picking silently is how the wrong
 * channel's uploads end up recorded as evidence.
 */
export async function lookupExternalChannel(
  query: string, meter: QuotaMeter,
): Promise<{ candidates: ExternalChannelCandidate[]; note: string }> {
  const { hits } = await searchMusicVideos(query, meter, { order: 'relevance', videoDuration: 'any' });
  if (!hits.length) {
    return {
      candidates: [],
      note: 'No results. Either the query is wrong or the API key is unset — do NOT proceed as if the channel does not exist.',
    };
  }

  /* Distinct channels, first appearance wins, capped. fetchChannelsBatch
     costs one unit for up to 50 ids, so widening this is nearly free and
     narrowing it does not save anything worth having. */
  const seen = new Map<string, { title: string; via: string }>();
  for (const h of hits) {
    if (!seen.has(h.channelId)) seen.set(h.channelId, { title: h.channelTitle, via: h.title });
  }
  const ids = Array.from(seen.keys()).slice(0, 25);
  const summaries = await fetchChannelsBatch(ids, meter);

  const candidates = summaries.map(s => ({
    channelId: s.channelId,
    title: s.title,
    handle: (s as any).customUrl ?? (s as any).handle ?? null,
    subscribers: (s as any).subscribers ?? null,
    videoCount: (s as any).videoCount ?? null,
    uploadsPlaylistId: (s as any).uploadsPlaylistId ?? null,
    viaVideoTitle: seen.get(s.channelId)?.via ?? null,
    url: `https://www.youtube.com/channel/${s.channelId}`,
  }));

  /* Bigger first is a convenience, not a judgement. The official channel is
     usually but not always the largest, which is why every candidate is
     returned with the video that surfaced it. */
  candidates.sort((a, b) => (b.subscribers ?? 0) - (a.subscribers ?? 0));

  return {
    candidates,
    note: 'Candidates, not an answer. Confirm the channel is the ARTIST channel and not a label, topic or fan channel before treating anything on it as evidence.',
  };
}

export interface ExternalUpload {
  videoId: string;
  url: string;
  title: string;
  publishedAt: string;
  durationSec: number;
  views: number;
  likes: number;
  comments: number;
  /** The only public evidence of a Premiere or stream. */
  wasLive: boolean;
  scheduledStart: string | null;
  actualStart: string | null;
}

export async function getExternalChannelUploads(
  uploadsPlaylistId: string, meter: QuotaMeter, limit = 100,
): Promise<{ uploads: ExternalUpload[]; note: string }> {
  const vids = await fetchRecentUploads(uploadsPlaylistId, meter, Math.min(limit, 200));
  return {
    uploads: vids.map(v => ({
      videoId: v.id,
      url: `https://www.youtube.com/watch?v=${v.id}`,
      title: v.title,
      publishedAt: v.publishedAt,
      durationSec: v.durationSec,
      views: v.views,
      likes: v.likes,
      comments: v.comments,
      wasLive: v.wasLive,
      scheduledStart: v.scheduledStart,
      actualStart: v.actualStart,
    })),
    note:
      'View counts are CURRENT LIFETIME TOTALS read once. They are not velocity, they are not campaign-period '
      + 'performance, and they must never be divided by the asset age. publishedAt is the UPLOAD date, which is '
      + 'not necessarily the song release date. wasLive/scheduledStart are the only public evidence of a Premiere.',
  };
}

export { newMeter, QuotaExceeded, type QuotaMeter };
