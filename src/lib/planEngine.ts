/**
 * Plan Engine — YouTube campaign planning intelligence.
 *
 * Extracts the core planning logic from the monolithic Coach component
 * into a reusable, testable module. This powers the "Build Content Plan"
 * hero flow.
 *
 * Input:  messy timeline text + optional channel state
 * Output: structured YouTube rollout with phases, weekly plan, watchouts,
 *         and contextual recommendations shaped by channel intelligence.
 */

import type { ChannelState } from './artists';

// ── Types ─────────────────────────────────────────────────────────────────

export type PhaseName = 'BUILD' | 'RELEASE' | 'SCALE' | 'EXTEND';

export type TimelineKind =
  | 'singleRelease' | 'albumRelease' | 'albumAnnounce'
  | 'documentaryTease' | 'documentaryRelease'
  | 'podcast' | 'snippet'
  | 'tourAnnounce' | 'tourDate' | 'festival' | 'liveShow'
  | 'promoTrip' | 'other';

export type ParsedEvent = {
  dateISO: string;
  title: string;
  kind: TimelineKind;
  featuredArtist?: string;
};

export type ContentAction = {
  title: string;
  format: 'short' | 'video' | 'post' | 'live' | 'premiere' | 'community';
  intent: 'tease' | 'engage' | 'convert' | 'distribute';
  day: number; // offset from moment date
};

export type PlanWeek = {
  weekNum: number;
  dateRange: string;
  phase: PhaseName;
  actions: ContentAction[];
  momentName?: string; // if a key moment falls in this week
};

export type Watchout = {
  severity: 'high' | 'medium';
  text: string;
};

export type Opportunity = {
  icon: string;
  title: string;
  reason: string; // contextual, earned recommendation
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
  watchouts: Watchout[];
  opportunities: Opportunity[];
  phases: { name: PhaseName; weekStart: number; weekEnd: number }[];
  totalWeeks: number;
  events: ParsedEvent[];
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
  if (/\bdocumentary\b/.test(t)) return 'documentaryRelease';
  if (/\bdeluxe\b.*\b(album|release)\b/.test(t)) return 'albumRelease';
  if (/\balbum\b.*\b(announc|reveal)\b/.test(t) || /\b(announc|reveal)\b.*\balbum\b/.test(t)) return 'albumAnnounce';
  if (/\balbum\b.*\b(release|launch|out|drop)\b/.test(t)) return 'albumRelease';
  if (/\bsingle\b.*\b(release|out|drop)\b/.test(t) || /\bofficial\s*(music\s*)?video\b/.test(t)) return 'singleRelease';
  if (/\brelease\b/.test(t)) return 'singleRelease';
  return 'other';
}

export function parseTimeline(text: string): ParsedEvent[] {
  const fallbackYear = new Date().getFullYear();
  const lines = text.split(/\r?\n/);
  const events: ParsedEvent[] = [];

  for (const raw of lines) {
    let line = raw.trim().replace(/^[-•*•]\s*/, '');
    if (!line) continue;

    // Strip leading day names
    line = line.replace(/^(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)\s+/i, '');

    let day: number | null = null;
    let month: number | undefined;
    let year = fallbackYear;
    let consumed = 0;

    const yearMatch = line.match(/\b(20\d{2})\b/);
    if (yearMatch) year = parseInt(yearMatch[1], 10);

    // Pattern: "DD Month" / "DDth Month"
    const dayFirst = line.match(/^(?:w\/c\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:\s*[-–—]\s*\d{1,2}(?:st|nd|rd|th)?)?\s+([A-Za-z]+)/);
    if (dayFirst) {
      const d = parseInt(dayFirst[1], 10);
      const mo = MONTH_MAP[dayFirst[2].toLowerCase()];
      if (mo != null && d >= 1 && d <= 31) { day = d; month = mo; consumed = dayFirst[0].length; }
    }

    // Pattern: "Month DD" / "Month – title"
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

    // Pattern: "Month – title" (month only)
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

    // Extract title
    let rest = line.slice(consumed).replace(/^\s*(?:20\d{2})?\s*/, '').replace(/^\s*[-–—:]+\s*/, '').trim();
    if (!rest || rest.length < 3) continue;

    const kind = classifyEvent(rest);
    events.push({ dateISO, title: rest, kind });
  }

  return events.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
}

// ── Content Templates per Event Kind ──────────────────────────────────────

