import { NextResponse } from 'next/server';
import { deltaOver, campaignDelta, detectViewFreshness, detectSubsFreshness, type ChannelSnapshot } from '@/lib/snapshots';
import { viewsToRevenue, subsToValue, detectOpportunity, getArtistValueOpportunity } from '@/lib/valueModel';
import { rawDelta, rawDeltaOrZero, normalizeChannelData } from '@/lib/youtube/normalizeChannelData';

// ─────────────────────────────────────────────────────────────────────────────
// ZERO-SAFETY TEST SUITE
// GET /api/debug/test-zero-safety
//
// Runs all zero-safety invariant tests and returns results.
// These verify that missing API data never silently becomes zero.
// ─────────────────────────────────────────────────────────────────────────────

type TestResult = { name: string; passed: boolean; error?: string };

function runTests(): TestResult[] {
  const results: TestResult[] = [];

  function test(name: string, fn: () => void) {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (e: any) {
      results.push({ name, passed: false, error: e.message });
    }
  }

  function eq(actual: any, expected: any, msg?: string) {
    if (actual !== expected) {
      throw new Error(msg || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }

  // ── 1. writeSnapshot type safety ──────────────────────────────────────

  test('ChannelSnapshot allows null views', () => {
    const snap: ChannelSnapshot = {
      ts: '2026-05-01', subs: 100000, views: null,
      uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null,
    };
    eq(snap.views, null);
  });

  test('ChannelSnapshot allows null subs', () => {
    const snap: ChannelSnapshot = {
      ts: '2026-05-01', subs: null, views: 5000000,
      uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null,
    };
    eq(snap.subs, null);
  });

  // ── 2. deltaOver null safety ──────────────────────────────────────────

  test('deltaOver returns null when latest has null views', () => {
    const history: ChannelSnapshot[] = [
      { ts: '2026-04-25', subs: 10000, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
      { ts: '2026-05-01', subs: 10100, views: null, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
    ];
    eq(deltaOver(history, 7, 'views'), null, 'Must return null when latest views is null');
  });

  test('deltaOver returns null when latest has null subs', () => {
    const history: ChannelSnapshot[] = [
      { ts: '2026-04-25', subs: 10000, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
      { ts: '2026-05-01', subs: null, views: 5100000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
    ];
    eq(deltaOver(history, 7, 'subs'), null, 'Must return null when latest subs is null');
  });

  test('deltaOver skips null baseline and uses valid one', () => {
    const history: ChannelSnapshot[] = [
      { ts: '2026-04-20', subs: 10000, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
      { ts: '2026-04-25', subs: 10050, views: null, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
      { ts: '2026-05-01', subs: 10100, views: 5200000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
    ];
    const result = deltaOver(history, 7, 'views');
    if (!result) throw new Error('Should find valid baseline');
    eq(result.delta, 200000, 'Delta should be 5200000 - 5000000');
  });

  test('deltaOver returns null with single snapshot', () => {
    const history: ChannelSnapshot[] = [
      { ts: '2026-05-01', subs: 10000, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
    ];
    eq(deltaOver(history, 7, 'views'), null);
  });

  test('deltaOver never produces delta from null baseline (old fake-zero pattern)', () => {
    const history: ChannelSnapshot[] = [
      { ts: '2026-04-20', subs: 10000, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
      { ts: '2026-04-25', subs: 10050, views: null, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
      { ts: '2026-05-01', subs: 10100, views: 5200000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
    ];
    const result = deltaOver(history, 7, 'views');
    if (!result) throw new Error('Should compute delta');
    eq(result.delta, 200000, 'Must use valid baseline (04-20), not null one (04-25)');
  });

  // ── 3. Value model null safety ────────────────────────────────────────

  test('viewsToRevenue(0) returns zero range', () => {
    const r = viewsToRevenue(0);
    eq(r.low, 0);
    eq(r.high, 0);
  });

  test('getArtistValueOpportunity handles null views/subs', () => {
    const result = getArtistValueOpportunity({
      views7d: null, subs7d: null, uploads30d: 5,
      channelState: 'HEALTHY', artistType: 'managed', ownership: 'virgin',
    });
    eq(result, null, 'Must return null for null data, not crash or produce fake opportunity');
  });

  test('detectOpportunity with null views returns null', () => {
    const result = detectOpportunity({
      views7d: null, subs7d: null, subsPerKViews: null,
      uploads30d: 5, channelState: 'HEALTHY',
    });
    eq(result, null);
  });

  // ── 4. rawDelta vs rawDeltaOrZero ─────────────────────────────────────

  test('rawDelta returns null for null input', () => {
    eq(rawDelta(null), null);
  });

  test('rawDelta returns null for non-meaningful delta', () => {
    eq(rawDelta({ delta: 0, meaningful: false, confidence: 'none', reason: 'test' } as any), null);
  });

  test('rawDelta returns value for meaningful delta', () => {
    eq(rawDelta({ delta: 5000, meaningful: true, confidence: 'good', reason: 'test' } as any), 5000);
  });

  test('rawDeltaOrZero returns 0 for null (deprecated behavior)', () => {
    eq(rawDeltaOrZero(null), 0);
  });

  // ── 5. campaignDelta null safety ──────────────────────────────────────

  test('campaignDelta returns null when latest has null views', () => {
    const history: ChannelSnapshot[] = [
      { ts: '2026-03-01', subs: 10000, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
      { ts: '2026-05-01', subs: 10100, views: null, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
    ];
    eq(campaignDelta(history, '2026-03-01', 'views'), null);
  });

  test('campaignDelta returns valid delta with confirmed endpoints', () => {
    const history: ChannelSnapshot[] = [
      { ts: '2026-03-01', subs: 10000, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
      { ts: '2026-05-01', subs: 10500, views: 5500000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
    ];
    const result = campaignDelta(history, '2026-03-01', 'views');
    if (!result) throw new Error('Should return valid delta');
    eq(result.delta, 500000);
  });

  // ── 6. Null sums don't produce NaN ────────────────────────────────────

  test('nullable sum produces number, not NaN', () => {
    const values: (number | null)[] = [100, null, 200, null, 300];
    const sum = values.reduce((s: number, v) => s + (v ?? 0), 0);
    eq(sum, 600);
    if (Number.isNaN(sum)) throw new Error('Sum is NaN');
  });

  // ── 7. Stale view detection ──────────────────────────────────────────

  test('detectViewFreshness returns stale when viewTotal unchanged for significant channel', () => {
    const history: ChannelSnapshot[] = [
      { ts: '2026-05-01', subs: 100000, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
      { ts: '2026-05-07', subs: 100100, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
    ];
    eq(detectViewFreshness(history, 100000), 'stale');
  });

  test('detectViewFreshness returns fresh when viewTotal changed', () => {
    const history: ChannelSnapshot[] = [
      { ts: '2026-05-01', subs: 100000, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
      { ts: '2026-05-07', subs: 100100, views: 5050000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
    ];
    eq(detectViewFreshness(history, 100000), 'fresh');
  });

  test('detectViewFreshness returns fresh for small channel even with unchanged views', () => {
    const history: ChannelSnapshot[] = [
      { ts: '2026-05-01', subs: 500, views: 10000, uploads30d: 1, shorts30d: 0, upcomingCount: 0, lastUploadAt: null },
      { ts: '2026-05-07', subs: 500, views: 10000, uploads30d: 1, shorts30d: 0, upcomingCount: 0, lastUploadAt: null },
    ];
    eq(detectViewFreshness(history, 500), 'fresh');
  });

  test('detectViewFreshness returns insufficient_history with only 1 snapshot', () => {
    const history: ChannelSnapshot[] = [
      { ts: '2026-05-07', subs: 100000, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
    ];
    eq(detectViewFreshness(history, 100000), 'insufficient_history');
  });

  test('detectViewFreshness returns unavailable when latest views is null', () => {
    const history: ChannelSnapshot[] = [
      { ts: '2026-05-01', subs: 100000, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
      { ts: '2026-05-07', subs: 100100, views: null, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
    ];
    eq(detectViewFreshness(history, 100000), 'unavailable');
  });

  test('normalizeChannelData marks stale views7d as non-meaningful', () => {
    const snap = {
      channelId: 'UCtest', handle: 'test', title: 'Test', thumbnail: undefined,
      subs: 100000, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0,
      lastUploadAt: '2026-05-05', recentUploads: [],
    };
    const history: ChannelSnapshot[] = [
      { ts: '2026-04-20', subs: 99800, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: '2026-05-05' },
      { ts: '2026-04-25', subs: 99900, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: '2026-05-05' },
      { ts: '2026-05-01', subs: 100000, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: '2026-05-05' },
      { ts: '2026-05-07', subs: 100100, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: '2026-05-05' },
    ];
    const nc = normalizeChannelData(snap, history);
    eq(nc.viewDataFreshness, 'stale');
    // views7d should exist (delta computed) but be non-meaningful
    if (nc.views7d && nc.views7d.meaningful) {
      throw new Error('Stale views7d should be non-meaningful');
    }
  });

  test('normalizeChannelData stale views produce null rawDelta', () => {
    const snap = {
      channelId: 'UCtest', handle: 'test', title: 'Test', thumbnail: undefined,
      subs: 100000, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0,
      lastUploadAt: '2026-05-05', recentUploads: [],
    };
    const history: ChannelSnapshot[] = [
      { ts: '2026-04-20', subs: 99800, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: '2026-05-05' },
      { ts: '2026-04-25', subs: 99900, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: '2026-05-05' },
      { ts: '2026-05-01', subs: 100000, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: '2026-05-05' },
      { ts: '2026-05-07', subs: 100100, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: '2026-05-05' },
    ];
    const nc = normalizeChannelData(snap, history);
    // rawDelta returns null for non-meaningful deltas
    const viewsDelta = rawDelta(nc.views7d);
    eq(viewsDelta, null, 'Stale views should produce null rawDelta');
  });

  return results;
}

export async function GET() {
  const results = runTests();
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return NextResponse.json({
    summary: `${passed} passed, ${failed} failed`,
    allPassed: failed === 0,
    passed,
    failed,
    results,
    timestamp: new Date().toISOString(),
  });
}
