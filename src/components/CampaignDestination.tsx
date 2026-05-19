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
import { classifyUploadFormat } from '@/lib/coach/matchEngine';
import type { Nudge, NudgeUrgency } from '@/lib/coach/nudgeEngine';
import type { RecentUpload } from '@/lib/artists';
import { fmtNum } from '@/lib/artists';
import type { CampaignDataCoverage } from '@/lib/planStore';
import { buildReleaseClusters, type ReleaseCluster } from '@/lib/coach/releaseClusters';

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
  dataCoverage,
  campaignStartDate,
}: CampaignDestinationProps) {
  const currentPhase = detectCurrentPhase(plan);
  const pulseSignals = generatePulseSignals(matchResult, liveChannel, recentUploads ?? [], currentPhase, plan);
  const moments = extractMoments(plan, matchResult);
  const activeMoment = moments.find((m) => m.timing === 'current') ?? moments.find((m) => m.timing === 'past');
  const phaseTone = currentPhase ? PHASE_TONE[currentPhase] : null;
  const campaignTitle = plan.campaignName.replace(/ Campaign$/i, '');

  // ── Release clusters — campaign pillars ──
  const uploads = recentUploads ?? [];
  const releaseClusters = buildReleaseClusters(uploads, {
    treatLongformAsAnchor: true,
    minAnchorViews: 500,
  });

  // ── Rollout identity stats ──
  const totalPlanned = plan.events.length;
  const landed = matchResult
    ? matchResult.weeks.flatMap((w) => w.actions).filter((a) => a.status === 'completed' || a.status === 'live').length
    : 0;
  const openOpportunities = matchResult
    ? matchResult.weeks.flatMap((w) => w.actions).filter((a) => a.status === 'missing' || a.status === 'late' || a.status === 'recommended').length
    : 0;

  // ── Classify uploads ──
  const allByRecency = (recentUploads ?? []).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  const shorts = allByRecency.filter((u) => u.durationSec <= 62);
  const longform = allByRecency.filter((u) => u.durationSec > 62);
  const heroUpload = longform[0] ?? allByRecency[0] ?? null;
  const totalCampaignViews = allByRecency.reduce((s, u) => s + u.viewCount, 0);

  // ── 30-day era data ──
  const uploads30d = allByRecency.filter((u) => daysAgoNum(u.publishedAt) <= 30);
  const shorts30d = uploads30d.filter((u) => u.durationSec <= 62);
  const long30d = uploads30d.filter((u) => u.durationSec > 62);
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
          </div>

          <div style={{
            display: 'flex', gap: 16, flexWrap: 'wrap',
            fontSize: 12, color: SMOKE, fontFamily: MONO,
          }}>
            <span>{totalPlanned} planned uploads</span>
            {landed > 0 && <span style={{ color: '#059669' }}>{landed} landed</span>}
            {openOpportunities > 0 && <span style={{ color: '#D97706' }}>{openOpportunities} open {openOpportunities === 1 ? 'opportunity' : 'opportunities'}</span>}
            {matchResult && <span>{Math.round(matchResult.stats.completionRate)}% executed</span>}
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


        {/* ── Current Moment ── */}
        {activeMoment && (
          <section style={{
            maxWidth: 1200, margin: '0 auto',
            padding: '24px 40px 0',
          }}>
            <LiveMomentBlock moment={activeMoment} phase={currentPhase ?? activeMoment.phase} />
          </section>
        )}

        {/* ── Timeline ── */}
        <section style={{
          maxWidth: 1200, margin: '0 auto',
          padding: '24px 40px 0',
        }}>
          <TimelineDetail plan={plan} matchResult={matchResult} currentPhase={currentPhase} />
        </section>


        {/* ┌──────────────────────────────────────────────────────────────┐
            │                                                              │
            │   R E L E A S E   A R C H I T E C T U R E                   │
            │   How each major drop was supported on YouTube.              │
            │                                                              │
            └──────────────────────────────────────────────────────────────┘ */}

        {releaseClusters.length > 0 && (
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
              fontFamily: MONO, marginBottom: 6,
            }}>
              Release Architecture
            </div>
            <div style={{
              fontSize: 12, color: SMOKE, marginBottom: 20, lineHeight: 1.5,
            }}>
              How each major release was supported on YouTube
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {releaseClusters.map((cluster) => (
                <ReleasePillar key={cluster.anchor.id} cluster={cluster} />
              ))}
            </div>
          </section>
        )}


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
// RELEASE PILLAR — Campaign node for a major release + support cluster
// ══════════════════════════════════════════════════════════════════════════════

