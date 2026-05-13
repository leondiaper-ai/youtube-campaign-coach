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
// DESIGN SYSTEM — Cinematic Rollout OS v4
// Hero → Campaign State → Live Execution → Full Rollout Map
// ══════════════════════════════════════════════════════════════════════════════

const INK = '#0A0A0A';
const PAPER = '#F5F2ED';
const BONE = '#EBE7DF';
const SMOKE = '#8A847A';
const GHOST = '#C8C2B8';
const WHITE = '#FFFFFF';

const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace';

const PHASE_TONE: Record<PhaseName, { accent: string; label: string; narrative: string }> = {
  BUILD: {
    accent: '#4338CA',
    label: 'BUILD THE WORLD',
    narrative: 'Warming the algorithm. Building presence and anticipation.',
  },
  RELEASE: {
    accent: '#DC2626',
    label: 'THE CENTREPIECE',
    narrative: 'The main event. Maximum visibility and impact.',
  },
  SCALE: {
    accent: '#059669',
    label: 'SCALE THE STORY',
    narrative: 'Momentum is building. Extend the reach further.',
  },
  EXTEND: {
    accent: '#D97706',
    label: 'EXTEND THE WORLD',
    narrative: 'Keep the universe alive. Sustain audience connection.',
  },
};

// ── YouTube thumbnail helpers ─────────────────────────────────────────────

function ytThumb(id: string, q: 'maxresdefault' | 'hqdefault' | 'mqdefault' = 'hqdefault'): string {
  return `https://i.ytimg.com/vi/${id}/${q}.jpg`;
}

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function daysAgoNum(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86400000;
}

function isFresh(iso: string, withinDays = 3): boolean {
  return daysAgoNum(iso) <= withinDays;
}

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

