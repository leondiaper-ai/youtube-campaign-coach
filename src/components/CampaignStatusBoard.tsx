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
  type DecisionLabel,
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
};

// ─── Growth OS bridge ──────────────────────────────────────────────────────
// All state/diagnosis/action logic now lives in /lib/youtubeGrowthOS.ts.
// This bridge converts CardData → GrowthInput → GrowthRead for rendering.

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

/** Is this an active campaign card (PUSH/FIX) vs early/building (HOLD)? */
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
  // Compare calendar dates, not raw ms
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((nDay.getTime() - dDay.getTime()) / 86400000);
  if (diffDays === 0) return `today · ${dateStr}`;
  if (diffDays === 1) return `yesterday · ${dateStr}`;
  if (diffDays < 7) return `${diffDays}d ago · ${dateStr}`;
  return dateStr;
}

// Status/spark styles now come from Growth OS (GOS_STATE_STYLE, GOS_SPARK_STYLE).
// Bridge helper to map ChannelState → GrowthState for style lookup:
function gsFor(cs: ChannelState) { return channelStateToGrowthState(cs); }

function deltaColor(v: number | null): string {
  if (v == null) return 'rgba(14,14,14,0.25)';
  if (v > 0) return '#0C6A3F';
  if (v < 0) return '#8A1F0C';
  return 'rgba(14,14,14,0.4)';
}

/** Flag weak conversion: views strong but subs flat/negative */
function subsIsWeak(card: CardData): boolean {
  return (
    card.views7Delta != null &&
    card.views7Delta > 5000 &&
    (card.subs7Delta == null || card.subs7Delta <= 0)
  );
}

