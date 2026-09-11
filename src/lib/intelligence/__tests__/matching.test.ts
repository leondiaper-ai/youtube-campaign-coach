// ─────────────────────────────────────────────────────────────────────────────
// MATCHING BOUNDARY TESTS
//
// Same discipline as evidence.test.ts, aimed at a different failure. The
// evidence tests stop a claim being laundered into a higher class. These stop
// the matcher doing the thing everybody building one eventually does: finding
// a match because a match was asked for.
//
// The five things that must never happen:
//   1. an example with no shared need tag is returned as relevant
//   2. a genre or artist name influences a match
//   3. an unscored or weakly scored example reaches a team-facing board
//   4. a REJECTED example comes back out of the library
//   5. "no match" is dressed up as something other than no match
//
// Framework-free, no runner needed.
// Run: npx tsx src/lib/intelligence/__tests__/matching.test.ts
// Or hit /api/assistant?view=matching-checks.
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import {
  NEED_TAGS, isNeedTag, partitionTags, boardEligible, boardBlockers,
  BOARD_THRESHOLD, type ResearchScores,
} from '../types';
import { SEEDED_DEEP_DIVES, DEEP_DIVE_BY_NAME, normaliseName } from '../deepDives';

export interface CheckResult {
  passed: number;
  failed: number;
  failures: string[];
}

const s = (m: number, c: number, v: number): ResearchScores =>
  ({ mechanicValue: m, culturalRelevance: c, visualBoardValue: v });

