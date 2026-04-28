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
import Sparkline from './Sparkline';

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const MUTED = '#E9E2D3';

type ImpactData = {
  daysSinceTakeover: number;
  subsDelta: number;
  viewsDelta: number;
  uploadsShipped: number;
  stateAtStart: string;
  stateNow: string;
};

type CampaignWindowData = {
  campaignName: string;
  campaignDay: number;
  contentViews: number;
  channelViewsDelta: number;
  subsGained: number;
  contentMix: { uploads: number; shorts: number; videos: number };
};

type CampaignTrendData = {
  currentWeekViews: number;
  previousWeekViews: number;
  bestWeekViews: number;
  bestWeekNumber: number;
  totalCampaignViews: number;
  totalCampaignSubs: number;
};

type WeeklyProgressEntry = {
  week: number;
  views7d: number;
  subs7d: number;
  channelHealth: string;
  campaignSignal: string;
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
  notes: CampaignNote[];
  impact: ImpactData | null;
  campaignWindow: CampaignWindowData | null;
  campaignTrend: CampaignTrendData | null;
  weeklyProgress: WeeklyProgressEntry[];
  channelHealth: string;
  campaignSignal: string;
  campaignSignalLabel: string;
};

// ─── Growth OS bridge ──────────────────────────────────────────────────────

