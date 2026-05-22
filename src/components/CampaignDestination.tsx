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
import type { CampaignDataCoverage } from '@/lib/planStore';
// ── Unified Pipeline — single import for all campaign logic ──
import {
  buildCampaignPipeline,
  classifyUploadFormat,
  coverageLabel as narrativeCoverageLabel,
  coverageTone as narrativeCoverageTone,
  arcLabel,
  isCurrentWeek,
  isWeekPast,
  parseDateRange,
  type CampaignPipelineState,
  type PlanMoment,
} from '@/lib/coach/campaignPipeline';
import type { ReleaseCluster, ReleaseMoment, SupportCategory, PremiereStatus } from '@/lib/coach/releaseClusters';
import type { CampaignNarrative, NarrativeMoment } from '@/lib/coach/campaignNarrative';

// ══════════════════════════════════════════════════════════════════════════════
// DESIGN SYSTEM — YouTube Rollout Map v6
// Hero (poster) → Rollout Identity → Rollout Map → Campaign Surface
// ══════════════════════════════════════════════════════════════════════════════

const INK = '#0A0A0A';
const PAPER = '#F5F2ED';
const BONE = '#EBE7DF';
const SMOKE = '#8A847A';
const GHOST = '#C8C2B8';
const WHITE = '#FFFFFF';

const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace';

const PHASE_TONE: Record<PhaseName, { accent: string; label: string; narrative: string; energy: string }> = {
  BUILD: {
    accent: '#4338CA',
    label: 'BUILD THE WORLD',
    narrative: 'Warming the algorithm. Building presence and anticipation.',
    energy: 'Discovery · intimacy · artist identity · audience familiarity',
  },
  RELEASE: {
    accent: '#DC2626',
    label: 'THE CENTREPIECE',
    narrative: 'The main event. Maximum visibility and impact.',
    energy: 'Maximum pressure · event energy · major release moments',
  },
  SCALE: {
    accent: '#059669',
    label: 'SCALE THE STORY',
    narrative: 'Momentum is building. Extend the reach further.',
    energy: 'Expansion · reactions · sustained discovery · collaboration',
  },
  EXTEND: {
    accent: '#D97706',
    label: 'EXTEND THE WORLD',
    narrative: 'Keep the universe alive. Sustain audience connection.',
    energy: 'Long-tail attention · catalog support · fan world deepening',
  },
};

// ── YouTube thumbnail helpers ─────────────────────────────────────────────

function ytThumb(id: string, q: 'maxresdefault' | 'hqdefault' | 'mqdefault' = 'hqdefault'): string {
  return `https://i.ytimg.com/vi/${id}/${q}.jpg`;
}

function ytVideoUrl(id: string, durationSec?: number): string {
  if (durationSec != null && durationSec <= 62) {
    return `https://youtube.com/shorts/${id}`;
  }
  return `https://youtube.com/watch?v=${id}`;
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
  dataCoverage?: CampaignDataCoverage;
  campaignStartDate?: string;
};

type PulseSignal = {
  text: string;
  urgency: 'positive' | 'neutral' | 'warning' | 'critical';
};

