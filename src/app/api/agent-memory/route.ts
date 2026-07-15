import { NextResponse } from 'next/server';
import { readAllLiveSnaps, type CachedSnap } from '@/lib/kvCache';
import { readHistory } from '@/lib/snapshots';
import { listPlans, loadPlan, type SavedPlan } from '@/lib/planStore';
import { ARTISTS, mergeArtistLists, deriveFromLive, type Artist, type ChannelState } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import {
  normalizeChannelData, rawDelta, toGrowthInput,
} from '@/lib/youtube/normalizeChannelData';
import {
  getYouTubeGrowthState, getPrimaryBlocker, getRecommendedActions,
  getCampaignSignal, getChannelHealth,
  type GrowthInput,
} from '@/lib/youtubeGrowthOS';
import { computeMultiformat, type MultiformatScore } from '@/lib/contentStructure';

export const dynamic = 'force-dynamic';

// ── Types ────────────────────────────────────────────────────────────────────

type EmergingWinner = {
  artist: string;
  slug: string;
  subs: number | null;
  whyInteresting: string[];
  potentialSuccessFactors: string[];
  questions: string[];
  score: number;
  healthStatus: string;
  uploadCadence: number;
  formatCount: number;
  conversionLabel: string;
  campaign: string;
};

type EcosystemEntry = {
  artist: string;
  slug: string;
  score: number;
  uploads30d: number;
  shorts30d: number;
  longform30d: number;
  formatCount: number;
  formats: string[];
  healthStatus: string;
  conversionLabel: string;
  standoutReasons: string[];
  campaign: string;
};

type PlaybookEntry = {
  artist: string;
  slug: string;
  campaign: string;
  whatHappened: { totalUploads: number; shorts: number; longform: number; formats: string[] };
  whatWorked: string[];
  wouldReuse: boolean;
  tags: string[];
  healthStatus: string;
  planWeeks: number;
  strategy: string | null;
  timeline: { date: string; title: string; kind: string }[];
  completionRate: number;
};

type OutlierEntry = {
  artist: string;
  slug: string;
  observation: string;
  details: string[];
  category: 'overperformer' | 'underperformer' | 'unexpected_pattern' | 'dormant_interest';
  campaign: string;
  healthStatus: string;
  subs: number | null;
};

type AssetType = 'Official Video' | 'Visualiser' | 'Lyric Video' | 'BTS' | 'Live Session' | 'Shorts' | 'Community' | 'Premiere';

type AssetIntel = {
  assetType: AssetType;
  available: number;
  missing: number;
  total: number;
  percentage: number;
  campaigns: string[];
};

type AssetPattern = {
  assetType: string;
  withAsset: { count: number; avgCadence: number; avgFormatCount: number; healthyPct: number };
  withoutAsset: { count: number; avgCadence: number; avgFormatCount: number; healthyPct: number };
};

type OpenQuestion = {
  question: string;
  status: 'gathering_evidence' | 'early_signal' | 'needs_investigation';
  evidenceCount: number;
  relatedCampaigns: string[];
};

type WeeklyLearning = {
  text: string;
  campaign: string;
  category: 'confirmed' | 'challenged' | 'unknown';
};