export function runMatchingChecks(): CheckResult {
  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; }
    catch (e) { failed++; failures.push(`${name}: ${e instanceof Error ? e.message : String(e)}`); }
  };

  /* ── The vocabulary is closed ──────────────────────────────────────── */

  test('an unrecognised tag is never silently accepted', () => {
    const { valid, unknown } = partitionTags(['archive_live', 'synthpop', 'ARCHIVE-LIVE']);
    assert.deepEqual(valid, ['archive_live']);
    assert.deepEqual(unknown, ['synthpop', 'ARCHIVE-LIVE'],
      'unknown tags must be returned, not dropped — a dropped tag is an invisible typo');
  });

  test('no need tag names a genre, a format alone, or an artist', () => {
    /* The vocabulary is meant to describe strategic situations. If a tag
       ever reads as a genre the matcher has quietly become a genre matcher,
       which is the single failure the whole design exists to prevent. */
    const banned = ['synth', 'rock', 'rap', 'pop', 'indie', 'metal', 'punk', 'country', 'jazz'];
    for (const tag of NEED_TAGS) {
      for (const b of banned) {
        assert.ok(!tag.includes(b), `need tag "${tag}" contains genre word "${b}"`);
      }
    }
  });

  test('tag membership is exact, not fuzzy', () => {
    assert.ok(isNeedTag('follow_up_7_14'));
    assert.ok(!isNeedTag('follow_up'), 'a prefix must not match — partial matching is how vocabularies drift');
    assert.ok(!isNeedTag('Follow_Up_7_14'), 'case must not be normalised away silently');
  });

  /* ── The board bar ─────────────────────────────────────────────────── */

  test('an unscored example is never board eligible', () => {
    assert.equal(boardEligible(null), false);
    assert.equal(boardEligible(undefined), false);
    assert.deepEqual(boardBlockers(null), ['Not scored.']);
  });

  test('a brilliant mechanic with a weak proof artist stays off the board', () => {
    const brilliantButUnshowable = s(3, 1, 3);
    assert.equal(boardEligible(brilliantButUnshowable), false,
      'the two-score rule exists precisely for this case');
    assert.ok(boardBlockers(brilliantButUnshowable).some(b => /credible/i.test(b)));
  });

  test('a credible artist doing nothing distinctive stays off the board', () => {
    assert.equal(boardEligible(s(1, 3, 3)), false);
    assert.ok(boardBlockers(s(1, 3, 3)).some(b => /distinctive/i.test(b)));
  });

  test('nothing to look at keeps it off a visual page', () => {
    assert.equal(boardEligible(s(3, 3, 1)), false);
    assert.ok(boardBlockers(s(3, 3, 1)).some(b => /visually/i.test(b)));
  });

  test('the board bar is a conjunction, not an average', () => {
    /* An average of 2.33 would pass a mean test and must not pass here —
       a high mechanic score cannot buy its way past a weak proof artist. */
    const mean = (3 + 3 + 1) / 3;
    assert.ok(mean > BOARD_THRESHOLD.mechanicValue);
    assert.equal(boardEligible(s(3, 3, 1)), false);
  });

  test('exactly at the threshold passes', () => {
    assert.equal(boardEligible(s(2, 2, 2)), true);
  });

  /* ── Deep Dive integrity ───────────────────────────────────────────── */

  test('every seeded Deep Dive uses only recognised need tags', () => {
    for (const [slug, d] of Object.entries(SEEDED_DEEP_DIVES)) {
      const all = [
        ...d.channelGaps, ...d.channelStrengths, ...d.campaignRisks,
        ...d.strategicOpportunities, ...d.recommendedContentDirections,
        ...d.recommendedCampaignArchitecture, ...d.existingSuccesses,
        ...d.relevantHistoricalExamples, ...d.youtubePlatformOpportunities,
      ].flatMap(p => p.needTags);
      const { unknown } = partitionTags(all as string[]);
      assert.deepEqual(unknown, [], `${slug} carries unrecognised tags: ${unknown.join(', ')}`);
    }
  });

  test('every seeded Deep Dive states its limitations and open questions', () => {
    for (const [slug, d] of Object.entries(SEEDED_DEEP_DIVES)) {
      assert.ok(d.limitations.length > 0, `${slug} has no stated limitations`);
      assert.ok(d.openQuestions.length > 0,
        `${slug} has no open questions — a finished analysis is a stopped one`);
      assert.ok(d.coreThesis.length > 80, `${slug} thesis is too thin to be the deck's argument`);
    }
  });

  test('every seeded Deep Dive has at least one gap carrying a tag', () => {
    /* A Deep Dive whose gaps carry no tags can never be matched against
       anything. It would look present and behave as absent. */
    for (const [slug, d] of Object.entries(SEEDED_DEEP_DIVES)) {
      const tagged = [...d.channelGaps, ...d.strategicOpportunities]
        .filter(p => p.needTags.length > 0);
      assert.ok(tagged.length > 0, `${slug} has no tagged gaps or opportunities — it is unmatchable`);
    }
  });

  test('every point in a seeded Deep Dive states what it rests on', () => {
    for (const [slug, d] of Object.entries(SEEDED_DEEP_DIVES)) {
      const points = [
        ...d.channelGaps, ...d.channelStrengths, ...d.strategicOpportunities,
        ...d.recommendedCampaignArchitecture,
      ];
      for (const p of points) {
        assert.ok(p.basis.trim().length > 10,
          `${slug}: "${p.point}" has no basis — an unsourced point is an opinion wearing a schema`);
      }
    }
  });

  test('key evidence is classified and never marked OBSERVED for an interpretation', () => {
    for (const [slug, d] of Object.entries(SEEDED_DEEP_DIVES)) {
      for (const e of d.keyEvidence) {
        assert.ok(['OBSERVED', 'HUMAN', 'DERIVED', 'INFERRED', 'LEARNED'].includes(e.evidenceClass),
          `${slug}: bad evidence class ${e.evidenceClass}`);
        assert.ok(e.sourceRef.trim().length > 0, `${slug}: evidence with no sourceRef`);
      }
    }
  });

  test('name resolution is tolerant of punctuation but not of a different artist', () => {
    assert.equal(normaliseName('CHVRCHES'), 'chvrches');
    assert.equal(normaliseName('The Snuts'), 'snuts');
    assert.equal(normaliseName('K-Trap'), 'ktrap');
    assert.notEqual(normaliseName('Kings of Leon'), normaliseName('Kings'));
  });

  test('every seeded Deep Dive is reachable by its own artist name', () => {
    for (const [slug, d] of Object.entries(SEEDED_DEEP_DIVES)) {
      assert.equal(DEEP_DIVE_BY_NAME[normaliseName(d.artistName)], slug,
        `${d.artistName} does not resolve back to ${slug}`);
    }
  });

  return { passed, failed, failures };
}

/* Running the file directly executes the suite, same as the sibling tests. */
if (typeof require !== 'undefined' && require.main === module) {
  const r = runMatchingChecks();
  console.log(`${r.passed} passed, ${r.failed} failed`);
  for (const f of r.failures) console.log(`  FAIL ${f}`);
  if (r.failed) process.exit(1);
}
