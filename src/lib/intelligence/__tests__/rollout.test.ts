// ─────────────────────────────────────────────────────────────────────────────
// ROLLOUT BOUNDARY TESTS
//
// The Ideas tab is the surface most likely to drift into fiction, because an
// empty one looks broken and a full one looks impressive. Every test here
// exists to make the flattering failure impossible rather than discouraged:
// an unverified example rendered as evidence, a possibility rendered as a
// plan, a spine that says one thing while the rollout says another, or a
// research question that stays pointed at first hero forever because it was
// typed into a template.
//
// Hit /api/assistant?view=rollout-checks.
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import { ROLLOUT_PLANS, buildRollout, type RolloutStatus } from '../rollout';
import { SEEDED_DEEP_DIVES } from '../deepDives';
import { SEEDED_RESEARCH, boardStatus } from '../research';
import { listRecommendations, mintRecommendationId } from '../recommendationId';
import { canonicaliseTag } from '../types';
import type { CampaignProgressReport, RecommendationProgressView } from '../campaignProgress';
import type { CaseStudy } from '../../knowledge/types';
import { validateRun, type ResearchRun } from '../researchRuns';
import { INTEL_SPECS, INTEL_WRITE_TOOLS } from '../tools';

export interface CheckResult { passed: number; failed: number; failures: string[] }

/* A progress report built in memory, so the suite never needs Redis and can
   put the campaign into states nobody has reached yet. */
function fakeReport(states: Record<string, RolloutStatusSource> = {}): CampaignProgressReport {
  const dive = SEEDED_DEEP_DIVES['chvrches'];
  const recs = listRecommendations(dive);
  const views: RecommendationProgressView[] = recs.map(r => {
    const s = states[r.id];
    return {
      recommendation: r,
      status: s?.status ?? 'NOT_STARTED',
      statusProvenance: s ? s.provenance : 'DEFAULT',
      implementation: s?.statedBy
        ? { statedBy: s.statedBy, statedAt: '2026-09', precision: 'month', note: s.note ?? 'a note long enough to be real', history: [] }
        : null,
      observedSince: null,
      result: { available: false, because: 'test' },
      learning: [],
      nextWatch: 'nothing',
    } as RecommendationProgressView;
  });
  return {
    artistSlug: 'chvrches',
    artistName: 'CHVRCHES',
    deepDive: { title: dive.title, version: 'v', capturedAt: dive.dataCapturedAt, thesis: dive.coreThesis, deckUrl: dive.deckUrl, immutable: true },
    freshness: null,
    recommendations: views,
    summary: { total: views.length, notStarted: 0, inFlight: 0, withResult: 0, learned: 0 },
    humanContext: [],
    watcherReads: { latest: null, priorCount: 0, coachOpen: [] },
    seeingElsewhere: { ready: false, note: '', verifiedCount: 0, candidateCount: 0 },
    limitations: [],
    generatedAt: new Date().toISOString(),
  };
}

interface RolloutStatusSource {
  status: RecommendationProgressView['status'];
  provenance: 'HUMAN' | 'DEFAULT';
  statedBy?: string;
  note?: string;
}

const ID = (point: string) => mintRecommendationId('chvrches', point);

const WAKE = 'Pre-campaign: reopen the channel with catalogue, archive live, Community and playlists, before any announcement.';
const HERO = 'Single: official music video with the pre-party Premiere they already run.';
const SECOND = '+7-14 days: a second destination — lyric video, live, or a performance while attention is still up.';

