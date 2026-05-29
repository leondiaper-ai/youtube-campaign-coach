'use client';

import { useState, useEffect } from 'react';
import PulseNav from './PulseNav';

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
  // Editorial card (NOW / NEXT / AFTER / YOUTUBE FOCUS)
  nowLabel: string;
  nowDetail: string;
  nowThumbnail: string | null;
  nextLabel: string;
  nextDate: string | null;
  afterLabel: string;
  afterDate: string | null;
  youtubeFocus: string;
  channelUrl: string | null;
  hasCoachPlan: boolean;
  currentMoment: string;
  currentMomentDate: string | null;
  nextMoment: string;
  nextMomentDate: string | null;
  upcomingMoment: string;
  upcomingMomentDate: string | null;
  recentVideos: BriefingVideo[];
  // Editorial priority
  editorialPriority: number;
  editorialHeadline: string;
  editorialWhyItMatters: string;
  standoutVideo: BriefingVideo | null;
  isPriority: boolean;
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

type MomentWatching = {
  id: string; title: string; artistName: string; artistSlug: string;
  thumbnail: string; viewCount: number; velocity: number; daysAgo: number;
  format: string; durationSec: number; context: string;
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
  momentsWatching: MomentWatching[];
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
  // Extract short date from timing (e.g. "9 Jun (in 11d)" → "9 Jun")
  const shortDate = m.timing ? m.timing.replace(/\s*\(.*\)/, '') : '';

  return (
    <div style={{
      padding: '10px 0',
      borderBottom: `1px solid ${BONE}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
        <span style={{
          fontSize: 10, fontWeight: 800, color: INK,
          letterSpacing: '0.02em', textTransform: 'uppercase' as const,
        }}>
          {m.artist}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 800, color: ACCENT.green,
          whiteSpace: 'nowrap',
        }}>
          {shortDate}
        </span>
      </div>
      <p style={{
        fontSize: 12, fontWeight: 500, color: WARM, lineHeight: 1.35,
        margin: '3px 0 0',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        {m.moment}
      </p>
      <span style={{
        display: 'inline-block', marginTop: 4,
        padding: '2px 7px', borderRadius: 10,
        fontSize: 8, fontWeight: 700, color: ACCENT.green,
        background: 'rgba(45,106,79,0.06)',
      }}>
        {m.eventType}
      </span>
    </div>
  );
}

// ── Moment Cell (reusable for hero + smaller campaign cards) ──────────────

function MomentCell({ label, title, date, color, dateColor }: {
  label: string; title: string; date?: string | null;
  color: string; dateColor?: string;
}) {
  return (
    <div>
      <div style={{
        fontSize: 7, fontWeight: 800, letterSpacing: '0.12em',
        textTransform: 'uppercase' as const, color: `${color}55`,
        marginBottom: 4,
      }}>
        {label}
      </div>
      <p style={{
        fontSize: 10, color, lineHeight: 1.35, margin: 0,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        {title}
      </p>
      {date && (
        <p style={{
          fontSize: 10, fontWeight: 700,
          color: dateColor ?? ACCENT.green,
          margin: '3px 0 0', lineHeight: 1,
        }}>
          {date}
        </p>
      )}
    </div>
  );
}

// ── Format Tags (content mix at a glance) ────────────────────────────────

const FORMAT_TAG_STYLE: Record<string, { bg: string; fg: string }> = {
  'Official Video': { bg: '#E6F8EE', fg: '#2D6A4F' },
  'Lyric Video':    { bg: '#E8F0FE', fg: '#1A56B8' },
  'Visualizer':     { bg: '#F0E8FE', fg: '#6B21A8' },
  'BTS':            { bg: '#FFF5D6', fg: '#7A5A00' },
  'Live Session':   { bg: '#FFEAD6', fg: '#8A4A1A' },
  'Short':          { bg: '#F3F0EA', fg: '#4A4640' },
  'Collab':         { bg: '#E6F8EE', fg: '#2D6A4F' },
  'Premiere':       { bg: '#E8F0FE', fg: '#1A56B8' },
  'Trailer':        { bg: '#FFF5D6', fg: '#7A5A00' },
};

function FormatTags({ videos }: { videos: BriefingVideo[] }) {
  // Derive unique format types from recent videos
  const formats = new Set<string>();
  for (const v of videos) {
    const fmt = v.format;
    if (v.durationSec <= 62) formats.add('Short');
    if (/official video/i.test(fmt)) formats.add('Official Video');
    else if (/lyric/i.test(fmt)) formats.add('Lyric Video');
    else if (/visuali/i.test(fmt)) formats.add('Visualizer');
    else if (/bts|behind/i.test(fmt)) formats.add('BTS');
    else if (/live session|acoustic/i.test(fmt)) formats.add('Live Session');
    else if (/collab/i.test(fmt)) formats.add('Collab');
    else if (/trailer/i.test(fmt)) formats.add('Trailer');
    else if (/premiere/i.test(fmt)) formats.add('Premiere');
  }
  if (formats.size === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
      {Array.from(formats).map(fmt => {
        const s = FORMAT_TAG_STYLE[fmt] ?? { bg: '#F3F0EA', fg: '#4A4640' };
        return (
          <span key={fmt} style={{
            display: 'inline-block', padding: '2px 8px', borderRadius: 10,
            fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            background: s.bg, color: s.fg,
          }}>
            {fmt}
          </span>
        );
      })}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export default function PartnerBriefing({ showPulseNav = false }: { showPulseNav?: boolean } = {}) {
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


      {/* ═══════ PULSE NAV (when embedded in weekly-pulse) ═══════ */}
      {showPulseNav && (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px' }}>
          <PulseNav />
        </div>
      )}

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
              Priority<br />Campaigns.
            </h1>

            <p style={{
              fontSize: 15, fontWeight: 400, color: WARM, lineHeight: 1.6,
              margin: '28px 0 0', maxWidth: 460,
              fontFamily: 'Inter, system-ui, sans-serif',
            }}>
              What matters on YouTube over the next 30 days — the key release moments, campaign activity, and where support is needed.
            </p>
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

          {/* 3-column layout — This Week / Next 2 Weeks / Next 30 Days */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 32, alignItems: 'start' }}>
            {[
              { label: 'This Week', items: grouped.thisWeek },
              { label: 'Next 7–14 Days', items: grouped.nextTwoWeeks },
              { label: 'Next 30 Days', items: grouped.nextMonth.slice(0, 8) },
            ].map((col, ci) => (
              <div key={ci}>
                <div style={{
                  fontSize: 11, fontWeight: 900, letterSpacing: '0.08em',
                  textTransform: 'uppercase' as const, color: INK,
                  paddingBottom: 10, borderBottom: ci === 0 ? `2px solid ${INK}` : `2px solid ${BONE}`,
                  marginBottom: 4,
                }}>
                  {col.label}
                </div>
                {col.items.length > 0 ? col.items.map((m, i) => (
                  <MomentCard key={`${ci}-${i}`} m={m} />
                )) : (
                  <p style={{
                    fontSize: 12, color: SMOKE, fontStyle: 'italic',
                    padding: '16px 0', margin: 0,
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}>
                    No confirmed dates this window.
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}


      {/* ═══════ EDITORIAL PRIORITY CAMPAIGNS ═══════ */}
      {(() => {
        const priority = data.focusCampaigns.filter(fc => fc.isPriority);
        const remaining = data.focusCampaigns.filter(fc => !fc.isPriority);

        return (
          <>
            {priority.length > 0 && (
              <section className="pb-fade" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 48px' }}>
                <div style={{ height: 1, background: BONE, marginBottom: 40 }} />
                <div style={{ marginBottom: 28 }}>
                  <div style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.22em',
                    textTransform: 'uppercase' as const, color: GHOST, marginBottom: 10,
                  }}>
                    Priority Campaigns
                  </div>
                  <p style={{
                    fontSize: 15, fontWeight: 400, color: SMOKE, lineHeight: 1.5,
                    maxWidth: 560, margin: 0, fontFamily: 'Inter, system-ui, sans-serif',
                  }}>
                    The strongest YouTube campaigns this week — selected by performance, content activity, and campaign momentum.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {priority.map(fc => (
                    <a
                      key={fc.channel.slug}
                      href={fc.channelUrl ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pb-campaign-card pb-link"
                      style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr',
                        borderRadius: 10, overflow: 'hidden',
                        background: WHITE, border: `1px solid ${BONE}`, textDecoration: 'none',
                      }}
                    >
                      {/* Left — hero image from strongest/latest video */}
                      <div style={{ position: 'relative', overflow: 'hidden', minHeight: 260 }}>
                        <img src={fc.heroImage} alt="" loading="lazy" className="pb-hero-img"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 30%, rgba(0,0,0,0.65) 100%)' }} />
                        <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            {fc.channel.thumbnail && (
                              <img src={fc.channel.thumbnail} alt="" style={{
                                width: 28, height: 28, borderRadius: '50%', objectFit: 'cover',
                                border: '2px solid rgba(255,255,255,0.3)',
                              }} />
                            )}
                            <span style={{ fontSize: 12, fontWeight: 800, color: WHITE, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>
                              {fc.channel.name}
                            </span>
                          </div>
                          {/* Standout video scale proof */}
                          {fc.standoutVideo && fc.standoutVideo.viewCount >= 10000 && (
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
                              {fc.standoutVideo.title.length > 60 ? fc.standoutVideo.title.slice(0, 57) + '...' : fc.standoutVideo.title} — {fmtNum(fc.standoutVideo.viewCount)} views
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right — editorial content */}
                      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <p style={{
                          fontSize: 14, fontWeight: 500, color: WARM, lineHeight: 1.5,
                          margin: '0 0 12px', fontFamily: 'Inter, system-ui, sans-serif',
                        }}>
                          {fc.editorialHeadline}
                        </p>

                        {/* Content format tags */}
                        <FormatTags videos={fc.recentVideos} />

                        {/* NOW */}
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: GHOST, marginBottom: 3 }}>Now</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.3 }}>{fc.nowLabel}</div>
                          <div style={{ fontSize: 10, color: SMOKE, marginTop: 2 }}>{fc.nowDetail}</div>
                        </div>

                        {/* NEXT + AFTER */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                          <div>
                            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: GHOST, marginBottom: 3 }}>Next</div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: WARM, lineHeight: 1.3 }}>{fc.nextLabel}</div>
                            {fc.nextDate && <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT.green, marginTop: 2 }}>{fc.nextDate}</div>}
                          </div>
                          <div>
                            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: GHOST, marginBottom: 3 }}>After</div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: WARM, lineHeight: 1.3 }}>{fc.afterLabel}</div>
                            {fc.afterDate && <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT.green, marginTop: 2 }}>{fc.afterDate}</div>}
                          </div>
                        </div>

                        {/* WHY IT MATTERS */}
                        <div style={{
                          padding: '10px 12px', borderRadius: 6,
                          background: 'rgba(45,106,79,0.04)', borderLeft: `3px solid ${ACCENT.green}`,
                          fontSize: 11, fontWeight: 400, color: WARM, lineHeight: 1.5,
                          fontFamily: 'Inter, system-ui, sans-serif',
                        }}>
                          {fc.editorialWhyItMatters}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* ═══════ ALL OTHER ACTIVE CAMPAIGNS (smaller cards) ═══════ */}
            {remaining.length > 0 && (
              <section className="pb-fade" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 48px' }}>
                {priority.length > 0 && <div style={{ height: 1, background: BONE, marginBottom: 40 }} />}
                {priority.length === 0 && <div style={{ height: 1, background: BONE, marginBottom: 40 }} />}

                <div style={{ marginBottom: 20 }}>
                  <div style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.22em',
                    textTransform: 'uppercase' as const, color: GHOST,
                  }}>
                    {priority.length > 0 ? 'Other Active Campaigns' : 'Active Campaigns'}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                  {remaining.map(fc => (
                    <a
                      key={fc.channel.slug}
                      href={fc.channelUrl ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pb-campaign-card pb-link"
                      style={{
                        display: 'block', borderRadius: 8, overflow: 'hidden',
                        background: WHITE, border: `1px solid ${BONE}`, textDecoration: 'none',
                      }}
                    >
                      <div style={{ position: 'relative', overflow: 'hidden', height: 100 }}>
                        <img src={fc.heroImage} alt="" loading="lazy" className="pb-hero-img"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 20%, rgba(0,0,0,0.6) 100%)' }} />
                        <div style={{ position: 'absolute', bottom: 8, left: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {fc.channel.thumbnail && (
                            <img src={fc.channel.thumbnail} alt="" style={{
                              width: 20, height: 20, borderRadius: '50%', objectFit: 'cover',
                              border: '2px solid rgba(255,255,255,0.3)',
                            }} />
                          )}
                          <span style={{ fontSize: 10, fontWeight: 800, color: WHITE, letterSpacing: '0.03em', textTransform: 'uppercase' as const, textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
                            {fc.channel.name}
                          </span>
                        </div>
                      </div>
                      <div style={{ padding: '10px 14px 12px' }}>
                        <FormatTags videos={fc.recentVideos} />
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: GHOST, marginBottom: 2 }}>Now</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: INK, lineHeight: 1.3 }}>{fc.nowLabel}</div>
                          <div style={{ fontSize: 9, color: SMOKE, marginTop: 1 }}>{fc.nowDetail}</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: GHOST, marginBottom: 2 }}>Next</div>
                            <div style={{ fontSize: 10, fontWeight: 500, color: WARM, lineHeight: 1.25 }}>{fc.nextLabel}</div>
                            {fc.nextDate && <div style={{ fontSize: 9, fontWeight: 700, color: ACCENT.green, marginTop: 1 }}>{fc.nextDate}</div>}
                          </div>
                          <div>
                            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: GHOST, marginBottom: 2 }}>After</div>
                            <div style={{ fontSize: 10, fontWeight: 500, color: WARM, lineHeight: 1.25 }}>{fc.afterLabel}</div>
                            {fc.afterDate && <div style={{ fontSize: 9, fontWeight: 700, color: ACCENT.green, marginTop: 1 }}>{fc.afterDate}</div>}
                          </div>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </>
        );
      })()}


      {/* ═══════ MOMENTS WE'RE WATCHING — Real content, real views ═══════ */}
      {data.momentsWatching && data.momentsWatching.length > 0 && (
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 48px' }}>
          <div style={{ height: 1, background: BONE, marginBottom: 40 }} />

          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.22em',
              textTransform: 'uppercase' as const, color: GHOST, marginBottom: 10,
            }}>
              Moments We&apos;re Watching
            </div>
            <p style={{
              fontSize: 15, fontWeight: 400, color: SMOKE, lineHeight: 1.5,
              maxWidth: 500, margin: 0,
              fontFamily: 'Inter, system-ui, sans-serif',
            }}>
              The content driving attention across priority campaigns this week.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {data.momentsWatching.map(m => (
              <a
                key={m.id}
                href={m.durationSec <= 62
                  ? `https://www.youtube.com/shorts/${m.id}`
                  : `https://www.youtube.com/watch?v=${m.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="pb-campaign-card pb-link"
                style={{
                  display: 'block', borderRadius: 8, overflow: 'hidden',
                  background: WHITE, border: `1px solid ${BONE}`, textDecoration: 'none',
                }}
              >
                <div style={{ position: 'relative', overflow: 'hidden', height: 160 }}>
                  <img src={m.thumbnail} alt="" loading="lazy" className="pb-hero-img"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 30%, rgba(0,0,0,0.6) 100%)' }} />
                  <div style={{ position: 'absolute', bottom: 10, left: 12, right: 12 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.04em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
                      {m.artistName}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: WHITE, lineHeight: 1.25, textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                      {m.title}
                    </div>
                  </div>
                  <div style={{ position: 'absolute', top: 10, right: 10 }}>
                    <PlayOverlay size={28} />
                  </div>
                </div>
                <div style={{ padding: '10px 12px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>
                    {fmtNum(m.viewCount)} views
                  </span>
                  {m.context && (
                    <span style={{ fontSize: 10, color: SMOKE, fontStyle: 'italic' }}>
                      {m.context}
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}


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
