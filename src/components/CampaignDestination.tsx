'use client';

import { useState } from 'react';
import Link from 'next/link';
import type {
  GeneratedPlan,
  PlanWeek,
  PhaseName,
  ContentAction,
  ChannelContext,
} from '@/lib/planEngine';

// Deep clone helper
function clonePlan(plan: GeneratedPlan): GeneratedPlan {
  return JSON.parse(JSON.stringify(plan));
}
import { STATUS_COLOR, fmtNum, type ChannelState } from '@/lib/artists';

// ── Design tokens ──────────────────────────────────────────────────────────

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const BORDER = '#E8E3DA';
const MUTED = '#9B9589';

const PHASE_COLOR: Record<PhaseName, string> = {
  BUILD: '#6366F1',
  RELEASE: '#FF4A1C',
  SCALE: '#1FBE7A',
  EXTEND: '#F59E0B',
};

const PHASE_BG: Record<PhaseName, string> = {
  BUILD: '#EEF2FF',
  RELEASE: '#FFF1ED',
  SCALE: '#ECFDF5',
  EXTEND: '#FFFBEB',
};

const FORMAT_ICON: Record<string, string> = {
  short: '⚡',
  video: '🎬',
  post: '📝',
  live: '📡',
  premiere: '🎬',
  community: '💬',
};

// ── Props ──────────────────────────────────────────────────────────────────

type CampaignDestinationProps = {
  plan: GeneratedPlan;
  channelCtx: ChannelContext | null;
  createdAt: string;
  slug: string;
  /** Live channel data for current state strip (optional — page works without it) */
  liveChannel?: {
    subs?: number;
    views?: number;
    uploads30d?: number;
    shorts30d?: number;
    lastUploadDaysAgo?: number;
    views7Delta?: number | null;
    subs7Delta?: number | null;
  } | null;
};

// ── Main Component ─────────────────────────────────────────────────────────

