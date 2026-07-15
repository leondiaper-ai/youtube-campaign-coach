'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { fmtNum, STATUS_COLOR, type ChannelState, type Derived } from '@/lib/artists';
import {
  type CampaignState,
  CAMPAIGN_STATES,
  CAMPAIGN_STATE_STYLE,
  type TeamWatcherEntry,
  type TeamNote,
} from '@/lib/teamWatcherStore';

// ── Design tokens ────────────────────────────────────────────────────────────
const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const BONE = '#EBE7DF';
const SMOKE = '#8A847A';
const GHOST = '#C8C2B8';
const WHITE = '#FFFFFF';

// ── Types ────────────────────────────────────────────────────────────────────

export type EnrichedEntry = TeamWatcherEntry & {
  youtube: {
    subs: number | null;
    views: number | null;
    uploads30d: number | null;
    shorts30d: number | null;
    lastUploadAt: string | null;
    thumbnail: string | null;
    cachedAt: string | null;
  } | null;
  health: Derived | null;
};

type Props = {
  initialEntries: EnrichedEntry[];
};

// ── Component ────────────────────────────────────────────────────────────────

export default function TeamWatcherBoard({ initialEntries }: Props) {
  const [entries, setEntries] = useState<EnrichedEntry[]>(initialEntries);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null); // channelId
  const [noteText, setNoteText] = useState('');
  const [loading, setLoading] = useState(false);

  // Split into pinned (Active Campaigns) and unpinned (Monitored Channels)
  const pinned = entries.filter((e) => e.pinnedAt != null);
  const monitored = entries.filter((e) => e.pinnedAt == null);

  // ── API helpers ──────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    const res = await fetch('/api/team-watcher');
    if (res.ok) {
      const data = await res.json();
      setEntries(data.entries ?? []);
    }
  }, []);

  const handlePatch = useCallback(
    async (body: Record<string, unknown>) => {
      setLoading(true);
      await fetch('/api/team-watcher', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await refresh();
      setLoading(false);
    },
    [refresh],
  );

  const handleRemove = useCallback(
    async (channelId: string) => {
      if (!confirm('Remove this artist from Team Watcher?')) return;
      setLoading(true);
      await fetch(`/api/team-watcher?channelId=${encodeURIComponent(channelId)}`, {
        method: 'DELETE',
      });
      await refresh();
      setLoading(false);
    },
    [refresh],
  );

  const handleAddNote = useCallback(
    async (channelId: string, text: string) => {
      await handlePatch({ channelId, action: 'addNote', text });
      setEditingNote(null);
      setNoteText('');
    },
    [handlePatch],
  );

  // ── Empty state ──────────────────────────────────────────────────────────

  if (entries.length === 0 && !showAddForm) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 24px' }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: SMOKE,
            marginBottom: 16,
          }}
        >
          Team YouTube Watcher
        </div>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: INK,
            margin: '0 0 8px 0',
          }}
        >
          No artists yet
        </h2>
        <p style={{ fontSize: 14, color: SMOKE, marginBottom: 24, maxWidth: 380, marginInline: 'auto' }}>
          Add your first artist to start monitoring channel health and campaign
          progress across the team.
        </p>
        <button onClick={() => setShowAddForm(true)} style={btnPrimary}>
          + Add Artist
        </button>
      </div>
    );
  }

  // ── Main board ─────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 32,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: SMOKE,
              marginBottom: 4,
            }}
          >
            Team YouTube Watcher
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: INK, margin: 0 }}>
            Campaign Board
          </h1>
        </div>
        <button onClick={() => setShowAddForm(true)} style={btnPrimary}>
          + Add Artist
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <AddArtistForm
          onDone={() => {
            setShowAddForm(false);
            refresh();
          }}
          onCancel={() => setShowAddForm(false)}
          existingChannelIds={entries.map((e) => e.channelId)}
        />
      )}

      {/* Active Campaigns (pinned) */}
      {pinned.length > 0 && (
        <Section title="Active Campaigns" count={pinned.length}>
          {pinned.map((entry) => (
            <EntryCard
              key={entry.channelId}
              entry={entry}
              onPatch={handlePatch}
              onRemove={handleRemove}
              editingNote={editingNote}
              setEditingNote={setEditingNote}
              noteText={noteText}
              setNoteText={setNoteText}
              onAddNote={handleAddNote}
              loading={loading}
            />
          ))}
        </Section>
      )}

      {/* Monitored Channels */}
      <Section
        title={pinned.length > 0 ? 'Monitored Channels' : 'All Channels'}
        count={monitored.length}
      >
        {monitored.length === 0 ? (
          <p style={{ fontSize: 13, color: SMOKE, padding: '16px 0' }}>
            No unpinned channels. Pin an artist to promote it to Active
            Campaigns.
          </p>
        ) : (
          monitored.map((entry) => (
            <EntryCard
              key={entry.channelId}
              entry={entry}
              onPatch={handlePatch}
              onRemove={handleRemove}
              editingNote={editingNote}
              setEditingNote={setEditingNote}
              noteText={noteText}
              setNoteText={setNoteText}
              onAddNote={handleAddNote}
              loading={loading}
            />
          ))
        )}
      </Section>
    </div>
  );
}

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: SMOKE,
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: GHOST,
            background: SOFT,
            borderRadius: 4,
            padding: '2px 6px',
          }}
        >
          {count}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

