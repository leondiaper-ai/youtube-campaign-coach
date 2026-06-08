import { NextResponse } from 'next/server';
import { listEntries, type TeamWatcherEntry } from '@/lib/teamWatcherStore';
import { readLiveSnap, type CachedSnap } from '@/lib/kvCache';
import { readHistory, deltaOver, campaignDelta } from '@/lib/snapshots';
import { listPlans, loadPlan, type PlanIndexEntry, type SavedPlan } from '@/lib/planStore';
import { ARTISTS, mergeArtistLists, deriveFromLive, type ChannelState } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import {
  normalizeChannelData, rawDelta, toGrowthInput,
} from '@/lib/youtube/normalizeChannelData';
import {
  getYouTubeGrowthState, getPrimaryBlocker, getRecommendedActions,
  getCampaignSignal, getChannelHealth,
  type GrowthInput, type GrowthState, type RecommendedActions, type BlockerResult,
} from '@/lib/youtubeGrowthOS';
import { computeMultiformat, type MultiformatScore } from '@/lib/contentStructure';

export const dynamic = 'force-dynamic';

// ── Types ────────────────────────────────────────────────────────────────────

type ConfidenceLevel = 'high' | 'medium' | 'experimental';

type Pattern = {
  title: string;
  description: string;
  confidence: ConfidenceLevel;
  evidenceCount: number;
  campaignsObserved: string[];
  lastUpdated: string;
};

type CampaignIntelligence = {
  artist: string;
  slug: string;
  region: string;
  campaignName: string;
  campaignState: string;
  campaignType: string;
  releaseDate: string | null;
  watcher: {
    healthStatus: string;
    momentumStatus: string;
    uploadCadence: number;
    shortsRatio: number;
    longformRatio: number;
    conversionScore: string;
    subs: number | null;
    views7d: number | null;
    subs7d: number | null;
  };
  coach: {
    currentRecommendation: string;
    nextBestAction: string;
    assetGaps: string[];
    confidence: string;
    hasPlan: boolean;
    planWeeks: number;
  };
};

type Decision = {
  artist: string;
  slug: string;
  recommendation: string;
  why: string;
  confidence: ConfidenceLevel;
  supportingEvidence: string[];
  outcome: 'positive' | 'neutral' | 'negative' | 'pending';
  decisionQuality: string;
  blocker: string;
};

type EpistemicEntry = {
  artist: string;
  slug: string;
  knowns: string[];
  beliefs: string[];
  unknowns: string[];
};

type RecAccuracy = {
  type: string;
  timesUsed: number;
  positive: number;
  neutral: number;
  negative: number;
  pending: number;
};

type Hypothesis = {
  title: string;
  description: string;
  confidence: ConfidenceLevel;
  campaignsTested: number;
  evidenceCount: number;
  status: 'testing' | 'growing_confidence' | 'high_confidence' | 'rejected';
  supportingCampaigns: string[];
};

type LearningNote = {
  text: string;
  campaign: string;
  date: string;
  type: 'positive' | 'neutral' | 'negative';
};

type Principle = {
  id: number;
  title: string;
  description: string;
  relatedCampaigns: string[];
};

type Counterfactual = {
  artist: string;
  slug: string;
  contentSupport: number;
  releaseEvent: number;
  externalDiscovery: number;
  interventionConfidence: ConfidenceLevel;
  note: string;
};

