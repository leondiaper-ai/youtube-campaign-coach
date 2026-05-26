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

export default function TeamDetailClient({
  channelId,
  initialNotes,
  campaignState: initialState,
  regionTag: initialRegion,
}: {
  channelId: string;
  initialNotes: Note[];
  campaignState: string;
  regionTag: string;
}) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [noteInput, setNoteInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [campaignState, setCampaignState] = useState(initialState);

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

  return (
    <>
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
