/**
 * CAMPAIGN WINDOW CHECKS
 *
 * The bug these exist to prevent has already happened once, in two
 * directions at the same time, so both directions are pinned here:
 *
 *   a whole-channel view delta presented as CAMPAIGN VIEWS
 *   a pin date and an analysis date both presented as the campaign start
 *
 * The first put 19M on a page for a campaign whose assets had earned 1.08M.
 * The second made one surface count 13 assets and another count 10, for the
 * same campaign, on the same afternoon.
 */

import assert from 'node:assert';
import {
  resolveCampaignStart, campaignMetrics, eraOnset, campaignPerformanceFor,
  toCampaignUploads, followUpAnchorFor, qualifiesAsAnchor,
  type CampaignUpload, type AnchorCandidate,
} from '../campaignWindow';

export interface CheckResult { passed: number; failed: number; failures: string[] }

const NOW = new Date('2026-09-14T12:00:00Z').getTime();
const up = (d: string, kind: 'short' | 'video', views: number): CampaignUpload =>
  ({ publishedAt: `${d}T15:00:00Z`, kind, views });

/* Kings of Leon as observed on 14 Sep 2026. The countdown Shorts begin on
   12 Aug — "29 days 'til…", counting to My Whole World on 10 Sep — after a
   fourteen-day silence. */
const KOL: CampaignUpload[] = [
  up('2026-09-10', 'video', 854915), up('2026-09-09', 'short', 9772),
  up('2026-09-08', 'short', 6602), up('2026-09-07', 'short', 14179),
  up('2026-09-04', 'short', 9088), up('2026-09-02', 'short', 16192),
  up('2026-08-31', 'short', 12728), up('2026-08-28', 'short', 9899),
  up('2026-08-26', 'short', 29117), up('2026-08-24', 'short', 11434),
  up('2026-08-21', 'short', 14148), up('2026-08-20', 'short', 10085),
  up('2026-08-19', 'short', 12540), up('2026-08-17', 'short', 17170),
  up('2026-08-14', 'short', 14752), up('2026-08-13', 'short', 19516),
  up('2026-08-12', 'short', 15920),
  /* Before the era: sporadic. */
  up('2026-07-29', 'short', 13502), up('2026-07-24', 'short', 39214),
  up('2026-07-09', 'video', 11380), up('2026-07-05', 'video', 13910),
];

/* The same channel, in the raw shape every surface actually holds. */
const RAW = KOL.map(u => ({
  publishedAt: u.publishedAt,
  viewCount: u.views ?? 0,
  durationSec: u.kind === 'short' ? 30 : 240,
}));