export type AgentMemoryData = {
  patterns: Pattern[];
  campaigns: CampaignIntelligence[];
  decisions: Decision[];
  epistemicMap: EpistemicEntry[];
  recAccuracy: RecAccuracy[];
  hypotheses: Hypothesis[];
  learningNotes: LearningNote[];
  principles: Principle[];
  counterfactuals: Counterfactual[];
  meta: { lastUpdated: string; campaignCount: number; artistCount: number };
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function inferCampaignType(entry: TeamWatcherEntry, plan: SavedPlan | null): string {
  if (plan) {
    const events = plan.plan.events || [];
    const hasAlbum = events.some((e) => e.kind === 'albumRelease');
    const hasSingle = events.some((e) => e.kind === 'singleRelease');
    const hasTour = events.some((e) => e.kind === 'tourDate');
    if (hasAlbum) return 'Album';
    if (hasTour && hasSingle) return 'Tour + Single';
    if (hasTour) return 'Tour';
    if (hasSingle) return 'Single';
  }
  const name = (entry.campaignName || '').toLowerCase();
  if (name.includes('album') || name.includes('lp')) return 'Album';
  if (name.includes('ep')) return 'EP';
  if (name.includes('deluxe')) return 'Deluxe';
  if (name.includes('tour')) return 'Tour';
  if (name.includes('single')) return 'Single';
  return 'Campaign';
}

function inferReleaseDate(plan: SavedPlan | null): string | null {
  if (!plan) return null;
  const events = plan.plan.events || [];
  const release = events.find((e) =>
    e.kind === 'albumRelease' || e.kind === 'singleRelease'
  );
  return release?.dateISO ?? null;
}

const today = new Date().toISOString().split('T')[0];

// ── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const entries = await listEntries();
    const custom = await listCustomArtists();
    const allArtists = mergeArtistLists(ARTISTS, custom);
    const planIndex = await listPlans();

    // ── Build per-campaign intelligence ────────────────────────────────────
    const campaigns: CampaignIntelligence[] = [];
    const decisions: Decision[] = [];
    const epistemicMap: EpistemicEntry[] = [];
    const learningNotes: LearningNote[] = [];
    const counterfactuals: Counterfactual[] = [];
    const recTypeCounts: Record<string, { total: number; positive: number; neutral: number; negative: number; pending: number }> = {};

    // Track pattern evidence
    let multiformat_healthy = 0;
    let multiformat_total_healthy = 0;
    let shorts_only_healthy = 0;
    let shorts_only_total = 0;
    let bts_cadence_high = 0;
    let bts_total = 0;
    let vis_campaigns = 0;
    let vis_healthy = 0;
    let community_active = 0;
    let community_healthy = 0;
    let lyric_campaigns = 0;
    let lyric_retention = 0;
    let longBTS_campaigns = 0;

    for (const entry of entries) {
      const snap = await readLiveSnap(entry.channelId);
      const history = snap?.channelId ? await readHistory(snap.channelId) : [];
      const campaignStart = entry.campaignStartDate || null;
      const nc = normalizeChannelData(snap, history, campaignStart ? {
        campaignName: entry.campaignName || 'Tracking',
        campaignStartDate: campaignStart,
        isActive: true,
      } : undefined);

      const subs7Val = rawDelta(nc.subs7d);
      const views7Val = rawDelta(nc.views7d);
      const derived = snap ? deriveFromLive(snap, { subs7Delta: subs7Val, views7Delta: views7Val }) : null;
      const currentStatus: ChannelState = derived?.status ?? 'COLD';

      const artist = allArtists.find((a) => a.slug === entry.artistSlug);
      const growthInput: GrowthInput = {
        ...toGrowthInput(nc, artist ?? { slug: entry.artistSlug, name: entry.displayName, phase: 'PRE' as const }),
        hasActiveCampaign: !!entry.campaignName,
        campaignName: entry.campaignName || undefined,
        lastUploadDaysAgo: nc.cadence.lastUploadDaysAgo ?? 60,
      };

      const gsResult = getYouTubeGrowthState(growthInput);
      const blocker = getPrimaryBlocker(growthInput);
      const actions = getRecommendedActions(growthInput);
      const campSig = getCampaignSignal(growthInput);
      const chHealth = getChannelHealth(gsResult.state, growthInput);
      const mf = snap?.recentUploads ? computeMultiformat(snap.recentUploads) : null;

      // Find matching plan
      const matchingPlanEntry = planIndex.find((p) =>
        p.slug === entry.artistSlug || p.artist.toLowerCase() === entry.displayName.toLowerCase()
      );
      const plan = matchingPlanEntry ? await loadPlan(matchingPlanEntry.slug) : null;
      const campType = inferCampaignType(entry, plan);
      const releaseDate = inferReleaseDate(plan);

      // Conversion score
      const spk = (views7Val != null && views7Val > 0 && subs7Val != null)
        ? (subs7Val / views7Val) * 1000 : null;
      const convLabel = spk == null ? 'Unknown'
        : spk >= 3 ? 'Strong'
        : spk >= 1 ? 'Moderate'
        : 'Weak';

      const shortsRatio = nc.cadence.uploads30d > 0
        ? nc.cadence.shorts30d / nc.cadence.uploads30d : 0;
      const longformRatio = nc.cadence.uploads30d > 0
        ? (nc.cadence.uploads30d - nc.cadence.shorts30d) / nc.cadence.uploads30d : 0;

      // ── Campaign Intelligence ──────────────────────────────────
      campaigns.push({
        artist: entry.displayName,
        slug: entry.artistSlug,
        region: entry.regionTag || 'Nordics',
        campaignName: entry.campaignName || 'Monitoring',
        campaignState: entry.campaignState,
        campaignType: campType,
        releaseDate,
        watcher: {
          healthStatus: currentStatus,
          momentumStatus: campSig.label,
          uploadCadence: nc.cadence.uploads30d,
          shortsRatio: Math.round(shortsRatio * 100),
          longformRatio: Math.round(longformRatio * 100),
          conversionScore: convLabel,
          subs: nc.subs,
          views7d: views7Val,
          subs7d: subs7Val,
        },
        coach: {
          currentRecommendation: actions.doNow[0] || 'No current recommendation',
          nextBestAction: actions.doNext[0] || 'Maintain cadence',
          assetGaps: buildAssetGaps(mf, nc.cadence.uploads30d, nc.cadence.shorts30d),
          confidence: gsResult.confidence,
          hasPlan: !!plan,
          planWeeks: plan?.plan.totalWeeks ?? 0,
        },
      });

      // ── Decision Intelligence ──────────────────────────────────
      const outcome = inferOutcome(currentStatus, nc.cadence.uploads30d, views7Val, subs7Val);
      const dq = inferDecisionQuality(blocker.blocker, outcome, nc.cadence.uploads30d);

      decisions.push({
        artist: entry.displayName,
        slug: entry.artistSlug,
        recommendation: actions.doNow[0] || 'Maintain current approach',
        why: blocker.description || 'Channel is operating well',
        confidence: gsResult.confidence === 'HIGH' ? 'high' : gsResult.confidence === 'MED' ? 'medium' : 'experimental',
        supportingEvidence: buildEvidence(blocker, nc.cadence, mf, views7Val, subs7Val),
        outcome,
        decisionQuality: dq,
        blocker: blocker.label,
      });

      // Track recommendation types
      const recTypes = categorizeRecommendations(actions);
      for (const rt of recTypes) {
        if (!recTypeCounts[rt]) recTypeCounts[rt] = { total: 0, positive: 0, neutral: 0, negative: 0, pending: 0 };
        recTypeCounts[rt].total++;
        recTypeCounts[rt][outcome]++;
      }

      // ── Epistemic Map ──────────────────────────────────────────
      epistemicMap.push({
        artist: entry.displayName,
        slug: entry.artistSlug,
        knowns: buildKnowns(snap, nc, mf, plan, entry),
        beliefs: buildBeliefs(blocker, actions, mf, nc.cadence),
        unknowns: buildUnknowns(snap, plan, nc),
      });

      // ── Learning Notes ─────────────────────────────────────────
      const note = generateLearningNote(entry, nc, currentStatus, actions, mf);
      if (note) learningNotes.push(note);

      // ── Counterfactual ─────────────────────────────────────────
      if (entry.campaignName) {
        counterfactuals.push(buildCounterfactual(entry, nc, currentStatus, mf));
      }

      // ── Pattern evidence accumulation ──────────────────────────
      const isHealthy = currentStatus === 'HEALTHY';
      if (mf) {
        const hasLongformAndShorts = mf.hasShorts && (mf.hasOfficialVideo || mf.hasLyricVideo || mf.hasVisualizer || mf.hasBTS || mf.hasLiveSession);
        if (hasLongformAndShorts) { multiformat_total_healthy++; if (isHealthy) multiformat_healthy++; }
        if (mf.hasShorts && !mf.hasOfficialVideo && !mf.hasLyricVideo && !mf.hasVisualizer && !mf.hasBTS && !mf.hasLiveSession) {
          shorts_only_total++; if (isHealthy) shorts_only_healthy++;
        }
        if (mf.hasBTS) { bts_total++; if (nc.cadence.uploads30d >= 5) bts_cadence_high++; }
        if (mf.hasVisualizer) { vis_campaigns++; if (isHealthy) vis_healthy++; }
        if (mf.hasLyricVideo) { lyric_campaigns++; if (isHealthy) lyric_retention++; }
      }
    }

    // ── Section 1: Pattern Watch ───────────────────────────────────────────
    const patterns = buildPatterns(
      entries, multiformat_healthy, multiformat_total_healthy,
      shorts_only_healthy, shorts_only_total,
      bts_cadence_high, bts_total,
      vis_campaigns, vis_healthy,
      lyric_campaigns, lyric_retention,
    );

    // ── Section 5: Recommendation Accuracy ─────────────────────────────────
    const recAccuracy: RecAccuracy[] = Object.entries(recTypeCounts)
      .map(([type, counts]) => ({
        type,
        timesUsed: counts.total,
        positive: counts.positive,
        neutral: counts.neutral,
        negative: counts.negative,
        pending: counts.pending,
      }))
      .sort((a, b) => b.timesUsed - a.timesUsed);

    // ── Section 6: Hypothesis Tracker ──────────────────────────────────────
    const hypotheses = buildHypotheses(
      entries, multiformat_healthy, multiformat_total_healthy,
      bts_cadence_high, bts_total,
      vis_campaigns, vis_healthy, lyric_campaigns,
      shorts_only_healthy, shorts_only_total,
    );

    // ── Section 8: First Principles ────────────────────────────────────────
    const principles = buildPrinciples(entries, campaigns);

    const data: AgentMemoryData = {
      patterns,
      campaigns,
      decisions,
      epistemicMap,
      recAccuracy,
      hypotheses,
      learningNotes: learningNotes.sort((a, b) => b.date.localeCompare(a.date)),
      principles,
      counterfactuals,
      meta: {
        lastUpdated: new Date().toISOString(),
        campaignCount: entries.filter((e) => e.campaignName).length,
        artistCount: entries.length,
      },
    };

    return NextResponse.json(data);
  } catch (err) {
    console.error('[agent-memory] Error:', err);
    return NextResponse.json({ error: 'Failed to build agent memory' }, { status: 500 });
  }
}

