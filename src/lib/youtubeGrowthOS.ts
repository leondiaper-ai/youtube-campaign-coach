// ─────────────────────────────────────────────────────────────────────────────
// YouTube Growth OS — Shared logic layer
//
// One module, one truth. Every tool in the system (Watcher, Coach, Campaign
// Status Board, Report Generator, Timeline Builder) calls this instead of
// maintaining its own state/diagnosis/action logic.
//
// Core question: "What is the growth state, what is limiting growth,
//                 and what should we do next?"
// ─────────────────────────────────────────────────────────────────────────────

// ── Thresholds (centralised, editable) ─────────────────────────────────────

export const THRESHOLDS = {
  // State classification
  cold: { lastUploadDays: 60, uploadsIfRecent: 0, lastUploadFloor: 30 },
  atRisk: { uploads30d: 2, lastUploadDays: 14, campaignUploads: 3 },
  weakConversion: { minUploads: 3, viewsStrong: 5000 },
  healthy: { minUploads: 5, lastUploadDays: 7 },
  scale: { minUploads: 5, minShorts: 3, viewsStrong: 5000 },
  underFed: { maxUploads: 2 },

  // Blocker detection
  cadenceGap: { minUploads: 3, maxLastUploadDays: 14 },
  formatGap: { minOfficials: 1 },
  conversionGap: { viewsStrong: 5000 },
  momentumGap: { minViewsDelta: 0 },
} as const;

// ── Types ──────────────────────────────────────────────────────────────────

export type GrowthState =
  | 'COLD'
  | 'AT_RISK'
  | 'BUILDING'
  | 'WEAK_CONVERSION'
  | 'HEALTHY'
  | 'SCALE';

export type GrowthSubState =
  | 'INACTIVE'
  | 'NEEDS_REACTIVATION'
  | 'CADENCE_DROPPED'
  | 'LOSING_RHYTHM'
  | 'UNDER_FED_MOMENTUM'
  | 'EARLY_TRACTION'
  | 'NEEDS_CONSISTENCY'
  | 'ESTABLISHING_PRESENCE'
  | 'NOT_CONVERTING'
  | 'MAINTAINING'
  | 'COMPOUNDING'
  | 'FULL_MOMENTUM';

export type Blocker =
  | 'CADENCE_GAP'
  | 'FORMAT_GAP'
  | 'CONVERSION_GAP'
  | 'MOMENTUM_GAP'
  | 'ASSET_GAP'
  | 'CAMPAIGN_ALIGNMENT_GAP'
  | 'AUDIENCE_CONNECTION_GAP'
  | 'NONE';

export type DecisionLabel = 'PUSH' | 'FIX' | 'HOLD';
export type Confidence = 'HIGH' | 'MED' | 'LOW';

/** Everything the Growth OS needs to evaluate a channel. */
export type GrowthInput = {
  // Core metrics
  subscribers?: number;
  views7d?: number | null;
  subscribers7d?: number | null;
  uploads30d: number;
  shorts30d: number;
  lastUploadDaysAgo: number | null;

  // Campaign context (optional)
  hasActiveCampaign?: boolean;
  campaignName?: string;
  campaignDay?: number;
  campaignContentViews?: number;
  campaignUploads?: number;
  campaignShorts?: number;

  // Content inventory (optional)
  plannedDrops?: number;
  officialVideos?: number;
  lyricVideos?: number;
  visualizers?: number;
  communityPosts?: number;

  // Conversion data (optional)
  conversionRatePer1k?: number;
};

// ── State classification ───────────────────────────────────────────────────

export type GrowthStateResult = {
  state: GrowthState;
  subState: GrowthSubState;
  decision: DecisionLabel;
  confidence: Confidence;
  showConfidence: boolean;
};

