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
  /** Marked complete by the user — campaign is alive */
  completed?: boolean;
  /** User-added action (not generated) */
  custom?: boolean;
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
//
// YouTube strategy principles internalized here — NOT surfaced as docs.
// The engine thinks in terms of: pre-release system, release day system,
// post-release system, and channel health shaping. Every action decision
// is shaped by artist context, not templates.

type ActionContext = {
  channelCtx: ChannelContext | null;
  releaseIndex: number;      // 0-indexed: how many releases before this one
  totalReleases: number;
  hasCollab: boolean;
  collabName?: string;
  campaignHasDoc: boolean;
  campaignHasTour: boolean;
  campaignHasAlbum: boolean;
  eventScale: ParsedEvent['scale'];
  /** Days since last upload — shapes pre-release cadence */
  daysSinceLastUpload?: number;
  /** Whether Shorts are already active on channel */
  shortsActive: boolean;
  /** How many events have already passed in the campaign */
  eventsBeforeThis: number;
};

/** Is this channel ready for a Premiere launch? */
function premiereReady(ctx: ChannelContext | null): boolean {
  if (!ctx) return false;
  // Premiere works when audience is warm enough to show up live.
  // Needs: active channel + meaningful sub base + recent momentum.
  const warm = ctx.state === 'HEALTHY' || ctx.state === 'BUILDING';
  const hasSubs = ctx.subs != null && ctx.subs > 25000;
  const recentActivity = ctx.uploads30d > 0 || ctx.shorts30d > 2;
  return warm && hasSubs && recentActivity;
}

/** Should we suggest Afterparty? Higher bar than Premiere. */
function afterpartyReady(ctx: ChannelContext | null): boolean {
  if (!ctx) return false;
  const healthy = ctx.state === 'HEALTHY';
  const bigSubs = ctx.subs != null && ctx.subs > 50000;
  const rising = ctx.momentum === 'rising';
  return healthy && bigSubs && (rising || ctx.shorts30d > 3);
}