type PulseSignal = {
  text: string;
  urgency: 'positive' | 'neutral' | 'warning' | 'critical';
};

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
  const [timelineOpen, setTimelineOpen] = useState(true);
  const [exportOpen, setExportOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const currentPhase = detectCurrentPhase(plan);
  const pulseSignals = generatePulseSignals(matchResult, liveChannel, recentUploads ?? [], currentPhase, plan);
  const moments = extractMoments(plan, matchResult);
  const activeMoment = moments.find((m) => m.timing === 'current') ?? moments.find((m) => m.timing === 'past');
  const upcomingMoments = moments.filter((m) => m.timing === 'upcoming').slice(0, 4);
  const pastMoments = moments.filter((m) => m.timing === 'past').reverse().slice(0, 5);
  const attentionItems = buildAttentionItems(nudges ?? [], matchResult, liveChannel);
  const phaseTone = currentPhase ? PHASE_TONE[currentPhase] : null;
  const campaignTitle = plan.campaignName.replace(/ Campaign$/i, '');
  const currentPhaseData = currentPhase
    ? plan.phases.find((p) => p.name === currentPhase)
    : null;

  // ── Classify uploads for visual treatment ──
  const allByRecency = (recentUploads ?? []).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  const allByViews = [...allByRecency].sort((a, b) => b.viewCount - a.viewCount);
  const shorts = allByRecency.filter((u) => u.durationSec <= 62);
  const longform = allByRecency.filter((u) => u.durationSec > 62);
  const heroUpload = longform[0] ?? allByRecency[0] ?? null;
  const totalCampaignViews = allByRecency.reduce((s, u) => s + u.viewCount, 0);

  // ── 30-day era data ──
  const uploads30d = allByRecency.filter((u) => daysAgoNum(u.publishedAt) <= 30);
  const shorts30d = uploads30d.filter((u) => u.durationSec <= 62);
  const long30d = uploads30d.filter((u) => u.durationSec > 62);
  const eraSignal = generateEraSignal(uploads30d, shorts30d, long30d, liveChannel);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes cpulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
      `}} />

      <div style={{ minHeight: '100vh', background: PAPER, color: INK }}>


        {/* ══════════════════════════════════════════════════════════════════
            HERO — Immersive dark opening. Era atmosphere.
        ══════════════════════════════════════════════════════════════════ */}
        <section style={{
          background: INK,
          color: PAPER,
          position: 'relative',
          overflow: 'hidden',
          minHeight: allByRecency.length > 0 ? '72vh' : '50vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}>
          {/* Thumbnail mosaic texture — recent uploads set the era atmosphere */}
          {allByRecency.length >= 3 && (
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(allByRecency.length, 5)}, 1fr)`,
              gridTemplateRows: 'repeat(2, 1fr)',
              gap: 1,
              opacity: 0.08,
              filter: 'contrast(1.2)',
              pointerEvents: 'none',
            }}>
              {allByRecency.slice(0, 10).map((u) => (
                <img key={u.id} src={ytThumb(u.id, 'hqdefault')} alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ))}
            </div>
          )}

          {/* Gradient veil */}
          <div style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0, height: '70%',
            background: `linear-gradient(transparent, ${INK} 85%)`,
            pointerEvents: 'none',
          }} />

          {/* Navigation */}
          <div style={{
            position: 'absolute', top: 20, left: 40, right: 40,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            zIndex: 2,
          }}>
            <Link href="/coach" style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.2em',
              textTransform: 'uppercase', color: GHOST, textDecoration: 'none',
              fontFamily: MONO,
            }}>
              Campaign System
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {currentPhase && phaseTone && (
                <span style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
                  textTransform: 'uppercase', color: phaseTone.accent,
                  fontFamily: MONO,
                }}>
                  {phaseTone.label}
                </span>
              )}
              <Link href="/coach" style={{
                fontSize: 11, fontWeight: 600, color: SMOKE,
                textDecoration: 'none', padding: '4px 12px',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4,
              }}>
                All Campaigns
              </Link>
            </div>
          </div>

          {/* Hero content */}
          <div style={{
            position: 'relative', zIndex: 1,
            maxWidth: 1200, margin: '0 auto', padding: '0 40px',
            paddingBottom: 56, width: '100%',
            boxSizing: 'border-box',
          }}>
            {phaseTone && (
              <div style={{
                width: 48, height: 3,
                background: phaseTone.accent,
                marginBottom: 28,
              }} />
            )}

            <div style={{
              fontSize: 12, fontWeight: 600, letterSpacing: '0.25em',
              textTransform: 'uppercase', color: GHOST,
              marginBottom: 18, fontFamily: MONO,
            }}>
              {plan.artist}
            </div>

            <h1 style={{
              fontSize: 'clamp(52px, 8vw, 100px)',
              fontWeight: 900,
              lineHeight: 0.88,
              letterSpacing: '-0.04em',
              textTransform: 'uppercase',
              margin: 0, maxWidth: 900, color: WHITE,
            }}>
              {campaignTitle}
            </h1>

            <p style={{
              fontSize: 17, color: 'rgba(245,242,237,0.45)', lineHeight: 1.5,
              marginTop: 28, marginBottom: 0, maxWidth: 480, fontWeight: 400,
            }}>
              {plan.strategy.priority}
            </p>

            {/* Era reading */}
            {eraSignal && (
              <div style={{
                marginTop: 20,
                fontSize: 12, color: 'rgba(200,194,184,0.5)',
                fontFamily: MONO, lineHeight: 1.6,
                maxWidth: 500,
              }}>
                {eraSignal}
              </div>
            )}

            {/* Live metrics */}
            {liveChannel && (
              <div style={{
                marginTop: 16,
                display: 'flex', gap: 20, flexWrap: 'wrap',
                fontSize: 12, color: 'rgba(200,194,184,0.35)',
                fontFamily: MONO,
              }}>
                {liveChannel.subs != null && <span>{fmtNum(liveChannel.subs)} subs</span>}
                {liveChannel.views7Delta != null && (
                  <span style={{ color: liveChannel.views7Delta > 0 ? 'rgba(52,211,153,0.6)' : undefined }}>
                    {liveChannel.views7Delta >= 0 ? '+' : ''}{fmtNum(liveChannel.views7Delta)} views/7d
                  </span>
                )}
                {liveChannel.uploads30d != null && <span>{liveChannel.uploads30d} uploads/30d</span>}
              </div>
            )}
          </div>
        </section>


        {/* ══════════════════════════════════════════════════════════════════
            CADENCE STRIP — Upload rhythm of the last 30 days
        ══════════════════════════════════════════════════════════════════ */}
        {uploads30d.length > 0 && (
          <CadenceStrip
            uploads={uploads30d}
            accent={phaseTone?.accent ?? SMOKE}
          />
        )}


        {/* ┌──────────────────────────────────────────────────────────────┐
            │                                                              │
            │   C A M P A I G N   S T A T E                               │
            │   Where this campaign is right now.                          │
            │                                                              │
            └──────────────────────────────────────────────────────────────┘ */}


        {/* ══════════════════════════════════════════════════════════════════
            CAMPAIGN PHASE — Current chapter of the rollout
        ══════════════════════════════════════════════════════════════════ */}
        <section style={{
          maxWidth: 1200, margin: '0 auto',
          padding: '48px 40px 40px',
        }}>
          {currentPhase && phaseTone ? (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14,
                marginBottom: 20,
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
                  textTransform: 'uppercase', color: GHOST,
                  fontFamily: MONO,
                }}>
                  Chapter {plan.phases.findIndex((p) => p.name === currentPhase) + 1 || '—'}
                </span>
                {currentPhaseData && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: SMOKE,
                    fontFamily: MONO,
                  }}>
                    W{currentPhaseData.weekStart}–W{currentPhaseData.weekEnd}
                  </span>
                )}
                <span style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  padding: '3px 10px', borderRadius: 3,
                  background: phaseTone.accent, color: WHITE,
                  animation: 'cpulse 2s ease-in-out infinite',
                }}>
                  ACTIVE NOW
                </span>
              </div>

              <h2 style={{
                fontSize: 'clamp(36px, 5vw, 60px)',
                fontWeight: 900, lineHeight: 0.92,
                letterSpacing: '-0.02em', textTransform: 'uppercase',
                margin: 0, color: INK,
              }}>
                {phaseTone.label}
              </h2>
              <p style={{
                fontSize: 16, color: SMOKE, marginTop: 14,
                fontStyle: 'italic', maxWidth: 400, lineHeight: 1.5,
              }}>
                {phaseTone.narrative}
              </p>
              <div style={{
                width: 32, height: 2,
                background: phaseTone.accent,
                marginTop: 28,
              }} />
            </>
          ) : (
            <div style={{ height: 20 }} />
          )}
        </section>


        {/* ══════════════════════════════════════════════════════════════════
            ROLLOUT OBSERVATIONS — What the system is seeing right now
        ══════════════════════════════════════════════════════════════════ */}
        {pulseSignals.length > 0 && (
          <section style={{
            maxWidth: 1200, margin: '0 auto',
            padding: '0 40px',
            marginBottom: 48,
          }}>
            <div style={{
              maxWidth: 560,
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              {pulseSignals.slice(0, 4).map((sig, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                    background: sig.urgency === 'positive' ? '#059669'
                      : sig.urgency === 'warning' ? '#D97706'
                      : sig.urgency === 'critical' ? '#DC2626' : GHOST,
                  }} />
                  <span style={{ fontSize: 13, color: SMOKE, lineHeight: 1.4 }}>
                    {sig.text}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}


        {/* ══════════════════════════════════════════════════════════════════
            LIVE MOMENT — Current campaign beat, hero-scale
        ══════════════════════════════════════════════════════════════════ */}
        {activeMoment && (
          <LiveMomentBlock moment={activeMoment} />
        )}


        {/* ══════════════════════════════════════════════════════════════════
            OPPORTUNITIES — Where the rollout could go further
        ══════════════════════════════════════════════════════════════════ */}
        {attentionItems.length > 0 && (
          <section style={{
            maxWidth: 1200, margin: '0 auto', padding: '0 40px',
            marginBottom: 48,
          }}>
            <div style={{
              borderLeft: `3px solid ${phaseTone?.accent ?? INK}`,
              paddingLeft: 20, maxWidth: 560,
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
                textTransform: 'uppercase', color: SMOKE,
                fontFamily: MONO, marginBottom: 12,
              }}>
                Opportunities
              </div>
              {attentionItems.map((item, i) => (
                <div key={i} style={{
                  fontSize: 14, lineHeight: 1.6, fontWeight: 500,
                  color: item.urgency === 'critical' ? '#78350F'
                    : item.urgency === 'important' ? '#92400E' : INK,
                  marginBottom: 6,
                }}>
                  {item.text}
                </div>
              ))}
            </div>
          </section>
        )}


        {/* ══════════════════════════════════════════════════════════════════
            COMING CHAPTERS — Upcoming moments as editorial narrative
        ══════════════════════════════════════════════════════════════════ */}
        {upcomingMoments.length > 0 && (
          <section style={{
            maxWidth: 1200, margin: '0 auto', padding: '0 40px',
            marginBottom: 56,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
              textTransform: 'uppercase', color: GHOST,
              fontFamily: MONO, marginBottom: 24,
            }}>
              Coming Up
            </div>
            {upcomingMoments.map((m) => (
              <ChapterRow key={m.weekNum} moment={m} />
            ))}
          </section>
        )}


        {/* ┌──────────────────────────────────────────────────────────────┐
            │                                                              │
            │   L I V E   E X E C U T I O N                               │
            │   The visual world of this rollout.                          │
            │                                                              │
            └──────────────────────────────────────────────────────────────┘ */}


        {/* ══════════════════════════════════════════════════════════════════
            CAMPAIGN SURFACE — Visual proof of execution
        ══════════════════════════════════════════════════════════════════ */}
        {allByRecency.length >= 2 && (
          <>
            <section style={{
              maxWidth: 1200, margin: '0 auto',
              padding: '64px 40px 0',
            }}>
              <div style={{
                width: '100%', height: 1, background: BONE,
                marginBottom: 48,
              }} />
              <div style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '0.3em',
                textTransform: 'uppercase', color: GHOST,
                fontFamily: MONO, marginBottom: 10,
              }}>
                Campaign Surface
              </div>
              <div style={{
                fontSize: 13, color: SMOKE, lineHeight: 1.5,
                maxWidth: 400,
              }}>
                The visual world of this rollout — built from live YouTube uploads.
              </div>
            </section>
            <div style={{ marginTop: 32 }}>
              <CampaignWall
                uploads={allByRecency}
                shorts={shorts}
                longform={longform}
                heroUpload={heroUpload}
                totalViews={totalCampaignViews}
                uploads30dCount={uploads30d.length}
                shorts30dCount={shorts30d.length}
              />
            </div>
          </>
        )}


        {/* ┌──────────────────────────────────────────────────────────────┐
            │                                                              │
            │   F U L L   R O L L O U T   M A P                           │
            │   The operating system underneath.                           │
            │                                                              │
            └──────────────────────────────────────────────────────────────┘ */}


        {/* ══════════════════════════════════════════════════════════════════
            ROLLOUT MAP — Full campaign timeline
        ══════════════════════════════════════════════════════════════════ */}
        <section style={{
          maxWidth: 1200, margin: '0 auto', padding: '64px 40px 0',
        }}>
          <div style={{
            width: '100%', height: 1, background: BONE,
            marginBottom: 48,
          }} />
          <div style={{
            marginBottom: 32,
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
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.3em',
                  textTransform: 'uppercase', color: SMOKE, fontFamily: MONO,
                }}>
                  Rollout Map
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

            <PhaseStrip phases={plan.phases} totalWeeks={plan.totalWeeks} currentPhase={currentPhase} />

            {timelineOpen && (
              <TimelineDetail plan={plan} matchResult={matchResult} currentPhase={currentPhase} />
            )}
          </div>
        </section>


        {/* ══════════════════════════════════════════════════════════════════
            COMPLETED — Past moments
        ══════════════════════════════════════════════════════════════════ */}
        {pastMoments.length > 0 && (
          <section style={{
            maxWidth: 1200, margin: '0 auto', padding: '0 40px',
            marginBottom: 48,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
              textTransform: 'uppercase', color: GHOST,
              fontFamily: MONO, marginBottom: 12,
            }}>
              Completed Moments
            </div>
            {pastMoments.map((m) => (
              <div key={m.weekNum} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 0', borderBottom: `1px solid ${BONE}`,
                opacity: 0.45,
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: GHOST, minWidth: 32,
                  fontFamily: MONO,
                }}>
                  W{m.weekNum}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: INK, flex: 1 }}>
                  {m.momentName}
                </span>
                {m.primaryUpload && (
                  <div style={{
                    width: 48, height: 28, borderRadius: 2, overflow: 'hidden',
                    flexShrink: 0,
                  }}>
                    <img
                      src={ytThumb(m.primaryUpload.id, 'mqdefault')}
                      alt="" loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
                    />
                  </div>
                )}
                {m.totalViews > 0 && (
                  <span style={{ fontSize: 12, color: SMOKE, fontFamily: MONO }}>
                    {fmtNum(m.totalViews)}
                  </span>
                )}
              </div>
            ))}
          </section>
        )}


        {/* ══════════════════════════════════════════════════════════════════
            GENERATE — Export
        ══════════════════════════════════════════════════════════════════ */}
        <section style={{
          maxWidth: 1200, margin: '0 auto', padding: '0 40px',
        }}>
          <div style={{
            borderTop: `1px solid ${BONE}`, paddingTop: 24, paddingBottom: 48,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
              textTransform: 'uppercase', color: GHOST,
              fontFamily: MONO, marginBottom: 14,
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
                    borderRadius: 4, cursor: 'pointer', letterSpacing: '0.02em',
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
                  margin: 0, color: INK, fontFamily: MONO,
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
        </section>

        {/* Footer */}
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px' }}>
          <div style={{
            padding: '24px 0 40px', borderTop: `1px solid ${BONE}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{
              fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase',
              color: GHOST, fontFamily: MONO,
            }}>
              YouTube Campaign System
            </span>
            <span style={{
              fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: GHOST, fontFamily: MONO,
            }}>
              {plan.artist} · {campaignTitle}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// CADENCE STRIP — Visual heartbeat of the last 30 days
// ══════════════════════════════════════════════════════════════════════════════

function CadenceStrip({
  uploads,
  accent,
}: {
  uploads: RecentUpload[];
  accent: string;
}) {
  const marks = uploads
    .map((u) => ({
      daysAgo: daysAgoNum(u.publishedAt),
      isShort: u.durationSec <= 62,
      views: u.viewCount,
      fresh: isFresh(u.publishedAt, 5),
    }))
    .filter((m) => m.daysAgo >= 0 && m.daysAgo <= 30)
    .sort((a, b) => b.daysAgo - a.daysAgo);

  if (marks.length === 0) return null;

  return (
    <div style={{ background: INK }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '16px 40px 12px',
      }}>
        {/* Strip */}
        <div style={{
          position: 'relative',
          height: 36,
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          {marks.map((m, i) => {
            const pct = ((30 - m.daysAgo) / 30) * 100;
            return (
              <div key={i} style={{
                position: 'absolute',
                left: `${pct}%`,
                bottom: 0,
                width: m.isShort ? 3 : 5,
                height: m.isShort ? '55%' : '100%',
                background: m.isShort ? accent : WHITE,
                opacity: m.fresh ? 0.7 : 0.3,
                borderRadius: 1,
                transform: 'translateX(-50%)',
              }} />
            );
          })}
          {/* Axis labels */}
          <span style={{
            position: 'absolute', left: 8, top: 4,
            fontSize: 7, color: 'rgba(200,194,184,0.25)',
            fontFamily: MONO, letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}>
            30d
          </span>
          <span style={{
            position: 'absolute', right: 8, top: 4,
            fontSize: 7, color: 'rgba(200,194,184,0.25)',
            fontFamily: MONO, letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}>
            Now
          </span>
        </div>
        {/* Legend */}
        <div style={{
          display: 'flex', gap: 14, marginTop: 6,
          fontSize: 8, color: 'rgba(200,194,184,0.3)',
          fontFamily: MONO, letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 5, height: 10, background: WHITE, opacity: 0.4, borderRadius: 1, display: 'inline-block' }} />
            Longform
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 3, height: 7, background: accent, opacity: 0.5, borderRadius: 1, display: 'inline-block' }} />
            Short
          </span>
        </div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// CAMPAIGN WALL — Editorial collage built from live campaign assets
// ══════════════════════════════════════════════════════════════════════════════

function CampaignWall({
  uploads,
  shorts,
  longform,
  heroUpload,
  totalViews,
  uploads30dCount,
  shorts30dCount,
}: {
  uploads: RecentUpload[];
  shorts: RecentUpload[];
  longform: RecentUpload[];
  heroUpload: RecentUpload | null;
  totalViews: number;
  uploads30dCount: number;
  shorts30dCount: number;
}) {
  const secondaryLong = heroUpload
    ? longform.filter((u) => u.id !== heroUpload.id).slice(0, 3)
    : longform.slice(0, 3);

  return (
    <section style={{ background: INK }}>

      {/* ── HERO FRAME — Cinemascope crop of most recent upload ─── */}
      {heroUpload && (
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '21/9',
          overflow: 'hidden',
        }}>
          <img
            src={ytThumb(heroUpload.id, 'maxresdefault')}
            alt=""
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover',
              filter: 'brightness(0.55) contrast(1.1)',
            }}
          />
          <div style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            padding: '60px 40px 24px',
            background: 'linear-gradient(transparent 0%, rgba(10,10,10,0.85) 100%)',
          }}>
            <div style={{
              maxWidth: 1200, margin: '0 auto',
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'flex-end', flexWrap: 'wrap', gap: 16,
            }}>
              <div style={{ maxWidth: 500 }}>
                <div style={{
                  fontSize: 14, color: 'rgba(255,255,255,0.5)',
                  marginBottom: 6,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {heroUpload.title}
                </div>
                <div style={{
                  display: 'flex', gap: 12, alignItems: 'center',
                  fontSize: 9, color: 'rgba(255,255,255,0.2)',
                  fontFamily: MONO, letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}>
                  <span>{timeAgo(heroUpload.publishedAt)}</span>
                  {isFresh(heroUpload.publishedAt) && (
                    <span style={{ color: '#34D399', fontWeight: 700 }}>NEW</span>
                  )}
                  {heroUpload.likeCount > 0 && (
                    <span>{fmtNum(heroUpload.likeCount)} likes</span>
                  )}
                  {heroUpload.commentCount > 0 && (
                    <span>{fmtNum(heroUpload.commentCount)} comments</span>
                  )}
                </div>
              </div>
              <div style={{
                fontSize: 'clamp(32px, 4vw, 56px)',
                fontWeight: 900,
                letterSpacing: '-0.03em',
                color: WHITE, fontFamily: MONO, lineHeight: 1,
              }}>
                {fmtNum(heroUpload.viewCount)}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ── SHORTS STRIP — Vertical frames. Windows into the campaign. ─── */}
      {shorts.length > 0 && (
        <div style={{
          display: 'flex', gap: 2, marginTop: 2,
        }}>
          {shorts.slice(0, Math.min(shorts.length, 5)).map((s) => (
            <div key={s.id} style={{
              flex: '1 1 0',
              aspectRatio: '9/16',
              position: 'relative',
              overflow: 'hidden',
              minWidth: 0,
            }}>
              <img
                src={ytThumb(s.id)}
                alt="" loading="lazy"
                style={{
                  width: '100%', height: '100%',
                  objectFit: 'cover',
                  filter: 'brightness(0.7) saturate(1.1)',
                }}
              />
              <div style={{
                position: 'absolute',
                bottom: 0, left: 0, right: 0, height: '45%',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                pointerEvents: 'none',
              }} />
              <div style={{
                position: 'absolute', bottom: 8, left: 10, right: 10,
              }}>
                <div style={{
                  fontSize: 15, fontWeight: 900, color: WHITE,
                  fontFamily: MONO, letterSpacing: '-0.02em',
                }}>
                  {fmtNum(s.viewCount)}
                </div>
                <div style={{
                  fontSize: 8, color: 'rgba(255,255,255,0.3)',
                  fontFamily: MONO, marginTop: 2,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  {timeAgo(s.publishedAt)}
                </div>
              </div>
              {isFresh(s.publishedAt) && (
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#34D399',
                  boxShadow: '0 0 8px rgba(52,211,153,0.5)',
                }} />
              )}
            </div>
          ))}
        </div>
      )}


      {/* ── SECONDARY MOSAIC — Asymmetric landscape thumbnails ─── */}
      {secondaryLong.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns:
            secondaryLong.length >= 3 ? '5fr 3fr 4fr'
            : secondaryLong.length === 2 ? '3fr 2fr' : '1fr',
          gap: 2, marginTop: 2,
        }}>
          {secondaryLong.map((u, i) => (
            <div key={u.id} style={{
              position: 'relative',
              aspectRatio: '16/9',
              overflow: 'hidden',
            }}>
              <img
                src={ytThumb(u.id)}
                alt="" loading="lazy"
                style={{
                  width: '100%', height: '100%',
                  objectFit: 'cover',
                  filter: `brightness(${0.6 - i * 0.05})`,
                }}
              />
              <div style={{
                position: 'absolute',
                bottom: 0, left: 0, right: 0, height: '50%',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
                pointerEvents: 'none',
              }} />
              <div style={{
                position: 'absolute', bottom: 8, left: 10, right: 10,
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
              }}>
                <div>
                  <div style={{
                    fontSize: 11, color: 'rgba(255,255,255,0.4)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    maxWidth: '90%',
                  }}>
                    {u.title}
                  </div>
                  <div style={{
                    fontSize: 8, color: 'rgba(255,255,255,0.2)',
                    fontFamily: MONO, marginTop: 2,
                  }}>
                    {timeAgo(u.publishedAt)}
                  </div>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.6)',
                  fontFamily: MONO, flexShrink: 0,
                }}>
                  {fmtNum(u.viewCount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}


      {/* ── STAT BAR — Typography interruption ─── */}
      <div style={{
        padding: '18px 40px',
        maxWidth: 1200, margin: '0 auto',
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', flexWrap: 'wrap', gap: 12,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: SMOKE, fontFamily: MONO,
        }}>
          {uploads30dCount} uploads in 30d · {shorts30dCount} shorts
        </span>
        <div>
          <span style={{
            fontSize: 28, fontWeight: 900,
            letterSpacing: '-0.03em',
            color: 'rgba(200,194,184,0.35)',
            fontFamily: MONO,
          }}>
            {fmtNum(totalViews)}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, marginLeft: 8,
            letterSpacing: '0.12em', color: SMOKE, fontFamily: MONO,
          }}>
            TOTAL VIEWS
          </span>
        </div>
      </div>
    </section>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// LIVE MOMENT — The operational heartbeat, hero-scale
// ══════════════════════════════════════════════════════════════════════════════

function LiveMomentBlock({ moment }: { moment: CampaignMoment }) {
  const phaseTone = PHASE_TONE[moment.phase];
  const isLive = moment.timing === 'current';

  const doneActions = moment.actions.filter(
    (a) => a.status === 'completed' || a.status === 'live'
  );
  const openActions = moment.actions.filter(
    (a) => a.status === 'missing' || a.status === 'late'
  );
  const plannedActions = moment.actions.filter(
    (a) => a.status === 'planned'
  );

  return (
    <section style={{
      maxWidth: 1200, margin: '0 auto', padding: '0 40px',
      marginBottom: 64,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        marginBottom: 20,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: GHOST, fontFamily: MONO,
        }}>
          W{moment.weekNum} · {moment.dateRange}
        </span>
        {isLive && (
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
            textTransform: 'uppercase',
            padding: '3px 10px', borderRadius: 3,
            background: phaseTone.accent, color: WHITE,
            animation: 'cpulse 2s ease-in-out infinite',
          }}>
            LIVE
          </span>
        )}
      </div>

      <h2 style={{
        fontSize: 'clamp(28px, 4vw, 48px)',
        fontWeight: 900, lineHeight: 0.95,
        letterSpacing: '-0.02em', margin: 0, color: INK,
      }}>
        {moment.momentName}
      </h2>

      {moment.primaryUpload && (
        <div style={{
          marginTop: 28,
          position: 'relative',
          borderRadius: 6, overflow: 'hidden',
          aspectRatio: '16/9',
        }}>
          <img
            src={ytThumb(moment.primaryUpload.id, 'maxresdefault')}
            alt="" loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            padding: '48px 28px 20px',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 'clamp(24px, 3vw, 40px)',
                fontWeight: 900, color: WHITE,
                fontFamily: MONO, letterSpacing: '-0.02em',
              }}>
                {fmtNum(moment.primaryUpload.viewCount)}
              </span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                views
              </span>
              {moment.totalViews > moment.primaryUpload.viewCount && (
                <span style={{
                  fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: MONO,
                }}>
                  · {fmtNum(moment.totalViews)} total
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {(doneActions.length > 0 || openActions.length > 0 || plannedActions.length > 0) && (
        <div style={{
          marginTop: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 8,
        }}>
          {doneActions.map((a, i) => (
            <div key={`d-${i}`} style={{
              position: 'relative',
              aspectRatio: '16/9',
              background: '#1a1a1a',
              borderRadius: 4, overflow: 'hidden',
            }}>
              {a.matchedUpload ? (
                <img
                  src={ytThumb(a.matchedUpload.id)}
                  alt="" loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{
                  width: '100%', height: '100%', background: '#1a1a1a',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 16, color: '#059669' }}>✓</span>
                </div>
              )}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '20px 8px 6px',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
                }}>
                  <span style={{
                    fontSize: 9, color: 'rgba(255,255,255,0.5)',
                    fontFamily: MONO, fontWeight: 600,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    maxWidth: '60%',
                  }}>
                    {cleanTitle(a.title)}
                  </span>
                  {a.matchedUpload && (
                    <span style={{
                      fontSize: 10, fontWeight: 800, color: WHITE, fontFamily: MONO,
                    }}>
                      {fmtNum(a.matchedUpload.viewCount)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {openActions.map((a, i) => (
            <div key={`o-${i}`} style={{
              aspectRatio: '16/9',
              border: `1px dashed ${GHOST}`,
              borderRadius: 4,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: 12, gap: 4,
            }}>
              <span style={{
                fontSize: 10, color: SMOKE, textAlign: 'center',
                fontFamily: MONO, lineHeight: 1.4,
              }}>
                {cleanTitle(a.title)}
              </span>
              <span style={{
                fontSize: 8, fontWeight: 800, color: '#D97706',
                letterSpacing: '0.1em', fontFamily: MONO,
              }}>
                {a.status === 'late' ? 'READY TO GO' : 'OPEN'}
              </span>
            </div>
          ))}

          {plannedActions.map((a, i) => (
            <div key={`p-${i}`} style={{
              aspectRatio: '16/9',
              background: BONE,
              borderRadius: 4,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: 12, gap: 4,
            }}>
              <span style={{
                fontSize: 10, color: SMOKE, textAlign: 'center', fontFamily: MONO,
              }}>
                {cleanTitle(a.title)}
              </span>
              <span style={{
                fontSize: 8, fontWeight: 700, color: GHOST,
                letterSpacing: '0.1em', fontFamily: MONO,
              }}>
                PLANNED
              </span>
            </div>
          ))}
        </div>
      )}

      {moment.extraUploads.length > 0 && (
        <div style={{
          marginTop: 14, display: 'flex', gap: 6,
          overflowX: 'auto', paddingBottom: 4,
        }}>
          {moment.extraUploads.map((u) => (
            <div key={u.id} style={{
              flexShrink: 0,
              width: u.durationSec <= 62 ? 72 : 120,
              aspectRatio: u.durationSec <= 62 ? '9/16' : '16/9',
              borderRadius: 3, overflow: 'hidden', position: 'relative',
            }}>
              <img
                src={ytThumb(u.id, 'mqdefault')}
                alt="" loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }}
              />
              <div style={{
                position: 'absolute', bottom: 3, left: 5,
                fontSize: 9, fontWeight: 700, color: WHITE,
                fontFamily: MONO,
                textShadow: '0 1px 2px rgba(0,0,0,0.8)',
              }}>
                {fmtNum(u.viewCount)}
              </div>
            </div>
          ))}
        </div>
      )}

      {moment.supportMissing.length > 0 && (
        <p style={{
          fontSize: 14, color: INK, fontWeight: 500,
          marginTop: 24, marginBottom: 0, lineHeight: 1.6,
          paddingLeft: 16, maxWidth: 560,
          borderLeft: `2px solid ${phaseTone.accent}`,
        }}>
          {buildMomentGuidance(moment)}
        </p>
      )}
    </section>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// CHAPTER ROW — Upcoming moment as editorial block
// ══════════════════════════════════════════════════════════════════════════════

function ChapterRow({ moment }: { moment: CampaignMoment }) {
  const phaseTone = PHASE_TONE[moment.phase];
  return (
    <div style={{
      padding: '20px 0',
      borderBottom: `1px solid ${BONE}`,
      display: 'flex', alignItems: 'flex-start', gap: 20,
    }}>
      <div style={{
        minWidth: 90,
        display: 'flex', flexDirection: 'column', gap: 3,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, color: GHOST, fontFamily: MONO,
        }}>
          W{moment.weekNum}
        </span>
        <span style={{
          fontSize: 11, color: SMOKE, fontFamily: MONO,
        }}>
          {moment.dateRange.split('–')[0]}
        </span>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 18, fontWeight: 800, color: INK,
          lineHeight: 1.2, marginBottom: 4,
        }}>
          {moment.momentName}
        </div>
        <div style={{ fontSize: 12, color: SMOKE }}>
          {moment.actions.length} planned {moment.actions.length === 1 ? 'action' : 'actions'}
        </div>
      </div>
      <div style={{
        width: 4, height: 32,
        background: phaseTone.accent,
        borderRadius: 2,
        flexShrink: 0, alignSelf: 'center',
      }} />
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// PHASE STRIP
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
              textTransform: 'uppercase', fontFamily: MONO,
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
// TIMELINE DETAIL
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
              fontFamily: MONO,
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
  const openWindows = actions.filter((a) =>
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
          fontSize: 10, fontWeight: 700, color: GHOST, minWidth: 28, fontFamily: MONO,
        }}>
          W{week.weekNum}
        </span>
        <span style={{
          fontSize: 11, color: GHOST, minWidth: 80, fontFamily: MONO,
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
            fontFamily: MONO,
          }}>
            {done > 0 && <span style={{ color: '#059669', fontWeight: 700 }}>{done}✓</span>}
            {openWindows > 0 && <span style={{ color: '#D97706', fontWeight: 700 }}>{openWindows} open</span>}
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
            const isOpen = status === 'late';
            const isUpcoming = status === 'missing';

            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 12, padding: '3px 0',
                color: isDone ? GHOST : isOpen ? '#92400E' : isUpcoming ? '#78350F' : INK,
                textDecoration: isDone ? 'line-through' : 'none',
                opacity: isDone ? 0.5 : 1,
              }}>
                <span style={{ fontSize: 10, opacity: 0.6, fontFamily: MONO }}>
                  {a.format === 'short' ? '⚡' : a.format === 'video' || a.format === 'premiere' ? '▶' : a.format === 'live' ? '◉' : '·'}
                </span>
                <span style={{ flex: 1 }}>{a.title}</span>
                {matched?.matchedUpload && (
                  <span style={{ fontSize: 10, color: '#059669', fontFamily: MONO }}>
                    {fmtNum(matched.matchedUpload.viewCount)}
                  </span>
                )}
                {(isOpen || isUpcoming) && (
                  <span style={{
                    fontSize: 8, fontWeight: 800, padding: '1px 6px', borderRadius: 2,
                    background: isOpen ? '#FFFBEB' : '#FFF7ED',
                    color: isOpen ? '#D97706' : '#92400E',
                    textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: MONO,
                  }}>
                    {isOpen ? 'Ready' : 'Open'}
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
// ERA SIGNAL — Auto-generated reading of the current campaign era
// ══════════════════════════════════════════════════════════════════════════════

function generateEraSignal(
  uploads30d: RecentUpload[],
  shorts30d: RecentUpload[],
  long30d: RecentUpload[],
  liveChannel?: CampaignDestinationProps['liveChannel'],
): string | null {
  if (uploads30d.length === 0 && !liveChannel) return null;

  const parts: string[] = [];

  // Cadence character
  if (uploads30d.length >= 12) {
    parts.push('Heavy output phase');
  } else if (uploads30d.length >= 6) {
    parts.push('Active cadence');
  } else if (uploads30d.length >= 2) {
    parts.push('Building slowly');
  } else if (uploads30d.length === 1) {
    parts.push('Single upload in 30 days');
  } else {
    parts.push('Channel quiet');
  }

  // Content mix
  if (shorts30d.length > 0 && long30d.length > 0) {
    if (shorts30d.length > long30d.length * 2) {
      parts.push('shorts-heavy');
    } else if (long30d.length > shorts30d.length) {
      parts.push('longform-focused');
    } else {
      parts.push('balanced mix');
    }
  } else if (shorts30d.length > 0) {
    parts.push('all Shorts');
  } else if (long30d.length > 0) {
    parts.push('all longform');
  }

  // Recency
  if (liveChannel?.lastUploadDaysAgo != null) {
    if (liveChannel.lastUploadDaysAgo === 0) {
      parts.push('uploaded today');
    } else if (liveChannel.lastUploadDaysAgo <= 2) {
      parts.push(`last upload ${liveChannel.lastUploadDaysAgo}d ago`);
    } else if (liveChannel.lastUploadDaysAgo > 14) {
      parts.push(`${liveChannel.lastUploadDaysAgo}d since last upload`);
    }
  }

  return parts.join(' · ');
}


// ══════════════════════════════════════════════════════════════════════════════
// HELPERS — Collaborative language system
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
        text: `${cleanTitle(top.title)} is live${daysSince <= 1 ? ' — audience is responding' : ` — ${fmtNum(upload.viewCount)} views in ${daysSince} days`}`,
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
        text: `"${top.title}" is building momentum — ${fmtNum(top.viewCount)} views`,
        urgency: 'positive',
      });
    }
  }

  if (liveChannel?.views7Delta != null) {
    if (liveChannel.views7Delta > 10000) {
      signals.push({
        text: `Momentum is building — ${fmtNum(liveChannel.views7Delta)} views this week`,
        urgency: 'positive',
      });
    } else if (liveChannel.views7Delta > 0) {
      signals.push({
        text: `The audience is active — +${fmtNum(liveChannel.views7Delta)} views this week`,
        urgency: 'neutral',
      });
    } else if (liveChannel.views7Delta < 0) {
      signals.push({
        text: 'Views are cooling this week — a new upload could reignite momentum',
        urgency: 'warning',
      });
    }
  }

  if (liveChannel) {
    const u30 = liveChannel.uploads30d ?? 0;
    const s30 = liveChannel.shorts30d ?? 0;
    if (u30 >= 8) {
      signals.push({ text: `Active output — ${u30} uploads keeping the channel warm this month`, urgency: 'positive' });
    } else if (s30 >= 3 && u30 >= 3) {
      signals.push({ text: `Short-form content is driving momentum — ${s30} shorts this month`, urgency: 'positive' });
    } else if (u30 === 0) {
      signals.push({ text: 'The channel is quiet this month — the next upload will restart the conversation', urgency: 'warning' });
    }
  }

  const lastUpload = liveChannel?.lastUploadDaysAgo;
  if (lastUpload != null && lastUpload > 10) {
    signals.push({
      text: `${lastUpload} days since last upload${currentPhase === 'RELEASE' ? ' — the release window is open for a new moment' : ' — a new upload could re-engage the audience'}`,
      urgency: lastUpload > 21 ? 'critical' : 'warning',
    });
  }

  if (matchResult) {
    const { stats } = matchResult;
    const pastDue = stats.completed + stats.live + stats.missing + stats.late;
    if (stats.late > 0) {
      signals.push({
        text: `${stats.late} planned upload${stats.late > 1 ? 's have' : ' has'} open windows — the audience is ready`,
        urgency: 'warning',
      });
    } else if (pastDue >= 3 && stats.completionRate < 40) {
      signals.push({
        text: `The rollout is building at its own pace — ${Math.round(stats.completionRate)}% of planned content is live`,
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
        text: `"${lateActions[0].title}" has an open window — uploading now could still capture the moment.`,
        urgency: 'critical',
      });
    }
    if (stats.missing > 0) {
      items.push({
        text: `${stats.missing} planned upload${stats.missing > 1 ? 's have' : ' has'} open windows. These could strengthen the rollout.`,
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
      text += `Execution: ${Math.round(stats.completionRate)}% (${stats.completed + stats.live} landed, ${stats.planned} upcoming`;
      if (stats.missing > 0) text += `, ${stats.missing} open windows`;
      if (stats.late > 0) text += `, ${stats.late} ready to go`;
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
      if (rate >= 70) text += `Status: Strong momentum\n`;
      else if (rate >= 40) text += `Status: Building steadily\n`;
      else text += `Status: Early stages — room to accelerate\n`;
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
        const status = m.timing === 'current' ? '→ NOW' : m.timing === 'past' ? '✓ Landed' : '  Upcoming';
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
        text += `Content opportunities:\n`;
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
    return `${missing[0]} has an open window. Additional content here could extend the moment's reach.`;
  }
  if (missing.length > 1) {
    return `${missing.length} support pieces could strengthen this moment. Starting with ${missing[0]} would build the most momentum.`;
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