export function getYouTubeGrowthState(input: GrowthInput): GrowthStateResult {
  const {
    views7d, subscribers7d, uploads30d, shorts30d,
    lastUploadDaysAgo, hasActiveCampaign,
  } = input;

  const T = THRESHOLDS;
  const viewsUp = views7d != null && views7d > 0;
  const viewsStrong = views7d != null && views7d > T.scale.viewsStrong;
  const subsUp = subscribers7d != null && subscribers7d > 0;
  const subsFlat = subscribers7d == null || subscribers7d <= 0;
  const hasData = views7d != null || subscribers7d != null;
  const cadenceLow = uploads30d <= T.underFed.maxUploads;

  // ── COLD ──
  if (
    lastUploadDaysAgo == null ||
    lastUploadDaysAgo >= T.cold.lastUploadDays ||
    (uploads30d === T.cold.uploadsIfRecent && (lastUploadDaysAgo == null || lastUploadDaysAgo >= T.cold.lastUploadFloor))
  ) {
    return {
      state: 'COLD',
      subState: hasActiveCampaign ? 'NEEDS_REACTIVATION' : 'INACTIVE',
      decision: 'HOLD',
      confidence: 'LOW',
      showConfidence: false,
    };
  }

  // ── SCALE — both metrics accelerating + strong cadence ──
  if (
    uploads30d >= T.scale.minUploads &&
    shorts30d >= T.scale.minShorts &&
    viewsStrong && subsUp
  ) {
    return {
      state: 'SCALE',
      subState: 'FULL_MOMENTUM',
      decision: 'PUSH',
      confidence: 'HIGH',
      showConfidence: true,
    };
  }

  // ── UNDER-FED MOMENTUM — views + subs up but low cadence ──
  if (viewsUp && subsUp && cadenceLow) {
    return {
      state: 'BUILDING',
      subState: 'UNDER_FED_MOMENTUM',
      decision: 'PUSH',
      confidence: viewsStrong ? 'HIGH' : 'MED',
      showConfidence: true,
    };
  }

  // ── AT RISK ──
  if (
    uploads30d === 0 ||
    (lastUploadDaysAgo != null && lastUploadDaysAgo > 30) ||
    (uploads30d < T.atRisk.uploads30d && lastUploadDaysAgo != null && lastUploadDaysAgo > T.atRisk.lastUploadDays) ||
    (hasActiveCampaign && uploads30d < T.atRisk.campaignUploads)
  ) {
    const cadenceNone = uploads30d === 0;
    return {
      state: 'AT_RISK',
      subState: cadenceNone ? 'CADENCE_DROPPED' : 'LOSING_RHYTHM',
      decision: 'FIX',
      confidence: 'HIGH',
      showConfidence: true,
    };
  }

  // ── WEAK CONVERSION ──
  if (
    uploads30d >= T.weakConversion.minUploads &&
    viewsStrong && subsFlat
  ) {
    return {
      state: 'WEAK_CONVERSION',
      subState: 'NOT_CONVERTING',
      decision: 'FIX',
      confidence: 'HIGH',
      showConfidence: true,
    };
  }

  // Catch: high cadence + views up + subs flat
  if (
    uploads30d >= T.healthy.minUploads &&
    lastUploadDaysAgo != null && lastUploadDaysAgo <= T.healthy.lastUploadDays &&
    viewsUp && subsFlat
  ) {
    return {
      state: 'WEAK_CONVERSION',
      subState: 'NOT_CONVERTING',
      decision: 'FIX',
      confidence: 'MED',
      showConfidence: true,
    };
  }

  // ── HEALTHY ──
  if (
    uploads30d >= T.healthy.minUploads &&
    lastUploadDaysAgo != null && lastUploadDaysAgo <= T.healthy.lastUploadDays &&
    (!viewsStrong || subsUp)
  ) {
    const momentum = subsUp && viewsStrong;
    return {
      state: 'HEALTHY',
      subState: momentum ? 'COMPOUNDING' : 'MAINTAINING',
      decision: 'PUSH',
      confidence: momentum ? 'HIGH' : 'MED',
      showConfidence: momentum,
    };
  }

  // ── BUILDING (default) ──
  if (!hasData) {
    return {
      state: 'BUILDING',
      subState: 'ESTABLISHING_PRESENCE',
      decision: 'HOLD',
      confidence: 'LOW',
      showConfidence: false,
    };
  }

  const trendPositive = viewsUp || subsUp;
  return {
    state: 'BUILDING',
    subState: trendPositive ? 'EARLY_TRACTION' : 'NEEDS_CONSISTENCY',
    decision: trendPositive ? 'PUSH' : 'HOLD',
    confidence: trendPositive ? 'MED' : 'LOW',
    showConfidence: trendPositive,
  };
}

