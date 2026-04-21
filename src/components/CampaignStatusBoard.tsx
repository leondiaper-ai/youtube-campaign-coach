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
  uploadsLast30d: number;
  daysSinceUpload: number | null;
  state: ChannelState | null;
  contextLine: string | null;
  nextAction: string | null;
  sparkline: { x: number; y: number }[];
  notes: CampaignNote[];
};

type AvailableArtist = { slug: string; name: string };

function fmtNoteDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const STATE_LABEL: Record<string, string> = {
  HEALTHY: 'Healthy',
  BUILDING: 'Building',
  'AT RISK': 'Stalled',
  COLD: 'Cold',
};

const STATE_STYLE: Record<string, { bg: string; fg: string }> = {
  HEALTHY:    { bg: '#E6F8EE', fg: '#0C6A3F' },
  BUILDING:   { bg: '#FFF5D6', fg: '#7A5A00' },
  'AT RISK':  { bg: '#FFEAD6', fg: '#8A4A1A' },
  COLD:       { bg: '#FFE2D8', fg: '#8A1F0C' },
};

// ─── Status Card ────────────────────────────────────────────────────────────
function StatusCard({
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
  const style = card.state ? STATE_STYLE[card.state] : null;

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
      className="rounded-2xl p-6 relative group"
      style={{ background: '#FFFFFF', border: `1px solid ${MUTED}` }}
    >
      {/* Remove button — visible on hover */}
      <button
        onClick={() => onUnpin(card.slug)}
        className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-[14px] text-ink/0 group-hover:text-ink/25 hover:!text-ink/50 hover:bg-black/5 transition-all"
        title="Remove"
      >
        &times;
      </button>

      {/* ─── Top: Name + Campaign + Badge ─────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="min-w-0">
          <h2 className="font-black text-[20px] leading-tight">{card.name}</h2>
          {card.campaign && (
            <div className="text-[12px] text-ink/40 mt-0.5">{card.campaign}</div>
          )}
        </div>
        {style && card.state && (
          <span
            className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.12em] shrink-0 mt-1"
            style={{ background: style.bg, color: style.fg }}
          >
            {STATE_LABEL[card.state] ?? card.state}
          </span>
        )}
      </div>

      {/* ─── Hero Metrics: 7D Views + 7D Subs ────────────────────────── */}
      <div className="flex items-end gap-8 mb-4">
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
            style={{ color: deltaColor(card.subs7Delta) }}
          >
            {card.subs7Delta != null
              ? `${card.subs7Delta >= 0 ? '+' : ''}${fmtNum(card.subs7Delta)}`
              : '—'}
          </div>
          <div className="text-[11px] text-ink/35 mt-1 uppercase tracking-[0.1em] font-bold">
            7d subs
          </div>
        </div>

        {/* Sparkline — right-aligned */}
        <div className="ml-auto">
          <Sparkline
            data={card.sparkline}
            width={120}
            height={36}
            stroke="rgba(14,14,14,0.25)"
            fill="rgba(14,14,14,0.04)"
          />
          <div className="text-[9px] text-ink/25 text-right mt-0.5 uppercase tracking-wider">
            30d trend
          </div>
        </div>
      </div>

      {/* ─── Secondary metrics ────────────────────────────────────────── */}
      <div className="flex items-center gap-4 text-[11px] text-ink/40 mb-4 tabular-nums">
        <span>{card.uploadsLast30d} uploads / 30d</span>
        <span className="text-ink/15">·</span>
        <span>
          {card.daysSinceUpload != null
            ? card.daysSinceUpload === 0
              ? 'Uploaded today'
              : `Last upload ${card.daysSinceUpload}d ago`
            : 'No upload data'}
        </span>
      </div>

      {/* ─── Context line ─────────────────────────────────────────────── */}
      {card.contextLine && (
        <div className="text-[13px] text-ink/55 mb-3 leading-snug">
          {card.contextLine}
        </div>
      )}

      {/* ─── NEXT action ──────────────────────────────────────────────── */}
      {card.nextAction && (
        <div
          className="rounded-lg px-4 py-2.5 mb-4 text-[13px]"
          style={{ background: INK, color: PAPER }}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-40 mr-2">NEXT</span>
          <span className="font-medium">{card.nextAction}</span>
        </div>
      )}

      {/* ─── Notes ────────────────────────────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${SOFT}` }} className="pt-3">
        {/* Latest note inline */}
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

        {/* Expand older notes */}
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

        {/* Add note input */}
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
        </div>
      </div>
    </div>
  );
}

function deltaColor(v: number | null): string {
  if (v == null) return 'rgba(14,14,14,0.25)';
  if (v > 0) return '#0C6A3F';
  if (v < 0) return '#8A1F0C';
  return 'rgba(14,14,14,0.4)';
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
    if (removed) {
      setAvailable((prev) => [...prev, { slug: removed.slug, name: removed.name }]);
    }
  }

  function handleNotesChange(slug: string, notes: CampaignNote[]) {
    setCards((prev) =>
      prev.map((c) => (c.slug === slug ? { ...c, notes } : c)),
    );
  }

  return (
    <>
      {/* Add campaign */}
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
              onChange={(e) => {
                if (e.target.value) handlePin(e.target.value);
              }}
              disabled={pinning}
            >
              <option value="" disabled>
                {available.length === 0 ? 'All artists already added' : 'Select an artist…'}
              </option>
              {available.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowAdd(false)}
              className="text-[12px] text-ink/30 hover:text-ink/50"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Cards */}
      {cards.length === 0 ? (
        <div className="rounded-2xl p-16 text-center" style={{ background: SOFT }}>
          <div className="text-[15px] font-bold mb-1">No campaigns yet</div>
          <div className="text-[13px] text-ink/40">
            Add artists to start tracking campaign status.
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {cards.map((card) => (
            <StatusCard
              key={card.slug}
              card={card}
              onUnpin={handleUnpin}
              onNotesChange={handleNotesChange}
            />
          ))}
        </div>
      )}
    </>
  );
}