function actionsForKind(kind: TimelineKind, title: string): ContentAction[] {
  const ref = title.length > 40 ? title.slice(0, 37) + '…' : title;

  switch (kind) {
    case 'singleRelease':
      return [
        { title: `Teaser Short — ${ref}`, format: 'short', intent: 'tease', day: -3 },
        { title: `Snippet Short — ${ref}`, format: 'short', intent: 'tease', day: -1 },
        { title: `${ref} — Official Video`, format: 'video', intent: 'convert', day: 0 },
        { title: `Community Post — out now`, format: 'community', intent: 'convert', day: 0 },
        { title: `BTS Short — making of ${ref}`, format: 'short', intent: 'engage', day: 1 },
        { title: `Reaction Short — fan responses`, format: 'short', intent: 'engage', day: 3 },
        { title: `Lyric Video — ${ref}`, format: 'video', intent: 'distribute', day: 7 },
      ];
    case 'albumRelease':
      return [
        { title: `Album Trailer`, format: 'video', intent: 'tease', day: -5 },
        { title: `BTS Short — making the album`, format: 'short', intent: 'tease', day: -3 },
        { title: `Countdown Short`, format: 'short', intent: 'tease', day: -1 },
        { title: `ALBUM DROP — full release`, format: 'video', intent: 'convert', day: 0 },
        { title: `Community Post — album out now`, format: 'community', intent: 'convert', day: 0 },
        { title: `Drop Day Recap Short`, format: 'short', intent: 'engage', day: 1 },
        { title: `Track-by-Track Breakdown`, format: 'video', intent: 'distribute', day: 2 },
        { title: `Fan Reactions Short`, format: 'short', intent: 'engage', day: 4 },
        { title: `Lyric Video — lead single`, format: 'video', intent: 'distribute', day: 5 },
      ];
    case 'albumAnnounce':
      return [
        { title: `Teaser Short — album incoming`, format: 'short', intent: 'tease', day: -2 },
        { title: `Album Announcement Video`, format: 'video', intent: 'convert', day: 0 },
        { title: `Community Post — pre-save CTA`, format: 'community', intent: 'convert', day: 0 },
        { title: `Tracklist Tease Short`, format: 'short', intent: 'tease', day: 3 },
      ];
    case 'tourAnnounce':
      return [
        { title: `Tour Announcement Video`, format: 'video', intent: 'convert', day: 0 },
        { title: `Community Post — tour dates`, format: 'community', intent: 'convert', day: 0 },
        { title: `Tour Hype Short`, format: 'short', intent: 'engage', day: 1 },
      ];
    case 'tourDate':
      return [
        { title: `Tour Diary Short — getting ready`, format: 'short', intent: 'engage', day: -1 },
        { title: `Community Post — tonight`, format: 'community', intent: 'engage', day: 0 },
        { title: `Tour Recap Short`, format: 'short', intent: 'engage', day: 1 },
      ];
    case 'festival':
      return [
        { title: `Festival Hype Short — countdown`, format: 'short', intent: 'tease', day: -2 },
        { title: `Performance Clip Short`, format: 'short', intent: 'engage', day: 0 },
        { title: `Crowd Reaction Short`, format: 'short', intent: 'engage', day: 1 },
        { title: `Festival Recap Video`, format: 'video', intent: 'engage', day: 4 },
      ];
    case 'liveShow':
      return [
        { title: `Community Post — show tonight`, format: 'community', intent: 'engage', day: 0 },
        { title: `Live Recap Short`, format: 'short', intent: 'engage', day: 1 },
      ];
    case 'podcast':
      return [
        { title: `Podcast Clip Short #1`, format: 'short', intent: 'engage', day: 1 },
        { title: `Podcast Clip Short #2`, format: 'short', intent: 'engage', day: 2 },
      ];
    case 'promoTrip':
      return [
        { title: `Promo Vlog Short`, format: 'short', intent: 'engage', day: 1 },
        { title: `Cultural Moments Short`, format: 'short', intent: 'engage', day: 2 },
        { title: `Promo Trip Recap Vlog`, format: 'video', intent: 'engage', day: 5 },
      ];
    default:
      return [
        { title: `Community Post — ${ref}`, format: 'community', intent: 'engage', day: 0 },
      ];
  }
}

// ── Phase Assignment ──────────────────────────────────────────────────────

const RELEASE_KINDS = new Set<TimelineKind>(['singleRelease', 'albumRelease', 'albumAnnounce', 'documentaryRelease']);
const SCALE_KINDS = new Set<TimelineKind>(['tourDate', 'tourAnnounce', 'festival', 'liveShow', 'promoTrip']);

