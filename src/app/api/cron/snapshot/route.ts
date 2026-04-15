import { NextRequest, NextResponse } from 'next/server';
import { ARTISTS } from '@/lib/artists';
import { fetchChannelSnap } from '@/lib/youtube';

export const dynamic = 'force-dynamic';

/**
 * Daily snapshot cron. Vercel hits this via vercel.json crons config.
 * Iterates every artist, forces a fresh fetch (which writes a
 * time-series entry via snapshots.ts).
 */
export async function GET(req: NextRequest) {
  // Vercel Cron sets this header automatically. Block public access.
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const results: Record<string, string> = {};
  for (const a of ARTISTS) {
    if (!a.channelHandle) {
      results[a.slug] = 'no handle';
      continue;
    }
    try {
      const snap = await fetchChannelSnap(a.channelHandle);
      if (!snap) results[a.slug] = 'no key';
      else if (snap.error) results[a.slug] = `error: ${snap.error}`;
      else results[a.slug] = `ok (${snap.subs} subs)`;
    } catch (e: any) {
      results[a.slug] = `throw: ${e?.message ?? e}`;
    }
  }

  return NextResponse.json({ ok: true, at: new Date().toISOString(), results });
}