// ── Blocker detection ──────────────────────────────────────────────────────

export type BlockerResult = {
  blocker: Blocker;
  label: string;
  description: string;
};

export function getPrimaryBlocker(input: GrowthInput): BlockerResult {
  const {
    uploads30d, shorts30d, lastUploadDaysAgo,
    views7d, subscribers7d,
    officialVideos = 0, lyricVideos = 0, visualizers = 0,
    plannedDrops = 0,
    hasActiveCampaign,
  } = input;

  const T = THRESHOLDS;
  const viewsStrong = views7d != null && views7d > T.conversionGap.viewsStrong;
  const viewsUp = views7d != null && views7d > 0;
  const subsFlat = subscribers7d == null || subscribers7d <= 0;
  const subsWeak = subscribers7d == null || subscribers7d < 50;

  // Priority order — most urgent first

  // 1. CADENCE_GAP: not uploading enough
  if (
    uploads30d < T.cadenceGap.minUploads ||
    (lastUploadDaysAgo != null && lastUploadDaysAgo > T.cadenceGap.maxLastUploadDays)
  ) {
    return {
      blocker: 'CADENCE_GAP',
      label: 'Upload cadence',
      description: uploads30d === 0
        ? 'No uploads in 30 days — the algorithm has nothing to work with'
        : `Only ${uploads30d} upload${uploads30d === 1 ? '' : 's'} in 30 days — not enough to sustain algorithmic momentum`,
    };
  }

  // 2. CONVERSION_GAP: views without subs
  if (viewsStrong && subsFlat) {
    return {
      blocker: 'CONVERSION_GAP',
      label: 'View-to-subscriber conversion',
      description: 'Views are strong but not converting to subscribers — content is discoverable but not compelling enough to convert',
    };
  }

  // 3. FORMAT_GAP: official videos but no supporting formats
  if (
    officialVideos >= T.formatGap.minOfficials &&
    shorts30d === 0 && lyricVideos === 0 && visualizers === 0
  ) {
    return {
      blocker: 'FORMAT_GAP',
      label: 'Missing content formats',
      description: 'Official videos exist but no Shorts, lyric videos, or visualizers to extend reach — every video needs a format ecosystem around it',
    };
  }

  // 4. CAMPAIGN_ALIGNMENT_GAP: uploads not serving campaign
  if (hasActiveCampaign && uploads30d > 0 && plannedDrops > 0) {
    return {
      blocker: 'CAMPAIGN_ALIGNMENT_GAP',
      label: 'Campaign alignment',
      description: 'Uploads are happening but not aligned with the campaign timeline — every post should serve the rollout',
    };
  }

  // 5. ASSET_GAP: drops planned but no assets mapped
  if (plannedDrops > 0 && officialVideos === 0) {
    return {
      blocker: 'ASSET_GAP',
      label: 'Content assets',
      description: 'Campaign drops are planned but no content assets are ready — need to map and prepare assets ahead of schedule',
    };
  }

  // 6. AUDIENCE_CONNECTION_GAP: output present but engagement weak
  if (uploads30d >= 3 && viewsUp && subsWeak) {
    return {
      blocker: 'AUDIENCE_CONNECTION_GAP',
      label: 'Audience connection',
      description: 'Content is being published but audience growth is weak — need depth content that builds connection, not just volume',
    };
  }

  // 7. MOMENTUM_GAP: views declining
  if (views7d != null && views7d <= T.momentumGap.minViewsDelta) {
    return {
      blocker: 'MOMENTUM_GAP',
      label: 'Momentum',
      description: 'View momentum is flat or declining — the algorithm is not amplifying current content',
    };
  }

  return {
    blocker: 'NONE',
    label: 'No critical blocker',
    description: 'No major growth blocker detected — maintain current approach',
  };
}

