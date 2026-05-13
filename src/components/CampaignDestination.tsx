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

// ══════════════════════════════════════════════════════════════════════════════
// DESIGN SYSTEM — Cinematic Rollout OS
// ══════════════════════════════════════════════════════════════════════════════

const INK = '#0A0A0A';
const PAPER = '#F5F2ED';
const BONE = '#EBE7DF';
const SMOKE = '#8A847A';
const GHOST = '#C8C2B8';
const WHITE = '#FFFFFF';

const PHASE_TONE: Record<PhaseName, { accent: string; label: string; narrative: string }> = {
  BUILD: {
    accent: '#4338CA',
    label: 'BUILD THE WORLD',
    narrative: 'Warming the algorithm. Building presence.',
  },
  RELEASE: {
    accent: '#DC2626',
    label: 'THE CENTREPIECE',
    narrative: 'The main event. Maximum pressure.',
  },
  SCALE: {
    accent: '#059669',
    label: 'SCALE THE STORY',
    narrative: 'Momentum is real. Push it further.',
  },
  EXTEND: {
    accent: '#D97706',
    label: 'EXTEND THE WORLD',
    narrative: 'Keep the universe alive.',
  },
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
  primaryUpload: RecentUpload | null;
  supportDone: string[];
  supportMissing: string[];
  supportPlanned: string[];
  totalViews: number;
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

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
  const upcomingMoments = moments.filter((m) => m.timing === 'upcoming').slice(0, 3);
  const pastMoments = moments.filter((m) => m.timing === 'past').reverse().slice(0, 4);
  const attentionItems = buildAttentionItems(nudges ?? [], matchResult, liveChannel);
  const phaseTone = currentPhase ? PHASE_TONE[currentPhase] : null;
  const campaignTitle = plan.campaignName.replace(/ Campaign$/i, '');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ minHeight: '100vh', background: PAPER, color: INK }}>

      {/* ══════════════════════════════════════════════════════════════════
          HEADER BAR — Thin, institutional
      ══════════════════════════════════════════════════════════════════ */}
      <div style={{
        borderBottom: `1px solid ${BONE}`,
        padding: '14px 0',
      }}>
        <div style={{
          maxWidth: 1000, margin: '0 auto', padding: '0 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Link href="/coach" style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '0.2em',
            textTransform: 'uppercase', color: GHOST, textDecoration: 'none',
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
          }}>
            Campaign System
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {currentPhase && (
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: phaseTone?.accent,
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
              }}>
                {phaseTone?.label}
              </span>
            )}
            <Link href="/coach" style={{
              fontSize: 11, fontWeight: 600, color: SMOKE,
              textDecoration: 'none', padding: '4px 12px',
              border: `1px solid ${BONE}`, borderRadius: 4,
            }}>
              All Campaigns
            </Link>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          HERO — Cinematic title block
      ══════════════════════════════════════════════════════════════════ */}
      <div style={{
        maxWidth: 1000, margin: '0 auto', padding: '0 32px',
        paddingTop: 64, paddingBottom: 40,
      }}>
        {/* Artist name — mono label */}
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.22em',
          textTransform: 'uppercase', color: SMOKE, marginBottom: 16,
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
        }}>
          {plan.artist}
        </div>

        {/* Campaign title — oversized, compressed */}
        <h1 style={{
          fontSize: 72, fontWeight: 900, color: INK, margin: 0,
          lineHeight: 0.92, letterSpacing: '-0.03em',
          textTransform: 'uppercase',
          maxWidth: 800,
        }}>
          {campaignTitle}
        </h1>

        {/* Strategic line */}
        <p style={{
          fontSize: 17, color: SMOKE, lineHeight: 1.5,
          marginTop: 20, marginBottom: 0, maxWidth: 560,
          fontWeight: 400,
        }}>
          {plan.strategy.priority}
        </p>

        {/* Divider line */}
        <div style={{
          width: 60, height: 1, background: INK, marginTop: 32,
        }} />
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          LIVE STRIP — Campaign vital signs
      ══════════════════════════════════════════════════════════════════ */}
      {(liveChannel || pulseSignals.length > 0) && (
        <div style={{ background: INK, color: PAPER }}>
          <div style={{
            maxWidth: 1000, margin: '0 auto', padding: '28px 32px',
          }}>
            {/* Metrics row */}
            {liveChannel && (
              <div style={{
                display: 'flex', gap: 40, marginBottom: pulseSignals.length > 0 ? 20 : 0,
                flexWrap: 'wrap',
              }}>
                {liveChannel.subs != null && (
                  <LiveMetric label="Subscribers" value={fmtNum(liveChannel.subs)} />
                )}
                {liveChannel.views7Delta != null && (
                  <LiveMetric
                    label="Views 7d"
                    value={`${liveChannel.views7Delta >= 0 ? '+' : ''}${fmtNum(liveChannel.views7Delta)}`}
                    positive={liveChannel.views7Delta > 0}
                    negative={liveChannel.views7Delta < 0}
                  />
                )}
                {liveChannel.subs7Delta != null && (
                  <LiveMetric
                    label="Subs 7d"
                    value={`${liveChannel.subs7Delta >= 0 ? '+' : ''}${fmtNum(liveChannel.subs7Delta)}`}
                    positive={liveChannel.subs7Delta > 0}
                  />
                )}
                {liveChannel.uploads30d != null && (
                  <LiveMetric label="Uploads 30d" value={String(liveChannel.uploads30d)} />
                )}
                {liveChannel.lastUploadDaysAgo != null && (
                  <LiveMetric
                    label="Last upload"
                    value={`${liveChannel.lastUploadDaysAgo}d`}
                    negative={liveChannel.lastUploadDaysAgo > 14}
                  />
                )}
              </div>
            )}

            {/* Pulse signals */}
            {pulseSignals.length > 0 && (
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 6,
                borderTop: liveChannel ? `1px solid rgba(255,255,255,0.08)` : 'none',
                paddingTop: liveChannel ? 16 : 0,
              }}>
                {pulseSignals.map((sig, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      background: sig.urgency === 'positive' ? '#34D399'
                        : sig.urgency === 'warning' ? '#FBBF24'
                        : sig.urgency === 'critical' ? '#F87171'
                        : 'rgba(255,255,255,0.2)',
                    }} />
                    <span style={{
                      fontSize: 13, lineHeight: 1.4, fontWeight: 400,
                      color: sig.urgency === 'critical' ? '#FCA5A5' : 'rgba(245,242,237,0.7)',
                    }}>
                      {sig.text}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          CHAPTER BLOCK — Current phase as narrative act
      ══════════════════════════════════════════════════════════════════ */}
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 32px' }}>

        {currentPhase && phaseTone && (
          <div style={{ paddingTop: 48, paddingBottom: 32 }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 16,
            }}>
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.16em',
                textTransform: 'uppercase', color: GHOST,
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
              }}>
                Chapter {plan.phases.findIndex(p => p.name === currentPhase) + 1 || '—'}
              </span>
            </div>
            <h2 style={{
              fontSize: 40, fontWeight: 900, color: INK, margin: 0,
              lineHeight: 1.0, letterSpacing: '-0.02em',
              textTransform: 'uppercase', marginTop: 8,
            }}>
              {phaseTone.label}
            </h2>
            <p style={{
              fontSize: 15, color: SMOKE, marginTop: 10, marginBottom: 0,
              fontStyle: 'italic',
            }}>
              {phaseTone.narrative}
            </p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            CURRENT MOMENT — The hero block
        ══════════════════════════════════════════════════════════════ */}
        {activeMoment && (
          <CinematicMoment moment={activeMoment} isCurrent />
        )}

        {/* ══════════════════════════════════════════════════════════════
            ATTENTION — What needs intervention
        ══════════════════════════════════════════════════════════════ */}
        {attentionItems.length > 0 && (
          <div style={{
            marginTop: 8, marginBottom: 32,
            borderLeft: `3px solid ${INK}`,
            paddingLeft: 20,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
              textTransform: 'uppercase', color: SMOKE, marginBottom: 12,
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
            }}>
              Needs Attention
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {attentionItems.map((item, i) => (
                <div key={i} style={{
                  fontSize: 14, lineHeight: 1.5, fontWeight: 500,
                  color: item.urgency === 'critical' ? '#991B1B'
                    : item.urgency === 'important' ? '#78350F' : INK,
                }}>
                  {item.text}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            NEXT — What's coming
        ══════════════════════════════════════════════════════════════ */}
        {upcomingMoments.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
              textTransform: 'uppercase', color: GHOST, marginBottom: 16,
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
            }}>
              Coming Up
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {upcomingMoments.map((m) => (
                <UpcomingRow key={m.weekNum} moment={m} />
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TIMELINE — The full storyboard
        ══════════════════════════════════════════════════════════════ */}
        <div style={{
          borderTop: `1px solid ${BONE}`, paddingTop: 24, marginBottom: 32,
        }}>
          <button
            onClick={() => setTimelineOpen(!timelineOpen)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', background: 'none', border: 'none', cursor: 'pointer',
              padding: 0, marginBottom: timelineOpen ? 20 : 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
                textTransform: 'uppercase', color: SMOKE,
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
              }}>
                Full Timeline
              </span>
              <span style={{ fontSize: 12, color: GHOST }}>
                {plan.totalWeeks} weeks · {plan.events.length} moments
                {matchResult ? ` · ${Math.round(matchResult.stats.completionRate)}% executed` : ''}
              </span>
            </div>
            <span style={{
              fontSize: 11, color: GHOST, transition: 'transform 0.15s',
              transform: timelineOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            }}>
              ▶
            </span>
          </button>

          {/* Phase progress — always visible */}
          <PhaseStrip phases={plan.phases} totalWeeks={plan.totalWeeks} currentPhase={currentPhase} />

          {/* Expanded timeline */}
          {timelineOpen && (
            <TimelineDetail plan={plan} matchResult={matchResult} currentPhase={currentPhase} />
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════
            HISTORY — Past moments (collapsed)
        ══════════════════════════════════════════════════════════════ */}
        {pastMoments.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
              textTransform: 'uppercase', color: GHOST, marginBottom: 12,
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
            }}>
              Completed Moments
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {pastMoments.map((m) => (
                <div key={m.weekNum} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 0',
                  borderBottom: `1px solid ${BONE}`,
                  opacity: 0.5,
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: GHOST, minWidth: 32,
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                  }}>
                    W{m.weekNum}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: INK, flex: 1 }}>
                    {m.momentName}
                  </span>
                  {m.totalViews > 0 && (
                    <span style={{
                      fontSize: 12, color: SMOKE,
                      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                    }}>
                      {fmtNum(m.totalViews)} views
                    </span>
                  )}
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: '#059669',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    Done
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            EXPORT — Generate & Share
        ══════════════════════════════════════════════════════════════ */}
        <div style={{
          borderTop: `1px solid ${BONE}`, paddingTop: 24, paddingBottom: 48,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
            textTransform: 'uppercase', color: GHOST, marginBottom: 14,
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
          }}>
            Generate
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
                  fontSize: 12, fontWeight: 600, padding: '8px 18px',
                  background: exportOpen === id ? INK : 'transparent',
                  color: exportOpen === id ? PAPER : INK,
                  border: `1px solid ${exportOpen === id ? INK : BONE}`,
                  borderRadius: 4, cursor: 'pointer',
                  letterSpacing: '0.02em',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {exportOpen && (
            <div style={{
              marginTop: 12, background: WHITE, border: `1px solid ${BONE}`,
              borderRadius: 6, overflow: 'hidden',
            }}>
              <pre style={{
                padding: '20px 24px', fontSize: 12, lineHeight: 1.6,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                margin: 0, color: INK, fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                maxHeight: 400, overflow: 'auto',
              }}>
                {generateExportText(exportOpen, plan, matchResult, liveChannel, currentPhase, moments)}
              </pre>
              <div style={{
                padding: '10px 20px', borderTop: `1px solid ${BONE}`,
                display: 'flex', justifyContent: 'flex-end',
              }}>
                <button
                  onClick={() => copyToClipboard(
                    generateExportText(exportOpen, plan, matchResult, liveChannel, currentPhase, moments)
                  )}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: '6px 16px',
                    background: copied ? '#ECFDF5' : INK,
                    color: copied ? '#059669' : PAPER,
                    border: 'none', borderRadius: 4, cursor: 'pointer',
                    letterSpacing: '0.04em',
                  }}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div style={{
          padding: '24px 0 40px', borderTop: `1px solid ${BONE}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{
            fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: GHOST,
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
          }}>
            YouTube Campaign System
          </span>
          <span style={{
            fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: GHOST,
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
          }}>
            {plan.artist} · {campaignTitle}
          </span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LIVE METRIC — Dark strip metric
// ══════════════════════════════════════════════════════════════════════════════

function LiveMetric({ label, value, positive, negative }: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{
        fontSize: 9, fontWeight: 600, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: 'rgba(245,242,237,0.35)',
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em',
        color: positive ? '#34D399' : negative ? '#F87171' : PAPER,
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
      }}>
        {value}
      </span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CINEMATIC MOMENT — The hero moment block
// ══════════════════════════════════════════════════════════════════════════════

function CinematicMoment({ moment, isCurrent }: {
  moment: CampaignMoment;
  isCurrent?: boolean;
}) {
  const phaseTone = PHASE_TONE[moment.phase];
  const isLive = moment.timing === 'current';

  return (
    <div style={{ marginBottom: 32 }}>
      {/* Moment header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 12,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: GHOST,
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
        }}>
          W{moment.weekNum} · {moment.dateRange}
        </span>
        {isLive && (
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
            textTransform: 'uppercase',
            padding: '2px 10px', borderRadius: 3,
            background: phaseTone.accent, color: WHITE,
          }}>
            Live
          </span>
        )}
      </div>

      {/* Moment title — large editorial */}
      <h2 style={{
        fontSize: 36, fontWeight: 800, color: INK, margin: 0,
        lineHeight: 1.05, letterSpacing: '-0.01em',
      }}>
        {moment.momentName}
      </h2>

      {/* Primary upload performance */}
      {moment.primaryUpload && (
        <div style={{
          marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 8,
        }}>
          <span style={{
            fontSize: 28, fontWeight: 900, color: '#059669',
            letterSpacing: '-0.02em',
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
          }}>
            {fmtNum(moment.primaryUpload.viewCount)}
          </span>
          <span style={{ fontSize: 13, fontWeight: 500, color: SMOKE }}>
            views
            {moment.totalViews > moment.primaryUpload.viewCount && (
              <span style={{ color: GHOST }}>
                {' '}· {fmtNum(moment.totalViews)} total across support
              </span>
            )}
          </span>
        </div>
      )}

      {/* Support content grid */}
      {moment.actions.length > 0 && (
        <div style={{
          marginTop: 20,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 6,
        }}>
          {moment.supportDone.map((title, i) => (
            <SupportBlock key={`done-${i}`} title={title} status="done" />
          ))}
          {moment.supportMissing.map((title, i) => (
            <SupportBlock key={`miss-${i}`} title={title} status="missing" />
          ))}
          {moment.supportPlanned.map((title, i) => (
            <SupportBlock key={`plan-${i}`} title={title} status="planned" />
          ))}
        </div>
      )}

      {/* Editorial guidance */}
      {moment.supportMissing.length > 0 && (
        <p style={{
          fontSize: 14, color: INK, fontWeight: 500,
          marginTop: 16, marginBottom: 0, lineHeight: 1.5,
          paddingLeft: 16,
          borderLeft: `2px solid ${phaseTone.accent}`,
        }}>
          {buildMomentGuidance(moment)}
        </p>
      )}

      {/* Extra uploads */}
      {moment.extraUploads.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${BONE}` }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: GHOST,
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
          }}>
            Extra Uploads
          </span>
          {moment.extraUploads.map((u) => (
            <div key={u.id} style={{
              fontSize: 13, color: SMOKE, marginTop: 6,
              display: 'flex', gap: 8, alignItems: 'center',
            }}>
              <span style={{ fontSize: 10, opacity: 0.5 }}>{u.durationSec <= 62 ? '⚡' : '▶'}</span>
              <span style={{ flex: 1 }}>{u.title}</span>
              <span style={{
                fontSize: 11, color: GHOST,
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
              }}>
                {fmtNum(u.viewCount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Support Block ─────────────────────────────────────────────────────────

function SupportBlock({ title, status }: { title: string; status: 'done' | 'missing' | 'planned' }) {
  return (
    <div style={{
      padding: '10px 14px',
      background: status === 'done' ? '#ECFDF5'
        : status === 'missing' ? '#FEF2F2'
        : BONE,
      borderRadius: 4,
      borderLeft: `3px solid ${
        status === 'done' ? '#059669'
        : status === 'missing' ? '#DC2626'
        : GHOST
      }`,
    }}>
      <div style={{
        fontSize: 12, fontWeight: 600,
        color: status === 'done' ? '#065F46'
          : status === 'missing' ? '#991B1B'
          : INK,
      }}>
        {title}
      </div>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', marginTop: 4,
        color: status === 'done' ? '#059669'
          : status === 'missing' ? '#DC2626'
          : SMOKE,
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
      }}>
        {status === 'done' ? 'Shipped' : status === 'missing' ? 'Missing' : 'Planned'}
      </div>
    </div>
  );
}

// ── Upcoming Row ──────────────────────────────────────────────────────────

function UpcomingRow({ moment }: { moment: CampaignMoment }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 0',
      borderBottom: `1px solid ${BONE}`,
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, color: GHOST, minWidth: 32,
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
      }}>
        W{moment.weekNum}
      </span>
      <span style={{
        fontSize: 11, color: SMOKE, minWidth: 80,
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
      }}>
        {moment.dateRange.split('–')[0]}
      </span>
      <span style={{ fontSize: 15, fontWeight: 700, color: INK, flex: 1 }}>
        {moment.momentName}
      </span>
      <span style={{
        fontSize: 11, color: GHOST,
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
      }}>
        {moment.actions.length} actions
      </span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE STRIP — Visual progress
// ══════════════════════════════════════════════════════════════════════════════

function PhaseStrip({ phases, totalWeeks, currentPhase }: {
  phases: { name: PhaseName; weekStart: number; weekEnd: number }[];
  totalWeeks: number;
  currentPhase: PhaseName | null;
}) {
  return (
    <div style={{
      display: 'flex', gap: 2, marginTop: 12, borderRadius: 2, overflow: 'hidden',
    }}>
      {phases.map((p) => {
        const span = p.weekEnd - p.weekStart + 1;
        const pct = (span / totalWeeks) * 100;
        const isCurrent = currentPhase === p.name;
        const tone = PHASE_TONE[p.name];
        return (
          <div key={p.name} style={{
            flex: `0 0 ${pct}%`, padding: '6px 10px',
            background: isCurrent ? `${tone.accent}12` : BONE,
            borderBottom: `2px solid ${isCurrent ? tone.accent : 'transparent'}`,
          }}>
            <span style={{
              fontSize: 8, fontWeight: 800, letterSpacing: '0.12em',
              color: isCurrent ? tone.accent : GHOST,
              textTransform: 'uppercase',
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
            }}>
              {p.name}
            </span>
          </div>
        );
      })}
    </div>
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
  const phases = plan.phases.map((p) => ({
    ...p,
    weeks: weeks.filter((w) => w.weekNum >= p.weekStart && w.weekNum <= p.weekEnd),
  }));

  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {phases.map((phase) => {
        const isCurrent = currentPhase === phase.name;
        const tone = PHASE_TONE[phase.name];
        const phaseWeeks = phase.weeks.filter((w) => w.actions.length > 0 || w.momentName);
        if (phaseWeeks.length === 0) return null;

        return (
          <div key={phase.name}>
            <div style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
              textTransform: 'uppercase', marginBottom: 8,
              color: isCurrent ? tone.accent : GHOST,
              display: 'flex', alignItems: 'center', gap: 10,
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
            }}>
              {tone.label}
              <span style={{
                fontSize: 9, fontWeight: 600, color: GHOST,
                textTransform: 'none', letterSpacing: '0.04em',
              }}>
                W{phase.weekStart}–{phase.weekEnd}
              </span>
              {isCurrent && (
                <span style={{
                  fontSize: 8, fontWeight: 800, background: tone.accent,
                  color: WHITE, padding: '1px 7px', borderRadius: 2,
                }}>
                  NOW
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
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

  const done = actions.filter((a) =>
    'status' in a ? ((a as MatchedAction).status === 'completed' || (a as MatchedAction).status === 'live') : a.completed
  ).length;
  const issues = actions.filter((a) =>
    'status' in a && ((a as MatchedAction).status === 'late' || (a as MatchedAction).status === 'missing')
  ).length;

  return (
    <div style={{
      background: isCurrent ? WHITE : 'transparent',
      border: isCurrent ? `1px solid ${BONE}` : 'none',
      borderRadius: 4,
    }}>
      <button
        onClick={() => actions.length > 0 && setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '6px 12px', background: 'none', border: 'none',
          cursor: actions.length > 0 ? 'pointer' : 'default', textAlign: 'left',
        }}
      >
        <span style={{
          fontSize: 10, fontWeight: 700, color: GHOST, minWidth: 28,
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
        }}>
          W{week.weekNum}
        </span>
        <span style={{
          fontSize: 11, color: GHOST, minWidth: 80,
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
        }}>
          {week.dateRange}
        </span>
        <span style={{
          fontSize: 13, fontWeight: isMoment ? 700 : 400,
          color: isMoment ? INK : SMOKE, flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {week.momentName ?? (actions.length > 0 ? `${actions.length} actions` : '')}
        </span>
        {actions.length > 0 && (
          <span style={{
            fontSize: 10, color: GHOST, display: 'flex', gap: 4, alignItems: 'center',
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
          }}>
            {done > 0 && <span style={{ color: '#059669', fontWeight: 700 }}>{done}✓</span>}
            {issues > 0 && <span style={{ color: '#DC2626', fontWeight: 700 }}>{issues}!</span>}
            <span style={{
              fontSize: 8,
              transform: expanded ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.15s',
            }}>▶</span>
          </span>
        )}
      </button>

      {expanded && (
        <div style={{ padding: '0 12px 8px 52px' }}>
          {actions.map((a, i) => {
            const matched = 'status' in a ? (a as MatchedAction) : null;
            const status: ExecutionStatus = matched?.status ?? (a.completed ? 'completed' : 'planned');
            const isDone = status === 'completed' || status === 'live';
            const isLate = status === 'late';
            const isMissing = status === 'missing';

            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 12, padding: '3px 0',
                color: isDone ? GHOST : isLate ? '#DC2626' : isMissing ? '#C2410C' : INK,
                textDecoration: isDone ? 'line-through' : 'none',
                opacity: isDone ? 0.5 : 1,
              }}>
                <span style={{
                  fontSize: 10, opacity: 0.6,
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                }}>
                  {a.format === 'short' ? '⚡' : a.format === 'video' || a.format === 'premiere' ? '▶' : a.format === 'live' ? '◉' : '·'}
                </span>
                <span style={{ flex: 1 }}>{a.title}</span>
                {matched?.matchedUpload && (
                  <span style={{
                    fontSize: 10, color: '#059669',
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                  }}>
                    {fmtNum(matched.matchedUpload.viewCount)}
                  </span>
                )}
                {(isLate || isMissing) && (
                  <span style={{
                    fontSize: 8, fontWeight: 800, padding: '1px 6px', borderRadius: 2,
                    background: isLate ? '#FEF2F2' : '#FFF7ED',
                    color: isLate ? '#DC2626' : '#C2410C',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
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

function generatePulseSignals(
  matchResult: MatchResult | undefined,
  liveChannel: CampaignDestinationProps['liveChannel'],
  recentUploads: RecentUpload[],
  currentPhase: PhaseName | null,
  plan: GeneratedPlan,
): PulseSignal[] {
  const signals: PulseSignal[] = [];

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

  const lastUpload = liveChannel?.lastUploadDaysAgo;
  if (lastUpload != null && lastUpload > 10) {
    signals.push({
      text: `${lastUpload} days since last upload${currentPhase === 'RELEASE' ? ' — release window is open' : ''}`,
      urgency: lastUpload > 21 ? 'critical' : 'warning',
    });
  }

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

  if (currentPhase && signals.length < 5) {
    signals.push({
      text: PHASE_TONE[currentPhase].narrative,
      urgency: 'neutral',
    });
  }

  const order: Record<PulseSignal['urgency'], number> = {
    critical: 0, warning: 1, positive: 2, neutral: 3,
  };
  return signals
    .sort((a, b) => order[a.urgency] - order[b.urgency])
    .slice(0, 5);
}

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

      const matchedWeek = matchResult?.weeks.find((w) => w.weekNum === week.weekNum);
      const actions: MatchedAction[] = matchedWeek
        ? matchedWeek.actions
        : week.actions.map((a) => ({ ...a, status: 'planned' as ExecutionStatus }));
      const extraUploads = matchedWeek?.extraUploads ?? [];

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

type AttentionItem = {
  text: string;
  urgency: NudgeUrgency;
};

function buildAttentionItems(
  nudges: Nudge[],
  matchResult?: MatchResult,
  liveChannel?: CampaignDestinationProps['liveChannel'],
): AttentionItem[] {
  const items: AttentionItem[] = nudges.map((n) => ({
    text: n.detail,
    urgency: n.urgency,
  }));

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
    text += `Phase: ${phase} — ${PHASE_TONE[phase as PhaseName]?.label ?? ''}\n\n`;
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

function cleanTitle(title: string): string {
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
