/**
 * DOES THE SHARED LIVE LAYER ACTUALLY RENDER?
 *
 *   node scripts/check-live-render.js
 *
 * Written because it was needed. The live layer was lifted out of the
 * CHVRCHES deck and the extraction quietly left behind a dependency on
 * bleedImg() — a helper that existed in the deck it came from and not in
 * the deck it moved to. Nothing caught it: TypeScript does not see this
 * file, node --check only parses it, and the failure was swallowed by the
 * .catch() that exists so the live layer can never take a deck down. The
 * page simply loaded without its campaign home and looked like a slow
 * fetch.
 *
 * So this runs the real module against a real-shaped payload with a DOM
 * stubbed underneath it, and fails loudly if any render path throws. The
 * fixture is Kings of Leon because that campaign exercises the paths
 * CHVRCHES does not: a hero that has already been published, a dated
 * follow-up window, a tentative moment before the anchor, and a reference
 * board with two cards.
 */
const fs = require('fs');
const payload = {
  state: 'CAMPAIGN_LIVE',
  artist: { slug: 'kingsofleon', name: 'Kings of Leon', handle: '@kingsofleon' },
  campaign: { name: "'O My Beloved' Album Release", releaseDate: '2026-11-06', source: 'coach_plan' },
  deepDive: { capturedAt: '2026-08-24', title: 'Kings of Leon × YouTube', line: 'x', deckUrl: '/kol' },
  channel: { avatar: 'a', subs: 2010000, views: 2476682441, lastUploadAt: '2026-09-10T16:02:10Z', daysSinceUpload: 4 },
  metrics: { viewsDelta: 13503717, subsDelta: 0, viewsWindow: { days: 21, from: '2026-08-24', to: '2026-09-14' },
    subsWindow: { days: 21, from: '2026-08-24', to: '2026-09-14' }, campaignViews: 973926, campaignAssets: 10,
    campaignShare: 0.0721, newUploads: 10, baselineDormantDays: null, daysSinceBaseline: 21 },
  assets: { heroes: [
      { videoId: 'Bb7YN5wQztk', title: 'Kings Of Leon - My Whole World', publishedAt: '2026-09-10T16:02:10Z',
        dateLabel: '10 SEP', kind: 'long', formatLabel: 'LONG FORM', aspect: 'landscape', views: 854915,
        thumb: 't', url: 'u', role: 'hero' },
      { videoId: 'Pem_5ooqU2E', title: 'August 26, 2026', publishedAt: '2026-08-26T15:01:36Z', dateLabel: '26 AUG',
        kind: 'short', formatLabel: 'SHORT', aspect: 'portrait', views: 29117, thumb: 't', url: 'u', role: 'hero' }],
    supporting: [{ videoId: 'KfenpI_UZVk', title: 'September 2, 2026', publishedAt: '2026-09-02T17:27:29Z',
      dateLabel: '2 SEP', kind: 'short', formatLabel: 'SHORT', aspect: 'portrait', views: 16192, thumb: 't', url: 'u', role: 'supporting' }] },
  followUpWindow: { from: '2026-09-17', to: '2026-09-24', fromLabel: '17 SEP', toLabel: '24 SEP', state: 'AHEAD', daysUntilOpens: 4, daysUntilCloses: 11 },
  stages: [{ id: 'a', label: "Don't leave the hero alone", point: 'p', status: 'NEXT' }],
  timeline: { moments: [
    { kind: 'PAST', provenance: 'OBSERVED', dateLabel: '10 SEP', date: '2026-09-10', daysAway: -4, stage: null,
      title: 'My Whole World', detail: null, asset: { videoId: 'Bb7YN5wQztk', thumb: 't', url: 'u', formatLabel: 'LONG FORM', aspect: 'landscape', views: 854915 } },
    { kind: 'NOW', provenance: 'NOW', dateLabel: 'TODAY', date: '2026-09-14', daysAway: 0, stage: null, title: 'You are here', detail: null, asset: null },
    { kind: 'WINDOW', provenance: 'RECOMMENDED', dateLabel: '17 SEP – 24 SEP', date: '2026-09-17', daysAway: 4,
      stage: "Don't leave the hero alone", title: "Don't leave the hero alone", detail: 'Opens in 4 days', asset: null },
    { kind: 'NEXT', provenance: 'TENTATIVE', dateLabel: '2 OCT', date: '2026-10-02', daysAway: 18, stage: null,
      title: 'Single 2: TBD around ACL Headline Show', detail: 'Alt date: October 9', asset: null },
    { kind: 'ANCHOR', provenance: 'CONFIRMED', dateLabel: '6 NOV', date: '2026-11-06', daysAway: 53, stage: 'Album',
      title: "'O My Beloved' Album Release", detail: 'Album', asset: null }], betweenNote: null, coverage: [] },
  rollout: { artistSlug: 'kingsofleon', items: [
    { id: 'i1', title: "Don't leave the hero alone", spine: true, spineStatus: 'NEXT', status: 'RECOMMENDED',
      commitment: 'COMMITTED', needTags: ['follow_up_7_14'],
      pitch: { headline: "Don't leave the hero alone", evidence: '6 / 11 heroes had a follow-up last time',
        why: 'w', doThis: 'd', imageId: 'Bb7YN5wQztk', deepDive: { slide: 'Follow-through', figure: 'f' } },
      opportunity: null,
      references: [
        { artist: 'Lola Young', mechanic: 'One song. Five settings.', did: 'd', proof: 'p', application: 'a',
          imageId: 'uF5HUfho2NU', url: 'u', weight: 'lead', verifiedBy: 'Claude', verifiedAt: '2026-09-14' },
        { artist: 'Odeal', mechanic: 'The record, then the film about it', did: 'd', proof: 'p', application: 'a',
          imageId: '9OzdjyBHVAo', url: 'u', weight: 'support', verifiedBy: 'Claude', verifiedAt: '2026-09-14' }],
      grokResearch: { question: 'What should land after My Whole World?', examples: [], awaitingVerification: 4, awaitingPromotion: 0, proposals: [], lastResearchedAt: null, note: 'n' },
      campaignEvidence: { stated: null, uploads: [], nextWatch: null, absence: null } },
    { id: 'i2', title: 'Make single two an appointment', spine: true, spineStatus: 'AHEAD', status: 'RECOMMENDED',
      commitment: 'COMMITTED', needTags: [], references: [], opportunity: null,
      pitch: { headline: 'Make single two an appointment', evidence: '7 / 11 videos premiered last campaign', why: 'w', doThis: 'd', imageId: 'Bb7YN5wQztk', frame: 2, deepDive: { slide: 'Premieres', figure: 'f' } },
      grokResearch: { question: 'q', examples: [], awaitingVerification: 1, awaitingPromotion: 0, proposals: [], lastResearchedAt: null, note: 'n' },
      campaignEvidence: { stated: null, uploads: [], nextWatch: null, absence: null } },
    { id: 'i5', title: 'Kings of Leon Station', spine: false, spineStatus: null, status: 'RECOMMENDED',
      commitment: 'POSSIBILITY', needTags: [], references: [], pitch: null,
      opportunity: { name: 'Kings of Leon Station', line: 'l', example: { label: 'Metallica TV', url: 'u', observed: 'o', checkedAt: '2026-09-11' } },
      grokResearch: { question: 'q', examples: [], awaitingVerification: 2, awaitingPromotion: 0, proposals: [], lastResearchedAt: null, note: 'n' },
      campaignEvidence: { stated: null, uploads: [], nextWatch: null, absence: null } }],
    currentQuestion: { question: 'What should land after My Whole World?', becauseOf: "Don't leave the hero alone",
      release: { title: "'O My Beloved' Album Release", date: '2026-11-06', source: 'coach_plan' },
      hero: { title: 'My Whole World', publishedAt: '2026-09-10T16:02:10Z', source: 'observed' } },
    limitations: [] },
  read: { kicker: null, headline: 'The campaign is live.', line: 'Next: Don\'t leave the hero alone.' },
  coverage: [], generatedAt: new Date().toISOString(),
};

