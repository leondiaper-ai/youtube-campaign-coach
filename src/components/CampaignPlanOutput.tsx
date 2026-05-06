'use client';

import { useState } from 'react';
import type {
  GeneratedPlan,
  PlanWeek,
  Watchout,
  Opportunity,
  PhaseName,
  ContentAction,
} from '@/lib/planEngine';

// ── Colours ──────────────────────────────────────────────────────────────

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const BORDER = '#E8E3DA';
const MUTED = '#9B9589';

const PHASE_COLOR: Record<PhaseName, string> = {
  BUILD: '#6366F1',   // indigo
  RELEASE: '#FF4A1C', // signal red
  SCALE: '#1FBE7A',   // mint
  EXTEND: '#F59E0B',  // amber
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

const INTENT_LABEL: Record<string, { text: string; color: string; bg: string }> = {
  tease: { text: 'TEASE', color: '#6366F1', bg: '#EEF2FF' },
  engage: { text: 'ENGAGE', color: '#059669', bg: '#ECFDF5' },
  convert: { text: 'CONVERT', color: '#DC2626', bg: '#FEF2F2' },
  distribute: { text: 'DISTRIBUTE', color: '#D97706', bg: '#FFFBEB' },
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
    // Auto-expand weeks with actions
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

  const expandAll = () => {
    setExpandedWeeks(new Set(plan.weeks.map((w) => w.weekNum)));
  };

  const collapseAll = () => {
    setExpandedWeeks(new Set());
  };

  const activeWeeks = plan.weeks.filter((w) => w.actions.length > 0);
  const totalActions = plan.weeks.reduce((s, w) => s + w.actions.length, 0);
  const shorts = plan.weeks.reduce(
    (s, w) => s + w.actions.filter((a) => a.format === 'short').length,
    0
  );
  const videos = plan.weeks.reduce(
    (s, w) => s + w.actions.filter((a) => a.format === 'video' || a.format === 'premiere').length,
    0
  );

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Back button */}
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
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        ← New plan
      </button>

      {/* ── Campaign Header ─────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: MUTED,
            marginBottom: 6,
          }}
        >
          Generated Plan
        </div>
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
        <div
          style={{
            display: 'flex',
            gap: 16,
            marginTop: 10,
            fontSize: 12,
            color: MUTED,
          }}
        >
          <span>{plan.totalWeeks} weeks</span>
          <span>{plan.events.length} key moments</span>
          <span>{totalActions} actions</span>
          <span>{videos} videos · {shorts} Shorts</span>
        </div>
      </div>

      {/* ── Strategy ─────────────────────────────────────────────── */}
      <Section title="Campaign Strategy">
        <div
          style={{
            background: '#FFFFFF',
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            padding: '16px 20px',
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: INK,
              marginBottom: 6,
              lineHeight: 1.4,
            }}
          >
            {plan.strategy.priority}
          </div>
          <div style={{ fontSize: 13, color: '#5A5650', lineHeight: 1.6 }}>
            {plan.strategy.approach}
          </div>
        </div>
      </Section>

      {/* ── Phase Bar ─────────────────────────────────────────────── */}
      <Section title="Campaign Phases">
        <div
          style={{
            display: 'flex',
            gap: 2,
            borderRadius: 8,
            overflow: 'hidden',
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
                  padding: '8px 12px',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.12em',
                    color: PHASE_COLOR[p.name],
                    textTransform: 'uppercase',
                  }}
                >
                  {p.name}
                </div>
                <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>
                  Wk {p.weekStart}–{p.weekEnd}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── Watchouts ────────────────────────────────────────────── */}
      {plan.watchouts.length > 0 && (
        <Section title="Watchouts">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {plan.watchouts.map((w, i) => (
              <WatchoutRow key={i} watchout={w} />
            ))}
          </div>
        </Section>
      )}

      {/* ── Opportunities ────────────────────────────────────────── */}
      {plan.opportunities.length > 0 && (
        <Section title="YouTube Opportunities">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 8,
            }}
          >
            {plan.opportunities.map((o, i) => (
              <OpportunityCard key={i} opp={o} />
            ))}
          </div>
        </Section>
      )}

      {/* ── Weekly Plan ──────────────────────────────────────────── */}
      <Section
        title="Weekly Plan"
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <SmallButton onClick={expandAll} label="Expand all" />
            <SmallButton onClick={collapseAll} label="Collapse" />
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {plan.weeks.map((week) => (
            <WeekRow
              key={week.weekNum}
              week={week}
              expanded={expandedWeeks.has(week.weekNum)}
              onToggle={() => toggleWeek(week.weekNum)}
            />
          ))}
        </div>
      </Section>

      {/* ── Key Moments ──────────────────────────────────────────── */}
      <Section title="Key Moments">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {plan.events.map((e, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '6px 0',
                fontSize: 13,
              }}
            >
              <span style={{ color: MUTED, fontSize: 12, minWidth: 70 }}>
                {formatDate(e.dateISO)}
              </span>
              <KindBadge kind={e.kind} />
              <span style={{ color: INK, fontWeight: 500 }}>{e.title}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function Section({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <h2
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: INK,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            margin: 0,
          }}
        >
          {title}
        </h2>
        {right}
      </div>
      {children}
    </div>
  );
}