function cardToGrowthInput(card: CardData): GrowthInput {
  const daysSince = card.cadenceLine.startsWith('No recent') ? 31
    : card.boardStatus === 'COLD' ? 60 : 7;
  return {
    subscribers: undefined,
    views7d: card.views7Delta,
    subscribers7d: card.subs7Delta,
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

function isActiveCampaign(read: GrowthRead, card: CardData): boolean {
  if (read.decision === 'PUSH' || read.decision === 'FIX') return true;
  if (card.campaign && (card.views7Delta != null || card.subs7Delta != null)) return true;
  return false;
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

function subsIsWeak(card: CardData): boolean {
  return (
    card.views7Delta != null &&
    card.views7Delta > 5000 &&
    (card.subs7Delta == null || card.subs7Delta <= 0)
  );
}

// ─── Conversion metric ───────────────────────────────────────────────────
function subsPerKViews(card: CardData): number | null {
  if (card.views7Delta == null || card.views7Delta <= 0) return null;
  const subs = card.subs7Delta ?? 0;
  return (subs / card.views7Delta) * 1000;
}

// ─── Conversion diagnosis one-liner ──────────────────────────────────────
function conversionDiagnosis(card: CardData): string | null {
  const spk = subsPerKViews(card);
  if (spk == null) return null;
  if (spk >= 3) return 'Converting well — demand and retention aligned';
  if (spk >= 1.5) return 'Moderate conversion — room to improve retention';
  if (card.views7Delta != null && card.views7Delta > 50000 && spk < 0.5) return 'Failing to capture demand';
  if (card.views7Delta != null && card.views7Delta > 5000 && spk < 1) return 'Demand high, retention low';
  return 'Low conversion — not enough signal yet';
}

// ─── Sharper read copy ───────────────────────────────────────────────────
function sharpenRead(read: GrowthRead, card: CardData): { primary: string; secondary: string | null } {
  const weak = subsIsWeak(card);
  if (weak) {
    return {
      primary: 'People are watching, but not subscribing.',
      secondary: 'Cadence is strong — problem is packaging, not volume.',
    };
  }
  // Signal is already good from Growth OS, just return it
  return { primary: read.signal, secondary: null };
}

// ─── Momentum one-liner ──────────────────────────────────────────────────
function momentumLine(ct: CampaignTrendData): string {
  const curr = fmtNum(ct.currentWeekViews);
  const prev = ct.previousWeekViews > 0 ? fmtNum(ct.previousWeekViews) : null;
  const total = fmtNum(ct.totalCampaignViews);
  const arrow = ct.currentWeekViews > ct.previousWeekViews ? '↑' :
                ct.currentWeekViews < ct.previousWeekViews ? '↓' : '→';
  if (prev) {
    return `${curr} this week (${arrow} vs ${prev} last week) · ${total} total`;
  }
  return `${curr} this week · ${total} total`;
}

// ─── Weekly summary one-liner ────────────────────────────────────────────
function weeklySummaryLine(entries: WeeklyProgressEntry[]): string | null {
  if (entries.length < 2) return null;
  const prev = entries[entries.length - 2];
  const curr = entries[entries.length - 1];
  const viewsDir = curr.views7d > prev.views7d ? 'growth ↑' : curr.views7d < prev.views7d ? 'growth ↓' : 'views flat';
  const subsDir = curr.subs7d > prev.subs7d ? 'conversion ↑' : curr.subs7d > 0 ? 'conversion steady' : 'conversion flat';
  return `${fmtNum(prev.views7d)} → ${fmtNum(curr.views7d)} (${viewsDir}, ${subsDir})`;
}

// ─── Campaign Progress Report generator (full detail for export) ────────
function generateSnapshot(card: CardData): string {
  const read = getGrowthRead(card);
  const cw = card.campaignWindow;
  const ct = card.campaignTrend;
  const hasCampaign = !!cw;

  const lines: string[] = [];

  // Header
  if (hasCampaign) {
    lines.push(`CAMPAIGN PROGRESS REPORT — ${card.name.toUpperCase()}`);
    lines.push(`Campaign: ${cw!.campaignName} · Day ${cw!.campaignDay}`);
    lines.push(`Channel Health: ${card.channelHealth} · Campaign Signal: ${card.campaignSignalLabel}`);
  } else {
    lines.push(`YOUTUBE GROWTH READ — ${card.name.toUpperCase()}`);
    lines.push(`Channel Health: ${card.channelHealth}`);
  }

  // Conversion metric
  const spk = subsPerKViews(card);
  if (spk != null) {
    lines.push(`Subs / 1K views: ${spk.toFixed(1)} (target: 2+)`);
  }

  // 1. Current week
  lines.push('', '1. CURRENT WEEK');
  lines.push(`Views (7d): ${card.views7Delta != null ? `${card.views7Delta >= 0 ? '+' : ''}${fmtNum(card.views7Delta)}` : '—'}`);
  lines.push(`Subs (7d): ${card.subs7Delta != null ? `${card.subs7Delta >= 0 ? '+' : ''}${fmtNum(card.subs7Delta)}` : '—'}`);
  lines.push(`Uploads (30d): ${card.uploads30d}`);
  lines.push(`Shorts (30d): ${card.shorts30d}`);
  lines.push(`Cadence: ${card.cadenceLine}`);

  // 2. Campaign so far
  if (hasCampaign && cw && ct) {
    lines.push('', '2. CAMPAIGN SO FAR');
    lines.push(`Campaign views: ${fmtNum(ct.totalCampaignViews)}`);
    lines.push(`Campaign subs: ${ct.totalCampaignSubs >= 0 ? '+' : ''}${fmtNum(ct.totalCampaignSubs)}`);
    lines.push(`Campaign uploads: ${cw.contentMix.uploads} (${cw.contentMix.shorts} Shorts · ${cw.contentMix.videos} videos)`);
    lines.push(`Content views: ${fmtNum(cw.contentViews)}`);
    if (ct.bestWeekViews > 0) {
      lines.push(`Best week: Week ${ct.bestWeekNumber} (${fmtNum(ct.bestWeekViews)} views)`);
    }
    lines.push(`Momentum: ${momentumLine(ct)}`);
  }

  // Weekly progress (full detail in report)
  if (card.weeklyProgress.length > 0) {
    lines.push('', 'WEEKLY PROGRESS:');
    for (const w of card.weeklyProgress) {
      lines.push(`Week ${w.week}: ${w.views7d >= 0 ? '+' : ''}${fmtNum(w.views7d)} views · ${w.subs7d >= 0 ? '+' : ''}${fmtNum(w.subs7d)} subs · ${w.campaignSignal}`);
    }
  }

  // 3. Read
  lines.push('', `${hasCampaign ? '3' : '2'}. READ`);
  const sharp = sharpenRead(read, card);
  lines.push(sharp.primary);
  if (sharp.secondary) lines.push(sharp.secondary);
  const diag = conversionDiagnosis(card);
  if (diag) lines.push(`Conversion status: ${diag}`);

  if (read.blocker.blocker !== 'NONE') {
    lines.push(`Blocker: ${read.blocker.label} — ${read.blocker.description}`);
  }

  // 4. Action this week
  lines.push('', `${hasCampaign ? '4' : '3'}. ACTION THIS WEEK`);
  read.actions.doNow.forEach((a) => lines.push(`→ ${a}`));

  // 5. Watch next
  lines.push('', `${hasCampaign ? '5' : '4'}. WATCH NEXT`);
  lines.push(read.watch);

  // Impact strip
  if (card.impact && card.impact.daysSinceTakeover >= 2) {
    lines.push('', `SINCE TAKEOVER (${card.impact.daysSinceTakeover} days)`);
    lines.push(`${card.impact.subsDelta >= 0 ? '+' : ''}${fmtNum(card.impact.subsDelta)} subs`);
    lines.push(`${card.impact.viewsDelta >= 0 ? '+' : ''}${fmtNum(card.impact.viewsDelta)} views`);
    if (card.impact.stateAtStart !== card.impact.stateNow) {
      lines.push(`${card.impact.stateAtStart} → ${card.impact.stateNow}`);
    }
  }

  // Context note
  const latestNote = card.notes.length > 0 ? card.notes[0] : null;
  if (latestNote) {
    lines.push('', 'CONTEXT:');
    lines.push(`- ${latestNote.tag ? `${latestNote.tag}: ` : ''}${latestNote.text}`);
  }

  return lines.join('\n');
}

// ─── Snapshot Modal ─────────────────────────────────────────────────────────
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
          className="self-end text-[11px] font-bold uppercase tracking-[0.12em] px-4 py-2 rounded-lg transition-all"
          style={{ background: copied ? '#E6F8EE' : INK, color: copied ? '#0C6A3F' : PAPER }}
        >
          {copied ? 'Copied' : 'Copy to clipboard'}
        </button>
      </div>
    </div>
  );
}

// ─── Decision Card (compressed, decision-surface layout) ───────────────────
function DecisionCard({
  card,
  onUnpin,
  onNotesChange,
}: {
  card: CardData;
  onUnpin: (slug: string) => void;
  onNotesChange: (slug: string, notes: CampaignNote[]) => void;
}) {
  const [noteInput, setNoteInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showWeekly, setShowWeekly] = useState(false);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const gs = gsFor(card.boardStatus);
  const weak = subsIsWeak(card);
  const read = getGrowthRead(card);
  const dStyle = DECISION_STYLE[read.decision];
  const spk = subsPerKViews(card);
  const sharp = sharpenRead(read, card);
  const diag = conversionDiagnosis(card);
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

  const isFix = read.decision === 'FIX';
  const cardBorder = isFix ? dStyle.border : MUTED;

  return (
    <div
      className="rounded-2xl p-6 relative group"
      style={{
        background: '#FFFFFF',
        border: `${isFix ? '2px' : '1px'} solid ${cardBorder}`,
        boxShadow: isFix ? `0 0 0 1px ${dStyle.border}40` : undefined,
      }}
    >
      {/* Remove — hover only */}
      <button
        onClick={() => onUnpin(card.slug)}
        className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-[14px] text-ink/0 group-hover:text-ink/25 hover:!text-ink/50 hover:bg-black/5 transition-all"
        title="Remove"
      >
        &times;
      </button>

      {/* ─── 1. Artist name + state ─────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-[0.12em]"
          style={{ background: dStyle.bg, color: dStyle.fg, border: `1px solid ${dStyle.border}` }}
        >
          {read.decision}
        </span>
        {read.showConfidence && (
          <span className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: `${dStyle.fg}99` }}>
            {read.confidence} confidence
          </span>
        )}
      </div>

      <div className="mb-4">
        <h2 className="font-black text-[20px] leading-tight">{card.name}</h2>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[11px] font-black uppercase tracking-[0.1em]" style={{ color: dStyle.fg }}>
            {card.channelHealth} channel
          </span>
          {card.campaignSignal !== 'NO_CAMPAIGN' && (
            <>
              <span className="text-[10px] text-ink/25">·</span>
              <span
                className="text-[11px] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded"
                style={{
                  background: CAMPAIGN_SIGNAL_STYLE[card.campaignSignal as CampaignSignal]?.bg ?? SOFT,
                  color: CAMPAIGN_SIGNAL_STYLE[card.campaignSignal as CampaignSignal]?.fg ?? INK,
                }}
              >
                {card.campaignSignalLabel} campaign
              </span>
            </>
          )}
        </div>
      </div>

      {/* ─── 2. Views vs subs (headline numbers) + sparkline ────────── */}
      <div className="flex items-end gap-6 mb-2">
        <div>
          <div
            className="text-[32px] font-black leading-none tabular-nums"
            style={{ color: deltaColor(card.views7Delta) }}
          >
            {card.views7Delta != null
              ? `${card.views7Delta >= 0 ? '+' : ''}${fmtNum(card.views7Delta)}`
              : '—'}
          </div>
          <div className="text-[11px] text-ink/35 mt-1 uppercase tracking-[0.1em] font-bold">
            7d views
          </div>
        </div>
        <div>
          <div
            className="text-[32px] font-black leading-none tabular-nums"
            style={{ color: weak ? '#8A1F0C' : deltaColor(card.subs7Delta) }}
          >
            {card.subs7Delta != null
              ? `${card.subs7Delta >= 0 ? '+' : ''}${fmtNum(card.subs7Delta)}`
              : '—'}
          </div>
          <div className="text-[11px] mt-1 uppercase tracking-[0.1em] font-bold" style={{
            color: weak ? '#8A1F0C' : 'rgba(14,14,14,0.35)',
          }}>
            7d subs{weak ? ' ⚠' : ''}
          </div>
        </div>

        {/* ─── 3. Conversion metric ──────────────────────────────────── */}
        {spk != null && (
          <div className="ml-1">
            <div
              className="text-[20px] font-black leading-none tabular-nums"
              style={{ color: spk >= 2 ? '#0C6A3F' : spk >= 1 ? '#7A5A00' : '#8A1F0C' }}
            >
              {spk.toFixed(1)}
            </div>
            <div className="text-[9px] mt-1 uppercase tracking-[0.1em] font-bold" style={{
              color: spk >= 2 ? '#0C6A3F' : spk >= 1 ? '#7A5A00' : '#8A1F0C',
            }}>
              subs / 1K views
            </div>
          </div>
        )}

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

      {/* ─── Cadence line (single, no content mix) ───────────────────── */}
      <div className="text-[11px] text-ink/40 mb-3">{card.cadenceLine}</div>

      {/* ─── 4. Campaign window (compact) ────────────────────────────── */}
      {cw && (
        <div className="rounded-lg px-4 py-2.5 mb-3 flex items-center gap-4 flex-wrap" style={{ background: '#F0F4FF', border: '1px solid #D6DFFA' }}>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#2C6BFF' }} />
            <span className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: '#3B5998' }}>
              Day {cw.campaignDay}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[12px] font-bold tabular-nums">
            <span title="Content views">{fmtNum(cw.contentViews)} <span className="text-[10px] text-ink/35 font-normal">content</span></span>
            <span style={{ color: cw.channelViewsDelta >= 0 ? '#0C6A3F' : '#8A1F0C' }} title="Channel views delta">
              {cw.channelViewsDelta >= 0 ? '+' : ''}{fmtNum(cw.channelViewsDelta)} <span className="text-[10px] font-normal" style={{ color: 'rgba(14,14,14,0.35)' }}>ch. views</span>
            </span>
            <span style={{ color: cw.subsGained > 0 ? '#0C6A3F' : cw.subsGained < 0 ? '#8A1F0C' : undefined }} title="Subs gained">
              {cw.subsGained >= 0 ? '+' : ''}{fmtNum(cw.subsGained)} <span className="text-[10px] font-normal" style={{ color: 'rgba(14,14,14,0.35)' }}>subs</span>
            </span>
            <span className="text-ink/50" title="Content mix">{cw.contentMix.uploads} uploads</span>
          </div>
        </div>
      )}

      {/* ─── 5. Momentum (single condensed line) ─────────────────────── */}
      {ct && ct.currentWeekViews > 0 && (
        <div className="text-[11px] text-ink/50 mb-1.5 flex items-center gap-1.5">
          <span className="font-bold text-ink/40 uppercase tracking-[0.08em] text-[9px]">Momentum:</span>
          <span className="tabular-nums">{momentumLine(ct)}</span>
        </div>
      )}

      {/* ─── Weekly summary (single line + toggle) ───────────────────── */}
      {card.weeklyProgress.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-2 text-[11px]">
            {weeklySummaryLine(card.weeklyProgress) && (
              <span className="text-ink/40">
                <span className="font-bold text-ink/40 uppercase tracking-[0.08em] text-[9px]">Weekly:</span>{' '}
                <span className="tabular-nums">{weeklySummaryLine(card.weeklyProgress)}</span>
              </span>
            )}
            {card.weeklyProgress.length > 1 && (
              <button
                onClick={() => setShowWeekly(!showWeekly)}
                className="text-[10px] text-ink/25 hover:text-ink/50 shrink-0"
              >
                {showWeekly ? 'hide' : `${card.weeklyProgress.length} weeks ›`}
              </button>
            )}
          </div>
          {showWeekly && (
            <div className="mt-2 space-y-1">
              {card.weeklyProgress.map((w) => (
                <div
                  key={w.week}
                  className="flex items-center gap-3 text-[11px] rounded-md px-3 py-1.5"
                  style={{ background: SOFT }}
                >
                  <span className="font-bold text-ink/50 w-[48px] shrink-0">Week {w.week}</span>
                  <span className="font-bold tabular-nums" style={{ color: w.views7d > 0 ? '#0C6A3F' : w.views7d < 0 ? '#8A1F0C' : 'rgba(14,14,14,0.4)' }}>
                    {w.views7d >= 0 ? '+' : ''}{fmtNum(w.views7d)} views
                  </span>
                  <span className="text-ink/25">·</span>
                  <span className="font-bold tabular-nums" style={{ color: w.subs7d > 0 ? '#0C6A3F' : w.subs7d < 0 ? '#8A1F0C' : 'rgba(14,14,14,0.4)' }}>
                    {w.subs7d >= 0 ? '+' : ''}{fmtNum(w.subs7d)} subs
                  </span>
                  <span className="text-ink/25">·</span>
                  <span className="text-[10px] text-ink/40">{w.campaignSignal}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── 6. Conversion diagnosis ─────────────────────────────────── */}
      {diag && (
        <div className="text-[11px] mb-3 flex items-center gap-1.5">
          <span className="font-bold uppercase tracking-[0.08em] text-[9px]" style={{
            color: spk != null && spk >= 2 ? '#0C6A3F' : '#8A4A1A',
          }}>Conversion:</span>
          <span style={{ color: spk != null && spk >= 2 ? '#0C6A3F' : '#6B4E30' }}>{diag}</span>
        </div>
      )}

      {/* ─── 7. Decision block: read + actions ─────────────────────────── */}
      <div className="rounded-lg p-4 mb-3" style={{ background: isFix ? dStyle.bg : SOFT }}>
        {/* Sharpened read */}
        <div className="text-[13px] font-semibold text-ink/80 leading-snug mb-1">
          {sharp.primary}
        </div>
        {sharp.secondary && (
          <div className="text-[12px] text-ink/50 leading-snug mb-3">
            {sharp.secondary}
          </div>
        )}

        {/* This week — max 2 actions */}
        <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink/35 mb-1.5">This week</div>
        <div className="space-y-1">
          {read.actions.doNow.map((step, i) => (
            <div key={i} className="text-[12px] font-medium leading-snug flex gap-2">
              <span style={{ color: dStyle.fg }} className="shrink-0">→</span>
              <span>{step}</span>
            </div>
          ))}
        </div>

        {read.nextCampaignMove && (
          <div className="text-[11px] text-ink/40 leading-snug mt-2 pl-4">
            Next: {read.nextCampaignMove}
          </div>
        )}
      </div>

      {/* ─── Watch metric ─────────────────────────────────────────────── */}
      <div className="text-[11px] text-ink/40 leading-snug mb-3">
        Watch: {read.watch}
      </div>

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
            {cw ? 'Generate Campaign Report' : 'Generate Snapshot'}
          </button>
        </div>
      </div>

      {snapshot && <SnapshotModal text={snapshot} onClose={() => setSnapshot(null)} />}
    </div>
  );
}

// ─── Board ──────────────────────────────────────────────────────────────────
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

  return (
    <>
      <div className="mb-8">
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

      {cards.length === 0 ? (
        <div className="rounded-2xl p-16 text-center" style={{ background: SOFT }}>
          <div className="text-[15px] font-bold mb-1">No campaigns yet</div>
          <div className="text-[13px] text-ink/40">Add artists to start tracking campaign status.</div>
        </div>
      ) : (() => {
        const active: CardData[] = [];
        const building: CardData[] = [];
        for (const card of cards) {
          const r = getGrowthRead(card);
          if (isActiveCampaign(r, card)) {
            active.push(card);
          } else {
            building.push(card);
          }
        }
        active.sort((a, b) => {
          const rA = getGrowthRead(a);
          const rB = getGrowthRead(b);
          const order: Record<DecisionLabel, number> = { FIX: 0, PUSH: 1, HOLD: 2 };
          if (order[rA.decision] !== order[rB.decision]) return order[rA.decision] - order[rB.decision];
          if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
          return 0;
        });

        return (
          <div className="space-y-8">
            {active.length > 0 && (
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] mb-4" style={{ color: INK }}>
                  Active Campaigns
                </div>
                <div className="space-y-5">
                  {active.map((card) => (
                    <DecisionCard
                      key={card.slug}
                      card={card}
                      onUnpin={handleUnpin}
                      onNotesChange={handleNotesChange}
                    />
                  ))}
                </div>
              </div>
            )}
            {building.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/30 mb-4">
                  Building / Early
                </div>
                <div className="space-y-5">
                  {building.map((card) => (
                    <DecisionCard
                      key={card.slug}
                      card={card}
                      onUnpin={handleUnpin}
                      onNotesChange={handleNotesChange}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </>
  );
}
