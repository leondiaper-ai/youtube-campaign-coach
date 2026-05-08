import { NextRequest, NextResponse } from 'next/server';
import { ARTISTS, mergeArtistLists, isManaged, type Artist } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { readHistory, type ChannelSnapshot } from '@/lib/snapshots';
import { readChannelMapping } from '@/lib/kvCache';
import { deltaOver } from '@/lib/snapshots';

// ─────────────────────────────────────────────────────────────────────────────
// SNAPSHOT REPAIR & INTEGRITY REPORT
//
// GET  /api/debug/repair-snapshots          → dry-run scan for all managed artists
// GET  /api/debug/repair-snapshots?focus=1  → focus on 5 target artists only
// POST /api/debug/repair-snapshots          → execute repair (convert fake zeros → null)
//
// Detection heuristic for fake zeros:
//   A snapshot has views=0 or subs=0, BUT the previous snapshot had views/subs > 1000.
//   Real channels don't drop from millions of views to literal zero overnight.
//   A genuine zero would only appear on a brand-new or deleted channel.
//
// Safe threshold: if the previous valid value was > 1000, a zero is almost certainly
// a failed API fetch that got coerced to 0 by the old `?? 0` bug.
// ─────────────────────────────────────────────────────────────────────────────

const TARGET_ARTISTS = ['k-trap', 'the-snuts', 'tove-lo', 'jamie-webster', 'jjerome87'];

// Minimum previous value for a zero to be considered "suspicious"
// If previous views were 50,000 and current is 0, that's definitely fake.
// If previous views were 5, a zero could be real. We use 1000 as the threshold.
const FAKE_ZERO_THRESHOLD = 1000;

type FakeZeroEntry = {
  ts: string;
  field: 'views' | 'subs';
  value: 0;
  previousValue: number;
  previousTs: string;
};

type ArtistRepairReport = {
  slug: string;
  name: string;
  channelId: string | null;
  totalSnapshots: number;
  fakeZerosFound: FakeZeroEntry[];
  repaired: number;
  latestValidSnapshot: {
    ts: string;
    views: number | null;
    subs: number | null;
  } | null;
  latestNullSnapshot: {
    ts: string;
    views: number | null;
    subs: number | null;
  } | null;
  current7dViews: number | null;
  current7dSubs: number | null;
  wowStatus: string;
  healthSummary: string;
};

type RepairSummary = {
  mode: 'dry-run' | 'repair';
  scannedArtists: number;
  totalSnapshots: number;
  totalFakeZeros: number;
  artistsAffected: number;
  artistReports: ArtistRepairReport[];
  timestamp: string;
};

/** Detect fake zeros in a snapshot history */
function detectFakeZeros(history: ChannelSnapshot[]): FakeZeroEntry[] {
  const fakes: FakeZeroEntry[] = [];
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1];
    const curr = history[i];

    // Views: current is exactly 0 but previous was significant
    if (curr.views === 0 && prev.views != null && prev.views > FAKE_ZERO_THRESHOLD) {
      fakes.push({
        ts: curr.ts,
        field: 'views',
        value: 0,
        previousValue: prev.views,
        previousTs: prev.ts,
      });
    }

    // Subs: current is exactly 0 but previous was significant
    if (curr.subs === 0 && prev.subs != null && prev.subs > FAKE_ZERO_THRESHOLD) {
      fakes.push({
        ts: curr.ts,
        field: 'subs',
        value: 0,
        previousValue: prev.subs,
        previousTs: prev.ts,
      });
    }
  }
  return fakes;
}

/** Apply repair: convert fake zeros to null in a snapshot history */
function repairHistory(
  history: ChannelSnapshot[],
  fakeZeros: FakeZeroEntry[],
): ChannelSnapshot[] {
  const fakeSet = new Set(fakeZeros.map((f) => `${f.ts}:${f.field}`));
  return history.map((snap) => ({
    ...snap,
    views: fakeSet.has(`${snap.ts}:views`) ? null : snap.views,
    subs: fakeSet.has(`${snap.ts}:subs`) ? null : snap.subs,
  }));
}

/** Derive WoW status string from history */
function deriveWoWStatus(history: ChannelSnapshot[]): string {
  const views7 = deltaOver(history, 7, 'views');
  const views14 = deltaOver(history, 14, 'views');

  if (!views7) return 'No 7d data';
  if (!views14) return `7d: ${views7.delta >= 0 ? '+' : ''}${views7.delta} views (no prior week for WoW)`;

  const prevWeekViews = views14.delta - views7.delta;
  if (prevWeekViews === 0) return `7d: ${views7.delta >= 0 ? '+' : ''}${views7.delta} views (WoW: N/A — prior week was 0)`;

  const wow = ((views7.delta - prevWeekViews) / Math.abs(prevWeekViews)) * 100;
  return `7d: ${views7.delta >= 0 ? '+' : ''}${views7.delta} views (WoW: ${wow >= 0 ? '+' : ''}${Math.round(wow)}%)`;
}

