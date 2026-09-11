// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGN PROGRESS BOUNDARY TESTS
//
// The failure this layer invites is flattering and easy: Watcher sees two
// Shorts appear, the system records "the recommendation was implemented", and
// three months later we are telling YouTube we caused something we merely
// observed. Every test below exists to make that impossible rather than
// discouraged.
//
// Run: npx tsc src/lib/intelligence/__tests__/progress.test.ts --outDir /tmp/p \
//        --module commonjs --target es2020 --moduleResolution node \
//        --esModuleInterop --skipLibCheck
//      NODE_PATH=./node_modules node -e \
//        "const r=require('/tmp/p/intelligence/__tests__/progress.test.js').runProgressChecks(); \
//         console.log(r.passed+' passed, '+r.failed+' failed'); r.failures.forEach(f=>console.log(f))"
// Or hit /api/assistant?view=progress-checks.
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import {
  mintRecommendationId, normaliseRecommendation, listRecommendations,
} from '../recommendationId';
import {
  SEEDED_PROGRESS, PROGRESS_STATES, HUMAN_ONLY_STATES, requiresHuman,
} from '../progressStore';
import { buildFreshnessReport, checkClaim } from '../freshness';
import { SEEDED_DEEP_DIVES } from '../deepDives';
import type { DeepDiveEvidence } from '../types';

export interface CheckResult { passed: number; failed: number; failures: string[] }