export type AgentMemoryData = {
  emergingWinners: EmergingWinner[];
  ecosystems: EcosystemEntry[];
  playbooks: PlaybookEntry[];
  outliers: OutlierEntry[];
  assetIntel: AssetIntel[];
  assetPatterns: AssetPattern[];
  openQuestions: OpenQuestion[];
  weeklyLearnings: WeeklyLearning[];
  meta: { lastUpdated: string; channelCount: number; campaignCount: number };
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const today = new Date().toISOString().split('T')[0];

/** Per-channel working data accumulated in the main loop. */
type ChannelProfile = {
  artist: Artist;
  snap: CachedSnap | null;
  subs: number | null;
  views7d: number | null;
  subs7d: number | null;
  uploads30d: number;
  shorts30d: number;
  longform30d: number;
  status: ChannelState;
  mf: MultiformatScore | null;
  convLabel: string;
  blocker: string;
  blockerLabel: string;
  plan: SavedPlan | null;
  formatCount: number;
  formats: string[];
  campaignSignal: string;
  gsConfidence: string;
  doNow: string[];
  doNext: string[];
};

// ── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const custom = await listCustomArtists();
    const allArtists = mergeArtistLists(ARTISTS, custom);
    const planIndex = await listPlans();

    const handles = allArtists
      .map((a) => a.channelHandle)
      .filter(Boolean) as string[];
    const snapMap = await readAllLiveSnaps(handles);

    // ── Build per-channel profiles ──────────────────────────────────────
    const profiles: ChannelProfile[] = [];

    for (const artist of allArtists) {
      const snap = artist.channelHandle ? (snapMap.get(artist.channelHandle) ?? null) : null;
      const history = snap?.channelId && !snap.error ? await readHistory(snap.channelId) : [];
      const campaignStart = artist.campaignStartDate || null;
      const nc = normalizeChannelData(snap, history, campaignStart ? {
        campaignName: artist.campaign || 'Tracking',
        campaignStartDate: campaignStart,
        isActive: true,
      } : undefined);

      const subs7Val = rawDelta(nc.subs7d);
      const views7Val = rawDelta(nc.views7d);
      const derived = snap ? deriveFromLive(snap, { subs7Delta: subs7Val, views7Delta: views7Val }) : null;
      const currentStatus: ChannelState = derived?.status ?? 'COLD';

      const growthInput: GrowthInput = {
        ...toGrowthInput(nc, artist),
        hasActiveCampaign: !!artist.campaign,
        campaignName: artist.campaign || undefined,
        lastUploadDaysAgo: nc.cadence.lastUploadDaysAgo ?? 60,
      };

      const gsResult = getYouTubeGrowthState(growthInput);
      const blocker = getPrimaryBlocker(growthInput);
      const actions = getRecommendedActions(growthInput);
      const campSig = getCampaignSignal(growthInput);
      const mf = snap?.recentUploads ? computeMultiformat(snap.recentUploads) : null;

      // Find matching plan
      const matchingPlanEntry = planIndex.find((p) =>
        p.slug === artist.slug || p.artist.toLowerCase() === artist.name.toLowerCase()
      );
      const plan = matchingPlanEntry ? await loadPlan(matchingPlanEntry.slug) : null;

      // Conversion score
      const spk = (views7Val != null && views7Val > 0 && subs7Val != null)
        ? (subs7Val / views7Val) * 1000 : null;
      const convLabel = spk == null ? 'Unknown'
        : spk >= 3 ? 'Strong'
        : spk >= 1 ? 'Moderate'
        : 'Weak';

      const shorts30d = nc.cadence.shorts30d;
      const longform30d = nc.cadence.uploads30d - shorts30d;
      const formatCount = mf?.formatCount ?? 0;
      const formats = buildFormatList(mf);

      profiles.push({
        artist,
        snap,
        subs: nc.subs,
        views7d: views7Val,
        subs7d: subs7Val,
        uploads30d: nc.cadence.uploads30d,
        shorts30d,
        longform30d,
        status: currentStatus,
        mf,
        convLabel,
        blocker: blocker.blocker,
        blockerLabel: blocker.label,
        plan,
        formatCount,
        formats,
        campaignSignal: campSig.label,
        gsConfidence: gsResult.confidence,
        doNow: actions.doNow,
        doNext: actions.doNext,
      });
    }

    // ── Section 1: Emerging Winners ────────────────────────────────────
    const emergingWinners = buildEmergingWinners(profiles);

    // ── Section 2: Best Ecosystems ─────────────────────────────────────
    const ecosystems = buildEcosystems(profiles);

    // ── Section 3: Playbooks Worth Banking ─────────────────────────────
    const playbooks = buildPlaybooks(profiles);

    // ── Section 4: Interesting Outliers ─────────────────────────────────
    const outliers = buildOutliers(profiles);

    // ── Section 5: Asset Intelligence ──────────────────────────────────
    const assetIntel = buildAssetIntel(profiles);

    // ── Section 6: Asset Success Patterns ──────────────────────────────
    const assetPatterns = buildAssetPatterns(profiles);

    // ── Section 7: Open Questions ──────────────────────────────────────
    const openQuestions = buildOpenQuestions(profiles);

    // ── Section 8: Weekly Learnings ────────────────────────────────────
    const weeklyLearnings = buildWeeklyLearnings(profiles);

    const data: AgentMemoryData = {
      emergingWinners,
      ecosystems,
      playbooks,
      outliers,
      assetIntel,
      assetPatterns,
      openQuestions,
      weeklyLearnings,
      meta: {
        lastUpdated: new Date().toISOString(),
        channelCount: allArtists.length,
        campaignCount: allArtists.filter((a) => a.campaign).length,
      },
    };

    return NextResponse.json(data);
  } catch (err) {
    console.error('[intelligence-lab] Error:', err);
    return NextResponse.json({ error: 'Failed to build intelligence lab' }, { status: 500 });
  }
}