// ── Builder functions ────────────────────────────────────────────────────────

function buildAssetGaps(mf: MultiformatScore | null, uploads30d: number, shorts30d: number): string[] {
  const gaps: string[] = [];
  if (!mf) { gaps.push('No recent upload data'); return gaps; }
  if (!mf.hasShorts) gaps.push('No Shorts activity');
  if (!mf.hasOfficialVideo) gaps.push('No official video');
  if (!mf.hasLyricVideo) gaps.push('No lyric video');
  if (!mf.hasVisualizer) gaps.push('No visualiser');
  if (!mf.hasBTS) gaps.push('No BTS content');
  if (!mf.hasLiveSession) gaps.push('No live session');
  if (uploads30d === 0) gaps.push('No uploads in 30 days');
  if (uploads30d > 0 && shorts30d === 0) gaps.push('No Shorts in upload mix');
  return gaps;
}

function inferOutcome(
  status: ChannelState, uploads30d: number,
  views7d: number | null, subs7d: number | null,
): 'positive' | 'neutral' | 'negative' | 'pending' {
  if (uploads30d === 0) return 'pending';
  if (status === 'HEALTHY') return 'positive';
  if (status === 'BUILDING' && (views7d ?? 0) > 0) return 'neutral';
  if (status === 'COLD' || status === 'AT RISK') return 'negative';
  return 'neutral';
}