export function runRolloutChecks(): CheckResult {
  let passed = 0; let failed = 0;
  const failures: string[] = [];
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; }
    catch (e) { failed++; failures.push(`${name}: ${e instanceof Error ? e.message : String(e)}`); }
  };

  const plan = ROLLOUT_PLANS['chvrches'];
  const seeds = SEEDED_RESEARCH as unknown as CaseStudy[];

  /* ── The join ──────────────────────────────────────────────────────── */

  test('every Deep-Dive-anchored item resolves to a real recommendation', () => {
    const ids = new Set(listRecommendations(SEEDED_DEEP_DIVES['chvrches']).map(r => r.id));
    for (const p of plan) {
      if (!p.deepDivePoint) continue;
      assert.ok(ids.has(ID(p.deepDivePoint)),
        `"${p.title}" is anchored to text that mints an id no recommendation has — the join is broken `
        + 'and the item would render with no evidence for the wrong reason');
    }
  });

  test('the rollout reports a broken join rather than rendering a quiet blank', () => {
    /* Strip every recommendation out of the report. The items must survive
       and the limitation must say why their evidence is gone. */
    const r = fakeReport();
    r.recommendations = [];
    const ro = buildRollout(r, []);
    assert.equal(ro.items.length, plan.length, 'items disappeared when the join failed');
    assert.ok(ro.limitations.some(l => /no longer resolves/.test(l)),
      'a failed join must be stated, not absorbed');
  });

  test('every need tag in the plan is in the closed vocabulary', () => {
    for (const p of plan) {
      for (const t of p.needTags) {
        assert.equal(canonicaliseTag(t), t,
          `"${t}" on "${p.title}" is not canonical — the item would never match research`);
      }
    }
  });

  /* ── Spine and Ideas cannot disagree ───────────────────────────────── */

  test('the spine is derived from the rollout, item for item', () => {
    const ro = buildRollout(fakeReport(), []);
    const spine = ro.items.filter(i => i.spine);
    assert.equal(spine.length, 4, 'the cover shows four stages');
    for (const s of spine) assert.ok(s.spineStatus, `${s.title} has no spine status`);
    for (const o of ro.items.filter(i => !i.spine)) {
      assert.equal(o.spineStatus, null, `${o.title} is not a spine item and must not carry a spine status`);
    }
  });

  test('exactly one spine item is NEXT', () => {
    const ro = buildRollout(fakeReport({
      [ID(WAKE)]: { status: 'OBSERVING', provenance: 'HUMAN', statedBy: 'Leon' },
    }), []);
    const next = ro.items.filter(i => i.spineStatus === 'NEXT');
    assert.equal(next.length, 1, 'a campaign has one next thing, not none and not two');
    assert.equal(next[0].title, 'First hero');
    assert.equal(ro.items.find(i => i.title === 'Wake the channel')!.spineStatus, 'IN MOTION');
  });

  /* ── Provenance ────────────────────────────────────────────────────── */

  test('an observed status never reaches LIVE', () => {
    /* The same state, asserted by nobody. Watcher noticing an upload must
       not be able to say the campaign is doing this. */
    const ro = buildRollout(fakeReport({
      [ID(HERO)]: { status: 'IMPLEMENTED', provenance: 'DEFAULT' },
    }), []);
    const hero = ro.items.find(i => i.title === 'First hero')!;
    assert.equal(hero.status, 'RECOMMENDED',
      'a non-human status transition promoted a rollout item — this is the whole failure mode');
  });

  test('a human assertion is what moves an item', () => {
    const ro = buildRollout(fakeReport({
      [ID(HERO)]: { status: 'IMPLEMENTED', provenance: 'HUMAN', statedBy: 'Leon' },
    }), []);
    const hero = ro.items.find(i => i.title === 'First hero')!;
    assert.equal(hero.status, 'LIVE');
    assert.equal(hero.campaignEvidence.stated?.by, 'Leon');
  });

  test('possibilities are marked as possibilities and attributed to a person', () => {
    const ro = buildRollout(fakeReport(), []);
    const poss = ro.items.filter(i => i.commitment === 'POSSIBILITY');
    assert.ok(poss.length >= 4, 'the conversation items should be possibilities');
    for (const p of poss) {
      assert.ok(p.attribution.statedBy.length > 0, `${p.title} has no author`);
      assert.ok(!/grok|model|watcher|system/i.test(p.attribution.statedBy),
        `${p.title} is attributed to something that is not a person`);
    }
    assert.ok(ro.limitations.some(l => /POSSIBILITY/.test(l)),
      'the page must say what POSSIBILITY means, not just tag it');
  });

  test('no rollout item claims a date the system does not hold', () => {
    const churches = ROLLOUT_PLANS['chvrches'].find(p => p.key === 'churches_in_churches')!;
    assert.match(churches.timing, /not held by this system/,
      'the January run has no confirmed dates or venues and the copy must say so');
  });

  /* ── Research ──────────────────────────────────────────────────────── */

  test('no seeded example is board-eligible today, so none may be shown', () => {
    for (const s of seeds) {
      assert.ok(!boardStatus(s).eligible,
        `${s.subject} passed the board gate while unverified — the Ideas tab would show it as evidence`);
    }
    const ro = buildRollout(fakeReport(), seeds);
    for (const it of ro.items) {
      assert.equal(it.grokResearch.examples.length, 0,
        `${it.title} rendered an unverified example as evidence`);
    }
  });

  test('an empty research block says which kind of empty it is', () => {
    const ro = buildRollout(fakeReport(), seeds);
    const withCandidates = ro.items.filter(i => i.grokResearch.awaitingVerification > 0);
    assert.ok(withCandidates.length > 0, 'the seeds should match at least one item by tag');
    for (const it of ro.items) {
      assert.ok(it.grokResearch.note, `${it.title} shows nothing and explains nothing`);
      if (it.grokResearch.awaitingVerification > 0) {
        assert.match(it.grokResearch.note!, /verified/i,
          'holding unverified candidates must not read as "nothing exists"');
      }
    }
  });

  /* A record a model could have produced on its own: verified, sourced,
     scored — everything except a person's decision. */
  const verifiedWetLeg = (): CaseStudy => ({
    ...(seeds.find(s => s.subject === 'Wet Leg') as CaseStudy),
    verification: 'VERIFIED',
    verifiedBy: 'grok',
    sourceUrls: ['https://www.youtube.com/watch?v=example'],
    evidence: [{ sourceType: 'PUBLIC_YOUTUBE', claim: 'x', sourceRef: 'y' }],
    observedAt: '2025-06',
    scores: { mechanicValue: 3, culturalRelevance: 3, visualBoardValue: 2 },
    scoredBy: 'grok (proposed)',
  } as CaseStudy);

  /* ── The human gate ────────────────────────────────────────────────── */

  test('a model-verified, model-scored example is NOT client-facing until a person promotes it', () => {
    const v = verifiedWetLeg();
    assert.ok(boardStatus(v).eligible, 'the fixture should clear the board gate — that is the point of the test');
    const ro = buildRollout(fakeReport(), [v]);
    for (const it of ro.items) {
      assert.equal(it.grokResearch.examples.length, 0,
        `${it.title} showed a model-verified example that nobody promoted — the gate is open`);
    }
    const counted = ro.items.filter(i => i.grokResearch.awaitingPromotion > 0);
    assert.ok(counted.length > 0, 'the example must be COUNTED as awaiting promotion, not silently dropped');
    for (const it of counted) {
      assert.match(it.grokResearch.note!, /awaiting review|promoted/i,
        'the empty block must say a person has not reviewed it, not that nothing exists');
    }
    assert.ok(ro.limitations.some(l => /promoted by a named person/.test(l)),
      'the page must state that shown examples were promoted by a person');
  });

  test('a promoted example appears, and carries who promoted it', () => {
    const v = verifiedWetLeg();
    v.promotion = { status: 'PROMOTED', by: 'Leon', at: '2026-09-12T09:00:00.000Z', note: null };
    const ro = buildRollout(fakeReport(), [v]);
    const found = ro.items.filter(i => i.grokResearch.examples.length);
    assert.ok(found.length > 0, 'a promoted example should reach the page');
    const ex = found[0].grokResearch.examples[0];
    for (const k of ['id', 'artist', 'observedBehaviour', 'whyItMattersHere', 'promotedBy', 'promotedAt'] as const) {
      assert.ok(ex[k] && String(ex[k]).length > 0, `example is missing ${k}`);
    }
    assert.equal(ex.verification, 'VERIFIED');
    assert.equal(ex.promotedBy, 'Leon');
    assert.ok(ex.source, 'an example on the page must be followable');
    assert.equal(found[0].grokResearch.awaitingPromotion, 0);
  });

  test('a rejected example is neither shown nor counted as waiting', () => {
    const v = verifiedWetLeg();
    v.promotion = { status: 'REJECTED', by: 'Leon', at: '2026-09-12T09:00:00.000Z', note: 'weak proof' };
    const ro = buildRollout(fakeReport(), [v]);
    for (const it of ro.items) {
      assert.equal(it.grokResearch.examples.length, 0, `${it.title} showed a rejected example`);
      assert.equal(it.grokResearch.awaitingPromotion, 0, `${it.title} counted a rejected example as awaiting review`);
    }
  });

  test('promotion cannot rescue an example that never cleared the board gate', () => {
    /* A person promoting an unverified seed by mistake must still not put
       it on the page — the two gates are AND, not OR. */
    const unverified = { ...(seeds[0] as CaseStudy), promotion: { status: 'PROMOTED', by: 'Leon', at: '2026-09-12', note: null } } as CaseStudy;
    assert.ok(!boardStatus(unverified).eligible);
    const ro = buildRollout(fakeReport(), [unverified]);
    for (const it of ro.items) assert.equal(it.grokResearch.examples.length, 0, `${it.title} showed an unverified example because it was promoted`);
  });

  /* ── Proposals sit beside the recommendation, never in its place ──── */

  test('a proposed application is surfaced as a proposal and the human recommendation is untouched', () => {
    const v = verifiedWetLeg();
    v.proposals = [{ artistSlug: 'chvrches', application: 'Run the archive as a Premiere series', whatWouldHaveToBeTrue: 'the January footage is captured', proposedBy: 'grok', at: '2026-09-12T09:00:00.000Z' }];
    const before = buildRollout(fakeReport(), []);
    const ro = buildRollout(fakeReport(), [v]);
    const withProposal = ro.items.filter(i => i.grokResearch.proposals.length);
    assert.ok(withProposal.length > 0, 'the proposal should attach to the items the example matches');
    for (const it of ro.items) {
      const orig = before.items.find(o => o.id === it.id)!;
      assert.equal(it.recommendation, orig.recommendation, `${it.title}: the human "What we'd do" text changed because of a proposal`);
    }
    const p = withProposal[0].grokResearch.proposals[0];
    assert.equal(p.examplePromoted, false, 'a proposal must say whether its example has been promoted');
    assert.equal(p.proposedBy, 'grok');
    /* A proposal for another artist never leaks onto this campaign. */
    v.proposals = [{ ...v.proposals[0], artistSlug: 'idlesband' }];
    const other = buildRollout(fakeReport(), [v]);
    assert.ok(other.items.every(i => i.grokResearch.proposals.length === 0), 'a proposal for another artist appeared on CHVRCHES');
  });

  /* ── Research runs ─────────────────────────────────────────────────── */

  test('lastResearchedAt comes from the run log, per item, and is null when nobody has looked', () => {
    const none = buildRollout(fakeReport(), []);
    assert.ok(none.items.every(i => i.grokResearch.lastResearchedAt === null));
    const heroId = none.items.find(i => i.title === 'First hero')!.id;
    const runs: ResearchRun[] = [
      { id: 'r1', artistSlug: 'chvrches', ranAt: '2026-09-12T08:00:00.000Z', outcome: 'NO_CHANGE', reason: 'state unchanged since last run, 2 days old', question: 'How are interesting artists handling first hero?', rolloutItemId: heroId, stateSeen: { campaignState: null, currentQuestion: null, spine: [] }, considered: [], evidenceAdded: [], remainingGaps: [], producedBy: 'grok' },
      { id: 'r0', artistSlug: 'chvrches', ranAt: '2026-09-10T08:00:00.000Z', outcome: 'RESEARCHED', reason: 'first pass', question: 'How are interesting artists handling first hero?', rolloutItemId: null, stateSeen: { campaignState: null, currentQuestion: null, spine: [] }, considered: [{ subject: 'X', decision: 'REJECTED', why: 'press coverage only, no uploads', exampleId: null, sourceUrl: null }], evidenceAdded: [], remainingGaps: ['premiere_behaviour'], producedBy: 'grok' },
    ];
    const ro = buildRollout(fakeReport(), [], runs);
    const hero = ro.items.find(i => i.title === 'First hero')!;
    assert.equal(hero.grokResearch.lastResearchedAt, '2026-09-12T08:00:00.000Z', 'newest run for the item wins');
    assert.match(hero.grokResearch.note!, /Last researched 2026-09-12/);
    const wake = ro.items.find(i => i.title === 'Wake the channel')!;
    assert.equal(wake.grokResearch.lastResearchedAt, null, 'a run against first hero must not mark another item as researched');
  });

  test('record_research_run refuses vague and inconsistent records', () => {
    const base = { artistSlug: 'chvrches', question: 'q', producedBy: 'grok' };
    assert.equal(validateRun({ ...base, outcome: 'MAYBE', reason: 'long enough reason here' }).ok, false, 'unknown outcome accepted');
    assert.equal(validateRun({ ...base, outcome: 'NO_CHANGE', reason: 'no change' }).ok, false, '"no change" is not a reason');
    assert.equal(validateRun({ ...base, outcome: 'RESEARCHED', reason: 'looked at three channels' }).ok, false, 'a RESEARCHED run with nothing considered');
    assert.equal(validateRun({ ...base, outcome: 'RESEARCHED', reason: 'looked at three channels', considered: [{ subject: 'X', decision: 'REJECTED', why: 'weak' }] }).ok, false, 'a rejection without a real reason');
    const ok = validateRun({ ...base, outcome: 'RESEARCHED', reason: 'looked at three channels', considered: [{ subject: 'X', decision: 'REJECTED', why: 'only press coverage, no uploads to point at' }], remainingGaps: ['hero_continuity'] }, '2026-09-12T08:00:00.000Z');
    assert.ok(ok.ok);
    if (ok.ok) {
      assert.equal(ok.run.ranAt, '2026-09-12T08:00:00.000Z', 'ranAt is the server clock, not model-supplied');
      assert.equal(ok.run.considered[0].decision, 'REJECTED');
    }
    const quiet = validateRun({ ...base, outcome: 'NO_CHANGE', reason: 'spine and question identical to run r1, 2 days ago' });
    assert.ok(quiet.ok, 'a well-reasoned NO_CHANGE run is a valid record');
  });

  /* ── The model surface ─────────────────────────────────────────────── */

  test('every write tool is refused over GET, and promotion is not a tool at all', () => {
    const names = new Set<string>(INTEL_SPECS.map(s => s.name));
    for (const w of Array.from(INTEL_WRITE_TOOLS)) assert.ok(names.has(w), `${w} is listed as a write tool but is not a tool`);
    for (const must of ['record_recommendation_progress', 'record_research_run', 'verify_research_example', 'propose_campaign_application']) {
      assert.ok(INTEL_WRITE_TOOLS.has(must), `${must} mutates state and must be refused over GET`);
    }
    for (const n of Array.from(names)) {
      assert.ok(!/promot/i.test(n), `${n} — a promotion tool exists on the model surface; the human gate is not a gate`);
    }
    const spec = INTEL_SPECS.find(s => s.name === 'get_rollout')!;
    assert.ok(spec, 'get_rollout must be on the surface so the routine can read the current question');
    for (const n of ['lookup_external_channel', 'get_external_channel_uploads', 'list_research_runs', 'record_research_run']) {
      assert.ok(names.has(n), `${n} missing from the model surface`);
    }
  });

  test('nothing in the example text claims the tactic worked', () => {
    const ro = buildRollout(fakeReport(), seeds);
    for (const it of ro.items) {
      const blob = [it.rationale, it.recommendation, it.grokResearch.note ?? ''].join(' ');
      assert.ok(!/\b(drove|caused|resulted in|boosted|because of this)\b/i.test(blob),
        `${it.title} contains causal language about a tactic`);
    }
  });

  /* ── The question moves ────────────────────────────────────────────── */

  test('the current question belongs to the first open item', () => {
    const ro = buildRollout(fakeReport({
      [ID(WAKE)]: { status: 'OBSERVING', provenance: 'HUMAN', statedBy: 'Leon' },
    }), []);
    assert.equal(ro.currentQuestion?.becauseOf, 'First hero');
    assert.match(ro.currentQuestion!.question, /first hero/i);
  });

  test('completing first hero advances the question without an edit', () => {
    const ro = buildRollout(fakeReport({
      [ID(WAKE)]: { status: 'LEARNED', provenance: 'HUMAN', statedBy: 'Leon' },
      [ID(HERO)]: { status: 'RESULT', provenance: 'HUMAN', statedBy: 'Leon' },
    }), []);
    assert.equal(ro.currentQuestion?.becauseOf, 'Second destination');
    /* "after first hero" is a legitimate thing for the next question to say.
       What must not survive is the FIRST HERO ITEM'S question. */
    const heroQ = ROLLOUT_PLANS['chvrches'].find(p => p.key === 'first_hero')!.question;
    assert.notEqual(ro.currentQuestion!.question, heroQ,
      'the question is still the one first hero owned, after first hero finished');
    assert.equal(ro.items.find(i => i.title === 'Second destination')!.spineStatus, 'NEXT');
  });

  test('a campaign with nothing open returns no question rather than a stale one', () => {
    const states: Record<string, RolloutStatusSource> = {};
    for (const r of listRecommendations(SEEDED_DEEP_DIVES['chvrches'])) {
      states[r.id] = { status: 'LEARNED', provenance: 'HUMAN', statedBy: 'Leon' };
    }
    const ro = buildRollout(fakeReport(states), []);
    const open = ro.items.filter(i => ['EXPLORING', 'RECOMMENDED', 'PLANNED'].includes(i.status as RolloutStatus));
    /* The four possibilities have no recommendation to complete, so they stay
       open and correctly own the question. What must not happen is the
       question staying on a finished stage. */
    assert.ok(!open.some(i => i.spine), 'every spine item should be complete here');
    assert.notEqual(ro.currentQuestion?.becauseOf, 'First hero');
  });

  /* ── Generalisation ────────────────────────────────────────────────── */

  test('an artist with no plan gets an explicit absence, not an empty page', () => {
    const r = fakeReport();
    r.artistSlug = 'idlesband';
    r.artistName = 'IDLES';
    const ro = buildRollout(r, []);
    assert.equal(ro.items.length, 0);
    assert.equal(ro.currentQuestion, null);
    assert.ok(ro.limitations.some(l => /No rollout plan/.test(l)),
      'a missing plan must be stated so it is not read as "no strategy"');
  });

  return { passed, failed, failures };
}
