import { NextRequest, NextResponse } from 'next/server';
import { fetchChannelSnap, resolveChannelId } from '@/lib/youtube';
import { addCustomArtist, listCustomArtists, removeCustomArtist, slugify } from '@/lib/artistStore';
import type { Artist } from '@/lib/artists';

export const dynamic = 'force-dynamic';

export async function GET() {
  const list = await listCustomArtists();
  return NextResponse.json({ artists: list });
}

export async function POST(req: NextRequest) {
  if (!process.env.YOUTUBE_API_KEY) {
    return NextResponse.json({ error: 'YOUTUBE_API_KEY not set' }, { status: 503 });
  }
  const body = await req.json().catch(() => null);
  const input: string | undefined = body?.input;
  const phase: Artist['phase'] = body?.phase ?? 'PRE';
  if (!input || typeof input !== 'string') {
    return NextResponse.json({ error: 'Missing input (YouTube handle / URL / name).' }, { status: 400 });
  }

  // Resolve to a channel ID first so we store a stable identifier.
  const channelId = await resolveChannelId(input);
  if (!channelId) {
    return NextResponse.json({ error: `Could not find a YouTube channel for "${input}".` }, { status: 404 });
  }

  // Pull a snap so we have the display name + verify it exists.
  const snap = await fetchChannelSnap(channelId);
  if (!snap || snap.error || !snap.title) {
    return NextResponse.json(
      { error: `Channel resolved but live fetch failed${snap?.error ? `: ${snap.error}` : ''}.` },
      { status: 502 }
    );
  }

  const slug = slugify(snap.handle?.replace(/^@/, '') || snap.title);
  if (!slug) {
    return NextResponse.json({ error: 'Could not derive a slug from the channel.' }, { status: 400 });
  }

  const artist: Artist = {
    slug,
    name: snap.title,
    channelHandle: snap.handle || channelId,
    phase,
    custom: true,
  };
  const list = await addCustomArtist(artist);
  return NextResponse.json({ artist, artists: list });
}

export async function DELETE(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'missing slug' }, { status: 400 });
  const list = await removeCustomArtist(slug);
  return NextResponse.json({ artists: list });
}