// ── Recommended actions ────────────────────────────────────────────────────

export type RecommendedActions = {
  doNow: string[];
  doNext: string[];
  dontDoYet: string[];
  watchMetric: string;
};

export function getRecommendedActions(input: GrowthInput): RecommendedActions {
  const state = getYouTubeGrowthState(input);
  const blocker = getPrimaryBlocker(input);
  const noShorts = input.shorts30d === 0;
  const hasCampaign = !!input.hasActiveCampaign;

  switch (state.state) {
    case 'COLD':
      return {
        doNow: [
          'Ship 2–3 catalogue Shorts this week to restart the feed',
          ...(hasCampaign ? ['Tease campaign content to signal a return'] : []),
          'Post 1 Community Post announcing activity',
        ],
        doNext: [
          'Establish a minimum weekly upload cadence',
          'Plan first longform upload for next week',
        ],
        dontDoYet: [
          'Don\'t spend on paid until cadence is re-established',
          'Don\'t launch campaign content until channel is warmed up',
        ],
        watchMetric: 'First upload → then daily views recovering from baseline',
      };

    case 'AT_RISK':
      return {
        doNow: [
          input.uploads30d === 0
            ? 'Ship something today — a Short or Community Post to break the silence'
            : 'Add a Short or Premiere this week to rebuild rhythm',
          ...(noShorts ? ['Cut 3–5 Shorts from existing catalogue'] : []),
          ...(hasCampaign ? ['Bring forward the next campaign asset — don\'t wait'] : []),
        ],
        doNext: [
          'Establish daily or every-other-day upload rhythm',
          'Prepare next 2 weeks of content pipeline',
        ],
        dontDoYet: [
          'Don\'t spend on paid amplification yet',
          'Don\'t launch new longform until cadence is stable',
        ],
        watchMetric: 'Upload cadence → aim for 3+ uploads this week',
      };

    case 'WEAK_CONVERSION':
      return {
        doNow: [
          'Post 1 BTS / breakdown / artist-led piece this week',
          'Add context to existing videos — pinned comments, descriptions, cards',
          ...(noShorts ? ['Start a Shorts layer to broaden the funnel'] : []),
        ],
        doNext: [
          'Test a subscribe CTA in the first 10s of next video',
          'Build 1 community-focused piece (Q&A, behind-the-scenes, reaction)',
        ],
        dontDoYet: [
          'Don\'t increase volume — the issue is depth, not frequency',
          'Hold paid support until conversion improves',
        ],
        watchMetric: 'Subscriber growth rate — subs per 1K views should climb above 2',
      };

    case 'BUILDING':
      if (state.subState === 'UNDER_FED_MOMENTUM') {
        return {
          doNow: [
            ...(noShorts ? [
              'Publish 1 Short per day (minimum 5 this week)',
              'Source Shorts from existing official videos — no new content required',
              'Prioritise latest release first, then previous single',
            ] : [
              'Increase to 1 upload every 2 days minimum',
            ]),
          ],
          doNext: [
            'Build a Shorts pipeline — batch-create 10+ cuts from existing videos',
            'Add community posts between uploads to maintain presence',
          ],
          dontDoYet: [
            'Don\'t over-invest in longform yet — Shorts velocity is the unlock',
            'Don\'t change content style — the current approach is working, it just needs volume',
          ],
          watchMetric: 'Upload cadence → views should accelerate as cadence increases',
        };
      }
      return {
        doNow: [
          state.subState === 'EARLY_TRACTION'
            ? 'Lock this cadence — aim for 5+ uploads this month'
            : 'Establish weekly consistency — 2 uploads per week minimum',
          ...(noShorts ? ['Add a Shorts layer — cut 3–5 from existing content'] : []),
          ...(hasCampaign ? ['Align every upload with the campaign rollout'] : []),
        ],
        doNext: [
          'Test 1 depth content piece to develop conversion signal',
          'Build a 2-week upload calendar',
        ],
        dontDoYet: [
          'Don\'t spend on paid until upload rhythm is locked',
          'Don\'t add complexity — consistency is the unlock',
        ],
        watchMetric: 'Weekly upload count → need consistent pattern before algorithm amplifies',
      };

    case 'HEALTHY':
      return {
        doNow: [
          'Maintain current cadence — don\'t break the run',
          'Queue next campaign asset to keep the pipeline loaded',
        ],
        doNext: [
          'Monitor for conversion dip',
          ...(hasCampaign ? ['Prepare next campaign moment'] : []),
        ],
        dontDoYet: [
          'Don\'t add complexity while it\'s working',
          'Don\'t over-optimise — protect the rhythm',
        ],
        watchMetric: 'Views + subs stability — watch for conversion dip',
      };

    case 'SCALE':
      return {
        doNow: [
          'Amplify now — paid, collaborations, or strongest campaign asset',
          'Bring forward the biggest content moment while momentum holds',
          'Maintain current upload cadence',
        ],
        doNext: [
          'Test paid amplification on top-performing recent upload',
          'Plan collaboration or feature to extend reach',
        ],
        dontDoYet: [
          'Don\'t change what\'s working',
          'Don\'t pull budget from what\'s compounding',
        ],
        watchMetric: 'Both views and subs — this window doesn\'t last, push now',
      };
  }
}

