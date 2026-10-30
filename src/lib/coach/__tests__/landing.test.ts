// ─────────────────────────────────────────────────────────────────────────────
// COACH LANDING — BOUNDARY TESTS
//
// The landing page makes two promises that are easy to break quietly: that a
// suggestion only appears where evidence supports it, and that the actions,
// the campaign card and the rollout never disagree because they read one
// model. Both failures look fine on the artist you built against and wrong on
// the next one, which is why every case below is a DIFFERENT shape of
// campaign rather than another assertion about CHVRCHES.
//
// The four shapes: a rich campaign with a deep dive; a campaign with no deep
// dive at all; a campaign with almost no history; and a campaign where
// nothing has been released yet. A recommendation must get MORE specific as
// evidence improves and must stay honest when it does not exist.
//
// Run: node --test (after compiling), or through the repo's test surface.
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildChannelAudit } from '../../channelAudit';
import { buildRoadmap, type Decisions } from '../roadmap';
import { buildCoachStatus } from '../status';
import { buildLandingModel } from '../landingSource';
import type { RecentUpload } from '../../artists';
import type { GeneratedPlan, ParsedEvent } from '../../planEngine';
import type { DeepDiveContext } from '../../intelligence/types';

const NOW = Date.parse('2026-10-30T12:00:00Z');
const DAY = 86_400_000;
const iso = (d: number) => new Date(NOW + d * DAY).toISOString();
const day = (d: number) => iso(d).slice(0, 10);

function upload(id: string, title: string, daysAgo: number, views: number, durationSec = 220): RecentUpload {
  return {
    id, title, description: '', publishedAt: iso(-daysAgo), durationSec,
    live: 'none', scheduledStart: null, actualStart: null, captions: false,
    viewCount: views, likeCount: Math.round(views / 25), commentCount: Math.round(views / 300),
  } as RecentUpload;
}

const event = (title: string, offset: number, kind: ParsedEvent['kind'] = 'singleRelease'): ParsedEvent =>
  ({ dateISO: day(offset), title, kind, scale: 'major' });

const plan = (artist: string, events: ParsedEvent[]): GeneratedPlan => ({
  artist, campaignName: 'Campaign', strategy: { priority: '' } as GeneratedPlan['strategy'],
  weeks: [], phases: [], totalWeeks: 16, events, campaignInsights: [],
});

const DIVE = {
  artistSlug: 'x', artistName: 'X', title: 'd', deckUpdated: '2026-08-26', deckUrl: '/x',
  dataCapturedAt: '2026-08-26', coreThesis: '',
  channelStrengths: [], channelGaps: [], campaignRisks: [], strategicOpportunities: [],
  recommendedContentDirections: [
    { point: 'Live as the second destination after a hero.', basis: 'Deck stage 03.', needTags: ['archive_live', 'follow_up_7_14'] },
  ],
  recommendedCampaignArchitecture: [],
} as unknown as DeepDiveContext;

function model(opts: {
  uploads: RecentUpload[]; events: ParsedEvent[]; dive?: boolean;
  dataAt?: string | null; decisions?: Decisions; series?: Record<string, unknown>; start?: string;
}) {
  const p = plan('Artist', opts.events);
  const evidence = {
    fanResponse: null,
    audit: buildChannelAudit({
      name: 'Artist', slug: 'artist', dataAt: opts.dataAt === undefined ? iso(-0.4) : opts.dataAt, now: NOW, uploads: opts.uploads,
      stats: { subs: null, lifetimeViews: null, views7d: null, views30d: null, subs7d: null },
    }),
    dive: opts.dive ? DIVE : null,
    artistSlug: 'artist',
    uploads: opts.uploads,
  };
  const decisions = opts.decisions ?? {};
  const tracks = buildRoadmap(p, evidence, NOW, null);
  const status = buildCoachStatus({
    plan: p, evidence, tracks, decisions, campaignStartDate: opts.start, now: NOW,
    series: (opts.series ?? {}) as never,
  });
  return {
    model: buildLandingModel({
      status, tracks, evidence, decisions, artistName: 'Artist', projectName: 'Campaign', now: NOW,
    }),
    tracks,
  };
}

const RICH: RecentUpload[] = [
  upload('hero2', 'Artist - Overthinker (Official Lyric Video)', 3, 208_845),
  upload('s2', 'Overthinker out now', 3, 6_145, 45),
  upload('hero1', 'Artist - Roses (Official Lyric Video)', 38, 779_172),
  upload('live1', 'Artist - Clearest Blue (Live at House of Vans)', 400, 104_365, 6_000),
  upload('live2', 'Artist - Leave A Trace (Live in Brussels)', 700, 29_351, 1_620),
  upload('live3', 'Artist - Gun (Live at Reading)', 900, 88_000, 1_400),
];
const RICH_EVENTS = [event('Roses - single release', -38), event('Overthinker - single release', -3), event('Evil - single release', 21)];

