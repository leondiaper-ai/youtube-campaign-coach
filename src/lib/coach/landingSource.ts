/* ═══════════════════════════════════════════════════════════════════════
   COACH LANDING — adapting the real coach pipeline to the landing view

   This file does NOT decide anything. Every judgement — which two
   actions matter, whether a format is worth suggesting, whether the fan
   read is fresh enough to show, whether a pace comparison is honest —
   already happened in buildRoadmap / buildCoachStatus. This maps that
   output onto the layout and nothing more.

   That split is the point. The actions, the campaign card and the
   rollout all read the SAME TrackRoadmap[] and the SAME Decisions, so
   an asset that becomes published clears its rollout row and removes
   the matching action in one pass. Nothing here recomputes state.

   ── NO ARTIST RULES, NO REQUIRED DEEP DIVE ────────────────────────────
   buildRoadmap degrades on its own: channel-audit format evidence where
   it exists, deep-dive points where they exist, and generic release
   guidance where neither does — each labelled with its basis. This
   adapter must not add a floor of its own, so where the pipeline
   produces nothing, the section is absent rather than filled.
   ═══════════════════════════════════════════════════════════════════════ */

import { songKey } from '../formatStack';
import { coachUploadFormat } from './assetFormat';
import { getFormatMeta } from '../formatClassifier';
import { toCampaignUploads } from '../intelligence/campaignWindow';
import type { RecentUpload } from '../artists';
import type { CoachStatus } from './status';
import type { CoachEvidence, Decisions, RoadmapAction, TrackRoadmap } from './roadmap';
import { actionStatus } from './roadmap';
import {
  compact, exact, shortDate, followUpWindow,
  type LandingAction, type LandingModel, type ReleaseAsset, type ReleaseBlock, type UploadRef,
} from './landingModel';

const DAY = 86_400_000;
const VISUAL = ['omv', 'lyric', 'visualiser', 'live', 'acoustic', 'longform'];
/* Formats that only make sense once a release is out and its moment is
   still open. Everything else (hero, linked, short) belongs to the
   release itself and is legitimate to show before it lands. */
const FOLLOW_UP = ['lyric', 'visualiser', 'live', 'acoustic', 'bts', 'followup'];

/** Published on the channel, versus a team decision. Never merged. */
function stateOf(a: RoadmapAction, d: Decisions): ReleaseAsset['status'] {
  if (a.video && !a.scheduled) return 'published';
  const s = d[a.id]?.status;
  return s === 'planned' || s === 'ready' || s === 'done' ? 'agreed' : 'suggested';
}

function toUploadRef(u: RecentUpload): UploadRef {
  const f = toCampaignUploads([u])[0]?.kind;
  const detected=coachUploadFormat(u);
  const format=f==='short'?'Short':detected==='short'||detected==='longform'?'Video':getFormatMeta(detected).label;
  return {
    id: u.id,
    title: u.title,
    publishedAt: u.publishedAt,
    views: u.viewCount ?? null,
    shape: f === 'short' ? 'short' : 'long',
    format,
  };
}