// ── Growth Read (full report object) ───────────────────────────────────────

export type GrowthRead = {
  title: string;
  state: GrowthState;
  subState: GrowthSubState;
  decision: DecisionLabel;
  confidence: Confidence;
  showConfidence: boolean;
  signal: string;
  blocker: BlockerResult;
  actions: RecommendedActions;
  nextCampaignMove: string;
  watch: string;
  shortSummary: string;
  slackCopy: string;
};

export function generateYouTubeGrowthRead(
  artistName: string,
  input: GrowthInput,
): GrowthRead {
  const stateResult = getYouTubeGrowthState(input);
  const blocker = getPrimaryBlocker(input);
  const actions = getRecommendedActions(input);

  // Signal — plain English summary of what the data shows
  const signal = buildSignal(input, stateResult);

  // Next campaign move
  const nextCampaignMove = buildNextCampaignMove(input, stateResult);

  // Short summary — one sentence
  const shortSummary = buildShortSummary(artistName, stateResult, blocker);

  // Slack copy
  const slackCopy = buildSlackCopy(artistName, stateResult, signal, blocker, actions, nextCampaignMove);

  return {
    title: `YouTube Growth Read — ${artistName}`,
    state: stateResult.state,
    subState: stateResult.subState,
    decision: stateResult.decision,
    confidence: stateResult.confidence,
    showConfidence: stateResult.showConfidence,
    signal,
    blocker,
    actions,
    nextCampaignMove,
    watch: actions.watchMetric,
    shortSummary,
    slackCopy,
  };
}

// ── Internal helpers ───────────────────────────────────────────────────────