export default function CampaignDestination({
  plan: initialPlan,
  channelCtx,
  createdAt,
  slug,
  liveChannel,
}: CampaignDestinationProps) {
  const [plan, setPlan] = useState<GeneratedPlan>(initialPlan);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(() => {
    const s = new Set<number>();
    plan.weeks.forEach((w) => {
      if (w.actions.length > 0) s.add(w.weekNum);
    });
    return s;
  });

  // Persist changes to KV
  const persistPlan = async (updated: GeneratedPlan) => {
    setSaving(true);
    try {
      const res = await fetch('/api/coach', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, plan: updated }),
      });
      if (res.ok) {
        const data = await res.json();
        setLastSaved(data.updatedAt);
      }
    } catch {
      // Save failed silently
    }
    setSaving(false);
  };

  const toggleActionComplete = (weekNum: number, actionIdx: number) => {
    const updated = clonePlan(plan);
    const week = updated.weeks.find((w) => w.weekNum === weekNum);
    if (!week || !week.actions[actionIdx]) return;
    week.actions[actionIdx].completed = !week.actions[actionIdx].completed;
    setPlan(updated);
    persistPlan(updated);
  };

  const removeAction = (weekNum: number, actionIdx: number) => {
    const updated = clonePlan(plan);
    const week = updated.weeks.find((w) => w.weekNum === weekNum);
    if (!week) return;
    week.actions.splice(actionIdx, 1);
    setPlan(updated);
    persistPlan(updated);
  };

  const addAction = (weekNum: number, title: string, format: ContentAction['format']) => {
    const updated = clonePlan(plan);
    const week = updated.weeks.find((w) => w.weekNum === weekNum);
    if (!week) return;
    week.actions.push({ title, format, day: 0, custom: true });
    setPlan(updated);
    persistPlan(updated);
  };

  const toggleWeek = (n: number) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };

  const expandAll = () => setExpandedWeeks(new Set(plan.weeks.map((w) => w.weekNum)));
  const collapseAll = () => setExpandedWeeks(new Set());

  const totalActions = plan.weeks.reduce((s, w) => s + w.actions.length, 0);
  const createdDate = new Date(createdAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  // Determine current phase based on today's date
  const currentPhase = detectCurrentPhase(plan);

  return (
    <div style={{ minHeight: '100vh', background: PAPER, color: INK }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px' }}>
        {/* ── Top bar ──────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 0',
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <Link
            href="/coach"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: MUTED,
              textDecoration: 'none',
            }}
          >
            YouTube Campaign System
          </Link>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {saving && (
              <span style={{ fontSize: 10, color: MUTED, fontStyle: 'italic' }}>Saving...</span>
            )}
            {!saving && lastSaved && (
              <span style={{ fontSize: 10, color: '#1FBE7A' }}>Saved</span>
            )}
            <span style={{ fontSize: 10, color: MUTED }}>
              Created {createdDate}
            </span>
            <Link
              href="/coach"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: MUTED,
                textDecoration: 'none',
                padding: '4px 10px',
                borderRadius: 5,
                background: SOFT,
              }}
            >
              All Campaigns
            </Link>
          </div>
        </div>

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <div style={{ paddingTop: 48, paddingBottom: 8 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: MUTED,
              margin: '0 0 10px 0',
            }}
          >
            {plan.artist}
          </p>
          <h1
            style={{
              fontSize: 36,
              fontWeight: 900,
              color: INK,
              margin: 0,
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
            }}
          >
            {plan.campaignName.replace(` Campaign`, '')}
          </h1>
          <p
            style={{
              fontSize: 15,
              color: '#5A5650',
              lineHeight: 1.6,
              marginTop: 12,
              marginBottom: 0,
              maxWidth: 580,
            }}
          >
            {plan.strategy.priority}
          </p>
        </div>

        {/* ── Current State Strip ──────────────────────────────────── */}
        <StateStrip channelCtx={channelCtx} liveChannel={liveChannel} currentPhase={currentPhase} />

        {/* ── Strategy ────────────────────────────────────────────── */}
        <div
          style={{
            padding: '16px 18px',
            background: '#FFFFFF',
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            marginTop: 20,
            marginBottom: 8,
          }}
        >
          <p
            style={{
              fontSize: 13,
              color: '#5A5650',
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            {plan.strategy.approach}
          </p>
        </div>

        {/* ── Campaign Insights ────────────────────────────────────── */}
        {plan.campaignInsights.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              marginTop: 12,
              marginBottom: 24,
              paddingLeft: 4,
            }}
          >
            {plan.campaignInsights.map((insight, i) => (
              <p
                key={i}
                style={{
                  fontSize: 12,
                  color: '#8B8579',
                  lineHeight: 1.5,
                  margin: 0,
                  fontStyle: 'italic',
                }}
              >
                {insight}
              </p>
            ))}
          </div>
        )}

        {/* ── Phase Strip ──────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            gap: 2,
            borderRadius: 8,
            overflow: 'hidden',
            marginTop: 28,
            marginBottom: 28,
          }}
        >
          {plan.phases.map((p) => {
            const span = p.weekEnd - p.weekStart + 1;
            const pct = (span / plan.totalWeeks) * 100;
            const isCurrent = currentPhase === p.name;
            return (
              <div
                key={p.name}
                style={{
                  flex: `0 0 ${pct}%`,
                  background: PHASE_BG[p.name],
                  padding: '8px 12px',
                  borderBottom: isCurrent ? `2px solid ${PHASE_COLOR[p.name]}` : '2px solid transparent',
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: '0.12em',
                    color: PHASE_COLOR[p.name],
                    textTransform: 'uppercase',
                  }}
                >
                  {p.name}
                </span>
                <span style={{ fontSize: 9, color: MUTED, marginLeft: 6 }}>
                  Wk {p.weekStart}–{p.weekEnd}
                </span>
                {isCurrent && (
                  <span style={{ fontSize: 9, color: PHASE_COLOR[p.name], marginLeft: 6, fontWeight: 700 }}>
                    ← now
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Stats + controls ─────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: MUTED }}>
            <span>{plan.totalWeeks} weeks</span>
            <span>{plan.events.length} moments</span>
            <span>{totalActions} actions</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <SmallButton onClick={expandAll} label="Expand all" />
            <SmallButton onClick={collapseAll} label="Collapse" />
          </div>
        </div>

        {/* ── Timeline (THE HERO) ──────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 60 }}>
          {plan.weeks.map((week) => (
            <WeekRow
              key={week.weekNum}
              week={week}
              expanded={expandedWeeks.has(week.weekNum)}
              onToggle={() => toggleWeek(week.weekNum)}
              onToggleComplete={(idx) => toggleActionComplete(week.weekNum, idx)}
              onRemove={(idx) => removeAction(week.weekNum, idx)}
              onAdd={(title, format) => addAction(week.weekNum, title, format)}
            />
          ))}
        </div>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <div
          style={{
            padding: '24px 0 40px',
            borderTop: `1px solid ${BORDER}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#D1C9BD',
            }}
          >
            YouTube Campaign System
          </span>
          <Link
            href="/coach"
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: MUTED,
              textDecoration: 'none',
            }}
          >
            ← Back to Coach
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── State Strip ─────────────────────────────────────────────────────────────

function StateStrip({
  channelCtx,
  liveChannel,
  currentPhase,
}: {
  channelCtx: ChannelContext | null;
  liveChannel?: CampaignDestinationProps['liveChannel'];
  currentPhase: PhaseName | null;
}) {
  if (!channelCtx) return null;

  const sc = STATUS_COLOR[channelCtx.state as ChannelState] ?? STATUS_COLOR.COLD;
  const ch = liveChannel ?? channelCtx;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        marginTop: 20,
        padding: '10px 16px',
        borderRadius: 8,
        background: '#FFFFFF',
        border: `1px solid ${BORDER}`,
        fontSize: 12,
        flexWrap: 'wrap',
      }}
    >
      {/* Status */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: sc.dot,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontWeight: 700,
            color: sc.fg,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {channelCtx.state}
        </span>
      </span>

      <Sep />

      {/* Subs */}
      {'subs' in ch && ch.subs != null && (
        <>
          <Stat label="Subs" value={fmtNum(ch.subs)} />
          <Sep />
        </>
      )}

      {/* Total views */}
      {'views' in ch && ch.views != null && (
        <>
          <Stat label="Views" value={fmtNum(ch.views)} />
          <Sep />
        </>
      )}

      {/* Views delta */}
      {'views7Delta' in ch && ch.views7Delta != null && ch.views7Delta !== 0 && (
        <>
          <Stat
            label="7d"
            value={`${ch.views7Delta >= 0 ? '+' : ''}${fmtNum(ch.views7Delta)}`}
            color={ch.views7Delta > 0 ? '#0C6A3F' : undefined}
          />
          <Sep />
        </>
      )}

      {/* Cadence */}
      {'uploads30d' in ch && ch.uploads30d != null && (
        <Stat label="Uploads 30d" value={String(ch.uploads30d)} />
      )}
      {'shorts30d' in ch && ch.shorts30d != null && (
        <>
          <Sep />
          <Stat label="Shorts 30d" value={String(ch.shorts30d)} />
        </>
      )}

      {/* Last upload */}
      {'lastUploadDaysAgo' in ch && ch.lastUploadDaysAgo != null && (
        <>
          <Sep />
          <Stat label="Last upload" value={`${ch.lastUploadDaysAgo}d ago`} />
        </>
      )}

      {/* Current phase */}
      {currentPhase && (
        <>
          <Sep />
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: PHASE_COLOR[currentPhase],
              background: PHASE_BG[currentPhase],
              padding: '2px 8px',
              borderRadius: 4,
            }}
          >
            {currentPhase}
          </span>
        </>
      )}
    </div>
  );
}