// ── Entry Card ───────────────────────────────────────────────────────────────

function EntryCard({
  entry,
  onPatch,
  onRemove,
  editingNote,
  setEditingNote,
  noteText,
  setNoteText,
  onAddNote,
  loading,
}: {
  entry: EnrichedEntry;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
  onRemove: (channelId: string) => Promise<void>;
  editingNote: string | null;
  setEditingNote: (id: string | null) => void;
  noteText: string;
  setNoteText: (t: string) => void;
  onAddNote: (channelId: string, text: string) => Promise<void>;
  loading: boolean;
}) {
  const yt = entry.youtube;
  const health = entry.health;
  const status: ChannelState | null = health?.status ?? null;
  const statusStyle = status ? STATUS_COLOR[status] : null;
  const stateStyle = CAMPAIGN_STATE_STYLE[entry.campaignState];
  const isNoting = editingNote === entry.channelId;

  return (
    <div
      style={{
        background: WHITE,
        borderRadius: 10,
        border: `1px solid ${BONE}`,
        padding: '16px 20px',
      }}
    >
      {/* Top row: name + health dot + campaign state */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 8,
        }}
      >
        {/* Health dot */}
        {statusStyle && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: statusStyle.dot,
              flexShrink: 0,
            }}
          />
        )}

        {/* Name (links to watcher) */}
        <Link
          href={`/watcher/${entry.artistSlug}`}
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: INK,
            textDecoration: 'none',
          }}
        >
          {entry.displayName}
        </Link>

        {/* Campaign state pill */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.05em',
            padding: '2px 8px',
            borderRadius: 4,
            background: stateStyle.bg,
            color: stateStyle.fg,
          }}
        >
          {entry.campaignState}
        </span>

        {/* Channel health label */}
        {status && statusStyle && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 4,
              background: statusStyle.bg,
              color: statusStyle.fg,
            }}
          >
            {status}
          </span>
        )}

        {/* Region tag */}
        {entry.regionTag && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: SMOKE,
              background: SOFT,
              borderRadius: 4,
              padding: '2px 6px',
            }}
          >
            {entry.regionTag}
          </span>
        )}

        {/* Pin/unpin + remove — right side */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button
            onClick={() =>
              onPatch({
                channelId: entry.channelId,
                action: entry.pinnedAt ? 'unpin' : 'pin',
              })
            }
            disabled={loading}
            style={btnGhost}
            title={entry.pinnedAt ? 'Unpin' : 'Pin to Active Campaigns'}
          >
            {entry.pinnedAt ? '📌' : '📍'}
          </button>
          <button
            onClick={() => onRemove(entry.channelId)}
            disabled={loading}
            style={btnGhost}
            title="Remove"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Campaign name */}
      {entry.campaignName && (
        <div style={{ fontSize: 12, color: SMOKE, marginBottom: 6 }}>
          Campaign: <strong style={{ color: INK }}>{entry.campaignName}</strong>
          {entry.campaignStartDate && (
            <span style={{ marginLeft: 8, color: GHOST }}>
              from {entry.campaignStartDate}
            </span>
          )}
        </div>
      )}

      {/* YouTube stats row */}
      {yt && (
        <div
          style={{
            display: 'flex',
            gap: 16,
            fontSize: 12,
            color: SMOKE,
            marginBottom: 6,
          }}
        >
          {yt.subs != null && (
            <span>
              <strong style={{ color: INK }}>{fmtNum(yt.subs)}</strong> subs
            </span>
          )}
          {yt.views != null && (
            <span>
              <strong style={{ color: INK }}>{fmtNum(yt.views)}</strong> views
            </span>
          )}
          {yt.uploads30d != null && (
            <span>
              <strong style={{ color: INK }}>{yt.uploads30d}</strong> uploads /
              30d
            </span>
          )}
          {yt.lastUploadAt && (
            <span>
              Last upload:{' '}
              <strong style={{ color: INK }}>
                {daysSinceLabel(yt.lastUploadAt)}
              </strong>
            </span>
          )}
        </div>
      )}

      {/* Health reason + action */}
      {health && (
        <div style={{ fontSize: 12, color: SMOKE, marginBottom: 6 }}>
          {health.reason}
          {health.nextAction && (
            <span style={{ marginLeft: 8, color: INK, fontWeight: 600 }}>
              → {health.nextAction}
            </span>
          )}
        </div>
      )}

      {!yt && (
        <div style={{ fontSize: 12, color: GHOST, marginBottom: 6 }}>
          No cached YouTube data yet — data will appear after the next sync.
        </div>
      )}

      {/* Campaign state selector */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          flexWrap: 'wrap',
          marginTop: 8,
          marginBottom: entry.teamNotes.length > 0 || isNoting ? 8 : 0,
        }}
      >
        {CAMPAIGN_STATES.map((s) => {
          const active = s === entry.campaignState;
          const style = CAMPAIGN_STATE_STYLE[s];
          return (
            <button
              key={s}
              onClick={() =>
                !active &&
                onPatch({ channelId: entry.channelId, campaignState: s })
              }
              disabled={loading || active}
              style={{
                fontSize: 10,
                fontWeight: active ? 700 : 500,
                padding: '3px 8px',
                borderRadius: 4,
                border: active ? `1px solid ${style.fg}40` : `1px solid ${BONE}`,
                background: active ? style.bg : 'transparent',
                color: active ? style.fg : SMOKE,
                cursor: active ? 'default' : 'pointer',
                opacity: loading ? 0.5 : 1,
              }}
            >
              {s}
            </button>
          );
        })}
      </div>

      {/* Notes */}
      {entry.teamNotes.length > 0 && (
        <div style={{ marginTop: 4 }}>
          {entry.teamNotes.slice(0, 3).map((note) => (
            <div
              key={note.id}
              style={{
                fontSize: 12,
                color: SMOKE,
                padding: '4px 0',
                borderTop: `1px solid ${SOFT}`,
                display: 'flex',
                gap: 6,
              }}
            >
              <span style={{ color: GHOST, fontSize: 10, whiteSpace: 'nowrap' }}>
                {new Date(note.createdAt).toLocaleDateString()}
              </span>
              <span>{note.text}</span>
              <button
                onClick={() =>
                  onPatch({
                    channelId: entry.channelId,
                    action: 'deleteNote',
                    noteId: note.id,
                  })
                }
                style={{
                  ...btnGhost,
                  marginLeft: 'auto',
                  fontSize: 10,
                  color: GHOST,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add note inline */}
      {isNoting ? (
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <input
            autoFocus
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && noteText.trim()) {
                onAddNote(entry.channelId, noteText.trim());
              }
              if (e.key === 'Escape') {
                setEditingNote(null);
                setNoteText('');
              }
            }}
            placeholder="Add a note…"
            style={{
              flex: 1,
              fontSize: 12,
              padding: '6px 10px',
              borderRadius: 6,
              border: `1px solid ${BONE}`,
              outline: 'none',
              background: SOFT,
              color: INK,
            }}
          />
          <button
            onClick={() => {
              if (noteText.trim()) onAddNote(entry.channelId, noteText.trim());
            }}
            disabled={!noteText.trim() || loading}
            style={btnSmall}
          >
            Save
          </button>
          <button
            onClick={() => {
              setEditingNote(null);
              setNoteText('');
            }}
            style={{ ...btnSmall, background: 'transparent', color: SMOKE }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            setEditingNote(entry.channelId);
            setNoteText('');
          }}
          style={{
            ...btnGhost,
            fontSize: 11,
            color: GHOST,
            marginTop: 4,
          }}
        >
          + Add note
        </button>
      )}
    </div>
  );
}

