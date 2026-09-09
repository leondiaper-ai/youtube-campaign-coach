// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE BOUNDARY TESTS
//
// These do not test that the code works. They test that the code cannot
// quietly do the eight things we have decided it must never do — because each
// of those failures is invisible in a single output and becomes organisational
// knowledge if it recurs.
//
// Framework-free, matching zero-safety.test.ts. There is no test runner in
// this repo, and a test that needs one installed is a test nobody runs.
//
// Run with: npx tsx src/lib/knowledge/__tests__/evidence.test.ts
// Or hit /api/assistant?view=boundary-checks, which executes the same suite.
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import {
  observed, derived, human, inferred, gate, capConfidence, applyFreshness,
  assertNoSilentPromotion, assertAllClassified, BOUNDARY_RULES,
  type EvidenceRecord,
} from '../evidence';

export interface CheckResult {
  passed: number;
  failed: number;
  failures: string[];
}

export function runBoundaryChecks(): CheckResult {
  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; }
    catch (e) { failed++; failures.push(`${name}: ${e instanceof Error ? e.message : String(e)}`); }
  };

  /* ── Promotion: the rule the other seven depend on ─────────────────── */

  test('model-sourced evidence cannot be classed OBSERVED', () => {
    const bad: EvidenceRecord = {
      claim: 'Live is deliberately embedded in the campaign',
      evidenceClass: 'OBSERVED', trust: 'TRUSTED',
      sourceRef: 'coach:overview:amyl', observedAt: null,
    };
    assert.throws(() => assertNoSilentPromotion(bad), /promotion violation/i);
  });

  test('model-sourced evidence cannot be classed HUMAN', () => {
    const bad: EvidenceRecord = {
      claim: 'The team decided to hold the single',
      evidenceClass: 'HUMAN', trust: 'TRUSTED',
      sourceRef: 'grok-4', observedAt: null,
    };
    assert.throws(() => assertNoSilentPromotion(bad));
  });

  test('the same claim is fine when classed INFERRED', () => {
    const ok = inferred('Live is deliberately embedded', 'coach:overview:amyl');
    assert.doesNotThrow(() => assertNoSilentPromotion(ok));
    assert.equal(ok.evidenceClass, 'INFERRED');
  });

  test('an inference is never TRUSTED', () => {
    assert.equal(inferred('anything at all', 'model').trust, 'AMBIGUOUS');
  });

  test('a correctly classified set passes wholesale', () => {
    assert.doesNotThrow(() => assertAllClassified([
      observed('Hero published 2026-08-06', 'video:abc', '2026-08-06'),
      derived('Support formats: lyric, bts', 'buildProfile'),
      human('Album due 2026-09-18', 'planStore:ezra'),
      inferred('Support is thinner this release', 'coach'),
    ]));
  });

  /* ── The gate ──────────────────────────────────────────────────────── */

  test('INVALID is dropped, everything else survives', () => {
    const g = gate([
      observed('a', 'video:1', '2026-09-01'),
      { claim: 'b', evidenceClass: 'DERIVED', trust: 'INVALID', sourceRef: 'x', observedAt: null, limitation: 'no data' },
      derived('c', 'y', 'PARTIAL', 'only 3 uploads'),
    ]);
    assert.equal(g.usable.length, 2);
    assert.equal(g.rejected.length, 1);
  });

  test('a PARTIAL limitation is carried through, not hidden', () => {
    const g = gate([derived('Hero identified', 'buildProfile', 'PARTIAL', 'only 3 uploads in window')]);
    assert.equal(g.usable.length, 1);
    assert.ok(g.caveats[0].includes('only 3 uploads in window'));
  });

  test('a basis containing an inference is not high-confidence', () => {
    assert.equal(gate([observed('a', 'v', null), inferred('b', 'model')]).highConfidenceBasis, false);
    assert.equal(gate([observed('a', 'v', null), derived('b', 'calc')]).highConfidenceBasis, true);
  });

  /* ── Confidence ────────────────────────────────────────────────────── */

  test('HIGH is capped to MEDIUM on an ambiguous basis', () => {
    const c = capConfidence('HIGH', gate([inferred('a plausible reading', 'model')]));
    assert.equal(c.confidence, 'MEDIUM');
    assert.equal(c.capped, true);
  });

  test('HIGH is capped to MEDIUM on stale evidence', () => {
    const stale = applyFreshness(observed('Subscribers 1.2M', 'snap:UC1', '2026-01-01'), 'snapshot');
    assert.equal(stale.trust, 'STALE');
    assert.equal(capConfidence('HIGH', gate([stale])).confidence, 'MEDIUM');
  });

  test('HIGH survives a clean basis', () => {
    const g = gate([observed('Hero on 2026-08-06', 'video:abc', '2026-08-06')]);
    assert.equal(capConfidence('HIGH', g).confidence, 'HIGH');
  });

  test('confidence is never raised', () => {
    assert.equal(capConfidence('LOW', gate([observed('a', 'v', null)])).confidence, 'LOW');
  });

  /* ── Freshness ─────────────────────────────────────────────────────── */

  test('a recent observation stays trusted', () => {
    const recent = new Date(Date.now() - 3 * 86_400_000).toISOString();
    assert.equal(applyFreshness(observed('x', 'v', recent), 'snapshot').trust, 'TRUSTED');
  });

  test('a stale observation keeps its class', () => {
    const old = new Date(Date.now() - 200 * 86_400_000).toISOString();
    const r = applyFreshness(observed('x', 'v', old), 'snapshot');
    assert.equal(r.trust, 'STALE');
    assert.equal(r.evidenceClass, 'OBSERVED');
  });

  test('undated evidence cannot be marked stale', () => {
    assert.equal(applyFreshness(derived('computed', 'calc'), 'snapshot').trust, 'TRUSTED');
  });

  /* ── The written rules ─────────────────────────────────────────────── */

  test('all eight boundary rules are present with reasons', () => {
    assert.equal(BOUNDARY_RULES.length, 8);
    for (const r of BOUNDARY_RULES) {
      assert.ok(r.rule.length > 10, `rule too short: ${r.id}`);
      assert.ok(r.why.length > 20, `reason too short: ${r.id}`);
    }
  });

  test('the rule the other seven depend on is present', () => {
    assert.ok(BOUNDARY_RULES.some(r => r.id === 'inference-not-fact'));
  });

  return { passed, failed, failures };
}

/* Executed directly, print and exit non-zero on failure. */
if (typeof require !== 'undefined' && require.main === module) {
  const r = runBoundaryChecks();
  console.log(`\nEvidence boundaries: ${r.passed} passed, ${r.failed} failed`);
  for (const f of r.failures) console.error(`  FAIL ${f}`);
  if (r.failed) process.exit(1);
}
