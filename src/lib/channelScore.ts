/**
 * Channel Score — directional benchmark layer.
 *
 * IMPORTANT DESIGN PRINCIPLE:
 * Scores measure how well a channel is being RUN — not how big or famous
 * the artist is. We do NOT rank on total subscribers, lifetime views, or
 * artist popularity. Those should never directly increase a channel's score.
 *
 * Instead we prioritise:
 *   - Conversion efficiency (subs per 1K views)
 *   - Cadence & consistency (posting regularity)
 *   - Momentum / growth rate (percentage growth, not raw totals)
 *
 * Anti-bias rules:
 *   - Large channels do NOT automatically score highly
 *   - Raw view counts are context only, never the primary score driver
 *   - Percentile positioning within the pool prevents legacy channels dominating
 *
 * Scores each channel A/B/C/D across 3 pillars:
 *   1. Reach (% views growth vs tracked pool — size-neutral)
 *   2. Conversion (subs gained per 1K views — pure efficiency)
 *   3. Cadence (uploads in 30d, days since last upload — execution)
 *
 * Benchmark: our tracked artist pool median + top 20%.
 * This is NOT a global YouTube benchmark — it's directional.
 */

// ── Types ─────────────────────────────────────────────────────────────────

export type PillarStatus = 'strong' | 'average' | 'weak' | 'limited';

export type PillarResult = {
  status: PillarStatus;
  icon: string;
  reason: string;
};

export type ChannelScore = {
  grade: 'A' | 'B' | 'C' | 'D' | 'Limited';
  totalPoints: number;
  label: string; // one-line summary
  pillars: {
    reach: PillarResult;
    conversion: PillarResult;
    cadence: PillarResult;
  };
  benchmarkLabel: string;
  dataQuality: 'good' | 'partial' | 'insufficient';
};

export type ChannelScoreInput = {
  views7Delta: number | null;
  subs7Delta: number | null;
  uploads30d: number;
  shorts30d: number;
  lastUploadAt: string | null;
  subs: number | null;
  /** Total channel views — used ONLY as baseline denominator for growth %, never as a score driver */
  totalViews?: number | null;
  /** Previous 7d views delta (i.e. the week before) — best baseline for growth % */
  prevViews7Delta?: number | null;
  /** Movement confidence — stale data should not drive scores */
  movementConfidence?: 'high' | 'medium' | 'limited' | 'stale';
  /** Whether this artist has an active campaign */
  hasActiveCampaign?: boolean;
  /** Best available movement source — drives scoring intelligence */
  bestAvailableSource?: 'live_7d' | 'recent_snapshot' | 'campaign_period' | 'recent_uploads' | 'last_confirmed' | 'none';
};

export type BenchmarkPool = {
  /** Median 7d views growth PERCENTAGE across pool (size-neutral) */
  medianGrowthPct: number;
  /** Top 20% growth percentage threshold */
  topGrowthPct: number;
  /** Fallback: raw views7 median (only used when % unavailable) */
  medianViews7Raw: number;
  topViews7Raw: number;
  medianUploads30d: number;
  topUploads30d: number;
  medianConversion: number; // subs per 1K views
  topConversion: number;
  size: number;
};

// ── Icons ─────────────────────────────────────────────────────────────────

const ICONS: Record<PillarStatus, string> = {
  strong: '✅',
  average: '⚖️',
  weak: '❌',
  limited: '◻️',
};

// ── Benchmark computation ─────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export function computeBenchmarkPool(channels: ChannelScoreInput[]): BenchmarkPool {
  // Growth percentages — the PRIMARY reach signal (size-neutral)
  const growthPcts = channels
    .map((c) => computeGrowthPct(c))
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b);

  // Raw views7 as fallback only
  const views7Raw = channels
    .map((c) => c.views7Delta)
    .filter((v): v is number => v != null && v >= 0)
    .sort((a, b) => a - b);

  const uploads30Vals = channels
    .map((c) => c.uploads30d)
    .sort((a, b) => a - b);

  // Conversion: subs per 1K views (only where both are available and views > 0)
  const conversionVals = channels
    .filter((c) => c.subs7Delta != null && c.views7Delta != null && c.views7Delta > 0)
    .map((c) => ((c.subs7Delta! / c.views7Delta!) * 1000))
    .sort((a, b) => a - b);

  return {
    medianGrowthPct: percentile(growthPcts, 50),
    topGrowthPct: percentile(growthPcts, 80),
    medianViews7Raw: percentile(views7Raw, 50),
    topViews7Raw: percentile(views7Raw, 80),
    medianUploads30d: percentile(uploads30Vals, 50),
    topUploads30d: percentile(uploads30Vals, 80),
    medianConversion: percentile(conversionVals, 50),
    topConversion: percentile(conversionVals, 80),
    size: channels.length,
  };
}

