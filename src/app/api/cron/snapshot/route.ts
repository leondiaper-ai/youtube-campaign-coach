import { NextRequest, NextResponse } from 'next/server';
import { ARTISTS } from '@/lib/artists';
import { fetchChannelSnap } from '@/lib/youtube';
import { captureWeeklySnapshots } from '@/lib/weeklySnapshotCapture';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for all artists

/**
 * Cron endpoint — Vercel calls this via vercel.json crons config.
 *
 * 1. Daily: fetches a fresh channel snapshot for every artist
 *    (writes time-series data via snapshots.ts for sparklines/deltas).
 * 2. Weekly: captures a weekly snapshot for all managed artists.
 *    Deduplicates by ISO week — safe to run daily, only captures
 *    once per week per artist. Saves rollup automatically.
 */
export async function GET(req: NextRequest) {
  // Vercel Cron sets this header automatically. Block public access.
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // ── 1. Daily time-series snapshots ──────────────────────────────────
  const dailyResults: Record<string, string> = {};
  for (const a of ARTISTS) {
    if (!a.channelHandle) {
      dailyResults[a.slug] = 'no handle';
      continue;
    }
    try {
      const snap = await fetchChannelSnap(a.channelHandle);
      if (!snap) dailyResults[a.slug] = 'no key';
      else if (snap.error) dailyResults[a.slug] = `error: ${snap.error}`;
      else dailyResults[a.slug] = `ok (${snap.subs} subs)`;
    } catch (e: any) {
      dailyResults[a.slug] = `throw: ${e?.message ?? e}`;
    }
  }

  // ── 2. Weekly snapshot capture (deduped by ISO week) ────────────────
  let weeklyResult;
  try {
    weeklyResult = await captureWeeklySnapshots();
  } catch (e: any) {
    weeklyResult = { error: e?.message ?? 'Weekly capture failed' };
  }

  return NextResponse.json({
    ok: true,
    at: new Date().toISOString(),
    daily: dailyResults,
    weekly: weeklyResult,
  });
}