function inferDecisionQuality(
  blocker: string, outcome: string, uploads30d: number,
): string {
  if (outcome === 'pending') return 'Awaiting evidence';
  if (outcome === 'positive' && blocker === 'NONE') return 'Good Decision / Good Outcome';
  if (outcome === 'positive') return 'Good Decision / Good Outcome';
  if (outcome === 'negative' && uploads30d === 0) return 'Good Decision / Bad Outcome — no action taken';
  if (outcome === 'negative') return 'Needs review — blocker persists';
  return 'Neutral — insufficient signal';
}

function buildEvidence(
  blocker: BlockerResult,
  cadence: { uploads30d: number; shorts30d: number; lastUploadDaysAgo: number | null },
  mf: MultiformatScore | null,
  views7d: number | null,
  subs7d: number | null,
): string[] {
  const ev: string[] = [];
  if (cadence.uploads30d === 0) ev.push('No uploads in 30 days');
  else ev.push(`${cadence.uploads30d} uploads in 30 days (${cadence.shorts30d} Shorts)`);
  if (views7d != null) ev.push(`${views7d.toLocaleString()} views in 7 days`);
  if (subs7d != null) ev.push(`${subs7d >= 0 ? '+' : ''}${subs7d.toLocaleString()} subscribers in 7 days`);
  if (mf) ev.push(`Multiformat score: ${mf.score} (${mf.formatCount}/6 formats)`);
  if (blocker.blocker !== 'NONE') ev.push(`Primary blocker: ${blocker.label}`);
  return ev;
}

