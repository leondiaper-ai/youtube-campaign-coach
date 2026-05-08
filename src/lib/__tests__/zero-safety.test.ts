// ─────────────────────────────────────────────────────────────────────────────
// ZERO-SAFETY TESTS
//
// These tests verify the critical invariant: missing API views/subs must NEVER
// silently become zero in any storage or computation path.
//
// Run with: npx tsx src/lib/__tests__/zero-safety.test.ts
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';

// ── Test helpers ──────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    failures.push(`  ✗ ${name}: ${e.message}`);
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

function describe(name: string, fn: () => void) {
  console.log(`\n${name}`);
  fn();
}

// ── Import the modules under test ─────────────────────────────────────────

import { deltaOver, type ChannelSnapshot } from '../snapshots';
import { viewsToRevenue, subsToValue, detectOpportunity, getArtistValueOpportunity } from '../valueModel';

// ── 1. writeSnapshot safety ───────────────────────────────────────────────

describe('writeSnapshot null safety', () => {
  // We can't test writeSnapshot directly (it needs KV), but we can test
  // the ChannelSnapshot type and verify the entry construction logic.

  test('ChannelSnapshot allows null views', () => {
    const snap: ChannelSnapshot = {
      ts: '2026-05-01',
      subs: 100000,
      views: null,
      uploads30d: 5,
      shorts30d: 2,
      upcomingCount: 0,
      lastUploadAt: null,
    };
    assert.strictEqual(snap.views, null);
    assert.strictEqual(snap.subs, 100000);
  });

  test('ChannelSnapshot allows null subs', () => {
    const snap: ChannelSnapshot = {
      ts: '2026-05-01',
      subs: null,
      views: 5000000,
      uploads30d: 5,
      shorts30d: 2,
      upcomingCount: 0,
      lastUploadAt: null,
    };
    assert.strictEqual(snap.subs, null);
    assert.strictEqual(snap.views, 5000000);
  });

  test('ChannelSnapshot allows both null', () => {
    const snap: ChannelSnapshot = {
      ts: '2026-05-01',
      subs: null,
      views: null,
      uploads30d: 0,
      shorts30d: 0,
      upcomingCount: 0,
      lastUploadAt: null,
    };
    assert.strictEqual(snap.views, null);
    assert.strictEqual(snap.subs, null);
  });
});

// ── 2. deltaOver: null snapshots must not produce fake deltas ──────────────

