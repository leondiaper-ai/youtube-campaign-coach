'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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

export type WeeklyProgressEntry = {
  week: number;
  views7d: number | null;
  subs7d: number | null;
  channelHealth: string;
  campaignSignal: string;
  status: 'confirmed' | 'missing' | 'partial';
};

export type CampaignTrackingData = {
  campaignName: string;
  campaignDay: number;
  contentViews: number;
  channelViewsDelta: number | null;
  subsGained: number | null;
  contentMix: { uploads: number; shorts: number; videos: number };
  currentWeekViews: number | null;
  previousWeekViews: number | null;
  weeklyProgress: WeeklyProgressEntry[];
  structureWarning: { headline: string; detail: string } | null;
  campaignSignalLabel: string;
};

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
  campaignTracking,
  hasCampaign,
  initialCampaignName,
}: {
  channelId: string;
  initialNotes: Note[];
  campaignState: string;
  regionTag: string;
  snapshotData?: SnapshotData;
  campaignTracking?: CampaignTrackingData;
  hasCampaign: boolean;
  initialCampaignName: string;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [noteInput, setNoteInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [campaignState, setCampaignState] = useState(initialState);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Start Campaign form
  const [showStartCampaign, setShowStartCampaign] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignDate, setNewCampaignDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [startingSaving, setStartingSaving] = useState(false);

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

  async function handleStartCampaign() {
    if (!newCampaignName.trim() || !newCampaignDate) return;
    setStartingSaving(true);
    try {
      await fetch('/api/team-watcher', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId,
          campaignName: newCampaignName.trim(),
          campaignStartDate: newCampaignDate,
          campaignState: 'Active',
        }),
      });
      setShowStartCampaign(false);
      setCampaignState('Active');
      router.refresh();
    } finally {
      setStartingSaving(false);
    }
  }

  async function handleEndCampaign() {
    await fetch('/api/team-watcher', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId,
        campaignName: '',
        campaignStartDate: '',
        campaignState: 'Monitoring',
      }),
    });
    setCampaignState('Monitoring');
    router.refresh();
  }

  const ct = campaignTracking;

  // Momentum line
  const momentumLine = ct
    ? (() => {
        if (ct.currentWeekViews == null) return null;
        const cur = fmtNum(ct.currentWeekViews);
        if (ct.previousWeekViews != null && ct.previousWeekViews > 0) {
          const dir = ct.currentWeekViews > ct.previousWeekViews ? '↑' : ct.currentWeekViews < ct.previousWeekViews ? '↓' : '→';
          return `${cur} this week (${dir} vs ${fmtNum(ct.previousWeekViews)} last week)`;
        }
        return `${cur} this week`;
      })()
    : null;

  return (
    <>
      {/* Start Campaign Form */}
      {showStartCampaign && (
        <div className="mt-8 rounded-lg p-5 border" style={{ borderColor: '#2C6BFF40', background: '#F8FAFF' }}>
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] mb-3" style={{ color: '#3B5998' }}>
            Start Campaign Tracking
          </div>
          <div className="flex gap-3 mb-3">
            <div className="flex-1">
              <label className="block text-[9px] font-bold uppercase tracking-[0.1em] mb-1" style={{ color: 'rgba(14,14,14,0.4)' }}>
                Campaign Name
              </label>
              <input
                value={newCampaignName}
                onChange={(e) => setNewCampaignName(e.target.value)}
                placeholder="e.g. Album Launch 2026"
                className="w-full text-[13px] px-3 py-2 rounded-lg border outline-none"
                style={{ background: PAPER, borderColor: BONE, color: INK }}
                autoFocus
              />
            </div>
            <div style={{ width: 160 }}>
              <label className="block text-[9px] font-bold uppercase tracking-[0.1em] mb-1" style={{ color: 'rgba(14,14,14,0.4)' }}>
                Start Date
              </label>
              <input
                type="date"
                value={newCampaignDate}
                onChange={(e) => setNewCampaignDate(e.target.value)}
                className="w-full text-[13px] px-3 py-2 rounded-lg border outline-none"
                style={{ background: PAPER, borderColor: BONE, color: INK }}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleStartCampaign}
              disabled={!newCampaignName.trim() || startingSaving}
              className="px-4 py-2 rounded-lg text-[12px] font-bold"
              style={{
                background: newCampaignName.trim() ? '#2C6BFF' : 'rgba(44,107,255,0.4)',
                color: '#FFF',
                border: 'none',
                cursor: newCampaignName.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              {startingSaving ? 'Starting...' : 'Start Tracking'}
            </button>
            <button
              onClick={() => setShowStartCampaign(false)}
              className="px-4 py-2 rounded-lg text-[12px] font-semibold"
              style={{ background: SOFT, color: INK, border: `1px solid ${BONE}`, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active Campaign Progress */}
      {hasCampaign && ct && (
        <section className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: '#2C6BFF' }} />
              <h2 className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: '#3B5998' }}>
                Day {ct.campaignDay} · {ct.campaignName}
              </h2>
              {ct.campaignSignalLabel && ct.campaignSignalLabel !== 'No campaign' && (
                <span className="text-[9px] font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded" style={{ background: '#FFF5D6', color: '#7A5A00' }}>
                  {ct.campaignSignalLabel}
                </span>
              )}
            </div>
            <button
              onClick={handleEndCampaign}
              className="text-[10px] text-ink/30 hover:text-ink/50 cursor-pointer"
            >
              End campaign
            </button>
          </div>

          {/* Campaign metrics row */}
          <div className="grid grid-cols-4 gap-3 mb-3">
            <MiniTile label="Channel views" value={ct.channelViewsDelta != null ? fmtDelta(ct.channelViewsDelta) : '—'} color={ct.channelViewsDelta != null && ct.channelViewsDelta > 0 ? '#0C6A3F' : undefined} />
            <MiniTile label="Subs gained" value={ct.subsGained != null ? fmtDelta(ct.subsGained) : '—'} color={ct.subsGained != null && ct.subsGained > 0 ? '#0C6A3F' : undefined} />
            <MiniTile label="Content views" value={fmtNum(ct.contentViews)} />
            <MiniTile label="Uploads" value={`${ct.contentMix.uploads}`} sub={`${ct.contentMix.shorts} Shorts · ${ct.contentMix.videos} videos`} />
          </div>

          {/* Momentum */}
          {momentumLine && (
            <div className="text-[11px] text-ink/45 mb-3 px-1">
              <span className="font-bold uppercase tracking-[0.06em] text-ink/30 mr-1.5">Momentum:</span>
              {momentumLine}
            </div>
          )}

          {/* Structure warning (shorts-heavy, etc.) */}
          {ct.structureWarning && (
            <div
              className="flex items-start gap-2 mb-3 px-3 py-2 rounded text-[11px] leading-snug"
              style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}
            >
              <span className="shrink-0 mt-px" style={{ color: '#92400E', fontSize: 11 }}>⚠</span>
              <div>
                <span className="font-bold uppercase tracking-[0.04em]" style={{ color: '#92400E' }}>
                  {ct.structureWarning.headline}
                </span>
                <span style={{ color: '#78716C' }}> — {ct.structureWarning.detail}</span>
              </div>
            </div>
          )}

          {/* Weekly progress */}
          {ct.weeklyProgress.length > 0 && (
            <div className="rounded-lg p-3 mt-2" style={{ background: SOFT }}>
              <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink/35 mb-2">
                Weekly Progress
              </div>
              <div className="space-y-1.5">
                {ct.weeklyProgress.map((w) => (
                  <div key={w.week} className="flex items-center gap-3 text-[11px]">
                    <span className="text-ink/30 font-bold w-[42px] shrink-0">Wk {w.week}</span>
                    {w.status === 'missing' ? (
                      <span className="text-ink/20 italic">Monitoring gap</span>
                    ) : (
                      <>
                        <span className="tabular-nums" style={{ color: w.views7d != null && w.views7d > 0 ? '#0C6A3F' : 'rgba(14,14,14,0.4)' }}>
                          {w.views7d != null ? `${w.views7d >= 0 ? '+' : ''}${fmtNum(w.views7d)} views` : '— views'}
                        </span>
                        <span className="text-ink/15">·</span>
                        <span className="tabular-nums" style={{ color: w.subs7d != null && w.subs7d > 0 ? '#0C6A3F' : 'rgba(14,14,14,0.4)' }}>
                          {w.subs7d != null ? `${w.subs7d >= 0 ? '+' : ''}${fmtNum(w.subs7d)} subs` : '— subs'}
                        </span>
                        {w.status === 'partial' && (
                          <span className="text-[9px] text-ink/20 italic">(partial)</span>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

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

function MiniTile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: SOFT }}>
      <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink/35 mb-0.5">{label}</div>
      <div className="text-[16px] font-black leading-none tabular-nums" style={{ color: color ?? INK }}>{value}</div>
      {sub && <div className="text-[9px] text-ink/30 mt-0.5">{sub}</div>}
    </div>
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