function assignPhases(events: ParsedEvent[], totalWeeks: number, startISO: string): { name: PhaseName; weekStart: number; weekEnd: number }[] {
  const firstRelease = events.find((e) => RELEASE_KINDS.has(e.kind));
  const firstReleaseWeek = firstRelease ? weekForDate(startISO, firstRelease.dateISO) : 1;

  const phases: { name: PhaseName; weekStart: number; weekEnd: number }[] = [];

  if (firstReleaseWeek > 1) {
    phases.push({ name: 'BUILD', weekStart: 1, weekEnd: firstReleaseWeek - 1 });
  }

  // Find last release event
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

// ── Smart Recommendations (Channel-State-Aware) ───────────────────────────

function generateWatchouts(ctx: ChannelContext | null, events: ParsedEvent[]): Watchout[] {
  const watchouts: Watchout[] = [];

  if (!ctx) return watchouts;

  if (ctx.state === 'COLD' || (ctx.lastUploadDaysAgo != null && ctx.lastUploadDaysAgo > 30)) {
    watchouts.push({ severity: 'high', text: 'Channel is cold — audience needs reactivation before any release will perform' });
  }

  if (ctx.state === 'WEAK CONVERSION') {
    watchouts.push({ severity: 'high', text: "Weak subscriber conversion — views are coming but fans aren't sticking. Add deeper artist-connection content." });
  }

  if (ctx.uploads30d === 0 && ctx.shorts30d === 0) {
    watchouts.push({ severity: 'high', text: 'Zero uploads in 30 days — audience engagement will be low. Start warm-up immediately.' });
  } else if (ctx.uploads30d < 2 && ctx.shorts30d < 2) {
    watchouts.push({ severity: 'medium', text: "Very low posting cadence — algorithm won't surface new content without consistent activity." });
  }

  if (ctx.shorts30d === 0 && ctx.uploads30d > 0) {
    watchouts.push({ severity: 'medium', text: 'No Shorts usage — missing the primary reach driver for new audience discovery.' });
  }

  if (ctx.momentum === 'falling') {
    watchouts.push({ severity: 'medium', text: 'Channel momentum falling — recent performance is declining week-over-week.' });
  }

  // Gap detection: check for long gaps between events
  for (let i = 1; i < events.length; i++) {
    const prev = new Date(events[i - 1].dateISO).getTime();
    const curr = new Date(events[i].dateISO).getTime();
    const gapDays = Math.round((curr - prev) / 86400000);
    if (gapDays > 21) {
      watchouts.push({
        severity: 'medium',
        text: `${gapDays}-day gap between "${events[i - 1].title}" and "${events[i].title}" — fill with artist-led content to maintain momentum.`,
      });
      break; // only flag the biggest gap
    }
  }

  return watchouts;
}

function generateOpportunities(ctx: ChannelContext | null, events: ParsedEvent[]): Opportunity[] {
  const opps: Opportunity[] = [];
  const hasRelease = events.some((e) => RELEASE_KINDS.has(e.kind));
  const hasTour = events.some((e) => e.kind === 'tourDate' || e.kind === 'festival');

  // Premiere recommendation — only for releases with active channel
  if (hasRelease && ctx && (ctx.state === 'HEALTHY' || ctx.state === 'BUILDING')) {
    opps.push({
      icon: '🎬',
      title: 'Premiere recommended',
      reason: 'Active audience ready for a shared viewing moment. Premiere builds anticipation and chat engagement.',
    });
  }

  // Community Posts — underused across most channels
  if (ctx && ctx.uploads30d > 0) {
    opps.push({
      icon: '💬',
      title: 'Community cadence opportunity',
      reason: 'Community Posts keep fans engaged between uploads and boost algorithm signals at near-zero effort.',
    });
  }

  // Shorts warm-up for cold channels
  if (ctx && (ctx.state === 'COLD' || ctx.state === 'AT RISK') && hasRelease) {
    opps.push({
      icon: '⚡',
      title: 'Shorts warm-up critical',
      reason: 'Channel is cold — use Shorts to rebuild audience connection before the official video. Start 2–3 weeks ahead.',
    });
  }

  // Shorts driving reach growth
  if (ctx && ctx.shorts30d > 3 && ctx.momentum === 'rising') {
    opps.push({
      icon: '📈',
      title: 'Shorts driving growth — increase cadence',
      reason: 'Shorts currently driving reach momentum. Increase vertical cadence around release moments.',
    });
  }

  // Live activation for tour artists
  if (hasTour) {
    opps.push({
      icon: '🎤',
      title: 'Live stream opportunity',
      reason: 'Tour dates create natural live stream moments. Consider backstage Q&A or pre-show Live.',
    });
  }

  // Afterparty for big releases
  if (hasRelease && ctx && ctx.subs != null && ctx.subs > 50000) {
    opps.push({
      icon: '🎉',
      title: 'Afterparty opportunity',
      reason: 'Subscriber base supports an Afterparty activation. Creates fan engagement around the official video.',
    });
  }

  // Lyric / visualiser support
  if (hasRelease) {
    opps.push({
      icon: '🎵',
      title: 'Lyric/Visualiser follow-up',
      reason: 'Secondary visual assets extend the release window and capture search traffic for 2–4 weeks post-drop.',
    });
  }

  // BTS for weak conversion
  if (ctx && ctx.state === 'WEAK CONVERSION') {
    opps.push({
      icon: '🎥',
      title: 'BTS and artist-led content priority',
      reason: "Views are strong but fans aren't converting. Deeper artist-connection content (BTS, commentary, process) improves retention.",
    });
  }

  return opps;
}

function generateStrategy(ctx: ChannelContext | null, events: ParsedEvent[]): CampaignStrategy {
  const hasRelease = events.some((e) => RELEASE_KINDS.has(e.kind));

  if (!ctx) {
    return {
      priority: hasRelease ? 'Build momentum into the release window.' : 'Establish consistent cadence.',
      approach: 'Use a mix of Shorts, Community Posts and artist-led moments to build audience engagement ahead of key moments.',
    };
  }

  switch (ctx.state) {
    case 'COLD':
      return {
        priority: 'Warm dormant audience before release.',
        approach: 'Use Shorts + artist-led moments to rebuild audience connection. Start 2–3 weeks before the first official release. Don\'t launch cold.',
      };
    case 'AT RISK':
      return {
        priority: 'Reactivate channel before campaign peak.',
        approach: 'Immediate cadence ramp-up with low-effort Shorts and Community Posts. Build consistency before asking the audience to show up for a release.',
      };
    case 'WEAK CONVERSION':
      return {
        priority: 'Convert views into subscribers before scaling reach.',
        approach: 'Prioritise deeper artist-connection content (BTS, commentary, fan interaction). Fix conversion before pouring more reach into the top of funnel.',
      };
    case 'BUILDING':
      return {
        priority: hasRelease ? 'Sustain momentum into the release window.' : 'Continue building cadence and audience connection.',
        approach: 'Channel is gaining traction. Maintain Shorts cadence, add Premiere for the release, and use Community Posts to keep fans engaged between drops.',
      };
    case 'HEALTHY':
      return {
        priority: hasRelease ? 'Maximise impact of the release moment.' : 'Extend growth and explore new formats.',
        approach: 'Channel is strong. Use Premiere + live activation. Extend the release window with supporting assets. Consider Afterparty for the core fanbase.',
      };
    default:
      return {
        priority: 'Build consistent YouTube presence.',
        approach: 'Focus on regular posting cadence and audience engagement.',
      };
  }
}

// ── Main Plan Generation ──────────────────────────────────────────────────

export function generatePlan(
  timelineText: string,
  artist: string,
  channelCtx?: ChannelContext | null,
): GeneratedPlan | null {
  const events = parseTimeline(timelineText);
  if (events.length === 0) return null;

  const campaignName = artist ? `${artist} Campaign` : 'YouTube Campaign';

  // Calculate date range
  const startISO = addDays(events[0].dateISO, -7); // start 1 week before first event
  const endISO = addDays(events[events.length - 1].dateISO, 21); // end 3 weeks after last
  const startMs = new Date(startISO + 'T12:00:00').getTime();
  const endMs = new Date(endISO + 'T12:00:00').getTime();
  const totalWeeks = Math.max(12, Math.ceil((endMs - startMs) / (7 * 86400000)));

  // Build weekly plan
  const weeks: PlanWeek[] = [];
  const phases = assignPhases(events, totalWeeks, startISO);

  const fmt = (d: Date) => `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;
  for (let i = 0; i < totalWeeks; i++) {
    const ws = new Date(startMs + i * 7 * 86400000);
    const we = new Date(ws.getTime() + 6 * 86400000);
    const weekNum = i + 1;
    const phase = phases.find((p) => weekNum >= p.weekStart && weekNum <= p.weekEnd)?.name ?? 'BUILD';

    // Find events that fall in this week
    const weekStart = ws.getTime();
    const weekEnd = we.getTime() + 86400000;
    const weekEvents = events.filter((e) => {
      const t = new Date(e.dateISO + 'T12:00:00').getTime();
      return t >= weekStart && t < weekEnd;
    });

    // Generate actions for events in this week
    const actions: ContentAction[] = [];
    for (const ev of weekEvents) {
      const template = actionsForKind(ev.kind, ev.title);
      // Only include actions that fall within or after this week
      for (const a of template) {
        if (a.day >= -3 && a.day <= 7) actions.push(a);
      }
    }

    weeks.push({
      weekNum,
      dateRange: `${fmt(ws)} – ${fmt(we)}`,
      phase,
      actions,
      momentName: weekEvents.length > 0 ? weekEvents[0].title : undefined,
    });
  }

  // Generate intelligence-driven outputs
  const ctx = channelCtx ?? null;
  const strategy = generateStrategy(ctx, events);
  const watchouts = generateWatchouts(ctx, events);
  const opportunities = generateOpportunities(ctx, events);

  return {
    artist,
    campaignName,
    strategy,
    weeks,
    watchouts,
    opportunities,
    phases,
    totalWeeks,
    events,
  };
}
