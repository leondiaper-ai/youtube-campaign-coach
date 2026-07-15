'use client';

import { useState } from 'react';
import { fmtNum, type ChannelState } from '@/lib/artists';
import type { CampaignNote } from '@/lib/campaignStore';
import {
  type GrowthInput, type GrowthRead,
  generateYouTubeGrowthRead,
  channelStateToGrowthState,
  DECISION_STYLE, STATE_STYLE as GOS_STATE_STYLE,
  SPARK_STYLE as GOS_SPARK_STYLE,
  CAMPAIGN_SIGNAL_STYLE,
  type DecisionLabel,
  type CampaignSignal,
} from '@/lib/youtubeGrowthOS';
import type { StructureWarning } from '@/lib/contentStructure';
import Sparkline from './Sparkline';
import CampaignBehaviour from './CampaignBehaviour';

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const MUTED = '#E9E2D3';

type ImpactData = {
  daysSinceTakeover: number;
  subsDelta: number | null;
  viewsDelta: number | null;
  uploadsShipped: number;
  stateAtStart: string;
  stateNow: string;
};

type CampaignWindowData = {
  campaignName: string;
  campaignDay: number;
  contentViews: number;
  channelViewsDelta: number | null;
  subsGained: number | null;
  contentMix: { uploads: number; shorts: number; videos: number };
};

type CampaignTrendData = {
  currentWeekViews: number | null;
  previousWeekViews: number | null;
  bestWeekViews: number | null;
  bestWeekNumber: number;
  totalCampaignViews: number | null;
  totalCampaignSubs: number | null;
};

type WeeklyProgressEntry = {
  week: number;
  views7d: number | null;
  subs7d: number | null;
  channelHealth: string;
  campaignSignal: string;
  status: 'confirmed' | 'missing' | 'partial';
};

type CardData = {
  slug: string;
  name: string;
  campaign?: string;
  pinnedAt: string;
  priority: 'high' | 'normal';
  subs7Delta: number | null;
  views7Delta: number | null;
  uploads30d: number;
  shorts30d: number;
  boardStatus: ChannelState;
  diagnosis: string;
  actions: string[];
  cadenceLine: string;
  sparkline: { x: number; y: number }[];
  subs: number | null;
  views: number | null;
  lastUploadDaysAgo: number | null;
  notes: CampaignNote[];
  impact: ImpactData | null;
  campaignWindow: CampaignWindowData | null;
  campaignTrend: CampaignTrendData | null;
  weeklyProgress: WeeklyProgressEntry[];
  channelHealth: string;
  campaignSignal: string;
  campaignSignalLabel: string;
  /** Artist relationship type — value model only applies to 'managed' */
  artistType?: 'managed' | 'observed' | 'external';
  /** Revenue ownership — only 'virgin' gets value calculations */
  ownership?: 'virgin' | 'observed';
  /** Content structure warning (only present when a gap exists) */
  structureWarning?: StructureWarning | null;
  /** Data confidence level */
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  /** Human-readable data quality note */
  healthNote?: string;
  /** Clear data status label */
  dataStatus?: 'FRESH' | 'PARTIAL' | 'LIMITED' | 'STALE' | 'UNAVAILABLE';
  /** Short explanation for data status */
  dataStatusNote?: string;
  /** Whether YouTube's view data appears fresh or stale */
  viewDataFreshness?: 'fresh' | 'stale' | 'insufficient_history' | 'unavailable';
  /** Movement data confidence — drives UI tone (cautious vs assertive) */
  movementConfidence?: 'high' | 'medium' | 'limited' | 'stale';
  /** Movement freshness tier */
  movementFreshness?: 'live' | 'recent' | 'delayed' | 'stale';
  /** Last known good views 7d delta (retained from history) */
  lastKnownGoodViews7d?: number | null;
  /** Last known good subs 7d delta (retained from history) */
  lastKnownGoodSubs7d?: number | null;
  /** Days since last known good movement was confirmed */
  lastKnownGoodDaysAgo?: number | null;
};

// ─── Growth OS bridge ──────────────────────────────────────────────────────

function cardToGrowthInput(card: CardData): GrowthInput {
  const daysSince = card.lastUploadDaysAgo ?? (
    card.cadenceLine.startsWith('No recent') ? 31
    : card.boardStatus === 'COLD' ? 60 : 7
  );
  const isStale = card.movementConfidence === 'stale';
  return {
    subscribers: card.subs ?? undefined,
    // When movement is stale, pass null so Growth OS doesn't diagnose
    // "algorithm not amplifying" from stale +0 data
    views7d: isStale ? null : card.views7Delta,
    subscribers7d: isStale ? null : card.subs7Delta,
    uploads30d: card.uploads30d,
    shorts30d: card.shorts30d,
    lastUploadDaysAgo: daysSince,
    hasActiveCampaign: !!card.campaign,
    campaignName: card.campaign,
  };
}

function getGrowthRead(card: CardData): GrowthRead {
  return generateYouTubeGrowthRead(card.name, cardToGrowthInput(card));
}

type AvailableArtist = { slug: string; name: string };

function fmtNoteDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((nDay.getTime() - dDay.getTime()) / 86400000);
  if (diffDays === 0) return `today · ${dateStr}`;
  if (diffDays === 1) return `yesterday · ${dateStr}`;
  if (diffDays < 7) return `${diffDays}d ago · ${dateStr}`;
  return dateStr;
}

function gsFor(cs: ChannelState) { return channelStateToGrowthState(cs); }

function deltaColor(v: number | null): string {
  if (v == null) return 'rgba(14,14,14,0.25)';
  if (v > 0) return '#0C6A3F';
  if (v < 0) return '#8A1F0C';
  return 'rgba(14,14,14,0.4)';
}

// ─── Conversion metric ───────────────────────────────────────────────────
function subsPerKViews(card: CardData): number | null {
  // Both metrics must be present and views must be positive
  if (card.views7Delta == null || card.views7Delta <= 0) return null;
  if (card.subs7Delta == null) return null;
  return (card.subs7Delta / card.views7Delta) * 1000;
}

function conversionColor(spk: number): string {
  if (spk >= 2) return '#0C6A3F';
  if (spk >= 1) return '#7A5A00';
  return '#8A1F0C';
}

function conversionLabel(spk: number | null): { text: string; color: string } {
  if (spk == null) return { text: '—', color: 'rgba(14,14,14,0.25)' };
  if (spk >= 2) return { text: 'strong', color: '#0C6A3F' };
  if (spk >= 1) return { text: 'healthy', color: '#7A5A00' };
  return { text: 'weak', color: '#8A1F0C' };
}

// ─── Simplified card copy ───────────────────────────────────────────────

