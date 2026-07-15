'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { fmtNum, STATUS_COLOR, type ChannelState } from '@/lib/artists';
import {
  CAMPAIGN_STATE_STYLE,
  CAMPAIGN_STATES,
  type CampaignState,
} from '@/lib/teamWatcherStore';
import {
  CAMPAIGN_SIGNAL_STYLE,
  type CampaignSignal,
} from '@/lib/youtubeGrowthOS';
import Sparkline from './Sparkline';

// ── Design tokens ────────────────────────────────────────────────────────────
const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const MUTED = '#E9E2D3';

// ── Types ────────────────────────────────────────────────────────────────────

export type TeamCardData = {
  slug: string;
  name: string;
  channelId: string;
  campaign: string;
  campaignState: string;
  regionTag: string;
  pinnedAt: string | null;
  subs7Delta: number | null;
  views7Delta: number | null;
  uploads30d: number;
  shorts30d: number;
  boardStatus: ChannelState;
  diagnosis: string;
  actions: string[];
  cadenceStr: string;
  sparkline: { x: number; y: number }[];
  subs: number | null;
  views: number | null;
  lastUploadDaysAgo: number | null;
  channelHealth: string;
  campaignSignal: string;
  campaignSignalLabel: string;
  spk: number | null;
  campaignDay: number | null;
  campaignViewsDelta: number | null;
  campaignSubsDelta: number | null;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  movementConfidence?: 'high' | 'medium' | 'limited' | 'stale';
  teamNotes: { id: string; text: string; createdAt: string }[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function deltaColor(v: number | null): string {
  if (v == null) return 'rgba(14,14,14,0.25)';
  if (v > 0) return '#0C6A3F';
  if (v < 0) return '#8A1F0C';
  return 'rgba(14,14,14,0.4)';
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

const STATUS_STYLE: Record<ChannelState, { bg: string; fg: string; dot: string }> = {
  HEALTHY:           { bg: '#E6F8EE', fg: '#0C6A3F', dot: '#1FBE7A' },
  'WEAK CONVERSION': { bg: '#FFEAD6', fg: '#8A4A1A', dot: '#F08A3C' },
  BUILDING:          { bg: '#FFF5D6', fg: '#7A5A00', dot: '#FFD24C' },
  'AT RISK':         { bg: '#FFE2D8', fg: '#8A1F0C', dot: '#FF4A1C' },
  COLD:              { bg: '#FFE2D8', fg: '#8A1F0C', dot: '#FF4A1C' },
};

const SPARK_COLOR: Record<ChannelState, { stroke: string; fill: string }> = {
  HEALTHY:           { stroke: '#0C6A3F', fill: 'rgba(12,106,63,0.08)' },
  'WEAK CONVERSION': { stroke: '#F08A3C', fill: 'rgba(240,138,60,0.06)' },
  BUILDING:          { stroke: '#B0A68E', fill: 'rgba(176,166,142,0.06)' },
  'AT RISK':         { stroke: '#FF4A1C', fill: 'rgba(255,74,28,0.06)' },
  COLD:              { stroke: '#FF4A1C', fill: 'rgba(255,74,28,0.06)' },
};

// ── Component ────────────────────────────────────────────────────────────────

export default function TeamCampaignCards({ cards }: { cards: TeamCardData[] }) {
  return (
    <div className="space-y-4">
      {cards.map((card) => (
        <TeamDecisionCard key={card.channelId} card={card} />
      ))}
    </div>
  );
}

function TeamDecisionCard({ card }: { card: TeamCardData }) {
  const [noteInput, setNoteInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState(card.teamNotes);

  const st = STATUS_STYLE[card.boardStatus];
  const sp = SPARK_COLOR[card.boardStatus];
  const stateStyle = CAMPAIGN_STATE_STYLE[card.campaignState as CampaignState] ?? CAMPAIGN_STATE_STYLE.Monitoring;
  const isStale = card.movementConfidence === 'stale';

  const conv = conversionLabel(card.spk);

  async function handleAddNote() {
    if (!noteInput.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/team-watcher', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: card.channelId,
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

  async function handleUnpin() {
    await fetch('/api/team-watcher', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId: card.channelId, action: 'unpin' }),
    });
    window.location.reload();
  }

  return (
    <div
      className="rounded-2xl p-5 relative group"
      style={{ background: '#FFFFFF', border: `1px solid ${MUTED}` }}
    >
      {/* Unpin — hover only */}
      <button
        onClick={handleUnpin}
        className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-[14px] text-ink/0 group-hover:text-ink/25 hover:!text-ink/50 hover:bg-black/5 transition-all"
        title="Unpin"
      >
        &times;
      </button>

      {/* 1. Name + health + campaign state */}
      <div className="mb-3">
        <div className="flex items-center gap-2.5 mb-1 flex-wrap">
          <Link
            href={`/team-watcher/${card.slug}`}
            className="font-black text-[20px] leading-tight hover:underline"
            style={{ color: INK, textDecoration: 'none' }}
          >
            {card.name}
          </Link>
          {/* Campaign state pill */}
          <span
            className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-[0.08em]"
            style={{ background: stateStyle.bg, color: stateStyle.fg }}
          >
            {card.campaignState}
          </span>
          {/* Region tag */}
          {card.regionTag && (
            <span
              className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.08em]"
              style={{ background: SOFT, color: 'rgba(14,14,14,0.4)' }}
            >
              {card.regionTag}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px]">
          <span className="font-bold uppercase tracking-[0.08em] text-ink/50">
            Channel:{' '}
            <span
              className="px-1.5 py-0.5 rounded"
              style={{ background: st.bg, color: st.fg }}
            >
              {card.channelHealth}
            </span>
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

      {/* 2. Metrics row */}
      <div className="flex items-end gap-6 mb-3 flex-wrap">
        {/* Views 7d */}
        <div>
          {(() => {
            const hasReal = card.views7Delta != null && !(isStale && card.views7Delta === 0);
            return (
              <>
                <div
                  className="text-[28px] font-black leading-none tabular-nums"
                  style={{ color: hasReal ? deltaColor(card.views7Delta) : 'rgba(14,14,14,0.2)' }}
                >
                  {hasReal
                    ? `${card.views7Delta! >= 0 ? '+' : ''}${fmtNum(card.views7Delta!)}`
                    : isStale ? 'Updating' : '—'}
                </div>
                <div className="text-[10px] text-ink/35 mt-1 uppercase tracking-[0.1em] font-bold">
                  7d views
                </div>
              </>
            );
          })()}
        </div>

        {/* Subs 7d */}
        <div>
          {(() => {
            const hasReal = card.subs7Delta != null && !(isStale && card.subs7Delta === 0);
            return (
              <>
                <div
                  className="text-[28px] font-black leading-none tabular-nums"
                  style={{ color: hasReal ? deltaColor(card.subs7Delta) : INK }}
                >
                  {hasReal
                    ? `${card.subs7Delta! >= 0 ? '+' : ''}${fmtNum(card.subs7Delta!)}`
                    : card.subs != null ? fmtNum(card.subs) : '—'}
                </div>
                <div className="text-[10px] text-ink/35 mt-1 uppercase tracking-[0.1em] font-bold">
                  {hasReal ? '7d subs' : 'subs (total)'}
                </div>
              </>
            );
          })()}
        </div>

        {/* Conversion */}
        <div>
          <div
            className="text-[20px] font-black leading-none tabular-nums"
            style={{ color: card.spk != null ? conversionColor(card.spk) : 'rgba(14,14,14,0.25)' }}
          >
            {card.spk != null ? card.spk.toFixed(1) : '—'}
          </div>
          <div className="text-[9px] mt-1 uppercase tracking-[0.1em] font-bold" style={{
            color: card.spk != null ? conv.color : 'rgba(14,14,14,0.25)',
          }}>
            subs/1K{card.spk != null ? ` · ${conv.text}` : ''}
          </div>
        </div>

        {/* Sparkline */}
        <div className="ml-auto rounded-lg px-3 py-2" style={{ background: sp.fill }}>
          <Sparkline
            data={card.sparkline}
            width={120}
            height={40}
            stroke={sp.stroke}
            fill={sp.fill}
          />
          <div className="text-[9px] text-right mt-0.5 uppercase tracking-wider font-bold" style={{ color: sp.stroke }}>
            30d trend
          </div>
        </div>
      </div>

      {/* 3. Diagnosis + action */}
      <div className="text-[13px] font-semibold text-ink/75 leading-snug mb-1">
        {card.diagnosis}
      </div>

      {/* 4. Actions */}
      <div className="rounded-lg p-3.5 mb-3" style={{ background: SOFT }}>
        <div className="space-y-1">
          {card.actions.map((step, i) => (
            <div key={i} className="text-[12px] font-medium leading-snug flex gap-2">
              <span className="text-ink/40 shrink-0">→</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Campaign tracking block */}
      {card.campaignDay != null && card.campaign && (
        <div className="rounded-lg p-3.5 mb-3" style={{ background: 'rgba(14,14,14,0.02)', border: '1px solid rgba(14,14,14,0.06)' }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#2C6BFF' }} />
            <span className="text-[12px] font-black uppercase tracking-[0.08em]" style={{ color: '#3B5998' }}>
              Day {card.campaignDay}
            </span>
            <span className="text-[11px] text-ink/30">·</span>
            <span className="text-[11px] text-ink/40">{card.campaign}</span>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <span className="text-[16px] font-black tabular-nums" style={{ color: deltaColor(card.campaignViewsDelta) }}>
                {card.campaignViewsDelta != null ? `${card.campaignViewsDelta >= 0 ? '+' : ''}${fmtNum(card.campaignViewsDelta)}` : '—'}
              </span>
              <span className="text-[9px] text-ink/30 ml-1 uppercase tracking-[0.08em] font-bold">views (total)</span>
            </div>
            <div>
              <span className="text-[16px] font-black tabular-nums" style={{ color: deltaColor(card.campaignSubsDelta) }}>
                {card.campaignSubsDelta != null ? `${card.campaignSubsDelta >= 0 ? '+' : ''}${fmtNum(card.campaignSubsDelta)}` : '—'}
              </span>
              <span className="text-[9px] text-ink/30 ml-1 uppercase tracking-[0.08em] font-bold">subs (total)</span>
            </div>
          </div>
        </div>
      )}

      {/* 6. Notes */}
      {notes.length > 0 && (
        <div className="mb-2">
          {notes.slice(0, 3).map((note) => (
            <div
              key={note.id}
              className="flex items-start gap-2 text-[12px] py-1.5"
              style={{ borderTop: '1px solid rgba(14,14,14,0.04)' }}
            >
              <span className="text-ink/20 text-[10px] shrink-0 mt-0.5">
                {new Date(note.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
              <span className="text-ink/55">{note.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Add note */}
      <div className="flex gap-2 mt-1">
        <input
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && noteInput.trim()) handleAddNote();
          }}
          placeholder="Add a note…"
          className="flex-1 text-[12px] px-3 py-1.5 rounded-md border outline-none"
          style={{ background: SOFT, borderColor: MUTED, color: INK }}
        />
        {noteInput.trim() && (
          <button
            onClick={handleAddNote}
            disabled={saving}
            className="text-[11px] font-bold px-3 py-1.5 rounded-md"
            style={{ background: INK, color: PAPER }}
          >
            Save
          </button>
        )}
      </div>

      {/* Campaign planner placeholder */}
      {!card.campaign && (
        <div className="mt-3 rounded-lg px-4 py-3 text-[11px] text-ink/35" style={{ background: SOFT }}>
          No campaign timeline yet — ask Leon to set up a campaign timeline.
        </div>
      )}
    </div>
  );
}
