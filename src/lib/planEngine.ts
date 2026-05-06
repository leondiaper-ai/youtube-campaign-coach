/**
 * Plan Engine — YouTube campaign strategist.
 *
 * Input:  messy timeline text + optional channel state
 * Output: context-aware YouTube rollout with strategic insights,
 *         varied actions, collab logic, and gap detection.
 *
 * This is NOT a calendar builder. It thinks about what actually
 * makes sense for THIS artist and THIS campaign.
 */

import type { ChannelState } from './artists';

// ── Types ─────────────────────────────────────────────────────────────────

export type PhaseName = 'BUILD' | 'RELEASE' | 'SCALE' | 'EXTEND';

export type TimelineKind =
  | 'singleRelease' | 'albumRelease' | 'albumAnnounce'
  | 'documentaryTease' | 'documentaryRelease'
  | 'podcast' | 'snippet'
  | 'tourAnnounce' | 'tourDate' | 'festival' | 'liveShow'
  | 'promoTrip' | 'collab' | 'other';

export type ParsedEvent = {
  dateISO: string;
  title: string;
  kind: TimelineKind;
  featuredArtist?: string;
  /** Is this a major campaign moment? */
  scale: 'anchor' | 'major' | 'standard' | 'minor';
};

export type ContentAction = {
  title: string;
  format: 'short' | 'video' | 'post' | 'live' | 'premiere' | 'community';
  day: number;
};

export type PlanWeek = {
  weekNum: number;
  dateRange: string;
  phase: PhaseName;
  actions: ContentAction[];
  momentName?: string;
  /** Strategic observation — editorial, concise, human */
  insight?: string;
};

export type CampaignStrategy = {
  priority: string;
  approach: string;
};

export type GeneratedPlan = {
  artist: string;
  campaignName: string;
  strategy: CampaignStrategy;
  weeks: PlanWeek[];
  phases: { name: PhaseName; weekStart: number; weekEnd: number }[];
  totalWeeks: number;
  events: ParsedEvent[];
  /** Top-level strategic insights about the campaign shape */
  campaignInsights: string[];
};

export type ChannelContext = {
  state: ChannelState;
  uploads30d: number;
  shorts30d: number;
  subs?: number;
  views7Delta?: number | null;
  subs7Delta?: number | null;
  lastUploadDaysAgo?: number;
  momentum?: 'rising' | 'flat' | 'falling';
};

// ── Constants ─────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

const COLLAB_RE = /\b(?:feat\.?|ft\.?|featuring|with|x)\s+(.+)/i;

// ── Timeline Parsing ──────────────────────────────────────────────────────

function classifyEvent(title: string): TimelineKind {
  const t = title.toLowerCase();
  if (/\bpodcast|interview\b/.test(t)) return 'podcast';
  if (/\bsnippet|sound\b/.test(t)) return 'snippet';
  if (/\btour\b/.test(t) && /\b(announce|tickets?|on\s*sale)\b/.test(t)) return 'tourAnnounce';
  if (/\bfestival\b/.test(t)) return 'festival';
  if (/\b(trnsmt|glastonbury|reading|leeds|latitude|parklife|wireless|primavera|coachella)\b/.test(t)) return 'festival';
  if (/\btour\b/.test(t) && /\b(start|leg|date|kick|night|show|gig)\b/.test(t)) return 'tourDate';
  if (/\btour\b/.test(t)) return 'tourDate';
  if (/\b(live\s*show|gig|concert|instore|headline\s*show|support\s*show)\b/.test(t)) return 'liveShow';
  if (/\b(promo\s*trip|press\s*trip|radio\s*promo)\b/.test(t)) return 'promoTrip';
  if (/\bdocumentary\b.*\b(tease|trailer)\b/.test(t)) return 'documentaryTease';
  if (/\bdocumentary|mini[\s-]?doc|film\b/.test(t)) return 'documentaryRelease';
  if (/\bdeluxe\b.*\b(album|release)\b/.test(t)) return 'albumRelease';
  if (/\balbum\b.*\b(announc|reveal)\b/.test(t) || /\b(announc|reveal)\b.*\balbum\b/.test(t)) return 'albumAnnounce';
  if (/\balbum\b.*\b(release|launch|out|drop)\b/.test(t)) return 'albumRelease';
  if (/\bsingle\b.*\b(release|out|drop)\b/.test(t) || /\bofficial\s*(music\s*)?video\b/.test(t)) return 'singleRelease';
  if (/\brelease\b/.test(t)) return 'singleRelease';
  return 'other';
}

