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
import type { MatchResult, MatchedAction, MatchedWeek, ExecutionStatus } from '@/lib/coach/matchEngine';
import type { Nudge, NudgeUrgency } from '@/lib/coach/nudgeEngine';
import type { RecentUpload } from '@/lib/artists';
import { fmtNum } from '@/lib/artists';

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

const PHASE_LABEL: Record<PhaseName, string> = {
  BUILD: 'Building momentum',
  RELEASE: 'Release window',
  SCALE: 'Scaling reach',
  EXTEND: 'Extending lifecycle',
};

// ── Props ──────────────────────────────────────────────────────────────────

type CampaignDestinationProps = {
  plan: GeneratedPlan;
  channelCtx: ChannelContext | null;
  createdAt: string;
  slug: string;
  liveChannel?: {
    subs?: number;
    views?: number;
    uploads30d?: number;
    shorts30d?: number;
    lastUploadDaysAgo?: number;
    views7Delta?: number | null;
    subs7Delta?: number | null;
  } | null;
  matchResult?: MatchResult;
  nudges?: Nudge[];
  recentUploads?: RecentUpload[];
};

// ── Pulse Signal Types ─────────────────────────────────────────────────────

type PulseSignal = {
  text: string;
  urgency: 'positive' | 'neutral' | 'warning' | 'critical';
};

// ── Moment Types ───────────────────────────────────────────────────────────

type CampaignMoment = {
  weekNum: number;
  momentName: string;
  dateRange: string;
  phase: PhaseName;
  timing: 'past' | 'current' | 'upcoming';
  daysAway: number;
  actions: MatchedAction[];
  extraUploads: RecentUpload[];
  // Derived
  primaryUpload: RecentUpload | null;
  supportDone: string[];
  supportMissing: string[];
  supportPlanned: string[];
  totalViews: number;
};

// ── Main Component ─────────────────────────────────────────────────────────