test('never more than two actions, and never padded to reach two', () => {
  const rich = model({ uploads: RICH, events: RICH_EVENTS, dive: true });
  assert.ok(rich.model.actions.length <= 2, 'cap of two');

  // Nothing released yet and nothing to compare: one real action, not two.
  const upcoming = model({
    uploads: [upload('t', 'Artist — teaser', 6, 1_200, 50)],
    events: [event('Fickle - single release', 14)],
  });
  assert.equal(upcoming.model.actions.length, 1);
});

test('a follow-up is suggested only on the release carrying the campaign', () => {
  const { model: m } = model({ uploads: RICH, events: RICH_EVENTS, dive: true });
  const followUps = m.rollout.flatMap(r =>
    r.assets.filter(a => a.status !== 'published' && /follow-up/i.test(a.label)).map(() => r.name));
  assert.deepEqual(followUps, ['Overthinker'],
    'a shipped single and an unreleased single must not both carry a follow-up row');
});

test('a deep dive sharpens the suggestion but is never required', () => {
  const withDive = model({ uploads: RICH, events: RICH_EVENTS, dive: true });
  const without = model({ uploads: RICH, events: RICH_EVENTS, dive: false });

  for (const m of [withDive.model, without.model]) {
    assert.ok(m.actions.length >= 1, 'an action is produced with or without a dive');
  }
  // Both name a concrete format, because the channel audit alone supports one.
  assert.match(withDive.model.actions[0].label, /follow-up/i);
  assert.match(without.model.actions[0].label, /follow-up/i);
});

test('limited history still produces an honest action, with no invented figure', () => {
  const { model: m } = model({
    uploads: [upload('only', 'Jane (Official Video)', 4, 7_500)],
    events: [event('Jane - single release', -4), event('Blood - single release', 40)],
  });
  const a = m.actions[0];
  assert.ok(a, 'an action exists');
  assert.match(a.label, /follow-up/i);
  // No channel evidence exists, so no format is named and no count is claimed.
  assert.doesNotMatch(a.reason, /\d+ (lyric|live|visualiser|acoustic)/i);
  assert.ok(a.evidence.some(e => e.href === 'https://artists.youtube/resources/post-release-strategy/')); 
});

test('an expired follow-up window is described as past, not scheduled', () => {
  // Released 35 days ago: the day 7-14 window closed three weeks back.
  const { model: m } = model({
    uploads: [
      upload('h', 'Artist - PTS (Official Video)', 35, 200_000),
      upload('l1', 'Artist - A (Official Lyric Video)', 300, 41_000),
      upload('l2', 'Artist - B (Official Lyric Video)', 500, 65_000),
      upload('l3', 'Artist - C (Official Lyric Video)', 98, 5_200),
    ],
    events: [event('PTS - single release', -35)],
  });
  const a = m.actions[0];
  assert.match(a.reason, /has passed/i, 'a closed window must say so');
  assert.doesNotMatch(a.reason, /Suggested window/i, 'and must not also present itself as scheduled');
});

test('a saved target date overrides the derived one', () => {
  const base = model({ uploads: RICH, events: RICH_EVENTS, dive: true });
  const id = base.model.actions[0].id;
  const withDate = model({
    uploads: RICH, events: RICH_EVENTS, dive: true,
    decisions: { [id]: { status: 'planned', targetDate: '2026-12-01' } },
  });
  const a = withDate.model.actions.find(x => x.id === id);
  assert.ok(a);
  assert.equal(a.dueISO, '2026-12-01');
  assert.match(a.due, /1 Dec/);
});

test('an agreed decision is reflected in the action and keeps its rollout row', () => {
  const base = model({ uploads: RICH, events: RICH_EVENTS, dive: true });
  const id = base.model.actions[0].id;
  const agreed = model({
    uploads: RICH, events: RICH_EVENTS, dive: true,
    decisions: { [id]: { status: 'planned' } },
  });
  const a = agreed.model.actions.find(x => x.id === id);
  assert.equal(a?.state, 'agreed');
  const rows = agreed.model.rollout.flatMap(r => r.assets);
  assert.ok(rows.some(r => r.status === 'agreed'), 'the rollout shows the same state');
});