// CampaignMoment is now PlanMoment from the unified pipeline
type CampaignMoment = PlanMoment;


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
  dataCoverage,
  campaignStartDate,
}: CampaignDestinationProps) {
  // ═══ UNIFIED PIPELINE — single entry point for all campaign logic ═══
  const pipeline = buildCampaignPipeline({
    plan,
    recentUploads,
    matchResult,
    campaignStartDate,
  });

  // Destructure pipeline output — these are the ONLY data sources for rendering
  const {
    currentPhase,
    narrative,
    heroUpload,
    activeMoment: narrativeActiveMoment,
    releaseClusters,
    planMoments: moments,
    activePlanMoment: activeMoment,
    allByRecency,
    shorts,
    longform,
    totalCampaignViews,
    totalPlanned,
    landed,
    openOpportunities,
    uploads30d,
    shorts30d,
    long30d,
  } = pipeline;

  const pulseSignals = generatePulseSignals(matchResult, liveChannel, recentUploads ?? [], currentPhase, plan);
  const phaseTone = currentPhase ? PHASE_TONE[currentPhase] : null;
  const campaignTitle = plan.campaignName.replace(/ Campaign$/i, '');
  const eraSignal = generateEraSignal(uploads30d, shorts30d, long30d, liveChannel);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes cpulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
      `}} />

      <div style={{ minHeight: '100vh', background: PAPER, color: INK }}>


        {/* ══════════════════════════════════════════════════════════════════
            HERO — Compressed cinematic opening. The movie poster.
        ══════════════════════════════════════════════════════════════════ */}
        <section style={{
          background: INK,
          color: PAPER,
          position: 'relative',
          overflow: 'hidden',
          minHeight: allByRecency.length > 0 ? '44vh' : '36vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}>
          {/* Thumbnail mosaic texture */}
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
              YouTube Rollout Map
            </Link>
            <Link href="/coach" style={{
              fontSize: 11, fontWeight: 600, color: SMOKE,
              textDecoration: 'none', padding: '4px 12px',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4,
            }}>
              All Campaigns
            </Link>
          </div>

          {/* Hero content */}
          <div style={{
            position: 'relative', zIndex: 1,
            maxWidth: 1200, margin: '0 auto', padding: '0 40px',
            paddingBottom: 40, width: '100%',
            boxSizing: 'border-box',
          }}>
            {phaseTone && (
              <div style={{
                width: 48, height: 3,
                background: phaseTone.accent,
                marginBottom: 20,
              }} />
            )}

            <div style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.25em',
              textTransform: 'uppercase', color: GHOST,
              marginBottom: 14, fontFamily: MONO,
            }}>
              {plan.artist}
            </div>

            <h1 style={{
              fontSize: 'clamp(44px, 7vw, 84px)',
              fontWeight: 900,
              lineHeight: 0.88,
              letterSpacing: '-0.04em',
              textTransform: 'uppercase',
              margin: 0, maxWidth: 800, color: WHITE,
            }}>
              {campaignTitle}
            </h1>

            {/* Era reading + metrics inline */}
            <div style={{
              marginTop: 20,
              display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'baseline',
              fontSize: 12, color: 'rgba(200,194,184,0.4)',
              fontFamily: MONO,
            }}>
              {eraSignal && <span>{eraSignal}</span>}
              {liveChannel?.subs != null && <span>{fmtNum(liveChannel.subs)} subs</span>}
              {liveChannel?.views7Delta != null && (
                <span style={{ color: liveChannel.views7Delta > 0 ? 'rgba(52,211,153,0.6)' : undefined }}>
                  {liveChannel.views7Delta >= 0 ? '+' : ''}{fmtNum(liveChannel.views7Delta)} views/7d
                </span>
              )}
            </div>
          </div>
        </section>


        {/* ── CADENCE STRIP ── */}
        {uploads30d.length > 0 && (
          <CadenceStrip
            uploads={uploads30d}
            accent={phaseTone?.accent ?? SMOKE}
          />
        )}


        {/* ┌──────────────────────────────────────────────────────────────┐
            │                                                              │
            │   R O L L O U T   I D E N T I T Y                           │
            │   Immediate orientation. Label the product clearly.          │
            │                                                              │
            └──────────────────────────────────────────────────────────────┘ */}

        <section style={{
          maxWidth: 1200, margin: '0 auto',
          padding: '36px 40px 0',
        }}>
          <div style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.3em',
            textTransform: 'uppercase', color: GHOST,
            fontFamily: MONO, marginBottom: 10,
          }}>
            YouTube Rollout Map
          </div>

          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 12,
            flexWrap: 'wrap', marginBottom: 8,
          }}>
            <h2 style={{
              fontSize: 'clamp(20px, 3vw, 32px)',
              fontWeight: 900, lineHeight: 1,
              letterSpacing: '-0.02em', textTransform: 'uppercase',
              margin: 0, color: INK,
            }}>
              {plan.artist} — {campaignTitle}
            </h2>
          </div>

          <div style={{
            display: 'flex', gap: 16, flexWrap: 'wrap',
            fontSize: 12, color: SMOKE, fontFamily: MONO,
            marginBottom: 6,
          }}>
            {currentPhase && phaseTone && (
              <span>
                Phase: <span style={{ color: phaseTone.accent, fontWeight: 700 }}>{phaseTone.label}</span>
              </span>
            )}
            <span>{plan.totalWeeks}-week rollout</span>
            {narrative.arc !== 'dormant' && (
              <span style={{ fontStyle: 'italic', color: GHOST }}>
                {arcLabel(narrative.arc)}
              </span>
            )}
          </div>

          <div style={{
            display: 'flex', gap: 16, flexWrap: 'wrap',
            fontSize: 12, color: SMOKE, fontFamily: MONO,
          }}>
            <span>{totalPlanned} planned uploads</span>
            {landed > 0 && <span style={{ color: '#059669' }}>{landed} landed</span>}
            {openOpportunities > 0 && <span style={{ color: '#D97706' }}>{openOpportunities} open {openOpportunities === 1 ? 'opportunity' : 'opportunities'}</span>}
            {matchResult && <span>{Math.round(matchResult.stats.completionRate)}% executed</span>}
            {narrative.stats.totalMoments > 0 && (
              <span>{narrative.stats.totalMoments} release {narrative.stats.totalMoments === 1 ? 'moment' : 'moments'}</span>
            )}
          </div>

          {/* Inline pulse — top signal only */}
          {pulseSignals.length > 0 && (
            <div style={{
              marginTop: 12,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                background: pulseSignals[0].urgency === 'positive' ? '#059669'
                  : pulseSignals[0].urgency === 'warning' ? '#D97706'
                  : pulseSignals[0].urgency === 'critical' ? '#DC2626' : GHOST,
              }} />
              <span style={{ fontSize: 12, color: SMOKE, lineHeight: 1.4 }}>
                {pulseSignals[0].text}
              </span>
            </div>
          )}

          {/* Data coverage badge */}
          {dataCoverage && (
            <div style={{
              marginTop: 10,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{
                width: 4, height: 4, borderRadius: '50%', flexShrink: 0,
                background: dataCoverage.fullCoverage ? '#059669' : '#D97706',
                opacity: 0.6,
              }} />
              <span style={{
                fontSize: 10, color: GHOST, fontFamily: MONO,
                letterSpacing: '0.04em',
              }}>
                {dataCoverage.coverageNote}
              </span>
              {dataCoverage.sources.length > 0 && (
                <span style={{
                  fontSize: 8, color: GHOST, fontFamily: MONO,
                  padding: '1px 6px', borderRadius: 2,
                  border: `1px solid ${BONE}`,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>
                  {dataCoverage.sources.includes('youtube_api') ? 'API' :
                   dataCoverage.sources.includes('kv_cache') ? 'Cache' :
                   dataCoverage.sources.includes('manual') ? 'Manual' : 'Saved'}
                </span>
              )}
            </div>
          )}
        </section>


        {/* ┌──────────────────────────────────────────────────────────────┐
            │                                                              │
            │   R O L L O U T   M A P                                     │
            │   The campaign operating system. The product spine.          │
            │                                                              │
            └──────────────────────────────────────────────────────────────┘ */}


        {/* ── Phase + Rollout State ── */}
        <section style={{
          maxWidth: 1200, margin: '0 auto',
          padding: '28px 40px 0',
        }}>
          {/* Phase strip — visual progress */}
          <PhaseStrip phases={plan.phases} totalWeeks={plan.totalWeeks} currentPhase={currentPhase} />
        </section>


        {/* ══════════════════════════════════════════════════════════════
            SECTION 1: ACTIVE CAMPAIGN MOMENT
            "What is happening now?" — driven by timeline/plan position.
            This is ALWAYS the top section. It answers where we are
            in the campaign, not which video is performing best.
        ══════════════════════════════════════════════════════════════ */}
        {activeMoment ? (
          <section style={{
            maxWidth: 1200, margin: '0 auto',
            padding: '24px 40px 0',
          }}>
            <div style={{
              background: WHITE,
              border: `2px solid ${phaseTone?.accent ?? '#DC2626'}`,
              borderRadius: 10,
              padding: '20px 24px 24px',
              position: 'relative',
              boxShadow: `0 0 0 4px ${(phaseTone?.accent ?? '#DC2626')}12`,
            }}>
              {/* THIS WEEK banner */}
              <div style={{
                position: 'absolute',
                top: -13, left: 20,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 900, letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  padding: '4px 14px', borderRadius: 4,
                  background: phaseTone?.accent ?? '#DC2626', color: WHITE,
                  fontFamily: MONO,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}>
                  This Week
                </span>
              </div>
              <LiveMomentBlock moment={activeMoment} phase={currentPhase ?? activeMoment.phase} />
            </div>
          </section>
        ) : narrative.activeMoment ? (
          /* No plan-driven active moment — use narrative engine as primary */
          <section style={{
            maxWidth: 1200, margin: '0 auto',
            padding: '24px 40px 0',
          }}>
            <div style={{
              background: WHITE,
              border: `2px solid ${phaseTone?.accent ?? '#DC2626'}`,
              borderRadius: 10,
              padding: '20px 24px 24px',
              position: 'relative',
              boxShadow: `0 0 0 4px ${(phaseTone?.accent ?? '#DC2626')}12`,
            }}>
              {/* RIGHT NOW banner */}
              <div style={{
                position: 'absolute',
                top: -13, left: 20,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 900, letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  padding: '4px 14px', borderRadius: 4,
                  background: phaseTone?.accent ?? '#DC2626', color: WHITE,
                  fontFamily: MONO,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}>
                  Right Now
                </span>
              </div>
              <NarrativeHeroBlock moment={narrative.activeMoment} phase={currentPhase} />
            </div>
          </section>
        ) : (
          <section style={{
            maxWidth: 1200, margin: '0 auto',
            padding: '24px 40px 0',
          }}>
            <div style={{
              padding: '20px 24px',
              background: WHITE,
              border: `1px solid ${BONE}`,
              borderRadius: 6,
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: GHOST, fontFamily: MONO,
                marginBottom: 6,
              }}>
                No active moment
              </div>
              <div style={{ fontSize: 13, color: SMOKE, lineHeight: 1.5 }}>
                {narrative.moments.length > 0
                  ? 'All campaign moments are either completed or upcoming. Check the timeline below for what\'s next.'
                  : 'No campaign moments scheduled yet. The timeline will populate once releases are planned.'}
              </div>
            </div>
          </section>
        )}

        {/* ── Timeline ── */}
        <section style={{
          maxWidth: 1200, margin: '0 auto',
          padding: '24px 40px 0',
        }}>
          <TimelineDetail plan={plan} matchResult={matchResult} currentPhase={currentPhase} releaseClusters={releaseClusters} releaseMoments={pipeline.releaseMoments} />
        </section>


        {/* Campaign Pillars are now integrated into the timeline above */}


        {/* ┌──────────────────────────────────────────────────────────────┐
            │                                                              │
            │   C A M P A I G N   S U R F A C E                           │
            │   Visual proof of execution.                                 │
            │                                                              │
            └──────────────────────────────────────────────────────────────┘ */}

        {allByRecency.length >= 2 && (
          <>
            <section style={{
              maxWidth: 1200, margin: '0 auto',
              padding: '40px 40px 0',
            }}>
              <div style={{
                width: '100%', height: 1, background: BONE,
                marginBottom: 24,
              }} />
              <div style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '0.3em',
                textTransform: 'uppercase', color: GHOST,
                fontFamily: MONO,
              }}>
                Campaign Surface
              </div>
            </section>
            <div style={{ marginTop: 16 }}>
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


        {/* ── Notes ── */}
        <NotesSection slug={slug} />

        {/* Footer */}
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px' }}>
          <div style={{
            padding: '20px 0 32px', borderTop: `1px solid ${BONE}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{
              fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase',
              color: GHOST, fontFamily: MONO,
            }}>
              YouTube Rollout Map
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
        maxWidth: 1200, margin: '0 auto', padding: '12px 40px 10px',
      }}>
        <div style={{
          position: 'relative',
          height: 28,
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
          <span style={{
            position: 'absolute', left: 8, top: 3,
            fontSize: 7, color: 'rgba(200,194,184,0.25)',
            fontFamily: MONO, letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}>
            30d
          </span>
          <span style={{
            position: 'absolute', right: 8, top: 3,
            fontSize: 7, color: 'rgba(200,194,184,0.25)',
            fontFamily: MONO, letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}>
            Now
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
      {heroUpload && (
        <a
          href={ytVideoUrl(heroUpload.id, heroUpload.durationSec)}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
        >
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
              padding: '60px 40px 20px',
              background: 'linear-gradient(transparent 0%, rgba(10,10,10,0.85) 100%)',
            }}>
              <div style={{
                maxWidth: 1200, margin: '0 auto',
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-end', flexWrap: 'wrap', gap: 12,
              }}>
                <div style={{ maxWidth: 500 }}>
                  <div style={{
                    fontSize: 13, color: 'rgba(255,255,255,0.5)',
                    marginBottom: 4,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {heroUpload.title}
                  </div>
                  <div style={{
                    display: 'flex', gap: 10, alignItems: 'center',
                    fontSize: 9, color: 'rgba(255,255,255,0.2)',
                    fontFamily: MONO, letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}>
                    <span>{timeAgo(heroUpload.publishedAt)}</span>
                    {isFresh(heroUpload.publishedAt) && (
                      <span style={{ color: '#34D399', fontWeight: 700 }}>NEW</span>
                    )}
                    {heroUpload.isCollab && (
                      <span style={{ color: '#A5B4FC', fontWeight: 800 }}>COLLAB{heroUpload.collabChannel ? ` · via ${heroUpload.collabChannel}` : ''}</span>
                    )}
                    {heroUpload.likeCount > 0 && <span>{fmtNum(heroUpload.likeCount)} likes</span>}
                    {heroUpload.commentCount > 0 && <span>{fmtNum(heroUpload.commentCount)} comments</span>}
                  </div>
                </div>
                <div style={{
                  fontSize: 'clamp(28px, 3.5vw, 48px)',
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  color: WHITE, fontFamily: MONO, lineHeight: 1,
                }}>
                  {fmtNum(heroUpload.viewCount)}
                </div>
              </div>
            </div>
          </div>
        </a>
      )}

      {shorts.length > 0 && (
        <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
          {shorts.slice(0, Math.min(shorts.length, 5)).map((s) => (
            <a
              key={s.id}
              href={ytVideoUrl(s.id, s.durationSec)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: '1 1 0',
                aspectRatio: '9/16',
                position: 'relative',
                overflow: 'hidden',
                minWidth: 0,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
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
              <div style={{ position: 'absolute', bottom: 8, left: 10, right: 10 }}>
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
            </a>
          ))}
        </div>
      )}

      {secondaryLong.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns:
            secondaryLong.length >= 3 ? '5fr 3fr 4fr'
            : secondaryLong.length === 2 ? '3fr 2fr' : '1fr',
          gap: 2, marginTop: 2,
        }}>
          {secondaryLong.map((u, i) => (
            <a
              key={u.id}
              href={ytVideoUrl(u.id, u.durationSec)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                position: 'relative',
                aspectRatio: '16/9',
                overflow: 'hidden',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
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
              {u.isCollab && (
                <div style={{
                  position: 'absolute', top: 8, left: 8,
                  fontSize: 7, fontWeight: 800, color: WHITE,
                  fontFamily: MONO, letterSpacing: '0.1em',
                  padding: '2px 6px', borderRadius: 3,
                  background: 'rgba(99,102,241,0.85)',
                }}>
                  COLLAB{u.collabChannel ? ` · ${u.collabChannel}` : ''}
                </div>
              )}
              <div style={{
                position: 'absolute', bottom: 8, left: 10, right: 10,
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
              }}>
                <div style={{
                  fontSize: 8, color: 'rgba(255,255,255,0.2)',
                  fontFamily: MONO,
                }}>
                  {timeAgo(u.publishedAt)}
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.6)',
                  fontFamily: MONO, flexShrink: 0,
                }}>
                  {fmtNum(u.viewCount)}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}

      <div style={{
        padding: '14px 40px',
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
            fontSize: 24, fontWeight: 900,
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
// NOTES — Lightweight campaign notes
// ══════════════════════════════════════════════════════════════════════════════

function NotesSection({ slug }: { slug: string }) {
  const [notes, setNotes] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);

  const addNote = () => {
    const text = draft.trim();
    if (!text) return;
    setNotes((prev) => [
      ...prev,
      text,
    ]);
    setDraft('');
  };

  return (
    <section style={{
      maxWidth: 1200, margin: '0 auto', padding: '40px 40px 0',
    }}>
      <div style={{ borderTop: `1px solid ${BONE}`, paddingTop: 20, paddingBottom: 32 }}>
        <button
          onClick={() => setOpen(!open)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 0,
          }}
        >
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
            textTransform: 'uppercase', color: GHOST,
            fontFamily: MONO,
          }}>
            Notes
          </span>
          {notes.length > 0 && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: SMOKE,
              fontFamily: MONO,
            }}>
              ({notes.length})
            </span>
          )}
          <span style={{
            fontSize: 7, color: GHOST,
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.15s',
          }}>▶</span>
        </button>

        {open && (
          <div style={{ marginTop: 12 }}>
            {notes.length > 0 && (
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 6,
                marginBottom: 12,
              }}>
                {notes.map((note, i) => (
                  <div key={i} style={{
                    padding: '8px 12px',
                    background: WHITE,
                    border: `1px solid ${BONE}`,
                    borderRadius: 4,
                    fontSize: 12, color: INK, lineHeight: 1.5,
                  }}>
                    {note}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addNote(); }}
                placeholder="Add a note..."
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: 12, color: INK,
                  border: `1px solid ${BONE}`,
                  borderRadius: 4,
                  background: WHITE,
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={addNote}
                style={{
                  fontSize: 11, fontWeight: 700, padding: '8px 16px',
                  background: draft.trim() ? INK : BONE,
                  color: draft.trim() ? PAPER : GHOST,
                  border: 'none', borderRadius: 4,
                  cursor: draft.trim() ? 'pointer' : 'default',
                  letterSpacing: '0.04em',
                }}
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// NARRATIVE HERO BLOCK — Driven by weighted release scoring, not timeline density
// The highest-weighted active release moment becomes the page hero.
// An Official Video (weight 100) always beats a community post (35) or tour reminder (20).
// ══════════════════════════════════════════════════════════════════════════════

function NarrativeHeroBlock({ moment, phase }: { moment: NarrativeMoment; phase: PhaseName | null }) {
  const phaseTone = phase ? PHASE_TONE[phase] : null;
  const isLive = moment.state === 'live';
  const isSustaining = moment.state === 'sustaining';
  const cp = moment.centrepiece;
  const coverageTone_ = narrativeCoverageTone(moment.supportCoverage);

  const supportFormats = moment.support.map(a => a.format);
  const momentumCount = moment.momentum.length;
  const ecosystemCount = moment.ecosystem.length;

  return (
    <div>
      {/* Header: state badge + moment label */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 14,
      }}>
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: GHOST, fontFamily: MONO,
        }}>
          {cp.format} · {timeAgo(cp.upload.publishedAt)}
        </span>
        {isLive && (
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
            textTransform: 'uppercase',
            padding: '3px 10px', borderRadius: 3,
            background: phaseTone?.accent ?? '#DC2626', color: WHITE,
            animation: 'cpulse 2s ease-in-out infinite',
          }}>
            LIVE
          </span>
        )}
        {isSustaining && (
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
            textTransform: 'uppercase',
            padding: '3px 10px', borderRadius: 3,
            background: '#059669', color: WHITE,
          }}>
            SUSTAINING
          </span>
        )}
        <span style={{
          fontSize: 8, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase',
          padding: '2px 8px', borderRadius: 3,
          background: coverageTone_.bg, color: coverageTone_.color,
          border: `1px solid ${coverageTone_.border}`,
        }}>
          {narrativeCoverageLabel(moment.supportCoverage)}
        </span>
      </div>

      <h3 style={{
        fontSize: 'clamp(22px, 3vw, 36px)',
        fontWeight: 900, lineHeight: 0.95,
        letterSpacing: '-0.02em', margin: 0, color: INK,
      }}>
        {moment.label}
      </h3>

      {/* Centrepiece thumbnail + support orbit grid */}
      <div style={{
        marginTop: 20,
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: 8,
        alignItems: 'start',
      }}>
        {/* Primary centrepiece thumbnail */}
        <a
          href={ytVideoUrl(cp.upload.id, cp.upload.durationSec)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            position: 'relative',
            borderRadius: 6, overflow: 'hidden',
            aspectRatio: '16/9',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <img
            src={ytThumb(cp.upload.id, 'maxresdefault')}
            alt="" loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            padding: '40px 20px 14px',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{
                fontSize: 'clamp(20px, 2.5vw, 32px)',
                fontWeight: 900, color: WHITE,
                fontFamily: MONO, letterSpacing: '-0.02em',
              }}>
                {fmtNum(cp.upload.viewCount)}
              </span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>views</span>
            </div>
          </div>
          {/* Collab badge overlay */}
          {cp.upload.isCollab && (
            <div style={{
              position: 'absolute', top: 10, left: 10,
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 4,
              background: 'rgba(99,102,241,0.9)',
              backdropFilter: 'blur(4px)',
            }}>
              <span style={{
                fontSize: 9, fontWeight: 800, color: WHITE,
                fontFamily: MONO, letterSpacing: '0.1em',
              }}>
                COLLAB
              </span>
              {cp.upload.collabChannel && (
                <span style={{
                  fontSize: 8, color: 'rgba(255,255,255,0.7)',
                  fontFamily: MONO,
                }}>
                  via {cp.upload.collabChannel}
                </span>
              )}
            </div>
          )}
        </a>

        {/* Support orbit panel */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {/* Direct support (BTS, Lyric Video, Visualizer) */}
          {moment.support.slice(0, 4).map((s, i) => (
            <a
              key={`s-${i}`}
              href={ytVideoUrl(s.upload.id, s.upload.durationSec)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px',
                background: '#F0FDF4',
                borderRadius: 4,
              }}>
                <span style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>✓</span>
                <span style={{
                  fontSize: 12, color: INK, flex: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {s.format}
                </span>
                <span style={{ fontSize: 10, color: SMOKE, fontFamily: MONO }}>
                  {fmtNum(s.upload.viewCount)}
                </span>
              </div>
            </a>
          ))}

          {/* Momentum shorts summary */}
          {momentumCount > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px',
              background: '#F5F3FF',
              border: '1px solid #EDE9FE',
              borderRadius: 4,
            }}>
              <span style={{ fontSize: 11, color: '#7C3AED', fontWeight: 700 }}>◆</span>
              <span style={{ fontSize: 12, color: '#5B21B6', flex: 1 }}>
                {momentumCount} Short{momentumCount !== 1 ? 's' : ''} reinforcing
              </span>
              <span style={{ fontSize: 10, color: SMOKE, fontFamily: MONO }}>
                {fmtNum(moment.momentum.reduce((s, a) => s + a.upload.viewCount, 0))}
              </span>
            </div>
          )}

          {/* Ecosystem / world-building */}
          {ecosystemCount > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px',
              background: BONE,
              borderRadius: 4,
            }}>
              <span style={{ fontSize: 11, color: SMOKE, fontWeight: 700 }}>●</span>
              <span style={{ fontSize: 12, color: INK, flex: 1 }}>
                {ecosystemCount} ecosystem upload{ecosystemCount !== 1 ? 's' : ''}
              </span>
              <span style={{ fontSize: 10, color: SMOKE, fontFamily: MONO }}>
                {fmtNum(moment.ecosystem.reduce((s, a) => s + a.upload.viewCount, 0))}
              </span>
            </div>
          )}

          {/* Missing support formats */}
          {moment.supportCoverage < 1 && (
            <div style={{
              fontSize: 10, color: GHOST, fontFamily: MONO,
              padding: '4px 10px',
              letterSpacing: '0.04em',
            }}>
              {['Short', 'BTS', 'Lyric Video', 'Visualizer']
                .filter(f => !supportFormats.includes(f as any) && !moment.momentum.some(m => m.format === f))
                .map(f => `○ ${f}`)
                .join('  ')}
            </div>
          )}
        </div>
      </div>

      {/* Ecosystem total */}
      <div style={{
        marginTop: 12, display: 'flex', gap: 16, alignItems: 'center',
        fontSize: 10, color: SMOKE, fontFamily: MONO,
        letterSpacing: '0.06em',
      }}>
        <span>{fmtNum(moment.ecosystemViews)} ecosystem views</span>
        <span>{moment.support.length} support</span>
        <span>{momentumCount} shorts</span>
        {ecosystemCount > 0 && <span>{ecosystemCount} world-building</span>}
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// LIVE MOMENT (LEGACY) — Fallback when narrative engine has no active moment
// ══════════════════════════════════════════════════════════════════════════════