function whatHappening(card: CardData): string {
  const isStale = card.movementConfidence === 'stale';

  // STALE MOVEMENT: cautious, not negative
  if (isStale && card.boardStatus !== 'COLD') {
    if (card.uploads30d >= 5) return 'Campaign active — totals updating';
    if (card.uploads30d >= 3) return 'Cadence healthy — totals updating';
    if (card.uploads30d >= 1) return 'Uploads active — totals updating';
    return 'Totals updating';
  }

  const viewsStrong = card.views7Delta != null && card.views7Delta > 5000;
  const viewsUp = card.views7Delta != null && card.views7Delta > 0;
  const subsUp = card.subs7Delta != null && card.subs7Delta > 0;
  const subsFlat = card.subs7Delta == null || card.subs7Delta <= 0;
  const spk = subsPerKViews(card);
  const cadenceLow = card.uploads30d <= 2;

  if (card.boardStatus === 'COLD') return 'Channel silent — no audience signal';
  if (viewsStrong && subsFlat) return 'Reach strong, conversion weak';
  if (viewsUp && subsUp && spk != null && spk >= 2) return 'Healthy growth, demand converting';
  if (viewsUp && subsUp) return 'Early traction, building momentum';
  if (cadenceLow && viewsUp) return 'Underfed channel, growth waiting';
  if (card.boardStatus === 'AT RISK' && card.uploads30d === 0) return 'Channel stalling — no recent output';
  if (card.boardStatus === 'AT RISK') return 'Momentum dropping, cadence falling';
  if (viewsUp && subsFlat) return 'Views up but not converting';
  if (card.uploads30d >= 5) return 'Good cadence — building rhythm';
  return 'Building — not yet at rhythm';
}

function whyCause(read: GrowthRead, card?: CardData): string {
  const isStale = card?.movementConfidence === 'stale';

  // When movement is stale, suppress momentum-based diagnoses
  if (isStale && read.blocker.blocker === 'MOMENTUM_GAP') {
    return 'Totals updating';
  }

  switch (read.blocker.blocker) {
    case 'CADENCE_GAP': return 'Low upload cadence';
    case 'CONVERSION_GAP': return 'No depth content / artist connection';
    case 'FORMAT_GAP': return 'No Shorts or supporting formats';
    case 'MOMENTUM_GAP': return 'View momentum flat — content not being amplified';
    case 'AUDIENCE_CONNECTION_GAP': return 'Content lacks depth and connection';
    case 'ASSET_GAP': return 'Content assets not ready';
    case 'CAMPAIGN_ALIGNMENT_GAP': return 'Uploads not serving campaign';
    case 'NONE': return 'No critical blocker identified';
  }
}

// ─── Section classification ─────────────────────────────────────────────

const ACTIVE_OVERRIDES = ['thesnuts'];

type BoardSection = 'active' | 'building' | 'at-risk' | 'dormant';

function classifyCard(card: CardData): BoardSection {
  if (card.boardStatus === 'COLD') return 'dormant';
  if (ACTIVE_OVERRIDES.includes(card.slug)) return 'active';
  if (card.campaign) return 'active';

  // Use Growth OS decision to refine — if decision is PUSH with good signals,
  // the channel is building, not at risk, even if boardStatus says AT RISK
  const read = getGrowthRead(card);
  if (read.decision === 'PUSH' && card.boardStatus === 'AT RISK') return 'building';

  if (card.boardStatus === 'WEAK CONVERSION' || card.boardStatus === 'AT RISK') return 'at-risk';
  return 'building';
}

// ─── Momentum one-liner (kept for reports) ──────────────────────────────
function momentumLine(ct: CampaignTrendData): string {
  const curr = ct.currentWeekViews != null ? fmtNum(ct.currentWeekViews) : '—';
  const prev = ct.previousWeekViews != null && ct.previousWeekViews > 0 ? fmtNum(ct.previousWeekViews) : null;
  const total = ct.totalCampaignViews != null ? fmtNum(ct.totalCampaignViews) : '—';
  const arrow = (ct.currentWeekViews != null && ct.previousWeekViews != null)
    ? (ct.currentWeekViews > ct.previousWeekViews ? '↑' :
       ct.currentWeekViews < ct.previousWeekViews ? '↓' : '→')
    : '→';
  if (prev) {
    return `${curr} this week (${arrow} vs ${prev} last week) · ${total} total`;
  }
  return `${curr} this week · ${total} total`;
}

// ─── Campaign Progress Report generator ────────────────────────────────
function generateSnapshot(card: CardData): string {
  const read = getGrowthRead(card);
  const cw = card.campaignWindow;
  const ct = card.campaignTrend;
  const hasCampaign = !!cw;

  const lines: string[] = [];

  if (hasCampaign) {
    lines.push(`CAMPAIGN PROGRESS REPORT — ${card.name.toUpperCase()}`);
    lines.push(`Campaign: ${cw!.campaignName} · Day ${cw!.campaignDay}`);
    lines.push(`Channel: ${card.channelHealth} · Campaign: ${card.campaignSignalLabel}`);
  } else {
    lines.push(`YOUTUBE GROWTH READ — ${card.name.toUpperCase()}`);
    lines.push(`Channel: ${card.channelHealth}`);
  }

  const spk = subsPerKViews(card);
  if (spk != null) {
    lines.push(`Subs / 1K views: ${spk.toFixed(1)} (${conversionLabel(spk).text})`);
  }

  lines.push('', '1. WHAT\'S HAPPENING');
  lines.push(whatHappening(card));
  lines.push(`Why: ${whyCause(read, card)}`);

  const isStaleExport = card.movementConfidence === 'stale';
  lines.push('', '2. CURRENT WEEK');
  lines.push(`Views (7d): ${!isStaleExport && card.views7Delta != null ? `${card.views7Delta >= 0 ? '+' : ''}${fmtNum(card.views7Delta)}` : isStaleExport ? 'Updating' : '—'}`);
  lines.push(`Subs (7d): ${!isStaleExport && card.subs7Delta != null ? `${card.subs7Delta >= 0 ? '+' : ''}${fmtNum(card.subs7Delta)}` : isStaleExport ? 'Updating' : '—'}`);
  lines.push(`Uploads (30d): ${card.uploads30d}`);
  lines.push(`Cadence: ${card.cadenceLine}`);

  if (hasCampaign && cw && ct) {
    lines.push('', '3. CAMPAIGN SO FAR');
    lines.push(`Campaign views: ${ct.totalCampaignViews != null ? fmtNum(ct.totalCampaignViews) : '—'}`);
    lines.push(`Campaign subs: ${ct.totalCampaignSubs != null ? `${ct.totalCampaignSubs >= 0 ? '+' : ''}${fmtNum(ct.totalCampaignSubs)}` : '—'}`);
    lines.push(`Content: ${cw.contentMix.uploads} uploads (${cw.contentMix.shorts} Shorts · ${cw.contentMix.videos} videos)`);
    lines.push(`Momentum: ${momentumLine(ct)}`);
  }

  if (card.weeklyProgress.length > 0) {
    const gapCount = card.weeklyProgress.filter(w => w.status === 'missing').length;
    lines.push('', `WEEKLY PROGRESS:${gapCount > 0 ? ` (${gapCount} monitoring gap${gapCount !== 1 ? 's' : ''})` : ''}`);
    for (const w of card.weeklyProgress) {
      if (w.status === 'missing') {
        lines.push(`Week ${w.week}: Monitoring gap`);
      } else if (w.status === 'partial') {
        const parts: string[] = [];
        if (w.views7d != null) parts.push(`${w.views7d >= 0 ? '+' : ''}${fmtNum(w.views7d)} views`);
        if (w.subs7d != null) parts.push(`${w.subs7d >= 0 ? '+' : ''}${fmtNum(w.subs7d)} subs`);
        lines.push(`Week ${w.week}: ${parts.join(' · ')} (partial)`);
      } else {
        lines.push(`Week ${w.week}: ${w.views7d != null ? `${w.views7d >= 0 ? '+' : ''}${fmtNum(w.views7d)} views` : '— views'} · ${w.subs7d != null ? `${w.subs7d >= 0 ? '+' : ''}${fmtNum(w.subs7d)} subs` : '— subs'} · ${w.campaignSignal}`);
      }
    }
  }

  const nextNum = hasCampaign ? 4 : 3;
  lines.push('', `${nextNum}. ACTION THIS WEEK`);
  read.actions.doNow.slice(0, 3).forEach((a) => lines.push(`→ ${a}`));

  lines.push('', `${nextNum + 1}. WATCH NEXT`);
  lines.push(read.watch);

  if (card.impact && card.impact.daysSinceTakeover >= 2) {
    lines.push('', `SINCE TAKEOVER (${card.impact.daysSinceTakeover} days)`);
    lines.push(`${card.impact.subsDelta != null ? `${card.impact.subsDelta >= 0 ? '+' : ''}${fmtNum(card.impact.subsDelta)} subs` : '— subs'}`);
    lines.push(`${card.impact.viewsDelta != null ? `${card.impact.viewsDelta >= 0 ? '+' : ''}${fmtNum(card.impact.viewsDelta)} views` : '— views'}`);
  }

  const latestNote = card.notes.length > 0 ? card.notes[0] : null;
  if (latestNote) {
    lines.push('', 'CONTEXT:');
    lines.push(`- ${latestNote.tag ? `${latestNote.tag}: ` : ''}${latestNote.text}`);
  }

  return lines.join('\n');
}