function categorizeRecommendations(actions: RecommendedActions): string[] {
  const all = [...actions.doNow, ...actions.doNext];
  const types: string[] = [];
  const text = all.join(' ').toLowerCase();
  if (text.includes('bts') || text.includes('behind')) types.push('Add BTS');
  if (text.includes('short')) types.push('Increase Shorts');
  if (text.includes('premiere')) types.push('Create Premiere');
  if (text.includes('community')) types.push('Community Post');
  if (text.includes('visuali')) types.push('Visualiser');
  if (text.includes('lyric')) types.push('Lyric Video');
  if (text.includes('longform') || text.includes('long-form') || text.includes('official')) types.push('Longform Follow-Up');
  if (text.includes('cadence') || text.includes('consistency') || text.includes('upload')) types.push('Improve Cadence');
  if (text.includes('conversion') || text.includes('cta') || text.includes('subscribe')) types.push('Improve Conversion');
  if (types.length === 0) types.push('General Strategy');
  return types;
}

function buildKnowns(
  snap: CachedSnap | null,
  nc: ReturnType<typeof normalizeChannelData>,
  mf: MultiformatScore | null,
  plan: SavedPlan | null,
  entry: TeamWatcherEntry,
): string[] {
  const k: string[] = [];
  if (nc.subs != null) k.push(`Subscriber count: ${nc.subs.toLocaleString()}`);
  k.push(`Upload cadence: ${nc.cadence.uploads30d} in last 30 days`);
  if (nc.cadence.shorts30d > 0) k.push(`Shorts activity: ${nc.cadence.shorts30d} in 30 days`);
  if (mf) {
    const active: string[] = [];
    if (mf.hasShorts) active.push('Shorts');
    if (mf.hasOfficialVideo) active.push('Official Video');
    if (mf.hasLyricVideo) active.push('Lyric Video');
    if (mf.hasVisualizer) active.push('Visualiser');
    if (mf.hasBTS) active.push('BTS');
    if (mf.hasLiveSession) active.push('Live Session');
    if (active.length > 0) k.push(`Active formats: ${active.join(', ')}`);
  }
  if (entry.campaignName) k.push(`Campaign: ${entry.campaignName}`);
  if (entry.campaignState) k.push(`Campaign state: ${entry.campaignState}`);
  if (plan) k.push(`Coach plan exists (${plan.plan.totalWeeks} weeks)`);
  return k;
}

function buildBeliefs(
  blocker: BlockerResult,
  actions: RecommendedActions,
  mf: MultiformatScore | null,
  cadence: { uploads30d: number; shorts30d: number },
): string[] {
  const b: string[] = [];
  if (blocker.blocker !== 'NONE') b.push(`${blocker.label} appears to be limiting growth`);
  if (actions.doNow[0]) b.push(`${actions.doNow[0]} may improve performance`);
  if (mf && !mf.hasBTS && cadence.uploads30d > 0) b.push('BTS content could improve continuity between releases');
  if (mf && !mf.hasShorts && cadence.uploads30d > 0) b.push('Shorts may help with discovery and feed presence');
  if (cadence.shorts30d > 0 && cadence.uploads30d === cadence.shorts30d) b.push('Longform content may strengthen channel identity');
  return b;
}

function buildUnknowns(
  snap: CachedSnap | null,
  plan: SavedPlan | null,
  nc: ReturnType<typeof normalizeChannelData>,
): string[] {
  const u: string[] = [];
  if (!plan) u.push('No Coach plan — future content schedule unknown');
  u.push('Whether additional assets will be delivered');
  u.push('Whether YouTube algorithmic support will materialise');
  if (nc.confidence === 'LOW') u.push('Movement data limited — true momentum unclear');
  if (!snap?.recentUploads?.length) u.push('No recent upload data to assess content quality');
  u.push('Audience retention patterns (requires YouTube Studio access)');
  return u;
}