export function buildLandingModel({
  status, tracks, evidence, decisions, artistName, projectName, now = Date.now(),
}: {
  status: CoachStatus;
  tracks: TrackRoadmap[];
  evidence: CoachEvidence;
  decisions: Decisions;
  artistName: string;
  projectName: string;
  now?: number;
}): LandingModel {
  const today = new Date(now).toISOString().slice(0, 10);

  /* ── actions ───────────────────────────────────────────────────────
     status.priorities is already capped at two and already filtered to
     pending work. Taken as-is; nothing is added to reach the cap. */
  const actions: LandingAction[] = status.priorities.flatMap(t =>
    t.actions.map((a): LandingAction => {
      /* A saved target date from the team overrides the derived one. */
      const saved = decisions[a.id]?.targetDate;
      const dueISO = saved ?? a.date ?? null;
      const due = dueISO ? shortDate(dueISO) : '';
      const soon = !!a.date && Date.parse(a.date) - now <= 10 * DAY;
      /* status.ts prefixes the track name so the label reads standalone in
         a list. Here the eyebrow already carries it, so strip it rather
         than print "Overthinker" twice on one card. */
      const label = a.label.startsWith(`${t.name}: `) ? a.label.slice(t.name.length + 2) : a.label;
      const track=tracks.find(r=>r.actions.some(item=>item.id===a.id));
      const latestTrackVideo=track?.actions.filter(item=>item.video&&!item.scheduled&&!item.format.startsWith('short')).slice().sort((x,y)=>y.video!.date.localeCompare(x.video!.date))[0];
      const observed=latestTrackVideo?evidence.uploads.find(u=>u.id===latestTrackVideo.video!.id):evidence.uploads.find(u=>a.id===`observed:${u.id}:support`) ?? null;
      const ref=observed?toUploadRef(observed):null;
      const followUp = FOLLOW_UP.includes(a.format) && !!observed;
      const window = followUp ? followUpWindow(observed!.publishedAt) : null;
      const windowOpen = window && Date.parse(window.to) >= now;
      const musicHistory=evidence.audit.visuals.formats.find(f=>f.key==='omv');
      const lyricHistory=evidence.audit.visuals.formats.find(f=>f.key==='lyric');
      const recentLyrics=evidence.uploads.filter(u=>!u.isCollab&&u.live!=='upcoming'&&Date.parse(u.publishedAt)<=now&&coachUploadFormat(u)==='lyric').sort((x,y)=>y.publishedAt.localeCompare(x.publishedAt)).slice(0,2);
      const lyricExamples=recentLyrics.map(u=>`${songKey(u.title,artistName)}: ${compact(u.viewCount??0)} views`).join('; ');
      const heroLabel=(musicHistory?.count??0)>=3?'Confirm music video':(lyricHistory?.count??0)>=3?'Confirm lyric video':'Choose music video or lyric video';
      const conciseLabel = followUp ? 'Multi-format follow-up' : a.format === 'hero' ? heroLabel : label;
      const conciseReason = followUp && window && Date.parse(window.to)<now ? 'Follow-up window has passed · review available material.' : followUp
        ? a.format === 'live' ? 'Live version or visualiser · check available footage.'
          : `${a.format === 'lyric' ? 'Lyric video' : a.format === 'visualiser' ? 'Visualiser' : a.format === 'acoustic' ? 'Acoustic performance' : 'Another video'} · check available material.`
        : a.format === 'hero' ? (heroLabel==='Confirm lyric video'?'Prepare a lyric video; confirm the thumbnail and upload.':'If no music video is planned, prepare a lyric video.') : a.reason;
      return {
        id: a.id,
        label: conciseLabel.charAt(0).toUpperCase() + conciseLabel.slice(1),
        window: windowOpen ? `${window!.label} · 7–14 days` : undefined,
        context: t.name,
        observation: ref ? `${ref.format} · ${ref.views==null?'Views unavailable':compact(ref.views)+' views'} · uploaded ${shortDate(ref.publishedAt)}` : undefined,
        due: due ? `by ${due}` : 'date to set',
        dueISO,
        dueTone: soon ? 'soon' : 'normal',
        reason: conciseReason,
        evidence: [
          { heading: 'On the channel.', body: a.format.startsWith('campaign_') ? a.basis : a.format === 'hero'
            ? lyricExamples ? `Lyric videos are reaching fans here — ${lyricExamples}. A practical fallback if no music video is planned.` : (musicHistory?.count??0)>0 ? `Music videos are an established format on this channel (${musicHistory!.count} published). Confirm the launch video with the team.` : 'Choose the launch video with the artist team. A lyric video is an option when a music video is not available.'
            : a.scheduled ? 'A linked video needs its visibility and release date checked.'
            : 'One release video identified; no further long-form video found for this track.' },
          ...(a.available
            ? [{ heading: 'Available material.', body: `Matching file: ${a.available.name}. Confirm it is ready to use.` }]
            : (() => {
                const format = evidence.audit.visuals.formats.find(f => f.key === a.format && f.count >= 3);
                return format ? [{ heading: 'Creative reference.', body: `${format.count} ${format.name.toLowerCase()} uploads on this channel. Check for suitable footage.` }] : [];
              })()),
          { heading: 'YouTube guidance.', body: a.format === 'hero' || a.scheduled || (a.format.startsWith('campaign_') && t.releaseDate > today)
              ? 'Prepare the video launch and supporting teasers.'
              : 'Keep supporting the song with additional videos after release.',
            href: a.format === 'hero' || a.scheduled || (a.format.startsWith('campaign_') && t.releaseDate > today) ? 'https://artists.youtube/resources/pre-release-strategy/' : 'https://artists.youtube/resources/post-release-strategy/' },
        ],
        state: stateOf(a, decisions) === 'agreed' ? 'agreed' : 'suggested',
      };
    }),
  );

  /* ── the release currently carrying the campaign ───────────────── */
  const published = tracks
    .flatMap(t => t.actions.map(a => ({ t, a })))
    .filter(({ a }) => a.video && !a.scheduled && VISUAL.includes(a.format.split(':')[0]));
  const anchor = published.sort((x, y) => (y.a.video!.date).localeCompare(x.a.video!.date))[0] ?? null;
  const anchorUpload = anchor ? evidence.uploads.find(u => u.id === anchor.a.video!.id) ?? null : null;

  /* ── campaign assets: everything we know about, with or without
        daily history. Views come from the upload reading itself, so an
        asset with no per-day series is still listed. ─────────────── */
  const campaignFrom = status.metrics?.start ? Date.parse(status.metrics.start) : null;
  const campaignUploads = evidence.uploads
    .filter(u => !u.isCollab && u.live !== 'upcoming' && Date.parse(u.publishedAt) <= now)
    .filter(u => campaignFrom == null || Date.parse(u.publishedAt) >= campaignFrom)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .map(toUploadRef);

  const windowLabel = status.metrics?.start
    ? `${shortDate(status.metrics.start)} – ${shortDate(new Date(now).toISOString())}`
    : 'window not set';

  /* ── figures: each once, each with the window it was measured over ── */
  const figures: LandingModel['figures'] = [];
  if (status.metrics) {
    if (status.metrics.views != null) {
      figures.push({ value: exact(status.metrics.views), label: 'Campaign views', period: `campaign uploads · ${windowLabel}` });
    }
    figures.push({
      value: String(status.metrics.assets), label: 'Campaign assets',
      period: `${status.metrics.shorts} Shorts · ${status.metrics.longform} long-form`,
    });
  }
  if (status.shortsRead.count > 0) figures.push({
    value: String(status.shortsRead.weekly), label:'Shorts / week',
    period:`last 28 days${status.shortsRead.mean!=null?' · '+compact(status.shortsRead.mean)+' avg views':''}`,
  });

  /* ── rollout, from the same tracks and decisions ─────────────────── */
  const rollout: ReleaseBlock[] = [...tracks]
    .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate))
    .map((t): ReleaseBlock => {
      const live = t.actions.some(a => a.video && !a.scheduled);
      const isAnchor = anchor?.t.id === t.id;
      const future = t.releaseDate > today;
      const publishedLong = t.actions.filter(a => {if(!a.video||a.scheduled)return false;const u=evidence.uploads.find(u=>u.id===a.video!.id);return u?toUploadRef(u).shape==='long':!a.format.startsWith('short');});
      const usedFormats = new Set(publishedLong.map(a => a.format.split(':')[0]));
      const followUpOptions = [['live','live performance'],['visualiser','visualiser'],['lyric','lyric video'],['bts','behind-the-scenes video']].filter(([key]) => !usedFormats.has(key)).slice(0,2).map(([,label]) => label);
      const opportunity = (!isAnchor || (publishedLong[0]?.video?.date ?? today) < new Date(now-14*DAY).toISOString().slice(0,10)) && !future && publishedLong.length === 1
        ? `No further long-form video identified for ${t.name}. Explore a ${followUpOptions.join(' or ')} if suitable material is available.`
        : undefined;
      return {
        name: t.name,
        opportunity,
        dateLabel: shortDate(t.releaseDate),
        stage: isAnchor ? 'live' : live ? 'shipped' : 'upcoming',
        badge: isAnchor
          ? { label: 'Live', tone: 'ok' }
          : live ? { label: 'Shipped', tone: 'ghost' } : { label: 'In preparation', tone: 'warn' },
        // Future releases keep provisional preparation rows at any distance.
        // Old unagreed follow-ups become review notes; saved team decisions stay.
        assets: t.actions.filter(a => {
          if (a.video && !a.scheduled) return true;
          if (stateOf(a, decisions) === 'agreed') return true;
          const kind = a.format.split(':')[0];
          return future || !FOLLOW_UP.includes(kind) || (isAnchor && !!a.date && a.date >= today && publishedLong.length < 2);
        }).map((a): ReleaseAsset => ({
          label: a.video && !a.scheduled ? a.video.title : actions.find(p=>p.id===a.id)?.label ?? (future&&a.format==='hero' ? (evidence.audit.visuals.formats.find(f=>f.key==='omv'&&f.count>=3)?'Confirm music video':'Plan launch video') : future&&a.format==='short'?'Plan Shorts support':a.label),
          note: a.video && !a.scheduled ? undefined : actions.find(p=>p.id===a.id)?.reason ?? (future&&a.format==='hero'?'Music video, or lyric video if unavailable.':future&&a.format==='short'?`Teaser ${shortDate(new Date(Date.parse(t.releaseDate)-3*DAY).toISOString())} · launch ${shortDate(t.releaseDate)} · follow-up ${shortDate(new Date(Date.parse(t.releaseDate)+7*DAY).toISOString())}`:future&&FOLLOW_UP.includes(a.format)?`Provisional · ${followUpWindow(t.releaseDate).label} (days 7–14). Confirm suitable material.`:a.reason),
          status: stateOf(a, decisions),
          meta: a.video && !a.scheduled
            ? `${compact(evidence.uploads.find(u => u.id === a.video!.id)?.viewCount ?? 0)} · ${shortDate(a.video.date)}`
            : (decisions[a.id]?.targetDate ?? status.priorities.flatMap(t => t.actions).find(p => p.id === a.id)?.date ?? a.date) ? shortDate((decisions[a.id]?.targetDate ?? status.priorities.flatMap(t => t.actions).find(p => p.id === a.id)?.date ?? a.date)!) : actionStatus(a, decisions[a.id]),
          videoId: a.video?.id,
          format: a.video&&!a.scheduled ? (()=>{const u=evidence.uploads.find(u=>u.id===a.video!.id);return u?toUploadRef(u).format:undefined;})() : undefined,
        })),
      };
    });

  for (const priority of status.priorities) {
    for (const action of priority.actions.filter(a => a.format === 'campaign_support')) {
      const upload=evidence.uploads.find(u => `observed:${u.id}:support` === action.id);
      if (!upload) continue;
      rollout.push({name:upload.title,dateLabel:shortDate(upload.publishedAt),stage:'live',badge:{label:'Observed on channel',tone:'ok'},assets:[
        {label:upload.title,status:'published',videoId:upload.id,format:toUploadRef(upload).format,meta:`${compact(upload.viewCount ?? 0)} views · ${shortDate(upload.publishedAt)}`} ,
        {label:action.label,note:action.reason,status:stateOf(action,decisions),meta:(decisions[action.id]?.targetDate ?? action.date) ? shortDate((decisions[action.id]?.targetDate ?? action.date)!) : 'To review'}
      ]});
    }
  }

  // A transparent planning scaffold, not a performance-derived quota.
  // One teaser (-3d), launch Short (day 0), follow-up Short (+7d) per single.
  const trackCounts=tracks.map(t=>{
    const ids=Array.from(new Set(t.actions.filter(a=>a.video&&!a.scheduled).map(a=>a.video!.id)));
    const refs=ids.flatMap(id=>{const u=evidence.uploads.find(u=>u.id===id);return u?[toUploadRef(u)]:[];});
    return {t,long:refs.filter(u=>u.shape==='long').length,shorts:refs.filter(u=>u.shape==='short').length,
      at:refs.filter(u=>u.shape==='long').map(u=>u.publishedAt.slice(0,10)).sort()[0]??t.releaseDate};
  });
  const momentDates=Array.from(new Set([...trackCounts.map(r=>r.at),...(status.albumReleaseDate?[status.albumReleaseDate]:[])]));
  const next28Shorts=momentDates.reduce((n,atDate)=>n+[-3,0,7].filter(offset=>{const at=Date.parse(atDate)+offset*DAY;return at>=Date.parse(today)&&at<Date.parse(today)+28*DAY;}).length,0);
  const todayMs=Date.parse(today);
  const heroDue=trackCounts.filter(r=>Date.parse(r.at)<todayMs);
  const followDue=trackCounts.filter(r=>Date.parse(r.at)+14*DAY<todayMs);
  const shortDue=trackCounts.map(r=>({r,due:[-3,0,7].filter(d=>Date.parse(r.at)+d*DAY<todayMs).length}));
  const assess=(due:number,missing:number,noun:string):NonNullable<LandingModel['framework']>['assessment']['heroes']=>
    !status.fresh?{tone:'neutral',label:'Refresh channel data'}:missing>0?{tone:'behind',label:`${missing} ${noun} to review`}:due>0?{tone:'good',label:'On track to date'}:{tone:'neutral',label:'Not due yet'};
  const assessment={heroes:assess(heroDue.length,heroDue.filter(r=>!r.long).length,'release video'),
    followUps:assess(followDue.length,followDue.filter(r=>r.long<2).length,'follow-up'),
    shorts:assess(shortDue.reduce((n,x)=>n+x.due,0),shortDue.reduce((n,x)=>n+Math.max(0,x.due-x.r.shorts),0),'Shorts')};
  const recentGuideMoments=momentDates.reduce((n,at)=>n+[-3,0,7].filter(d=>{const day=Date.parse(at)+d*DAY;return day>=now-28*DAY&&day<=now;}).length,0);
  const weeklyTarget=decisions['campaign:shorts-target']?.shortsWeeklyTarget;
  // Working campaign floor: two Shorts/week, with release moments able to
  // raise the guide. A deliberate saved team target still takes precedence.
  const guideCount=weeklyTarget!=null?weeklyTarget*4:Math.max(8,recentGuideMoments);
  const cadenceFigure=figures.find(f=>f.label==='Shorts / week');
  if(cadenceFigure&&guideCount>0&&status.fresh){
    cadenceFigure.tone=status.shortsRead.count>=guideCount?'good':'behind';
    cadenceFigure.period=`${weeklyTarget!=null?'Team target':'Campaign guide'} ≥${Math.round(guideCount/4*10)/10}/wk · ${status.shortsRead.count}/${guideCount} in last 28 days`;
  }
  const framework={singles:tracks.length,heroes:trackCounts.filter(r=>r.long>0).length,
    followUps:trackCounts.filter(r=>r.long>1).length,shorts:trackCounts.reduce((n,r)=>n+r.shorts,0),
    shortsTarget:tracks.length*3,next28Shorts,assessment,
    upcomingMoments:momentDates.filter(at=>Date.parse(at)>=Date.parse(today)&&Date.parse(at)<Date.parse(today)+28*DAY).length};
  return {
    framework,
    artist: artistName,
    nextMoment: status.nextMoment,
    project: projectName,
    stageLine: [status.current, status.next ? `next ${status.next}` : null]
      .filter(Boolean).join(' · '),
    windowLabel,
    actions,
    coverage: tracks.map(t => {
      const uploads = Array.from(new Set(t.actions.filter(a=>a.video&&!a.scheduled).map(a=>a.video!.id)))
        .flatMap(id=>{const u=evidence.uploads.find(u=>u.id===id); return u?[toUploadRef(u)]:[];});
      const actualDate=uploads.filter(u=>u.shape==='long').map(u=>u.publishedAt.slice(0,10)).sort()[0]??t.releaseDate;
      const age=Math.floor((Date.parse(today)-Date.parse(actualDate))/DAY);
      const guide=age< -3?'Teaser before launch':age<0?'Teaser window':age<=6?'Launch support':age<=14?'Follow-up window':'Review support';
      return {name:t.name,date:shortDate(actualDate),guide,cells:[
        ['Music video','Official Music Video','omv'],['Lyric','Lyric Video','lyric'],
        ['Visualiser','Visualiser','visualiser'],['Live / acoustic','Live Performance','live'],['Shorts','Short','short']
      ].map(([label,format,key])=>({label:key==='omv'&&!uploads.some(u=>u.format==='Official Music Video')&&uploads.some(u=>u.format==='Video')?'Video':label,
        count:uploads.filter(u=>u.format===format||(key==='live'&&u.format==='Acoustic')||(key==='omv'&&!uploads.some(v=>v.format==='Official Music Video')&&u.format==='Video')).length,
        reported:key==='lyric'&&uploads.some(u=>u.shape==='short'&&/lyric video/i.test(u.title)),
        planned:t.actions.some(a=>!a.video&&(a.format===key||a.format.startsWith(key+':'))&&stateOf(a,decisions)==='agreed')}))};
    }),
    shortsProgress: {count:status.shortsRead.count,weekly:status.shortsRead.weekly,average:status.shortsRead.mean,
      target:decisions['campaign:shorts-target']?.shortsWeeklyTarget ?? null},
    figures,
    latest: campaignUploads.find(u => u.shape === 'long') ? {...campaignUploads.find(u => u.shape === 'long')!, likes:null} : null,
    paceLine: campaignUploads.find(u => u.shape === 'long')?.id === anchorUpload?.id ? status.launch : null,
    fan: status.audience
      ? {
          quote: '', likes: 0,
          commentsOnAsset: status.audience.comments,
          assetLabel: `${status.audience.assets} campaign asset${status.audience.assets === 1 ? '' : 's'}`,
          at: status.audience.date,
          tone: status.audience.tone,
          theme: status.audience.theme,
        }
      : null,
    assets: {
      long: campaignUploads.filter(u => u.shape === 'long'),
      shorts: campaignUploads.filter(u => u.shape === 'short'),
    },
    rollout:rollout.map(r=>{const counts=trackCounts.find(c=>c.t.name===r.name);return counts?{...r,
      supportSummary:`Release video ${counts.long?'✓':'—'} · Follow-up ${counts.long>1?'✓':'—'} · Shorts ${counts.shorts}/3 guide`}:r;}),
    caveats: [
      status.metrics
        ? `Campaign figures are measured over ${windowLabel}. Whole-channel growth includes the back catalogue and is not shown here.`
        : 'No campaign window is set, so campaign totals are not shown.',
      evidence.dive
        ? `Deep dive read ${evidence.dive.dataCapturedAt ? shortDate(evidence.dive.dataCapturedAt) : "date unavailable"}. Findings are historical and reconfirmed against the current channel reading.`
        : 'No deep dive for this artist. Suggestions use the channel reading and general release guidance, and say which.',
      !status.fresh ? 'The channel reading is more than three days old, so suggestions are held back until it refreshes.' : '',
      'Progress ticks are stored against this campaign when saved.',
    ].filter(Boolean),
  };
}