// ── Builder helpers ─────────────────────────────────────────────────────────

function buildFormatList(mf: MultiformatScore | null): string[] {
  if (!mf) return [];
  const f: string[] = [];
  if (mf.hasShorts) f.push('Shorts');
  if (mf.hasOfficialVideo) f.push('Official Video');
  if (mf.hasLyricVideo) f.push('Lyric Video');
  if (mf.hasVisualizer) f.push('Visualiser');
  if (mf.hasBTS) f.push('BTS');
  if (mf.hasLiveSession) f.push('Live Session');
  return f;
}

// ── Section 1: Emerging Winners ─────────────────────────────────────────────

function buildEmergingWinners(profiles: ChannelProfile[]): EmergingWinner[] {
  // Score channels on "interesting-ness" — not size
  const scored = profiles.map((p) => {
    let score = 0;
    const why: string[] = [];
    const factors: string[] = [];
    const questions: string[] = [];

    // Strong conversion is interesting
    if (p.convLabel === 'Strong') { score += 25; why.push('Strong subscriber conversion'); }
    else if (p.convLabel === 'Moderate') { score += 10; }

    // Consistent cadence is interesting
    if (p.uploads30d >= 8) { score += 20; why.push(`High cadence: ${p.uploads30d} uploads in 30 days`); factors.push('Consistent upload rhythm'); }
    else if (p.uploads30d >= 4) { score += 12; why.push(`Consistent cadence: ${p.uploads30d} uploads in 30 days`); factors.push('Regular upload schedule'); }

    // Multiformat is interesting
    if (p.formatCount >= 4) { score += 25; why.push(`${p.formatCount} active formats`); factors.push('Multi-format rollout'); }
    else if (p.formatCount >= 3) { score += 15; why.push(`${p.formatCount} formats active`); factors.push('Format diversity'); }

    // Healthy despite small scale is interesting
    if (p.status === 'HEALTHY' && p.subs != null && p.subs < 100000) {
      score += 20; why.push('Healthy status despite smaller scale');
    }
    if (p.status === 'HEALTHY') { score += 15; }
    else if (p.status === 'BUILDING' && p.uploads30d >= 3) { score += 10; why.push('Building momentum with active upload schedule'); }

    // Shorts + Longform balance is interesting
    if (p.shorts30d > 0 && p.longform30d > 0) { score += 10; factors.push('Shorts + Longform balance'); }

    // BTS support is interesting
    if (p.mf?.hasBTS) { score += 8; factors.push('BTS content support'); }
    if (p.mf?.hasLiveSession) { score += 5; factors.push('Live session content'); }

    // Growing subs is interesting
    if (p.subs7d != null && p.subs7d > 0) { score += 10; why.push(`+${p.subs7d.toLocaleString()} subscribers in 7 days`); }

    // Questions
    if (p.status === 'HEALTHY' && p.formatCount >= 3) questions.push('Is this multiformat approach repeatable for similar campaigns?');
    if (p.convLabel === 'Strong') questions.push('What is driving the strong conversion?');
    if (p.uploads30d >= 8) questions.push('How is this cadence sustained? Internal team or external support?');
    if (p.subs != null && p.subs < 50000 && p.status === 'HEALTHY') questions.push('Can this pattern scale to larger channels?');
    if (questions.length === 0) questions.push('What can we learn from this channel?');

    return {
      artist: p.artist.name,
      slug: p.artist.slug,
      subs: p.subs,
      whyInteresting: why,
      potentialSuccessFactors: factors,
      questions,
      score,
      healthStatus: p.status,
      uploadCadence: p.uploads30d,
      formatCount: p.formatCount,
      conversionLabel: p.convLabel,
      campaign: p.artist.campaign || 'Monitoring',
    };
  });

  return scored
    .filter((s) => s.score >= 30) // Must be actually interesting
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

// ── Section 2: Best Ecosystems ──────────────────────────────────────────────

function buildEcosystems(profiles: ChannelProfile[]): EcosystemEntry[] {
  const scored = profiles.map((p) => {
    let score = 0;
    const reasons: string[] = [];

    // Upload consistency (weight: 25)
    if (p.uploads30d >= 8) { score += 25; reasons.push(`Strong cadence: ${p.uploads30d} uploads/month`); }
    else if (p.uploads30d >= 5) { score += 18; reasons.push(`Good cadence: ${p.uploads30d} uploads/month`); }
    else if (p.uploads30d >= 3) { score += 10; }

    // Format diversity (weight: 25)
    score += Math.min(p.formatCount * 5, 25);
    if (p.formatCount >= 4) reasons.push(`${p.formatCount} content formats active`);

    // Shorts + Longform balance (weight: 15)
    if (p.shorts30d > 0 && p.longform30d > 0) {
      const ratio = Math.min(p.shorts30d, p.longform30d) / Math.max(p.shorts30d, p.longform30d);
      score += Math.round(ratio * 15);
      if (ratio >= 0.3) reasons.push('Balanced Shorts + Longform mix');
    }

    // Health status (weight: 20)
    if (p.status === 'HEALTHY') { score += 20; reasons.push('Healthy channel state'); }
    else if (p.status === 'BUILDING') { score += 12; }

    // Campaign support (weight: 10)
    if (p.artist.campaign && p.uploads30d >= 3) { score += 10; reasons.push('Active campaign with content support'); }

    // Conversion (weight: 5)
    if (p.convLabel === 'Strong') { score += 5; reasons.push('Strong subscriber conversion'); }

    return {
      artist: p.artist.name,
      slug: p.artist.slug,
      score,
      uploads30d: p.uploads30d,
      shorts30d: p.shorts30d,
      longform30d: p.longform30d,
      formatCount: p.formatCount,
      formats: p.formats,
      healthStatus: p.status,
      conversionLabel: p.convLabel,
      standoutReasons: reasons,
      campaign: p.artist.campaign || 'Monitoring',
    };
  });

  return scored
    .filter((s) => s.uploads30d > 0) // Must have some activity
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);
}