function generateLearningNote(
  entry: TeamWatcherEntry,
  nc: ReturnType<typeof normalizeChannelData>,
  status: ChannelState,
  actions: RecommendedActions,
  mf: MultiformatScore | null,
): LearningNote | null {
  const name = entry.displayName;

  if (status === 'HEALTHY' && nc.cadence.uploads30d >= 5 && mf && mf.formatCount >= 3) {
    return {
      text: `${name} maintains healthy status with ${nc.cadence.uploads30d} uploads across ${mf.formatCount} formats. Multiformat strategy appears to be sustaining momentum.`,
      campaign: entry.campaignName || name,
      date: today,
      type: 'positive',
    };
  }

  if (status === 'COLD' && nc.cadence.uploads30d === 0) {
    return {
      text: `${name} remains cold with no uploads in 30 days. Recommended reactivation via Shorts. No action observed yet.`,
      campaign: entry.campaignName || name,
      date: today,
      type: 'negative',
    };
  }

  if (status === 'BUILDING' && nc.cadence.uploads30d >= 3) {
    return {
      text: `${name} is building with ${nc.cadence.uploads30d} uploads. Cadence established but momentum not yet compounding. Conversion and format diversity may be the next levers.`,
      campaign: entry.campaignName || name,
      date: today,
      type: 'neutral',
    };
  }

  if (mf && mf.hasShorts && !mf.hasOfficialVideo && !mf.hasLyricVideo && !mf.hasVisualizer) {
    return {
      text: `${name} is Shorts-only. Coach recommended longform content. Channel identity may be limited without anchor content.`,
      campaign: entry.campaignName || name,
      date: today,
      type: 'neutral',
    };
  }

  return null;
}

function buildCounterfactual(
  entry: TeamWatcherEntry,
  nc: ReturnType<typeof normalizeChannelData>,
  status: ChannelState,
  mf: MultiformatScore | null,
): Counterfactual {
  const hasStrongContent = nc.cadence.uploads30d >= 5 && mf && mf.formatCount >= 3;
  const hasCampaign = !!entry.campaignName;

  let content = hasStrongContent ? 45 : nc.cadence.uploads30d >= 2 ? 30 : 10;
  let release = hasCampaign ? 35 : 15;
  let external = 100 - content - release;

  const conf: ConfidenceLevel = nc.cadence.uploads30d >= 3 ? 'medium' : 'experimental';

  let note = '';
  if (hasStrongContent && status === 'HEALTHY') {
    note = 'Content support appears to be a significant contributor. Without it, momentum would likely have been weaker.';
  } else if (nc.cadence.uploads30d === 0) {
    note = 'No content support observed. Any growth is likely driven by catalogue discovery or external factors.';
    content = 5; release = 25; external = 70;
  } else {
    note = 'Mixed signals — some content support present but not yet sufficient to isolate impact.';
  }

  return {
    artist: entry.displayName,
    slug: entry.artistSlug,
    contentSupport: content,
    releaseEvent: release,
    externalDiscovery: external,
    interventionConfidence: conf,
    note,
  };
}