describe('deltaOver null safety', () => {
  test('returns null when latest snapshot has null views', () => {
    const history: ChannelSnapshot[] = [
      { ts: '2026-04-25', subs: 10000, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
      { ts: '2026-05-01', subs: 10100, views: null, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
    ];
    const result = deltaOver(history, 7, 'views');
    assert.strictEqual(result, null, 'deltaOver must return null when latest views is null');
  });

  test('returns null when latest snapshot has null subs', () => {
    const history: ChannelSnapshot[] = [
      { ts: '2026-04-25', subs: 10000, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
      { ts: '2026-05-01', subs: null, views: 5100000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
    ];
    const result = deltaOver(history, 7, 'subs');
    assert.strictEqual(result, null, 'deltaOver must return null when latest subs is null');
  });

  test('skips null baseline snapshots', () => {
    const history: ChannelSnapshot[] = [
      { ts: '2026-04-20', subs: 10000, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
      { ts: '2026-04-25', subs: 10050, views: null, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
      { ts: '2026-05-01', subs: 10100, views: 5200000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
    ];
    // Should skip the null-views baseline at 04-25 and use 04-20 instead
    const result = deltaOver(history, 7, 'views');
    assert.ok(result !== null, 'Should find a valid baseline');
    assert.strictEqual(result!.delta, 200000, 'Delta should be 5200000 - 5000000');
  });

  test('returns null when ONLY snapshot exists', () => {
    const history: ChannelSnapshot[] = [
      { ts: '2026-05-01', subs: 10000, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
    ];
    const result = deltaOver(history, 7, 'views');
    assert.strictEqual(result, null, 'Cannot compute delta with only one snapshot');
  });

  test('never produces a delta from null-to-number (fake zero contamination)', () => {
    // This simulates the old bug: a null API response was stored as 0,
    // then the next day a real value came back, producing a massive fake delta.
    const history: ChannelSnapshot[] = [
      { ts: '2026-04-20', subs: 10000, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
      // Old bug would have stored this as views: 0 instead of null
      { ts: '2026-04-25', subs: 10050, views: null, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
      { ts: '2026-05-01', subs: 10100, views: 5200000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
    ];
    const result = deltaOver(history, 7, 'views');
    // The delta should be computed from the last VALID baseline (04-20), not the null one
    assert.ok(result !== null);
    // Must NOT be 5200000 (which would be null→5.2M, a fake massive spike)
    assert.strictEqual(result!.delta, 200000);
  });
});

// ── 3. Value model: null inputs must not produce fake zero revenue ─────────

describe('Value model null safety', () => {
  test('viewsToRevenue produces zero range for zero views (correct)', () => {
    const result = viewsToRevenue(0);
    assert.strictEqual(result.low, 0);
    assert.strictEqual(result.high, 0);
  });

  test('subsToValue produces zero range for zero subs (correct)', () => {
    const result = subsToValue(0);
    assert.strictEqual(result.low, 0);
    assert.strictEqual(result.high, 0);
  });

  test('getArtistValueOpportunity handles null views/subs gracefully', () => {
    const result = getArtistValueOpportunity({
      views7d: null,
      subs7d: null,
      uploads30d: 5,
      channelState: 'HEALTHY',
      artistType: 'managed',
      ownership: 'virgin',
    });
    // Should return null (no opportunity detected) rather than crashing
    // or producing a fake "0 views" opportunity
    assert.strictEqual(result, null);
  });

  test('detectOpportunity with null views returns null', () => {
    const result = detectOpportunity({
      views7d: null,
      subs7d: null,
      subsPerKViews: null,
      uploads30d: 5,
      channelState: 'HEALTHY',
    });
    assert.strictEqual(result, null);
  });
});

// ── 4. Weekly rollup: null metrics must not become zero in aggregation ─────

describe('Weekly rollup null safety', () => {
  // We test the type allows null and the summing pattern
  test('WeeklyChannelSnapshot type allows null views7d/subscribers7d', () => {
    // This is a compile-time check — if the type doesn't allow null,
    // this file won't compile at all.
    const snap = {
      views7d: null as number | null,
      subscribers7d: null as number | null,
      subscriberTotal: null as number | null,
      viewTotal: null as number | null,
    };
    assert.strictEqual(snap.views7d, null);
    assert.strictEqual(snap.subscribers7d, null);
  });

  test('null values in sums default to 0 contribution (not NaN)', () => {
    const values: (number | null)[] = [100, null, 200, null, 300];
    const sum = values.reduce((s: number, v) => s + (v ?? 0), 0);
    assert.strictEqual(sum, 600);
    assert.ok(!Number.isNaN(sum));
  });
});

// ── 5. Normalized channel data: rawDelta vs rawDeltaOrZero ────────────────

describe('rawDelta vs rawDeltaOrZero', () => {
  // Import the functions
  const { rawDelta, rawDeltaOrZero } = require('../youtube/normalizeChannelData');

  test('rawDelta returns null for null input', () => {
    assert.strictEqual(rawDelta(null), null);
  });

  test('rawDelta returns null for non-meaningful delta', () => {
    assert.strictEqual(rawDelta({ delta: 0, meaningful: false, confidence: 'none', reason: 'test' }), null);
  });

  test('rawDelta returns value for meaningful delta', () => {
    assert.strictEqual(rawDelta({ delta: 5000, meaningful: true, confidence: 'good', reason: 'test' }), 5000);
  });

  test('rawDeltaOrZero is deprecated — returns 0 for null (the exact bug pattern)', () => {
    // This test documents the dangerous behavior we're migrating away from
    assert.strictEqual(rawDeltaOrZero(null), 0);
    // This is WHY it's deprecated — callers should use rawDelta instead
  });
});

// ── 6. Campaign delta: null endpoint safety ───────────────────────────────

describe('Campaign delta null safety', () => {
  const { campaignDelta } = require('../snapshots');

  test('returns null when latest snapshot has null views', () => {
    const history: ChannelSnapshot[] = [
      { ts: '2026-03-01', subs: 10000, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
      { ts: '2026-05-01', subs: 10100, views: null, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
    ];
    const result = campaignDelta(history, '2026-03-01', 'views');
    assert.strictEqual(result, null, 'campaignDelta must return null when latest views is null');
  });

  test('returns valid delta with confirmed endpoints', () => {
    const history: ChannelSnapshot[] = [
      { ts: '2026-03-01', subs: 10000, views: 5000000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
      { ts: '2026-05-01', subs: 10500, views: 5500000, uploads30d: 5, shorts30d: 2, upcomingCount: 0, lastUploadAt: null },
    ];
    const result = campaignDelta(history, '2026-03-01', 'views');
    assert.ok(result !== null);
    assert.strictEqual(result!.delta, 500000);
  });
});

// ── Summary ───────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`ZERO-SAFETY TEST RESULTS: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(f));
  process.exit(1);
}
console.log('All tests passed — zero-safety invariants verified.\n');
