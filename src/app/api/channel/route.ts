import { NextRequest, NextResponse } from 'next/server';
import { fetchChannelSnap } from '@/lib/youtube';

export const revalidate = 600;

export async function GET(req: NextRequest) {
  if (!process.env.YOUTUBE_API_KEY) {
    return NextResponse.json({ error: 'YOUTUBE_API_KEY not set' }, { status: 503 });
  }
  const q = req.nextUrl.searchParams.get('q');
  if (!q) return NextResponse.json({ error: 'missing q' }, { status: 400 });
  const snap = await fetchChannelSnap(q);
  if (!snap) return NextResponse.json({ error: 'no key' }, { status: 503 });
  if (snap.error) return NextResponse.json(snap, { status: 502 });
  return NextResponse.json(snap);
}
