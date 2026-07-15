// ─────────────────────────────────────────────────────────────────────────────
// COACH BRAIN — deterministic, phase-aware decision engine.
// Pure functions only. No React. No fetch. No side effects.
// Inputs: planned cadence + live channel state + recent events + phase.
// Outputs: structured decision blocks the UI renders verbatim.
// ─────────────────────────────────────────────────────────────────────────────

export type PhaseName = 'REAWAKEN' | 'BUILD' | 'SCALE' | 'CULTURAL' | 'EXTEND';

export type Momentum =
  | 'accelerating'
  | 'building'
  | 'stable'
  | 'active_but_weak'
  | 'slipping'
  | 'quiet';

export type DecisionState =
  | 'SCALE—STRONG'
  | 'PUSH—STRONG'
  | 'PUSH—WEAK'
  | 'BUILD—MISALIGNED'
  | 'ACTIVE BUT FLAT'
  | 'HOLD—LOW CADENCE'
  | 'QUIET';

export type CadenceRowStatus = 'on_track' | 'slightly_behind' | 'behind' | 'exceeding';

export interface CadenceRow {
  format: 'Shorts' | 'Posts' | 'Videos';
  planned: number;
  actual: number;
  status: CadenceRowStatus;
}

export interface CadenceCompare {
  rows: CadenceRow[];
  overall: 'Strong cadence' | 'On track' | 'Behind cadence';
}

export interface RecentSignal {
  uploadsLast48h: number;
  shortsLast48h: number;
  subscriberDelta: number | null;
  signal: string; // e.g. "Weak follow-through"
  action: string; // e.g. "Add Shorts to support latest upload"
}

export interface DropReadiness {
  daysUntil: number | null;
  status: 'aligned' | 'under_supporting' | 'no_drop';
  message: string;
}

export type CoachMove = {
  label: string;    // short framing: "Ride the release window"
  action: string;   // specific action tied to real data
};