function buildSignal(input: GrowthInput, state: GrowthStateResult): string {
  const { views7d, subscribers7d, uploads30d, shorts30d } = input;
  const viewsStr = views7d != null ? `${views7d >= 0 ? '+' : ''}${fmtK(views7d)} views` : 'no view data';
  const subsStr = subscribers7d != null ? `${subscribers7d >= 0 ? '+' : ''}${fmtK(subscribers7d)} subs` : 'no sub data';
  const cadenceStr = `${uploads30d} upload${uploads30d === 1 ? '' : 's'} / 30d`;
  const shortsStr = shorts30d === 0 ? 'no Shorts' : `${shorts30d} Shorts`;

  switch (state.state) {
    case 'COLD':
      return 'Channel is silent. No recent uploads, no audience signal.';
    case 'AT_RISK':
      return `Cadence is dropping — ${cadenceStr}. ${viewsStr}, ${subsStr}. Algorithm is deprioritising.`;
    case 'WEAK_CONVERSION':
      return `${viewsStr} but ${subsStr}. Content is being discovered but not converting. ${cadenceStr}, ${shortsStr}.`;
    case 'BUILDING':
      if (state.subState === 'UNDER_FED_MOMENTUM') {
        return `Strong early growth (${viewsStr}, ${subsStr}) off minimal activity (${cadenceStr}). Channel is under-fed, not underperforming. ${shortsStr}.`;
      }
      return `${viewsStr}, ${subsStr}. ${cadenceStr}, ${shortsStr}. Building but not yet at rhythm.`;
    case 'HEALTHY':
      return `Good rhythm — ${cadenceStr}. ${viewsStr}, ${subsStr}. Algorithm is supporting.`;
    case 'SCALE':
      return `Both metrics accelerating — ${viewsStr}, ${subsStr}. Strong cadence (${cadenceStr}). This is the window to push.`;
  }
}

function buildNextCampaignMove(input: GrowthInput, state: GrowthStateResult): string {
  if (!input.hasActiveCampaign) {
    if (state.state === 'COLD' || state.state === 'AT_RISK') {
      return 'Re-establish channel presence before considering campaign activity';
    }
    return 'No active campaign — focus on building sustainable channel rhythm';
  }

  switch (state.state) {
    case 'COLD':
      return 'Warm the channel with catalogue content before deploying campaign assets';
    case 'AT_RISK':
      return 'Bring forward next campaign asset to restart cadence — don\'t wait for the planned date';
    case 'WEAK_CONVERSION':
      return 'Add depth content around campaign — BTS, breakdowns, artist-led context to improve conversion';
    case 'BUILDING':
      return state.subState === 'UNDER_FED_MOMENTUM'
        ? 'Build Shorts layer from campaign content — the algorithm is ready to amplify'
        : 'Align uploads with campaign timeline — every post should serve the rollout';
    case 'HEALTHY':
      return 'Queue next campaign moment — maintain the cadence while preparing the next push';
    case 'SCALE':
      return 'Deploy your strongest campaign asset now — this is the optimal window';
  }
}

function buildShortSummary(
  artistName: string,
  state: GrowthStateResult,
  blocker: BlockerResult,
): string {
  if (blocker.blocker === 'NONE') {
    return `${artistName} is in a ${state.state.replace('_', ' ').toLowerCase()} state — no critical blockers.`;
  }
  return `${artistName} is ${state.state.replace('_', ' ').toLowerCase()} — primary blocker is ${blocker.label.toLowerCase()}.`;
}

function buildSlackCopy(
  artistName: string,
  state: GrowthStateResult,
  signal: string,
  blocker: BlockerResult,
  actions: RecommendedActions,
  nextCampaignMove: string,
): string {
  const confStr = state.showConfidence ? ` (${state.confidence})` : '';
  return [
    `YOUTUBE GROWTH READ — ${artistName.toUpperCase()}`,
    '',
    `STATE: ${state.state.replace('_', ' ')}${confStr}`,
    '',
    'SIGNAL:',
    signal,
    '',
    'BLOCKER:',
    blocker.blocker === 'NONE'
      ? 'No critical blocker'
      : `${blocker.label} — ${blocker.description}`,
    '',
    'ACTION:',
    ...actions.doNow.map((a) => `→ ${a}`),
    '',
    'NEXT CAMPAIGN MOVE:',
    nextCampaignMove,
    '',
    'WATCH:',
    actions.watchMetric,
  ].join('\n');
}