// ── Add Artist Form ──────────────────────────────────────────────────────────

function AddArtistForm({
  onDone,
  onCancel,
  existingChannelIds,
}: {
  onDone: () => void;
  onCancel: () => void;
  existingChannelIds: string[];
}) {
  const [channelInput, setChannelInput] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [campaignStartDate, setCampaignStartDate] = useState('');
  const [campaignState, setCampaignState] = useState<CampaignState>('Monitoring');
  const [regionTag, setRegionTag] = useState('');
  const [step, setStep] = useState<'input' | 'resolving' | 'error'>('input');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!channelInput.trim()) return;
    setStep('resolving');
    setError('');

    try {
      // Step 1: Resolve channel via existing /api/artists endpoint
      // This does a one-time API call to resolve the channel and cache the snap
      const resolveRes = await fetch('/api/artists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: channelInput.trim(),
          phase: 'PRE',
          ownership: 'observed',
        }),
      });

      if (!resolveRes.ok) {
        const data = await resolveRes.json().catch(() => ({ error: 'Unknown error' }));
        setError(data.error ?? `Failed to resolve channel (${resolveRes.status})`);
        setStep('error');
        return;
      }

      const { artist } = await resolveRes.json();

      // Step 2: Get the channelId from the KV mapping
      // The /api/artists POST already wrote the mapping + snap to KV
      // We need the channelId — fetch it from the channel endpoint
      const channelHandle = artist.channelHandle;
      const channelRes = await fetch(
        `/api/channel?q=${encodeURIComponent(channelHandle)}`,
      );

      let channelId = '';
      if (channelRes.ok) {
        const channelData = await channelRes.json();
        channelId = channelData.channelId ?? '';
      }

      if (!channelId) {
        // Fallback: use handle as ID (will still work for cache reads)
        channelId = channelHandle;
      }

      // Step 3: Check for duplicate
      if (existingChannelIds.includes(channelId)) {
        setError('This channel is already on the Team Watcher board.');
        setStep('error');
        return;
      }

      // Step 4: Add to team watcher
      const twRes = await fetch('/api/team-watcher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId,
          artistSlug: artist.slug,
          displayName: artist.name,
          campaignName,
          campaignStartDate,
          campaignState,
          regionTag,
        }),
      });

      if (!twRes.ok) {
        const data = await twRes.json().catch(() => ({ error: 'Unknown error' }));
        setError(data.error ?? 'Failed to add to Team Watcher');
        setStep('error');
        return;
      }

      onDone();
    } catch (err) {
      setError(String(err));
      setStep('error');
    }
  };

  return (
    <div
      style={{
        background: WHITE,
        borderRadius: 10,
        border: `1px solid ${BONE}`,
        padding: '20px 24px',
        marginBottom: 24,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: INK,
          marginBottom: 16,
        }}
      >
        Add Artist to Team Watcher
      </div>

      {step === 'resolving' && (
        <div style={{ fontSize: 13, color: SMOKE, padding: '24px 0', textAlign: 'center' }}>
          Resolving channel…
        </div>
      )}

      {step !== 'resolving' && (
        <>
          {/* Channel input */}
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Channel Name, Handle, or URL *</label>
            <input
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              placeholder="e.g. @ArtistName or youtube.com/c/ArtistName"
              style={inputStyle}
            />
          </div>

          {/* Campaign name */}
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Campaign Name</label>
            <input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g. Album Launch 2026"
              style={inputStyle}
            />
          </div>

          {/* Row: start date + region */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Campaign Start Date</label>
              <input
                type="date"
                value={campaignStartDate}
                onChange={(e) => setCampaignStartDate(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Team / Region Tag</label>
              <input
                value={regionTag}
                onChange={(e) => setRegionTag(e.target.value)}
                placeholder="e.g. UK, US, Global"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Campaign state */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Campaign State</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {CAMPAIGN_STATES.map((s) => {
                const active = s === campaignState;
                const style = CAMPAIGN_STATE_STYLE[s];
                return (
                  <button
                    key={s}
                    onClick={() => setCampaignState(s)}
                    style={{
                      fontSize: 11,
                      fontWeight: active ? 700 : 500,
                      padding: '4px 10px',
                      borderRadius: 4,
                      border: active
                        ? `1px solid ${style.fg}40`
                        : `1px solid ${BONE}`,
                      background: active ? style.bg : 'transparent',
                      color: active ? style.fg : SMOKE,
                      cursor: 'pointer',
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div
              style={{
                fontSize: 12,
                color: '#8A1F0C',
                background: '#FFE2D8',
                borderRadius: 6,
                padding: '8px 12px',
                marginBottom: 12,
              }}
            >
              {error}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSubmit}
              disabled={!channelInput.trim()}
              style={{
                ...btnPrimary,
                opacity: channelInput.trim() ? 1 : 0.4,
              }}
            >
              Add Artist
            </button>
            <button onClick={onCancel} style={btnSecondary}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysSinceLabel(iso: string): string {
  const days = Math.floor(
    (Date.now() - new Date(iso).getTime()) / 86400000,
  );
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days}d ago`;
}

// ── Shared styles ────────────────────────────────────────────────────────────

const btnPrimary: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 8,
  background: INK,
  color: WHITE,
  fontSize: 13,
  fontWeight: 700,
  border: 'none',
  cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 8,
  background: SOFT,
  color: INK,
  fontSize: 13,
  fontWeight: 600,
  border: `1px solid ${BONE}`,
  cursor: 'pointer',
};

const btnSmall: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 6,
  background: INK,
  color: WHITE,
  fontSize: 11,
  fontWeight: 700,
  border: 'none',
  cursor: 'pointer',
};

const btnGhost: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '2px 4px',
  fontSize: 13,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: SMOKE,
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 13,
  padding: '8px 12px',
  borderRadius: 6,
  border: `1px solid ${BONE}`,
  background: SOFT,
  color: INK,
  outline: 'none',
  boxSizing: 'border-box',
};
