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
// Framework-free, no runner needed. The suite now also validates the seeded
// research records and the canonical identity map, so a transcription with an
// invented tag, a seed with a fabricated source URL, or an alias pointing at a
// roster slug that no longer exists all fail here rather than showing up later
// as an artist that mysteriously has no needs.
//
// Run: npx tsc src/lib/intelligence/__tests__/matching.test.ts --outDir /tmp/t \
//        --module commonjs --target es2020 --moduleResolution node \
//        --esModuleInterop --skipLibCheck
//      NODE_PATH=./node_modules node -e \
//        "const r=require('/tmp/t/intelligence/__tests__/matching.test.js').runMatchingChecks(); \
//         console.log(r.passed+' passed, '+r.failed+' failed'); r.failures.forEach(f=>console.log(f))"
// Or hit /api/assistant?view=matching-checks, which needs no local setup.
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import {
  NEED_TAGS, isNeedTag, partitionTags, canonicaliseTag, TAG_ALIASES,
  boardEligible, boardBlockers, BOARD_THRESHOLD, type ResearchScores,
} from '../types';
import { SEEDED_DEEP_DIVES, DEEP_DIVE_BY_NAME, normaliseName } from '../deepDives';
import { SEEDED_RESEARCH, boardStatus, verificationOf } from '../research';
import { DECK_TO_ROSTER, deckSlugFor, rosterSlugFor, checkAliases } from '../identity';

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
    const { valid, unknown } = partitionTags(['archive_live', 'synthpop']);
    assert.deepEqual(valid, ['archive_live']);
    assert.deepEqual(unknown, ['synthpop'],
      'unknown tags must be returned, not dropped — a dropped tag is an invisible typo');
  });

  test('an alias resolves to canon and the rewrite is reported', () => {
    const { valid, unknown, aliased } = partitionTags(['premiere_programming', 'longform_event']);
    assert.deepEqual(valid, ['premiere_behaviour', 'long_form_event']);
    assert.deepEqual(unknown, []);
    assert.equal(aliased.length, 2, 'a silent rewrite is its own kind of drift');
  });

  test('spelling is normalised but meaning is not invented', () => {
    assert.equal(canonicaliseTag('ARCHIVE-LIVE'), 'archive_live');
    assert.equal(canonicaliseTag(' Named Series '), 'named_series');
    assert.equal(canonicaliseTag('vibes'), null, 'an unknown tag must not be guessed at');
  });

  test('every alias points at a real tag and is not itself a tag', () => {
    for (const [from, to] of Object.entries(TAG_ALIASES)) {
      assert.ok(isNeedTag(to), `alias ${from} points at "${to}", which is not a need tag`);
      assert.ok(!isNeedTag(from), `"${from}" is both a canonical tag and an alias — one must go`);
    }
  });

  test('performance_as_hero is its own tag, not an alias of archive_live', () => {
    /* Having unused footage and making the live take the release are
       different problems. Collapsing them would make the matcher return
       archive examples for an artist rethinking what a release IS. */
    assert.ok(isNeedTag('performance_as_hero'));
    assert.notEqual(canonicaliseTag('performance_as_hero'), 'archive_live');
  });

  test('duplicate tags collapse rather than double-counting a need', () => {
    const { valid } = partitionTags(['archive_live', 'live_archive', 'ARCHIVE_LIVE']);
    assert.deepEqual(valid, ['archive_live']);
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

  /* ── The research seeds and the board gate ─────────────────────────── */

  test('no seeded research example can reach the board', () => {
    /* Every seed is a human assertion with no evidence and no source link.
       Whatever its scores say, it must not be showable until somebody has
       been and looked. */
    for (const r of SEEDED_RESEARCH) {
      const board = boardStatus(r);
      assert.equal(board.eligible, false, `${r.subject} is board-eligible while unverified`);
      assert.ok(board.blockers.some(b => /verif/i.test(b)), `${r.subject} does not cite verification as a blocker`);
    }
  });

  test('a seed with perfect scores is still blocked, and blocked on verification', () => {
    const wetleg = SEEDED_RESEARCH.find(r => r.subject === 'Wet Leg')!;
    assert.deepEqual(wetleg.scores, { mechanicValue: 3, culturalRelevance: 3, visualBoardValue: 3 });
    assert.equal(boardEligible(wetleg.scores), true, 'the scores alone should pass');
    assert.equal(boardStatus(wetleg).eligible, false, 'the record should not');
  });

  test('every seed states specific things to check, not "verify this"', () => {
    for (const r of SEEDED_RESEARCH) {
      assert.ok(r.needsVerification.length >= 2,
        `${r.subject} has fewer than two verification questions`);
      for (const q of r.needsVerification) {
        assert.ok(q.length > 25, `${r.subject}: "${q}" is too vague to action`);
      }
    }
  });

  test('no seed carries an invented source URL or fabricated evidence', () => {
    for (const r of SEEDED_RESEARCH) {
      assert.deepEqual(r.sourceUrls, [], `${r.subject} has a source URL nobody retrieved`);
      assert.deepEqual(r.evidence, [], `${r.subject} has evidence nobody observed`);
      assert.equal(verificationOf(r), 'UNVERIFIED');
      assert.ok(/ASSERTED, NOT YET OBSERVED/.test(r.behaviourObserved),
        `${r.subject} describes unobserved behaviour as if it were observed`);
    }
  });

  test('seeded tags are all recognised, so every seed is matchable', () => {
    for (const r of SEEDED_RESEARCH) {
      if (r.status === 'WATCHLIST') continue;
      const { valid, unknown } = partitionTags(r.usefulFor ?? []);
      assert.deepEqual(unknown, [], `${r.subject} carries unknown tags`);
      assert.ok(valid.length > 0, `${r.subject} has no usable tags and can never be matched`);
    }
  });

  /* ── Canonical identity ────────────────────────────────────────────── */

  test('every Deep Dive maps to exactly one roster slug', () => {
    for (const slug of Object.keys(SEEDED_DEEP_DIVES)) {
      assert.ok(DECK_TO_ROSTER[slug], `no canonical roster slug for Deep Dive "${slug}"`);
    }
  });

  test('the identity map round-trips in both directions', () => {
    for (const [deck, rosterSlug] of Object.entries(DECK_TO_ROSTER)) {
      assert.equal(deckSlugFor(deck), deck);
      assert.equal(deckSlugFor(rosterSlug), deck, `${rosterSlug} does not resolve back to ${deck}`);
      assert.equal(rosterSlugFor(deck), rosterSlug);
    }
  });

  test('the IDLES case specifically, which is what broke', () => {
    assert.equal(rosterSlugFor('idles'), 'idlesband');
    assert.equal(deckSlugFor('idlesband'), 'idles');
    assert.equal(rosterSlugFor('IDLES'), 'idlesband');
  });

  test('checkAliases reports a broken mapping rather than hiding it', () => {
    const withMissing = checkAliases([{ slug: 'chvrches', name: 'CHVRCHES' }]);
    const broken = withMissing.filter(c => c.problem);
    assert.ok(broken.length > 0, 'a roster missing five of six artists must report problems');
    assert.ok(broken.every(b => /not on the roster/i.test(b.problem!)));
  });

  test('an unknown artist resolves to nothing rather than to something near', () => {
    assert.equal(deckSlugFor('some band we do not have'), null);
    assert.equal(rosterSlugFor('chv'), null, 'a prefix must not resolve — near matches are how the wrong artist gets analysed');
  });

  test('a watchlist seed is never presented as a proof candidate', () => {
    /* It is board-blocked either way. The point is that appearing in a
       match list alongside real candidates is enough for the distinction
       to get lost by whoever reads it. */
    const wl = SEEDED_RESEARCH.filter(r => r.status === 'WATCHLIST');
    assert.ok(wl.length > 0, 'the fixture assumes at least one watchlist seed');
    for (const r of wl) {
      assert.equal(boardStatus(r).eligible, false);
      assert.ok(boardStatus(r).blockers.some(b => /watchlist/i.test(b)));
      assert.ok(/not been verified|not assessed/i.test(r.whyNotObvious + r.limitations),
        `${r.subject} does not say it is unassessed`);
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