function LiveMomentBlock({ moment, phase }: { moment: CampaignMoment; phase: PhaseName }) {
  const phaseTone = PHASE_TONE[moment.phase];
  const isLive = moment.timing === 'current';

  const doneActions = moment.actions.filter(
    (a) => a.status === 'completed' || a.status === 'live'
  );
  const openActions = moment.actions.filter(
    (a) => a.status === 'missing' || a.status === 'late'
  );
  const recommendedActions = moment.actions.filter(
    (a) => a.status === 'recommended'
  );
  const plannedActions = moment.actions.filter(
    (a) => a.status === 'planned'
  );

  const rolloutPressure = generateRolloutPressure(moment, phase);

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 14,
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

      <h3 style={{
        fontSize: 'clamp(22px, 3vw, 36px)',
        fontWeight: 900, lineHeight: 0.95,
        letterSpacing: '-0.02em', margin: 0, color: INK,
      }}>
        {moment.momentName}
      </h3>

      {/* Thumbnail + actions grid (or single-column if no upload) */}
      <div style={{
        marginTop: 20,
        display: 'grid',
        gridTemplateColumns: moment.primaryUpload ? '2fr 1fr' : '1fr',
        gap: 8,
        alignItems: 'start',
      }}>
        {/* Primary thumbnail — only rendered when there IS an upload */}
        {moment.primaryUpload && (
          <a
            href={ytVideoUrl(moment.primaryUpload.id, moment.primaryUpload.durationSec)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              position: 'relative',
              borderRadius: 6, overflow: 'hidden',
              aspectRatio: '16/9',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <img
              src={ytThumb(moment.primaryUpload.id, 'maxresdefault')}
              alt="" loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0,
              padding: '40px 20px 14px',
              background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{
                  fontSize: 'clamp(20px, 2.5vw, 32px)',
                  fontWeight: 900, color: WHITE,
                  fontFamily: MONO, letterSpacing: '-0.02em',
                }}>
                  {fmtNum(moment.primaryUpload.viewCount)}
                </span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>views</span>
              </div>
            </div>
            {/* Collab badge overlay */}
            {moment.primaryUpload.isCollab && (
              <div style={{
                position: 'absolute', top: 10, left: 10,
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 4,
                background: 'rgba(99,102,241,0.9)',
                backdropFilter: 'blur(4px)',
              }}>
                <span style={{
                  fontSize: 9, fontWeight: 800, color: WHITE,
                  fontFamily: MONO, letterSpacing: '0.1em',
                }}>
                  COLLAB
                </span>
                {moment.primaryUpload.collabChannel && (
                  <span style={{
                    fontSize: 8, color: 'rgba(255,255,255,0.7)',
                    fontFamily: MONO,
                  }}>
                    via {moment.primaryUpload.collabChannel}
                  </span>
                )}
              </div>
            )}
          </a>
        )}

        {/* Action cards */}
        {(doneActions.length > 0 || openActions.length > 0 || plannedActions.length > 0) && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {doneActions.map((a, i) => {
              const inner = (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px',
                  background: '#F0FDF4',
                  borderRadius: 4,
                }}>
                  <span style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>✓</span>
                  <span style={{
                    fontSize: 12, color: INK, flex: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {cleanTitle(a.title)}
                  </span>
                  {a.matchedUpload && (
                    <span style={{ fontSize: 10, color: SMOKE, fontFamily: MONO }}>
                      {fmtNum(a.matchedUpload.viewCount)}
                    </span>
                  )}
                </div>
              );
              return a.matchedUpload ? (
                <a key={`d-${i}`} href={ytVideoUrl(a.matchedUpload.id, a.matchedUpload.durationSec)}
                  target="_blank" rel="noopener noreferrer"
                  style={{ textDecoration: 'none', color: 'inherit' }}>
                  {inner}
                </a>
              ) : <div key={`d-${i}`}>{inner}</div>;
            })}

            {openActions.map((a, i) => (
              <div key={`o-${i}`} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px',
                border: `1px dashed ${GHOST}`,
                borderRadius: 4,
              }}>
                <span style={{ fontSize: 11, color: '#D97706', fontWeight: 700 }}>○</span>
                <span style={{
                  fontSize: 12, color: SMOKE, flex: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {cleanTitle(a.title)}
                </span>
                <span style={{
                  fontSize: 8, fontWeight: 800, color: '#D97706',
                  fontFamily: MONO, letterSpacing: '0.08em',
                }}>
                  OPPORTUNITY
                </span>
              </div>
            ))}

            {recommendedActions.map((a, i) => (
              <div key={`r-${i}`} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px',
                background: '#F5F3FF',
                border: '1px solid #EDE9FE',
                borderRadius: 4,
              }}>
                <span style={{ fontSize: 11, color: '#7C3AED', fontWeight: 700 }}>◆</span>
                <span style={{
                  fontSize: 12, color: '#5B21B6', flex: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {cleanTitle(a.title)}
                </span>
                <span style={{
                  fontSize: 8, fontWeight: 800, color: '#7C3AED',
                  fontFamily: MONO, letterSpacing: '0.08em',
                }}>
                  STILL VALUABLE
                </span>
              </div>
            ))}

            {plannedActions.map((a, i) => (
              <div key={`p-${i}`} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px',
                background: BONE,
                borderRadius: 4,
              }}>
                <span style={{ fontSize: 11, color: GHOST, fontWeight: 700 }}>·</span>
                <span style={{
                  fontSize: 12, color: SMOKE, flex: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {cleanTitle(a.title)}
                </span>
                <span style={{
                  fontSize: 8, fontWeight: 700, color: GHOST,
                  fontFamily: MONO, letterSpacing: '0.08em',
                }}>
                  PLANNED
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rollout pressure — gentle format suggestion */}
      {rolloutPressure && (
        <p style={{
          fontSize: 13, color: SMOKE, fontWeight: 400,
          marginTop: 16, marginBottom: 0, lineHeight: 1.5,
          paddingLeft: 14, maxWidth: 520,
          borderLeft: `2px solid ${phaseTone.accent}`,
          fontStyle: 'italic',
        }}>
          {rolloutPressure}
        </p>
      )}

      {moment.extraUploads.length > 0 && (
        <div style={{
          marginTop: 12, display: 'flex', gap: 6,
          overflowX: 'auto', paddingBottom: 4,
        }}>
          {moment.extraUploads.map((u) => (
            <a
              key={u.id}
              href={ytVideoUrl(u.id, u.durationSec)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flexShrink: 0,
                width: u.durationSec <= 62 ? 56 : 96,
                aspectRatio: u.durationSec <= 62 ? '9/16' : '16/9',
                borderRadius: 3, overflow: 'hidden', position: 'relative',
                textDecoration: 'none', color: 'inherit',
              }}
            >
              <img
                src={ytThumb(u.id, 'mqdefault')}
                alt="" loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }}
              />
              {u.isCollab && (
                <div style={{
                  position: 'absolute', top: 3, left: 3,
                  fontSize: 6, fontWeight: 800, color: WHITE,
                  fontFamily: MONO, letterSpacing: '0.08em',
                  padding: '1px 4px', borderRadius: 2,
                  background: 'rgba(99,102,241,0.85)',
                }}>
                  COLLAB
                </div>
              )}
              <div style={{
                position: 'absolute', bottom: 3, left: 5,
                fontSize: 9, fontWeight: 700, color: WHITE,
                fontFamily: MONO,
                textShadow: '0 1px 2px rgba(0,0,0,0.8)',
              }}>
                {fmtNum(u.viewCount)}
              </div>
            </a>
          ))}
        </div>
      )}
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
      display: 'flex', gap: 2, borderRadius: 2, overflow: 'hidden',
    }}>
      {phases.map((p) => {
        const span = p.weekEnd - p.weekStart + 1;
        const pct = (span / totalWeeks) * 100;
        const isCurrent = currentPhase === p.name;
        const tone = PHASE_TONE[p.name];
        return (
          <div key={p.name} style={{
            flex: `0 0 ${pct}%`, padding: '5px 8px',
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
// TIMELINE DETAIL — Condensed, scannable
// ══════════════════════════════════════════════════════════════════════════════

function TimelineDetail({ plan, matchResult, currentPhase, releaseClusters, releaseMoments }: {
  plan: GeneratedPlan;
  matchResult?: MatchResult;
  currentPhase: PhaseName | null;
  releaseClusters: ReleaseCluster[];
  releaseMoments: ReleaseMoment[];
}) {
  const weeks = matchResult?.weeks ?? plan.weeks;
  const phases = plan.phases.map((p) => ({
    ...p,
    weeks: weeks.filter((w) => w.weekNum >= p.weekStart && w.weekNum <= p.weekEnd),
  }));

  // Build lookup sets for de-duplication
  const anchorIds = new Set(releaseClusters.map(c => c.anchor.id));
  const supportUploadIds = new Set<string>();
  for (const c of releaseClusters) {
    for (const s of c.support) supportUploadIds.add(s.id);
  }
  const clusterUploadIds = new Set<string>();
  anchorIds.forEach(id => clusterUploadIds.add(id));
  supportUploadIds.forEach(id => clusterUploadIds.add(id));

  // Check if the entire timeline is empty
  const hasAnyContent = phases.some(p => {
    const pw = p.weeks.filter((w) => w.actions.length > 0 || w.momentName);
    const pm = releaseMoments.filter(m => m.phase === p.name);
    return pw.length > 0 || pm.length > 0;
  });

  if (!hasAnyContent) {
    return (
      <div style={{
        padding: '24px',
        background: WHITE,
        border: `1px solid ${BONE}`,
        borderRadius: 6,
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: GHOST, fontFamily: MONO,
          marginBottom: 8,
        }}>
          Timeline
        </div>
        <div style={{ fontSize: 13, color: SMOKE, lineHeight: 1.5 }}>
          No release moments detected yet. Once uploads land on the channel, the rollout map will populate automatically.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {phases.map((phase) => {
        const isCurrent = currentPhase === phase.name;
        const tone = PHASE_TONE[phase.name];
        const phaseWeeks = phase.weeks.filter((w) => w.actions.length > 0 || w.momentName);

        // Release moments that belong to this phase
        const phaseMoments = releaseMoments.filter(m => m.phase === phase.name);

        if (phaseWeeks.length === 0 && phaseMoments.length === 0) return null;

        return (
          <div key={phase.name}>
            {/* Phase header */}
            <div style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
              textTransform: 'uppercase', marginBottom: 10,
              color: isCurrent ? tone.accent : GHOST,
              display: 'flex', alignItems: 'center', gap: 8,
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
                  fontSize: 7, fontWeight: 800, background: tone.accent,
                  color: WHITE, padding: '1px 6px', borderRadius: 2,
                }}>
                  NOW
                </span>
              )}
              {phaseMoments.length > 0 && (
                <span style={{
                  fontSize: 8, fontWeight: 600, color: SMOKE,
                  textTransform: 'none', letterSpacing: '0.04em',
                }}>
                  {phaseMoments.length} release {phaseMoments.length === 1 ? 'moment' : 'moments'}
                </span>
              )}
            </div>

            {/* ── Release Moments — primary content blocks ── */}
            {phaseMoments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: phaseWeeks.length > 0 ? 10 : 0 }}>
                {phaseMoments.map((moment) => (
                  <ReleaseMomentBlock
                    key={moment.id}
                    moment={moment}
                    phaseAccent={tone.accent}
                  />
                ))}
              </div>
            )}

            {/* ── Non-release weeks — secondary timeline ── */}
            {phaseWeeks.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <GroupedWeekRows
                  weeks={phaseWeeks}
                  matchResult={matchResult}
                  clusterUploadIds={clusterUploadIds}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RELEASE MOMENT BLOCK — Self-contained release narrative unit
// ══════════════════════════════════════════════════════════════════════════════

function ReleaseMomentBlock({ moment, phaseAccent }: {
  moment: ReleaseMoment;
  phaseAccent: string;
}) {
  const { cluster, momentLabel, supportCount, totalEcosystemViews } = moment;
  const { anchor, coverageLabel, insights, supportLinks: links, supportByCategory: byCategory } = cluster;
  const [expanded, setExpanded] = useState(true);

  const tone =
    coverageLabel === 'Strong'     ? { bg: '#F0FDF4', border: '#BBF7D0', color: '#059669', label: 'Strong rollout' } :
    coverageLabel === 'Moderate'   ? { bg: '#FFFBEB', border: '#FDE68A', color: '#92400E', label: 'Expandable rollout' } :
    coverageLabel === 'Expandable' ? { bg: '#F5F3FF', border: '#E9D5FF', color: '#7C3AED', label: 'Long-tail opportunity' } :
                                     { bg: '#F8FAFC', border: '#E2E8F0', color: '#64748B', label: 'Could extend further' };

  const longformLinks = links.filter(l => l.upload.durationSec > 62);
  const shortsLinks = links.filter(l => l.upload.durationSec <= 62);
  const narrative = insights.slice(0, 2).join(' ');

  const topShorts = [...shortsLinks].sort((a, b) => b.upload.viewCount - a.upload.viewCount).slice(0, 3);
  const totalShortsViews = shortsLinks.reduce((s, l) => s + l.upload.viewCount, 0);

  const CATEGORY_ORDER: SupportCategory[] = [
    'BTS', 'Release Momentum', 'World Building', 'Rollout Diary',
    'Personality', 'Collaborator Bridge', 'Follow-through', 'Community Layer',
  ];
  const longformCategories = CATEGORY_ORDER.filter(cat => {
    const catLinks = byCategory[cat];
    return catLinks && catLinks.some(l => l.upload.durationSec > 62);
  });

  return (
    <div style={{
      background: WHITE,
      border: `1px solid ${BONE}`,
      borderLeft: `3px solid ${phaseAccent}`,
      borderRadius: 6,
      overflow: 'hidden',
    }}>
      {/* ── Moment header — clickable to expand/collapse ── */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '10px 14px',
          background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <a
          href={ytVideoUrl(anchor.id, anchor.durationSec)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ flexShrink: 0 }}
        >
          <img
            src={ytThumb(anchor.id, 'mqdefault')}
            alt="" loading="lazy"
            style={{
              width: 88, height: 50, objectFit: 'cover',
              borderRadius: 3, display: 'block',
            }}
          />
        </a>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{
              fontSize: 7, fontWeight: 800, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: WHITE,
              padding: '1px 6px', borderRadius: 2,
              background: phaseAccent, fontFamily: MONO,
            }}>
              Release Moment
            </span>
            <span style={{
              fontSize: 7, fontWeight: 800, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: tone.color,
              padding: '1px 6px', borderRadius: 2,
              background: tone.bg, fontFamily: MONO,
            }}>
              {tone.label}
            </span>
          </div>
          <div style={{
            fontSize: 13, fontWeight: 700, color: INK, lineHeight: 1.3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {momentLabel}
          </div>
          <div style={{
            display: 'flex', gap: 10, marginTop: 3,
            fontSize: 9, color: SMOKE, fontFamily: MONO,
          }}>
            <span style={{ fontWeight: 700 }}>{fmtNum(anchor.viewCount)} views</span>
            <span>{timeAgo(anchor.publishedAt)}</span>
            {supportCount > 0 && (
              <span>{supportCount} support {supportCount === 1 ? 'upload' : 'uploads'}</span>
            )}
            {supportCount > 0 && (
              <span style={{ color: '#059669' }}>{fmtNum(totalEcosystemViews)} ecosystem views</span>
            )}
          </div>
        </div>
        <span style={{
          fontSize: 9, color: GHOST, fontFamily: MONO,
          transform: expanded ? 'rotate(90deg)' : 'none',
          transition: 'transform 0.15s',
          flexShrink: 0,
        }}>▶</span>
      </button>

      {/* ── Expanded support ecosystem ── */}
      {expanded && (
        <div style={{
          padding: '0 14px 12px',
          borderTop: `1px solid ${BONE}`,
        }}>
          {/* ── Longform support grouped by strategic category ── */}
          {longformCategories.length > 0 && (
            <div style={{ paddingTop: 8 }}>
              {longformCategories.map((cat) => {
                const catLinks = (byCategory[cat] ?? []).filter(l => l.upload.durationSec > 62);
                if (catLinks.length === 0) return null;
                return (
                  <div key={cat} style={{ marginBottom: 6 }}>
                    <div style={{
                      fontSize: 8, fontWeight: 700, letterSpacing: '0.08em',
                      textTransform: 'uppercase', color: GHOST,
                      fontFamily: MONO, marginBottom: 3,
                    }}>
                      {cat}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {catLinks.map((link) => {
                        const strengthColor = link.strength === 'strong' ? '#059669'
                          : link.strength === 'moderate' ? '#D97706' : GHOST;
                        return (
                          <a
                            key={`sl-${link.upload.id}`}
                            href={ytVideoUrl(link.upload.id, link.upload.durationSec)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '3px 6px',
                              background: 'rgba(245,242,237,0.5)',
                              borderRadius: 3,
                              textDecoration: 'none', color: 'inherit',
                            }}
                          >
                            <img
                              src={ytThumb(link.upload.id, 'mqdefault')}
                              alt="" loading="lazy"
                              style={{
                                width: 40, height: 22,
                                objectFit: 'cover', borderRadius: 2,
                              }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontSize: 10, color: INK,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {link.upload.title}
                              </div>
                            </div>
                            <span style={{
                              width: 4, height: 4, borderRadius: '50%',
                              background: strengthColor, display: 'inline-block',
                              flexShrink: 0,
                            }} />
                            <span style={{
                              fontSize: 8, color: SMOKE, fontFamily: MONO,
                              flexShrink: 0,
                            }}>
                              {fmtNum(link.upload.viewCount)}
                            </span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Shorts cluster — collapsed summary with top performers ── */}
          {shortsLinks.length > 0 && (
            <div style={{
              marginTop: longformCategories.length > 0 ? 4 : 8,
              paddingTop: longformCategories.length === 0 ? 8 : 0,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 9, color: SMOKE, fontFamily: MONO,
              }}>
                <span style={{ fontWeight: 700, color: INK }}>
                  ⚡ {shortsLinks.length} Shorts
                </span>
                <span>{fmtNum(totalShortsViews)} combined views</span>
                {shortsLinks.length > 3 && (
                  <span style={{ color: GHOST }}>Top {topShorts.length}:</span>
                )}
              </div>
              {topShorts.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                  {topShorts.map((link) => (
                    <a
                      key={`sh-${link.upload.id}`}
                      href={ytVideoUrl(link.upload.id, link.upload.durationSec)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '2px 6px',
                        background: 'rgba(245,242,237,0.5)',
                        borderRadius: 2,
                        textDecoration: 'none', color: 'inherit',
                        fontSize: 8,
                      }}
                    >
                      <span style={{
                        color: SMOKE, maxWidth: 100,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {link.upload.title}
                      </span>
                      <span style={{ color: GHOST, fontFamily: MONO }}>
                        {fmtNum(link.upload.viewCount)}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Release Support Checklist ── */}
          <ReleaseChecklist cluster={cluster} />

          {/* Narrative insight */}
          {narrative && (
            <div style={{
              fontSize: 10, color: SMOKE, lineHeight: 1.4,
              fontStyle: 'italic', marginTop: 6,
            }}>
              {narrative}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// RELEASE SUPPORT CHECKLIST — Timing guidance + premiere status
// ══════════════════════════════════════════════════════════════════════════════

function PremiereStatusBadge({ status }: { status: PremiereStatus }) {
  if (status === 'confirmed') {
    return (
      <span style={{
        fontSize: 8, fontWeight: 700, color: '#065F46',
        padding: '1px 6px', borderRadius: 2,
        background: '#F0FDF4', fontFamily: MONO,
        letterSpacing: '0.04em',
      }}>
        ✓ Premiere used
      </span>
    );
  }
  if (status === 'likely') {
    return (
      <span style={{
        fontSize: 8, fontWeight: 700, color: '#92400E',
        padding: '1px 6px', borderRadius: 2,
        background: '#FFFBEB', fontFamily: MONO,
        letterSpacing: '0.04em',
      }}>
        Premiere likely — scheduled start detected
      </span>
    );
  }
  // 'unknown' — can't confirm from API
  return (
    <span style={{
      fontSize: 8, fontWeight: 600, color: SMOKE,
      padding: '1px 6px', borderRadius: 2,
      background: BONE, fontFamily: MONO,
      letterSpacing: '0.04em',
    }}>
      Premiere: manual confirmation needed
    </span>
  );
}

function CollabToolBadge() {
  return (
    <span style={{
      fontSize: 8, fontWeight: 700, color: '#3730A3',
      padding: '1px 6px', borderRadius: 2,
      background: '#EEF2FF', fontFamily: MONO,
      letterSpacing: '0.04em',
      border: '1px solid #C7D2FE',
    }}>
      ✓ Collab tool used
    </span>
  );
}

function ReleaseChecklist({ cluster }: { cluster: ReleaseCluster }) {
  const { checklist, premiereStatus } = cluster;
  const presentItems = checklist.filter(i => i.status === 'present');
  const missingItems = checklist.filter(i => i.status === 'missing');

  // Don't show premiere in checklist items (handled by badge)
  const corePresent = presentItems.filter(i => i.key !== 'premiere');
  const coreMissing = missingItems.filter(i => i.key !== 'premiere' && i.key !== 'community');
  const communityItem = checklist.find(i => i.key === 'community');

  // Check if any uploads in this cluster are collabs
  const hasCollab = cluster.anchor.isCollab || cluster.support.some(u => u.isCollab);

  return (
    <div style={{ marginTop: 8 }}>
      {/* Premiere status badge + Collab badge */}
      <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <PremiereStatusBadge status={premiereStatus} />
        {hasCollab && <CollabToolBadge />}
      </div>

      {/* Core support — what's present */}
      {corePresent.length > 0 && (
        <div style={{
          display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4,
        }}>
          {corePresent.map((item) => (
            <span key={item.key} style={{
              fontSize: 8, fontWeight: 600, color: '#065F46',
              padding: '1px 6px', borderRadius: 2,
              background: '#F0FDF4', fontFamily: MONO,
            }}>
              ✓ {item.label}{item.count > 1 ? ` ×${item.count}` : ''}
              {item.timingOptimal === true && ' · on time'}
              {item.timingOptimal === false && item.actualDaysOffset != null && (
                ` · dropped ${item.actualDaysOffset > 0 ? '+' : ''}${item.actualDaysOffset}d`
              )}
            </span>
          ))}
        </div>
      )}

      {/* Missing support — opportunities with timing guidance */}
      {coreMissing.length > 0 && (
        <div style={{
          background: '#FAFAF8',
          border: `1px solid ${BONE}`,
          borderRadius: 4,
          padding: '6px 8px',
        }}>
          <div style={{
            fontSize: 8, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: '#7C3AED',
            fontFamily: MONO, marginBottom: 4,
          }}>
            Could extend
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {coreMissing.map((item) => (
              <div key={item.key} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 9, color: INK,
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  border: `1.5px solid ${GHOST}`,
                  display: 'inline-block', flexShrink: 0,
                }} />
                <span style={{ fontWeight: 600 }}>{item.label}</span>
                <span style={{
                  fontSize: 8, color: SMOKE, fontFamily: MONO,
                }}>
                  — {item.timing.label}
                </span>
                {item.timing.priority === 'core' && (
                  <span style={{
                    fontSize: 7, fontWeight: 700, color: '#DC2626',
                    padding: '0px 4px', borderRadius: 2,
                    background: '#FEF2F2', fontFamily: MONO,
                    letterSpacing: '0.05em',
                  }}>
                    CORE
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Community post — always unknown (can't detect via uploads API) */}
      {communityItem && communityItem.status === 'missing' && coreMissing.length > 0 && (
        <div style={{
          fontSize: 8, color: GHOST, fontFamily: MONO,
          marginTop: 3, fontStyle: 'italic',
        }}>
          Community Post — {communityItem.timing.label} (cannot detect automatically)
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// GROUPED WEEK ROWS — Collapse consecutive planned-only weeks
// ══════════════════════════════════════════════════════════════════════════════

function GroupedWeekRows({ weeks, matchResult, clusterUploadIds }: {
  weeks: (PlanWeek | MatchedWeek)[];
  matchResult?: MatchResult;
  clusterUploadIds: Set<string>;
}) {
  // Classify weeks: "active" = has evidence (completed/live/late actions, extra uploads, is current)
  // "planned" = only planned/missing actions with no evidence
  const classified = weeks.map(week => {
    const matchedWeek = matchResult ? (week as MatchedWeek) : null;
    const actions = matchedWeek?.actions ?? week.actions;
    const extraUploads = matchedWeek?.extraUploads ?? [];
    const isCurrent = isCurrentWeek(week);
    const isMoment = !!week.momentName;

    const hasEvidence = actions.some(a =>
      'status' in a && ((a as MatchedAction).status === 'completed' || (a as MatchedAction).status === 'live')
    );
    const hasOpenWindows = actions.some(a =>
      'status' in a && ((a as MatchedAction).status === 'late' || (a as MatchedAction).status === 'recommended')
    );
    const hasExtras = extraUploads.filter(u => !clusterUploadIds.has(u.id)).length > 0;

    const isActive = isCurrent || isMoment || hasEvidence || hasOpenWindows || hasExtras;
    return { week, isActive };
  });

  // Group consecutive planned-only weeks together
  const groups: { type: 'active'; week: PlanWeek | MatchedWeek }[] | { type: 'collapsed'; weeks: (PlanWeek | MatchedWeek)[] }[] = [];
  type GroupItem = { type: 'active'; week: PlanWeek | MatchedWeek } | { type: 'collapsed'; weeks: (PlanWeek | MatchedWeek)[] };
  const result: GroupItem[] = [];

  let pendingCollapsed: (PlanWeek | MatchedWeek)[] = [];

  for (const { week, isActive } of classified) {
    if (isActive) {
      // Flush any pending collapsed weeks
      if (pendingCollapsed.length > 0) {
        result.push({ type: 'collapsed', weeks: [...pendingCollapsed] });
        pendingCollapsed = [];
      }
      result.push({ type: 'active', week });
    } else {
      pendingCollapsed.push(week);
    }
  }
  // Flush remaining
  if (pendingCollapsed.length > 0) {
    result.push({ type: 'collapsed', weeks: pendingCollapsed });
  }

  return (
    <>
      {result.map((group, gi) => {
        if (group.type === 'active') {
          return (
            <TimelineWeekRow
              key={group.week.weekNum}
              week={group.week}
              matchResult={matchResult}
              clusterUploadIds={clusterUploadIds}
            />
          );
        }
        // Collapsed group — show as single summary row
        return (
          <CollapsedWeekGroup
            key={`cg-${gi}`}
            weeks={group.weeks}
          />
        );
      })}
    </>
  );
}

function CollapsedWeekGroup({ weeks }: { weeks: (PlanWeek | MatchedWeek)[] }) {
  const [expanded, setExpanded] = useState(false);

  const totalActions = weeks.reduce((s, w) => s + w.actions.length, 0);
  const firstWeek = weeks[0];
  const lastWeek = weeks[weeks.length - 1];
  const weekRange = weeks.length === 1
    ? `W${firstWeek.weekNum}`
    : `W${firstWeek.weekNum}–${lastWeek.weekNum}`;

  // Summarize action types
  const formatCounts: Record<string, number> = {};
  for (const w of weeks) {
    for (const a of w.actions) {
      const key = a.format === 'short' ? 'Shorts' : a.format === 'video' || a.format === 'premiere' ? 'Videos' : a.format === 'post' ? 'Posts' : 'Other';
      formatCounts[key] = (formatCounts[key] ?? 0) + 1;
    }
  }
  const summary = Object.entries(formatCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${v} ${k}`)
    .join(', ');

  return (
    <div style={{
      borderLeft: `2px solid ${BONE}`,
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '4px 10px',
          background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{
          fontSize: 9, fontWeight: 700, color: GHOST, minWidth: 50, fontFamily: MONO,
        }}>
          {weekRange}
        </span>
        <span style={{
          fontSize: 10, color: GHOST, minWidth: 72, fontFamily: MONO,
        }}>
          {firstWeek.dateRange.split('–')[0].trim()} – {lastWeek.dateRange.split('–').pop()?.trim() ?? ''}
        </span>
        <span style={{
          fontSize: 11, color: SMOKE, flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {totalActions} planned · {summary}
        </span>
        <span style={{
          fontSize: 7, color: GHOST, fontFamily: MONO,
          transform: expanded ? 'rotate(90deg)' : 'none',
          transition: 'transform 0.15s',
        }}>▶</span>
      </button>

      {expanded && (
        <div style={{ padding: '0 10px 6px 60px' }}>
          {weeks.map(w => (
            <div key={w.weekNum} style={{ marginBottom: 4 }}>
              <div style={{
                fontSize: 9, fontWeight: 700, color: GHOST, fontFamily: MONO,
                marginBottom: 2,
              }}>
                W{w.weekNum} · {w.dateRange}
                {w.momentName && <span style={{ color: INK, fontWeight: 700, marginLeft: 6 }}>{w.momentName}</span>}
              </div>
              {w.actions.map((a, i) => (
                <div key={i} style={{
                  fontSize: 10, color: SMOKE, padding: '1px 0',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <span style={{ fontSize: 8, opacity: 0.5, fontFamily: MONO }}>
                    {a.format === 'short' ? '⚡' : a.format === 'video' || a.format === 'premiere' ? '▶' : '·'}
                  </span>
                  {a.title}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// TIMELINE WEEK ROW — Secondary week actions (non-release content)
// ══════════════════════════════════════════════════════════════════════════════

function TimelineWeekRow({ week, matchResult, clusterUploadIds }: {
  week: PlanWeek | MatchedWeek;
  matchResult?: MatchResult;
  /** Set of all upload IDs already rendered in release moment blocks */
  clusterUploadIds: Set<string>;
}) {
  const isMoment = !!week.momentName;
  const isCurrent = isCurrentWeek(week);
  const isPast = isWeekPast(week);
  const matchedWeek = matchResult ? (week as MatchedWeek) : null;
  const actions = matchedWeek?.actions ?? week.actions;

  // Extra uploads for this week (unmatched uploads that landed here)
  const extraUploads = matchedWeek?.extraUploads ?? [];

  const [expanded, setExpanded] = useState(isCurrent || (isPast && isMoment));

  const done = actions.filter((a) =>
    'status' in a ? ((a as MatchedAction).status === 'completed' || (a as MatchedAction).status === 'live') : a.completed
  ).length;
  const recommended = actions.filter((a) =>
    'status' in a && (a as MatchedAction).status === 'recommended'
  ).length;
  const openWindows = actions.filter((a) =>
    'status' in a && ((a as MatchedAction).status === 'late' || (a as MatchedAction).status === 'missing')
  ).length;

  return (
    <div style={{
      background: isCurrent ? WHITE : isPast ? 'rgba(245,242,237,0.5)' : 'transparent',
      border: isCurrent ? `1px solid ${BONE}` : 'none',
      borderRadius: isCurrent ? 4 : 0,
      borderLeft: isPast && done > 0 ? '2px solid #059669'
        : isPast ? `2px solid ${BONE}` : 'none',
    }}>
      <button
        onClick={() => actions.length > 0 && setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: isCurrent ? '5px 10px' : '4px 10px',
          background: 'none', border: 'none',
          cursor: actions.length > 0 ? 'pointer' : 'default', textAlign: 'left',
        }}
      >
        <span style={{
          fontSize: 9, fontWeight: 700, color: GHOST, minWidth: 24, fontFamily: MONO,
        }}>
          W{week.weekNum}
        </span>
        <span style={{
          fontSize: 10, color: GHOST, minWidth: 72, fontFamily: MONO,
        }}>
          {week.dateRange}
        </span>
        <span style={{
          fontSize: 12, fontWeight: isMoment ? 700 : 400,
          color: isMoment ? INK : SMOKE, flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {week.momentName ?? (actions.length > 0 ? `${actions.length} actions` : '')}
        </span>
        {actions.length > 0 && (
          <span style={{
            fontSize: 9, color: GHOST, display: 'flex', gap: 4, alignItems: 'center',
            fontFamily: MONO,
          }}>
            {done > 0 && <span style={{ color: '#059669', fontWeight: 700 }}>{done}✓</span>}
            {recommended > 0 && <span style={{ color: '#7C3AED', fontWeight: 700 }}>{recommended} rec</span>}
            {openWindows > 0 && <span style={{ color: '#D97706', fontWeight: 700 }}>{openWindows} open</span>}
            <span style={{
              fontSize: 7,
              transform: expanded ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.15s',
            }}>▶</span>
          </span>
        )}
      </button>

      {expanded && (() => {
        // Get uploads that are NOT part of any release moment cluster
        const matchedUploads = actions
          .filter((a) => 'status' in a && (a as MatchedAction).matchedUpload &&
            ((a as MatchedAction).status === 'completed' || (a as MatchedAction).status === 'live'))
          .map((a) => (a as MatchedAction).matchedUpload!);

        const regularMatched = matchedUploads.filter(u => !clusterUploadIds.has(u.id));
        const regularExtra = extraUploads.filter(u => !clusterUploadIds.has(u.id));

        return (
        <div style={{ padding: '0 10px 6px 44px' }}>

          {/* ── Regular matched uploads (non-cluster evidence) ── */}
          {isPast && regularMatched.length > 0 && (
            <div style={{
              display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4,
            }}>
              {regularMatched.map((upload, i) => {
                const formatLabel = classifyUploadFormat(upload);
                const isCollabVideo = upload.isCollab;
                return (
                  <a
                    key={`ev-${i}`}
                    href={ytVideoUrl(upload.id, upload.durationSec)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '4px 8px 4px 4px',
                      background: isCollabVideo ? '#EEF2FF' : '#F0FDF4',
                      borderRadius: 4,
                      textDecoration: 'none', color: 'inherit',
                      border: isCollabVideo ? '1px solid #C7D2FE' : '1px solid #D1FAE5',
                    }}
                  >
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <img
                        src={ytThumb(upload.id, 'mqdefault')}
                        alt="" loading="lazy"
                        style={{
                          width: upload.durationSec <= 62 ? 24 : 48,
                          height: upload.durationSec <= 62 ? 32 : 27,
                          objectFit: 'cover', borderRadius: 2,
                        }}
                      />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: 10, color: INK, fontWeight: 500,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: 200,
                      }}>
                        {upload.title}
                      </div>
                      <div style={{
                        display: 'flex', gap: 6, alignItems: 'center',
                        fontSize: 8, color: SMOKE, fontFamily: MONO,
                        letterSpacing: '0.04em', marginTop: 1,
                      }}>
                        <span style={{
                          color: isCollabVideo ? '#4F46E5' : '#059669', fontWeight: 700,
                          textTransform: 'uppercase',
                        }}>
                          {formatLabel}
                        </span>
                        {isCollabVideo && upload.collabChannel && (
                          <span style={{ color: '#6366F1', fontWeight: 600 }}>
                            via {upload.collabChannel}
                          </span>
                        )}
                        <span>{fmtNum(upload.viewCount)} views</span>
                        <span>{timeAgo(upload.publishedAt)}</span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}

          {/* Extra uploads not in plan (excluding cluster content) */}
          {isPast && regularExtra.length > 0 && (
            <div style={{
              display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4,
            }}>
              {regularExtra.map((upload, i) => {
                const formatLabel = classifyUploadFormat(upload);
                const isCollabVideo = upload.isCollab;
                return (
                  <a
                    key={`ex-${i}`}
                    href={ytVideoUrl(upload.id, upload.durationSec)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '3px 8px 3px 3px',
                      background: isCollabVideo ? '#EEF2FF' : '#F5F3FF',
                      borderRadius: 3,
                      textDecoration: 'none', color: 'inherit',
                      border: isCollabVideo ? '1px solid #C7D2FE' : '1px solid #EDE9FE',
                    }}
                  >
                    <img
                      src={ytThumb(upload.id, 'mqdefault')}
                      alt="" loading="lazy"
                      style={{
                        width: upload.durationSec <= 62 ? 20 : 40,
                        height: upload.durationSec <= 62 ? 28 : 22,
                        objectFit: 'cover', borderRadius: 2,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: 9, color: SMOKE, fontWeight: 500,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: 160,
                      }}>
                        {upload.title}
                      </div>
                      <div style={{
                        fontSize: 7, color: GHOST, fontFamily: MONO,
                        letterSpacing: '0.04em',
                      }}>
                        <span style={{ color: isCollabVideo ? '#4F46E5' : '#7C3AED', fontWeight: 700, textTransform: 'uppercase' }}>
                          {formatLabel}
                        </span>
                        {isCollabVideo && upload.collabChannel && (
                          <>{' · '}<span style={{ color: '#6366F1' }}>via {upload.collabChannel}</span></>
                        )}
                        {' · '}{fmtNum(upload.viewCount)}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}

          {/* Action list — past weeks show as evidence, future as plan */}
          {actions.map((a, i) => {
            const matched = 'status' in a ? (a as MatchedAction) : null;
            const status: ExecutionStatus = matched?.status ?? (a.completed ? 'completed' : 'planned');
            const isDone = status === 'completed' || status === 'live';
            const isRecommended = status === 'recommended';
            const isOpen = status === 'late';
            const isUpcoming = status === 'missing';

            // In past evidence mode, completed items with thumbnails are already shown above
            if (isPast && isDone && matched?.matchedUpload) return null;

            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 11, padding: '2px 0',
                color: isDone ? GHOST
                  : isRecommended ? '#5B21B6'
                  : isOpen ? '#92400E'
                  : isUpcoming ? '#78350F'
                  : INK,
                textDecoration: isDone ? 'line-through' : 'none',
                opacity: isDone ? 0.5 : isRecommended ? 0.85 : 1,
              }}>
                <span style={{ fontSize: 9, opacity: 0.6, fontFamily: MONO }}>
                  {a.format === 'short' ? '⚡' : a.format === 'video' || a.format === 'premiere' ? '▶' : a.format === 'live' ? '◉' : '·'}
                </span>
                <span style={{ flex: 1 }}>{a.title}</span>
                {matched?.matchedUpload && (
                  <span style={{ fontSize: 9, color: '#059669', fontFamily: MONO }}>
                    {fmtNum(matched.matchedUpload.viewCount)}
                  </span>
                )}
                {isRecommended && (
                  <span style={{
                    fontSize: 7, fontWeight: 800, padding: '1px 5px', borderRadius: 2,
                    background: '#F5F3FF',
                    color: '#7C3AED',
                    textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: MONO,
                  }}>
                    Still valuable
                  </span>
                )}
                {isOpen && (
                  <span style={{
                    fontSize: 7, fontWeight: 800, padding: '1px 5px', borderRadius: 2,
                    background: '#FFFBEB',
                    color: '#D97706',
                    textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: MONO,
                  }}>
                    Ready
                  </span>
                )}
                {isUpcoming && !isPast && (
                  <span style={{
                    fontSize: 7, fontWeight: 800, padding: '1px 5px', borderRadius: 2,
                    background: '#FFF7ED',
                    color: '#92400E',
                    textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: MONO,
                  }}>
                    Opportunity
                  </span>
                )}
                {isUpcoming && isPast && !isRecommended && (
                  <span style={{
                    fontSize: 7, fontWeight: 700, padding: '1px 5px', borderRadius: 2,
                    background: BONE,
                    color: GHOST,
                    textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: MONO,
                  }}>
                    Skipped
                  </span>
                )}
              </div>
            );
          })}
        </div>
        );
      })()}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// ERA SIGNAL
// ══════════════════════════════════════════════════════════════════════════════

function generateEraSignal(
  uploads30d: RecentUpload[],
  shorts30d: RecentUpload[],
  long30d: RecentUpload[],
  liveChannel?: CampaignDestinationProps['liveChannel'],
): string | null {
  if (uploads30d.length === 0 && !liveChannel) return null;

  const parts: string[] = [];

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
// ROLLOUT PRESSURE — Gentle format suggestions per moment + phase
// ══════════════════════════════════════════════════════════════════════════════

function generateRolloutPressure(
  moment: CampaignMoment,
  phase: PhaseName,
): string | null {
  const open = moment.supportMissing;

  // If everything is delivered, no pressure needed
  if (open.length === 0 && moment.actions.every((a) => a.status === 'completed' || a.status === 'live')) {
    return null;
  }

  // Specific open formats
  if (open.length === 1) {
    return `A ${open[0]} would keep this moment visible in the feed longer.`;
  }
  if (open.length > 1) {
    return `${open.length} uploads still open — more content keeps the algorithm serving this moment.`;
  }

  // Phase-aware suggestions in YouTube language
  if (phase === 'BUILD') {
    return 'Shorts and early uploads get the channel active before the main drop.';
  }
  if (phase === 'RELEASE') {
    return 'Lyric videos, visualizers, and BTS extend how long the release stays in feeds.';
  }
  if (phase === 'SCALE') {
    return 'More uploads keep the algorithm recommending the catalogue while momentum is hot.';
  }
  if (phase === 'EXTEND') {
    return 'Acoustic versions, live sessions, or documentary content give fans a reason to come back.';
  }
  return null;
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
        text: `${cleanTitle(top.title)} is live${daysSince <= 1 ? ' — picking up views' : ` — ${fmtNum(upload.viewCount)} views in ${daysSince}d`}`,
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
        text: `"${top.title}" picking up — ${fmtNum(top.viewCount)} views`,
        urgency: 'positive',
      });
    }
  }

  if (liveChannel?.views7Delta != null) {
    if (liveChannel.views7Delta > 10000) {
      signals.push({
        text: `+${fmtNum(liveChannel.views7Delta)} views this week — the channel is running`,
        urgency: 'positive',
      });
    } else if (liveChannel.views7Delta > 0) {
      signals.push({
        text: `+${fmtNum(liveChannel.views7Delta)} views this week`,
        urgency: 'neutral',
      });
    } else if (liveChannel.views7Delta < 0) {
      signals.push({
        text: 'Views slowing — a new upload would get things moving again',
        urgency: 'warning',
      });
    }
  }

  if (liveChannel) {
    const u30 = liveChannel.uploads30d ?? 0;
    const s30 = liveChannel.shorts30d ?? 0;
    if (u30 >= 8) {
      signals.push({ text: `${u30} uploads this month — the feed is active`, urgency: 'positive' });
    } else if (s30 >= 3 && u30 >= 3) {
      signals.push({ text: `${s30} Shorts this month keeping the channel in feeds`, urgency: 'positive' });
    } else if (u30 === 0) {
      signals.push({ text: 'No uploads this month — next one restarts the algorithm', urgency: 'warning' });
    }
  }

  const lastUpload = liveChannel?.lastUploadDaysAgo;
  if (lastUpload != null && lastUpload > 10) {
    signals.push({
      text: `${lastUpload}d since last upload${currentPhase === 'RELEASE' ? ' — the release window is still open' : ''}`,
      urgency: lastUpload > 21 ? 'critical' : 'warning',
    });
  }

  if (matchResult) {
    const { stats } = matchResult;
    const pastDue = stats.completed + stats.live + stats.missing + stats.late;
    if (stats.late > 0) {
      signals.push({
        text: `${stats.late} planned upload${stats.late > 1 ? 's' : ''} still open — ready to go`,
        urgency: 'warning',
      });
    } else if (pastDue >= 3 && stats.completionRate < 40) {
      signals.push({
        text: `${Math.round(stats.completionRate)}% of planned content is live — room to push more`,
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

// ── extractMoments, parseWeekDate, isCurrentWeek, isWeekPast,
//    resolveWeekDate, detectCurrentPhase — all moved to campaignPipeline.ts ──
// CampaignDestination is now a pure renderer that consumes pipeline output.

/** Simple title cleanup — strips action verbs and trailing format words */
function cleanTitle(title: string): string {
  return title
    .replace(/^(Upload|Post|Create|Film|Record|Publish|Release)\s+/i, '')
    .replace(/\s*(short|video|post|clip)$/i, '')
    .trim() || title;
}