export function runProgressChecks(): CheckResult {
  let passed = 0;
  let failed = 0;
  const failures: string[] = [];
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; }
    catch (e) { failed++; failures.push(`${name}: ${e instanceof Error ? e.message : String(e)}`); }
  };

  const chv = SEEDED_DEEP_DIVES['chvrches'];

  /* ── Stable ids ────────────────────────────────────────────────────── */

  test('an id survives punctuation, casing and dash style', () => {
    const base = 'Give each hero a second destination inside 7-14 days.';
    const id = mintRecommendationId('chvrches', base);
    for (const variant of [
      'Give each hero a second destination inside 7–14 days',
      'give EACH hero a second destination inside 7-14 days!!',
      '  Give each hero a second destination inside 7-14 days  ',
    ]) {
      assert.equal(mintRecommendationId('chvrches', variant), id, `variant broke the id: "${variant}"`);
    }
  });

  test('an id survives a grammatical word swap', () => {
    /* "each" → "every" is the kind of edit a re-transcription makes without
       changing what anybody is being asked to do. */
    assert.equal(
      mintRecommendationId('chvrches', 'Give each hero a second destination inside 7-14 days.'),
      mintRecommendationId('chvrches', 'Give every hero a second destination inside 7-14 days.'),
    );
  });

  test('an id does NOT survive a change of substance', () => {
    assert.notEqual(
      mintRecommendationId('chvrches', 'Give each hero a second destination inside 7-14 days.'),
      mintRecommendationId('chvrches', 'Give each hero a second destination inside 30 days.'),
      'a recommendation whose meaning changed must mint a new id, or a team\'s "we did this" '
      + 'would silently carry across to something else',
    );
  });

  test('ids are namespaced per artist', () => {
    const point = 'Reopen the channel before any announcement.';
    assert.notEqual(mintRecommendationId('chvrches', point), mintRecommendationId('idles', point));
  });

  test('normalisation strips grammar but keeps every content word', () => {
    const n = normaliseRecommendation('Programme the archive live rather than shooting more of it.');
    for (const w of ['programme', 'archive', 'live', 'rather', 'shooting', 'more']) {
      assert.ok(n.includes(w), `content word "${w}" was stripped`);
    }
    assert.ok(!n.includes(' the '), 'grammatical words should be removed');
  });

  test('every Deep Dive mints unique ids with no collisions', () => {
    for (const [slug, dive] of Object.entries(SEEDED_DEEP_DIVES)) {
      const recs = listRecommendations(dive);
      const ids = new Set(recs.map(r => r.id));
      assert.equal(ids.size, recs.length, `${slug} has colliding recommendation ids`);
      assert.ok(recs.length > 0, `${slug} produced no actionable recommendations`);
      for (const r of recs) {
        assert.ok(r.deepDiveVersion.length > 0, `${slug}: recommendation with no version`);
        assert.equal(r.artistSlug, dive.artistSlug);
      }
    }
  });

  test('gaps are not treated as recommendations', () => {
    /* A gap is a problem statement. "gap: IMPLEMENTED" is nonsense. */
    const recs = listRecommendations(chv);
    const gapPoints = new Set(chv.channelGaps.map(g => g.point));
    for (const r of recs) {
      assert.ok(!gapPoints.has(r.point), `"${r.point}" is a gap and should not be trackable`);
    }
  });

  /* ── Provenance ────────────────────────────────────────────────────── */

  test('IMPLEMENTED, RESULT and LEARNED are human-only', () => {
    assert.deepEqual(HUMAN_ONLY_STATES, ['IMPLEMENTED', 'RESULT', 'LEARNED']);
    for (const s of HUMAN_ONLY_STATES) assert.ok(requiresHuman(s));
    for (const s of ['NOT_STARTED', 'PLANNED', 'OBSERVING'] as const) {
      assert.ok(!requiresHuman(s), `${s} should not require a human assertion`);
    }
  });

  test('OBSERVING is reachable without a human, IMPLEMENTED is not', () => {
    /* OBSERVING says "we are watching". IMPLEMENTED says "the team did it".
       Only the second is a claim about intent, which is why only the second
       is gated. */
    assert.ok(!requiresHuman('OBSERVING'));
    assert.ok(requiresHuman('IMPLEMENTED'));
  });

  test('the lifecycle is exactly the six agreed states', () => {
    assert.deepEqual(PROGRESS_STATES,
      ['NOT_STARTED', 'PLANNED', 'IMPLEMENTED', 'OBSERVING', 'RESULT', 'LEARNED']);
  });

  /* ── The CHVRCHES seed ─────────────────────────────────────────────── */

  test('the CHVRCHES progress record is attributed to a named human', () => {
    const recs = SEEDED_PROGRESS['chvrches'];
    assert.ok(recs?.length, 'no seeded CHVRCHES progress');
    for (const r of recs) {
      assert.equal(r.statedBy, 'Leon');
      assert.ok(!/grok|model|system|watcher/i.test(r.statedBy));
      assert.ok(r.note.length > 40, 'the note must say what was actually done');
    }
  });

  test('uncertain timing is preserved, not invented', () => {
    const r = SEEDED_PROGRESS['chvrches'][0];
    assert.equal(r.statedAtPrecision, 'month');
    assert.match(r.statedAt, /^\d{4}-\d{2}$/,
      'the instruction date is not recorded, so it must stay at month precision');
  });

  test('the seeded record points at real Deep Dive recommendations', () => {
    const ids = new Set(listRecommendations(chv).map(r => r.id));
    for (const p of SEEDED_PROGRESS['chvrches']) {
      assert.ok(ids.has(p.recommendationId),
        `${p.recommendationId} does not match any CHVRCHES recommendation — the join is broken`);
    }
  });

  test('uploads are attached as evidence, never as the implementation claim', () => {
    for (const p of SEEDED_PROGRESS['chvrches']) {
      const uploads = p.evidenceRefs.filter(e => e.kind === 'upload');
      assert.ok(uploads.length >= 2, 'the two Shorts should be attached');
      /* The state came from the history entry written by Leon, and the
         uploads sit alongside it. If a record ever reaches IMPLEMENTED with
         no human transition, the intent claim came from nowhere. */
      const humanTransition = p.history.find(h => h.to === 'IMPLEMENTED');
      assert.ok(humanTransition, 'IMPLEMENTED must appear in the history with an author');
      assert.equal(humanTransition!.statedBy, 'Leon');
    }
  });

  test('the record is OBSERVING, not RESULT — two days is not an outcome', () => {
    for (const p of SEEDED_PROGRESS['chvrches']) {
      assert.equal(p.state, 'OBSERVING');
      assert.notEqual(p.state, 'RESULT');
      assert.notEqual(p.state, 'LEARNED');
    }
  });

  /* ── The Deep Dive is untouched ────────────────────────────────────── */

  test('progress does not alter the Deep Dive', () => {
    /* The thesis still describes a dormant channel, because that is what we
       saw on 26 August. Rewriting it would destroy the baseline that
       progress is measured against. */
    assert.match(chv.coreThesis, /dormant/i);
    assert.equal(chv.dataCapturedAt, '2026-08-26');
    assert.ok(chv.keyEvidence.some(e => /340 days/.test(e.claim)),
      'the 340-day claim must remain in the Deep Dive exactly as recorded');
  });

  /* ── Freshness ─────────────────────────────────────────────────────── */

  const dormancyClaim: DeepDiveEvidence = {
    claim: '340 days since the last upload as at 26 Aug 2026 (last upload 20 Sep 2025).',
    evidenceClass: 'OBSERVED', trust: 'TRUSTED',
    sourceRef: 'test', observedAt: '2026-08-26',
  };

  test('a reset dormancy clock reads CHANGED', () => {
    const c = checkClaim(dormancyClaim, { lastUploadAt: '2026-09-10T17:14:34Z' }, '2026-09-11T00:00:00Z');
    assert.ok(c);
    assert.equal(c!.verdict, 'CHANGED');
    assert.match(c!.message, /campaign has since moved/i);
    assert.doesNotMatch(c!.message, /wrong|incorrect|invalid/i,
      'the message must not say the Deep Dive is wrong — it was true at its capture date');
  });

  test('continued dormancy reads CURRENT', () => {
    /* Still silent: last upload is the same one the deck recorded. */
    const c = checkClaim(dormancyClaim, { lastUploadAt: '2025-09-20T00:00:00Z' }, '2026-09-11T00:00:00Z');
    assert.ok(c);
    assert.equal(c!.verdict, 'CURRENT');
  });

  test('an unknowable claim reads UNKNOWN, never CURRENT', () => {
    const c = checkClaim(dormancyClaim, { lastUploadAt: null }, '2026-09-11T00:00:00Z');
    assert.ok(c);
    assert.equal(c!.verdict, 'UNKNOWN');
  });

  test('a HUMAN interpretation is never freshness-checked', () => {
    /* An analyst's reading of a moment does not become false because a
       number moved. Only OBSERVED and DERIVED claims are candidates. */
    const human: DeepDiveEvidence = {
      claim: 'The opportunity is the weeks between the heroes.',
      evidenceClass: 'HUMAN', trust: 'TRUSTED', sourceRef: 'deck', observedAt: '2026-08-26',
    };
    assert.equal(checkClaim(human, { lastUploadAt: '2026-09-10T00:00:00Z' }, '2026-09-11T00:00:00Z'), null);
  });

  test('structural campaign claims are not flagged as stale', () => {
    /* "0 of 4 heroes had a 7-14 day asset" is about a campaign that has
       already happened and cannot go out of date. Flagging it would be
       noise, and noise trains people to ignore warnings. */
    const structural: DeepDiveEvidence = {
      claim: '0 of 4 Screen Violence heroes had a meaningful asset in the 7-14 day window.',
      evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck', observedAt: '2026-08-26',
    };
    assert.equal(checkClaim(structural, { lastUploadAt: '2026-09-10T00:00:00Z', subs: 550000 }, '2026-09-11T00:00:00Z'), null);
  });

  test('the freshness report always carries guidance against discarding the deck', () => {
    const r = buildFreshnessReport(chv, { lastUploadAt: '2026-09-10T17:14:34Z', subs: 550000, views: 319707836 }, '2026-09-11T00:00:00Z');
    assert.equal(r.overall, 'CHANGED');
    assert.ok(r.warnings.length > 0);
    assert.match(r.guidance, /fixed strategic baseline/i);
    assert.match(r.guidance, /Do not remove a strategic need/i);
  });

  test('a report with nothing checkable says so rather than claiming CURRENT', () => {
    const r = buildFreshnessReport(chv, {}, '2026-08-27T00:00:00Z');
    assert.ok(r.checks.every(c => c.verdict !== 'CURRENT') || r.overall !== 'CURRENT',
      'no snapshot must not silently produce a clean bill of health');
  });

  return { passed, failed, failures };
}