// ── Section 3: Playbooks Worth Banking ──────────────────────────────────────

function buildPlaybooks(profiles: ChannelProfile[]): PlaybookEntry[] {
  // Any channel with enough activity to learn from — not just formal campaigns
  const candidates = profiles.filter((p) => p.uploads30d >= 3);

  const entries = candidates.map((p) => {
    const whatWorked: string[] = [];
    const tags: string[] = [];

    // What worked?
    if (p.status === 'HEALTHY') whatWorked.push('Achieved healthy channel state');
    if (p.uploads30d >= 8) whatWorked.push(`Strong upload cadence (${p.uploads30d} in 30 days)`);
    if (p.convLabel === 'Strong') whatWorked.push('Strong subscriber conversion');
    if (p.formatCount >= 3) whatWorked.push(`Format diversity (${p.formatCount} types active)`);
    if (p.shorts30d > 0 && p.longform30d > 0) whatWorked.push('Shorts + Longform follow-through');
    if (p.mf?.hasBTS) whatWorked.push('BTS content support');
    if (p.mf?.hasLiveSession) whatWorked.push('Live session content');
    if (p.subs7d != null && p.subs7d > 0) whatWorked.push(`Subscriber growth (+${p.subs7d.toLocaleString()} in 7d)`);
    if (p.campaignSignal === 'Momentum' || p.campaignSignal === 'Strong Signal') whatWorked.push('Release momentum maintained');

    if (whatWorked.length === 0) whatWorked.push('Active with regular content');

    // Tags
    if (p.artist.campaign) {
      const name = p.artist.campaign.toLowerCase();
      if (name.includes('album') || name.includes('lp')) tags.push('Album');
      else if (name.includes('ep')) tags.push('EP');
      else if (name.includes('single')) tags.push('Single');
      else if (name.includes('deluxe')) tags.push('Deluxe');
      else if (name.includes('tour')) tags.push('Tour');
      else tags.push('Campaign');
    } else {
      tags.push('Active Channel');
    }
    if (p.shorts30d >= 10) tags.push('Heavy Shorts');
    else if (p.shorts30d > 0) tags.push('Shorts Active');
    if (p.longform30d >= 3) tags.push('Longform Support');
    if (p.uploads30d >= 8) tags.push('High Support');
    else if (p.uploads30d >= 4) tags.push('Moderate Support');
    if (p.mf?.hasBTS) tags.push('BTS');
    if (p.mf?.hasLiveSession) tags.push('Live');

    // Would we reuse?
    const wouldReuse = p.status === 'HEALTHY' || (p.status === 'BUILDING' && p.uploads30d >= 5 && p.formatCount >= 2);

    // Plan data
    const timeline: { date: string; title: string; kind: string }[] = [];
    let planWeeks = 0;
    let strategy: string | null = null;
    let completionRate = 0;

    if (p.plan) {
      planWeeks = p.plan.plan.totalWeeks;
      if (p.plan.plan.strategy) strategy = p.plan.plan.strategy.priority;
      for (const evt of p.plan.plan.events || []) {
        timeline.push({ date: evt.dateISO, title: evt.title, kind: evt.kind });
      }
      const totalActs = (p.plan.plan.weeks || []).reduce((s, w) => s + (w.actions?.length || 0), 0);
      const completedActs = (p.plan.plan.weeks || []).reduce((s, w) =>
        s + (w.actions || []).filter((a) => a.completed).length, 0);
      completionRate = totalActs > 0 ? Math.round((completedActs / totalActs) * 100) : 0;
    }

    return {
      artist: p.artist.name,
      slug: p.artist.slug,
      campaign: p.artist.campaign || 'Active Channel',
      whatHappened: {
        totalUploads: p.uploads30d,
        shorts: p.shorts30d,
        longform: p.longform30d,
        formats: p.formats,
      },
      whatWorked,
      wouldReuse,
      tags,
      healthStatus: p.status,
      planWeeks,
      strategy,
      timeline,
      completionRate,
    };
  }).sort((a, b) => {
    // Reusable first, then by upload count
    if (a.wouldReuse !== b.wouldReuse) return a.wouldReuse ? -1 : 1;
    return b.whatHappened.totalUploads - a.whatHappened.totalUploads;
  });

  return entries.slice(0, 20); // Top 20 case studies
}