function actionsForEvent(event: ParsedEvent, actx: ActionContext): ContentAction[] {
  const ref = event.title.length > 40 ? event.title.slice(0, 37) + '…' : event.title;
  const ctx = actx.channelCtx;
  const isCold = ctx && (ctx.state === 'COLD' || ctx.state === 'AT RISK');
  const isWeakConversion = ctx && ctx.state === 'WEAK CONVERSION';
  const canPremiere = premiereReady(ctx);
  const canAfterparty = afterpartyReady(ctx);
  const isFirstRelease = actx.releaseIndex === 0;
  const isLaterRelease = actx.releaseIndex > 0;
  const dormant = ctx && ctx.lastUploadDaysAgo != null && ctx.lastUploadDaysAgo > 30;

  switch (event.kind) {
    case 'singleRelease': {
      const actions: ContentAction[] = [];

      // ── PRE-RELEASE SYSTEM ──────────────────────────────────────
      // First single: full pre-release sequence to return audience.
      // Dormant channels need earlier warm-up; active channels can go tighter.
      if (isFirstRelease || event.scale === 'anchor') {
        if (dormant) {
          // Dormant channel — start Shorts warm-up earlier
          actions.push({ title: `Warm-up Short — reintroduce the artist`, format: 'short', day: -5 });
          actions.push({ title: `Teaser Short — ${ref}`, format: 'short', day: -2 });
        } else {
          actions.push({ title: `Teaser Short — ${ref}`, format: 'short', day: -3 });
        }
        // Community activation before release to prime the audience
        actions.push({ title: `Community — something's coming`, format: 'community', day: -2 });
      }
      if (isFirstRelease && !dormant) {
        actions.push({ title: `Snippet Short — ${ref}`, format: 'short', day: -1 });
      }

      // ── RELEASE DAY SYSTEM ──────────────────────────────────────
      if (canPremiere && (isFirstRelease || event.scale === 'anchor')) {
        actions.push({ title: `Premiere — ${ref}`, format: 'premiere', day: 0 });
        // Afterparty only for artists with highly engaged audiences
        if (canAfterparty) {
          actions.push({ title: `Afterparty — live fan moment`, format: 'live', day: 0 });
        }
      } else {
        actions.push({ title: `Official Video — ${ref}`, format: 'video', day: 0 });
      }

      actions.push({ title: `Community — out now`, format: 'community', day: 0 });

      // ── COLLAB SYSTEM ───────────────────────────────────────────
      if (event.featuredArtist) {
        // Collab tool unlocks cross-audience reach — use it intentionally
        actions.push({ title: `Collab Short with ${event.featuredArtist}`, format: 'short', day: 1 });
        actions.push({ title: `Cross-channel Community Post`, format: 'community', day: 1 });
        // If this is a cold channel, the collab is the discovery engine
        if (isCold) {
          actions.push({ title: `Fan reaction Short — ${event.featuredArtist} audience`, format: 'short', day: 3 });
        }
      }

      // ── POST-RELEASE SYSTEM ─────────────────────────────────────
      if (isFirstRelease && !event.featuredArtist) {
        // BTS extends the release window and deepens fan connection
        actions.push({ title: `BTS Short — making of ${ref}`, format: 'short', day: 2 });
      }

      // Sustain format — varies to avoid template fatigue
      if (isFirstRelease) {
        // Lyric video extends watch-time and serves a different audience intent
        if (isWeakConversion) {
          // Weak conversion → prioritise deeper connection content
          actions.push({ title: `Visualizer — ${ref}`, format: 'video', day: 5 });
        } else {
          actions.push({ title: `Lyric Video — ${ref}`, format: 'video', day: 7 });
        }
      } else if (isLaterRelease && actx.releaseIndex === 1) {
        // Second single gets a lighter sustain — visualizer, not lyric
        actions.push({ title: `Visualizer — ${ref}`, format: 'video', day: 5 });
      }
      // Third+ singles get no sustain format — the campaign has enough depth

      return actions;
    }

    case 'albumRelease': {
      const actions: ContentAction[] = [];

      // ── PRE-RELEASE ─────────────────────────────────────────────
      actions.push({ title: `Album Trailer`, format: 'video', day: -5 });
      if (!isCold) {
        actions.push({ title: `BTS Short — making the album`, format: 'short', day: -3 });
      } else {
        // Cold channel: use the album announcement to re-engage
        actions.push({ title: `Warm-up Short — the album is coming`, format: 'short', day: -4 });
      }
      actions.push({ title: `Community — pre-save + tracklist`, format: 'community', day: -2 });

      // ── RELEASE DAY ─────────────────────────────────────────────
      if (canPremiere) {
        actions.push({ title: `Album Premiere`, format: 'premiere', day: 0 });
        if (canAfterparty) {
          actions.push({ title: `Afterparty — album listening session`, format: 'live', day: 0 });
        }
      } else {
        actions.push({ title: `Album Drop`, format: 'video', day: 0 });
      }
      actions.push({ title: `Community — album out now`, format: 'community', day: 0 });

      // ── POST-RELEASE SUSTAIN ────────────────────────────────────
      // Album needs multi-week sustain — track-by-track, fan reactions, deep cuts
      actions.push({ title: `Track-by-Track Breakdown`, format: 'video', day: 2 });

      // Pick the right sustain format based on channel needs
      if (isWeakConversion) {
        // Need deeper connection → commentary over lyric video
        actions.push({ title: `Artist Commentary Short — favourite track`, format: 'short', day: 4 });
      } else {
        actions.push({ title: `Lyric Video — standout track`, format: 'video', day: 5 });
      }

      // Fan reaction extends engagement window
      if (!isCold) {
        actions.push({ title: `Fan Reactions Short`, format: 'short', day: 7 });
      }

      // Tour connection — albums and tours should reinforce each other
      if (actx.campaignHasTour) {
        actions.push({ title: `Community — tour tickets + album`, format: 'community', day: 3 });
      }

      return actions;
    }

    case 'albumAnnounce': {
      const actions: ContentAction[] = [
        { title: `Announcement Video`, format: 'video', day: 0 },
        { title: `Community — pre-save`, format: 'community', day: 0 },
      ];
      if (isCold) {
        // Cold channel gets a warm-up Short to rebuild cadence
        actions.push({ title: `Warm-up Short — album incoming`, format: 'short', day: 2 });
      }
      actions.push({ title: `Tracklist Tease Short`, format: 'short', day: 3 });
      // If there's a documentary, connect them
      if (actx.campaignHasDoc) {
        actions.push({ title: `Community — documentary hint`, format: 'community', day: 4 });
      }
      return actions;
    }

    case 'documentaryRelease': {
      // Documentary is a second campaign spike — treat it as an anchor moment.
      // The strategy: trailer → BTS → Premiere (if ready) → sustain clips.
      // Key insight: docs serve a different audience intent than music — they
      // convert casual viewers into fans. Scale support accordingly.
      const actions: ContentAction[] = [
        { title: `Documentary Trailer`, format: 'video', day: -7 },
        { title: `Community — documentary coming`, format: 'community', day: -5 },
        { title: `BTS Short — filming the documentary`, format: 'short', day: -3 },
      ];
      if (canPremiere) {
        actions.push({ title: `Documentary Premiere`, format: 'premiere', day: 0 });
        if (canAfterparty) {
          actions.push({ title: `Afterparty — live Q&A with director/artist`, format: 'live', day: 0 });
        }
      } else {
        actions.push({ title: `Documentary Release`, format: 'video', day: 0 });
      }
      actions.push({ title: `Community — watch now`, format: 'community', day: 0 });

      // Post-release: docs generate rich clip material
      actions.push({ title: `Fan Reaction Short`, format: 'short', day: 1 });
      actions.push({ title: `Director/Artist Commentary Short`, format: 'short', day: 3 });
      actions.push({ title: `Key Scene Short`, format: 'short', day: 5 });

      // Extended sustain — docs have a longer tail than singles
      if (!isCold) {
        actions.push({ title: `Community — fan discussion prompt`, format: 'community', day: 7 });
      }

      return actions;
    }

    case 'documentaryTease':
      return [
        { title: `Documentary Teaser`, format: 'video', day: 0 },
        { title: `Community — documentary announcement`, format: 'community', day: 0 },
        // Teaser Short clips from the doc to build anticipation
        ...(actx.shortsActive ? [{ title: `Doc Preview Short`, format: 'short' as const, day: 2 }] : []),
      ];

    case 'tourAnnounce': {
      // Tour announcements should feel like an active YouTube moment,
      // not just a static announcement. The audience wants to feel part of it.
      const actions: ContentAction[] = [
        { title: `Tour Announcement Video`, format: 'video', day: 0 },
        { title: `Community — tour dates + ticket links`, format: 'community', day: 0 },
      ];
      if (!isCold) {
        actions.push({ title: `Tour Hype Short — rehearsal/prep clip`, format: 'short', day: 1 });
      }
      // If album is part of campaign, connect them
      if (actx.campaignHasAlbum) {
        actions.push({ title: `Community — album + tour bundle`, format: 'community', day: 2 });
      }
      return actions;
    }

    case 'tourDate': {
      // Tour dates generate live content opportunities.
      // First show gets more support; later shows stay light.
      const isFirstShow = actx.eventsBeforeThis === 0 ||
        !actx.channelCtx; // can't tell, treat as first
      const actions: ContentAction[] = [
        { title: `Community — tonight's show`, format: 'community', day: 0 },
        { title: `Recap Short`, format: 'short', day: 1 },
      ];
      if (isFirstShow) {
        actions.push({ title: `Backstage / Soundcheck Short`, format: 'short', day: 0 });
      }
      return actions;
    }

    case 'festival': {
      // Festivals are high-energy discovery moments.
      // Shorts captured live cut through algorithmically.
      const actions: ContentAction[] = [
        { title: `Performance Clip Short`, format: 'short', day: 0 },
        { title: `Crowd / Backstage Short`, format: 'short', day: 1 },
      ];
      if (event.scale !== 'minor') {
        actions.push({ title: `Festival Recap`, format: 'video', day: 4 });
        // Connect festival energy back to the campaign
        if (actx.campaignHasAlbum || actx.totalReleases > 0) {
          actions.push({ title: `Community — festival highlights + music link`, format: 'community', day: 2 });
        }
      }
      return actions;
    }

    case 'liveShow':
      return [
        { title: `Community — show tonight`, format: 'community', day: 0 },
        { title: `Live Recap Short`, format: 'short', day: 1 },
      ];

    case 'podcast':
      return [
        { title: `Clip Short — best moment`, format: 'short', day: 1 },
        // Podcasts extend discovery — Community post drives the long-listen
        { title: `Community — full episode link`, format: 'community', day: 1 },
      ];

    case 'promoTrip': {
      // Promo trips generate artist-led content opportunities
      const actions: ContentAction[] = [
        { title: `Artist-led Vlog Short`, format: 'short', day: 1 },
      ];
      // Only add recap if channel is active enough to sustain it
      if (!isCold) {
        actions.push({ title: `Trip Recap`, format: 'video', day: 5 });
      }
      return actions;
    }

    default:
      return [
        { title: `Community — ${ref}`, format: 'community', day: 0 },
      ];
  }
}

