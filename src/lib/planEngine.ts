/**
 * Plan Engine — YouTube campaign rollout builder.
 *
 * Input:  messy timeline text + optional channel state
 * Output: structured YouTube rollout with phases, weekly plan, and strategy.
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
  day: number; // offset from moment date
};

export type PlanWeek = {
  weekNum: number;
  dateRange: string;
  phase: PhaseName;
  actions: ContentAction[];
  momentName?: string; // if a key moment falls in this week
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
        { title: `Teaser Short — ${ref}`, format: 'short', day: -3 },
        { title: `Snippet Short — ${ref}`, format: 'short', day: -1 },
        { title: `Official Video — ${ref}`, format: 'video', day: 0 },
        { title: `Community — out now`, format: 'community', day: 0 },
        { title: `BTS Short — making of ${ref}`, format: 'short', day: 1 },
        { title: `Fan Reaction Short`, format: 'short', day: 3 },
        { title: `Lyric Video — ${ref}`, format: 'video', day: 7 },
      ];
    case 'albumRelease':
      return [
        { title: `Album Trailer`, format: 'video', day: -5 },
        { title: `BTS Short — making the album`, format: 'short', day: -3 },
        { title: `Countdown Short`, format: 'short', day: -1 },
        { title: `Album Drop`, format: 'premiere', day: 0 },
        { title: `Community — album out now`, format: 'community', day: 0 },
        { title: `Drop Day Short`, format: 'short', day: 1 },
        { title: `Track-by-Track Breakdown`, format: 'video', day: 2 },
        { title: `Fan Reactions Short`, format: 'short', day: 4 },
        { title: `Lyric Video — lead single`, format: 'video', day: 5 },
      ];
    case 'albumAnnounce':
      return [
        { title: `Teaser Short — album incoming`, format: 'short', day: -2 },
        { title: `Announcement Video`, format: 'video', day: 0 },
        { title: `Community — pre-save`, format: 'community', day: 0 },
        { title: `Tracklist Tease Short`, format: 'short', day: 3 },
      ];
    case 'tourAnnounce':
      return [
        { title: `Tour Announcement`, format: 'video', day: 0 },
        { title: `Community — tour dates`, format: 'community', day: 0 },
        { title: `Hype Short`, format: 'short', day: 1 },
      ];
    case 'tourDate':
      return [
        { title: `Tour Diary Short`, format: 'short', day: -1 },
        { title: `Community — tonight`, format: 'community', day: 0 },
        { title: `Recap Short`, format: 'short', day: 1 },
      ];
    case 'festival':
      return [
        { title: `Festival Countdown Short`, format: 'short', day: -2 },
        { title: `Performance Clip Short`, format: 'short', day: 0 },
        { title: `Crowd Short`, format: 'short', day: 1 },
        { title: `Festival Recap`, format: 'video', day: 4 },
      ];
    case 'liveShow':
      return [
        { title: `Community — show tonight`, format: 'community', day: 0 },
        { title: `Live Recap Short`, format: 'short', day: 1 },
      ];
    case 'podcast':
      return [
        { title: `Clip Short #1`, format: 'short', day: 1 },
        { title: `Clip Short #2`, format: 'short', day: 2 },
      ];
    case 'promoTrip':
      return [
        { title: `Vlog Short`, format: 'short', day: 1 },
        { title: `Artist-led Short`, format: 'short', day: 2 },
        { title: `Trip Recap`, format: 'video', day: 5 },
      ];
    default:
      return [
        { title: `Community — ${ref}`, format: 'community', day: 0 },
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

// ── Strategy ─────────────────────────────────────────────────────────────

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

  const ctx = channelCtx ?? null;
  const strategy = generateStrategy(ctx, events);

  return {
    artist,
    campaignName,
    strategy,
    weeks,
    phases,
    totalWeeks,
    events,
  };
}
