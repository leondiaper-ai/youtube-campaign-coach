'use client';

import { useState } from 'react';
import {
  CAMPAIGN_STATES,
  CAMPAIGN_STATE_STYLE,
  type CampaignState,
} from '@/lib/teamWatcherStore';

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const MUTED = '#E9E2D3';
const BONE = '#EBE7DF';

type Note = { id: string; text: string; createdAt: string };

export type SnapshotData = {
  artistName: string;
  channelState: string;
  campaignState: string;
  diagnosis: string;
  nextAction: string | null;
  cadenceLine: string;
  subs: number | null;
  views7d: number | null;
  subs7d: number | null;
  uploads30d: number;
  shorts30d: number;
  lastUpDays: number | null;
  spk: number | null;
  viewsWoW: number | null;
  subsWoW: number | null;
  campaignName: string;
  campaignDay: number | null;
  campaignViewsDelta: number | null;
  campaignSubsDelta: number | null;
  campaignContentViews: number;
  campaignContentCount: number;
  campaignShortsCount: number;
};

function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K';
  return String(n);
}

function fmtDelta(n: number): string {
  return (n >= 0 ? '+' : '') + fmtNum(n);
}

function generateTeamSnapshot(d: SnapshotData, notes: Note[]): string {
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const lines: string[] = [];

  // Header
  if (d.campaignName && d.campaignDay) {
    lines.push(`CAMPAIGN PROGRESS REPORT — ${d.artistName.toUpperCase()}`);
    lines.push(`Campaign: ${d.campaignName} · Day ${d.campaignDay}`);
  } else {
    lines.push(`CHANNEL SNAPSHOT — ${d.artistName.toUpperCase()}`);
  }
  lines.push(`${date} · Channel: ${d.channelState} · State: ${d.campaignState}`);
  if (d.spk != null) {
    const label = d.spk >= 2 ? 'strong' : d.spk >= 1 ? 'healthy' : 'weak';
    lines.push(`Subs / 1K views: ${d.spk.toFixed(1)} (${label})`);
  }

  // 1. What's happening
  lines.push('', '1. WHAT\'S HAPPENING');
  lines.push(d.diagnosis || 'No data yet');

  // 2. Current week
  lines.push('', '2. CURRENT WEEK');
  lines.push(`Views (7d): ${d.views7d != null ? fmtDelta(d.views7d) : '—'}`);
  lines.push(`Subs (7d): ${d.subs7d != null ? fmtDelta(d.subs7d) : '—'}`);
  lines.push(`Uploads (30d): ${d.uploads30d}`);
  lines.push(`Cadence: ${d.cadenceLine}`);
  if (d.viewsWoW != null) lines.push(`Views WoW: ${d.viewsWoW >= 0 ? '+' : ''}${d.viewsWoW.toFixed(0)}%`);
  if (d.subsWoW != null) lines.push(`Subs WoW: ${d.subsWoW >= 0 ? '+' : ''}${d.subsWoW.toFixed(0)}%`);

  // 3. Campaign (if active)
  if (d.campaignName && d.campaignDay) {
    lines.push('', '3. CAMPAIGN SO FAR');
    lines.push(`Campaign views: ${d.campaignViewsDelta != null ? fmtDelta(d.campaignViewsDelta) : '—'}`);
    lines.push(`Campaign subs: ${d.campaignSubsDelta != null ? fmtDelta(d.campaignSubsDelta) : '—'}`);
    lines.push(`Content: ${d.campaignContentCount} uploads (${d.campaignShortsCount} Shorts · ${d.campaignContentCount - d.campaignShortsCount} videos)`);
    lines.push(`Content views: ${fmtNum(d.campaignContentViews)}`);
  }

  // Action
  const nextNum = d.campaignName && d.campaignDay ? 4 : 3;
  lines.push('', `${nextNum}. ACTION THIS WEEK`);
  lines.push(`→ ${d.nextAction || 'No recommendation yet'}`);

  // Latest note
  if (notes.length > 0) {
    lines.push('', 'TEAM NOTE:');
    lines.push(`- ${notes[0].text}`);
  }

  return lines.join('\n');
}