// ── Gap Detection & Bridge Content ──────────────────────────────────────
//
// Gaps kill campaigns. YouTube's algorithm rewards consistency — any gap
// over 14 days risks losing algorithmic momentum. Bridge content isn't
// filler; it's strategic continuity.

type GapInfo = {
  afterEventIdx: number;
  gapDays: number;
  beforeKind: TimelineKind;
  afterKind: TimelineKind;
};

function detectGaps(events: ParsedEvent[]): GapInfo[] {
  const gaps: GapInfo[] = [];
  for (let i = 1; i < events.length; i++) {
    const prev = new Date(events[i - 1].dateISO).getTime();
    const curr = new Date(events[i].dateISO).getTime();
    const gapDays = Math.round((curr - prev) / 86400000);
    if (gapDays > 14) {
      gaps.push({
        afterEventIdx: i - 1,
        gapDays,
        beforeKind: events[i - 1].kind,
        afterKind: events[i].kind,
      });
    }
  }
  return gaps;
}

function bridgeActions(gap: GapInfo, ctx: ChannelContext | null): ContentAction[] {
  const isCold = ctx && (ctx.state === 'COLD' || ctx.state === 'AT RISK');
  const isWeakConversion = ctx && ctx.state === 'WEAK CONVERSION';

  // Shape bridge content based on what's around the gap
  const comingFromRelease = gap.beforeKind === 'singleRelease' || gap.beforeKind === 'albumRelease';
  const goingToRelease = gap.afterKind === 'singleRelease' || gap.afterKind === 'albumRelease';
  const comingFromTour = gap.beforeKind === 'tourDate' || gap.beforeKind === 'festival';

  if (isCold) {
    // Cold channel: every gap is dangerous — double up
    return [
      { title: `Artist-led Short — keep the channel warm`, format: 'short', day: 0 },
      { title: `Community — fan Q&A or poll`, format: 'community', day: 3 },
    ];
  }

  if (comingFromRelease && goingToRelease) {
    // Between releases — sustain the previous release while building to the next
    return [
      { title: `Fan reaction or remix Short`, format: 'short', day: 0 },
      ...(gap.gapDays > 21 ? [{ title: `Community — what's next hint`, format: 'community' as const, day: 4 }] : []),
    ];
  }

  if (comingFromTour) {
    // Post-tour gap — capture the live energy before it fades
    return [
      { title: `Tour highlight Short — best moment`, format: 'short', day: 0 },
    ];
  }

  if (goingToRelease) {
    // Pre-release gap — build anticipation
    return [
      { title: `Anticipation Short — studio/snippet/personal`, format: 'short', day: 0 },
      ...(isWeakConversion ? [{ title: `Community — artist Q&A`, format: 'community' as const, day: 3 }] : []),
    ];
  }

  // Default bridge
  return [
    { title: `Artist-led moment — bridge content`, format: 'short', day: 0 },
  ];
}