async function buildArtistReport(
  artist: Artist,
  doRepair: boolean,
): Promise<ArtistRepairReport> {
  const handle = artist.channelHandle ?? artist.name;
  const channelId = handle ? await readChannelMapping(handle) : null;

  if (!channelId) {
    return {
      slug: artist.slug,
      name: artist.name,
      channelId: null,
      totalSnapshots: 0,
      fakeZerosFound: [],
      repaired: 0,
      latestValidSnapshot: null,
      latestNullSnapshot: null,
      current7dViews: null,
      current7dSubs: null,
      wowStatus: 'No channel mapping',
      healthSummary: 'Channel not mapped in KV',
    };
  }

  const history = await readHistory(channelId);
  const fakeZeros = detectFakeZeros(history);

  let repairedCount = 0;
  let effectiveHistory = history;

  if (doRepair && fakeZeros.length > 0) {
    effectiveHistory = repairHistory(history, fakeZeros);
    // Write repaired history back to KV
    const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
    if (url && token) {
      try {
        const { Redis } = await import('@upstash/redis');
        const store = new Redis({ url, token });
        await store.set(`snap:${channelId}`, effectiveHistory);
        repairedCount = fakeZeros.length;
      } catch {
        // Failed to write — non-fatal
      }
    }
  }

  // Find latest valid snapshot (both views and subs non-null)
  const latestValid = [...effectiveHistory]
    .reverse()
    .find((h) => h.views != null && h.subs != null);

  // Find latest null snapshot
  const latestNull = [...effectiveHistory]
    .reverse()
    .find((h) => h.views == null || h.subs == null);

  // Current deltas (using effective/repaired history)
  const views7 = deltaOver(effectiveHistory, 7, 'views');
  const subs7 = deltaOver(effectiveHistory, 7, 'subs');

  const wowStatus = deriveWoWStatus(effectiveHistory);

  // Health summary
  const problems: string[] = [];
  if (fakeZeros.length > 0) {
    problems.push(`${fakeZeros.length} fake zero(s) ${doRepair ? 'repaired' : 'detected'}`);
  }
  const nullCount = effectiveHistory.filter((h) => h.views == null || h.subs == null).length;
  if (nullCount > 0) {
    problems.push(`${nullCount} snapshot(s) with null values`);
  }
  if (!views7) {
    problems.push('Cannot compute 7d views delta');
  }

  return {
    slug: artist.slug,
    name: artist.name,
    channelId,
    totalSnapshots: effectiveHistory.length,
    fakeZerosFound: fakeZeros,
    repaired: repairedCount,
    latestValidSnapshot: latestValid
      ? { ts: latestValid.ts, views: latestValid.views, subs: latestValid.subs }
      : null,
    latestNullSnapshot: latestNull
      ? { ts: latestNull.ts, views: latestNull.views, subs: latestNull.subs }
      : null,
    current7dViews: views7?.delta ?? null,
    current7dSubs: subs7?.delta ?? null,
    wowStatus,
    healthSummary: problems.length > 0
      ? problems.join(' · ')
      : 'Clean — no fake zeros, all metrics present',
  };
}

// ── GET: dry-run scan ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const focusOnly = req.nextUrl.searchParams.get('focus') === '1';

  const custom = await listCustomArtists();
  const allArtists = mergeArtistLists(ARTISTS, custom);
  const managed = allArtists.filter(isManaged);

  const artistsToScan = focusOnly
    ? managed.filter((a) => TARGET_ARTISTS.includes(a.slug))
    : managed;

  // If focused and some targets aren't in managed, check all artists
  if (focusOnly && artistsToScan.length < TARGET_ARTISTS.length) {
    const missing = TARGET_ARTISTS.filter(
      (slug) => !artistsToScan.some((a) => a.slug === slug)
    );
    for (const slug of missing) {
      const found = allArtists.find((a) => a.slug === slug);
      if (found) artistsToScan.push(found);
    }
  }

  const reports = await Promise.all(
    artistsToScan.map((a) => buildArtistReport(a, false))
  );

  const summary: RepairSummary = {
    mode: 'dry-run',
    scannedArtists: reports.length,
    totalSnapshots: reports.reduce((s, r) => s + r.totalSnapshots, 0),
    totalFakeZeros: reports.reduce((s, r) => s + r.fakeZerosFound.length, 0),
    artistsAffected: reports.filter((r) => r.fakeZerosFound.length > 0).length,
    artistReports: reports,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(summary);
}

// ── POST: execute repair ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const focusOnly = body.focus === true;
  const confirmRepair = body.confirm === true;

  if (!confirmRepair) {
    return NextResponse.json(
      { error: 'Set { "confirm": true } in POST body to execute repair' },
      { status: 400 },
    );
  }

  const custom = await listCustomArtists();
  const allArtists = mergeArtistLists(ARTISTS, custom);
  const managed = allArtists.filter(isManaged);

  const artistsToRepair = focusOnly
    ? managed.filter((a) => TARGET_ARTISTS.includes(a.slug))
    : managed;

  // Include non-managed targets too
  if (focusOnly) {
    const missing = TARGET_ARTISTS.filter(
      (slug) => !artistsToRepair.some((a) => a.slug === slug)
    );
    for (const slug of missing) {
      const found = allArtists.find((a) => a.slug === slug);
      if (found) artistsToRepair.push(found);
    }
  }

  const reports = await Promise.all(
    artistsToRepair.map((a) => buildArtistReport(a, true))
  );

  const summary: RepairSummary = {
    mode: 'repair',
    scannedArtists: reports.length,
    totalSnapshots: reports.reduce((s, r) => s + r.totalSnapshots, 0),
    totalFakeZeros: reports.reduce((s, r) => s + r.fakeZerosFound.length, 0),
    artistsAffected: reports.filter((r) => r.fakeZerosFound.length > 0).length,
    artistReports: reports,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(summary);
}
