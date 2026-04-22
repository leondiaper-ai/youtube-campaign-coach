'use client';

import { useState } from 'react';
import { fmtNum, STATUS_COLOR, type ChannelState } from '@/lib/artists';
import type { CampaignNote } from '@/lib/campaignStore';
import Sparkline from './Sparkline';

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const MUTED = '#E9E2D3';

type CardData = {
  slug: string;
  name: string;
  campaign?: string;
  pinnedAt: string;
  priority: 'high' | 'normal';
  subs7Delta: number | null;
  views7Delta: number | null;
  boardStatus: ChannelState;
  diagnosis: string;
  actions: string[];
  cadenceLine: string;
  sparkline: { x: number; y: number }[];
  notes: CampaignNote[];
};

// ─── Decision Engine ───────────────────────────────────────────────────────
type DecisionLabel = 'PUSH' | 'FIX' | 'HOLD';
type Confidence = 'LOW' | 'MED' | 'HIGH';

type BoardDecision = {
  label: DecisionLabel;
  confidence: Confidence;
  stateLine: string;
  insight: string;
  cause: string;
  effect: string;
  action: string;
  secondary: string | null;
};

/** Map channel state + metrics → PUSH / FIX / HOLD with confidence */
function deriveDecision(card: CardData): BoardDecision {
  const { boardStatus, views7Delta, subs7Delta, cadenceLine, sparkline } = card;
  const hasData = views7Delta != null || subs7Delta != null;
  const viewsStrong = views7Delta != null && views7Delta > 5000;
  const viewsUp = views7Delta != null && views7Delta > 0;
  const subsUp = subs7Delta != null && subs7Delta > 0;
  const subsFlat = subs7Delta == null || subs7Delta <= 0;
  const hasCampaign = !!card.campaign;
  const cadenceStrong = cadenceLine.startsWith('Strong');
  const cadenceMod = cadenceLine.startsWith('Moderate');
  const cadenceNone = cadenceLine.startsWith('No recent');
  const trendUp = sparkline.length >= 4 &&
    sparkline[sparkline.length - 1].y > sparkline[Math.floor(sparkline.length / 2)].y;

  // ── COLD / no data ──
  if (boardStatus === 'COLD' || !hasData) {
    return {
      label: 'HOLD',
      confidence: hasData ? 'MED' : 'LOW',
      stateLine: hasCampaign ? 'DORMANT — NEEDS REACTIVATION' : 'INACTIVE — NO SIGNAL',
      insight: hasCampaign
        ? 'Campaign exists but the channel has gone silent — every day without content loses momentum'
        : 'No uploads or engagement signal to act on yet',
      cause: 'Channel has been silent for 30+ days',
      effect: 'Algorithm deprioritises the channel; audience forgets',
      action: 'Ship 2–3 catalogue Shorts this week to restart the feed',
      secondary: hasCampaign ? 'Tease campaign content to signal a return' : null,
    };
  }

  // ── AT RISK ──
  if (boardStatus === 'AT RISK') {
    return {
      label: 'FIX',
      confidence: viewsUp ? 'MED' : 'HIGH',
      stateLine: cadenceNone ? 'STALLING — CADENCE DROPPED' : 'COOLING — LOSING RHYTHM',
      insight: 'Upload rhythm has broken — the algorithm stops recommending channels that go quiet',
      cause: cadenceNone
        ? 'No uploads in 30 days'
        : 'Upload cadence dropped below sustainable level',
      effect: 'Recommendation impressions falling; audience disengaging',
      action: cadenceNone
        ? 'Ship something this week — a Short or Community Post to restart presence'
        : 'Add a Short or Premiere this week to rebuild cadence',
      secondary: hasCampaign
        ? 'If campaign content exists, bring forward the next asset rather than waiting'
        : 'Repurpose any existing content into a Short to fill the gap',
    };
  }

  // ── WEAK CONVERSION ──
  if (boardStatus === 'WEAK CONVERSION') {
    return {
      label: 'FIX',
      confidence: viewsStrong ? 'HIGH' : 'MED',
      stateLine: 'REACHING BUT NOT CONVERTING',
      insight: 'Content is being discovered but isn\'t compelling enough to turn viewers into subscribers',
      cause: `Views are ${viewsStrong ? 'strong' : 'positive'} but subscriber growth is flat`,
      effect: 'Reach is being wasted — views without subs means no long-term audience build',
      action: 'Go deeper — post a breakdown, BTS, or artist-led context piece that gives viewers a reason to subscribe',
      secondary: cadenceStrong
        ? 'Cadence is fine — the issue is content depth, not frequency'
        : 'Also tighten upload cadence to give the algorithm more to work with',
    };
  }

  // ── HEALTHY ──
  if (boardStatus === 'HEALTHY') {
    const momentum = subsUp && viewsStrong;
    return {
      label: 'PUSH',
      confidence: momentum ? 'HIGH' : 'MED',
      stateLine: momentum ? 'COMPOUNDING — FULL MOMENTUM' : 'HEALTHY — MAINTAINING',
      insight: momentum
        ? 'Both reach and conversion are positive — this is the best time to push harder'
        : 'Channel is in a good rhythm — protect this cadence',
      cause: `${cadenceStrong ? 'Strong' : 'Good'} cadence with ${momentum ? 'views and subs both rising' : 'positive engagement'}`,
      effect: 'Algorithm is rewarding the channel with increased recommendations',
      action: momentum
        ? 'Push now — amplify with paid, collaborations, or your strongest campaign asset'
        : 'Maintain current approach — don\'t add complexity while it\'s working',
      secondary: momentum
        ? 'This is the window to bring forward your biggest content moment'
        : 'Queue next campaign asset to keep the pipeline loaded',
    };
  }

  // ── BUILDING ──
  // Default: BUILDING state
  const emerging = trendUp && (viewsUp || subsUp);
  return {
    label: emerging ? 'PUSH' : 'HOLD',
    confidence: emerging ? 'MED' : 'LOW',
    stateLine: emerging
      ? 'BUILDING MOMENTUM — EARLY SIGNAL'
      : cadenceMod
        ? 'BUILDING — NEEDS CONSISTENCY'
        : 'EARLY STAGE — ESTABLISHING PRESENCE',
    insight: emerging
      ? 'Trend is moving in the right direction — consistent output now will compound'
      : 'Channel is active but hasn\'t found its rhythm yet — focus on consistency over creativity',
    cause: emerging
      ? '30-day trend is upward with some positive signals'
      : `${cadenceMod ? 'Moderate' : 'Light'} cadence — not yet enough to trigger algorithmic momentum`,
    effect: emerging
      ? 'Early algorithmic pickup; audience starting to form'
      : 'Not enough signal for the algorithm to recommend consistently',
    action: emerging
      ? 'Lock this cadence and push — aim for 5+ uploads this month'
      : 'Focus on weekly consistency first — aim for 2 uploads per week minimum',
    secondary: hasCampaign
      ? 'Align uploads with campaign timeline — every post should serve the rollout'
      : null,
  };
}