// ── Strategic Insights ──────────────────────────────────────────────────
//
// Insights are editorial observations, not documentation.
// They should read like a strategist's notes, not AI explanations.

function generateCampaignInsights(
  events: ParsedEvent[],
  ctx: ChannelContext | null,
  gaps: GapInfo[],
): string[] {
  const insights: string[] = [];
  const hasRelease = events.some((e) => RELEASE_KINDS.has(e.kind));
  const hasDoc = events.some((e) => e.kind === 'documentaryRelease');
  const hasTour = events.some((e) => e.kind === 'tourDate' || e.kind === 'tourAnnounce');
  const hasCollab = events.some((e) => !!e.featuredArtist);
  const hasFestival = events.some((e) => e.kind === 'festival');
  const releases = events.filter((e) => e.kind === 'singleRelease' || e.kind === 'albumRelease');
  const hasAlbum = events.some((e) => e.kind === 'albumRelease');

  // Channel-state insights — shaped by what the channel actually needs
  if (ctx) {
    if (ctx.state === 'COLD' && hasRelease) {
      const daysGap = ctx.lastUploadDaysAgo ?? 0;
      if (daysGap > 60) {
        insights.push(`Channel dormant for ${daysGap}+ days — warm-up cadence added to rebuild algorithmic trust before release.`);
      } else {
        insights.push('Channel needs reactivation — Shorts warm-up added before the first release window.');
      }
    }
    if (ctx.momentum === 'rising' && hasRelease && premiereReady(ctx)) {
      insights.push('Current momentum and audience size support Premiere launches on anchor releases.');
    }
    if (ctx.state === 'WEAK CONVERSION' && hasRelease) {
      insights.push('Views strong but subscriber conversion weak — prioritising deeper connection content over discovery formats.');
    }
    if (ctx.shorts30d > 4 && ctx.momentum === 'rising') {
      insights.push('Shorts driving active discovery — maintaining cadence around release moments to compound reach.');
    }
    if (ctx.state === 'BUILDING' && hasAlbum) {
      insights.push('Channel building momentum — album drop should accelerate this. Multi-format support added to extend the window.');
    }
  }

  // Campaign shape insights — what the timeline reveals
  if (hasDoc && hasRelease) {
    insights.push('Documentary creates a second campaign peak — rollout treats it as an anchor moment with full support.');
  }
  if (hasCollab) {
    const collabEvents = events.filter((e) => !!e.featuredArtist);
    if (collabEvents.length > 1) {
      insights.push(`${collabEvents.length} feature releases — each one is a cross-audience moment via YouTube Collab tool.`);
    } else {
      insights.push(`Feature release unlocks cross-audience reach — Collab tool and cross-channel Community activations added.`);
    }
  }
  if (hasTour && hasRelease) {
    insights.push('Tour dates extend the release window — live content sustains campaign momentum between drops.');
  }
  if (hasFestival && hasRelease) {
    insights.push('Festival moments generate high-energy Shorts content that feeds back into the campaign.');
  }
  if (releases.length > 3) {
    insights.push('Multiple releases — later singles receive lighter support to avoid template fatigue and maintain audience attention.');
  }

  // Gap insights — operational, specific
  if (gaps.length > 0) {
    const bigGap = gaps.reduce((a, b) => a.gapDays > b.gapDays ? a : b);
    if (bigGap.gapDays > 28) {
      insights.push(`${bigGap.gapDays}-day campaign gap detected — bridge content added to maintain algorithmic consistency.`);
    } else if (gaps.length > 2) {
      insights.push(`${gaps.length} content gaps in the campaign — bridge actions added to keep the channel active between moments.`);
    }
  }

  // Multi-format ecosystem observation
  if (hasAlbum && hasDoc && hasTour) {
    insights.push('Album + documentary + tour creates a multi-peak campaign — each peak is supported with distinct format strategy.');
  }

  return insights.slice(0, 5); // Max 5 top-level insights
}

