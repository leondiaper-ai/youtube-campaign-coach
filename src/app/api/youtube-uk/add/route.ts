import { NextRequest, NextResponse } from 'next/server';
import { getAllArtists } from '@/lib/marketScope';
import { addPartnerArtist } from '@/lib/youtubeUkPartnerStore';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const slug = body?.slug;
  if (typeof slug !== 'string' || !/^[a-z0-9-]{1,100}$/.test(slug)) return NextResponse.json({ error: 'Invalid artist slug' }, { status: 400 });
  const artist = (await getAllArtists()).find(a => a.slug === slug);
  if (!artist) return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
  try { await addPartnerArtist(slug); return NextResponse.json({ ok: true, artist: artist.name }); }
  catch { return NextResponse.json({ error: 'Could not save shared roster' }, { status: 503 }); }
}