export default function CampaignDestination({
  plan,
  channelCtx,
  createdAt,
  slug,
  liveChannel,
  matchResult,
  nudges,
  recentUploads,
}: CampaignDestinationProps) {
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const currentPhase = detectCurrentPhase(plan);
  const pulseSignals = generatePulseSignals(matchResult, liveChannel, recentUploads ?? [], currentPhase, plan);
  const moments = extractMoments(plan, matchResult);
  const activeMoment = moments.find((m) => m.timing === 'current') ?? moments.find((m) => m.timing === 'past');
  const nextMoment = moments.find((m) => m.timing === 'upcoming');
  const attentionItems = buildAttentionItems(nudges ?? [], matchResult, liveChannel);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ minHeight: '100vh', background: PAPER, color: INK }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px' }}>

        {/* ── Top nav ─────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 0', borderBottom: `1px solid ${BORDER}`,
        }}>
          <Link href="/coach" style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: MUTED, textDecoration: 'none',
          }}>
            YouTube Campaign System
          </Link>
          <Link href="/coach" style={{
            fontSize: 11, fontWeight: 600, color: MUTED,
            textDecoration: 'none', padding: '4px 10px',
            borderRadius: 5, background: SOFT,
          }}>
            All Campaigns
          </Link>
        </div>

        {/* ══════════════════════════════════════════════════════════
            1. HERO
        ══════════════════════════════════════════════════════════ */}
        <div style={{ paddingTop: 48, paddingBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: MUTED,
            }}>
              {plan.artist}
            </span>
            {currentPhase && (
              <>
                <span style={{ color: BORDER }}>·</span>
                <span style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: PHASE_COLOR[currentPhase],
                }}>
                  {currentPhase}
                </span>
              </>
            )}
          </div>
          <h1 style={{
            fontSize: 36, fontWeight: 900, color: INK, margin: 0,
            lineHeight: 1.1, letterSpacing: '-0.01em',
          }}>
            {plan.campaignName.replace(/ Campaign$/i, '')}
          </h1>
          <p style={{
            fontSize: 15, color: '#5A5650', lineHeight: 1.55,
            marginTop: 10, marginBottom: 0, maxWidth: 560,
          }}>
            {plan.strategy.priority}
          </p>
        </div>

        {/* ══════════════════════════════════════════════════════════
            2. LIVE CAMPAIGN PULSE
        ══════════════════════════════════════════════════════════ */}
        {pulseSignals.length > 0 && (
          <div style={{
            background: '#FFFFFF', border: `1px solid ${BORDER}`,
            borderRadius: 10, padding: '16px 20px', marginBottom: 24,
          }}>
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: MUTED, marginBottom: 12,
            }}>
              Campaign Pulse
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pulseSignals.map((sig, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                    background: sig.urgency === 'positive' ? '#1FBE7A'
                      : sig.urgency === 'warning' ? '#F59E0B'
                      : sig.urgency === 'critical' ? '#DC2626'
                      : '#C4BDB0',
                  }} />
                  <span style={{
                    fontSize: 14, lineHeight: 1.45, fontWeight: 500,
                    color: sig.urgency === 'critical' ? '#991B1B' : INK,
                  }}>
                    {sig.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Channel metrics strip ───────────────────────────────── */}
        {liveChannel && (
          <div style={{
            display: 'flex', gap: 20, padding: '12px 20px',
            background: SOFT, borderRadius: 8, marginBottom: 24,
            flexWrap: 'wrap', fontSize: 12,
          }}>
            {liveChannel.subs != null && (
              <MetricChip label="Subscribers" value={fmtNum(liveChannel.subs)} />
            )}
            {liveChannel.views7Delta != null && (
              <MetricChip
                label="Views 7d"
                value={`${liveChannel.views7Delta >= 0 ? '+' : ''}${fmtNum(liveChannel.views7Delta)}`}
                color={liveChannel.views7Delta > 0 ? '#0C6A3F' : liveChannel.views7Delta < 0 ? '#991B1B' : undefined}
              />
            )}
            {liveChannel.subs7Delta != null && (
              <MetricChip
                label="Subs 7d"
                value={`${liveChannel.subs7Delta >= 0 ? '+' : ''}${fmtNum(liveChannel.subs7Delta)}`}
                color={liveChannel.subs7Delta > 0 ? '#0C6A3F' : undefined}
              />
            )}
            {liveChannel.uploads30d != null && (
              <MetricChip label="Uploads 30d" value={String(liveChannel.uploads30d)} />
            )}
            {liveChannel.lastUploadDaysAgo != null && (
              <MetricChip
                label="Last upload"
                value={`${liveChannel.lastUploadDaysAgo}d ago`}
                color={liveChannel.lastUploadDaysAgo > 14 ? '#991B1B' : undefined}
              />
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            3. BIG CURRENT MOMENT
        ══════════════════════════════════════════════════════════ */}
        {activeMoment && (
          <MomentBlock moment={activeMoment} label="Current Moment" />
        )}
        {nextMoment && nextMoment !== activeMoment && (
          <MomentBlock moment={nextMoment} label="Next Moment" compact />
        )}

        {/* ══════════════════════════════════════════════════════════
            4. WHAT NEEDS ATTENTION NOW
        ══════════════════════════════════════════════════════════ */}
        {attentionItems.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: MUTED, marginBottom: 10,
            }}>
              Needs Attention
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {attentionItems.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                  padding: '10px 16px', borderRadius: 8,
                  background: item.urgency === 'critical' ? '#FEF2F2'
                    : item.urgency === 'important' ? '#FFFBEB' : '#F8FAFC',
                  border: `1px solid ${
                    item.urgency === 'critical' ? '#FECACA'
                    : item.urgency === 'important' ? '#FDE68A' : BORDER
                  }`,
                }}>
                  <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>
                    {item.urgency === 'critical' ? '⚠' : item.urgency === 'important' ? '→' : '○'}
                  </span>
                  <span style={{
                    fontSize: 13, lineHeight: 1.5, fontWeight: 500,
                    color: item.urgency === 'critical' ? '#991B1B'
                      : item.urgency === 'important' ? '#78350F' : '#374151',
                  }}>
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            5. CAMPAIGN TIMELINE (System 2 — collapsed by default)
        ══════════════════════════════════════════════════════════ */}
        <div style={{
          borderTop: `1px solid ${BORDER}`, paddingTop: 20, marginBottom: 28,
        }}>
          <button
            onClick={() => setTimelineOpen(!timelineOpen)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', background: 'none', border: 'none', cursor: 'pointer',
              padding: 0, marginBottom: timelineOpen ? 16 : 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: MUTED,
              }}>
                Campaign Timeline
              </span>
              <span style={{ fontSize: 11, color: MUTED }}>
                {plan.totalWeeks} weeks · {plan.events.length} moments · {matchResult
                  ? `${Math.round(matchResult.stats.completionRate)}% executed`
                  : `${plan.weeks.reduce((s, w) => s + w.actions.length, 0)} actions`}
              </span>
            </div>
            <span style={{
              fontSize: 11, color: MUTED, transition: 'transform 0.15s',
              transform: timelineOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            }}>
              ▶
            </span>
          </button>

          {/* Phase progress strip (always visible) */}
          <div style={{ display: 'flex', gap: 2, borderRadius: 6, overflow: 'hidden', marginTop: 10 }}>
            {plan.phases.map((p) => {
              const span = p.weekEnd - p.weekStart + 1;
              const pct = (span / plan.totalWeeks) * 100;
              const isCurrent = currentPhase === p.name;
              return (
                <div key={p.name} style={{
                  flex: `0 0 ${pct}%`, padding: '5px 8px',
                  background: isCurrent ? PHASE_COLOR[p.name] + '18' : SOFT,
                  borderBottom: isCurrent ? `2px solid ${PHASE_COLOR[p.name]}` : '2px solid transparent',
                }}>
                  <span style={{
                    fontSize: 8, fontWeight: 800, letterSpacing: '0.1em',
                    color: isCurrent ? PHASE_COLOR[p.name] : MUTED,
                    textTransform: 'uppercase',
                  }}>
                    {p.name}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Expanded timeline */}
          {timelineOpen && (
            <TimelineDetail plan={plan} matchResult={matchResult} currentPhase={currentPhase} />
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════
            6. COPY / EXPORT
        ══════════════════════════════════════════════════════════ */}
        <div style={{
          borderTop: `1px solid ${BORDER}`, paddingTop: 20, paddingBottom: 48,
        }}>
          <div style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: MUTED, marginBottom: 12,
          }}>
            Generate & Share
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { id: 'summary', label: 'Campaign Summary' },
              { id: 'update', label: 'Management Update' },
              { id: 'brief', label: 'YouTube Brief' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setExportOpen(exportOpen === id ? null : id)}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '8px 16px',
                  background: exportOpen === id ? INK : '#FFFFFF',
                  color: exportOpen === id ? PAPER : INK,
                  border: `1px solid ${exportOpen === id ? INK : BORDER}`,
                  borderRadius: 6, cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {exportOpen && (
            <div style={{
              marginTop: 12, background: '#FFFFFF', border: `1px solid ${BORDER}`,
              borderRadius: 8, overflow: 'hidden',
            }}>
              <pre style={{
                padding: '16px 20px', fontSize: 12, lineHeight: 1.6,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                margin: 0, color: '#374151', fontFamily: 'inherit',
                maxHeight: 400, overflow: 'auto',
              }}>
                {generateExportText(exportOpen, plan, matchResult, liveChannel, currentPhase, moments)}
              </pre>
              <div style={{
                padding: '8px 16px', borderTop: `1px solid ${BORDER}`,
                display: 'flex', justifyContent: 'flex-end',
              }}>
                <button
                  onClick={() => copyToClipboard(
                    generateExportText(exportOpen, plan, matchResult, liveChannel, currentPhase, moments)
                  )}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: '5px 14px',
                    background: copied ? '#ECFDF5' : INK,
                    color: copied ? '#0C6A3F' : PAPER,
                    border: 'none', borderRadius: 5, cursor: 'pointer',
                  }}
                >
                  {copied ? '✓ Copied' : 'Copy to clipboard'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div style={{
          padding: '20px 0 32px', borderTop: `1px solid ${BORDER}`,
          fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: '#D1C9BD',
        }}>
          YouTube Campaign System
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MOMENT BLOCK — The hero of the page
// ══════════════════════════════════════════════════════════════════════════════

function MomentBlock({ moment, label, compact }: {
  moment: CampaignMoment;
  label: string;
  compact?: boolean;
}) {
  const isLive = moment.timing === 'current';
  const isPast = moment.timing === 'past';
  const isUpcoming = moment.timing === 'upcoming';

  const statusLabel = isLive ? 'LIVE' : isPast ? 'COMPLETED' : 'UPCOMING';
  const statusColor = isLive ? '#1D4ED8' : isPast ? '#0C6A3F' : MUTED;
  const statusBg = isLive ? '#EFF6FF' : isPast ? '#ECFDF5' : SOFT;

  return (
    <div style={{
      background: '#FFFFFF',
      border: `1px solid ${isLive ? '#BFDBFE' : BORDER}`,
      borderRadius: 10,
      padding: compact ? '14px 20px' : '20px 24px',
      marginBottom: 20,
      ...(isLive ? { boxShadow: '0 0 0 1px rgba(29,78,216,0.1)' } : {}),
    }}>
      {/* Label + status */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: compact ? 8 : 12,
      }}>
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: MUTED,
        }}>
          {label} · {moment.dateRange}
        </span>
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
          textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4,
          background: statusBg, color: statusColor,
        }}>
          {statusLabel}
        </span>
      </div>

      {/* Moment title */}
      <h2 style={{
        fontSize: compact ? 18 : 24, fontWeight: 800, margin: 0,
        lineHeight: 1.2, color: INK,
      }}>
        {moment.momentName}
      </h2>

      {/* Primary upload stats */}
      {moment.primaryUpload && !compact && (
        <div style={{
          marginTop: 8, fontSize: 13, color: '#0C6A3F', fontWeight: 600,
        }}>
          {fmtNum(moment.primaryUpload.viewCount)} views
          {moment.totalViews > moment.primaryUpload.viewCount && (
            <span style={{ color: MUTED, fontWeight: 400 }}>
              {' '}· {fmtNum(moment.totalViews)} total across support content
            </span>
          )}
        </div>
      )}

      {/* Support status — the key readout */}
      {!compact && moment.actions.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14,
        }}>
          {moment.supportDone.map((title, i) => (
            <SupportChip key={`done-${i}`} title={title} status="done" />
          ))}
          {moment.supportMissing.map((title, i) => (
            <SupportChip key={`miss-${i}`} title={title} status="missing" />
          ))}
          {moment.supportPlanned.map((title, i) => (
            <SupportChip key={`plan-${i}`} title={title} status="planned" />
          ))}
        </div>
      )}

      {/* Compact: just show counts */}
      {compact && moment.actions.length > 0 && (
        <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>
          {moment.supportDone.length > 0 && (
            <span style={{ color: '#0C6A3F' }}>{moment.supportDone.length} done</span>
          )}
          {moment.supportPlanned.length > 0 && (
            <span style={{ marginLeft: moment.supportDone.length > 0 ? 10 : 0 }}>
              {moment.supportPlanned.length} planned
            </span>
          )}
        </div>
      )}

      {/* Editorial next step */}
      {!compact && moment.supportMissing.length > 0 && (
        <p style={{
          fontSize: 13, color: '#78350F', fontWeight: 500,
          marginTop: 12, marginBottom: 0, lineHeight: 1.5,
          padding: '8px 12px', background: '#FFFBEB', borderRadius: 6,
        }}>
          → {buildMomentGuidance(moment)}
        </p>
      )}

      {/* Extra uploads */}
      {!compact && moment.extraUploads.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${BORDER}` }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: '#7C3AED',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            Extra uploads
          </span>
          {moment.extraUploads.map((u) => (
            <div key={u.id} style={{
              fontSize: 12, color: '#5A5650', marginTop: 4,
              display: 'flex', gap: 6, alignItems: 'center',
            }}>
              <span style={{ opacity: 0.6 }}>{u.durationSec <= 62 ? '⚡' : '🎬'}</span>
              <span style={{ flex: 1 }}>{u.title}</span>
              <span style={{ fontSize: 10, color: MUTED }}>{fmtNum(u.viewCount)} views</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SupportChip({ title, status }: { title: string; status: 'done' | 'missing' | 'planned' }) {
  const icon = status === 'done' ? '✓' : status === 'missing' ? '⚠' : '○';
  const bg = status === 'done' ? '#ECFDF5' : status === 'missing' ? '#FEF2F2' : '#F9FAFB';
  const fg = status === 'done' ? '#0C6A3F' : status === 'missing' ? '#DC2626' : '#6B7280';
  const border = status === 'done' ? '#D1FAE5' : status === 'missing' ? '#FECACA' : '#E5E7EB';

  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 10px',
      borderRadius: 5, background: bg, color: fg,
      border: `1px solid ${border}`,
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      <span style={{ fontSize: 10 }}>{icon}</span> {title}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TIMELINE DETAIL — System 2 reference layer
// ══════════════════════════════════════════════════════════════════════════════

function TimelineDetail({ plan, matchResult, currentPhase }: {
  plan: GeneratedPlan;
  matchResult?: MatchResult;
  currentPhase: PhaseName | null;
}) {
  const weeks = matchResult?.weeks ?? plan.weeks;

  // Group by phase
  const phases = plan.phases.map((p) => ({
    ...p,
    weeks: weeks.filter((w) => w.weekNum >= p.weekStart && w.weekNum <= p.weekEnd),
  }));

  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {phases.map((phase) => {
        const isCurrent = currentPhase === phase.name;
        const phaseWeeks = phase.weeks.filter((w) => w.actions.length > 0 || w.momentName);

        if (phaseWeeks.length === 0) return null;

        return (
          <div key={phase.name}>
            <div style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
              textTransform: 'uppercase', marginBottom: 6,
              color: isCurrent ? PHASE_COLOR[phase.name] : MUTED,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {phase.name}
              <span style={{
                fontSize: 9, fontWeight: 600, letterSpacing: '0.04em',
                textTransform: 'none', color: MUTED,
              }}>
                Wk {phase.weekStart}–{phase.weekEnd}
              </span>
              {isCurrent && (
                <span style={{
                  fontSize: 8, fontWeight: 800, background: PHASE_COLOR[phase.name],
                  color: '#FFFFFF', padding: '1px 6px', borderRadius: 3,
                }}>
                  NOW
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {phaseWeeks.map((week) => (
                <TimelineWeekRow key={week.weekNum} week={week} matchResult={matchResult} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimelineWeekRow({ week, matchResult }: {
  week: PlanWeek | MatchedWeek;
  matchResult?: MatchResult;
}) {
  const [expanded, setExpanded] = useState(false);
  const matchedWeek = matchResult ? (week as MatchedWeek) : null;
  const actions = matchedWeek?.actions ?? week.actions;
  const isMoment = !!week.momentName;
  const isCurrent = isCurrentWeek(week);

  // Compute stats
  const done = actions.filter((a) =>
    'status' in a ? ((a as MatchedAction).status === 'completed' || (a as MatchedAction).status === 'live') : a.completed
  ).length;
  const issues = actions.filter((a) =>
    'status' in a && ((a as MatchedAction).status === 'late' || (a as MatchedAction).status === 'missing')
  ).length;

  return (
    <div style={{
      background: isCurrent ? '#FFFFFF' : 'transparent',
      border: isCurrent ? `1px solid ${BORDER}` : 'none',
      borderRadius: 6,
    }}>
      <button
        onClick={() => actions.length > 0 && setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '5px 10px', background: 'none', border: 'none',
          cursor: actions.length > 0 ? 'pointer' : 'default', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, minWidth: 28 }}>
          W{week.weekNum}
        </span>
        <span style={{ fontSize: 11, color: MUTED, minWidth: 90 }}>
          {week.dateRange}
        </span>
        <span style={{
          fontSize: 12, fontWeight: isMoment ? 700 : 400,
          color: isMoment ? INK : MUTED, flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {week.momentName ?? (actions.length > 0 ? `${actions.length} actions` : '')}
        </span>
        {actions.length > 0 && (
          <span style={{ fontSize: 10, color: MUTED, display: 'flex', gap: 4, alignItems: 'center' }}>
            {done > 0 && <span style={{ color: '#0C6A3F', fontWeight: 700 }}>{done}✓</span>}
            {issues > 0 && <span style={{ color: '#DC2626', fontWeight: 700 }}>{issues}!</span>}
            <span style={{ fontSize: 8, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
          </span>
        )}
      </button>

      {expanded && (
        <div style={{ padding: '0 10px 8px 48px' }}>
          {actions.map((a, i) => {
            const matched = 'status' in a ? (a as MatchedAction) : null;
            const status: ExecutionStatus = matched?.status ?? (a.completed ? 'completed' : 'planned');
            const isDone = status === 'completed' || status === 'live';
            const isLate = status === 'late';
            const isMissing = status === 'missing';
            const icon = a.format === 'short' ? '⚡' : a.format === 'video' || a.format === 'premiere' ? '🎬' : a.format === 'live' ? '📡' : '📝';

            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12, padding: '2px 0',
                color: isDone ? MUTED : isLate ? '#DC2626' : isMissing ? '#C2410C' : INK,
                textDecoration: isDone ? 'line-through' : 'none',
                opacity: isDone ? 0.6 : 1,
              }}>
                <span style={{ fontSize: 10, opacity: 0.7 }}>{icon}</span>
                <span style={{ flex: 1 }}>{a.title}</span>
                {matched?.matchedUpload && (
                  <span style={{ fontSize: 10, color: '#0C6A3F' }}>{fmtNum(matched.matchedUpload.viewCount)} views</span>
                )}
                {(isLate || isMissing) && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                    background: isLate ? '#FEF2F2' : '#FFF7ED',
                    color: isLate ? '#DC2626' : '#C2410C',
                    textTransform: 'uppercase',
                  }}>
                    {isLate ? 'Late' : 'Missing'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function MetricChip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <span style={{ fontWeight: 700, fontSize: 13, color: color ?? INK }}>{value}</span>
    </span>
  );
}

// ── Pulse Signal Generator ──────────────────────────────────────────────────
// Synthesizes campaign state into editorial language.

function generatePulseSignals(
  matchResult: MatchResult | undefined,
  liveChannel: CampaignDestinationProps['liveChannel'],
  recentUploads: RecentUpload[],
  currentPhase: PhaseName | null,
  plan: GeneratedPlan,
): PulseSignal[] {
  const signals: PulseSignal[] = [];

  // 1. Live uploads — what just happened
  if (matchResult) {
    const liveActions = matchResult.weeks
      .flatMap((w) => w.actions)
      .filter((a) => a.status === 'live' && a.matchedUpload);

    if (liveActions.length > 0) {
      const top = liveActions.sort(
        (a, b) => (b.matchedUpload?.viewCount ?? 0) - (a.matchedUpload?.viewCount ?? 0)
      )[0];
      const upload = top.matchedUpload!;
      const daysSince = Math.round(
        (Date.now() - new Date(upload.publishedAt).getTime()) / 86400000
      );
      signals.push({
        text: `${cleanTitle(top.title)} live${daysSince <= 1 ? ' today' : ` — ${fmtNum(upload.viewCount)} views in ${daysSince} days`}`,
        urgency: 'positive',
      });
    }
  }

  // 2. Recent uploads not in plan
  if (!signals.length && recentUploads.length > 0) {
    const recent = recentUploads.filter((u) => {
      const days = (Date.now() - new Date(u.publishedAt).getTime()) / 86400000;
      return days <= 5;
    });
    if (recent.length > 0) {
      const top = recent.sort((a, b) => b.viewCount - a.viewCount)[0];
      signals.push({
        text: `"${top.title}" uploaded — ${fmtNum(top.viewCount)} views`,
        urgency: 'positive',
      });
    }
  }

  // 3. Channel momentum
  if (liveChannel?.views7Delta != null) {
    if (liveChannel.views7Delta > 10000) {
      signals.push({
        text: `Channel momentum strong — ${fmtNum(liveChannel.views7Delta)} views this week`,
        urgency: 'positive',
      });
    } else if (liveChannel.views7Delta > 0) {
      signals.push({
        text: `+${fmtNum(liveChannel.views7Delta)} views this week`,
        urgency: 'neutral',
      });
    } else if (liveChannel.views7Delta < 0) {
      signals.push({
        text: 'Channel views declining this week',
        urgency: 'warning',
      });
    }
  }

  // 4. Upload cadence
  if (liveChannel) {
    const u30 = liveChannel.uploads30d ?? 0;
    const s30 = liveChannel.shorts30d ?? 0;
    if (u30 >= 8) {
      signals.push({ text: `Strong cadence — ${u30} uploads this month`, urgency: 'positive' });
    } else if (s30 >= 3 && u30 >= 3) {
      signals.push({ text: `${s30} shorts warming the channel this month`, urgency: 'positive' });
    } else if (u30 === 0) {
      signals.push({ text: 'No uploads this month', urgency: 'critical' });
    }
  }

  // 5. Content gap
  const lastUpload = liveChannel?.lastUploadDaysAgo;
  if (lastUpload != null && lastUpload > 10) {
    signals.push({
      text: `${lastUpload} days since last upload${currentPhase === 'RELEASE' ? ' — release window is open' : ''}`,
      urgency: lastUpload > 21 ? 'critical' : 'warning',
    });
  }

  // 6. Execution pressure
  if (matchResult) {
    const { stats } = matchResult;
    const pastDue = stats.completed + stats.live + stats.missing + stats.late;
    if (stats.late > 0) {
      signals.push({
        text: `${stats.late} planned upload${stats.late > 1 ? 's' : ''} significantly overdue`,
        urgency: 'critical',
      });
    } else if (pastDue >= 3 && stats.completionRate < 40) {
      signals.push({
        text: `Only ${Math.round(stats.completionRate)}% of planned content has landed`,
        urgency: 'warning',
      });
    }
  }

  // 7. Phase context
  if (currentPhase && signals.length < 5) {
    signals.push({
      text: PHASE_LABEL[currentPhase],
      urgency: 'neutral',
    });
  }

  // Cap at 5 signals, prioritize by urgency
  const order: Record<PulseSignal['urgency'], number> = {
    critical: 0, warning: 1, positive: 2, neutral: 3,
  };
  return signals
    .sort((a, b) => order[a.urgency] - order[b.urgency])
    .slice(0, 5);
}

// ── Moment Extraction ───────────────────────────────────────────────────────

function extractMoments(
  plan: GeneratedPlan,
  matchResult?: MatchResult,
): CampaignMoment[] {
  const now = new Date();

  return plan.weeks
    .filter((w) => w.momentName)
    .map((week) => {
      const weekStart = resolveWeekDate(week);
      const daysAway = weekStart
        ? Math.round((now.getTime() - weekStart.getTime()) / 86400000)
        : 0;

      let timing: CampaignMoment['timing'] = 'upcoming';
      if (daysAway >= 0 && daysAway <= 7) timing = 'current';
      else if (daysAway > 7) timing = 'past';

      // Get matched data if available
      const matchedWeek = matchResult?.weeks.find((w) => w.weekNum === week.weekNum);
      const actions: MatchedAction[] = matchedWeek
        ? matchedWeek.actions
        : week.actions.map((a) => ({ ...a, status: 'planned' as ExecutionStatus }));
      const extraUploads = matchedWeek?.extraUploads ?? [];

      // Find primary upload (the biggest matched upload by views)
      let primaryUpload: RecentUpload | null = null;
      const matchedUploads = actions
        .filter((a) => a.matchedUpload)
        .map((a) => a.matchedUpload!);
      if (matchedUploads.length > 0) {
        primaryUpload = matchedUploads.sort((a, b) => b.viewCount - a.viewCount)[0];
      }

      const totalViews = [
        ...matchedUploads.map((u) => u.viewCount),
        ...extraUploads.map((u) => u.viewCount),
      ].reduce((s, v) => s + v, 0);

      // Categorize support actions
      const supportDone = actions
        .filter((a) => a.status === 'completed' || a.status === 'live')
        .map((a) => cleanTitle(a.title));
      const supportMissing = actions
        .filter((a) => a.status === 'missing' || a.status === 'late')
        .map((a) => cleanTitle(a.title));
      const supportPlanned = actions
        .filter((a) => a.status === 'planned')
        .map((a) => cleanTitle(a.title));

      return {
        weekNum: week.weekNum,
        momentName: week.momentName!,
        dateRange: week.dateRange,
        phase: week.phase,
        timing,
        daysAway,
        actions,
        extraUploads,
        primaryUpload,
        supportDone,
        supportMissing,
        supportPlanned,
        totalViews,
      };
    })
    .sort((a, b) => a.daysAway - b.daysAway);
}

// ── Attention Items ─────────────────────────────────────────────────────────

type AttentionItem = {
  text: string;
  urgency: NudgeUrgency;
};

function buildAttentionItems(
  nudges: Nudge[],
  matchResult?: MatchResult,
  liveChannel?: CampaignDestinationProps['liveChannel'],
): AttentionItem[] {
  // Use nudges as primary source — they're already well-written
  // But reformat for editorial feel
  const items: AttentionItem[] = nudges.map((n) => ({
    text: n.detail,
    urgency: n.urgency,
  }));

  // If no nudges, derive from data
  if (items.length === 0 && matchResult) {
    const { stats } = matchResult;
    if (stats.late > 0) {
      const lateActions = matchResult.weeks.flatMap((w) => w.actions).filter((a) => a.status === 'late');
      items.push({
        text: `"${lateActions[0].title}" is ${lateActions[0].daysFromDue ?? 0} days overdue. Upload it now or remove from the plan.`,
        urgency: 'critical',
      });
    }
    if (stats.missing > 0) {
      items.push({
        text: `${stats.missing} planned upload${stats.missing > 1 ? 's' : ''} expected but not found yet.`,
        urgency: 'important',
      });
    }
  }

  return items.slice(0, 4);
}

// ── Export Text Generator ───────────────────────────────────────────────────

function generateExportText(
  type: string,
  plan: GeneratedPlan,
  matchResult?: MatchResult,
  liveChannel?: CampaignDestinationProps['liveChannel'],
  currentPhase?: PhaseName | null,
  moments?: CampaignMoment[],
): string {
  const artist = plan.artist;
  const campaign = plan.campaignName.replace(/ Campaign$/i, '');
  const stats = matchResult?.stats;
  const phase = currentPhase ?? 'BUILD';

  if (type === 'summary') {
    let text = `${artist} — ${campaign}\n`;
    text += `Phase: ${phase}\n`;
    text += `Strategy: ${plan.strategy.priority}\n\n`;

    if (liveChannel) {
      text += `Channel: ${liveChannel.subs != null ? fmtNum(liveChannel.subs) + ' subs' : ''}`;
      if (liveChannel.views7Delta != null) text += ` · ${liveChannel.views7Delta >= 0 ? '+' : ''}${fmtNum(liveChannel.views7Delta)} views/7d`;
      if (liveChannel.uploads30d != null) text += ` · ${liveChannel.uploads30d} uploads/30d`;
      text += '\n\n';
    }

    if (stats) {
      text += `Execution: ${Math.round(stats.completionRate)}% (${stats.completed + stats.live} done, ${stats.planned} upcoming`;
      if (stats.missing > 0) text += `, ${stats.missing} missing`;
      if (stats.late > 0) text += `, ${stats.late} late`;
      text += ')\n\n';
    }

    if (moments && moments.length > 0) {
      const active = moments.find((m) => m.timing === 'current' || m.timing === 'past');
      const next = moments.find((m) => m.timing === 'upcoming');
      if (active) text += `Current moment: ${active.momentName}\n`;
      if (next) text += `Next moment: ${next.momentName} (${next.dateRange})\n`;
    }

    return text;
  }

  if (type === 'update') {
    let text = `CAMPAIGN UPDATE: ${artist} — ${campaign}\n`;
    text += `${'─'.repeat(40)}\n\n`;
    text += `Current phase: ${phase}\n`;

    if (stats) {
      const rate = Math.round(stats.completionRate);
      text += `Execution rate: ${rate}%\n`;
      if (rate >= 70) text += `Status: On track\n`;
      else if (rate >= 40) text += `Status: Needs attention\n`;
      else text += `Status: Behind schedule\n`;
    }
    text += '\n';

    if (liveChannel?.views7Delta != null) {
      text += `7-day views: ${liveChannel.views7Delta >= 0 ? '+' : ''}${fmtNum(liveChannel.views7Delta)}\n`;
    }
    if (liveChannel?.subs7Delta != null) {
      text += `7-day subs: ${liveChannel.subs7Delta >= 0 ? '+' : ''}${fmtNum(liveChannel.subs7Delta)}\n`;
    }
    text += '\n';

    if (moments && moments.length > 0) {
      text += 'KEY MOMENTS:\n';
      moments.forEach((m) => {
        const status = m.timing === 'current' ? '→ NOW' : m.timing === 'past' ? '✓ Done' : '  Upcoming';
        text += `${status} ${m.momentName} (${m.dateRange})\n`;
      });
    }

    return text;
  }

  if (type === 'brief') {
    let text = `YOUTUBE BRIEF: ${artist}\n`;
    text += `Campaign: ${campaign}\n`;
    text += `Phase: ${phase} — ${PHASE_LABEL[phase as PhaseName] ?? ''}\n\n`;
    text += `Strategy: ${plan.strategy.priority}\n\n`;
    text += `Approach: ${plan.strategy.approach}\n\n`;

    const next = moments?.find((m) => m.timing === 'upcoming' || m.timing === 'current');
    if (next) {
      text += `NEXT MOMENT: ${next.momentName}\n`;
      text += `Timing: ${next.dateRange}\n`;
      if (next.supportPlanned.length > 0) {
        text += `Support needed:\n`;
        next.supportPlanned.forEach((t) => { text += `  • ${t}\n`; });
      }
    }

    return text;
  }

  return '';
}

// ── Shared Helpers ──────────────────────────────────────────────────────────

function cleanTitle(title: string): string {
  // Remove generic prefixes/suffixes for chip display
  return title
    .replace(/^(Upload|Post|Create|Film|Record|Publish|Release)\s+/i, '')
    .replace(/\s*(short|video|post|clip)$/i, '')
    .trim() || title;
}

function buildMomentGuidance(moment: CampaignMoment): string {
  const missing = moment.supportMissing;
  if (missing.length === 1) {
    return `${missing[0]} hasn't landed yet. Upload support content to extend this moment's reach.`;
  }
  if (missing.length > 1) {
    return `${missing.length} support pieces missing. Prioritize ${missing[0]} to keep momentum from this moment.`;
  }
  return 'All support content is on track.';
}

function isCurrentWeek(week: { dateRange: string }): boolean {
  const now = new Date();
  const match = week.dateRange.match(/^(\w+)\s+(\d+)/);
  if (!match) return false;
  const monthMap: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const month = monthMap[match[1]];
  if (month == null) return false;
  const day = parseInt(match[2], 10);
  const weekDate = new Date(now.getFullYear(), month, day);
  const diff = (now.getTime() - weekDate.getTime()) / 86400000;
  return diff >= -1 && diff <= 7;
}

function resolveWeekDate(week: { dateRange: string }): Date | null {
  const match = week.dateRange.match(/^(\w+)\s+(\d+)/);
  if (!match) return null;
  const monthMap: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const month = monthMap[match[1]];
  if (month == null) return null;
  const day = parseInt(match[2], 10);
  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(year, month, day);
  if (candidate.getTime() < now.getTime() - 180 * 86400000) year += 1;
  return new Date(year, month, day);
}

function detectCurrentPhase(plan: GeneratedPlan): PhaseName | null {
  const now = new Date();
  const monthMap: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  for (const week of plan.weeks) {
    const match = week.dateRange.match(/^(\w+)\s+(\d+)/);
    if (!match) continue;
    const month = monthMap[match[1]];
    if (month == null) continue;
    const day = parseInt(match[2], 10);
    const weekDate = new Date(now.getFullYear(), month, day);
    const diff = (now.getTime() - weekDate.getTime()) / 86400000;
    if (diff >= -1 && diff <= 7) return week.phase;
  }
  return null;
}