function fmtK(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

// ── Display helpers (for UI consistency) ───────────────────────────────────

export const STATE_LABELS: Record<GrowthState, string> = {
  COLD: 'Cold',
  AT_RISK: 'At risk',
  BUILDING: 'Building',
  WEAK_CONVERSION: 'Weak conversion',
  HEALTHY: 'Healthy',
  SCALE: 'Scale',
};

export const SUB_STATE_LABELS: Record<GrowthSubState, string> = {
  INACTIVE: 'Inactive',
  NEEDS_REACTIVATION: 'Needs reactivation',
  CADENCE_DROPPED: 'Cadence dropped',
  LOSING_RHYTHM: 'Losing rhythm',
  UNDER_FED_MOMENTUM: 'Under-fed momentum',
  EARLY_TRACTION: 'Early traction',
  NEEDS_CONSISTENCY: 'Needs consistency',
  ESTABLISHING_PRESENCE: 'Establishing presence',
  NOT_CONVERTING: 'Not converting',
  MAINTAINING: 'Maintaining',
  COMPOUNDING: 'Compounding',
  FULL_MOMENTUM: 'Full momentum',
};

export const DECISION_STYLE: Record<DecisionLabel, { bg: string; fg: string; border: string }> = {
  PUSH: { bg: '#E6F8EE', fg: '#0C6A3F', border: '#B8E8D0' },
  FIX:  { bg: '#FFF0E6', fg: '#8A4A1A', border: '#FFD4B3' },
  HOLD: { bg: '#F5F0E4', fg: '#7A6B4E', border: '#E0D6C2' },
};

export const STATE_STYLE: Record<GrowthState, { bg: string; fg: string }> = {
  COLD:            { bg: '#FFE2D8', fg: '#8A1F0C' },
  AT_RISK:         { bg: '#FFE2D8', fg: '#8A1F0C' },
  BUILDING:        { bg: '#FFF5D6', fg: '#7A5A00' },
  WEAK_CONVERSION: { bg: '#FFEAD6', fg: '#8A4A1A' },
  HEALTHY:         { bg: '#E6F8EE', fg: '#0C6A3F' },
  SCALE:           { bg: '#E6F8EE', fg: '#0C6A3F' },
};

export const SPARK_STYLE: Record<GrowthState, { stroke: string; fill: string }> = {
  COLD:            { stroke: '#FF4A1C', fill: 'rgba(255,74,28,0.10)' },
  AT_RISK:         { stroke: '#FF4A1C', fill: 'rgba(255,74,28,0.10)' },
  BUILDING:        { stroke: '#C4A94D', fill: 'rgba(196,169,77,0.10)' },
  WEAK_CONVERSION: { stroke: '#F08A3C', fill: 'rgba(240,138,60,0.10)' },
  HEALTHY:         { stroke: '#1FBE7A', fill: 'rgba(31,190,122,0.12)' },
  SCALE:           { stroke: '#1FBE7A', fill: 'rgba(31,190,122,0.12)' },
};

// ── ChannelState ↔ GrowthState bridge ──────────────────────────────────────
// For backwards compatibility during migration — lets existing components
// that receive ChannelState from deriveFromLive() convert to GrowthState.

export function channelStateToGrowthState(
  cs: 'HEALTHY' | 'WEAK CONVERSION' | 'BUILDING' | 'AT RISK' | 'COLD',
): GrowthState {
  switch (cs) {
    case 'HEALTHY': return 'HEALTHY';
    case 'WEAK CONVERSION': return 'WEAK_CONVERSION';
    case 'BUILDING': return 'BUILDING';
    case 'AT RISK': return 'AT_RISK';
    case 'COLD': return 'COLD';
  }
}
