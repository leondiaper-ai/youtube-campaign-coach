import { NextResponse } from 'next/server';
import { getAllArtists } from '@/lib/marketScope';
import { YOUTUBE_UK_ROSTER } from '@/lib/youtubeUkRoster';
import { getLabelWorkspace, isLabelArtist } from '@/lib/labels';
import { listPartnerSlugs, listHiddenPartnerSlugs } from '@/lib/youtubeUkPartnerStore';
import { readAllLiveSnaps } from '@/lib/kvCache';

export const dynamic = 'force-dynamic';
const norm = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export async function GET() {
  const all = await getAllArtists();
  const [added, hidden] = await Promise.all([listPartnerSlugs(), listHiddenPartnerSlugs()]);
  const roster = new Set(YOUTUBE_UK_ROSTER.map(a=>norm(a.name)));
  const partisan = getLabelWorkspace('partisan');
  const hiddenSet = new Set(hidden);
  const seen = new Set<string>();
  const selected = all.filter(a=>{
    if (hiddenSet.has(a.slug)) return false;
    if (!roster.has(norm(a.name)) && !added.includes(a.slug) && !(partisan && isLabelArtist(partisan,a))) return false;
    const key=(a.channelHandle||a.slug).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const snaps = await readAllLiveSnaps(selected.map(a=>a.channelHandle).filter(Boolean) as string[]);
  const artists = selected.map(a=>{
    const snap = a.channelHandle ? snaps.get(a.channelHandle) : null;
    const id = snap?.channelId && /^UC[A-Za-z0-9_-]{22}$/.test(snap.channelId) ? snap.channelId : null;
    const handle = a.channelHandle && /^@[A-Za-z0-9._-]+$/.test(a.channelHandle) ? a.channelHandle : null;
    return {artist:a.name,slug:a.slug,handle,channelId:id,status:id?'Verified UC ID from Watcher cache':handle?'Handle from Watcher configuration':'Needs channel verification'};
  }).sort((a,b)=>a.artist.localeCompare(b.artist));
  return NextResponse.json({source:'YouTube UK shared Watcher',generatedAt:new Date().toISOString(),count:artists.length,artists},{headers:{'Cache-Control':'no-store'}});
}
