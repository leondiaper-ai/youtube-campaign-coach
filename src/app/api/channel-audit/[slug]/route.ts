import { NextRequest, NextResponse } from 'next/server';
import { ARTISTS, mergeArtistLists } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { readLiveSnapByHandle } from '@/lib/kvCache';
import { readHistory } from '@/lib/snapshots';
import { normalizeChannelData, rawDelta } from '@/lib/youtube/normalizeChannelData';
import { SEEDED_DEEP_DIVES, DEEP_DIVE_BY_NAME, normaliseName } from '@/lib/intelligence/deepDives';
import { deepDiveFor } from '@/lib/deepDiveLink';
import { buildChannelAudit } from '@/lib/channelAudit';
import type { TerritoriesResult } from '@/lib/chartmetric/territories';
export const dynamic = 'force-dynamic';
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const artist = mergeArtistLists(ARTISTS, await listCustomArtists()).find(a=>a.slug===params.slug);
  if (!artist) return NextResponse.json({error:'Artist not found'}, {status:404});
  const snap = artist.channelHandle ? await readLiveSnapByHandle(artist.channelHandle) : null;
  if (!snap || snap.error) return NextResponse.json({error:'No usable cached channel reading yet. Refresh channel data before auditing.'},{status:404});
  const history = snap.channelId ? await readHistory(snap.channelId) : [];
  const nc = normalizeChannelData(snap,history);
  let markets: TerritoriesResult | null = null;
  // Cache-only: opening an audit must never trigger vendor calls or a full catalogue sweep.
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (url && token && snap.channelId) {
    try { const {Redis} = await import('@upstash/redis'); markets = await new Redis({url,token}).get<TerritoriesResult>('cm:territories:'+snap.channelId); } catch { /* markets are optional */ }
  }
  const available = markets?.ok ? markets : null;
  const territories = available?.countries.slice().sort((a,b)=>b.monthlyViews-a.monthlyViews).slice(0,5).map(t=>({name:t.name,views:t.monthlyViews,estimated:t.isEstimate}));
  const audit = buildChannelAudit({name:artist.name,slug:artist.slug,dataAt:snap.cachedAt ?? null,uploads:snap.recentUploads ?? [],stats:{subs:nc.subs,lifetimeViews:nc.views,views7d:rawDelta(nc.views7d),views30d:rawDelta(nc.views30d),subs7d:rawDelta(nc.subs7d)},territories,territoryNote:available ? `Chartmetric monthly YouTube views by country · reported ${available.reportingDate ?? 'date unavailable'} · cached ${available.fetchedAt.slice(0,10)}. Artist-level context, not recording-level demand; estimates are marked. No country trend is inferred.` : 'Country data is unavailable in the cache. Open the artist’s Markets section to check the existing territory integration; no market is assumed.'});
  const deck = SEEDED_DEEP_DIVES[DEEP_DIVE_BY_NAME[normaliseName(artist.name)]];
  const link = deepDiveFor(artist.name);
  if (deck || link) {
    const futureMoment = artist.nextMomentDate && Date.parse(artist.nextMomentDate)>Date.now() ? `${artist.nextMomentLabel ?? 'Next recorded moment'}: ${artist.nextMomentDate}. ` : '';
    audit.reference = {title:deck?.title ?? link!.title,href:deck?.deckUrl ?? link?.href ?? null,date:deck?.dataCapturedAt ?? null,points:deck ? [...deck.relevantHistoricalExamples.slice(0,1), ...deck.channelStrengths.slice(0,2)].slice(0,3).map(p=>({point:p.point,basis:p.basis})) : [],note:futureMoment+'Historical deck evidence, not a fresh reading. Use it as a creative and rollout reference; no new album date is assumed. A numeric campaign comparison needs confirmed release dates, matching rollout windows and historical readings at comparable ages. Those have not been established by this audit.'};
  }
  return NextResponse.json(audit,{headers:{'Cache-Control':'private, no-store'}});
}
