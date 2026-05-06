'use client';

import { useState } from 'react';
import type {
  GeneratedPlan,
  PlanWeek,
  PhaseName,
  ContentAction,
} from '@/lib/planEngine';

// ── Colours ──────────────────────────────────────────────────────────────

const INK = '#0E0E0E';
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

// ── Main Component ──────────────────────────────────────────────────────

export default function CampaignPlanOutput({
  plan,
  onBack,
}: {
  plan: GeneratedPlan;
  onBack: () => void;
}) {
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(() => {
    const s = new Set<number>();
    plan.weeks.forEach((w) => {
      if (w.actions.length > 0) s.add(w.weekNum);
    });
    return s;
  });

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

  const activeWeeks = plan.weeks.filter((w) => w.actions.length > 0);
  const totalActions = plan.weeks.reduce((s, w) => s + w.actions.length, 0);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Back */}
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          color: MUTED,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          padding: '4px 0',
          marginBottom: 24,
        }}
      >
        &larr; New plan
      </button>

      {/* ── Header ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 8 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: INK,
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {plan.campaignName}
        </h1>
        <p
          style={{
            fontSize: 14,
            color: '#5A5650',
            lineHeight: 1.5,
            marginTop: 8,
            marginBottom: 0,
            maxWidth: 580,
          }}
        >
          {plan.strategy.priority} {plan.strategy.approach}
        </p>
      </div>

      {/* ── Phase strip ───────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          borderRadius: 6,
          overflow: 'hidden',
          marginBottom: 28,
          marginTop: 16,
        }}
      >
        {plan.phases.map((p) => {
          const span = p.weekEnd - p.weekStart + 1;
          const pct = (span / plan.totalWeeks) * 100;
          return (
            <div
              key={p.name}
              style={{
                flex: `0 0 ${pct}%`,
                background: PHASE_BG[p.name],
                padding: '6px 10px',
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
            </div>
          );
        })}
      </div>

      {/* ── Stats line ────────────────────────────────────────────── */}
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

      {/* ── Timeline (THE HERO) ───────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {plan.weeks.map((week) => (
          <WeekRow
            key={week.weekNum}
            week={week}
            expanded={expandedWeeks.has(week.weekNum)}
            onToggle={() => toggleWeek(week.weekNum)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function WeekRow({
  week,
  expanded,
  onToggle,
}: {
  week: PlanWeek;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasActions = week.actions.length > 0;
  const phaseColor = PHASE_COLOR[week.phase];
  const isMoment = !!week.momentName;

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
        {/* Phase dot */}
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: phaseColor,
            flexShrink: 0,
          }}
        />

        {/* Week */}
        <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, minWidth: 30 }}>
          W{week.weekNum}
        </span>

        {/* Date range */}
        <span style={{ fontSize: 12, color: MUTED, minWidth: 120 }}>
          {week.dateRange}
        </span>

        {/* Moment name — this is the star */}
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

        {/* Action count */}
        {hasActions && (
          <span style={{ fontSize: 11, color: MUTED }}>
            {week.actions.length}
          </span>
        )}

        {/* Chevron */}
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

      {/* Expanded actions */}
      {expanded && hasActions && (
        <div
          style={{
            padding: '0 14px 12px 44px',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          {week.actions.map((a, i) => (
            <ActionRow key={i} action={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActionRow({ action }: { action: ContentAction }) {
  const icon = FORMAT_ICON[action.format] ?? '';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        padding: '3px 0',
      }}
    >
      <span style={{ fontSize: 11, flexShrink: 0, opacity: 0.7 }}>{icon}</span>
      <span style={{ flex: 1, color: INK, fontWeight: 500 }}>{action.title}</span>
      {action.day !== 0 && (
        <span style={{ fontSize: 10, color: MUTED }}>
          {action.day > 0 ? `+${action.day}d` : `${action.day}d`}
        </span>
      )}
    </div>
  );
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