function detectFeaturedArtist(title: string): string | undefined {
  const m = title.match(COLLAB_RE);
  if (m) return m[1].replace(/["'()]/g, '').trim();
  return undefined;
}

function assignScale(kind: TimelineKind): ParsedEvent['scale'] {
  switch (kind) {
    case 'albumRelease':
    case 'documentaryRelease':
      return 'anchor';
    case 'singleRelease':
    case 'albumAnnounce':
    case 'tourAnnounce':
    case 'documentaryTease':
      return 'major';
    case 'festival':
    case 'tourDate':
    case 'liveShow':
      return 'standard';
    default:
      return 'minor';
  }
}

export function parseTimeline(text: string): ParsedEvent[] {
  const fallbackYear = new Date().getFullYear();
  const lines = text.split(/\r?\n/);
  const events: ParsedEvent[] = [];

  for (const raw of lines) {
    let line = raw.trim().replace(/^[-•*•]\s*/, '');
    if (!line) continue;

    line = line.replace(/^(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)\s+/i, '');

    let day: number | null = null;
    let month: number | undefined;
    let year = fallbackYear;
    let consumed = 0;

    const yearMatch = line.match(/\b(20\d{2})\b/);
    if (yearMatch) year = parseInt(yearMatch[1], 10);

    const dayFirst = line.match(/^(?:w\/c\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:\s*[-–—]\s*\d{1,2}(?:st|nd|rd|th)?)?\s+([A-Za-z]+)/);
    if (dayFirst) {
      const d = parseInt(dayFirst[1], 10);
      const mo = MONTH_MAP[dayFirst[2].toLowerCase()];
      if (mo != null && d >= 1 && d <= 31) { day = d; month = mo; consumed = dayFirst[0].length; }
    }

    if (month == null) {
      const monthFirst = line.match(/^([A-Za-z]+)(?:\s+(20\d{2}))?\s+(\d{1,2})(?:st|nd|rd|th)?/);
      if (monthFirst) {
        const mo = MONTH_MAP[monthFirst[1].toLowerCase()];
        if (mo != null) {
          month = mo;
          day = parseInt(monthFirst[3], 10);
          if (monthFirst[2]) year = parseInt(monthFirst[2], 10);
          consumed = monthFirst[0].length;
        }
      }
    }

    if (month == null) {
      const moOnly = line.match(/^([A-Za-z]+)(?:\s*\/\s*[A-Za-z]+)?(?:\s+(20\d{2}))?/);
      if (moOnly) {
        const mo = MONTH_MAP[moOnly[1].toLowerCase()];
        if (mo != null) { month = mo; day = 15; if (moOnly[2]) year = parseInt(moOnly[2], 10); consumed = moOnly[0].length; }
      }
    }

    if (month == null || day == null) continue;

    const dt = new Date(Date.UTC(year, month, day, 12, 0, 0));
    const dateISO = dt.toISOString().split('T')[0];

    let rest = line.slice(consumed).replace(/^\s*(?:20\d{2})?\s*/, '').replace(/^\s*[-–—:]+\s*/, '').trim();
    if (!rest || rest.length < 3) continue;

    const kind = classifyEvent(rest);
    const featuredArtist = detectFeaturedArtist(rest);
    const scale = assignScale(kind);

    events.push({ dateISO, title: rest, kind, featuredArtist, scale });
  }

  return events.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
}

// ── Context-Aware Action Generation ─────────────────────────────────────

type ActionContext = {
  channelCtx: ChannelContext | null;
  releaseIndex: number;      // 0-indexed: how many releases before this one
  totalReleases: number;
  hasCollab: boolean;
  collabName?: string;
  campaignHasDoc: boolean;
  campaignHasTour: boolean;
  eventScale: ParsedEvent['scale'];
};

function actionsForEvent(event: ParsedEvent, actx: ActionContext): ContentAction[] {
  const ref = event.title.length > 40 ? event.title.slice(0, 37) + '…' : event.title;
  const ctx = actx.channelCtx;
  const isHealthy = ctx && (ctx.state === 'HEALTHY' || ctx.state === 'BUILDING');
  const isCold = ctx && (ctx.state === 'COLD' || ctx.state === 'AT RISK');
  const hasBigSubs = ctx && ctx.subs != null && ctx.subs > 50000;
  const isFirstRelease = actx.releaseIndex === 0;
  const isLaterRelease = actx.releaseIndex > 0;

  switch (event.kind) {
    case 'singleRelease': {
      const actions: ContentAction[] = [];

      // First single gets full treatment; later singles get lighter
      if (isFirstRelease || event.scale === 'anchor') {
        actions.push({ title: `Teaser Short — ${ref}`, format: 'short', day: -3 });
      }
      if (isFirstRelease) {
        actions.push({ title: `Snippet Short — ${ref}`, format: 'short', day: -1 });
      }

      // Official video — Premiere if channel supports it
      if (isHealthy && hasBigSubs) {
        actions.push({ title: `Premiere — ${ref}`, format: 'premiere', day: 0 });
      } else {
        actions.push({ title: `Official Video — ${ref}`, format: 'video', day: 0 });
      }

      actions.push({ title: `Community — out now`, format: 'community', day: 0 });

      // Collab-specific
      if (event.featuredArtist) {
        actions.push({ title: `Collab Short with ${event.featuredArtist}`, format: 'short', day: 1 });
        actions.push({ title: `Cross-channel Community Post`, format: 'community', day: 1 });
      } else if (isFirstRelease) {
        // BTS only for first single (avoids repetition)
        actions.push({ title: `BTS Short — making of ${ref}`, format: 'short', day: 1 });
      }

      // Lyric/visualizer only for first or anchor release
      if (isFirstRelease) {
        actions.push({ title: `Lyric Video — ${ref}`, format: 'video', day: 7 });
      }

      // Afterparty for big channels on first release
      if (isFirstRelease && hasBigSubs && isHealthy) {
        actions.push({ title: `Afterparty activation`, format: 'live', day: 0 });
      }

      return actions;
    }

    case 'albumRelease': {
      const actions: ContentAction[] = [];
      actions.push({ title: `Album Trailer`, format: 'video', day: -5 });
      if (!isCold) {
        actions.push({ title: `BTS Short — making the album`, format: 'short', day: -3 });
      }

      // Premiere for healthy channels, standard drop otherwise
      if (isHealthy && hasBigSubs) {
        actions.push({ title: `Album Premiere`, format: 'premiere', day: 0 });
        actions.push({ title: `Afterparty — album listening session`, format: 'live', day: 0 });
      } else {
        actions.push({ title: `Album Drop`, format: 'video', day: 0 });
      }

      actions.push({ title: `Community — album out now`, format: 'community', day: 0 });
      actions.push({ title: `Track-by-Track Breakdown`, format: 'video', day: 2 });
      actions.push({ title: `Lyric Video — lead single`, format: 'video', day: 5 });

      // If there's tour, connect them
      if (actx.campaignHasTour) {
        actions.push({ title: `Community — tour dates reminder`, format: 'community', day: 3 });
      }

      return actions;
    }

    case 'albumAnnounce':
      return [
        { title: `Announcement Video`, format: 'video', day: 0 },
        { title: `Community — pre-save`, format: 'community', day: 0 },
        ...(isCold ? [{ title: `Warm-up Short — album incoming`, format: 'short' as const, day: 2 }] : []),
        { title: `Tracklist Tease Short`, format: 'short', day: 3 },
      ];

    case 'documentaryRelease': {
      // Documentary is a campaign anchor — scale up
      const actions: ContentAction[] = [
        { title: `Documentary Trailer`, format: 'video', day: -7 },
        { title: `Community — documentary coming`, format: 'community', day: -5 },
        { title: `BTS Short — filming the documentary`, format: 'short', day: -3 },
      ];
      if (isHealthy) {
        actions.push({ title: `Documentary Premiere`, format: 'premiere', day: 0 });
      } else {
        actions.push({ title: `Documentary Release`, format: 'video', day: 0 });
      }
      actions.push({ title: `Community — watch now`, format: 'community', day: 0 });
      actions.push({ title: `Fan Reaction Short`, format: 'short', day: 1 });
      actions.push({ title: `Director/Artist Commentary Short`, format: 'short', day: 3 });
      // Sustain
      actions.push({ title: `Key Scene Short`, format: 'short', day: 5 });
      return actions;
    }

    case 'documentaryTease':
      return [
        { title: `Documentary Teaser`, format: 'video', day: 0 },
        { title: `Community — documentary announcement`, format: 'community', day: 0 },
      ];

    case 'tourAnnounce':
      return [
        { title: `Tour Announcement`, format: 'video', day: 0 },
        { title: `Community — tour dates + ticket links`, format: 'community', day: 0 },
        ...(isHealthy ? [{ title: `Tour Hype Short`, format: 'short' as const, day: 1 }] : []),
      ];

    case 'tourDate':
      // Keep tour dates light — avoid repeating the same template per show
      return [
        { title: `Community — tonight's show`, format: 'community', day: 0 },
        { title: `Recap Short`, format: 'short', day: 1 },
      ];

    case 'festival':
      return [
        { title: `Performance Clip Short`, format: 'short', day: 0 },
        { title: `Crowd / Backstage Short`, format: 'short', day: 1 },
        ...(event.scale !== 'minor' ? [{ title: `Festival Recap`, format: 'video' as const, day: 4 }] : []),
      ];

    case 'liveShow':
      return [
        { title: `Community — show tonight`, format: 'community', day: 0 },
        { title: `Live Recap Short`, format: 'short', day: 1 },
      ];

    case 'podcast':
      return [
        { title: `Clip Short — best moment`, format: 'short', day: 1 },
      ];

    case 'promoTrip':
      return [
        { title: `Artist-led Vlog Short`, format: 'short', day: 1 },
        { title: `Trip Recap`, format: 'video', day: 5 },
      ];

    default:
      return [
        { title: `Community — ${ref}`, format: 'community', day: 0 },
      ];
  }
}

// ── Gap Detection & Bridge Content ──────────────────────────────────────

function detectGaps(events: ParsedEvent[]): { afterEventIdx: number; gapDays: number }[] {
  const gaps: { afterEventIdx: number; gapDays: number }[] = [];
  for (let i = 1; i < events.length; i++) {
    const prev = new Date(events[i - 1].dateISO).getTime();
    const curr = new Date(events[i].dateISO).getTime();
    const gapDays = Math.round((curr - prev) / 86400000);
    if (gapDays > 18) {
      gaps.push({ afterEventIdx: i - 1, gapDays });
    }
  }
  return gaps;
}

function bridgeActions(ctx: ChannelContext | null): ContentAction[] {
  const isCold = ctx && (ctx.state === 'COLD' || ctx.state === 'AT RISK');
  if (isCold) {
    return [
      { title: `Artist-led Short — keep the channel warm`, format: 'short', day: 0 },
      { title: `Community — fan Q&A or poll`, format: 'community', day: 3 },
    ];
  }
  return [
    { title: `Artist-led moment — bridge content`, format: 'short', day: 0 },
  ];
}

// ── Strategic Insights ──────────────────────────────────────────────────

function generateCampaignInsights(
  events: ParsedEvent[],
  ctx: ChannelContext | null,
  gaps: { afterEventIdx: number; gapDays: number }[],
): string[] {
  const insights: string[] = [];
  const hasRelease = events.some((e) => RELEASE_KINDS.has(e.kind));
  const hasDoc = events.some((e) => e.kind === 'documentaryRelease');
  const hasTour = events.some((e) => e.kind === 'tourDate' || e.kind === 'tourAnnounce');
  const hasCollab = events.some((e) => !!e.featuredArtist);
  const releases = events.filter((e) => e.kind === 'singleRelease' || e.kind === 'albumRelease');

  // Channel-state insights
  if (ctx) {
    if (ctx.state === 'COLD' && hasRelease) {
      insights.push('Channel is cold — warm-up Shorts added before the first release.');
    }
    if (ctx.momentum === 'rising' && hasRelease) {
      insights.push('Current momentum supports a Premiere launch.');
    }
    if (ctx.state === 'WEAK CONVERSION') {
      insights.push('Subscriber growth flat despite reach — prioritise deeper artist-connection content.');
    }
    if (ctx.shorts30d > 4 && ctx.momentum === 'rising') {
      insights.push('Shorts currently driving discovery — maintain cadence around release moments.');
    }
  }

  // Campaign shape insights
  if (hasDoc && hasRelease) {
    insights.push('Documentary acts as a second campaign spike — extend the release window.');
  }
  if (hasCollab) {
    insights.push('Feature release creates cross-audience opportunity via YouTube Collab tool.');
  }
  if (hasTour && hasRelease) {
    insights.push('Tour dates extend the album campaign — use live moments to sustain interest.');
  }
  if (releases.length > 3) {
    insights.push('Multiple releases — later singles get lighter support to avoid template fatigue.');
  }

  // Gap insights
  if (gaps.length > 0) {
    const bigGap = gaps.reduce((a, b) => a.gapDays > b.gapDays ? a : b);
    if (bigGap.gapDays > 28) {
      insights.push(`${bigGap.gapDays}-day gap in the campaign — bridge content added to hold momentum.`);
    }
  }

  return insights.slice(0, 4); // Max 4 top-level insights
}

function weekInsight(
  week: PlanWeek,
  events: ParsedEvent[],
  ctx: ChannelContext | null,
  weekEvents: ParsedEvent[],
  gapWeek: boolean,
  phase: PhaseName,
): string | undefined {
  // Only some weeks get insights — avoid noise
  if (weekEvents.length === 0 && !gapWeek) return undefined;

  const ev = weekEvents[0];

  if (gapWeek) {
    return 'Gap between moments — artist-led content maintains audience connection.';
  }

  if (ev?.featuredArtist) {
    return `Feature with ${ev.featuredArtist} — leverage YouTube Collab tool for cross-audience reach.`;
  }

  if (ev?.kind === 'documentaryRelease') {
    return 'Documentary anchor — this is a major fan engagement moment. Scale support accordingly.';
  }

  if (ev?.kind === 'albumRelease') {
    return 'Album drop week — all channels point here. Extend with supporting assets post-release.';
  }

  if (ev?.kind === 'tourAnnounce') {
    return 'Tour announcement can become a strong Community moment.';
  }

  if (ev?.kind === 'festival' && ev.scale !== 'minor') {
    return 'Festival moment — capture live energy for Shorts and recap.';
  }

  if (phase === 'BUILD' && ctx?.state === 'COLD') {
    return 'Channel warming through Shorts — build cadence before release.';
  }

  return undefined;
}

// ── Phase Assignment ──────────────────────────────────────────────────────

const RELEASE_KINDS = new Set<TimelineKind>(['singleRelease', 'albumRelease', 'albumAnnounce', 'documentaryRelease']);

function assignPhases(events: ParsedEvent[], totalWeeks: number, startISO: string): { name: PhaseName; weekStart: number; weekEnd: number }[] {
  const firstRelease = events.find((e) => RELEASE_KINDS.has(e.kind));
  const firstReleaseWeek = firstRelease ? weekForDate(startISO, firstRelease.dateISO) : 1;

  const phases: { name: PhaseName; weekStart: number; weekEnd: number }[] = [];

  if (firstReleaseWeek > 1) {
    phases.push({ name: 'BUILD', weekStart: 1, weekEnd: firstReleaseWeek - 1 });
  }

  const releaseEvents = events.filter((e) => RELEASE_KINDS.has(e.kind));
  const lastReleaseWeek = releaseEvents.length > 0
    ? Math.max(...releaseEvents.map((e) => weekForDate(startISO, e.dateISO)))
    : firstReleaseWeek;

  phases.push({ name: 'RELEASE', weekStart: firstReleaseWeek, weekEnd: lastReleaseWeek + 1 });

  const scaleStart = lastReleaseWeek + 2;
  const scaleEnd = Math.min(totalWeeks, scaleStart + 8);
  if (scaleStart <= totalWeeks) {
    phases.push({ name: 'SCALE', weekStart: scaleStart, weekEnd: scaleEnd });
  }

  if (scaleEnd < totalWeeks) {
    phases.push({ name: 'EXTEND', weekStart: scaleEnd + 1, weekEnd: totalWeeks });
  }

  return phases;
}

function weekForDate(startISO: string, dateISO: string): number {
  const start = new Date(startISO + 'T12:00:00').getTime();
  const target = new Date(dateISO + 'T12:00:00').getTime();
  return Math.max(1, Math.ceil((target - start) / (7 * 86400000)));
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ── Strategy ─────────────────────────────────────────────────────────────

function generateStrategy(ctx: ChannelContext | null, events: ParsedEvent[]): CampaignStrategy {
  const hasRelease = events.some((e) => RELEASE_KINDS.has(e.kind));
  const hasDoc = events.some((e) => e.kind === 'documentaryRelease');
  const hasCollab = events.some((e) => !!e.featuredArtist);
  const hasTour = events.some((e) => e.kind === 'tourDate' || e.kind === 'tourAnnounce');

  if (!ctx) {
    if (hasDoc && hasRelease) {
      return {
        priority: 'Multi-format campaign — album and documentary create two release peaks.',
        approach: 'Build into the first release, sustain through supporting assets, then spike again with the documentary. Use Shorts and Community to bridge the gaps.',
      };
    }
    return {
      priority: hasRelease ? 'Build momentum into the release window.' : 'Establish consistent cadence.',
      approach: 'Use a mix of Shorts, Community Posts and artist-led moments to build audience engagement ahead of key moments.',
    };
  }

  switch (ctx.state) {
    case 'COLD':
      return {
        priority: 'Warm dormant audience before release.',
        approach: hasCollab
          ? `Channel is cold — use the feature release to re-engage. Cross-audience reach via Collab tool can bootstrap discovery before the main release.`
          : `Channel needs reactivation. Use Shorts and artist-led moments to rebuild presence 2–3 weeks before the first official release. Don't launch cold.`,
      };
    case 'AT RISK':
      return {
        priority: 'Reactivate channel before campaign peak.',
        approach: 'Immediate cadence ramp-up with low-effort Shorts and Community Posts. Build consistency before asking the audience to show up for a release.',
      };
    case 'WEAK CONVERSION':
      return {
        priority: 'Convert views into subscribers before scaling reach.',
        approach: 'Prioritise deeper artist-connection content — BTS, commentary, fan interaction. Fix conversion before pouring more reach into discovery.',
      };
    case 'BUILDING':
      return {
        priority: hasRelease ? 'Sustain momentum into the release window.' : 'Continue building cadence and audience connection.',
        approach: hasTour
          ? 'Channel is gaining traction. Maintain Shorts cadence, use Premiere for the release, and let tour dates sustain the campaign through live moments.'
          : 'Channel is gaining traction. Maintain Shorts cadence, add Premiere for the release, and use Community Posts to keep fans engaged between drops.',
      };
    case 'HEALTHY':
      return {
        priority: hasRelease ? 'Maximise impact of the release moment.' : 'Extend growth and explore new formats.',
        approach: hasDoc
          ? 'Channel is strong. Use Premiere and Afterparty for the main release. Documentary extends the campaign window — treat it as a second peak, not an afterthought.'
          : 'Channel is strong. Use Premiere + Afterparty. Extend the release window with supporting assets. Multi-format ecosystem around the drop.',
      };
    default:
      return {
        priority: 'Build consistent YouTube presence.',
        approach: 'Focus on regular posting cadence and audience engagement.',
      };
  }
}

// ── Warm-up Actions for Cold Channels ───────────────────────────────────

function warmUpActions(weekNum: number, totalBuildWeeks: number): ContentAction[] {
  // Vary the warm-up — don't repeat the same thing every week
  if (weekNum === 1) {
    return [
      { title: `Artist-led Short — re-introduce`, format: 'short', day: 0 },
      { title: `Community — what's coming`, format: 'community', day: 2 },
    ];
  }
  if (weekNum === 2) {
    return [
      { title: `Snippet or throwback Short`, format: 'short', day: 0 },
    ];
  }
  if (weekNum <= totalBuildWeeks) {
    return [
      { title: `Artist-led Short — build anticipation`, format: 'short', day: 0 },
    ];
  }
  return [];
}

// ── Main Plan Generation ──────────────────────────────────────────────────

export function generatePlan(
  timelineText: string,
  artist: string,
  channelCtx?: ChannelContext | null,
): GeneratedPlan | null {
  const events = parseTimeline(timelineText);
  if (events.length === 0) return null;

  const ctx = channelCtx ?? null;
  const campaignName = artist ? `${artist} Campaign` : 'YouTube Campaign';
  const isCold = ctx && (ctx.state === 'COLD' || ctx.state === 'AT RISK');

  // Campaign shape analysis
  const campaignHasDoc = events.some((e) => e.kind === 'documentaryRelease');
  const campaignHasTour = events.some((e) => e.kind === 'tourDate' || e.kind === 'tourAnnounce');
  const releases = events.filter((e) =>
    e.kind === 'singleRelease' || e.kind === 'albumRelease'
  );

  // Date range
  const startISO = addDays(events[0].dateISO, -7);
  const endISO = addDays(events[events.length - 1].dateISO, 21);
  const startMs = new Date(startISO + 'T12:00:00').getTime();
  const endMs = new Date(endISO + 'T12:00:00').getTime();
  const totalWeeks = Math.max(12, Math.ceil((endMs - startMs) / (7 * 86400000)));

  // Detect gaps
  const gaps = detectGaps(events);
  const gapWeeks = new Set<number>();
  for (const gap of gaps) {
    // Add bridge content in the middle of the gap
    const ev = events[gap.afterEventIdx];
    const midDate = addDays(ev.dateISO, Math.floor(gap.gapDays / 2));
    const midWeek = weekForDate(startISO, midDate);
    gapWeeks.add(midWeek);
  }

  // Phases
  const phases = assignPhases(events, totalWeeks, startISO);
  const buildPhase = phases.find((p) => p.name === 'BUILD');
  const totalBuildWeeks = buildPhase ? buildPhase.weekEnd - buildPhase.weekStart + 1 : 0;

  // Build weekly plan
  const weeks: PlanWeek[] = [];
  const fmt = (d: Date) => `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;
  let releaseCounter = 0;

  for (let i = 0; i < totalWeeks; i++) {
    const ws = new Date(startMs + i * 7 * 86400000);
    const we = new Date(ws.getTime() + 6 * 86400000);
    const weekNum = i + 1;
    const phase = phases.find((p) => weekNum >= p.weekStart && weekNum <= p.weekEnd)?.name ?? 'BUILD';

    const weekStart = ws.getTime();
    const weekEnd = we.getTime() + 86400000;
    const weekEvents = events.filter((e) => {
      const t = new Date(e.dateISO + 'T12:00:00').getTime();
      return t >= weekStart && t < weekEnd;
    });

    // Generate context-aware actions
    const actions: ContentAction[] = [];
    const isGapWeek = gapWeeks.has(weekNum);

    for (const ev of weekEvents) {
      const isRelease = ev.kind === 'singleRelease' || ev.kind === 'albumRelease';
      const actx: ActionContext = {
        channelCtx: ctx,
        releaseIndex: isRelease ? releaseCounter : 0,
        totalReleases: releases.length,
        hasCollab: !!ev.featuredArtist,
        collabName: ev.featuredArtist,
        campaignHasDoc,
        campaignHasTour,
        eventScale: ev.scale,
      };

      const template = actionsForEvent(ev, actx);
      for (const a of template) {
        if (a.day >= -7 && a.day <= 7) actions.push(a);
      }

      if (isRelease) releaseCounter++;
    }

    // Cold channel warm-up in BUILD phase
    if (phase === 'BUILD' && isCold && weekEvents.length === 0) {
      const warmUp = warmUpActions(weekNum - (buildPhase?.weekStart ?? 1) + 1, totalBuildWeeks);
      actions.push(...warmUp);
    }

    // Bridge content for gap weeks (only if no events this week)
    if (isGapWeek && weekEvents.length === 0) {
      actions.push(...bridgeActions(ctx));
    }

    // Strategic insight for this week
    const insight = weekInsight(
      { weekNum, dateRange: '', phase, actions, momentName: undefined },
      events,
      ctx,
      weekEvents,
      isGapWeek && weekEvents.length === 0,
      phase,
    );

    weeks.push({
      weekNum,
      dateRange: `${fmt(ws)} – ${fmt(we)}`,
      phase,
      actions,
      momentName: weekEvents.length > 0 ? weekEvents[0].title : undefined,
      insight,
    });
  }

  const strategy = generateStrategy(ctx, events);
  const campaignInsights = generateCampaignInsights(events, ctx, gaps);

  return {
    artist,
    campaignName,
    strategy,
    weeks,
    phases,
    totalWeeks,
    events,
    campaignInsights,
  };
}