// ── Section 4: Interesting Outliers ─────────────────────────────────────────

function buildOutliers(profiles: ChannelProfile[]): OutlierEntry[] {
  // Collect outliers by category, then take the most interesting from each
  const byCategory: Record<string, (OutlierEntry & { interestScore: number })[]> = {
    overperformer: [],
    underperformer: [],
    unexpected_pattern: [],
    dormant_interest: [],
  };

  for (const p of profiles) {
    // Large channel, very low activity — rank by subscriber count (most wasted potential first)
    if (p.subs != null && p.subs >= 100000 && p.uploads30d <= 1) {
      byCategory.underperformer.push({
        artist: p.artist.name,
        slug: p.artist.slug,
        observation: 'Large channel with minimal activity',
        details: [
          `${p.subs.toLocaleString()} subscribers`,
          `${p.uploads30d} uploads in 30 days`,
          'Significant audience but limited content investment',
        ],
        category: 'underperformer',
        campaign: p.artist.campaign || 'Monitoring',
        healthStatus: p.status,
        subs: p.subs,
        interestScore: p.subs,
      });
      continue;
    }

    // Small channel, performing well
    if (p.subs != null && p.subs < 30000 && p.status === 'HEALTHY' && p.uploads30d >= 3) {
      byCategory.overperformer.push({
        artist: p.artist.name,
        slug: p.artist.slug,
        observation: 'Small channel punching above its weight',
        details: [
          `Only ${p.subs.toLocaleString()} subscribers`,
          `${p.uploads30d} uploads in 30 days`,
          `Healthy status with ${p.formatCount} formats`,
        ],
        category: 'overperformer',
        campaign: p.artist.campaign || 'Monitoring',
        healthStatus: p.status,
        subs: p.subs,
        interestScore: p.uploads30d * p.formatCount,
      });
      continue;
    }

    // High cadence but unhealthy — effort not translating
    if (p.uploads30d >= 8 && (p.status === 'COLD' || p.status === 'AT RISK')) {
      byCategory.unexpected_pattern.push({
        artist: p.artist.name,
        slug: p.artist.slug,
        observation: 'High activity but no momentum',
        details: [
          `${p.uploads30d} uploads in 30 days`,
          `Status: ${p.status}`,
          'Content volume is not translating to growth',
        ],
        category: 'unexpected_pattern',
        campaign: p.artist.campaign || 'Monitoring',
        healthStatus: p.status,
        subs: p.subs,
        interestScore: p.uploads30d,
      });
      continue;
    }

    // Healthy with zero or minimal uploads — catalogue strength?
    if (p.status === 'HEALTHY' && p.uploads30d <= 1 && p.views7d != null && p.views7d > 10000) {
      byCategory.dormant_interest.push({
        artist: p.artist.name,
        slug: p.artist.slug,
        observation: 'Healthy despite minimal uploads — possible catalogue strength',
        details: [
          `${p.uploads30d} uploads in 30 days`,
          `${p.views7d?.toLocaleString()} views in 7 days`,
          'Growth driven by existing content rather than new uploads',
        ],
        category: 'dormant_interest',
        campaign: p.artist.campaign || 'Monitoring',
        healthStatus: p.status,
        subs: p.subs,
        interestScore: p.views7d,
      });
      continue;
    }

    // Shorts-only but doing well
    if (p.shorts30d >= 5 && p.longform30d === 0 && p.status === 'HEALTHY') {
      byCategory.unexpected_pattern.push({
        artist: p.artist.name,
        slug: p.artist.slug,
        observation: 'Shorts-only but maintaining healthy status',
        details: [
          `${p.shorts30d} Shorts, 0 Longform`,
          'Challenges the multiformat hypothesis',
        ],
        category: 'unexpected_pattern',
        campaign: p.artist.campaign || 'Monitoring',
        healthStatus: p.status,
        subs: p.subs,
        interestScore: p.shorts30d * 10,
      });
      continue;
    }

    // Very high interest despite limited output
    if (p.views7d != null && p.views7d > 50000 && p.uploads30d <= 2) {
      byCategory.dormant_interest.push({
        artist: p.artist.name,
        slug: p.artist.slug,
        observation: 'High interest despite limited output',
        details: [
          `${p.views7d.toLocaleString()} views in 7 days`,
          `Only ${p.uploads30d} uploads in 30 days`,
          'Audience demand exceeding content supply',
        ],
        category: 'dormant_interest',
        campaign: p.artist.campaign || 'Monitoring',
        healthStatus: p.status,
        subs: p.subs,
        interestScore: p.views7d,
      });
    }
  }

  // Take the top entries from each category for a balanced mix
  const result: OutlierEntry[] = [];
  for (const cat of ['overperformer', 'unexpected_pattern', 'dormant_interest', 'underperformer'] as const) {
    const entries = byCategory[cat]
      .sort((a, b) => b.interestScore - a.interestScore)
      .slice(0, 4); // Max 4 per category
    result.push(...entries.map(({ interestScore: _, ...entry }) => entry));
  }
  return result;
}