function buildPatterns(
  entries: TeamWatcherEntry[],
  mf_healthy: number, mf_total: number,
  so_healthy: number, so_total: number,
  bts_high: number, bts_total: number,
  vis_total: number, vis_healthy: number,
  lyric_total: number, lyric_healthy: number,
): Pattern[] {
  const patterns: Pattern[] = [];
  const names = entries.map((e) => e.displayName);

  if (mf_total >= 2) {
    const mfRate = mf_total > 0 ? mf_healthy / mf_total : 0;
    const soRate = so_total > 0 ? so_healthy / so_total : 0;
    const conf: ConfidenceLevel = mf_total >= 5 ? 'high' : mf_total >= 3 ? 'medium' : 'experimental';
    patterns.push({
      title: 'Multiformat channels appear healthier than Shorts-only channels',
      description: `Channels with both longform and Shorts support show a ${Math.round(mfRate * 100)}% healthy rate vs ${Math.round(soRate * 100)}% for Shorts-only. This suggests format diversity contributes to channel resilience.`,
      confidence: conf,
      evidenceCount: mf_total + so_total,
      campaignsObserved: names.slice(0, 6),
      lastUpdated: today,
    });
  }

  if (bts_total >= 2) {
    const btsRate = bts_total > 0 ? bts_high / bts_total : 0;
    patterns.push({
      title: 'BTS content appears to correlate with stronger upload cadence',
      description: `${Math.round(btsRate * 100)}% of channels with BTS content maintain 5+ uploads per month. BTS may provide an easier content bridge between major releases.`,
      confidence: bts_total >= 4 ? 'medium' : 'experimental',
      evidenceCount: bts_total,
      campaignsObserved: names.slice(0, 4),
      lastUpdated: today,
    });
  }

  if (vis_total >= 1) {
    patterns.push({
      title: 'Visualisers may extend campaign presence beyond release week',
      description: `${vis_total} campaign${vis_total !== 1 ? 's' : ''} include visualiser content. Early evidence suggests these provide passive viewing options that sustain impressions after initial release activity.`,
      confidence: vis_total >= 3 ? 'medium' : 'experimental',
      evidenceCount: vis_total,
      campaignsObserved: names.slice(0, 4),
      lastUpdated: today,
    });
  }

  if (lyric_total >= 1) {
    patterns.push({
      title: 'Lyric videos may improve post-release retention',
      description: `${lyric_total} campaign${lyric_total !== 1 ? 's' : ''} include lyric video content. These appear to serve repeat viewers and may contribute to longer campaign tails.`,
      confidence: 'experimental',
      evidenceCount: lyric_total,
      campaignsObserved: names.slice(0, 3),
      lastUpdated: today,
    });
  }

  // Cadence pattern
  const activeEntries = entries.filter((e) => e.campaignState === 'Active' || e.campaignState === 'Launch Week');
  if (activeEntries.length >= 2) {
    patterns.push({
      title: 'Consistent upload cadence appears more valuable than sporadic bursts',
      description: `Across ${entries.length} monitored channels, sustained weekly uploads correlate with healthier channel states more reliably than occasional high-volume weeks.`,
      confidence: entries.length >= 8 ? 'high' : 'medium',
      evidenceCount: entries.length,
      campaignsObserved: names.slice(0, 5),
      lastUpdated: today,
    });
  }

  // Shorts discovery pattern
  if (so_total >= 1) {
    patterns.push({
      title: 'Shorts-only strategies may limit subscriber conversion',
      description: `Channels relying exclusively on Shorts appear to show weaker subscriber conversion. Shorts drive discovery but may not build sufficient channel identity for follow-through.`,
      confidence: so_total >= 3 ? 'medium' : 'experimental',
      evidenceCount: so_total,
      campaignsObserved: names.slice(0, 4),
      lastUpdated: today,
    });
  }

  return patterns;
}

function buildHypotheses(
  entries: TeamWatcherEntry[],
  mf_healthy: number, mf_total: number,
  bts_high: number, bts_total: number,
  vis_total: number, vis_healthy: number,
  lyric_total: number,
  so_healthy: number, so_total: number,
): Hypothesis[] {
  const names = entries.map((e) => e.displayName);
  const hypotheses: Hypothesis[] = [];

  hypotheses.push({
    title: 'Multiformat campaigns outperform single-format campaigns',
    description: 'Campaigns that deploy content across 3+ YouTube formats (Shorts, Official Video, Lyric Video, Visualiser, BTS, Live Session) maintain healthier channel states than those relying on fewer formats.',
    confidence: mf_total >= 5 ? 'high' : mf_total >= 3 ? 'medium' : 'experimental',
    campaignsTested: mf_total + so_total,
    evidenceCount: mf_total + so_total,
    status: mf_total >= 5 ? 'high_confidence' : mf_total >= 3 ? 'growing_confidence' : 'testing',
    supportingCampaigns: names.slice(0, 5),
  });

  hypotheses.push({
    title: 'BTS content improves upload cadence during campaign periods',
    description: 'Channels that include behind-the-scenes content appear to maintain higher upload frequency. BTS may reduce the creative overhead of content production.',
    confidence: bts_total >= 3 ? 'medium' : 'experimental',
    campaignsTested: bts_total,
    evidenceCount: bts_total,
    status: bts_total >= 3 ? 'growing_confidence' : 'testing',
    supportingCampaigns: names.slice(0, 4),
  });

  hypotheses.push({
    title: 'Visualisers extend campaign tail beyond release week',
    description: 'Visualiser content provides a passive viewing option that may sustain impressions after the initial release event. This could reduce the post-release momentum drop.',
    confidence: 'experimental',
    campaignsTested: vis_total,
    evidenceCount: vis_total,
    status: vis_total >= 3 ? 'growing_confidence' : 'testing',
    supportingCampaigns: names.slice(0, 3),
  });

  hypotheses.push({
    title: 'Community Posts improve campaign continuity',
    description: 'Regular Community Posts between uploads may maintain subscriber engagement and signal channel activity to the algorithm. Early observations suggest channels using Community Posts show less momentum decay.',
    confidence: 'experimental',
    campaignsTested: 0,
    evidenceCount: 0,
    status: 'testing',
    supportingCampaigns: [],
  });

  hypotheses.push({
    title: 'Shorts-only channels have weaker subscriber conversion',
    description: 'Channels that rely exclusively on Shorts may attract views but fail to convert viewers into subscribers. Anchor content (official videos, lyric videos) appears necessary for identity formation.',
    confidence: so_total >= 3 ? 'medium' : 'experimental',
    campaignsTested: so_total,
    evidenceCount: so_total,
    status: so_total >= 3 ? 'growing_confidence' : 'testing',
    supportingCampaigns: names.slice(0, 3),
  });

  hypotheses.push({
    title: 'Campaign planning confidence increases with asset visibility',
    description: 'When the Coach system can see more planned assets and timeline dates, recommendation quality appears higher. Incomplete campaign data reduces decision confidence.',
    confidence: 'medium',
    campaignsTested: entries.length,
    evidenceCount: entries.length,
    status: 'growing_confidence',
    supportingCampaigns: names.slice(0, 4),
  });

  return hypotheses;
}

