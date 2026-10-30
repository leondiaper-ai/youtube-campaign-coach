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

import { classifyUploadFormat, getFormatMeta } from '../formatClassifier';
import { toCampaignUploads } from '../intelligence/campaignWindow';
import type { RecentUpload } from '../artists';
import type { CoachStatus } from './status';
import type { CoachEvidence, Decisions, RoadmapAction, TrackRoadmap } from './roadmap';
import { actionStatus } from './roadmap';
import {
  compact, exact, shortDate,
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
  const detected=classifyUploadFormat({...u,description:''});
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
      return {
        id: a.id,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        context: t.name,
        observation: ref ? `${ref.format} · ${ref.views==null?'Views unavailable':compact(ref.views)+' views'} · uploaded ${shortDate(ref.publishedAt)}` : undefined,
        due: due ? `by ${due}` : 'date to set',
        dueISO,
        dueTone: soon ? 'soon' : 'normal',
        reason: a.reason,
        evidence: [
          { heading: 'On the channel.', body: a.format.startsWith('campaign_') ? a.basis : a.format === 'hero'
            ? 'No release video identified yet. Confirm what is being prepared.'
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
  if (status.shortsRead.count > 0) {
    figures.push({
      value: `~${status.shortsRead.weekly}`, label: 'Shorts a week',
      period: status.shortsRead.mean != null
        ? `${compact(status.shortsRead.mean)} average · last 28 days · context only`
        : 'last 28 days · context only',
    });
  }
  if (anchorUpload) {
    figures.push({
      value: compact(anchorUpload.viewCount ?? 0),
      label: `${anchor!.t.name} views`,
      period: `since ${shortDate(anchorUpload.publishedAt)}`,
    });
  }

  /* ── rollout, from the same tracks and decisions ─────────────────── */
  const rollout: ReleaseBlock[] = [...tracks]
    .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate))
    .map((t): ReleaseBlock => {
      const live = t.actions.some(a => a.video && !a.scheduled);
      const isAnchor = anchor?.t.id === t.id;
      const future = t.releaseDate > today;
      const publishedLong = t.actions.filter(a => a.video && !a.scheduled && !a.format.startsWith('short'));
      const usedFormats = new Set(publishedLong.map(a => a.format.split(':')[0]));
      const followUpOptions = [['live','live performance'],['visualiser','visualiser'],['lyric','lyric video'],['bts','behind-the-scenes video']].filter(([key]) => !usedFormats.has(key)).slice(0,2).map(([,label]) => label);
      const opportunity = (!isAnchor || (publishedLong[0]?.video?.date ?? today) < new Date(now-14*DAY).toISOString().slice(0,10)) && !future && publishedLong.length === 1
        ? `No further long-form video identified for ${t.name}. Explore a ${followUpOptions.join(' or ')} if suitable material is available.`
        : undefined;
      const distant = future && Date.parse(t.releaseDate) - now > 45 * DAY && !live;

      if (distant) {
        return {
          name: t.name, dateLabel: shortDate(t.releaseDate), stage: 'distant',
          badge: { label: 'Planned', tone: 'ghost' }, assets: [],
          holding: 'Too far out to plan assets. Revisited once the current release has been read.',
        };
      }
      return {
        name: t.name,
        opportunity,
        dateLabel: shortDate(t.releaseDate),
        stage: isAnchor ? 'live' : live ? 'shipped' : 'upcoming',
        badge: isAnchor
          ? { label: 'Live', tone: 'ok' }
          : live ? { label: 'Shipped', tone: 'ghost' } : { label: 'In preparation', tone: 'warn' },
        /* ── why a suggestion is dropped here ──────────────────────
           buildRoadmap proposes a follow-up per track, independently.
           Rendered as-is that becomes the same row under every release:
           a follow-up for a single that shipped five weeks ago, and one
           for a single that has not come out. Neither is actionable.
           A follow-up is kept only on the release currently carrying the
           campaign — or anywhere the team has already agreed it, because
           a decision outranks our timing rule. */
        assets: t.actions.filter(a => {
          if (a.video && !a.scheduled) return true;
          if (stateOf(a, decisions) === 'agreed') return true;
          const kind = a.format.split(':')[0];
          return !FOLLOW_UP.includes(kind) || (isAnchor && !!a.date && a.date >= today && publishedLong.length < 2);
        }).map((a): ReleaseAsset => ({
          label: a.video && !a.scheduled ? a.video.title : (status.priorities.flatMap(t => t.actions).find(p => p.id === a.id)?.label.replace(`${t.name}: `, '') ?? a.label),
          note: a.video && !a.scheduled ? undefined : status.priorities.flatMap(t => t.actions).find(p => p.id === a.id)?.reason ?? a.reason,
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

  return {
    artist: artistName,
    nextMoment: status.nextMoment,
    project: projectName,
    stageLine: [status.current, status.next ? `next ${status.next}` : null]
      .filter(Boolean).join(' · '),
    windowLabel,
    actions,
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
    rollout,
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