const mk = () => ({ classList:{add(){},remove(){},toggle(){},contains(){return false}}, style:{},
  innerHTML:'', outerHTML:'', dataset:{}, children:[], remove(){}, appendChild(){},
  insertAdjacentHTML(_p,h){ this.innerHTML += h; }, getAttribute(){return null},
  querySelector(){return mk()}, querySelectorAll(){return []}, scrollIntoView(){},
  getBoundingClientRect(){return {top:0,height:0}} });
global.window = { LIVE_DECK: { slug:'kingsofleon', api:'https://x/api/campaign-cover', fallbackImage:'RF0HhrwIwp0',
  host:{ observeAll(){}, resetSlides(){}, updateProgress(){} } }, scrollTo(){} };
global.document = { getElementById(){ return mk(); }, querySelector(){ return mk(); },
  querySelectorAll(){ return []; }, createElement(){ return mk(); }, body: mk() };
global.fetch = async () => ({ ok:true, json: async () => payload });
global.AbortController = class { constructor(){ this.signal = {}; } abort(){} };

let failed = null;
const origWarn = console.warn;
console.warn = (...a) => { failed = a.join(' '); origWarn(...a); };

eval(fs.readFileSync('public/live/campaign-home.js','utf8'));
setTimeout(() => {
  console.log(failed ? 'RUNTIME FAIL: ' + failed : 'RENDER OK — cover, playbook and board all built');
  process.exit(failed ? 1 : 0);
}, 300);
