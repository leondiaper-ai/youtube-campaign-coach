'use client';

import { useState, useEffect } from 'react';

// ── Design System ───────────────────────────────────────────────────────────

const INK    = '#0E0E0E';
const PAPER  = '#FAF7F2';
const SMOKE  = '#8A847A';
const GHOST  = '#C8C2B8';
const BONE   = '#E8E3DA';
const WHITE  = '#FFFFFF';
const WARM   = '#4A4640';

const ACCENT = {
  green:  '#2D6A4F',
  amber:  '#9A6324',
};

// ── Types ───────────────────────────────────────────────────────────────────

type BriefingVideo = {
  id: string; title: string; channelName: string; artistSlug: string;
  viewCount: number; likeCount: number; commentCount: number;
  publishedAt: string; durationSec: number; format: string;
  thumbnail: string; velocity: number; daysAgo: number;
};

type BriefingChannel = {
  slug: string; name: string; channelHandle: string | null;
  subs: number | null; totalViews: number | null; views7d: number | null;
  subs7d: number | null; viewsWoW: number | null;
  uploads30d: number; shorts30d: number; longform30d: number;
  lastUploadAt: string | null; lastUploadDaysAgo: number | null;
  thumbnail: string | null; phase: string; campaign: string | null;
  campaignStartDate: string | null; classification: string;
  subsPer1kViews: number | null;
};

type FocusCampaign = {
  channel: BriefingChannel;
  heroImage: string;
  campaignPhase: string;
  narrative: string;
  contentStrategy: string;
  ecosystemSignal: string;
  nextMoments: string;
  currentMoment: string;
  nextMoment: string;
  upcomingMoment: string;
  supportOpportunity: string;
  hasCoachPlan: boolean;
  formatBreakdown: string[];
  recentVideos: BriefingVideo[];
};

type UpcomingMoment = {
  artist: string;
  slug: string;
  moment: string;
  date: string | null;
  timing: string;
  eventType: string;
  supportSurface: string;
  rolloutNote: string;
  fromCoachPlan: boolean;
  priority: number;
};

type EcosystemHighlight = {
  name: string; label: string; read: string;
  thumbnail: string | null; channelHandle: string | null;
};

type BriefingData = {
  weekRange: string; generatedAt: string; activeCampaignCount: number;
  focusCampaigns: FocusCampaign[];
  platformObservations: string[];
  upcomingMoments: UpcomingMoment[];
  playbook: { title: string; why: string; when: string; actions: string[] };
  topShorts: BriefingVideo[];
  topVideos: BriefingVideo[];
  ecosystemHighlights: EcosystemHighlight[];
};

// ── Utilities ───────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K';
  return String(n);
}

function ytUrl(id: string, dur: number): string {
  return dur <= 62 ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`;
}

function channelUrl(handle: string | null): string | null {
  if (!handle) return null;
  const h = handle.startsWith('@') ? handle : `@${handle}`;
  return `https://www.youtube.com/${h}`;
}

/** Group upcoming moments into time buckets for editorial display */
function groupMomentsByWindow(moments: UpcomingMoment[]): {
  thisWeek: UpcomingMoment[];
  nextTwoWeeks: UpcomingMoment[];
  nextMonth: UpcomingMoment[];
  ongoing: UpcomingMoment[];
} {
  const now = Date.now();
  const thisWeek: UpcomingMoment[] = [];
  const nextTwoWeeks: UpcomingMoment[] = [];
  const nextMonth: UpcomingMoment[] = [];
  const ongoing: UpcomingMoment[] = [];

  for (const m of moments) {
    if (!m.date) {
      ongoing.push(m);
      continue;
    }
    const d = new Date(m.date + 'T00:00:00');
    const diffDays = Math.round((d.getTime() - now) / 86400000);

    if (diffDays <= 7) {
      thisWeek.push(m);
    } else if (diffDays <= 14) {
      nextTwoWeeks.push(m);
    } else {
      nextMonth.push(m);
    }
  }

  return { thisWeek, nextTwoWeeks, nextMonth, ongoing };
}

// ── Logo Components ────────────────────────────────────────────────────────

function VirginMusicLogo({ height = 36 }: { height?: number }) {
  return (
    <img
      src="/virgin-music-logo.png"
      alt="Virgin Music"
      style={{ height, width: 'auto', display: 'block' }}
    />
  );
}