// ─── Snapshot generator (powered by Growth OS) ─────────────────────────────
function generateSnapshot(card: CardData): string {
  const read = getGrowthRead(card);

  // Append impact + notes context to the Slack copy
  const impactLines: string[] = [];
  if (card.impact && card.impact.daysSinceTakeover >= 2) {
    impactLines.push(
      '',
      `SINCE TAKEOVER (${card.impact.daysSinceTakeover} days)`,
      `${card.impact.subsDelta >= 0 ? '+' : ''}${fmtNum(card.impact.subsDelta)} subs`,
      `${card.impact.viewsDelta >= 0 ? '+' : ''}${fmtNum(card.impact.viewsDelta)} views`,
    );
    if (card.impact.stateAtStart !== card.impact.stateNow) {
      impactLines.push(`${card.impact.stateAtStart} → ${card.impact.stateNow}`);
    }
  }

  const latestNote = card.notes.length > 0 ? card.notes[0] : null;
  const contextLine = latestNote
    ? `${latestNote.tag ? `${latestNote.tag}: ` : ''}${latestNote.text}`
    : '';

  return [
    read.slackCopy,
    ...impactLines,
    ...(contextLine ? ['', 'CONTEXT:', `- ${contextLine}`] : []),
  ].join('\n');
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

// ─── Decision Card ──────────────────────────────────────────────────────────
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
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const gs = gsFor(card.boardStatus);
  const style = GOS_STATE_STYLE[gs];
  const weak = subsIsWeak(card);
  const read = getGrowthRead(card);
  const dStyle = DECISION_STYLE[read.decision];

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

      {/* ─── A. Decision label + confidence ─────────────────────────── */}
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

      {/* ─── B. Artist name + state / sub-state ──────────────────────── */}
      <div className="mb-4">
        <h2 className="font-black text-[20px] leading-tight">{card.name}</h2>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[12px] font-black uppercase tracking-[0.1em]" style={{ color: dStyle.fg }}>
            {read.state.replace('_', ' ')}
          </span>
          <span className="text-[10px] text-ink/25">·</span>
          <span className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: `${dStyle.fg}99` }}>
            {read.subState.replace(/_/g, ' ')}
          </span>
        </div>
        {card.campaign && (
          <div className="text-[11px] text-ink/35 mt-0.5">{card.campaign}</div>
        )}
      </div>

      {/* ─── C. Key metrics + sparkline ───────────────────────────────── */}
      <div className="flex items-end gap-8 mb-3">
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
            style={{
              color: weak ? '#8A1F0C' : deltaColor(card.subs7Delta),
            }}
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
        <div className="ml-auto rounded-lg px-3 py-2" style={{ background: GOS_SPARK_STYLE[gs].fill }}>
          <Sparkline
            data={card.sparkline}
            width={140}
            height={44}
            stroke={GOS_SPARK_STYLE[gs].stroke}
            fill={GOS_SPARK_STYLE[gs].fill}
          />
          <div className="text-[9px] text-right mt-1 uppercase tracking-wider font-bold" style={{ color: GOS_SPARK_STYLE[gs].stroke }}>
            30d trend
          </div>
        </div>
      </div>

      {/* ─── Cadence line ─────────────────────────────────────────────── */}
      <div className="text-[11px] text-ink/40 mb-4">{card.cadenceLine}</div>

      {/* ─── Impact strip (since takeover) ────────────────────────────── */}
      {card.impact && card.impact.daysSinceTakeover >= 2 && (
        <div className="rounded-lg px-4 py-3 mb-4 flex items-center gap-5" style={{ background: '#F0F7FF', border: '1px solid #D6E8FA' }}>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] shrink-0" style={{ color: '#4A7AB5' }}>
            Since takeover
            <span className="font-normal ml-1" style={{ color: '#4A7AB599' }}>
              {card.impact.daysSinceTakeover}d
            </span>
          </div>
          <div className="flex items-center gap-4 text-[12px] font-bold tabular-nums">
            <span style={{ color: card.impact.subsDelta >= 0 ? '#0C6A3F' : '#8A1F0C' }}>
              {card.impact.subsDelta >= 0 ? '+' : ''}{fmtNum(card.impact.subsDelta)} subs
            </span>
            <span style={{ color: card.impact.viewsDelta >= 0 ? '#0C6A3F' : '#8A1F0C' }}>
              {card.impact.viewsDelta >= 0 ? '+' : ''}{fmtNum(card.impact.viewsDelta)} views
            </span>
          </div>
          {card.impact.stateAtStart !== card.impact.stateNow && (
            <div className="ml-auto text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: '#4A7AB5' }}>
              {card.impact.stateAtStart} → {card.impact.stateNow}
            </div>
          )}
        </div>
      )}

      {/* ─── D. Decision block (powered by Growth OS) ──────────────── */}
      <div className="rounded-lg p-4 mb-4" style={{ background: isFix ? dStyle.bg : SOFT }}>
        {/* Signal */}
        <div className="text-[13px] font-semibold text-ink/80 leading-snug mb-3">
          {read.signal}
        </div>

        {/* Blocker */}
        {read.blocker.blocker !== 'NONE' && (
          <div className="text-[11px] text-ink/55 leading-snug mb-4">
            <span className="font-bold text-ink/60">Blocker:</span> {read.blocker.label} — {read.blocker.description}
          </div>
        )}

        {/* This week — execution plan */}
        <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink/35 mb-1.5">This week</div>
        <div className="space-y-1">
          {read.actions.doNow.map((step, i) => (
            <div key={i} className="text-[12px] font-medium leading-snug flex gap-2">
              <span style={{ color: dStyle.fg }} className="shrink-0">→</span>
              <span>{step}</span>
            </div>
          ))}
        </div>

        {/* Next campaign move */}
        {read.nextCampaignMove && (
          <div className="text-[11px] text-ink/40 leading-snug mt-2.5 pl-4">
            Next: {read.nextCampaignMove}
          </div>
        )}
      </div>

      {/* ─── E. Watch metric ─────────────────────────────────────────── */}
      <div className="text-[11px] text-ink/40 leading-snug mb-4">
        Watch: {read.watch}
      </div>

      {/* ─── F. Notes ─────────────────────────────────────────────────── */}
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
            Generate Snapshot
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
        // Split cards into active vs building/early based on decision
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
        // Sort active: FIX first, then PUSH, then by priority
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
