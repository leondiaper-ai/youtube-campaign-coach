/**
 * Readiness V2 regression checks.
 *
 * Durable guard for the five scoring failure modes the model is designed to
 * fix. Pure (no IO). Run with:
 *   npx tsc src/lib/driveAssets.regression.ts <deps...> --outDir /tmp/rt ... && node /tmp/rt/...
 * or import { runRegression } and assert `pass`.
 *
 * Each case encodes the EXPECTED behaviour as assertions, not just numbers, so
 * the targets survive constant tuning.
 */

import {
  buildLibrary, mapAssetsToTimeline, readinessScore, supportInventory,
  type RawDriveFile, type AssetMappingConfig, type MilestoneReadiness,
} from './driveAssets';
import { getSeedLibrary } from './campaignConfig';
import { generatePlan, type GeneratedPlan } from './planEngine';

function f(id: string, title: string, mime: string, folderPath?: string): RawDriveFile {
  return { id, title, mimeType: mime, folderPath, modifiedTime: new Date().toISOString() };
}
function plan(timeline: string[]): GeneratedPlan {
  return generatePlan(timeline.join('\n'), 'Artist', null, null)!;
}

export type CaseResult = {
  name: string;
  score: number;
  band: string;
  anchorGated: boolean;
  supportScore: number;
  supportBand: string;
  states: { title: string; readiness: MilestoneReadiness }[];
  headline: string;
  checks: { desc: string; pass: boolean }[];
};

function evaluate(
  name: string,
  lib: ReturnType<typeof buildLibrary>,
  p: GeneratedPlan,
  cfg: AssetMappingConfig | undefined,
  assert: (
    r: ReturnType<typeof readinessScore>,
    sup: ReturnType<typeof supportInventory>,
    states: { title: string; readiness: MilestoneReadiness }[],
  ) => { desc: string; pass: boolean }[],
): CaseResult {
  const r = readinessScore(lib, p, cfg);
  const sup = supportInventory(lib);
  const states = mapAssetsToTimeline(lib, p, cfg).map((m) => ({ title: m.title, readiness: m.readiness }));
  return {
    name, score: r.score, band: r.band, anchorGated: r.anchorGated,
    supportScore: sup.score, supportBand: sup.band,
    states, headline: r.headline, checks: assert(r, sup, states),
  };
}

const st = (states: { title: string; readiness: MilestoneReadiness }[], frag: string) =>
  states.find((s) => s.title.toLowerCase().includes(frag));

export function runRegression(): { pass: boolean; cases: CaseResult[] } {
  const cases: CaseResult[] = [];

  // A. One excellent official video, single release.
  cases.push(evaluate('A. One great OV, no support',
    buildLibrary('a', 'url', [f('a', 'My Song (Official Video).mp4', 'video/mp4')]),
    plan(['June 12 - My Song single release']), undefined,
    (r, sup) => [
      { desc: 'Release Readiness not Thin', pass: r.band !== 'Thin' },
      { desc: 'anchor factor carries meaningful weight (>=30/55)', pass: r.factors[0].points >= 30 },
      { desc: 'not anchor-gated (anchor present)', pass: !r.anchorGated },
      { desc: 'Support Inventory low (Weak)', pass: sup.band === 'Weak' && sup.score < 30 },
    ],
  ));

  // B. Three singles, assets only for Song One.
  cases.push(evaluate('B. 3 singles, assets only for Song One',
    buildLibrary('b', 'url', [
      f('a', 'Song One (Official Video).mp4', 'video/mp4'),
      f('b', 'Song One Visualiser.mp4', 'video/mp4'),
      f('c', 'Song One Short.mp4', 'video/mp4', 'Shorts'),
    ]),
    plan(['June 12 - Song One single release', 'July 10 - Song Two single release', 'Aug 14 - Song Three single release']),
    undefined,
    (r, _sup, s) => [
      { desc: 'Song One is ready', pass: st(s, 'one')?.readiness === 'ready' },
      { desc: 'Song Two NOT ready', pass: st(s, 'two')?.readiness !== 'ready' },
      { desc: 'Song Three NOT ready', pass: st(s, 'three')?.readiness !== 'ready' },
      { desc: 'score does not overstate coverage (<55)', pass: r.score < 55 },
    ],
  ));

  // C. No anchor, support dump only.
  cases.push(evaluate('C. No anchor, support-only dump',
    buildLibrary('c', 'url', [
      f('a', 'clip1.mp4', 'video/mp4', 'Shorts'),
      f('b', 'clip2.mp4', 'video/mp4', 'Shorts'),
      f('c', 'clip3.mp4', 'video/mp4', 'Shorts'),
      f('d', 'studio bts.mp4', 'video/mp4', 'Recording BTS'),
      f('e', 'live at barras.mp4', 'video/mp4', 'Performances'),
      f('g', 'art1.jpg', 'image/jpeg'), f('h', 'art2.jpg', 'image/jpeg'), f('i', 'art3.jpg', 'image/jpeg'),
    ]),
    plan(['June 12 - Mystery single release']), undefined,
    (r, sup) => [
      { desc: 'Release Readiness NOT On track (capped)', pass: r.band !== 'On track' && r.band !== 'Ready' },
      { desc: 'anchor-gated', pass: r.anchorGated },
      { desc: 'headline names the anchor gap', pass: /anchor/i.test(r.headline) },
      { desc: 'Support Inventory moderate/strong', pass: sup.score >= 30 },
    ],
  ));

  // D1 vs D2 — anchor present must beat anchor absent.
  const d1 = evaluate('D1. anchor present, missing only support',
    buildLibrary('d1', 'url', [f('a', 'Track (Official Video).mp4', 'video/mp4'), f('b', 'Track Visualiser.mp4', 'video/mp4')]),
    plan(['June 12 - Track single release']), undefined, () => []);
  const d2 = evaluate('D2. anchor absent, support present',
    buildLibrary('d2', 'url', [f('a', 'Track Short.mp4', 'video/mp4', 'Shorts')]),
    plan(['June 12 - Track single release']), undefined, () => []);
  d1.checks = [{ desc: 'D1 scores higher than D2', pass: d1.score > d2.score }];
  d2.checks = [{ desc: 'D2 lower than D1; anchor-gated', pass: d2.score < d1.score && d2.anchorGated }];
  cases.push(d1, d2);

  // E. BTS-heavy Snuts-style campaign (real seed).
  const snutsLib = getSeedLibrary('the-snuts-the-snuts-campaign')!;
  cases.push(evaluate('E. BTS-heavy (Snuts seed)',
    snutsLib,
    plan(['June 12 - Summer Rain single release', 'August 21 - Migration album release']),
    { knownTitles: ['Summer Rain', 'Migration'] },
    (r, sup) => [
      { desc: 'Release Readiness low (Thin/Building)', pass: r.band === 'Thin' || r.band === 'Building' },
      { desc: 'does NOT claim release readiness (anchor-gated)', pass: r.anchorGated },
      { desc: 'Release NOT On track', pass: r.band !== 'On track' && r.band !== 'Ready' },
      { desc: 'headline names the anchor gap', pass: /anchor/i.test(r.headline) },
      { desc: 'Support Inventory high (Strong/Deep)', pass: sup.band === 'Strong' || sup.band === 'Deep' },
    ],
  ));

  const pass = cases.every((c) => c.checks.every((ch) => ch.pass));
  return { pass, cases };
}