function YouTubeLogo({ height = 20 }: { height?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: height * 0.35 }}>
      <img
        src="/youtube-icon.png"
        alt=""
        style={{ height, width: 'auto', display: 'block' }}
      />
      <span style={{
        fontFamily: "'Inter', 'Roboto', system-ui, sans-serif",
        fontWeight: 700,
        fontSize: height * 0.85,
        color: INK,
        letterSpacing: '-0.02em',
      }}>
        YouTube
      </span>
    </div>
  );
}

function PlayOverlay({ size = 32 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <svg width={size * 0.35} height={size * 0.4} viewBox="0 0 10 12" fill="none">
        <polygon points="0,0 10,6 0,12" fill={WHITE} />
      </svg>
    </div>
  );
}

// ── Editorial Moment Card ──────────────────────────────────────────────────

function MomentCard({ m }: { m: UpcomingMoment }) {
  return (
    <div style={{
      padding: '16px 0',
      borderBottom: `1px solid ${BONE}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
        <span style={{
          fontSize: 11, fontWeight: 800, color: INK,
          letterSpacing: '0.02em', textTransform: 'uppercase' as const,
        }}>
          {m.artist}
        </span>
        {m.fromCoachPlan && (
          <span style={{
            fontSize: 7, fontWeight: 800, letterSpacing: '0.1em',
            textTransform: 'uppercase' as const,
            color: ACCENT.green, opacity: 0.7,
          }}>
            From planner
          </span>
        )}
      </div>
      <p style={{
        fontSize: 14, fontWeight: 500, color: WARM, lineHeight: 1.45,
        margin: '0 0 6px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        {m.moment}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          fontSize: 10, fontWeight: 600, color: ACCENT.green,
          letterSpacing: '0.04em',
        }}>
          {m.eventType}
        </span>
        <span style={{ fontSize: 10, color: SMOKE }}>
          {m.supportSurface}
        </span>
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export default function PartnerBriefing() {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Forward ?refresh=1 from page URL to API call so cache busting works
    const params = new URLSearchParams(window.location.search);
    const refreshParam = params.get('refresh') === '1' ? '?refresh=1' : '';
    fetch(`/api/partner-briefing${refreshParam}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return (
    <main style={{ background: PAPER, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: GHOST }}>
        Preparing briefing
      </div>
    </main>
  );

  if (error || !data) return (
    <main style={{ background: PAPER, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: SMOKE }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Failed to load</div>
        <div style={{ fontSize: 11 }}>{error}</div>
      </div>
    </main>
  );

  const grouped = groupMomentsByWindow(data.upcomingMoments);
  const hasDateMoments = grouped.thisWeek.length > 0 || grouped.nextTwoWeeks.length > 0 || grouped.nextMonth.length > 0;

  return (
    <div className="partner-briefing" style={{ background: PAPER, minHeight: '100vh', color: INK, overflowX: 'hidden', position: 'relative' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Caveat:wght@400;500;600;700&display=swap');
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .pb-fade { animation: fadeUp 0.6s ease-out both; }
        a.pb-link { text-decoration: none; color: inherit; }
        a.pb-link:hover { opacity: 0.85; }

        .partner-briefing::after {
          content: '';
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
          background-repeat: repeat;
          background-size: 256px 256px;
          pointer-events: none;
          z-index: 9999;
          mix-blend-mode: multiply;
        }

        .pb-campaign-card {
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .pb-campaign-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.1);
        }
        .pb-campaign-card:hover .pb-hero-img {
          transform: scale(1.02);
        }
        .pb-hero-img {
          transition: transform 0.4s ease;
        }
        .shorts-cell {
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          border-radius: 6px;
          overflow: hidden;
        }
        .shorts-cell:hover {
          transform: scale(1.03);
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
        }
        .pb-format-tag {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          background: rgba(45,106,79,0.08);
          color: ${ACCENT.green};
        }
      `}</style>


      {/* ═══════ TOP BAR ═══════ */}
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '20px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <VirginMusicLogo height={30} />
          <div style={{ width: 1, height: 36, background: BONE, flexShrink: 0 }} />
          <YouTubeLogo height={22} />
        </div>
        <div style={{ fontSize: 10, color: SMOKE }}>
          {data.weekRange}
        </div>
      </div>


      {/* ═══════ HERO SECTION ═══════ */}
      <header className="pb-fade" style={{
        maxWidth: 1200, margin: '0 auto', padding: '36px 40px 48px',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 440px', gap: 48, alignItems: 'start' }}>
          {/* Left — Title + intro */}
          <div>
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.25em',
              textTransform: 'uppercase' as const, color: GHOST, marginBottom: 16,
            }}>
              Virgin Music x YouTube
            </div>
            <h1 style={{
              fontSize: 64, fontWeight: 900, lineHeight: 0.92,
              letterSpacing: '-0.04em', color: INK,
              margin: '0 0 0 -3px',
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontStyle: 'italic',
            }}>
              Weekly<br />Campaign<br />Briefing.
            </h1>

            <p style={{
              fontSize: 15, fontWeight: 400, color: WARM, lineHeight: 1.6,
              margin: '28px 0 0', maxWidth: 460,
              fontFamily: 'Inter, system-ui, sans-serif',
            }}>
              A snapshot of active Virgin Music campaigns on YouTube — what&apos;s happening now, what&apos;s coming next, and where the key support moments are.
            </p>

            <div style={{
              display: 'flex', gap: 24, marginTop: 28,
              fontSize: 11, fontWeight: 600, color: SMOKE,
            }}>
              <div>
                <span style={{ fontSize: 28, fontWeight: 900, color: INK, display: 'block', lineHeight: 1 }}>
                  {data.activeCampaignCount}
                </span>
                <span style={{ fontSize: 9, letterSpacing: '0.06em' }}>Active campaigns</span>
              </div>
              <div style={{ width: 1, background: BONE }} />
              <div>
                <span style={{ fontSize: 28, fontWeight: 900, color: INK, display: 'block', lineHeight: 1 }}>
                  {grouped.thisWeek.length + grouped.nextTwoWeeks.length}
                </span>
                <span style={{ fontSize: 9, letterSpacing: '0.06em' }}>Key moments ahead</span>
              </div>
            </div>
          </div>

          {/* Right — Shorts grid */}
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {data.topShorts.slice(0, 6).map((v) => (
                <a key={v.id} href={ytUrl(v.id, v.durationSec)} target="_blank" rel="noopener noreferrer"
                  className="pb-link shorts-cell" style={{ display: 'block', position: 'relative' }}>
                  <img src={v.thumbnail} alt="" loading="lazy"
                    style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.55) 100%)',
                  }} />
                  <div style={{
                    position: 'absolute', bottom: 8, left: 8, right: 8,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <PlayOverlay size={20} />
                    <span style={{
                      fontSize: 12, fontWeight: 800, color: WHITE,
                      fontFamily: 'Inter, system-ui, sans-serif',
                      textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                    }}>
                      {fmtNum(v.viewCount)}
                    </span>
                  </div>
                </a>
              ))}
            </div>
            <div style={{
              marginTop: 10, textAlign: 'right', paddingRight: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6,
            }}>
              <span style={{
                fontFamily: "'Caveat', cursive",
                fontSize: 17, fontWeight: 500, color: SMOKE,
                fontStyle: 'italic',
              }}>
                This week&apos;s Shorts across the roster
              </span>
              <svg width="28" height="16" viewBox="0 0 28 16" fill="none" style={{ flexShrink: 0 }}>
                <path d="M2 10C6 8 14 4 22 6" stroke={SMOKE} strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <path d="M18 3L23 6L18 9" stroke={SMOKE} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </header>


      {/* ═══════ WHAT HAPPENS NEXT — Editorial Timeline ═══════ */}
      {hasDateMoments && (
        <section className="pb-fade" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 56px' }}>
          <div style={{ height: 1, background: BONE, marginBottom: 40 }} />

          <div style={{ marginBottom: 32 }}>
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.25em',
              textTransform: 'uppercase' as const, color: GHOST, marginBottom: 12,
            }}>
              What Happens Next
            </div>
            <p style={{
              fontSize: 18, fontWeight: 500, color: WARM, lineHeight: 1.5,
              maxWidth: 620, margin: 0,
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontStyle: 'italic',
            }}>
              The key dates and content moments shaping the next four weeks across the roster — pulled from live campaign plans.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 32 }}>
            {/* THIS WEEK */}
            <div>
              <div style={{
                fontSize: 11, fontWeight: 900, letterSpacing: '0.08em',
                textTransform: 'uppercase' as const, color: INK,
                paddingBottom: 10, borderBottom: `2px solid ${INK}`,
                marginBottom: 4,
              }}>
                This Week
              </div>
              {grouped.thisWeek.length > 0 ? (
                grouped.thisWeek.map((m, i) => <MomentCard key={`tw-${i}`} m={m} />)
              ) : (
                <p style={{
                  fontSize: 12, color: SMOKE, fontStyle: 'italic',
                  padding: '16px 0', margin: 0,
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}>
                  No confirmed dates this window — campaigns in content support mode.
                </p>
              )}
            </div>

            {/* NEXT TWO WEEKS */}
            <div>
              <div style={{
                fontSize: 11, fontWeight: 900, letterSpacing: '0.08em',
                textTransform: 'uppercase' as const, color: INK,
                paddingBottom: 10, borderBottom: `2px solid ${BONE}`,
                marginBottom: 4,
              }}>
                Next 7–14 Days
              </div>
              {grouped.nextTwoWeeks.length > 0 ? (
                grouped.nextTwoWeeks.map((m, i) => <MomentCard key={`nt-${i}`} m={m} />)
              ) : (
                <p style={{
                  fontSize: 12, color: SMOKE, fontStyle: 'italic',
                  padding: '16px 0', margin: 0,
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}>
                  Planning window open — content strategies in development.
                </p>
              )}
            </div>

            {/* NEXT MONTH */}
            <div>
              <div style={{
                fontSize: 11, fontWeight: 900, letterSpacing: '0.08em',
                textTransform: 'uppercase' as const, color: INK,
                paddingBottom: 10, borderBottom: `2px solid ${BONE}`,
                marginBottom: 4,
              }}>
                Next 30 Days
              </div>
              {grouped.nextMonth.length > 0 ? (
                grouped.nextMonth.map((m, i) => <MomentCard key={`nm-${i}`} m={m} />)
              ) : (
                <p style={{
                  fontSize: 12, color: SMOKE, fontStyle: 'italic',
                  padding: '16px 0', margin: 0,
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}>
                  Longer-range campaign moments in planning.
                </p>
              )}
            </div>
          </div>
        </section>
      )}


      {/* ═══════ FOCUS CAMPAIGNS ═══════ */}
      <section className="pb-fade" style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 40px 48px',
      }}>
        <div style={{ height: 1, background: BONE, marginBottom: 40 }} />

        <div style={{ marginBottom: 32 }}>
          <div style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.22em',
            textTransform: 'uppercase' as const, color: GHOST, marginBottom: 10,
          }}>
            Active Campaigns
          </div>
          <p style={{
            fontSize: 15, fontWeight: 400, color: SMOKE, lineHeight: 1.5,
            maxWidth: 560, margin: 0,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            Where Virgin Music is focusing content strategy and audience development on YouTube this week.
          </p>
        </div>

        {/* Featured campaign — full width hero */}
        {data.focusCampaigns.length > 0 && (() => {
          const fc = data.focusCampaigns[0];
          const chUrl = channelUrl(fc.channel.channelHandle);
          return (
            <div className="pb-campaign-card" style={{
              borderRadius: 10, overflow: 'hidden', background: INK,
              marginBottom: 24, position: 'relative',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                {/* Left — hero image */}
                <div style={{ position: 'relative', overflow: 'hidden' }}>
                  <img
                    src={fc.heroImage}
                    alt=""
                    loading="lazy"
                    className="pb-hero-img"
                    style={{
                      width: '100%', height: '100%', minHeight: 320, objectFit: 'cover', display: 'block',
                      filter: 'brightness(0.85)',
                    }}
                  />
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(135deg, transparent 30%, rgba(14,14,14,0.6) 100%)',
                  }} />
                  <div style={{ position: 'absolute', top: 20, left: 20 }}>
                    <span style={{
                      display: 'inline-block', padding: '4px 12px', borderRadius: 20,
                      fontSize: 8, fontWeight: 800, letterSpacing: '0.12em',
                      textTransform: 'uppercase' as const,
                      background: 'rgba(255,255,255,0.15)', color: WHITE,
                      backdropFilter: 'blur(8px)',
                    }}>
                      {fc.campaignPhase}
                    </span>
                  </div>
                </div>

                {/* Right — content */}
                <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  {/* Artist name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    {fc.channel.thumbnail && (
                      <img src={fc.channel.thumbnail} alt="" style={{
                        width: 32, height: 32, borderRadius: '50%', objectFit: 'cover',
                        border: '2px solid rgba(255,255,255,0.2)',
                      }} />
                    )}
                    {chUrl ? (
                      <a href={chUrl} target="_blank" rel="noopener noreferrer" className="pb-link">
                        <span style={{
                          fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.8)',
                          letterSpacing: '0.04em', textTransform: 'uppercase' as const,
                        }}>
                          {fc.channel.name}
                        </span>
                      </a>
                    ) : (
                      <span style={{
                        fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.8)',
                        letterSpacing: '0.04em', textTransform: 'uppercase' as const,
                      }}>
                        {fc.channel.name}
                      </span>
                    )}
                  </div>

                  {/* Narrative */}
                  <p style={{
                    fontSize: 15, fontWeight: 500, color: WHITE, lineHeight: 1.5,
                    margin: '0 0 20px',
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}>
                    {fc.narrative}
                  </p>

                  {/* Current / Next / Upcoming / Support — editorial quartet */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14,
                    paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)',
                  }}>
                    <div>
                      <div style={{
                        fontSize: 7, fontWeight: 800, letterSpacing: '0.14em',
                        textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)',
                        marginBottom: 5,
                      }}>
                        Current
                      </div>
                      <p style={{
                        fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.35,
                        margin: 0, fontFamily: 'Inter, system-ui, sans-serif',
                      }}>
                        {fc.currentMoment}
                      </p>
                    </div>
                    <div>
                      <div style={{
                        fontSize: 7, fontWeight: 800, letterSpacing: '0.14em',
                        textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)',
                        marginBottom: 5,
                      }}>
                        Next
                      </div>
                      <p style={{
                        fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.35,
                        margin: 0, fontFamily: 'Inter, system-ui, sans-serif',
                      }}>
                        {fc.nextMoment}
                      </p>
                    </div>
                    <div>
                      <div style={{
                        fontSize: 7, fontWeight: 800, letterSpacing: '0.14em',
                        textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)',
                        marginBottom: 5,
                      }}>
                        Upcoming
                      </div>
                      <p style={{
                        fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.35,
                        margin: 0, fontFamily: 'Inter, system-ui, sans-serif',
                      }}>
                        {fc.upcomingMoment}
                      </p>
                    </div>
                    <div>
                      <div style={{
                        fontSize: 7, fontWeight: 800, letterSpacing: '0.14em',
                        textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)',
                        marginBottom: 5,
                      }}>
                        Support
                      </div>
                      <p style={{
                        fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.35,
                        margin: 0, fontFamily: 'Inter, system-ui, sans-serif',
                      }}>
                        {fc.supportOpportunity}
                      </p>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: 'flex', gap: 20, fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 16 }}>
                    {fc.channel.views7d != null && (
                      <span><strong style={{ color: 'rgba(255,255,255,0.6)' }}>{fmtNum(fc.channel.views7d)}</strong> views/wk</span>
                    )}
                    <span><strong style={{ color: 'rgba(255,255,255,0.6)' }}>{fc.channel.uploads30d}</strong> uploads/30d</span>
                    {fc.channel.subs != null && (
                      <span><strong style={{ color: 'rgba(255,255,255,0.6)' }}>{fmtNum(fc.channel.subs)}</strong> subs</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Remaining campaigns — 2-column cards with editorial triplet */}
        {data.focusCampaigns.length > 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
            {data.focusCampaigns.slice(1).map(fc => {
              const chUrl = channelUrl(fc.channel.channelHandle);
              return (
                <div key={fc.channel.slug} className="pb-campaign-card" style={{
                  borderRadius: 8, overflow: 'hidden', background: WHITE,
                  border: `1px solid ${BONE}`,
                }}>
                  {/* Hero image */}
                  <div style={{ position: 'relative', overflow: 'hidden', height: 140 }}>
                    <img
                      src={fc.heroImage}
                      alt=""
                      loading="lazy"
                      className="pb-hero-img"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(transparent 30%, rgba(0,0,0,0.5) 100%)',
                    }} />
                    <div style={{ position: 'absolute', top: 12, left: 12 }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                        fontSize: 7, fontWeight: 800, letterSpacing: '0.12em',
                        textTransform: 'uppercase' as const,
                        background: 'rgba(0,0,0,0.5)', color: WHITE,
                        backdropFilter: 'blur(6px)',
                      }}>
                        {fc.campaignPhase}
                      </span>
                    </div>
                    <div style={{ position: 'absolute', bottom: 12, left: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {fc.channel.thumbnail && (
                        <img src={fc.channel.thumbnail} alt="" style={{
                          width: 22, height: 22, borderRadius: '50%', objectFit: 'cover',
                          border: '2px solid rgba(255,255,255,0.3)',
                        }} />
                      )}
                      {chUrl ? (
                        <a href={chUrl} target="_blank" rel="noopener noreferrer" className="pb-link">
                          <span style={{
                            fontSize: 11, fontWeight: 800, color: WHITE,
                            letterSpacing: '0.03em', textTransform: 'uppercase' as const,
                            textShadow: '0 1px 4px rgba(0,0,0,0.4)',
                          }}>
                            {fc.channel.name}
                          </span>
                        </a>
                      ) : (
                        <span style={{
                          fontSize: 11, fontWeight: 800, color: WHITE,
                          letterSpacing: '0.03em', textTransform: 'uppercase' as const,
                          textShadow: '0 1px 4px rgba(0,0,0,0.4)',
                        }}>
                          {fc.channel.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Content area */}
                  <div style={{ padding: '14px 18px 18px' }}>
                    <p style={{
                      fontSize: 12, fontWeight: 500, color: INK, lineHeight: 1.45,
                      margin: '0 0 14px',
                      fontFamily: 'Inter, system-ui, sans-serif',
                    }}>
                      {fc.narrative}
                    </p>

                    {/* Current / Next / Upcoming / Support — editorial quartet */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8,
                      paddingTop: 12, borderTop: `1px solid ${BONE}`,
                    }}>
                      <div>
                        <div style={{
                          fontSize: 7, fontWeight: 800, letterSpacing: '0.12em',
                          textTransform: 'uppercase' as const, color: GHOST,
                          marginBottom: 4,
                        }}>
                          Current
                        </div>
                        <p style={{
                          fontSize: 10, color: WARM, lineHeight: 1.3, margin: 0,
                          fontFamily: 'Inter, system-ui, sans-serif',
                        }}>
                          {fc.currentMoment}
                        </p>
                      </div>
                      <div>
                        <div style={{
                          fontSize: 7, fontWeight: 800, letterSpacing: '0.12em',
                          textTransform: 'uppercase' as const, color: GHOST,
                          marginBottom: 4,
                        }}>
                          Next
                        </div>
                        <p style={{
                          fontSize: 10, color: WARM, lineHeight: 1.3, margin: 0,
                          fontFamily: 'Inter, system-ui, sans-serif',
                        }}>
                          {fc.nextMoment}
                        </p>
                      </div>
                      <div>
                        <div style={{
                          fontSize: 7, fontWeight: 800, letterSpacing: '0.12em',
                          textTransform: 'uppercase' as const, color: GHOST,
                          marginBottom: 4,
                        }}>
                          Upcoming
                        </div>
                        <p style={{
                          fontSize: 10, color: WARM, lineHeight: 1.3, margin: 0,
                          fontFamily: 'Inter, system-ui, sans-serif',
                        }}>
                          {fc.upcomingMoment}
                        </p>
                      </div>
                      <div>
                        <div style={{
                          fontSize: 7, fontWeight: 800, letterSpacing: '0.12em',
                          textTransform: 'uppercase' as const, color: GHOST,
                          marginBottom: 4,
                        }}>
                          Support
                        </div>
                        <p style={{
                          fontSize: 10, color: ACCENT.green, lineHeight: 1.3, margin: 0,
                          fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 500,
                        }}>
                          {fc.supportOpportunity}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>


      {/* ═══════ WHAT WE'RE SEEING ON PLATFORM + STANDOUT MOMENTS ═══════ */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 48px' }}>
        <div style={{ height: 1, background: BONE, marginBottom: 40 }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
          {/* Left — Platform observations */}
          <div>
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.22em',
              textTransform: 'uppercase' as const, color: GHOST, marginBottom: 10,
            }}>
              What We&apos;re Seeing on Platform
            </div>
            <p style={{
              fontSize: 12, fontWeight: 400, color: SMOKE, lineHeight: 1.5,
              maxWidth: 400, margin: '0 0 24px',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}>
              Patterns and behaviours across this week&apos;s campaign activity.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {data.platformObservations.map((obs, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: `rgba(45,106,79,${i === 0 ? '0.1' : '0.06'})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 1,
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: ACCENT.green }}>
                      {i + 1}
                    </span>
                  </div>
                  <p style={{
                    fontSize: i === 0 ? 14 : 12,
                    fontWeight: i === 0 ? 600 : 400,
                    color: i === 0 ? INK : WARM,
                    lineHeight: 1.5, margin: 0,
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}>
                    {obs}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Ecosystem highlights + standout moments */}
          <div>
            {data.ecosystemHighlights.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.22em',
                  textTransform: 'uppercase' as const, color: GHOST, marginBottom: 16,
                }}>
                  Strongest Ecosystems This Week
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {data.ecosystemHighlights.map((h, i) => {
                    const chUrlH = channelUrl(h.channelHandle);
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 14px', borderRadius: 8,
                        background: WHITE, border: `1px solid ${BONE}`,
                      }}>
                        {h.thumbnail && (
                          chUrlH ? (
                            <a href={chUrlH} target="_blank" rel="noopener noreferrer" className="pb-link" style={{ flexShrink: 0 }}>
                              <img src={h.thumbnail} alt="" style={{
                                width: 28, height: 28, borderRadius: '50%', objectFit: 'cover',
                              }} />
                            </a>
                          ) : (
                            <img src={h.thumbnail} alt="" style={{
                              width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
                            }} />
                          )
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {chUrlH ? (
                              <a href={chUrlH} target="_blank" rel="noopener noreferrer" className="pb-link">
                                <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>{h.name}</span>
                              </a>
                            ) : (
                              <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>{h.name}</span>
                            )}
                            <span className="pb-format-tag">{h.label}</span>
                          </div>
                          <p style={{
                            fontSize: 10, color: SMOKE, lineHeight: 1.4, margin: '4px 0 0',
                            fontFamily: 'Inter, system-ui, sans-serif',
                          }}>
                            {h.read}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top video moments */}
            {data.topVideos.length > 0 && (
              <div>
                <div style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.22em',
                  textTransform: 'uppercase' as const, color: GHOST, marginBottom: 12,
                }}>
                  Standout Moments
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {data.topVideos.slice(0, 3).map(v => (
                    <a key={v.id} href={ytUrl(v.id, v.durationSec)} target="_blank" rel="noopener noreferrer"
                      className="pb-link">
                      <div style={{ borderRadius: 6, overflow: 'hidden', marginBottom: 6, position: 'relative' }}>
                        <img src={v.thumbnail} alt="" loading="lazy"
                          style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />
                        <div style={{ position: 'absolute', bottom: 4, right: 4 }}>
                          <PlayOverlay size={18} />
                        </div>
                      </div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: SMOKE, letterSpacing: '0.02em', textTransform: 'uppercase' as const, marginBottom: 2 }}>
                        {v.channelName}
                      </div>
                      <div style={{
                        fontSize: 10, fontWeight: 600, color: INK, lineHeight: 1.25,
                        overflow: 'hidden', display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                      }}>
                        {v.title}
                      </div>
                      <div style={{ fontSize: 9, color: SMOKE, marginTop: 2 }}>
                        {fmtNum(v.viewCount)} views
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>


      {/* ═══════ FOOTER ═══════ */}
      <footer style={{
        maxWidth: 1200, margin: '0 auto', padding: '20px 40px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <VirginMusicLogo height={16} />
          <div style={{ width: 1, height: 20, background: BONE }} />
          <YouTubeLogo height={13} />
        </div>
        <p style={{
          fontSize: 9, color: GHOST, letterSpacing: '0.06em', lineHeight: 1.6,
          fontFamily: 'Inter, system-ui, sans-serif', fontStyle: 'italic',
          margin: 0,
        }}>
          Prepared by Virgin Music UK — Campaign Intelligence
        </p>
      </footer>
    </div>
  );
}
