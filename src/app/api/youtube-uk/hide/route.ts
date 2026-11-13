import { NextRequest, NextResponse } from 'next/server';
import { hidePartnerArtist } from '@/lib/youtubeUkPartnerStore';
import { getAllArtists } from '@/lib/marketScope';
export async function POST(request: NextRequest) {
  try {
    const { slug } = await request.json();
    if (typeof slug !== 'string' || !/^[a-z0-9-]{1,100}$/.test(slug)) return NextResponse.json({ error: 'Invalid artist' }, { status: 400 });
    const all = await getAllArtists();
    if (!all.some(a => a.slug === slug)) return NextResponse.json({ error: 'Unknown artist' }, { status: 404 });
    await hidePartnerArtist(slug);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Could not update shared roster' }, { status: 500 });
  }
}