// ─── Snapshot Modal ─────────────────────────────────────────────────────
function SnapshotModal({ text, onClose }: { text: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(14,14,14,0.35)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl shadow-lg p-6 mx-4 max-h-[85vh] flex flex-col"
        style={{ background: PAPER }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13px] font-bold uppercase tracking-[0.12em] text-ink/50">Snapshot</h3>
          <button onClick={onClose} className="text-ink/30 hover:text-ink/60 text-[18px]">&times;</button>
        </div>
        <pre
          className="flex-1 overflow-y-auto text-[12px] leading-[1.6] whitespace-pre-wrap mb-4"
          style={{ color: INK, fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          {text}
        </pre>
        <button
          onClick={handleCopy}
          className="self-end text-[11px] font-bold uppercase tracking-[0.14em] px-4 py-2 rounded-lg transition-all"
          style={{ background: copied ? '#E6F8EE' : INK, color: copied ? '#0C6A3F' : PAPER }}
        >
          {copied ? 'Copied' : 'Copy to clipboard'}
        </button>
      </div>
    </div>
  );
}

// ─── Weekly YouTube Read (board-level summary) ──────────────────────────
function WeeklySummary({ cards }: { cards: CardData[] }) {
  const nonCold = cards.filter((c) => c.boardStatus !== 'COLD');

  const weakConvCount = nonCold.filter((c) => {
    if (c.movementConfidence === 'stale') return false;
    return c.views7Delta != null && c.views7Delta > 5000 &&
      (c.subs7Delta == null || c.subs7Delta <= 0);
  }).length;

  const underfedCount = nonCold.filter((c) => {
    if (c.movementConfidence === 'stale') return false;
    return c.uploads30d <= 2 && c.views7Delta != null && c.views7Delta > 0;
  }).length;

  const coldCount = cards.filter((c) => c.boardStatus === 'COLD').length;

  const noShortsCount = nonCold.filter((c) => c.shorts30d === 0).length;

  const atRiskCount = nonCold.filter((c) =>
    c.boardStatus === 'AT RISK' || c.boardStatus === 'WEAK CONVERSION'
  ).length;

  // Detect top blocker pattern
  const blockerMap: Record<string, number> = {};
  for (const c of nonCold) {
    const b = getGrowthRead(c).blocker.blocker;
    if (b !== 'NONE') blockerMap[b] = (blockerMap[b] || 0) + 1;
  }
  const topBlocker = Object.entries(blockerMap).sort((a, b) => b[1] - a[1])[0];

  const insights: string[] = [];
  if (weakConvCount > 0) insights.push(`${weakConvCount} campaign${weakConvCount > 1 ? 's' : ''} with strong reach but weak conversion`);
  if (underfedCount > 0) insights.push(`${underfedCount} channel${underfedCount > 1 ? 's' : ''} underfed — growth waiting on cadence`);
  if (atRiskCount > 0) insights.push(`${atRiskCount} channel${atRiskCount > 1 ? 's' : ''} at risk or underperforming`);
  if (coldCount > 0) insights.push(`${coldCount} channel${coldCount > 1 ? 's' : ''} inactive (60+ days)`);
  if (noShortsCount > 2) insights.push(`Shorts underutilised — ${noShortsCount} active channels with zero Shorts`);
  if (topBlocker && topBlocker[1] >= 2) {
    const label = topBlocker[0] === 'CADENCE_GAP' ? 'upload cadence'
      : topBlocker[0] === 'CONVERSION_GAP' ? 'conversion'
      : topBlocker[0] === 'FORMAT_GAP' ? 'format diversity'
      : topBlocker[0].toLowerCase().replace(/_/g, ' ');
    insights.push(`Key pattern: ${label} is the top blocker across ${topBlocker[1]} channels`);
  }

  if (insights.length === 0) return null;

  return (
    <div className="rounded-2xl p-6 mb-8" style={{ background: '#FFFFFF', border: `1px solid ${MUTED}` }}>
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-ink/40 mb-3">
        Weekly YouTube Read
      </div>
      <div className="space-y-1.5">
        {insights.map((insight, i) => (
          <div key={i} className="text-[13px] text-ink/65 leading-snug">
            <span className="text-ink/25 mr-2">·</span>{insight}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Dormant / Cold Block (aggregated) ──────────────────────────────────
function DormantBlock({ cards }: { cards: CardData[] }) {
  const [expanded, setExpanded] = useState(false);
  const totalSubs = cards.reduce((sum, c) => sum + (c.subs ?? 0), 0);
  const sorted = [...cards].sort((a, b) => (b.subs ?? 0) - (a.subs ?? 0));
  const top3 = sorted.slice(0, 3);
  // Conservative estimate: 15K–50K reach/month per dormant channel if reactivated
  const estLow = cards.length * 15_000;
  const estHigh = cards.length * 50_000;

  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/30 mb-4">
        Dormant / Cold
      </div>
      <div
        className="rounded-2xl p-6"
        style={{ background: '#FFFFFF', border: `1px solid ${MUTED}` }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[15px] font-bold">
              {cards.length} channel{cards.length !== 1 ? 's' : ''} inactive (60+ days)
            </div>
            <div className="text-[12px] text-ink/40 mt-1 leading-snug">
              {totalSubs > 0 && <>{fmtNum(totalSubs)} combined subscribers · </>}
              ~{fmtNum(estLow)}–{fmtNum(estHigh)} estimated missed monthly reach
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] text-ink/30 hover:text-ink/50 shrink-0 mt-1"
          >
            {expanded ? 'Collapse' : 'Show channels'}
          </button>
        </div>

        {/* Action block */}
        <div className="rounded-lg p-4 mt-4" style={{ background: SOFT }}>
          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink/35 mb-2">Recommended</div>
          <div className="space-y-1">
            <div className="text-[12px] font-medium flex gap-2">
              <span className="text-ink/30 shrink-0">→</span>
              <span>Reactivate top 3 by audience size{top3.length > 0 ? ` (${top3.map((c) => c.name).join(', ')})` : ''}</span>
            </div>
            <div className="text-[12px] font-medium flex gap-2">
              <span className="text-ink/30 shrink-0">→</span>
              <span>Test 2–3 catalogue Shorts per channel to restart the feed</span>
            </div>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 space-y-1.5">
            {sorted.map((card) => (
              <div
                key={card.slug}
                className="flex items-center gap-3 text-[12px] px-3 py-2 rounded-lg"
                style={{ background: SOFT }}
              >
                <span className="font-bold flex-1 min-w-0 truncate">{card.name}</span>
                <span className="text-ink/40 tabular-nums shrink-0">
                  {card.subs ? fmtNum(card.subs) + ' subs' : '—'}
                </span>
                <span className="text-ink/30 shrink-0">
                  {card.lastUploadDaysAgo ? `${card.lastUploadDaysAgo}d since upload` : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section-level common issue note ────────────────────────────────────
function SectionIssueNote({ cards }: { cards: CardData[] }) {
  if (cards.length < 3) return null;
  // Count common blockers
  const blockerMap: Record<string, string[]> = {};
  for (const c of cards) {
    const b = getGrowthRead(c).blocker.blocker;
    if (b !== 'NONE') {
      if (!blockerMap[b]) blockerMap[b] = [];
      blockerMap[b].push(c.name);
    }
  }
  const common = Object.entries(blockerMap).filter(([, names]) => names.length >= 2);
  if (common.length === 0) return null;
  const [blocker, names] = common.sort((a, b) => b[1].length - a[1].length)[0];
  const label = blocker === 'CADENCE_GAP' ? 'Upload cadence'
    : blocker === 'CONVERSION_GAP' ? 'Conversion'
    : blocker === 'FORMAT_GAP' ? 'Format diversity'
    : blocker.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

  return (
    <div className="text-[11px] text-ink/35 mb-3 px-1">
      Common issue: {label} — affects {names.join(', ')}
    </div>
  );
}

// ─── Snapshot History (collapsed by default, inside Show Detail) ────────
function SnapshotHistory({ slug }: { slug: string }) {
  const [history, setHistory] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  async function loadHistory() {
    if (history) { setShowHistory(!showHistory); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/weekly-snapshots?slug=${slug}&count=4`);
      const data = await res.json();
      setHistory(data.snapshots ?? []);
      setShowHistory(true);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 pt-2" style={{ borderTop: '1px solid rgba(14,14,14,0.06)' }}>
      <button
        onClick={loadHistory}
        className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink/25 hover:text-ink/45 transition-colors"
      >
        {loading ? 'Loading…' : showHistory ? 'Hide weekly history' : 'Weekly history'}
      </button>
      {showHistory && history && history.length > 0 && (
        <div className="mt-2 space-y-1">
          {history.map((s: any) => (
            <div
              key={s.weekId}
              className="flex items-center gap-2 text-[10px] rounded-md px-2.5 py-1.5"
              style={{ background: 'rgba(14,14,14,0.03)' }}
            >
              <span className="font-bold text-ink/40 w-[52px] shrink-0">{s.weekId}</span>
              <span className="font-bold tabular-nums" style={{ color: s.views7d != null && s.views7d > 0 ? '#0C6A3F' : s.views7d != null && s.views7d < 0 ? '#8A1F0C' : 'rgba(14,14,14,0.3)' }}>
                {s.views7d != null ? `${s.views7d >= 0 ? '+' : ''}${fmtNum(s.views7d)} views` : '— views'}
              </span>
              <span className="text-ink/15">·</span>
              <span className="font-bold tabular-nums" style={{ color: s.subscribers7d != null && s.subscribers7d > 0 ? '#0C6A3F' : s.subscribers7d != null && s.subscribers7d < 0 ? '#8A1F0C' : 'rgba(14,14,14,0.3)' }}>
                {s.subscribers7d != null ? `${s.subscribers7d >= 0 ? '+' : ''}${fmtNum(s.subscribers7d)} subs` : '— subs'}
              </span>
              <span className="text-ink/15">·</span>
              <span
                className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                style={{
                  background: s.currentClassification === 'GROWING' ? '#E6F8EE'
                    : s.currentClassification === 'WEAK_CONVERSION' ? '#FFEAD6'
                    : s.currentClassification === 'UNDERFED' ? '#FFF5D6'
                    : '#FFE2D8',
                  color: s.currentClassification === 'GROWING' ? '#0C6A3F'
                    : s.currentClassification === 'WEAK_CONVERSION' ? '#8A4A1A'
                    : s.currentClassification === 'UNDERFED' ? '#7A5A00'
                    : '#8A1F0C',
                }}
              >
                {s.currentClassification === 'WEAK_CONVERSION' ? 'Weak Conv' : s.currentClassification?.toLowerCase()}
              </span>
              {s.missedOpportunityType !== 'none' && (
                <>
                  <span className="text-ink/15">·</span>
                  <span className="text-[9px] text-ink/30">{s.missedOpportunityType.replace(/_/g, ' ')}</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {showHistory && history && history.length === 0 && (
        <div className="mt-2 text-[10px] text-ink/25">No weekly snapshots yet. Click "Save Weekly Snapshot" to start tracking.</div>
      )}
    </div>
  );
}

// ─── Content Structure Warning (lightweight, only when relevant) ─────────
function StructureWarningLine({ warning }: { warning: StructureWarning }) {
  return (
    <div
      className="flex items-start gap-2 mb-3 px-3 py-2 rounded text-[11px] leading-snug"
      style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}
    >
      <span className="shrink-0 mt-px" style={{ color: '#92400E', fontSize: 11 }}>⚠</span>
      <div>
        <span className="font-bold uppercase tracking-[0.04em]" style={{ color: '#92400E' }}>
          {warning.headline}
        </span>
        <span style={{ color: '#78716C' }}> — {warning.detail}</span>
      </div>
    </div>
  );
}

// ─── Decision Card (standardised 4-line format) ─────────────────────────
function DecisionCard({
  card,
  onUnpin,
  onNotesChange,
  onViewBehaviour,
}: {
  card: CardData;
  onUnpin: (slug: string) => void;
  onNotesChange: (slug: string, notes: CampaignNote[]) => void;
  onViewBehaviour?: (slug: string) => void;
}) {
  const [noteInput, setNoteInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showWeeks, setShowWeeks] = useState(false);
  const [snapshot, setSnapshot] = useState<string | null>(null);

  const gs = gsFor(card.boardStatus);
  const read = getGrowthRead(card);
  const dStyle = DECISION_STYLE[read.decision];
  const spk = subsPerKViews(card);
  const conv = conversionLabel(spk);
  const isFix = read.decision === 'FIX';
  const cardBorder = isFix ? dStyle.border : MUTED;
  const cw = card.campaignWindow;
  const ct = card.campaignTrend;

  async function addNote() {
    if (!noteInput.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/campaign-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: card.slug, text: noteInput.trim() }),
      });
      const data = await res.json();
      if (data.notes) {
        onNotesChange(card.slug, data.notes);
        setNoteInput('');
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(noteId: string) {
    const res = await fetch(`/api/campaign-notes?slug=${card.slug}&noteId=${noteId}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (data.notes) onNotesChange(card.slug, data.notes);
  }

  const latestNote = card.notes.length > 0 ? card.notes[0] : null;
  const hasMoreNotes = card.notes.length > 1;

  return (
    <div
      className="rounded-2xl p-5 relative group"
      style={{
        background: '#FFFFFF',
        border: `${isFix ? '2px' : '1px'} solid ${cardBorder}`,
        boxShadow: isFix ? `0 0 0 1px ${dStyle.border}40` : undefined,
      }}
    >
      {/* Remove — hover only */}
      <button
        onClick={() => onUnpin(card.slug)}
        className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-[14px] text-ink/0 group-hover:text-ink/40 hover:!text-ink/70 hover:bg-black/5 transition-all"
        title="Remove"
      >
        &times;
      </button>

      {/* Channel Behaviour button — always visible */}
      {onViewBehaviour && (
        <button
          onClick={() => onViewBehaviour(card.slug)}
          className="absolute top-3 right-10 text-[9px] font-bold uppercase tracking-[0.08em] text-ink/30 hover:text-ink hover:bg-black/5 transition-all px-2 py-1 rounded"
          title="View channel behaviour"
        >
          Behaviour
        </button>
      )}

      {/* ─── 1. Artist name + decision + dual state ─────────────────── */}
      <div className="mb-3">
        <div className="flex items-center gap-2.5 mb-1">
          <h2 className="font-black text-[20px] leading-tight">{card.name}</h2>
          {card.confidence === 'LOW' && (
            <span className="text-[8px] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded" style={{ background: '#F3F0EA', color: 'rgba(14,14,14,0.35)' }} title={card.healthNote ?? 'Limited data'}>
              Limited
            </span>
          )}
          {card.confidence === 'MEDIUM' && (
            <span className="text-[8px] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded" style={{ background: '#FFF5D6', color: '#7A5A00' }} title={card.healthNote ?? 'Partial data'}>
              Partial
            </span>
          )}
          <span
            className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-[0.1em]"
            style={{ background: dStyle.bg, color: dStyle.fg, border: `1px solid ${dStyle.border}` }}
          >
            {read.decision}
          </span>
          {read.showConfidence && (
            <span className="text-[9px] font-bold uppercase tracking-[0.06em]" style={{ color: `${dStyle.fg}88` }}>
              {read.confidence}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px]">
          <span className="font-bold uppercase tracking-[0.08em] text-ink/50">
            Channel: <span style={{ color: dStyle.fg }}>{card.channelHealth}</span>
          </span>
          <span className="text-ink/20">·</span>
          <span className="font-bold uppercase tracking-[0.08em] text-ink/50">
            Campaign:{' '}
            {card.campaignSignal !== 'NO_CAMPAIGN' ? (
              <span
                className="px-1.5 py-0.5 rounded"
                style={{
                  background: CAMPAIGN_SIGNAL_STYLE[card.campaignSignal as CampaignSignal]?.bg ?? SOFT,
                  color: CAMPAIGN_SIGNAL_STYLE[card.campaignSignal as CampaignSignal]?.fg ?? INK,
                }}
              >
                {card.campaignSignalLabel}
              </span>
            ) : (
              <span className="text-ink/30">None</span>
            )}
          </span>
        </div>
      </div>

      {/* ─── 2. Metrics row (views, subs, conversion, sparkline) ──── */}
      <div className="flex items-end gap-6 mb-3">
        <div>
          {(() => {
            const isStaleMovement = card.movementConfidence === 'stale';
            // When movement is stale, suppress +0 — show "—" instead
            const hasRealDelta = card.views7Delta != null && !(isStaleMovement && card.views7Delta === 0);
            const isZero = hasRealDelta && card.views7Delta === 0;
            return (
              <>
                <div
                  className="text-[28px] font-black leading-none tabular-nums"
                  style={{ color: hasRealDelta ? (isZero ? 'rgba(14,14,14,0.35)' : deltaColor(card.views7Delta)) : 'rgba(14,14,14,0.2)' }}
                >
                  {hasRealDelta
                    ? `${card.views7Delta! >= 0 ? '+' : ''}${fmtNum(card.views7Delta!)}`
                    : isStaleMovement ? 'Updating' : '—'}
                </div>
                <div className="text-[10px] text-ink/35 mt-1 uppercase tracking-[0.1em] font-bold">
                  7d views{!hasRealDelta ? (isStaleMovement ? ' · waiting for fresh totals' : card.confidence === 'LOW' ? ' · limited data' : '') : ''}
                </div>
              </>
            );
          })()}
        </div>
        <div>
          {(() => {
            const isStaleMovement = card.movementConfidence === 'stale';
            const hasRealDelta = card.subs7Delta != null && !(isStaleMovement && card.subs7Delta === 0);
            const isZero = hasRealDelta && card.subs7Delta === 0;
            return (
              <>
                <div
                  className="text-[28px] font-black leading-none tabular-nums"
                  style={{ color: hasRealDelta ? (isZero ? 'rgba(14,14,14,0.35)' : deltaColor(card.subs7Delta)) : INK }}
                >
                  {hasRealDelta
                    ? `${card.subs7Delta! >= 0 ? '+' : ''}${fmtNum(card.subs7Delta!)}`
                    : isStaleMovement && card.subs != null ? fmtNum(card.subs)
                    : card.subs != null
                    ? fmtNum(card.subs)
                    : '—'}
                </div>
                <div className="text-[10px] text-ink/35 mt-1 uppercase tracking-[0.1em] font-bold">
                  {hasRealDelta ? '7d subs' : 'subs (total)'}
                </div>
              </>
            );
          })()}
        </div>

        {/* Conversion */}
        <div>
          <div
            className="text-[20px] font-black leading-none tabular-nums"
            style={{ color: spk != null ? conversionColor(spk) : 'rgba(14,14,14,0.25)' }}
          >
            {spk != null ? spk.toFixed(1) : '—'}
          </div>
          <div className="text-[9px] mt-1 uppercase tracking-[0.1em] font-bold" style={{
            color: spk != null ? conv.color : 'rgba(14,14,14,0.25)',
          }}>
            subs/1K{spk != null ? ` · ${conv.text}` : ''}
          </div>
        </div>

        {/* Sparkline */}
        <div className="ml-auto rounded-lg px-3 py-2" style={{ background: GOS_SPARK_STYLE[gs].fill }}>
          <Sparkline
            data={card.sparkline}
            width={120}
            height={40}
            stroke={GOS_SPARK_STYLE[gs].stroke}
            fill={GOS_SPARK_STYLE[gs].fill}
          />
          <div className="text-[9px] text-right mt-0.5 uppercase tracking-wider font-bold" style={{ color: GOS_SPARK_STYLE[gs].stroke }}>
            30d trend
          </div>
        </div>
      </div>

      {/* ─── 3. Performance summary ────────────────────────────────── */}
      <div className="text-[13px] font-semibold text-ink/75 leading-snug mb-1">
        {whatHappening(card)}
      </div>
      <div className="text-[12px] text-ink/40 mb-1">
        {whyCause(read, card)}
      </div>


      {/* ─── 4. Actions (max 3) ───────────────────────────────────── */}
      <div className="rounded-lg p-3.5 mb-3" style={{ background: isFix ? dStyle.bg : SOFT }}>
        <div className="space-y-1">
          {read.actions.doNow.slice(0, 3).map((step, i) => (
            <div key={i} className="text-[12px] font-medium leading-snug flex gap-2">
              <span style={{ color: dStyle.fg }} className="shrink-0">→</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── 5. Campaign tracking + weekly progress ────────────────── */}
      {cw && (
        <div className="rounded-lg p-3.5 mb-3" style={{ background: 'rgba(14,14,14,0.02)', border: '1px solid rgba(14,14,14,0.06)' }}>
          {/* Campaign / Tracking header row */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#2C6BFF' }} />
              <span className="text-[12px] font-black uppercase tracking-[0.08em]" style={{ color: '#3B5998' }}>
                Day {cw.campaignDay}
              </span>
              <span className="text-[11px] text-ink/30">·</span>
              <span className="text-[11px] text-ink/40">{cw.campaignName}</span>
            </div>
          </div>

          {/* Totals since campaign started (not 7d — full campaign period) */}
          <div className="flex items-center gap-4 mb-2">
            <div>
              <span className="text-[16px] font-black tabular-nums" style={{ color: deltaColor(cw.channelViewsDelta) }}>
                {cw.channelViewsDelta != null ? `${cw.channelViewsDelta >= 0 ? '+' : ''}${fmtNum(cw.channelViewsDelta)}` : '—'}
              </span>
              <span className="text-[9px] text-ink/30 ml-1 uppercase tracking-[0.08em] font-bold">views (total)</span>
            </div>
            <div>
              <span className="text-[16px] font-black tabular-nums" style={{ color: cw.subsGained != null ? (cw.subsGained > 0 ? '#0C6A3F' : cw.subsGained < 0 ? '#8A1F0C' : 'rgba(14,14,14,0.25)') : 'rgba(14,14,14,0.25)' }}>
                {cw.subsGained != null ? `${cw.subsGained >= 0 ? '+' : ''}${fmtNum(cw.subsGained)}` : '—'}
              </span>
              <span className="text-[9px] text-ink/30 ml-1 uppercase tracking-[0.08em] font-bold">subs (total)</span>
            </div>
            <div className="text-[10px] text-ink/30">
              {cw.contentMix.uploads} upload{cw.contentMix.uploads !== 1 ? 's' : ''} ({cw.contentMix.shorts} Shorts · {cw.contentMix.videos} video{cw.contentMix.videos !== 1 ? 's' : ''})
            </div>
          </div>

          {/* Momentum */}
          {ct && ct.currentWeekViews != null && ct.currentWeekViews > 0 && (
            <div className="text-[10px] text-ink/35 mb-2">
              <span className="font-bold uppercase tracking-[0.08em] text-ink/30">Momentum:</span>{' '}
              <span className="tabular-nums">{momentumLine(ct)}</span>
            </div>
          )}

          {/* Weekly progress (expandable dropdown) */}
          {card.weeklyProgress.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(14,14,14,0.06)' }} className="pt-2">
              <button
                onClick={() => setShowWeeks(!showWeeks)}
                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-ink/35 hover:text-ink/55 transition-colors w-full"
              >
                <span
                  className="inline-block transition-transform text-[8px]"
                  style={{ transform: showWeeks ? 'rotate(90deg)' : 'rotate(0deg)' }}
                >
                  ▶
                </span>
                <span>{card.weeklyProgress.length} week{card.weeklyProgress.length !== 1 ? 's' : ''} tracked</span>
                {(() => {
                  const gapCount = card.weeklyProgress.filter(w => w.status === 'missing').length;
                  const confirmedCount = card.weeklyProgress.filter(w => w.status === 'confirmed').length;
                  const partialCount = card.weeklyProgress.filter(w => w.status === 'partial').length;
                  if (gapCount > 0) {
                    return (
                      <span className="font-normal normal-case tracking-normal text-ink/25 ml-1">
                        · {gapCount === 1 ? '1 monitoring gap' : `${gapCount} monitoring gaps`}
                      </span>
                    );
                  }
                  if (partialCount > 0) {
                    return (
                      <span className="font-normal normal-case tracking-normal text-ink/25 ml-1">
                        · {confirmedCount}/{card.weeklyProgress.length} confirmed
                      </span>
                    );
                  }
                  // All confirmed — show trend arrows
                  if (card.weeklyProgress.length > 1) {
                    const first = card.weeklyProgress[0];
                    const last = card.weeklyProgress[card.weeklyProgress.length - 1];
                    const viewsTrend = (last.views7d != null && first.views7d != null) ? (last.views7d > first.views7d ? '↑' : last.views7d < first.views7d ? '↓' : '→') : '→';
                    const subsTrend = (last.subs7d != null && first.subs7d != null) ? (last.subs7d > first.subs7d ? '↑' : last.subs7d < first.subs7d ? '↓' : '→') : '→';
                    return (
                      <span className="font-semibold normal-case tracking-normal text-ink/25 ml-1">
                        — views {viewsTrend} · subs {subsTrend}
                      </span>
                    );
                  }
                  return null;
                })()}
              </button>
              {showWeeks && (
                <div className="mt-1.5 space-y-1">
                  {card.weeklyProgress.map((w) => (
                    <div
                      key={w.week}
                      className="flex items-center gap-3 text-[10px] rounded-md px-2.5 py-1.5"
                      style={{ background: w.status === 'missing' ? 'rgba(14,14,14,0.015)' : 'rgba(14,14,14,0.03)' }}
                    >
                      <span
                        className="font-bold w-[40px] shrink-0"
                        style={{ color: w.status === 'missing' ? 'rgba(14,14,14,0.25)' : 'rgba(14,14,14,0.4)' }}
                      >
                        Wk {w.week}
                      </span>

                      {w.status === 'missing' ? (
                        <span className="text-ink/25 italic font-normal">Monitoring gap</span>
                      ) : w.status === 'partial' ? (
                        <>
                          {w.views7d != null && (
                            <span className="font-bold tabular-nums" style={{ color: w.views7d > 0 ? '#0C6A3F' : w.views7d < 0 ? '#8A1F0C' : 'rgba(14,14,14,0.3)' }}>
                              {w.views7d >= 0 ? '+' : ''}{fmtNum(w.views7d)} views
                            </span>
                          )}
                          {w.subs7d != null && (
                            <span className="font-bold tabular-nums" style={{ color: w.subs7d > 0 ? '#0C6A3F' : w.subs7d < 0 ? '#8A1F0C' : 'rgba(14,14,14,0.3)' }}>
                              {w.subs7d >= 0 ? '+' : ''}{fmtNum(w.subs7d)} subs
                            </span>
                          )}
                          <span className="text-ink/20 italic font-normal">· partial</span>
                        </>
                      ) : (
                        <>
                          <span className="font-bold tabular-nums" style={{ color: w.views7d != null ? (w.views7d > 0 ? '#0C6A3F' : w.views7d < 0 ? '#8A1F0C' : 'rgba(14,14,14,0.3)') : 'rgba(14,14,14,0.25)' }}>
                            {w.views7d != null ? `${w.views7d >= 0 ? '+' : ''}${fmtNum(w.views7d)} views` : '— views'}
                          </span>
                          <span className="text-ink/15">·</span>
                          <span className="font-bold tabular-nums" style={{ color: w.subs7d != null ? (w.subs7d > 0 ? '#0C6A3F' : w.subs7d < 0 ? '#8A1F0C' : 'rgba(14,14,14,0.3)') : 'rgba(14,14,14,0.25)' }}>
                            {w.subs7d != null ? `${w.subs7d >= 0 ? '+' : ''}${fmtNum(w.subs7d)} subs` : '— subs'}
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Expand detail toggle ──────────────────────────────────── */}
      {/* ─── Content Structure Warning ─────────────────────────── */}
      {card.structureWarning && (
        <StructureWarningLine warning={card.structureWarning} />
      )}

      {/* ─── Movement confidence indicator with directional reporting ── */}
      {(card.movementConfidence === 'stale' || card.movementConfidence === 'limited') && (
        <div className="flex items-center gap-1.5 mb-2 mt-1">
          <span
            className="inline-block w-[5px] h-[5px] rounded-full"
            style={{ background: card.movementConfidence === 'stale' ? '#D4A017' : 'rgba(14,14,14,0.2)' }}
          />
          <span className="text-[9px] tracking-[0.04em] text-ink/30 italic">
            {card.movementConfidence === 'stale' && card.lastKnownGoodViews7d != null
              ? `Last confirmed: ${card.lastKnownGoodViews7d > 0 ? '+' : ''}${fmtNum(card.lastKnownGoodViews7d)} views · ${card.lastKnownGoodDaysAgo ?? '?'}d ago`
              : card.movementConfidence === 'stale'
                ? 'Public YouTube totals updating'
                : 'Movement data building — limited history'}
          </span>
        </div>
      )}

      <button
        onClick={() => setShowDetail(!showDetail)}
        className="text-[10px] text-ink/25 hover:text-ink/45 mb-2 transition-colors"
      >
        {showDetail ? 'Hide detail' : 'Show detail'}
      </button>

      {showDetail && (
        <div className="rounded-lg p-4 mb-3" style={{ background: SOFT }}>
          {/* Cadence */}
          <div className="text-[11px] text-ink/40 mb-2">{card.cadenceLine}</div>

          {/* Impact */}
          {card.impact && card.impact.daysSinceTakeover >= 2 && (
            <div className="mt-2 pt-2 text-[10px] text-ink/35" style={{ borderTop: `1px solid rgba(14,14,14,0.06)` }}>
              <span className="font-bold uppercase tracking-[0.08em]">Since takeover ({card.impact.daysSinceTakeover}d):</span>{' '}
              <span className="tabular-nums" style={{ color: card.impact.subsDelta != null ? (card.impact.subsDelta > 0 ? '#0C6A3F' : '#8A1F0C') : 'rgba(14,14,14,0.25)' }}>
                {card.impact.subsDelta != null ? `${card.impact.subsDelta >= 0 ? '+' : ''}${fmtNum(card.impact.subsDelta)} subs` : '— subs'}
              </span>
              {' · '}
              <span className="tabular-nums" style={{ color: card.impact.viewsDelta != null ? (card.impact.viewsDelta > 0 ? '#0C6A3F' : '#8A1F0C') : 'rgba(14,14,14,0.25)' }}>
                {card.impact.viewsDelta != null ? `${card.impact.viewsDelta >= 0 ? '+' : ''}${fmtNum(card.impact.viewsDelta)} views` : '— views'}
              </span>
            </div>
          )}

          {/* Watch */}
          <div className="text-[10px] text-ink/35 mt-2">
            Watch: {read.watch}
          </div>

          {/* Weekly snapshot history */}
          <SnapshotHistory slug={card.slug} />
        </div>
      )}

      {/* ─── Notes ───────────────────────────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${SOFT}` }} className="pt-3">
        {latestNote && (
          <div className="flex items-start gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-ink/50 leading-snug truncate">
                <span className="font-bold text-ink/60">{latestNote.tag ? `${latestNote.tag}: ` : ''}</span>
                {latestNote.text}
              </div>
              <div className="text-[10px] text-ink/25 mt-0.5">{fmtNoteDate(latestNote.createdAt)}</div>
            </div>
            <button
              onClick={() => deleteNote(latestNote.id)}
              className="text-[12px] text-ink/20 hover:text-ink/50 shrink-0"
            >
              &times;
            </button>
          </div>
        )}

        {hasMoreNotes && (
          <div className="mb-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[11px] text-ink/30 hover:text-ink/50"
            >
              {expanded ? 'Hide older notes' : `+${card.notes.length - 1} more`}
            </button>
            {expanded && (
              <div className="mt-2 space-y-1.5">
                {card.notes.slice(1).map((n) => (
                  <div key={n.id} className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] text-ink/40 leading-snug truncate">
                        <span className="font-bold text-ink/50">{n.tag ? `${n.tag}: ` : ''}</span>
                        {n.text}
                      </div>
                      <div className="text-[10px] text-ink/20 mt-0.5">{fmtNoteDate(n.createdAt)}</div>
                    </div>
                    <button
                      onClick={() => deleteNote(n.id)}
                      className="text-[12px] text-ink/20 hover:text-ink/50 shrink-0"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addNote()}
            placeholder="Add a note…"
            className="flex-1 text-[12px] px-2.5 py-1.5 rounded-md border-0 outline-none"
            style={{ background: SOFT, color: INK }}
          />
          {noteInput.trim() && (
            <button
              onClick={addNote}
              disabled={saving}
              className="text-[11px] font-bold px-2.5 py-1.5 rounded-md disabled:opacity-40"
              style={{ background: INK, color: PAPER }}
            >
              {saving ? '…' : 'Add'}
            </button>
          )}
          <button
            onClick={() => setSnapshot(generateSnapshot(card))}
            className="text-[10px] text-ink/25 hover:text-ink/50 shrink-0 transition-colors"
          >
            Report
          </button>
        </div>
      </div>

      {snapshot && <SnapshotModal text={snapshot} onClose={() => setSnapshot(null)} />}
    </div>
  );
}

// ─── Decision section header ────────────────────────────────────────────
function DecisionSectionHeader({
  decision,
  subtitle,
  count,
}: {
  decision: DecisionLabel | 'BUILD' | 'HOLD';
  subtitle: string;
  count: number;
}) {
  const dStyle = decision === 'BUILD'
    ? { bg: '#FFF5D6', fg: '#7A5A00', border: '#E8D590' }
    : decision === 'HOLD'
    ? DECISION_STYLE.HOLD
    : DECISION_STYLE[decision as DecisionLabel];

  return (
    <div className="flex items-center gap-3 mb-4">
      <span
        className="px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-[0.12em]"
        style={{ background: dStyle.bg, color: dStyle.fg, border: `1px solid ${dStyle.border}` }}
      >
        {decision}
      </span>
      <span className="text-[12px] text-ink/40">{subtitle}</span>
      <span className="text-[10px] text-ink/20 tabular-nums">({count})</span>
    </div>
  );
}

// ─── Board ──────────────────────────────────────────────────────────────
export default function CampaignStatusBoard({
  initialCards,
  availableArtists,
}: {
  initialCards: CardData[];
  availableArtists: AvailableArtist[];
}) {
  const [cards, setCards] = useState<CardData[]>(initialCards);
  const [available, setAvailable] = useState<AvailableArtist[]>(availableArtists);
  const [showAdd, setShowAdd] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [snapshotStatus, setSnapshotStatus] = useState<string | null>(null);
  const [snapshotSaving, setSnapshotSaving] = useState(false);
  const [behaviourSlug, setBehaviourSlug] = useState<string | null>(null);

  async function handlePin(slug: string) {
    setPinning(true);
    try {
      await fetch('/api/active-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      window.location.reload();
    } finally {
      setPinning(false);
    }
  }

  async function handleUnpin(slug: string) {
    await fetch(`/api/active-campaigns?slug=${slug}`, { method: 'DELETE' });
    const removed = cards.find((c) => c.slug === slug);
    setCards((prev) => prev.filter((c) => c.slug !== slug));
    if (removed) setAvailable((prev) => [...prev, { slug: removed.slug, name: removed.name }]);
  }

  function handleNotesChange(slug: string, notes: CampaignNote[]) {
    setCards((prev) => prev.map((c) => (c.slug === slug ? { ...c, notes } : c)));
  }

  async function handleSaveSnapshot() {
    setSnapshotSaving(true);
    setSnapshotStatus(null);
    try {
      const res = await fetch('/api/weekly-snapshots', { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        setSnapshotStatus(`Error: ${data.error}`);
      } else {
        setSnapshotStatus(
          `${data.captured} captured · ${data.skipped} skipped${data.errors?.length ? ` · ${data.errors.length} errors` : ''} (${data.weekId})`
        );
      }
    } catch (e: any) {
      setSnapshotStatus(`Error: ${e?.message ?? 'Failed'}`);
    } finally {
      setSnapshotSaving(false);
      setTimeout(() => setSnapshotStatus(null), 8000);
    }
  }

  // ─── Group cards by Growth OS decision ─────────────────────────────
  const pushCards: CardData[] = [];
  const fixCards: CardData[] = [];
  const buildCards: CardData[] = [];
  const holdCards: CardData[] = [];
  const dormant: CardData[] = [];

  for (const card of cards) {
    if (card.boardStatus === 'COLD') {
      dormant.push(card);
      continue;
    }
    const read = getGrowthRead(card);
    switch (read.decision) {
      case 'PUSH': pushCards.push(card); break;
      case 'FIX': fixCards.push(card); break;
      case 'HOLD': holdCards.push(card); break;
    }
  }

  // Within each section, sort by priority then by views (highest first)
  const sortByPriorityAndViews = (a: CardData, b: CardData) => {
    if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
    return (b.views7Delta ?? 0) - (a.views7Delta ?? 0);
  };
  pushCards.sort(sortByPriorityAndViews);
  fixCards.sort(sortByPriorityAndViews);
  buildCards.sort(sortByPriorityAndViews);
  holdCards.sort(sortByPriorityAndViews);

  // ─── Behaviour view ────────────────────────────────────────────
  const behaviourCard = behaviourSlug ? cards.find((c) => c.slug === behaviourSlug) : null;
  if (behaviourSlug && behaviourCard) {
    return (
      <CampaignBehaviour
        slug={behaviourSlug}
        artistName={behaviourCard.name}
        onClose={() => setBehaviourSlug(null)}
      />
    );
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
        {!showAdd ? (
          <button
            onClick={() => setShowAdd(true)}
            className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/30 hover:text-ink/60 transition-colors"
          >
            + Add campaign
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <select
              className="rounded-lg border px-3 py-2 text-[13px] outline-none"
              style={{ borderColor: MUTED, background: SOFT }}
              defaultValue=""
              onChange={(e) => { if (e.target.value) handlePin(e.target.value); }}
              disabled={pinning}
            >
              <option value="" disabled>
                {available.length === 0 ? 'All artists already added' : 'Select an artist…'}
              </option>
              {available.map((a) => (
                <option key={a.slug} value={a.slug}>{a.name}</option>
              ))}
            </select>
            <button onClick={() => setShowAdd(false)} className="text-[12px] text-ink/30 hover:text-ink/50">
              Cancel
            </button>
          </div>
        )}
        </div>
        <div className="flex items-center gap-3">
          {snapshotStatus && (
            <span className="text-[10px] text-ink/40">{snapshotStatus}</span>
          )}
          <button
            onClick={handleSaveSnapshot}
            disabled={snapshotSaving}
            className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink/25 hover:text-ink/50 transition-colors disabled:opacity-40"
          >
            {snapshotSaving ? 'Saving…' : 'Save Weekly Snapshot'}
          </button>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-2xl p-16 text-center" style={{ background: SOFT }}>
          <div className="text-[15px] font-bold mb-1">No campaigns yet</div>
          <div className="text-[13px] text-ink/40">Add artists to start tracking campaign status.</div>
        </div>
      ) : (
        <div className="space-y-10">
          {/* ─── Weekly YouTube Read ────────────────────────────────── */}
          <WeeklySummary cards={cards} />

          {/* ─── PUSH — Strong performance, ready to scale ──────────── */}
          {pushCards.length > 0 && (
            <div>
              <DecisionSectionHeader decision="PUSH" subtitle="Strong performance — ready to scale" count={pushCards.length} />
              <SectionIssueNote cards={pushCards} />
              <div className="space-y-4">
                {pushCards.map((card) => (
                  <DecisionCard
                    key={card.slug}
                    card={card}
                    onUnpin={handleUnpin}
                    onNotesChange={handleNotesChange}
                    onViewBehaviour={setBehaviourSlug}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ─── FIX — High reach, weak conversion ──────────────────── */}
          {fixCards.length > 0 && (
            <div>
              <DecisionSectionHeader decision="FIX" subtitle="High reach but weak conversion" count={fixCards.length} />
              <SectionIssueNote cards={fixCards} />
              <div className="space-y-4">
                {fixCards.map((card) => (
                  <DecisionCard
                    key={card.slug}
                    card={card}
                    onUnpin={handleUnpin}
                    onNotesChange={handleNotesChange}
                    onViewBehaviour={setBehaviourSlug}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ─── BUILD — Early signal or underfed ───────────────────── */}
          {buildCards.length > 0 && (
            <div>
              <DecisionSectionHeader decision="BUILD" subtitle="Early signal or underfed channel" count={buildCards.length} />
              <SectionIssueNote cards={buildCards} />
              <div className="space-y-4">
                {buildCards.map((card) => (
                  <DecisionCard
                    key={card.slug}
                    card={card}
                    onUnpin={handleUnpin}
                    onNotesChange={handleNotesChange}
                    onViewBehaviour={setBehaviourSlug}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ─── HOLD — No clear signal or inactive ─────────────────── */}
          {holdCards.length > 0 && (
            <div>
              <DecisionSectionHeader decision="HOLD" subtitle="No clear signal — waiting" count={holdCards.length} />
              <div className="space-y-4">
                {holdCards.map((card) => (
                  <DecisionCard
                    key={card.slug}
                    card={card}
                    onUnpin={handleUnpin}
                    onNotesChange={handleNotesChange}
                    onViewBehaviour={setBehaviourSlug}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ─── Dormant / Cold (collapsed) ─────────────────────────── */}
          {dormant.length > 0 && (
            <DormantBlock cards={dormant} />
          )}
        </div>
      )}
    </>
  );
}