test('every campaign figure carries the window it was measured over', () => {
  const { model: m } = model({ uploads: RICH, events: RICH_EVENTS, dive: true, start: iso(-65) });
  assert.ok(m.figures.length > 0);
  for (const f of m.figures) {
    assert.ok(f.period && f.period.trim().length > 0, `${f.label} has no period`);
  }
});

test('all known campaign assets are listed, with or without daily history', () => {
  const { model: m } = model({ uploads: RICH, events: RICH_EVENTS, dive: true, start: iso(-65) });
  const listed = m.assets.long.length + m.assets.shorts.length;
  const inWindow = RICH.filter(u => Date.parse(u.publishedAt) >= NOW - 65 * DAY).length;
  assert.equal(listed, inWindow, 'no asset is dropped for lacking a per-day series');
});

test('earlier releases keep a follow-up opportunity without becoming top priorities', () => {
  const first = model({uploads:RICH, events:RICH_EVENTS, dive:true}).model;
  assert.ok(first.rollout.find(r => r.name === 'Roses')?.opportunity);
  assert.ok(first.actions.every(a => a.context !== 'Roses'));
  const supported = model({uploads:[...RICH, upload('roses-live','Artist - Roses (Live)',25,42000)], events:RICH_EVENTS, dive:true}).model;
  assert.equal(supported.rollout.find(r => r.name === 'Roses')?.opportunity, undefined);
});

test('legacy numbered singles and quoted single-plus-video descriptions match uploads', () => {
  const result=model({uploads:[upload('pts','Artist - PTS (Official Video)',12,200000),upload('mww','Artist - My Whole World',20,4600000)],events:[
    event('SINGLE 5: PTS',-12,'other'),event("'My Whole World' — Single + Music Video",-20,'other'),event("'My Whole World' — Lyric Video",-6,'other')
  ]});
  assert.equal(result.tracks.length,2);
  assert.ok(result.tracks.find(t=>t.name==='PTS')?.actions.some(a=>a.video?.id==='pts'));
  assert.ok(result.tracks.find(t=>t.name==='My Whole World')?.actions.some(a=>a.video?.id==='mww'));
});

test('combined album announcement does not hide an explicitly named single', () => {
  const result=model({uploads:[upload('hero','Artist - Overthinker (Official Lyric Video)',3,200000)],events:[event('Overthinker - single release + announce album',-3,'albumAnnounce')]});
  assert.ok(result.tracks[0]?.actions.some(a=>a.video?.id==='hero'));
});

test('album release week remains actionable with no deep dive', () => {
  const result=model({uploads:[upload('pts','Artist - PTS (Official Video)',35,200000),upload('album','Artist - Joy In Short Moments (Official)',0,100)],events:[event('SINGLE 5: PTS',-35,'other'),event('ALBUM RELEASE: Joy In Short Moments',0,'other')]});
  assert.ok(result.model.actions.some(a=>a.context==='Album rollout'));
  assert.equal(result.model.latest?.id,'album');
  assert.match(result.model.stageLine,/Album released/);
});

test('upcoming album and recent unplanned upload both inform the campaign', () => {
  const result=model({uploads:[upload('old','Artist - My Whole World',50,4600000),upload('new','Artist - KOYSAR',7,3100000)],events:[event("'My Whole World' — Single + Music Video",-50,'other'),event("'O My Beloved' — Album Release",7,'other')]});
  assert.equal(result.model.actions.length,2);
  assert.ok(result.model.actions.some(a=>a.context==='Album rollout'));
  assert.ok(result.model.rollout.some(r=>r.assets.some(a=>a.videoId==='new')));
  assert.equal(result.model.latest?.id,'new');
});


test('new campaigns with no channel reading get a planning check, not missing-asset claims', () => {
  const result=model({uploads:[],events:[event('First single - single release',14)],dataAt:null});
  assert.equal(result.model.actions.length,1);
  assert.match(result.model.actions[0].reason,/Refresh the channel reading/);
  assert.doesNotMatch(result.model.actions[0].reason,/missing|no video|no release video/i);
});


test('asset formats, upload dates and the next release stay explicit in the view model', () => {
  const m=model({uploads:RICH,events:RICH_EVENTS,dive:true}).model;
  assert.equal(m.latest?.format,'Lyric Video');
  assert.ok(m.actions[0].observation?.includes('Lyric Video'));
  assert.ok(m.assets.long.every(v=>!!v.format&&!!v.publishedAt));
  assert.ok(m.rollout.flatMap(r=>r.assets).filter(a=>a.status==='published').every(a=>!!a.format));
  assert.equal(m.nextMoment?.name,'Evil');
});