/**
 * Compute growth percentage for a channel.
 * Uses the best available baseline:
 *   1. Previous 7d delta (week-over-week comparison)
 *   2. Total views as a rough denominator
 * Returns null if no reliable baseline exists.
 *
 * NOTE: This is the key anti-bias mechanism. By using percentage growth
 * instead of raw deltas, a 50K-view channel growing 20% outscores a
 * 5M-view channel growing 2%.
 */
export function computeGrowthPct(input: ChannelScoreInput): number | null {
  if (input.views7Delta == null || input.views7Delta <= 0) return null;

  // Best: compare against previous week's views
  if (input.prevViews7Delta != null && input.prevViews7Delta > 0) {
    return ((input.views7Delta - input.prevViews7Delta) / input.prevViews7Delta) * 100;
  }

  // Fallback: use total views as denominator (rough but size-neutral)
  if (input.totalViews != null && input.totalViews > 0) {
    return (input.views7Delta / input.totalViews) * 100;
  }

  // No reliable baseline — cannot compute percentage
  return null;
}

// ── Pillar scoring ────────────────────────────────────────────────────────

/**
 * Score Reach using PERCENTAGE GROWTH as primary signal.
 * Raw view counts are context only — they do not drive the score.
 * This ensures a smaller channel growing quickly outscores a large stagnant one.
 */
function scoreReach(input: ChannelScoreInput, pool: BenchmarkPool): PillarResult {
  if (input.movementConfidence === 'stale') {
    return { status: 'limited', icon: ICONS.limited, reason: 'Channel totals updating — reach score paused' };
  }
  if (input.views7Delta == null) {
    return { status: 'limited', icon: ICONS.limited, reason: 'Building data — reach score will appear soon' };
  }

  const growthPct = computeGrowthPct(input);

  // Primary path: percentage growth available
  if (growthPct != null && pool.medianGrowthPct > 0) {
    if (growthPct >= pool.topGrowthPct) {
      return { status: 'strong', icon: ICONS.strong, reason: `+${growthPct.toFixed(0)}% growth — top 20% vs pool` };
    }
    if (growthPct >= pool.medianGrowthPct) {
      return { status: 'average', icon: ICONS.average, reason: `+${growthPct.toFixed(0)}% growth — around median` };
    }
    if (growthPct > 0) {
      return { status: 'weak', icon: ICONS.weak, reason: `+${growthPct.toFixed(0)}% growth — below median` };
    }
    return { status: 'weak', icon: ICONS.weak, reason: 'Flat or declining growth rate' };
  }

  // Fallback: raw delta only (no baseline for %). Score conservatively.
  // Large raw numbers do NOT get automatic Strong — that would bias toward big channels.
  const v7 = input.views7Delta;
  if (v7 <= 0) {
    return { status: 'weak', icon: ICONS.weak, reason: 'Near-zero reach this week' };
  }
  if (v7 >= pool.topViews7Raw && pool.topViews7Raw > 0) {
    // Even with high raw views, cap at Average if we can't confirm growth rate
    return { status: 'average', icon: ICONS.average, reason: 'High raw views, no growth baseline' };
  }
  if (v7 >= pool.medianViews7Raw && pool.medianViews7Raw > 0) {
    return { status: 'average', icon: ICONS.average, reason: 'Moderate raw views, limited baseline' };
  }
  return { status: 'limited', icon: ICONS.limited, reason: 'Waiting for enough history to establish growth baseline' };
}