// ── Timeline sub-components ─────────────────────────────────────────────────

function WeekRow({
  week,
  expanded,
  onToggle,
  onToggleComplete,
  onRemove,
  onAdd,
}: {
  week: PlanWeek;
  expanded: boolean;
  onToggle: () => void;
  onToggleComplete: (actionIdx: number) => void;
  onRemove: (actionIdx: number) => void;
  onAdd: (title: string, format: ContentAction['format']) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newFormat, setNewFormat] = useState<ContentAction['format']>('video');

  const hasActions = week.actions.length > 0;
  const phaseColor = PHASE_COLOR[week.phase];
  const isMoment = !!week.momentName;
  const completedCount = week.actions.filter((a) => a.completed).length;

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    onAdd(title, newFormat);
    setNewTitle('');
    setAdding(false);
  };

  return (
    <div
      style={{
        background: hasActions ? '#FFFFFF' : 'transparent',
        border: hasActions ? `1px solid ${BORDER}` : '1px solid transparent',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: hasActions ? '10px 14px' : '5px 14px',
          background: 'none',
          border: 'none',
          cursor: hasActions ? 'pointer' : 'default',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: phaseColor,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, minWidth: 30 }}>
          W{week.weekNum}
        </span>
        <span style={{ fontSize: 12, color: MUTED, minWidth: 120 }}>
          {week.dateRange}
        </span>
        {isMoment && (
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: INK,
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {week.momentName}
          </span>
        )}
        {!isMoment && <span style={{ flex: 1 }} />}
        {hasActions && (
          <span style={{ fontSize: 11, color: MUTED }}>
            {completedCount > 0 ? `${completedCount}/` : ''}{week.actions.length}
          </span>
        )}
        {hasActions && (
          <span
            style={{
              fontSize: 9,
              color: MUTED,
              transition: 'transform 0.15s',
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          >
            &#9654;
          </span>
        )}
      </button>

      {expanded && hasActions && (
        <div
          style={{
            padding: '0 14px 12px 44px',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          {week.insight && (
            <p
              style={{
                fontSize: 11,
                color: '#8B8579',
                fontStyle: 'italic',
                margin: '0 0 4px 0',
                lineHeight: 1.5,
              }}
            >
              {week.insight}
            </p>
          )}
          {week.actions.map((a, i) => (
            <ActionRow
              key={i}
              action={a}
              onToggleComplete={() => onToggleComplete(i)}
              onRemove={() => onRemove(i)}
            />
          ))}

          {/* Add action UI */}
          {!adding ? (
            <button
              onClick={() => setAdding(true)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 11,
                color: MUTED,
                cursor: 'pointer',
                padding: '4px 0',
                textAlign: 'left',
                opacity: 0.6,
              }}
            >
              + Add action
            </button>
          ) : (
            <div
              style={{
                display: 'flex',
                gap: 6,
                alignItems: 'center',
                marginTop: 4,
              }}
            >
              <select
                value={newFormat}
                onChange={(e) => setNewFormat(e.target.value as ContentAction['format'])}
                style={{
                  fontSize: 11,
                  padding: '3px 4px',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 4,
                  background: SOFT,
                  color: INK,
                }}
              >
                <option value="video">Video</option>
                <option value="short">Short</option>
                <option value="post">Post</option>
                <option value="live">Live</option>
                <option value="premiere">Premiere</option>
                <option value="community">Community</option>
              </select>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="Action title..."
                autoFocus
                style={{
                  flex: 1,
                  fontSize: 12,
                  padding: '3px 6px',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 4,
                  background: '#FFFFFF',
                  color: INK,
                  outline: 'none',
                }}
              />
              <button
                onClick={handleAdd}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 8px',
                  background: INK,
                  color: PAPER,
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Add
              </button>
              <button
                onClick={() => { setAdding(false); setNewTitle(''); }}
                style={{
                  fontSize: 11,
                  padding: '3px 6px',
                  background: 'none',
                  border: 'none',
                  color: MUTED,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActionRow({
  action,
  onToggleComplete,
  onRemove,
}: {
  action: ContentAction;
  onToggleComplete: () => void;
  onRemove: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const icon = FORMAT_ICON[action.format] ?? '';
  const done = !!action.completed;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        padding: '3px 0',
      }}
    >
      {/* Completion toggle */}
      <button
        onClick={onToggleComplete}
        title={done ? 'Mark incomplete' : 'Mark complete'}
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          border: `1.5px solid ${done ? '#1FBE7A' : BORDER}`,
          background: done ? '#1FBE7A' : 'transparent',
          cursor: 'pointer',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          fontSize: 9,
          color: '#FFFFFF',
          lineHeight: 1,
        }}
      >
        {done ? '✓' : ''}
      </button>

      <span style={{ fontSize: 11, flexShrink: 0, opacity: done ? 0.4 : 0.7 }}>{icon}</span>
      <span
        style={{
          flex: 1,
          color: done ? MUTED : INK,
          fontWeight: 500,
          textDecoration: done ? 'line-through' : 'none',
          opacity: done ? 0.6 : 1,
        }}
      >
        {action.title}
        {action.custom && (
          <span style={{ fontSize: 9, color: MUTED, marginLeft: 6, fontStyle: 'italic' }}>
            custom
          </span>
        )}
      </span>
      {action.day !== 0 && (
        <span style={{ fontSize: 10, color: MUTED, opacity: done ? 0.5 : 1 }}>
          {action.day > 0 ? `+${action.day}d` : `${action.day}d`}
        </span>
      )}

      {/* Remove button — only visible on hover */}
      <button
        onClick={onRemove}
        title="Remove action"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 12,
          color: '#D4716A',
          padding: '0 2px',
          opacity: hovered ? 0.7 : 0,
          transition: 'opacity 0.15s',
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
      <span style={{ color: MUTED, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span style={{ fontWeight: 700, color: color ?? INK, fontSize: 13 }}>{value}</span>
    </span>
  );
}

function Sep() {
  return <span style={{ width: 1, height: 14, background: BORDER, flexShrink: 0 }} />;
}

function SmallButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: SOFT,
        border: 'none',
        borderRadius: 5,
        padding: '4px 10px',
        fontSize: 11,
        fontWeight: 600,
        color: MUTED,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function detectCurrentPhase(plan: GeneratedPlan): PhaseName | null {
  // Try to determine where "now" falls in the campaign
  const now = new Date();
  const weeks = plan.weeks;
  if (weeks.length === 0) return null;

  // Parse the first week's date range to get campaign start
  for (const week of weeks) {
    const match = week.dateRange.match(/^(\w+)\s+(\d+)/);
    if (!match) continue;
    const [, monthStr, dayStr] = match;
    const monthMap: Record<string, number> = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
    };
    const month = monthMap[monthStr];
    if (month == null) continue;
    const day = parseInt(dayStr, 10);
    const weekDate = new Date(now.getFullYear(), month, day);
    // If this week contains today (within ~7 days)
    const diff = (now.getTime() - weekDate.getTime()) / 86400000;
    if (diff >= -1 && diff <= 7) {
      return week.phase;
    }
  }

  return null;
}