// ── Section 5: Asset Intelligence ───────────────────────────────────────────

function buildAssetIntel(profiles: ChannelProfile[]): AssetIntel[] {
  // Only consider channels with some activity
  const active = profiles.filter((p) => p.uploads30d > 0);
  const total = active.length;
  if (total === 0) return [];

  const assets: { type: AssetType; check: (p: ChannelProfile) => boolean }[] = [
    { type: 'Official Video', check: (p) => !!p.mf?.hasOfficialVideo },
    { type: 'Visualiser', check: (p) => !!p.mf?.hasVisualizer },
    { type: 'Lyric Video', check: (p) => !!p.mf?.hasLyricVideo },
    { type: 'BTS', check: (p) => !!p.mf?.hasBTS },
    { type: 'Live Session', check: (p) => !!p.mf?.hasLiveSession },
    { type: 'Shorts', check: (p) => p.shorts30d > 0 },
  ];

  return assets.map(({ type, check }) => {
    const available = active.filter(check).length;
    const missing = total - available;
    const campaigns = active.filter(check).map((p) => p.artist.name);
    return {
      assetType: type,
      available,
      missing,
      total,
      percentage: Math.round((available / total) * 100),
      campaigns: campaigns.slice(0, 6),
    };
  }).sort((a, b) => a.percentage - b.percentage); // Most missing first
}

// ── Section 6: Asset Success Patterns ───────────────────────────────────────