function scoreConversion(input: ChannelScoreInput, pool: BenchmarkPool): PillarResult {
  if (input.movementConfidence === 'stale') {
    return { status: 'limited', icon: ICONS.limited, reason: 'Channel totals updating — conversion score paused' };
  }
  if (input.subs7Delta == null || input.views7Delta == null || input.views7Delta <= 0) {
    return { status: 'limited', icon: ICONS.limited, reason: 'Building data — conversion score will appear soon' };
  }

  const convRate = (input.subs7Delta / input.views7Delta) * 1000; // subs per 1K views
  const pct = (input.subs7Delta / input.views7Delta) * 100; // percentage

  if (pct >= 1 || (pool.topConversion > 0 && convRate >= pool.topConversion)) {
    return { status: 'strong', icon: ICONS.strong, reason: `${pct.toFixed(1)}% subs per views` };
  }
  if (pct >= 0.5 || (pool.medianConversion > 0 && convRate >= pool.medianConversion)) {
    return { status: 'average', icon: ICONS.average, reason: `${pct.toFixed(1)}% subs per views` };
  }
  return { status: 'weak', icon: ICONS.weak, reason: `${pct.toFixed(1)}% subs per views` };
}

function scoreCadence(input: ChannelScoreInput): PillarResult {
  const { uploads30d, shorts30d, lastUploadAt } = input;
  const total = uploads30d + shorts30d;

  // Days since last upload
  let daysSince = 999;
  if (lastUploadAt) {
    daysSince = Math.floor((Date.now() - new Date(lastUploadAt).getTime()) / 86400000);
  }

  if (daysSince > 30 && total === 0) {
    return { status: 'weak', icon: ICONS.weak, reason: 'No uploads in 30+ days' };
  }
  if (total >= 8 || (uploads30d >= 4 && shorts30d >= 4)) {
    return { status: 'strong', icon: ICONS.strong, reason: `${total} uploads / 30d` };
  }
  if (total >= 3) {
    return { status: 'average', icon: ICONS.average, reason: `${total} uploads / 30d` };
  }
  if (total >= 1) {
    return { status: 'weak', icon: ICONS.weak, reason: `${total} upload${total > 1 ? 's' : ''} / 30d` };
  }
  return { status: 'weak', icon: ICONS.weak, reason: 'Inactive' };
}

// ── Main scoring function ─────────────────────────────────────────────────

const POINTS: Record<PillarStatus, number> = {
  strong: 2,
  average: 1,
  weak: 0,
  limited: 0, // unknown data should not inflate score
};

function computeGrade(
  total: number,
  reliablePillars: number,
  pillars: ChannelScore['pillars'],
  movementConfidence?: 'high' | 'medium' | 'limited' | 'stale',
  hasActiveCampaign?: boolean,
  bestAvailableSource?: string,
): ChannelScore['grade'] {
  // Not enough data to grade meaningfully
  if (reliablePillars <= 1) {
    // OPERATIONAL SIGNAL OVERRIDE: when movement is stale, use cadence + campaign
    // activity to avoid collapsing active channels to "Limited".
    if (movementConfidence === 'stale' || movementConfidence === 'limited') {
      // Active campaign + any cadence → at least 'C' (campaign is running)
      if (hasActiveCampaign && pillars.cadence.status !== 'weak') {
        return 'C';
      }
      // Strong cadence without campaign → 'C' (active channel)
      if (pillars.cadence.status === 'strong') {
        return 'C';
      }
      // Average cadence → 'D' (some activity, but not enough for C)
      if (pillars.cadence.status === 'average') {
        return 'D';
      }
    }
    return 'Limited';
  }

  // Any weak pillar caps the grade at B — you can't be "A" with a failing dimension
  const hasWeak = Object.values(pillars).some((p) => p.status === 'weak');
  // Any limited pillar (insufficient data) caps at C — can't grade highly on incomplete picture
  const hasLimited = Object.values(pillars).some((p) => p.status === 'limited');

  let maxGrade: ChannelScore['grade'] = 'A';
  if (hasLimited) maxGrade = 'C';
  else if (hasWeak) maxGrade = 'B';

  // Point-based grade
  let grade: ChannelScore['grade'];
  if (total >= 5) grade = 'A';
  else if (total >= 4) grade = 'B';
  else if (total >= 2) grade = 'C';
  else grade = 'D';

  // Apply cap
  const gradeOrder: Record<ChannelScore['grade'], number> = { A: 4, B: 3, C: 2, D: 1, Limited: 0 };
  if (gradeOrder[grade] > gradeOrder[maxGrade]) grade = maxGrade;

  return grade;
}

/**
 * Build an execution-focused summary label.
 * These describe HOW WELL the channel is run, not how big the artist is.
 */