/** Is this an active campaign card (PUSH/FIX) vs early/building (HOLD)? */
function isActiveCampaign(decision: BoardDecision, card: CardData): boolean {
  if (decision.label === 'PUSH' || decision.label === 'FIX') return true;
  // HOLD with a campaign name and some data = still active
  if (card.campaign && (card.views7Delta != null || card.subs7Delta != null)) return true;
  return false;
}

// ─── Decision label styles ─────────────────────────────────────────────────
const DECISION_STYLE: Record<DecisionLabel, { bg: string; fg: string; border: string }> = {
  PUSH: { bg: '#E6F8EE', fg: '#0C6A3F', border: '#B8E8D0' },
  FIX:  { bg: '#FFF0E6', fg: '#8A4A1A', border: '#FFD4B3' },
  HOLD: { bg: '#F5F0E4', fg: '#7A6B4E', border: '#E0D6C2' },
};

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

const STATUS_STYLE: Record<ChannelState, { bg: string; fg: string }> = {
  HEALTHY:           { bg: '#E6F8EE', fg: '#0C6A3F' },
  'WEAK CONVERSION': { bg: '#FFEAD6', fg: '#8A4A1A' },
  BUILDING:          { bg: '#FFF5D6', fg: '#7A5A00' },
  'AT RISK':         { bg: '#FFE2D8', fg: '#8A1F0C' },
  COLD:              { bg: '#FFE2D8', fg: '#8A1F0C' },
};

const SPARK_STYLE: Record<ChannelState, { stroke: string; fill: string }> = {
  HEALTHY:           { stroke: '#1FBE7A', fill: 'rgba(31,190,122,0.12)' },
  'WEAK CONVERSION': { stroke: '#F08A3C', fill: 'rgba(240,138,60,0.10)' },
  BUILDING:          { stroke: '#C4A94D', fill: 'rgba(196,169,77,0.10)' },
  'AT RISK':         { stroke: '#FF4A1C', fill: 'rgba(255,74,28,0.10)' },
  COLD:              { stroke: '#FF4A1C', fill: 'rgba(255,74,28,0.10)' },
};

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

