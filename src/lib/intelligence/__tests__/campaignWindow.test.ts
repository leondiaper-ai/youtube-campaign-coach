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
  resolveCampaignStart, campaignMetrics, eraOnset, type CampaignUpload,
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

  return { passed, failed, failures };
}
