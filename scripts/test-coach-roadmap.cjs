const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const mod = { exports: {} };
  const req = (name) => {
    if (name === "next/navigation")
      return { usePathname: () => "/labels/partisan" };
    if (name === "next/link")
      return {
        __esModule: true,
        default: ({ children, ...props }) =>
          React.createElement("a", props, children),
      };
    if (name.startsWith("@/") || name.startsWith(".")) {
      const target = name.startsWith("@/")
        ? path.resolve("src", name.slice(2))
        : path.resolve(path.dirname(file), name);
      return load(target + (fs.existsSync(target + ".ts") ? ".ts" : ".tsx"));
    }
    return require(name);
  };
  new Function("require", "module", "exports", code)(req, mod, mod.exports);
  cache.set(file, mod.exports);
  return mod.exports;
}

const { buildRoadmap, actionStatus, trackMention } = load(
  "src/lib/coach/roadmap.ts",
);
const { buildChannelAudit } = load("src/lib/channelAudit.ts");
const now = Date.parse("2026-10-28T12:00:00Z");
const up = (id, title, date = "2026-10-25", extra = {}) => ({
  id,
  title,
  publishedAt: date + "T12:00:00Z",
  durationSec: 200,
  viewCount: 5000,
  likeCount: 1,
  commentCount: 0,
  live: "none",
  ...extra,
});
const plan = {
  artist: "Example",
  events: [
    {
      kind: "albumAnnounce",
      title: "Song - single release + announce album",
      dateISO: "2026-10-30",
    },
  ],
};
const auditFor = (uploads) =>
  buildChannelAudit({
    name: "Example",
    slug: "example",
    now,
    dataAt: "2026-10-28",
    uploads,
    stats: {
      subs: null,
      lifetimeViews: null,
      views7d: null,
      views30d: null,
      subs7d: null,
    },
  });
const ctx = (uploads, dive = null) => ({
  artistSlug: "example",
  uploads,
  audit: auditFor(uploads),
  dive,
});
const lyrics = [1, 2, 3].map((i) =>
  up("l" + i, "Example - Other " + i + " (Lyric Video)"),
);
let tracks = buildRoadmap(plan, ctx(lyrics), now);
assert.equal(
  tracks.length,
  1,
  "A combined single + album announcement remains a focus track",
);
assert(
  tracks[0].actions.some(
    (a) => a.format === "hero" && a.reason.includes("3 examples"),
  ),
);
assert(tracks[0].actions.some((a) => a.format === "lyric"));
const hero = up("hero", "Example - Song (Official Video)");
const short = up("short", "Our new single Song is out now", undefined, {
  durationSec: 25,
});
const unrelated = up("other", "Example - Another Song (Lyric Video)");
const future = up("future", "Example - Song (Live)", "2026-11-02", {
  live: "upcoming",
});
const external = up("external", "Example - Song (Live)", undefined, {
  isCollab: true,
});
tracks = buildRoadmap(
  plan,
  ctx([...lyrics, hero, hero, short, unrelated, future, external]),
  now,
);
assert.equal(tracks[0].actions.filter((a) => a.video?.id === "hero").length, 1);
assert(
  tracks[0].actions.some((a) => a.format === "lyric"),
  "Publishing hero does not hide follow-up",
);
assert(
  tracks[0].actions.some((a) => a.video?.id === "short"),
  "A title naming the track can match its Short",
);
assert(
  !tracks[0].actions.some(
    (a) =>
      a.video?.id === "other" ||
      a.video?.id === "future" ||
      a.video?.id === "external",
  ),
);
assert.equal(
  actionStatus(
    tracks[0].actions.find((a) => a.video?.id === "hero"),
    { status: "planned" },
  ),
  "Published",
);
assert(
  !trackMention("Example - Devil", "Evil"),
  "Do not match song substrings",
);
const liveLyric = up(
  "songlyric",
  "Example - Song (Lyric Video) (Official Lyric Video)",
);
tracks = buildRoadmap(plan, ctx([...lyrics, hero, liveLyric]), now);
assert(
  !tracks[0].actions.some((a) => a.format === "lyric"),
  "Observed repeated format tag satisfies lyric candidate",
);
const empty = buildRoadmap(plan, ctx([]), now)[0];
assert(
  empty.actions.some(
    (a) => a.format === "followup" && a.basis.includes("exploratory"),
  ),
  "Unknown history stays exploratory",
);
const linked = buildRoadmap(
  { ...plan, events: [{ ...plan.events[0], videoId: "scheduled" }] },
  ctx([]),
  now,
)[0];
assert.equal(
  actionStatus(linked.actions.find((a) => a.format === "linked")),
  "Linked · verify",
);
const audio = buildRoadmap(
  plan,
  ctx([up("audio", "Example - Song (Official Audio)")]),
  now,
)[0];
assert(
  audio.actions.some((a) => a.format === "hero"),
  "Audio alone does not satisfy main visual",
);
const library = {
  assets: [
    {
      id: "file",
      name: "Song Official Video.mp4",
      assetClass: "official_video",
      classConfidence: "high",
    },
  ],
};
const file = buildRoadmap(plan, ctx([]), now, library)[0].actions.find(
  (a) => a.format === "hero",
);
assert(file.available);
assert.equal(actionStatus(file), "File found · check readiness");
assert.equal(actionStatus(file, { status: "done" }), "Done · team confirmed");
assert.equal(file.date, "2026-10-30");
console.log(
  "Coach roadmap: combined releases, channel evidence, post-hero support, title matching, deduplication, future/external exclusions, missing history, linked videos and file readiness passed.",
);