// ─── Snapshot generator ─────────────────────────────────────────────────────
function generateSnapshot(card: CardData): string {
  const name = card.name.toUpperCase();
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const decision = deriveDecision(card);

  const viewsLine = card.views7Delta != null
    ? `${card.views7Delta >= 0 ? '+' : ''}${fmtNum(card.views7Delta)} views`
    : 'No view data';
  const subsLine = card.subs7Delta != null
    ? `${card.subs7Delta >= 0 ? '+' : ''}${fmtNum(card.subs7Delta)} subs`
    : 'No sub data';

  const latestNote = card.notes.length > 0 ? card.notes[0] : null;
  const contextLine = latestNote
    ? `${latestNote.tag ? `${latestNote.tag}: ` : ''}${latestNote.text}`
    : card.campaign ?? 'No notes';

  return [
    `YOUTUBE CAMPAIGN SNAPSHOT — ${name}`,
    today,
    '',
    `DECISION: ${decision.label} (${decision.confidence})`,
    `STATE: ${decision.stateLine}`,
    '',
    'THIS WEEK',
    viewsLine,
    subsLine,
    card.cadenceLine,
    '',
    'CAUSE → EFFECT',
    decision.cause,
    `→ ${decision.effect}`,
    '',
    'WHAT TO DO',
    `PRIMARY → ${decision.action}`,
    ...(decision.secondary ? [`SECONDARY → ${decision.secondary}`] : []),
    '',
    'WHY THIS MATTERS',
    decision.insight,
    '',
    'CONTEXT',
    `- ${contextLine}`,
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
  const style = STATUS_STYLE[card.boardStatus];
  const weak = subsIsWeak(card);
  const decision = deriveDecision(card);
  const dStyle = DECISION_STYLE[decision.label];

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

  const isFix = decision.label === 'FIX';
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

      {/* ─── A. Decision label + Status badge ─────────────────────────── */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-[0.12em]"
          style={{ background: dStyle.bg, color: dStyle.fg, border: `1px solid ${dStyle.border}` }}
        >
          {decision.label}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: `${dStyle.fg}99` }}>
          {decision.confidence} confidence
        </span>
        <span
          className="ml-auto px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.1em] shrink-0 whitespace-nowrap"
          style={{ background: style.bg, color: style.fg }}
        >
          {card.boardStatus}
        </span>
      </div>

      {/* ─── B. Artist name + state line ──────────────────────────────── */}
      <div className="mb-4">
        <h2 className="font-black text-[20px] leading-tight">{card.name}</h2>
        <div className="text-[11px] font-bold uppercase tracking-[0.1em] mt-1" style={{ color: dStyle.fg }}>
          {decision.stateLine}
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
        <div className="ml-auto rounded-lg px-3 py-2" style={{ background: SPARK_STYLE[card.boardStatus].fill }}>
          <Sparkline
            data={card.sparkline}
            width={140}
            height={44}
            stroke={SPARK_STYLE[card.boardStatus].stroke}
            fill={SPARK_STYLE[card.boardStatus].fill}
          />
          <div className="text-[9px] text-right mt-1 uppercase tracking-wider font-bold" style={{ color: SPARK_STYLE[card.boardStatus].stroke }}>
            30d trend
          </div>
        </div>
      </div>

      {/* ─── Cadence line ─────────────────────────────────────────────── */}
      <div className="text-[11px] text-ink/40 mb-4">{card.cadenceLine}</div>

      {/* ─── D. Decision block: cause → effect → action ───────────────── */}
      <div className="rounded-lg p-4 mb-3" style={{ background: isFix ? `${dStyle.bg}` : SOFT }}>
        <div className="text-[12px] text-ink/50 leading-snug mb-2">
          <span className="font-bold text-ink/60">CAUSE</span> — {decision.cause}
        </div>
        <div className="text-[12px] text-ink/50 leading-snug mb-3">
          <span className="font-bold text-ink/60">EFFECT</span> — {decision.effect}
        </div>
        <div className="text-[13px] font-semibold leading-snug flex gap-2 mb-1">
          <span style={{ color: dStyle.fg }} className="shrink-0">→</span>
          <span>{decision.action}</span>
        </div>
        {decision.secondary && (
          <div className="text-[12px] text-ink/50 leading-snug flex gap-2 mt-1.5">
            <span className="text-ink/25 shrink-0">→</span>
            <span>{decision.secondary}</span>
          </div>
        )}
      </div>

      {/* ─── E. Insight line ──────────────────────────────────────────── */}
      <div className="text-[11px] italic leading-snug mb-4" style={{ color: `${dStyle.fg}CC` }}>
        {decision.insight}
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
          const d = deriveDecision(card);
          if (isActiveCampaign(d, card)) {
            active.push(card);
          } else {
            building.push(card);
          }
        }
        // Sort active: FIX first, then PUSH, then by priority
        active.sort((a, b) => {
          const dA = deriveDecision(a);
          const dB = deriveDecision(b);
          const order: Record<DecisionLabel, number> = { FIX: 0, PUSH: 1, HOLD: 2 };
          if (order[dA.label] !== order[dB.label]) return order[dA.label] - order[dB.label];
          if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
          return 0;
        });

        return (
          <div className="space-y-8">
            {active.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/35 mb-4">
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
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/35 mb-4">
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