export interface AIDecision {
  state: DecisionState;
  momentum: Momentum;
  read: string;     // AI READ — what is happening
  plan: string;     // PLAN(phase) — what should be happening
  gap: string;      // GAP — where reality and plan differ
  action: string;   // ACTION — clear next steps (legacy joined string)
  primaryMove: CoachMove;
  secondaryMove: CoachMove | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE EXPECTATIONS
// What the channel SHOULD look like in each phase, expressed in observable
// numbers the watcher can verify.
// ─────────────────────────────────────────────────────────────────────────────

interface PhaseExpectation {
  shortsPerWeekMin: number;
  videosPerWeekMin: number;
  description: string;
}

const PHASE_EXPECTATIONS: Record<PhaseName, PhaseExpectation> = {
  REAWAKEN: {
    shortsPerWeekMin: 1,
    videosPerWeekMin: 0,
    description: 'Low but consistent activity warming the audience back up.',
  },
  BUILD: {
    shortsPerWeekMin: 2,
    videosPerWeekMin: 1,
    description: 'Increasing cadence with collabs and format variety.',
  },
  SCALE: {
    shortsPerWeekMin: 3,
    videosPerWeekMin: 1,
    description: 'High output — strong Shorts plus support driving conversion.',
  },
  CULTURAL: {
    shortsPerWeekMin: 4,
    videosPerWeekMin: 2,
    description: 'Peak activity — maximum reach with strong narrative support.',
  },
  EXTEND: {
    shortsPerWeekMin: 1,
    videosPerWeekMin: 0,
    description: 'Sustained presence — slower cadence, maintaining relevance.',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// INPUT SHAPES — what the engine consumes
// ─────────────────────────────────────────────────────────────────────────────

export interface WatcherStateLike {
  subscriberCount: number;
  subscriberDelta: number | null;
  viewCount: number;
  viewDelta: number | null;
  uploadsLast7Days: number;
  uploadsLast14Days: number;
  shortsLast14Days: number;
  videosLast14Days: number;
  daysSinceLastUpload: number | null;
  checkedAt: string;
}

export interface WatcherEventLike {
  eventType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PlannedCadence {
  shortsPerWeek: number;
  postsPerWeek: number;
  videosPerWeek: number;
}

export interface NextDropLike {
  date: string; // ISO
  name: string;
}

export interface TopVideoLike {
  title: string;
  views: number;
}

/** Lightweight video info passed from watcher for campaign-aware actions */
export interface LatestVideoLike {
  title: string;
  publishedAt: string;
  kind: 'video' | 'short';
  videoType?: string;
  views?: number;
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + 'K';
  return n.toLocaleString();
}
function topVideoRef(top: TopVideoLike | null | undefined): string {
  if (!top) return 'your best-performing recent clip';
  return `your top video "${top.title}" (${formatViews(top.views)} views)`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOMENTUM
// ─────────────────────────────────────────────────────────────────────────────

export function momentumState(state: WatcherStateLike): Momentum {
  const subDelta = state.subscriberDelta ?? 0;
  const u7 = state.uploadsLast7Days;
  const days = state.daysSinceLastUpload ?? 99;

  if (days >= 14) return 'quiet';
  if (subDelta > 0 && u7 >= 4) return 'accelerating';
  if (subDelta > 0 && u7 >= 2) return 'building';
  if (subDelta < 0) return 'slipping';
  if (u7 >= 3 && subDelta === 0) return 'active_but_weak';
  if (u7 === 0) return 'quiet';
  return 'stable';
}

export const MOMENTUM_LABEL: Record<Momentum, string> = {
  accelerating: 'ACCELERATING',
  building: 'BUILDING',
  stable: 'STABLE',
  active_but_weak: 'ACTIVE BUT WEAK',
  slipping: 'SLIPPING',
  quiet: 'QUIET',
};

// ─────────────────────────────────────────────────────────────────────────────
// CADENCE COMPARE — planned vs actual (last 7d uploads from watcher)
// Watcher tracks uploads; "posts" aren't observable from YouTube Data API,
// so posts row uses the planned target only and is marked as an unverified row.
// ─────────────────────────────────────────────────────────────────────────────

export function cadenceComparison(
  plan: PlannedCadence,
  state: WatcherStateLike
): CadenceCompare {
  // Approximate weekly counts from the 14d window the watcher tracks.
  const actualShorts = Math.round((state.shortsLast14Days / 14) * 7);
  const actualVideos = Math.round((state.videosLast14Days / 14) * 7);

  const status = (planned: number, actual: number): CadenceRowStatus => {
    if (planned === 0) return actual > 0 ? 'exceeding' : 'on_track';
    const ratio = actual / planned;
    if (ratio >= 1.2) return 'exceeding';
    if (ratio >= 0.9) return 'on_track';
    if (ratio >= 0.5) return 'slightly_behind';
    return 'behind';
  };

  const rows: CadenceRow[] = [
    { format: 'Shorts', planned: plan.shortsPerWeek, actual: actualShorts, status: status(plan.shortsPerWeek, actualShorts) },
    { format: 'Videos', planned: plan.videosPerWeek, actual: actualVideos, status: status(plan.videosPerWeek, actualVideos) },
    // Posts are unverifiable from YouTube Data API; show planned only.
    { format: 'Posts', planned: plan.postsPerWeek, actual: -1, status: 'on_track' },
  ];

  const observable = rows.filter((r) => r.actual >= 0);
  const exceeding = observable.filter((r) => r.status === 'exceeding').length;
  const onTrack = observable.filter((r) => r.status === 'on_track').length;
  const behind = observable.filter((r) => r.status === 'behind').length;

  let overall: CadenceCompare['overall'] = 'On track';
  if (behind >= 1) overall = 'Behind cadence';
  else if (exceeding + onTrack === observable.length && exceeding >= 1) overall = 'Strong cadence';

  return { rows, overall };
}

// ─────────────────────────────────────────────────────────────────────────────
// RECENT SIGNAL — last 48h
// ─────────────────────────────────────────────────────────────────────────────

export function recentSignal(
  state: WatcherStateLike,
  events: WatcherEventLike[],
  topVideo?: TopVideoLike | null,
): RecentSignal {
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const recent = events.filter((e) => new Date(e.createdAt).getTime() >= cutoff);
  const uploads = recent.filter((e) => e.eventType === 'NEW_VIDEO' || e.eventType === 'NEW_SHORT').length;
  const shorts = recent.filter((e) => e.eventType === 'NEW_SHORT').length;
  const subDelta = state.subscriberDelta;
  const ref = topVideoRef(topVideo);

  // Detect strong cadence + not converting — actions should push depth, not volume
  const strongButFlat = state.uploadsLast14Days >= 6 && (subDelta ?? 0) <= 0;

  let signal = 'Quiet window';
  // Actions here are secondary — primary actions come from aiDecisionLayer.
  // Keep these as light cadence nudges, not campaign-specific advice.
  let action = 'Post 1 Short today to keep cadence warm.';

  if (strongButFlat && uploads >= 1) {
    signal = 'Active but not converting';
    action = 'Cadence is strong — go deeper with BTS, breakdowns, or personal content.';
  } else if (uploads >= 2 && shorts >= 1) {
    signal = 'Active follow-through';
    action = strongButFlat
      ? 'Volume is strong — try deeper content to convert viewers.'
      : 'Follow through with 2 more Shorts in the next 48h.';
  } else if (uploads >= 1 && shorts === 0) {
    signal = 'Weak follow-through';
    action = 'Create 2 Shorts within 24h to support the latest upload.';
  } else if (uploads === 0 && (subDelta ?? 0) > 0) {
    signal = 'Audience moving — channel silent';
    action = 'Post 1 Short today to capture the subscriber lift.';
  } else if (uploads === 0 && (state.daysSinceLastUpload ?? 0) >= 7) {
    signal = 'Channel went quiet';
    action = 'Post 1 Short today to break the silence.';
  }

  return {
    uploadsLast48h: uploads,
    shortsLast48h: shorts,
    subscriberDelta: subDelta,
    signal,
    action,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DROP READINESS — next drop vs current cadence
// ─────────────────────────────────────────────────────────────────────────────

export function dropReadiness(
  nextDrop: NextDropLike | null,
  state: WatcherStateLike,
  phase: PhaseName
): DropReadiness {
  if (!nextDrop) return { daysUntil: null, status: 'no_drop', message: 'No drop scheduled.' };
  const daysUntil = Math.max(0, Math.floor((new Date(nextDrop.date).getTime() - Date.now()) / 86400000));
  const exp = PHASE_EXPECTATIONS[phase];
  const expectedShortsByNow = exp.shortsPerWeekMin * 2; // last 14d window
  const aligned = state.shortsLast14Days >= expectedShortsByNow && state.videosLast14Days >= exp.videosPerWeekMin;

  if (aligned) {
    return {
      daysUntil,
      status: 'aligned',
      message: `Cadence is aligned and supporting "${nextDrop.name}" in ${daysUntil}d.`,
    };
  }
  return {
    daysUntil,
    status: 'under_supporting',
    message: `${daysUntil}d to "${nextDrop.name}" — cadence is below the support level this phase requires.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DECISION ENGINE — combines everything into the upgraded state + AI blocks
// ─────────────────────────────────────────────────────────────────────────────

function pickDecisionState(
  phase: PhaseName,
  momentum: Momentum,
  cadence: CadenceCompare,
  state: WatcherStateLike
): DecisionState {
  const subDelta = state.subscriberDelta ?? 0;
  const u7 = state.uploadsLast7Days;
  const expected = PHASE_EXPECTATIONS[phase];
  const meetingPhaseShorts = state.shortsLast14Days >= expected.shortsPerWeekMin * 2;

  if (momentum === 'quiet') return 'QUIET';
  if (cadence.overall === 'Behind cadence' && u7 <= 1) return 'HOLD—LOW CADENCE';
  if (phase === 'BUILD' && !meetingPhaseShorts) return 'BUILD—MISALIGNED';
  if (phase === 'SCALE' && cadence.overall === 'Strong cadence' && subDelta > 0) return 'SCALE—STRONG';
  if (cadence.overall === 'Strong cadence' && subDelta > 0) return 'PUSH—STRONG';
  if (cadence.overall === 'Strong cadence' && subDelta <= 0) return 'PUSH—WEAK';
  if (u7 >= 3 && subDelta === 0) return 'ACTIVE BUT FLAT';
  return 'PUSH—WEAK';
}

export function aiDecisionLayer(input: {
  phase: PhaseName;
  plan: PlannedCadence;
  state: WatcherStateLike;
  events: WatcherEventLike[];
  nextDrop: NextDropLike | null;
  topVideo?: TopVideoLike | null;
  latestVideos?: LatestVideoLike[];
}): AIDecision {
  const { phase, plan, state, events, nextDrop, topVideo, latestVideos } = input;
  const momentum = momentumState(state);
  const cadence = cadenceComparison(plan, state);
  const recent = recentSignal(state, events, topVideo);
  const readiness = dropReadiness(nextDrop, state, phase);
  const ref = topVideoRef(topVideo);
  const decisionState = pickDecisionState(phase, momentum, cadence, state);
  const expected = PHASE_EXPECTATIONS[phase];

  // READ — what is actually happening (live data, no interpretation)
  const subTrend =
    state.subscriberDelta == null
      ? 'subscriber trend not yet available (single snapshot)'
      : state.subscriberDelta > 0
      ? `+${state.subscriberDelta.toLocaleString()} subs since prior poll`
      : state.subscriberDelta < 0
      ? `${state.subscriberDelta.toLocaleString()} subs since prior poll`
      : 'subscribers flat';
  const cadenceLine = `${state.uploadsLast14Days} uploads / 14d (${state.videosLast14Days} video, ${state.shortsLast14Days} short)`;
  const lastUpload =
    state.daysSinceLastUpload == null
      ? 'no upload on record'
      : state.daysSinceLastUpload === 0
      ? 'upload today'
      : `last upload ${state.daysSinceLastUpload}d ago`;
  const read = `${cadenceLine}; ${subTrend}; ${lastUpload}.`;

  // PLAN — what this phase requires
  const planText = `${phase} expects ≥${expected.shortsPerWeekMin} short/wk and ≥${expected.videosPerWeekMin} video/wk. ${expected.description}`;

  // GAP — where reality and plan differ
  const gapBits: string[] = [];
  for (const row of cadence.rows) {
    if (row.actual < 0) continue;
    if (row.status === 'behind') gapBits.push(`${row.format} behind plan (${row.actual}/wk vs ${row.planned}/wk planned)`);
    else if (row.status === 'slightly_behind') gapBits.push(`${row.format} slightly behind (${row.actual}/wk vs ${row.planned}/wk)`);
  }
  if (readiness.status === 'under_supporting' && readiness.daysUntil != null) {
    gapBits.push(`${readiness.daysUntil}d to next drop, support level below phase floor`);
  }
  // Detect conversion-leak state: strong cadence but subs flat
  const strongCadenceNotConverting = (state.subscriberDelta ?? 0) <= 0 && state.uploadsLast7Days >= 3;
  if (strongCadenceNotConverting) {
    gapBits.push('upload activity is high but subs are flat — volume is not the problem, content depth is');
  }
  const gap = gapBits.length ? gapBits.join('; ') + '.' : 'No material gap — reality is matching the plan for this phase.';

  // ── WHAT TO DO NOW — max 2 directions, sharp and specific ───────────────
  // Derived from actual campaign state — latest drop, next planned moment,
  // collab opportunities, cadence gaps — not generic advice.

  // Detect latest longform drop from live data
  const latestDrop = (latestVideos ?? [])
    .filter((v) => v.kind === 'video')
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())[0] ?? null;
  const dropAgeDays = latestDrop
    ? Math.floor((Date.now() - new Date(latestDrop.publishedAt).getTime()) / 86400000)
    : null;
  const dropTitle = latestDrop ? `"${latestDrop.title}"` : null;

  // Detect collab opportunities: "ft.", "feat.", "x " in latest drop title
  const collabMatch = latestDrop
    ? latestDrop.title.match(/(?:ft\.?|feat\.?|featuring)\s+([^(\[,]+)/i)
      ?? latestDrop.title.match(/\bx\s+([A-Z][^(\[,]+)/i)
    : null;
  const collabArtist = collabMatch ? collabMatch[1].trim() : null;

  let primaryMove: CoachMove;
  let secondaryMove: CoachMove | null = null;

  const cadenceBehind = cadence.rows.some((r) => r.actual >= 0 && r.status === 'behind');
  const behindRows = cadence.rows.filter((r) => r.actual >= 0 && r.status === 'behind');

  // 1. CADENCE BEHIND — fix cadence first
  if (cadenceBehind && !strongCadenceNotConverting && behindRows.length > 0) {
    const topBehind = behindRows[0];
    primaryMove = {
      label: 'Fix cadence before anything else',
      action: `Post ${topBehind.planned} ${topBehind.format} this week to catch up. The algorithm rewards consistency — being behind on cadence caps everything else.`,
    };
    if (dropAgeDays != null && dropAgeDays <= 7 && dropTitle) {
      secondaryMove = {
        label: 'Support the live drop',
        action: `${dropTitle} is still in its window. Cut a Short from the best moment while you catch cadence.`,
      };
    }
  }
  // 2. JUST DROPPED (within 3 days)
  else if (dropAgeDays != null && dropAgeDays <= 3 && dropTitle) {
    primaryMove = {
      label: 'Follow up the drop',
      action: `${dropTitle} is live — ship a BTS or making-of Short within 24h to deepen engagement while the algorithm is pushing it.`,
    };
    if (collabArtist) {
      secondaryMove = {
        label: `Activate the ${collabArtist} audience`,
        action: `Set up YouTube Collab with ${collabArtist} — cross-post clips to distribute across both channels.`,
      };
    }
  }
  // 3. DROP IS WORKING (4-14 days)
  else if (dropAgeDays != null && dropAgeDays <= 14 && dropTitle) {
    if (strongCadenceNotConverting) {
      primaryMove = {
        label: 'Go deeper, not wider',
        action: `${dropTitle} has views but isn't converting. Post a track breakdown or studio session — deeper content turns viewers into subscribers.`,
      };
    } else {
      primaryMove = {
        label: 'Extend the release window',
        action: `${dropTitle} is still being pushed. Cut 2–3 Shorts from it this week while the algorithm is distributing.`,
      };
    }
    if (collabArtist) {
      secondaryMove = {
        label: `Cross-promote with ${collabArtist}`,
        action: `Collab clips drive new audience. Set up cross-promo while the track still has momentum.`,
      };
    }
  }
  // 4. STRONG CADENCE BUT NOT CONVERTING
  else if (strongCadenceNotConverting) {
    primaryMove = {
      label: 'Push connection, not volume',
      action: 'Cadence is strong but subs are flat. Go deeper: BTS, track breakdowns, studio sessions. Give viewers a reason to subscribe.',
    };
  }
  // 5. NEXT DROP APPROACHING
  else if (readiness.status === 'under_supporting' && readiness.daysUntil != null && readiness.daysUntil <= 14 && nextDrop) {
    primaryMove = {
      label: 'Warm up for the next drop',
      action: `"${nextDrop.name}" drops in ${readiness.daysUntil}d — line up 2–3 Shorts to warm the audience before release.`,
    };
  }
  // 6. SCALING
  else if (decisionState === 'SCALE—STRONG' && dropTitle) {
    primaryMove = {
      label: 'Don\'t change what\'s working',
      action: `${dropTitle} is performing. Post 2–3 Short variations and let it compound — don't add complexity.`,
    };
  }
  // 7. DEFAULT — hold
  else {
    primaryMove = {
      label: 'Hold the line',
      action: 'Cadence is on track. No corrective action this week — focus on support formats for top content.',
    };
  }

  // Legacy action string for backward compat
  const actionLegacy = [primaryMove.action, secondaryMove?.action].filter(Boolean).join(' ');

  return {
    state: decisionState,
    momentum,
    read,
    plan: planText,
    gap,
    action: actionLegacy,
    primaryMove,
    secondaryMove,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DECISION STATE META — colors + short subtitles for the UI
// ─────────────────────────────────────────────────────────────────────────────

export const DECISION_STATE_META: Record<DecisionState, { color: string; subtitle: string }> = {
  'SCALE—STRONG':     { color: '#1FBE7A', subtitle: 'Audience is growing and cadence is strong' },
  'PUSH—STRONG':      { color: '#1FBE7A', subtitle: 'Posting consistently and converting viewers' },
  'PUSH—WEAK':        { color: '#F5B73D', subtitle: 'High output, low subscriber growth' },
  'BUILD—MISALIGNED': { color: '#2C6BFF', subtitle: 'Output is below the phase floor' },
  'ACTIVE BUT FLAT':  { color: '#F5B73D', subtitle: 'Strong cadence, flat subscriber growth' },
  'HOLD—LOW CADENCE': { color: '#F5B73D', subtitle: 'Cadence has dropped' },
  QUIET:              { color: '#A0A0A0', subtitle: 'Channel is silent' },
};