function buildAssetPatterns(profiles: ChannelProfile[]): AssetPattern[] {
  const active = profiles.filter((p) => p.uploads30d > 0);
  if (active.length === 0) return [];

  const assetChecks: { type: string; check: (p: ChannelProfile) => boolean }[] = [
    { type: 'BTS', check: (p) => !!p.mf?.hasBTS },
    { type: 'Visualiser', check: (p) => !!p.mf?.hasVisualizer },
    { type: 'Lyric Video', check: (p) => !!p.mf?.hasLyricVideo },
    { type: 'Live Session', check: (p) => !!p.mf?.hasLiveSession },
    { type: 'Official Video', check: (p) => !!p.mf?.hasOfficialVideo },
    { type: 'Shorts + Longform', check: (p) => p.shorts30d > 0 && p.longform30d > 0 },
  ];

  return assetChecks.map(({ type, check }) => {
    const withAsset = active.filter(check);
    const withoutAsset = active.filter((p) => !check(p));

    const avg = (arr: ChannelProfile[], fn: (p: ChannelProfile) => number) =>
      arr.length > 0 ? Math.round(arr.reduce((s, p) => s + fn(p), 0) / arr.length) : 0;

    const healthyPct = (arr: ChannelProfile[]) =>
      arr.length > 0 ? Math.round(arr.filter((p) => p.status === 'HEALTHY').length / arr.length * 100) : 0;

    return {
      assetType: type,
      withAsset: {
        count: withAsset.length,
        avgCadence: avg(withAsset, (p) => p.uploads30d),
        avgFormatCount: avg(withAsset, (p) => p.formatCount),
        healthyPct: healthyPct(withAsset),
      },
      withoutAsset: {
        count: withoutAsset.length,
        avgCadence: avg(withoutAsset, (p) => p.uploads30d),
        avgFormatCount: avg(withoutAsset, (p) => p.formatCount),
        healthyPct: healthyPct(withoutAsset),
      },
    };
  });
}

// ── Section 7: Open Questions ───────────────────────────────────────────────

function buildOpenQuestions(profiles: ChannelProfile[]): OpenQuestion[] {
  const active = profiles.filter((p) => p.uploads30d > 0);
  const withBTS = active.filter((p) => p.mf?.hasBTS);
  const withVis = active.filter((p) => p.mf?.hasVisualizer);
  const withLyric = active.filter((p) => p.mf?.hasLyricVideo);
  const withLive = active.filter((p) => p.mf?.hasLiveSession);
  const shortsOnly = active.filter((p) => p.shorts30d > 0 && p.longform30d === 0);
  const multiformat = active.filter((p) => p.formatCount >= 3);
  const strongConv = active.filter((p) => p.convLabel === 'Strong');

  return [
    {
      question: 'Do visualisers extend campaign lifespan beyond release week?',
      status: withVis.length >= 5 ? 'early_signal' : 'gathering_evidence',
      evidenceCount: withVis.length,
      relatedCampaigns: withVis.map((p) => p.artist.name).slice(0, 4),
    },
    {
      question: 'How many Shorts per week is optimal during a campaign?',
      status: 'needs_investigation',
      evidenceCount: active.filter((p) => p.shorts30d > 0).length,
      relatedCampaigns: active.filter((p) => p.shorts30d >= 5).map((p) => p.artist.name).slice(0, 4),
    },
    {
      question: 'Do BTS videos improve campaign follow-through more than lyric videos?',
      status: withBTS.length >= 3 && withLyric.length >= 3 ? 'early_signal' : 'gathering_evidence',
      evidenceCount: withBTS.length + withLyric.length,
      relatedCampaigns: [...withBTS, ...withLyric].map((p) => p.artist.name).slice(0, 4),
    },
    {
      question: 'What drives subscriber conversion most effectively?',
      status: strongConv.length >= 5 ? 'early_signal' : 'gathering_evidence',
      evidenceCount: strongConv.length,
      relatedCampaigns: strongConv.map((p) => p.artist.name).slice(0, 4),
    },
    {
      question: 'Can Shorts-only channels sustain long-term growth?',
      status: shortsOnly.length >= 3 ? 'early_signal' : 'gathering_evidence',
      evidenceCount: shortsOnly.length,
      relatedCampaigns: shortsOnly.map((p) => p.artist.name).slice(0, 4),
    },
    {
      question: 'Does live session content improve audience loyalty?',
      status: withLive.length >= 3 ? 'early_signal' : 'gathering_evidence',
      evidenceCount: withLive.length,
      relatedCampaigns: withLive.map((p) => p.artist.name).slice(0, 4),
    },
    {
      question: 'Is there an optimal format mix for different campaign types (album vs single vs tour)?',
      status: multiformat.length >= 5 ? 'early_signal' : 'needs_investigation',
      evidenceCount: multiformat.length,
      relatedCampaigns: multiformat.map((p) => p.artist.name).slice(0, 4),
    },
    {
      question: 'How much does release timing affect campaign momentum?',
      status: 'needs_investigation',
      evidenceCount: profiles.filter((p) => p.plan).length,
      relatedCampaigns: profiles.filter((p) => p.plan).map((p) => p.artist.name).slice(0, 4),
    },
  ];
}