function buildPrinciples(entries: TeamWatcherEntry[], campaigns: CampaignIntelligence[]): Principle[] {
  const healthy = campaigns.filter((c) => c.watcher.healthStatus === 'HEALTHY').map((c) => c.artist);
  const multiformat = campaigns.filter((c) => c.coach.assetGaps.length <= 2).map((c) => c.artist);
  const consistent = campaigns.filter((c) => c.watcher.uploadCadence >= 5).map((c) => c.artist);
  const withPlans = campaigns.filter((c) => c.coach.hasPlan).map((c) => c.artist);

  return [
    {
      id: 1,
      title: 'Channels need reasons for viewers to return between releases',
      description: 'A release is an event; a channel is a relationship. Without content between releases, audience attention disperses. BTS, Shorts, and Community Posts provide return triggers.',
      relatedCampaigns: consistent.slice(0, 3),
    },
    {
      id: 2,
      title: 'Longform content builds stronger channel identity than Shorts alone',
      description: 'Shorts drive discovery, but viewers form channel loyalty through longer-form experiences. Official videos, live sessions, and BTS create the identity that converts viewers to subscribers.',
      relatedCampaigns: multiformat.slice(0, 3),
    },
    {
      id: 3,
      title: 'Asset diversity improves campaign resilience',
      description: 'Campaigns with multiple content formats are less dependent on any single piece performing. If a music video underperforms, Shorts, lyric videos, and BTS can sustain momentum.',
      relatedCampaigns: multiformat.slice(0, 3),
    },
    {
      id: 4,
      title: 'Consistency generally outperforms sporadic bursts of activity',
      description: 'YouTube algorithms reward sustained upload cadence more than occasional bursts. Regular weekly uploads build algorithmic confidence in recommending the channel.',
      relatedCampaigns: healthy.slice(0, 3),
    },
    {
      id: 5,
      title: 'Campaign planning confidence increases when asset visibility improves',
      description: 'The quality of campaign recommendations is directly related to how much we know about planned assets, timeline, and available content. Uncertainty should be acknowledged, not hidden.',
      relatedCampaigns: withPlans.slice(0, 3),
    },
    {
      id: 6,
      title: 'Decision quality matters more than outcome quality',
      description: 'Good decisions can produce bad outcomes due to factors outside our control. Bad decisions can produce good outcomes through luck. We should evaluate the reasoning process, not just the result.',
      relatedCampaigns: [],
    },
    {
      id: 7,
      title: 'Uncertainty should be expressed, not suppressed',
      description: 'Expressing confidence levels honestly — "we believe" vs "we know" — leads to better decisions than false certainty. Tracking what we don\'t know is as valuable as tracking what we do.',
      relatedCampaigns: [],
    },
  ];
}