const {buildCoachStatus}=load('src/lib/coach/status.ts');
const statusNow=Date.parse('2026-10-30T12:00:00Z');
const statusPlan={artist:'Example',events:[
  {kind:'albumAnnounce',title:'Song - single release + announce album',dateISO:'2026-10-30'},
  {kind:'singleRelease',title:'Next - single release',dateISO:'2026-11-20'},
  {kind:'albumRelease',title:'New Album - album release',dateISO:'2027-01-22'},
]};
const statusUploads=[...lyrics,up('focus','Example - Song (Lyric Video)','2026-10-27',{commentCount:45,viewCount:150000})];
const se=ctx(statusUploads);se.audit.dataAt='2026-10-30T08:00:00Z';
const st=buildRoadmap(statusPlan,se,statusNow);
const makeStatus=(extra={})=>buildCoachStatus({plan:statusPlan,evidence:se,tracks:st,now:statusNow,...extra});
let status=makeStatus();
assert(status.headline.includes('Song is live'));
assert(!status.headline.includes('Album out'),'An album announcement must not become an album release');
assert(status.headline.includes('22 Jan'));
assert(status.next.startsWith('Next'),'Already-published single is not the next missing release');
assert(status.priorities.length<=2);
assert.equal(new Set(status.priorities.map(t=>t.id)).size,status.priorities.length);
assert(!status.priorities.flatMap(t=>t.actions).some(a=>a.format==='community'),'Counts alone do not create an engagement task');
assert(status.priorities.flatMap(t=>t.actions).every(a=>!a.video&&!a.scheduled||a.scheduled));
const follow=status.priorities.flatMap(t=>t.actions).find(a=>a.id.startsWith('song:')&&a.format!=='community');
assert.equal(follow.date,'2026-11-06','Follow-up anchors to actual publication, not the supplied music date');
status=makeStatus({decisions:{[follow.id]:{status:'done'}}});
assert(!status.priorities.flatMap(t=>t.actions).some(a=>a.id===follow.id),'Completed work leaves the priority list');
const stale={...se,audit:{...se.audit,dataAt:'2026-10-20'}};
assert.equal(makeStatus({evidence:stale}).priorities.length,0,'Stale data cannot generate missing-asset prompts');
const two=ctx([...statusUploads,up('second','Example - Song (Official Video)','2026-10-29')]);two.audit.dataAt='2026-10-30';
const twoStatus=makeStatus({evidence:two,tracks:buildRoadmap(statusPlan,two,statusNow)});
assert(!twoStatus.priorities.flatMap(t=>t.actions).some(a=>a.id===follow.id),'A new supporting upload clears the extra-visual prompt');
assert(twoStatus.current.includes('official'),'Current state follows the newest actual visual');
assert(!makeStatus({gains:{}}).priorities.flatMap(t=>t.actions).some(a=>a.reason.includes('recorded days')),'No history must not become invented velocity');
console.log('Coach status checks passed: real release stage, actual upload anchor, next single, bounded priorities, saved completion, stale suppression and new upload response.');
const curvePlan={artist:'Example',events:[{kind:'singleRelease',title:'Roses - single release',dateISO:'2026-09-22'},{kind:'albumAnnounce',title:'Song - single release + announce album',dateISO:'2026-10-30'},{kind:'singleRelease',title:'Next - single release',dateISO:'2026-11-20'}]};
const curveEvidence=ctx([...lyrics,up('rose','Example - Roses (Lyric Video)','2026-09-22'),up('focus','Example - Song (Lyric Video)','2026-10-27')]);curveEvidence.audit.dataAt='2026-10-30';
const curves={rose:{videoId:'rose',publishedAt:'2026-09-22T12:00:00Z',observations:[{ts:'2026-09-23',views:100820},{ts:'2026-09-25',views:242352}]},focus:{videoId:'focus',publishedAt:'2026-10-27T12:00:00Z',observations:[{ts:'2026-10-28',views:134578},{ts:'2026-10-30',views:200180}]}};
const curveStatus=buildCoachStatus({plan:curvePlan,evidence:curveEvidence,tracks:buildRoadmap(curvePlan,curveEvidence,statusNow),now:statusNow,series:curves});
assert(curveStatus.launch.includes('Day 1 +33%'));
assert(curveStatus.launch.includes('-17% vs Roses at recorded day 3'));
assert.equal(buildCoachStatus({plan:curvePlan,evidence:curveEvidence,tracks:buildRoadmap(curvePlan,curveEvidence,statusNow),now:statusNow}).launch,null,'Never compare current lifetime totals to an older release as launch pace');
assert.equal(curveStatus.audience,null,'No stored fan-response read means no sentiment claim');
assert(!curveStatus.priorities.flatMap(t=>t.actions).some(a=>a.format==='shorts-test'),'A Shorts average is not a mandate to increase cadence');
console.log('Matched-age launch checks passed: day 1 ahead/day 3 behind retained; missing curves and fan response omitted; no automatic Shorts quota.');

const morningStatus=buildCoachStatus({plan:curvePlan,evidence:curveEvidence,tracks:buildRoadmap(curvePlan,curveEvidence,statusNow),now:Date.parse('2026-10-30T10:00:00Z'),series:curves});
assert(morningStatus.launch.includes('recorded day 3'),'Use the latest actual daily reading rather than switching age at noon');