// ── Section 8: Weekly Learnings ─────────────────────────────────────────────

function buildWeeklyLearnings(profiles: ChannelProfile[]): WeeklyLearning[] {
  const learnings: WeeklyLearning[] = [];
  const active = profiles.filter((p) => p.uploads30d > 0);
  const healthy = active.filter((p) => p.status === 'HEALTHY');
  const multiformat = active.filter((p) => p.formatCount >= 3);
  const mfHealthy = multiformat.filter((p) => p.status === 'HEALTHY');
  const shortsOnly = active.filter((p) => p.shorts30d > 0 && p.longform30d === 0);
  const soHealthy = shortsOnly.filter((p) => p.status === 'HEALTHY');
  const withBTS = active.filter((p) => p.mf?.hasBTS);
  const btsHealthy = withBTS.filter((p) => p.status === 'HEALTHY');
  const withVis = active.filter((p) => p.mf?.hasVisualizer);
  const visHealthy = withVis.filter((p) => p.status === 'HEALTHY');

  // Confirmed
  if (multiformat.length >= 3 && mfHealthy.length / multiformat.length >= 0.5) {
    learnings.push({
      text: `Channels with 3+ content formats continue to show stronger health scores (${mfHealthy.length}/${multiformat.length} healthy vs ${healthy.length}/${active.length} overall).`,
      campaign: `${multiformat.length} campaigns`,
      category: 'confirmed',
    });
  }

  if (active.length > 0) {
    const highCadence = active.filter((p) => p.uploads30d >= 5);
    const hcHealthy = highCadence.filter((p) => p.status === 'HEALTHY');
    if (highCadence.length >= 3 && hcHealthy.length / highCadence.length >= 0.4) {
      learnings.push({
        text: `Channels with 5+ monthly uploads are more likely to be healthy (${hcHealthy.length}/${highCadence.length}) compared to overall (${healthy.length}/${active.length}).`,
        campaign: `${highCadence.length} campaigns`,
        category: 'confirmed',
      });
    }
  }

  if (withBTS.length >= 2 && btsHealthy.length / withBTS.length >= 0.5) {
    learnings.push({
      text: `BTS content correlates with healthier channels (${btsHealthy.length}/${withBTS.length} healthy). Possible continuity benefit.`,
      campaign: withBTS.map((p) => p.artist.name).slice(0, 3).join(', '),
      category: 'confirmed',
    });
  }

  // Challenged
  if (withVis.length >= 2) {
    const visHealthyPct = visHealthy.length / withVis.length;
    const overallHealthyPct = healthy.length / (active.length || 1);
    if (visHealthyPct <= overallHealthyPct) {
      learnings.push({
        text: `Visualisers have not significantly outperformed the average health rate this period (${visHealthy.length}/${withVis.length} vs ${healthy.length}/${active.length}).`,
        campaign: withVis.map((p) => p.artist.name).slice(0, 3).join(', '),
        category: 'challenged',
      });
    }
  }

  if (shortsOnly.length >= 2 && soHealthy.length > 0) {
    learnings.push({
      text: `Some Shorts-only channels are achieving healthy status (${soHealthy.length}/${shortsOnly.length}), partially challenging the multi-format requirement.`,
      campaign: shortsOnly.map((p) => p.artist.name).slice(0, 3).join(', '),
      category: 'challenged',
    });
  }

  // Unknown
  learnings.push({
    text: 'Community Post impact remains difficult to isolate — no reliable signal available from YouTube Data API.',
    campaign: 'All campaigns',
    category: 'unknown',
  });

  learnings.push({
    text: 'Audience retention patterns cannot be assessed without YouTube Studio access.',
    campaign: 'All campaigns',
    category: 'unknown',
  });

  if (profiles.filter((p) => p.plan).length > 0) {
    learnings.push({
      text: `${profiles.filter((p) => p.plan).length} campaigns have Coach plans, but plan-vs-actual execution tracking is limited.`,
      campaign: profiles.filter((p) => p.plan).map((p) => p.artist.name).slice(0, 3).join(', '),
      category: 'unknown',
    });
  }

  return learnings;
}