function weekInsight(
  week: PlanWeek,
  events: ParsedEvent[],
  ctx: ChannelContext | null,
  weekEvents: ParsedEvent[],
  gapWeek: boolean,
  gapInfo: GapInfo | null,
  phase: PhaseName,
): string | undefined {
  // Only some weeks get insights — avoid noise
  if (weekEvents.length === 0 && !gapWeek) return undefined;

  const ev = weekEvents[0];

  // Gap-specific insight — shaped by what's around the gap
  if (gapWeek && gapInfo) {
    if (gapInfo.gapDays > 28) {
      return `${gapInfo.gapDays}-day gap — artist-led content here prevents algorithmic decay before the next moment.`;
    }
    if (gapInfo.afterKind === 'singleRelease' || gapInfo.afterKind === 'albumRelease') {
      return 'Pre-release window — bridge content here builds anticipation for the upcoming drop.';
    }
    return 'Campaign continuity — Shorts maintain channel presence between key moments.';
  }

  if (ev?.featuredArtist) {
    return `Feature with ${ev.featuredArtist} — cross-channel activation and Collab tool maximise audience crossover.`;
  }

  if (ev?.kind === 'documentaryRelease') {
    return 'Documentary anchor — serves a different audience intent than music. Supports fan conversion.';
  }

  if (ev?.kind === 'albumRelease') {
    return 'Album drop — multi-format support extends the release window. Track-by-track and sustain content follows.';
  }

  if (ev?.kind === 'singleRelease' && ev.scale === 'anchor') {
    if (ctx && premiereReady(ctx)) {
      return 'Anchor release with Premiere — live launch builds community momentum.';
    }
    return 'Anchor release — full pre-release and sustain sequence activated.';
  }

  if (ev?.kind === 'tourAnnounce') {
    return 'Tour announcement creates a high-engagement Community moment — activate ticket links and hype content.';
  }

  if (ev?.kind === 'festival' && ev.scale !== 'minor') {
    return 'Festival — high-energy Shorts from this event feed back into campaign discovery.';
  }

  if (phase === 'BUILD' && ctx?.state === 'COLD') {
    return 'Channel warming — rebuilding algorithmic trust through consistent Shorts before launch.';
  }

  if (phase === 'SCALE' && weekEvents.length > 0) {
    return 'Scale phase — sustain content extends campaign reach beyond the initial release spike.';
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
//
// Cold channel warm-up follows YouTube's return-audience principles:
// Week 1: re-introduce — show the artist is active again
// Week 2: establish cadence — prove consistency to the algorithm
// Week 3+: build anticipation — tease what's coming
// Each week varies to avoid robotic repetition.

function warmUpActions(weekNum: number, totalBuildWeeks: number, ctx: ChannelContext | null): ContentAction[] {
  const isVeryCold = ctx && ctx.lastUploadDaysAgo != null && ctx.lastUploadDaysAgo > 60;

  if (weekNum === 1) {
    const actions: ContentAction[] = [
      { title: isVeryCold
        ? `Artist-led Short — "I'm back" moment`
        : `Artist-led Short — re-introduce`,
        format: 'short', day: 0 },
      { title: `Community — what's coming`, format: 'community', day: 2 },
    ];
    // Very cold channels need more cadence in week 1
    if (isVeryCold) {
      actions.push({ title: `Throwback Short — fan favourite moment`, format: 'short', day: 4 });
    }
    return actions;
  }
  if (weekNum === 2) {
    return [
      { title: `Snippet or studio Short`, format: 'short', day: 0 },
      { title: `Community — behind the scenes update`, format: 'community', day: 3 },
    ];
  }
  if (weekNum === 3 && totalBuildWeeks >= 3) {
    return [
      { title: `Anticipation Short — tease what's dropping`, format: 'short', day: 0 },
    ];
  }
  if (weekNum <= totalBuildWeeks) {
    // Later build weeks: maintain presence without overdoing it
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
  campaignStartDate?: string | null,
): GeneratedPlan | null {
  const events = parseTimeline(timelineText);
  if (events.length === 0) return null;

  const ctx = channelCtx ?? null;
  const campaignName = artist ? `${artist} Campaign` : 'YouTube Campaign';
  const isCold = ctx && (ctx.state === 'COLD' || ctx.state === 'AT RISK');

  // Campaign shape analysis
  const campaignHasDoc = events.some((e) => e.kind === 'documentaryRelease');
  const campaignHasTour = events.some((e) => e.kind === 'tourDate' || e.kind === 'tourAnnounce');
  const campaignHasAlbum = events.some((e) => e.kind === 'albumRelease');
  const releases = events.filter((e) =>
    e.kind === 'singleRelease' || e.kind === 'albumRelease'
  );
  const shortsActive = ctx ? ctx.shorts30d > 2 : false;

  // Date range — expand window for cold channels (need more warm-up time)
  // If campaignStartDate is provided and earlier than first event, use it as floor
  const preBuffer = isCold ? 14 : 7;
  let startISO = addDays(events[0].dateISO, -preBuffer);
  if (campaignStartDate && campaignStartDate < startISO) {
    startISO = campaignStartDate;
  }
  const endISO = addDays(events[events.length - 1].dateISO, 21);
  const startMs = new Date(startISO + 'T12:00:00').getTime();
  const endMs = new Date(endISO + 'T12:00:00').getTime();
  const totalWeeks = Math.max(12, Math.ceil((endMs - startMs) / (7 * 86400000)));

  // Detect gaps — now with context about surrounding events
  const gaps = detectGaps(events);
  const gapWeekMap = new Map<number, GapInfo>();
  for (const gap of gaps) {
    const ev = events[gap.afterEventIdx];
    const midDate = addDays(ev.dateISO, Math.floor(gap.gapDays / 2));
    const midWeek = weekForDate(startISO, midDate);
    gapWeekMap.set(midWeek, gap);
    // For very long gaps (>28 days), add a second bridge point
    if (gap.gapDays > 28) {
      const secondDate = addDays(ev.dateISO, Math.floor(gap.gapDays * 0.75));
      const secondWeek = weekForDate(startISO, secondDate);
      if (secondWeek !== midWeek) {
        gapWeekMap.set(secondWeek, gap);
      }
    }
  }

  // Phases
  const phases = assignPhases(events, totalWeeks, startISO);
  const buildPhase = phases.find((p) => p.name === 'BUILD');
  const totalBuildWeeks = buildPhase ? buildPhase.weekEnd - buildPhase.weekStart + 1 : 0;

  // Build weekly plan
  const weeks: PlanWeek[] = [];
  const fmt = (d: Date) => `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;
  let releaseCounter = 0;
  let eventCounter = 0;

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
    const gapInfo = gapWeekMap.get(weekNum) ?? null;
    const isGapWeek = gapInfo !== null;

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
        campaignHasAlbum,
        eventScale: ev.scale,
        daysSinceLastUpload: ctx?.lastUploadDaysAgo,
        shortsActive,
        eventsBeforeThis: eventCounter,
      };

      const template = actionsForEvent(ev, actx);
      for (const a of template) {
        if (a.day >= -7 && a.day <= 7) actions.push(a);
      }

      if (isRelease) releaseCounter++;
      eventCounter++;
    }

    // Cold channel warm-up in BUILD phase
    if (phase === 'BUILD' && isCold && weekEvents.length === 0) {
      const warmUp = warmUpActions(weekNum - (buildPhase?.weekStart ?? 1) + 1, totalBuildWeeks, ctx);
      actions.push(...warmUp);
    }

    // Bridge content for gap weeks (only if no events this week)
    if (isGapWeek && weekEvents.length === 0 && gapInfo) {
      actions.push(...bridgeActions(gapInfo, ctx));
    }

    // Strategic insight for this week
    const insight = weekInsight(
      { weekNum, dateRange: '', phase, actions, momentName: undefined },
      events,
      ctx,
      weekEvents,
      isGapWeek && weekEvents.length === 0,
      gapInfo,
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