function ReleasePillar({ cluster }: { cluster: ReleaseCluster }) {
  const [expanded, setExpanded] = useState(false);
  const { anchor, support, coverage, coverageScore, coverageLabel, totalViews, insights } = cluster;

  const coverageColor =
    coverageLabel === 'Strong' ? '#059669' :
    coverageLabel === 'Moderate' ? '#D97706' :
    coverageLabel === 'Weak' ? '#DC2626' : '#991B1B';

  const shortCount = support.filter(u => u.durationSec <= 62).length;
  const longCount = support.filter(u => u.durationSec > 62).length;

  return (
    <div style={{
      border: `1px solid ${BONE}`,
      borderRadius: 6,
      overflow: 'hidden',
      background: WHITE,
    }}>
      {/* ── Anchor header — the campaign pillar ── */}
      <div style={{
        display: 'flex', gap: 0,
        background: INK,
        position: 'relative',
      }}>
        {/* Thumbnail */}
        <a
          href={ytVideoUrl(anchor.id, anchor.durationSec)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block', width: 200, minHeight: 112,
            position: 'relative', flexShrink: 0,
            textDecoration: 'none', color: 'inherit',
          }}
        >
          <img
            src={ytThumb(anchor.id, 'hqdefault')}
            alt="" loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </a>

        {/* Info */}
        <div style={{
          flex: 1, padding: '14px 20px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          minWidth: 0,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
          }}>
            <span style={{
              fontSize: 8, fontWeight: 800, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: coverageColor,
              padding: '2px 8px', borderRadius: 2,
              background: `${coverageColor}18`,
              fontFamily: MONO,
            }}>
              {coverageLabel} support
            </span>
            <span style={{
              fontSize: 8, fontWeight: 700, color: GHOST,
              fontFamily: MONO, letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              {cluster.anchorFormat}
            </span>
          </div>

          <div style={{
            fontSize: 15, fontWeight: 700, color: PAPER,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            lineHeight: 1.3,
          }}>
            {anchor.title}
          </div>

          <div style={{
            display: 'flex', gap: 14, marginTop: 8,
            fontSize: 10, color: GHOST, fontFamily: MONO,
            letterSpacing: '0.04em',
          }}>
            <span>{fmtNum(anchor.viewCount)} views</span>
            <span>{timeAgo(anchor.publishedAt)}</span>
            <span>{cluster.totalUploads} uploads in cluster</span>
            {cluster.preReleaseCount > 0 && (
              <span>{cluster.preReleaseCount} pre-release</span>
            )}
          </div>
        </div>

        {/* Total views badge */}
        <div style={{
          padding: '14px 20px', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'flex-end', flexShrink: 0,
        }}>
          <div style={{
            fontSize: 24, fontWeight: 900, color: WHITE,
            fontFamily: MONO, letterSpacing: '-0.03em', lineHeight: 1,
          }}>
            {fmtNum(totalViews)}
          </div>
          <div style={{
            fontSize: 8, color: GHOST, fontFamily: MONO,
            letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4,
          }}>
            Total cluster views
          </div>
        </div>
      </div>

      {/* ── Coverage matrix — the format checklist ── */}
      <div style={{
        padding: '12px 20px',
        display: 'flex', gap: 6, flexWrap: 'wrap',
        borderBottom: `1px solid ${BONE}`,
      }}>
        {coverage.map((fmt) => (
          <div
            key={fmt.key}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 10px',
              borderRadius: 3,
              background: fmt.present ? '#F0FDF4' : '#FEF2F2',
              border: `1px solid ${fmt.present ? '#D1FAE5' : '#FECACA'}`,
            }}
          >
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: fmt.present ? '#059669' : '#DC2626',
            }}>
              {fmt.present ? '✓' : '✕'}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: fmt.present ? '#065F46' : '#991B1B',
            }}>
              {fmt.label}
            </span>
            {fmt.present && fmt.count > 1 && (
              <span style={{
                fontSize: 8, fontWeight: 700, color: '#059669',
                fontFamily: MONO,
              }}>
                ×{fmt.count}
              </span>
            )}
            {fmt.present && fmt.totalViews > 0 && (
              <span style={{
                fontSize: 8, color: SMOKE, fontFamily: MONO,
              }}>
                {fmtNum(fmt.totalViews)}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* ── Insights + expand ── */}
      <div style={{ padding: '10px 20px' }}>
        {insights.length > 0 && (
          <div style={{
            fontSize: 11, color: SMOKE, lineHeight: 1.5,
            marginBottom: support.length > 0 ? 8 : 0,
          }}>
            {insights[0]}
          </div>
        )}

        {support.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 0, fontSize: 10, color: GHOST,
              fontFamily: MONO, letterSpacing: '0.06em',
            }}
          >
            <span style={{
              fontSize: 7,
              transform: expanded ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.15s',
            }}>▶</span>
            {shortCount > 0 && `${shortCount} Shorts`}
            {shortCount > 0 && longCount > 0 && ' · '}
            {longCount > 0 && `${longCount} longform`}
            {' · '}{fmtNum(support.reduce((s, u) => s + u.viewCount, 0))} support views
          </button>
        )}

        {expanded && (
          <div style={{
            marginTop: 10,
            display: 'flex', gap: 6, flexWrap: 'wrap',
          }}>
            {support
              .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime())
              .map((upload) => {
                const fmt = classifyUploadFormat(upload);
                const isShort = upload.durationSec <= 62;
                const isPre = new Date(upload.publishedAt) < new Date(anchor.publishedAt);
                return (
                  <a
                    key={upload.id}
                    href={ytVideoUrl(upload.id, upload.durationSec)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '3px 8px 3px 3px',
                      background: isPre ? '#EFF6FF' : BONE,
                      borderRadius: 3,
                      textDecoration: 'none', color: 'inherit',
                      border: `1px solid ${isPre ? '#DBEAFE' : GHOST}22`,
                    }}
                  >
                    <img
                      src={ytThumb(upload.id, 'mqdefault')}
                      alt="" loading="lazy"
                      style={{
                        width: isShort ? 20 : 40,
                        height: isShort ? 28 : 22,
                        objectFit: 'cover', borderRadius: 2,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: 9, color: INK, fontWeight: 500,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: 160,
                      }}>
                        {upload.title}
                      </div>
                      <div style={{
                        fontSize: 7, color: GHOST, fontFamily: MONO,
                        display: 'flex', gap: 4, alignItems: 'center',
                      }}>
                        <span style={{
                          color: isPre ? '#2563EB' : '#059669',
                          fontWeight: 700, textTransform: 'uppercase',
                        }}>
                          {isPre ? 'Pre' : 'Post'}
                        </span>
                        <span>{fmt}</span>
                        <span>{fmtNum(upload.viewCount)}</span>
                      </div>
                    </div>
                  </a>
                );
              })}
          </div>
        )}
      </div>
    </div>
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
// LIVE MOMENT — Current campaign beat with rollout pressure
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

      {/* Thumbnail + actions grid */}
      <div style={{
        marginTop: 20,
        display: 'grid',
        gridTemplateColumns: moment.primaryUpload ? '2fr 1fr' : '1fr',
        gap: 8,
        alignItems: 'start',
      }}>
        {/* Primary thumbnail */}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {phases.map((phase) => {
        const isCurrent = currentPhase === phase.name;
        const tone = PHASE_TONE[phase.name];
        const phaseWeeks = phase.weeks.filter((w) => w.actions.length > 0 || w.momentName);
        if (phaseWeeks.length === 0) return null;

        return (
          <div key={phase.name}>
            <div style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
              textTransform: 'uppercase', marginBottom: 6,
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
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
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
  const isMoment = !!week.momentName;
  const isCurrent = isCurrentWeek(week);
  const isPast = isWeekPast(week);
  const [expanded, setExpanded] = useState(isCurrent || (isPast && isMoment));
  const matchedWeek = matchResult ? (week as MatchedWeek) : null;
  const actions = matchedWeek?.actions ?? week.actions;

  const done = actions.filter((a) =>
    'status' in a ? ((a as MatchedAction).status === 'completed' || (a as MatchedAction).status === 'live') : a.completed
  ).length;
  const recommended = actions.filter((a) =>
    'status' in a && (a as MatchedAction).status === 'recommended'
  ).length;
  const openWindows = actions.filter((a) =>
    'status' in a && ((a as MatchedAction).status === 'late' || (a as MatchedAction).status === 'missing')
  ).length;

  // Extra uploads for this week (unmatched uploads that landed here)
  const extraUploads = matchedWeek?.extraUploads ?? [];

  return (
    <div style={{
      background: isCurrent ? WHITE : isPast ? 'rgba(245,242,237,0.5)' : 'transparent',
      border: isCurrent ? `1px solid ${BONE}` : 'none',
      borderRadius: isCurrent ? 4 : 0,
      borderLeft: isPast && done > 0 ? '2px solid #059669' : isPast ? `2px solid ${BONE}` : 'none',
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

      {expanded && (
        <div style={{ padding: '0 10px 6px 44px' }}>
          {/* Past week evidence: show matched uploads as proof with thumbnails */}
          {isPast && done > 0 && (
            <div style={{
              display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4,
            }}>
              {actions
                .filter((a) => 'status' in a && (a as MatchedAction).matchedUpload &&
                  ((a as MatchedAction).status === 'completed' || (a as MatchedAction).status === 'live'))
                .map((a, i) => {
                  const matched = a as MatchedAction;
                  const upload = matched.matchedUpload!;
                  const formatLabel = classifyUploadFormat(upload);
                  return (
                    <a
                      key={`ev-${i}`}
                      href={ytVideoUrl(upload.id, upload.durationSec)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '4px 8px 4px 4px',
                        background: '#F0FDF4',
                        borderRadius: 4,
                        textDecoration: 'none', color: 'inherit',
                        border: '1px solid #D1FAE5',
                      }}
                    >
                      <img
                        src={ytThumb(upload.id, 'mqdefault')}
                        alt="" loading="lazy"
                        style={{
                          width: upload.durationSec <= 62 ? 24 : 48,
                          height: upload.durationSec <= 62 ? 32 : 27,
                          objectFit: 'cover', borderRadius: 2,
                        }}
                      />
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
                            color: '#059669', fontWeight: 700,
                            textTransform: 'uppercase',
                          }}>
                            {formatLabel}
                          </span>
                          <span>{fmtNum(upload.viewCount)} views</span>
                          <span>{timeAgo(upload.publishedAt)}</span>
                        </div>
                      </div>
                    </a>
                  );
                })}
            </div>
          )}

          {/* Extra uploads that weren't in the plan */}
          {isPast && extraUploads.length > 0 && (
            <div style={{
              display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4,
            }}>
              {extraUploads.map((upload, i) => {
                const formatLabel = classifyUploadFormat(upload);
                return (
                  <a
                    key={`ex-${i}`}
                    href={ytVideoUrl(upload.id, upload.durationSec)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '3px 8px 3px 3px',
                      background: '#F5F3FF',
                      borderRadius: 3,
                      textDecoration: 'none', color: 'inherit',
                      border: '1px solid #EDE9FE',
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
                        <span style={{ color: '#7C3AED', fontWeight: 700, textTransform: 'uppercase' }}>
                          {formatLabel}
                        </span>
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
      )}
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

function cleanTitle(title: string): string {
  return title
    .replace(/^(Upload|Post|Create|Film|Record|Publish|Release)\s+/i, '')
    .replace(/\s*(short|video|post|clip)$/i, '')
    .trim() || title;
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

function isWeekPast(week: { dateRange: string }): boolean {
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
  return diff > 7; // Past if more than 7 days ago
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