export function runCampaignWindowChecks(): CheckResult {
  let passed = 0; let failed = 0;
  const failures: string[] = [];
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; }
    catch (e) { failed++; failures.push(`${name}: ${e instanceof Error ? e.message : String(e)}`); }
  };

  test('the era onset is the most recent silence, not the longest one', () => {
    /* 9 Jul -> 24 Jul is a 15-day gap, longer than the 14 days before
       12 Aug. Taking the longest gap in the year would date this campaign
       to July. The edge of the current era is the question being asked. */
    assert.equal(eraOnset(KOL, NOW)?.slice(0, 10), '2026-08-12');
  });

  test('a stated date beats the observation', () => {
    const s = resolveCampaignStart({
      uploads: KOL, statedAt: '2026-08-01', statedBy: 'Leon', now: NOW,
    })!;
    assert.equal(s.rule, 'HUMAN_STATED');
    assert.match(s.because, /Leon/);
  });

  test('a continuously publishing channel yields no onset rather than a guess', () => {
    const dense = Array.from({ length: 12 }, (_, i) => ({
      publishedAt: new Date(NOW - i * 2 * 86_400_000).toISOString(),
      kind: 'short' as const, views: 100,
    }));
    assert.equal(eraOnset(dense, NOW), null,
      'no qualifying silence must mean no onset, not the oldest upload we happen to hold');
  });

  test('the fallback says it is the day we started looking', () => {
    const s = resolveCampaignStart({
      uploads: KOL.slice(0, 1), baselineAt: '2026-08-24', now: NOW,
    })!;
    assert.equal(s.rule, 'BASELINE');
    assert.match(s.because, /when we started looking/);
  });

  test('no start at all is null, never today', () => {
    assert.equal(resolveCampaignStart({ uploads: [], now: NOW }), null);
  });

  test('the opening asset of the era is inside the campaign', () => {
    const s = resolveCampaignStart({ uploads: KOL, now: NOW })!;
    const m = campaignMetrics(KOL, s, NOW);
    assert.equal(m.assets, 17,
      'the upload that opens an era IS the first asset — a strict > was half of 13-versus-10');
    assert.equal(m.shorts, 16);
    assert.equal(m.longForm, 1);
  });

  test('campaign views are the assets, never the channel', () => {
    const s = resolveCampaignStart({ uploads: KOL, now: NOW })!;
    const m = campaignMetrics(KOL, s, NOW);
    assert.equal(m.views, 1_078_057);
    /* The guard that matters. Kings of Leon's channel moved ~19M over the
       same period off a 2.46BN catalogue. If this figure is ever within an
       order of magnitude of that, something has started summing the
       channel again. */
    assert.ok(m.views! < 5_000_000,
      'campaign views have drifted into channel-delta territory');
  });

  test('day 1 is the day the first asset landed', () => {
    const s = { at: '2026-09-14T09:00:00Z', rule: 'ERA_ONSET' as const, because: '' };
    assert.equal(campaignMetrics([up('2026-09-14', 'short', 1)], s, NOW).day, 1,
      'a campaign is not on day 0 the afternoon it starts');
  });

  test('a campaign with no assets reports null views, not zero', () => {
    const s = { at: '2026-09-20T00:00:00Z', rule: 'BASELINE' as const, because: '' };
    const m = campaignMetrics(KOL, s, NOW);
    assert.equal(m.assets, 0);
    assert.equal(m.views, null,
      'a campaign that has published nothing is not a campaign that earned nothing');
  });

  test('a pre-hero campaign still returns real figures', () => {
    /* CHVRCHES: three Shorts after 354 days of silence, no long-form yet.
       The page must render this rather than waiting for a hero. */
    const chv: CampaignUpload[] = [
      up('2026-09-13', 'short', 4297), up('2026-09-10', 'short', 11019),
      up('2026-09-09', 'short', 36772), up('2025-09-20', 'short', 15803),
      up('2025-07-01', 'short', 30972),
    ];
    const s = resolveCampaignStart({ uploads: chv, now: NOW })!;
    assert.equal(s.at.slice(0, 10), '2026-09-09');
    const m = campaignMetrics(chv, s, NOW);
    assert.equal(m.assets, 3);
    assert.equal(m.longForm, 0);
    assert.equal(m.views, 52_088);
  });

  /* ── CROSS-SURFACE AGREEMENT ───────────────────────────────────────
     The migration's actual promise. Campaign Home, /campaigns and
     /team-watcher each used to compute this themselves, and on 14 Sep
     2026 they disagreed by an order of magnitude for the same artist on
     the same afternoon. These checks fail if that can happen again. */

  test('every surface computing campaign performance gets the same answer', () => {
    /* Each surface reaches campaignWindow.ts with a different notion of a
       fallback date — /campaigns passes the pin date, the deck passes the
       Deep Dive capture — and the resolver must still land on the same
       observed onset, because the channel's behaviour is the same channel's
       behaviour whoever is asking. */
    const home = campaignPerformanceFor({ uploads: RAW, baselineAt: '2026-08-24', now: NOW });
    const campaigns = campaignPerformanceFor({ uploads: RAW, baselineAt: '2026-08-18', now: NOW });
    const teamBoard = campaignPerformanceFor({ uploads: RAW, now: NOW });

    for (const [name, m] of [['home', home], ['campaigns', campaigns], ['team', teamBoard]] as const) {
      assert.ok(m, `${name} resolved nothing`);
      assert.equal(m!.start.at, home!.start.at, `${name} disagrees about the campaign start`);
      assert.equal(m!.views, home!.views, `${name} disagrees about campaign views`);
      assert.equal(m!.assets, home!.assets, `${name} disagrees about the asset count`);
      assert.equal(m!.day, home!.day, `${name} disagrees about the campaign day`);
    }
  });

  test('campaign views cannot silently fall back to a channel delta', () => {
    /* The regression in one assertion. On 14 Sep the channel delta was
       ~19M and the campaign's assets had earned ~1.08M. Anything that
       reintroduces the channel figure under this name lands far outside
       this bound and fails here rather than on a slide. */
    const m = campaignPerformanceFor({ uploads: RAW, baselineAt: '2026-08-18', now: NOW })!;
    const CHANNEL_DELTA_ON_THE_DAY = 19_043_112;
    assert.ok(m.views! < CHANNEL_DELTA_ON_THE_DAY / 10,
      `campaign views (${m.views}) are within an order of magnitude of the channel delta — `
      + 'something has started summing the channel again');
    /* And it must be the sum of the assets, exactly. */
    const byHand = RAW
      .filter(u => u.publishedAt >= m.start.at)
      .reduce((n, u) => n + (u.viewCount ?? 0), 0);
    assert.equal(m.views, byHand, 'campaign views are not the sum of the campaign assets');
  });

  test('a Shorts-only campaign still reports views, and never a channel figure', () => {
    /* CHVRCHES: three Shorts, no hero. The surfaces that showed a channel
       delta here were reporting millions for a campaign that had earned
       52 thousand. */
    const chv = [
      { publishedAt: '2026-09-13T15:00:00Z', viewCount: 4297, durationSec: 30 },
      { publishedAt: '2026-09-10T15:00:00Z', viewCount: 11019, durationSec: 30 },
      { publishedAt: '2026-09-09T15:00:00Z', viewCount: 36772, durationSec: 30 },
      { publishedAt: '2025-09-20T15:00:00Z', viewCount: 15803, durationSec: 30 },
      { publishedAt: '2025-07-01T15:00:00Z', viewCount: 30972, durationSec: 30 },
    ];
    const m = campaignPerformanceFor({ uploads: chv, now: NOW })!;
    assert.equal(m.views, 52_088);
    assert.equal(m.assets, 3);
    assert.equal(m.longForm, 0);
    assert.equal(m.day, 5);
  });

  test('a stated date reaches the resolver from the surfaces that hold one', () => {
    /* Team Watcher stores a human campaign start and, before the
       migration, never passed it: HUMAN_STATED was unreachable in
       production. This is the check that it is wired. */
    const m = campaignPerformanceFor({
      uploads: RAW, statedAt: '2026-07-25T00:00:00Z', statedBy: 'Team Watcher', now: NOW,
    })!;
    assert.equal(m.start.rule, 'HUMAN_STATED');
    assert.equal(m.start.at, '2026-07-25T00:00:00Z');
    assert.ok(m.assets > 17, 'a stated earlier start must widen the campaign, not be ignored');
  });

  test('the Shorts rule is defined once', () => {
    /* Four files tested durationSec <= 62 and a fifth tested kind, which
       is how two pages come to disagree about how many Shorts a campaign
       has published. */
    const mixed = [
      { publishedAt: '2026-09-10T15:00:00Z', viewCount: 1, durationSec: 62 },
      { publishedAt: '2026-09-09T15:00:00Z', viewCount: 1, durationSec: 63 },
      { publishedAt: '2026-09-08T15:00:00Z', viewCount: 1, durationSec: 0 },
    ];
    const u = toCampaignUploads(mixed);
    assert.deepEqual(u.map(x => x.kind), ['short', 'video', 'video'],
      '62s is a Short, 63s is not, and a missing duration is not guessed into one');
  });

  /* ── THE FOLLOW-UP ANCHOR ───────────────────────────────────────────
     A follow-up window belongs to an ASSET, not to a campaign. CHVRCHES
     drew "16 SEP - 23 SEP · FOLLOW-UP WINDOW" off a 61-second teaser
     because the old test was `kind !== 'short'` and a human override had
     relabelled that Short as a trailer. An editorial note promoted a
     teaser into a hero. */

  const anchorStart = { at: '2026-09-09T00:00:00Z', rule: 'ERA_ONSET' as const, because: '' };
  const cand = (d: string, sec: number | null, title: string, statedKind?: string): AnchorCandidate =>
    ({ videoId: d, title, publishedAt: `${d}T15:00:00Z`, durationSec: sec, statedKind: statedKind ?? null });

  test('a Shorts-only campaign has no follow-up window', () => {
    const anchor = followUpAnchorFor([
      cand('2026-09-13', 16, 'Oh, what to do…?'),
      cand('2026-09-10', 6, 'On your marks.'),
    ], anchorStart);
    assert.equal(anchor, null, 'Shorts are not destinations, so nothing follows them');
  });

  test('a trailer does not open a window, however it has been labelled', () => {
    /* The exact CHVRCHES object: 61 seconds, human-labelled "trailer". */
    const anchor = followUpAnchorFor([
      cand('2026-09-13', 16, 'Oh, what to do…?'),
      cand('2026-09-09', 61, 'Now, we can start.', 'trailer'),
    ], anchorStart);
    assert.equal(anchor, null, 'a 61-second teaser is not a hero');
  });

  test('a human label can veto an anchor but never create one', () => {
    /* Long enough to qualify, but somebody who knows it is a trailer
       knows something the duration does not say. */
    assert.equal(qualifiesAsAnchor(cand('2026-09-20', 180, 'Behind the scenes', 'trailer')), false);
    /* And the reverse must not work: a label cannot promote a Short. */
    assert.equal(qualifiesAsAnchor(cand('2026-09-20', 45, 'A film', 'omv')), false,
      'a 45-second object is not long-form because a label says so');
  });

  test('an unknown or zero duration never qualifies', () => {
    assert.equal(qualifiesAsAnchor(cand('2026-09-20', null, 'Roses')), false);
    assert.equal(qualifiesAsAnchor(cand('2026-09-20', 0, 'Roses')), false,
      'a missing duration is the specific hole the trailer came through');
  });

  test('an announcement or countdown does not qualify on length alone', () => {
    assert.equal(qualifiesAsAnchor(cand('2026-09-20', 200, 'Roses — official trailer')), false);
    assert.equal(qualifiesAsAnchor(cand('2026-09-20', 200, "10 days 'til…")), false);
    assert.equal(qualifiesAsAnchor(cand('2026-09-20', 200, 'Tour announcement')), false);
  });

  test('an Official Music Video opens the window', () => {
    const a = followUpAnchorFor([
      cand('2026-09-24', 20, 'clip'),
      cand('2026-09-22', 214, 'CHVRCHES - Roses (Official Video)'),
    ], anchorStart);
    assert.ok(a, 'an OMV is a destination');
    assert.equal(a!.publishedAt.slice(0, 10), '2026-09-22');
  });

  test('a long-form performance opens the window too', () => {
    const a = followUpAnchorFor([
      cand('2026-10-02', 1840, 'CHVRCHES – Live at Ancienne Belgique'),
    ], anchorStart);
    assert.ok(a, 'a full performance is a destination even without "official video" in the title');
  });

  test('Kings of Leon keeps its My Whole World window', () => {
    const start = { at: '2026-08-12T15:00:00Z', rule: 'ERA_ONSET' as const, because: '' };
    const a = followUpAnchorFor([
      cand('2026-09-10', 261, 'Kings Of Leon - My Whole World'),
      cand('2026-09-09', 25, 'Kick off your shoes'),
      cand('2026-09-07', 32, "3 days 'til…"),
    ], start);
    assert.ok(a, 'My Whole World is a qualifying long-form asset');
    assert.equal(a!.publishedAt.slice(0, 10), '2026-09-10');
    assert.equal(a!.title, 'Kings Of Leon - My Whole World');
  });

  test('the anchor is the newest qualifying asset, not the first', () => {
    const start = { at: '2026-08-01T00:00:00Z', rule: 'ERA_ONSET' as const, because: '' };
    const a = followUpAnchorFor([
      cand('2026-08-05', 200, 'First single'),
      cand('2026-09-10', 261, 'Second single'),
    ], start);
    assert.equal(a!.title, 'Second single');
  });

  test('an asset published before the campaign started is not its anchor', () => {
    const a = followUpAnchorFor([
      cand('2026-07-01', 240, 'Last era, official video'),
    ], anchorStart);
    assert.equal(a, null);
  });

  test('campaign measurement is unaffected by having no anchor', () => {
    /* The separation Leon asked for, asserted. CHVRCHES has a campaign
       start, an age, assets and views, and no follow-up window — those
       are two independent questions and the page must answer both. */
    const chv = [
      { publishedAt: '2026-09-13T15:00:00Z', viewCount: 4297, durationSec: 16 },
      { publishedAt: '2026-09-10T15:00:00Z', viewCount: 11019, durationSec: 6 },
      { publishedAt: '2026-09-09T15:00:00Z', viewCount: 36772, durationSec: 61 },
      { publishedAt: '2025-09-20T15:00:00Z', viewCount: 15803, durationSec: 16 },
      { publishedAt: '2025-07-01T15:00:00Z', viewCount: 30972, durationSec: 10 },
    ];
    const m = campaignPerformanceFor({ uploads: chv, now: NOW })!;
    assert.equal(m.start.rule, 'ERA_ONSET');
    assert.equal(m.start.at.slice(0, 10), '2026-09-09');
    assert.equal(m.day, 5);
    assert.equal(m.assets, 3);
    assert.equal(m.views, 52_088);

    const anchor = followUpAnchorFor(
      chv.map(u => ({ title: '', publishedAt: u.publishedAt, durationSec: u.durationSec })),
      m.start,
    );
    assert.equal(anchor, null, 'measurement and follow-up are independent');
  });

  return { passed, failed, failures };
}