export default function TeamDetailClient({
  channelId,
  initialNotes,
  campaignState: initialState,
  regionTag: initialRegion,
  snapshotData,
}: {
  channelId: string;
  initialNotes: Note[];
  campaignState: string;
  regionTag: string;
  snapshotData?: SnapshotData;
}) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [noteInput, setNoteInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [campaignState, setCampaignState] = useState(initialState);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleAddNote() {
    if (!noteInput.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/team-watcher', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId,
          action: 'addNote',
          text: noteInput.trim(),
        }),
      });
      setNotes([
        { id: `${Date.now()}`, text: noteInput.trim(), createdAt: new Date().toISOString() },
        ...notes,
      ]);
      setNoteInput('');
    } finally {
      setSaving(false);
    }
  }

  async function handleStateChange(newState: string) {
    setCampaignState(newState);
    await fetch('/api/team-watcher', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId,
        action: 'setState',
        campaignState: newState,
      }),
    });
  }

  function handleCopy() {
    if (!snapshot) return;
    navigator.clipboard.writeText(snapshot).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      {/* Snapshot button */}
      {snapshotData && (
        <div className="mt-8 flex items-center justify-center">
          <button
            onClick={() => setSnapshot(generateTeamSnapshot(snapshotData, notes))}
            className="px-5 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-[0.14em] inline-flex items-center gap-2 transition-colors cursor-pointer"
            style={{ background: 'transparent', color: INK, border: `1px solid ${MUTED}` }}
          >
            <ClipboardIcon /> Copy Snapshot
          </button>
        </div>
      )}

      {/* Snapshot modal */}
      {snapshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(14,14,14,0.35)' }}
          onClick={() => { setSnapshot(null); setCopied(false); }}
        >
          <div
            className="w-full max-w-lg rounded-xl shadow-lg p-6 mx-4 max-h-[85vh] flex flex-col"
            style={{ background: PAPER }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[13px] font-bold uppercase tracking-[0.12em] text-ink/50">Snapshot</h3>
              <button onClick={() => { setSnapshot(null); setCopied(false); }} className="text-ink/30 hover:text-ink/60 text-[18px]">&times;</button>
            </div>
            <pre
              className="flex-1 overflow-y-auto text-[12px] leading-[1.6] whitespace-pre-wrap mb-4"
              style={{ color: INK, fontFamily: 'system-ui, -apple-system, sans-serif' }}
            >
              {snapshot}
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
      )}

      {/* Campaign state selector */}
      <div className="mt-8">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink/40 mb-3">
          Campaign State
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CAMPAIGN_STATES.map((s) => {
            const active = s === campaignState;
            const style = CAMPAIGN_STATE_STYLE[s];
            return (
              <button
                key={s}
                onClick={() => handleStateChange(s)}
                className="px-3 py-1.5 rounded text-[11px] font-bold transition-all"
                style={{
                  background: active ? style.bg : 'transparent',
                  color: active ? style.fg : 'rgba(14,14,14,0.35)',
                  border: active ? `1px solid ${style.fg}30` : `1px solid ${BONE}`,
                  cursor: 'pointer',
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes section */}
      <div className="mt-8">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink/40 mb-3">
          Team Notes
        </div>

        {/* Add note */}
        <div className="flex gap-2 mb-4">
          <input
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && noteInput.trim()) handleAddNote();
            }}
            placeholder="Add a note..."
            className="flex-1 text-[13px] px-3 py-2 rounded-md border outline-none"
            style={{ background: SOFT, borderColor: MUTED, color: INK }}
          />
          {noteInput.trim() && (
            <button
              onClick={handleAddNote}
              disabled={saving}
              className="text-[12px] font-bold px-4 py-2 rounded-md"
              style={{ background: INK, color: PAPER }}
            >
              Save
            </button>
          )}
        </div>

        {/* Notes list */}
        {notes.length > 0 ? (
          <div className="space-y-0">
            {notes.map((note) => (
              <div
                key={note.id}
                className="flex items-start gap-3 text-[13px] py-2.5"
                style={{ borderTop: '1px solid rgba(14,14,14,0.06)' }}
              >
                <span className="text-ink/25 text-[10px] shrink-0 mt-0.5 tabular-nums">
                  {new Date(note.createdAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
                <span className="text-ink/60">{note.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[12px] text-ink/30 py-4">
            No notes yet.
          </div>
        )}
      </div>
    </>
  );
}

function ClipboardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