function buildLabel(
  pillars: ChannelScore['pillars'],
  movementConfidence?: 'high' | 'medium' | 'limited' | 'stale',
  hasActiveCampaign?: boolean,
  bestAvailableSource?: string,
): string {
  const r = pillars.reach.status;
  const c = pillars.conversion.status;
  const d = pillars.cadence.status;

  // STALE-BUT-ACTIVE patterns — channel is uploading but totals are delayed
  if (movementConfidence === 'stale' || movementConfidence === 'limited') {
    // Campaign + cadence → campaign-aware label
    if (hasActiveCampaign && d !== 'weak') {
      return 'Campaign active — channel totals updating';
    }
    // Recent snapshot available — more specific than generic "totals updating"
    if (bestAvailableSource === 'recent_snapshot') {
      if (d === 'strong') return 'Active channel — using recent movement data';
      return 'Movement data recent — channel totals catching up';
    }
    if (d === 'strong') return 'Active channel — totals updating';
    if (d === 'average') return 'Posting regularly — awaiting totals refresh';
    // Stale + inactive = genuinely cold
    if (d === 'weak') return 'Inactive — totals and uploads both stalled';
  }

  // All strong
  if (r === 'strong' && c === 'strong' && d === 'strong') return 'Efficient channel, firing on all cylinders';
  if (r === 'strong' && c === 'strong') return 'Efficient channel, building momentum';
  if (r === 'strong' && d === 'strong' && c === 'weak') return 'High visibility, underutilised audience';
  if (r === 'strong' && d === 'strong') return 'Strong execution, growing reach';
  if (c === 'strong' && d === 'strong') return 'Efficient channel, consistent cadence';
  if (r === 'strong' && c === 'weak') return 'Strong reach, weak fan conversion';
  if (r === 'strong') return 'Growing reach, room to optimise';

  // Conversion-led
  if (c === 'strong' && r === 'weak') return 'Strong conversion, needs more reach';
  if (c === 'strong') return 'Efficient conversion, moderate activity';

  // Cadence-led
  if (d === 'strong' && r === 'weak' && c === 'weak') return 'Consistent posting, weak results';
  if (d === 'strong') return 'Active channel, building foundations';

  // Weak patterns
  if (r === 'weak' && c === 'weak' && d === 'weak') return 'Low activity, losing momentum';
  if (r === 'weak' && c === 'weak') return 'Underperforming, needs strategy reset';
  if (r === 'weak' && d === 'weak') return 'Inactive channel, declining reach';
  if (c === 'weak' && d === 'weak') return 'Weak execution across the board';
  if (c === 'weak') return 'Weak fan conversion';
  if (d === 'weak') return 'Inconsistent posting';
  if (r === 'weak') return 'Low momentum';

  return 'Average execution across pillars';
}

export function calculateChannelScore(
  input: ChannelScoreInput,
  pool: BenchmarkPool
): ChannelScore {
  const reach = scoreReach(input, pool);
  const conversion = scoreConversion(input, pool);
  const cadence = scoreCadence(input);

  const pillars = { reach, conversion, cadence };

  const reliablePillars = [reach, conversion, cadence].filter(
    (p) => p.status !== 'limited'
  ).length;

  const totalPoints =
    POINTS[reach.status] + POINTS[conversion.status] + POINTS[cadence.status];

  const grade = computeGrade(totalPoints, reliablePillars, pillars, input.movementConfidence, input.hasActiveCampaign, input.bestAvailableSource);

  const dataQuality: ChannelScore['dataQuality'] =
    reliablePillars >= 3 ? 'good' : reliablePillars >= 2 ? 'partial' : 'insufficient';

  return {
    grade,
    totalPoints,
    label: buildLabel(pillars, input.movementConfidence, input.hasActiveCampaign, input.bestAvailableSource),
    pillars,
    benchmarkLabel: 'vs tracked artists',
    dataQuality,
  };
}

// ── Grade styling helpers ─────────────────────────────────────────────────

export const GRADE_COLOR: Record<ChannelScore['grade'], string> = {
  A: '#1B8F5A',
  B: '#3B7DD8',
  C: '#D97706',
  D: '#DC2626',
  Limited: '#9CA3AF',
};

export const GRADE_BG: Record<ChannelScore['grade'], string> = {
  A: '#ECFDF5',
  B: '#EFF6FF',
  C: '#FFFBEB',
  D: '#FEF2F2',
  Limited: '#F9FAFB',
};