function WatchoutRow({ watchout }: { watchout: Watchout }) {
  const isHigh = watchout.severity === 'high';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 8,
        background: isHigh ? '#FEF2F2' : '#FFFBEB',
        border: `1px solid ${isHigh ? '#FECACA' : '#FDE68A'}`,
        fontSize: 13,
        lineHeight: 1.5,
        color: isHigh ? '#991B1B' : '#92400E',
      }}
    >
      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>
        {isHigh ? '⚠️' : '⚡'}
      </span>
      <span>{watchout.text}</span>
    </div>
  );
}

function OpportunityCard({ opp }: { opp: Opportunity }) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        padding: '12px 14px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 14 }}>{opp.icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>
          {opp.title}
        </span>
      </div>
      <div style={{ fontSize: 12, color: '#5A5650', lineHeight: 1.5 }}>
        {opp.reason}
      </div>
    </div>
  );
}

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

  return (
    <div
      style={{
        background: hasActions ? '#FFFFFF' : 'transparent',
        border: hasActions ? `1px solid ${BORDER}` : `1px solid transparent`,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: hasActions ? '10px 14px' : '6px 14px',
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

        {/* Week number */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: MUTED,
            minWidth: 30,
          }}
        >
          W{week.weekNum}
        </span>

        {/* Date range */}
        <span style={{ fontSize: 12, color: MUTED, minWidth: 120 }}>
          {week.dateRange}
        </span>

        {/* Phase badge */}
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: '0.08em',
            color: phaseColor,
            background: PHASE_BG[week.phase],
            padding: '2px 6px',
            borderRadius: 3,
            textTransform: 'uppercase',
          }}
        >
          {week.phase}
        </span>

        {/* Moment name */}
        {week.momentName && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
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

        {!week.momentName && <span style={{ flex: 1 }} />}

        {/* Action count */}
        {hasActions && (
          <span style={{ fontSize: 11, color: MUTED }}>
            {week.actions.length} action{week.actions.length !== 1 ? 's' : ''}
          </span>
        )}

        {/* Chevron */}
        {hasActions && (
          <span
            style={{
              fontSize: 10,
              color: MUTED,
              transition: 'transform 0.15s',
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          >
            ▶
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
            gap: 4,
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
  const intent = INTENT_LABEL[action.intent] ?? INTENT_LABEL.engage;
  const icon = FORMAT_ICON[action.format] ?? '📋';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        padding: '4px 0',
      }}
    >
      <span style={{ fontSize: 12, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, color: INK, fontWeight: 500 }}>
        {action.title}
      </span>
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.06em',
          color: intent.color,
          background: intent.bg,
          padding: '1px 5px',
          borderRadius: 3,
        }}
      >
        {intent.text}
      </span>
      {action.day !== 0 && (
        <span style={{ fontSize: 10, color: MUTED }}>
          {action.day > 0 ? `+${action.day}d` : `${action.day}d`}
        </span>
      )}
    </div>
  );
}

function KindBadge({ kind }: { kind: string }) {
  const label = kind
    .replace(/([A-Z])/g, ' $1')
    .replace(/^\s/, '')
    .toLowerCase();
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: MUTED,
        background: SOFT,
        padding: '2px 6px',
        borderRadius: 3,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function SmallButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
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

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
