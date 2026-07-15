'use client';

import { useState } from 'react';
import Link from 'next/link';
import { fmtNum, STATUS_COLOR, type ChannelState } from '@/lib/artists';
import type { CampaignNote } from '@/lib/campaignStore';

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const MUTED = '#E9E2D3';

type CardData = {
  slug: string;
  name: string;
  channelHandle?: string;
  campaign?: string;
  campaignStartDate?: string | null;
  phase: string;
  pinnedAt: string;
  priority: 'high' | 'normal';
  subs: number | null;
  views: number | null;
  subs7Delta: number | null;
  views7Delta: number | null;
  subs30Delta: number | null;
  campaignSubsDelta: number | null;
  campaignViewsDelta: number | null;
  campaignDays: number | null;
  uploadsLast30d: number;
  daysSinceUpload: number | null;
  state: ChannelState | null;
  stateReason: string | null;
  nextAction: string | null;
  signal: string | null;
  blocker: string | null;
  notes: CampaignNote[];
};

type AvailableArtist = { slug: string; name: string };

const STATE_LABEL: Record<string, string> = {
  HEALTHY: 'Healthy',
  BUILDING: 'Building',
  'AT RISK': 'At Risk',
  COLD: 'Cold',
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtShortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function DeltaBadge({ value, label }: { value: number | null; label: string }) {
  if (value == null) return null;
  const positive = value >= 0;
  return (
    <div className="text-center">
      <div
        className="text-[13px] font-bold"
        style={{ color: positive ? '#0C6A3F' : '#8A1F0C' }}
      >
        {positive ? '+' : ''}{fmtNum(value)}
      </div>
      <div className="text-[10px] text-ink/40 mt-0.5">{label}</div>
    </div>
  );
}

// ─── Note Modal ─────────────────────────────────────────────────────────────
function NoteModal({
  slug,
  notes,
  onClose,
  onNotesChange,
}: {
  slug: string;
  notes: CampaignNote[];
  onClose: () => void;
  onNotesChange: (slug: string, notes: CampaignNote[]) => void;
}) {
  const [text, setText] = useState('');
  const [tag, setTag] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/campaign-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, text: text.trim(), tag: tag.trim() || undefined }),
      });
      const data = await res.json();
      if (data.notes) {
        onNotesChange(slug, data.notes);
        setText('');
        setTag('');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(noteId: string) {
    const res = await fetch(`/api/campaign-notes?slug=${slug}&noteId=${noteId}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (data.notes) onNotesChange(slug, data.notes);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(14,14,14,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl shadow-lg p-5"
        style={{ background: PAPER }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-black">Campaign Notes</h3>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-[18px]">&times;</button>
        </div>

        {/* Add note form */}
        <div className="mb-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a note…"
            rows={2}
            className="w-full rounded-lg border px-3 py-2 text-[13px] resize-none"
            style={{ borderColor: MUTED, background: SOFT }}
          />
          <div className="flex items-center gap-2 mt-2">
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="Tag (optional)"
              className="rounded-md border px-2 py-1 text-[12px] flex-1"
              style={{ borderColor: MUTED, background: SOFT }}
            />
            <button
              onClick={handleAdd}
              disabled={saving || !text.trim()}
              className="px-3 py-1 rounded-md text-[12px] font-bold text-white disabled:opacity-40"
              style={{ background: INK }}
            >
              {saving ? 'Saving…' : 'Add'}
            </button>
          </div>
        </div>

        {/* Notes list */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {notes.length === 0 && (
            <div className="text-[12px] text-ink/40 text-center py-4">No notes yet</div>
          )}
          {notes.map((n) => (
            <div
              key={n.id}
              className="rounded-lg px-3 py-2 flex items-start gap-2"
              style={{ background: SOFT }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[13px]">{n.text}</div>
                <div className="text-[10px] text-ink/40 mt-1 flex items-center gap-2">
                  {n.tag && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: MUTED }}>
                      {n.tag}
                    </span>
                  )}
                  <span>{fmtShortDate(n.createdAt)}</span>
                </div>
              </div>
              <button
                onClick={() => handleDelete(n.id)}
                className="text-ink/25 hover:text-ink/60 text-[14px] shrink-0 mt-0.5"
                title="Delete note"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Campaign Card ──────────────────────────────────────────────────────────
function CampaignCard({
  card,
  onUnpin,
  onOpenNotes,
}: {
  card: CardData;
  onUnpin: (slug: string) => void;
  onOpenNotes: (slug: string) => void;
}) {
  const stateColor = card.state ? STATUS_COLOR[card.state] : null;

  return (
    <div
      className="rounded-xl p-5 relative"
      style={{
        background: '#FFFFFF',
        border: card.priority === 'high' ? '2px solid #FFD24C' : `1px solid ${MUTED}`,
      }}
    >
      {/* Top row: name + state badge + actions */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[16px] font-black truncate">{card.name}</h3>
            {card.campaign && (
              <span
                className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0"
                style={{ background: '#F0E6FF', color: '#5B21B6' }}
              >
                {card.campaign}
              </span>
            )}
          </div>
          {card.channelHandle && (
            <div className="text-[11px] text-ink/40 mt-0.5">{card.channelHandle}</div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {stateColor && card.state && (
            <span
              className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider"
              style={{ background: stateColor.bg, color: stateColor.fg }}
            >
              {STATE_LABEL[card.state] ?? card.state}
            </span>
          )}
          <button
            onClick={() => onUnpin(card.slug)}
            className="text-[11px] text-ink/30 hover:text-ink/60 px-1"
            title="Remove from active campaigns"
          >
            &times;
          </button>
        </div>
      </div>

      {/* State reason */}
      {card.stateReason && (
        <div className="text-[12px] text-ink/50 mb-3">{card.stateReason}</div>
      )}

      {/* Metrics row */}
      <div className="flex items-center gap-5 mb-3 py-2 px-3 rounded-lg" style={{ background: SOFT }}>
        {card.subs != null && (
          <div className="text-center">
            <div className="text-[14px] font-bold">{fmtNum(card.subs)}</div>
            <div className="text-[10px] text-ink/40">subs</div>
          </div>
        )}
        <DeltaBadge value={card.subs7Delta} label="7d subs" />
        <DeltaBadge value={card.views7Delta} label="7d views" />
        {card.campaignSubsDelta != null && (
          <DeltaBadge value={card.campaignSubsDelta} label={`campaign (${card.campaignDays}d)`} />
        )}
        <div className="text-center">
          <div className="text-[13px] font-bold">{card.uploadsLast30d}</div>
          <div className="text-[10px] text-ink/40">uploads/30d</div>
        </div>
      </div>

      {/* Signal + Blocker */}
      <div className="flex gap-3 mb-3">
        {card.signal && (
          <div className="flex items-center gap-1.5 text-[12px]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#1FBE7A' }} />
            <span style={{ color: '#0C6A3F' }}>{card.signal}</span>
          </div>
        )}
        {card.blocker && (
          <div className="flex items-center gap-1.5 text-[12px]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#FF4A1C' }} />
            <span style={{ color: '#8A1F0C' }}>{card.blocker}</span>
          </div>
        )}
      </div>

      {/* Next action */}
      {card.nextAction && (
        <div
          className="rounded-lg px-3 py-2 mb-3 text-[12px] font-medium"
          style={{ background: '#0E0E0E', color: '#FAF7F2' }}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-50 mr-2">NEXT</span>
          {card.nextAction}
        </div>
      )}

      {/* Notes preview + action buttons */}
      <div className="flex items-center justify-between pt-2" style={{ borderTop: `1px solid ${MUTED}` }}>
        <div className="flex items-center gap-3">
          <Link
            href={`/watcher/${card.slug}`}
            className="text-[11px] font-bold uppercase tracking-wider text-ink/50 hover:text-ink"
          >
            Watcher
          </Link>
          <Link
            href={`/?artist=${card.slug}`}
            className="text-[11px] font-bold uppercase tracking-wider text-ink/50 hover:text-ink"
          >
            Coach
          </Link>
          <button
            onClick={() => onOpenNotes(card.slug)}
            className="text-[11px] font-bold uppercase tracking-wider text-ink/50 hover:text-ink"
          >
            Notes{card.notes.length > 0 ? ` (${card.notes.length})` : ''}
          </button>
        </div>
        {card.campaignStartDate && (
          <div className="text-[10px] text-ink/35">
            Campaign started {fmtDate(card.campaignStartDate)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Client Component ──────────────────────────────────────────────────
export default function ActiveCampaignsClient({
  initialCards,
  availableArtists,
}: {
  initialCards: CardData[];
  availableArtists: AvailableArtist[];
}) {
  const [cards, setCards] = useState<CardData[]>(initialCards);
  const [available, setAvailable] = useState<AvailableArtist[]>(availableArtists);
  const [noteModalSlug, setNoteModalSlug] = useState<string | null>(null);
  const [pinning, setPinning] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  async function handlePin(slug: string) {
    setPinning(true);
    try {
      await fetch('/api/active-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      // Reload to get fresh live data
      window.location.reload();
    } finally {
      setPinning(false);
    }
  }

  async function handleUnpin(slug: string) {
    await fetch(`/api/active-campaigns?slug=${slug}`, { method: 'DELETE' });
    setCards((prev) => prev.filter((c) => c.slug !== slug));
    const removed = cards.find((c) => c.slug === slug);
    if (removed) {
      setAvailable((prev) => [...prev, { slug: removed.slug, name: removed.name }]);
    }
  }

  function handleNotesChange(slug: string, notes: CampaignNote[]) {
    setCards((prev) =>
      prev.map((c) => (c.slug === slug ? { ...c, notes } : c)),
    );
  }

  const noteCard = noteModalSlug ? cards.find((c) => c.slug === noteModalSlug) : null;

  return (
    <>
      {/* Add campaign button */}
      <div className="mb-5">
        {!showAdd ? (
          <button
            onClick={() => setShowAdd(true)}
            className="text-[12px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg hover:opacity-80 transition-opacity"
            style={{ background: INK, color: PAPER }}
          >
            + Add Campaign
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <select
              className="rounded-lg border px-3 py-2 text-[13px]"
              style={{ borderColor: MUTED, background: SOFT }}
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) handlePin(e.target.value);
              }}
              disabled={pinning}
            >
              <option value="" disabled>
                {available.length === 0 ? 'All artists already pinned' : 'Select an artist…'}
              </option>
              {available.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowAdd(false)}
              className="text-[12px] text-ink/40 hover:text-ink"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Campaign cards */}
      {cards.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center"
          style={{ background: SOFT }}
        >
          <div className="text-[14px] font-bold mb-1">No active campaigns</div>
          <div className="text-[13px] text-ink/50">
            Pin artists into your focused workspace to track live campaign performance.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {cards.map((card) => (
            <CampaignCard
              key={card.slug}
              card={card}
              onUnpin={handleUnpin}
              onOpenNotes={setNoteModalSlug}
            />
          ))}
        </div>
      )}

      {/* Note modal */}
      {noteCard && (
        <NoteModal
          slug={noteCard.slug}
          notes={noteCard.notes}
          onClose={() => setNoteModalSlug(null)}
          onNotesChange={handleNotesChange}
        />
      )}
    </>
  );
}
