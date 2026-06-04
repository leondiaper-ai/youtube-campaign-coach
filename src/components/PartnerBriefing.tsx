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
  standoutVideo: BriefingVideo | null;
  tier: 1 | 2 | 3;
  contentFormats: string[];
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

// ── Campaign status (strongest signal on the page) ───────────────────────
// One immediate, high-visibility label per campaign, derived from existing data.
type CampaignStatus = { label: string; color: string };
const ST_RELEASE_WEEK: CampaignStatus = { label: 'Release Week', color: '#C0392B' }; // 🔴
const ST_NEXT_RELEASE: CampaignStatus = { label: 'Next Release', color: '#2D6A4F' }; // 🟢
const ST_BUILDING:     CampaignStatus = { label: 'Building',     color: '#9A6324' }; // 🟡
const ST_ACTIVE:       CampaignStatus = { label: 'Active',       color: '#1A56B8' }; // 🔵
const ST_MONITORING:   CampaignStatus = { label: 'Monitoring',   color: '#8A847A' }; // ⚪

const RELEASE_RE = /release|album|single|drop|official\s*video|visuali|lyric|\bep\b|mixtape|deluxe|premiere/i;

/** Parse a "12 Jun" style label into days-from-now (assumes nearest occurrence). */
function daysUntilLabel(d: string | null): number | null {
  if (!d) return null;
  const m = d.match(/(\d{1,2})\s+([A-Za-z]{3})/);
  if (!m) return null;
  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const mon = months.indexOf(m[2].toLowerCase());
  if (mon < 0) return null;
  const day = parseInt(m[1], 10);
  const now = new Date();
  let dt = new Date(now.getFullYear(), mon, day);
  const diff = Math.round((dt.getTime() - now.getTime()) / 86400000);
  if (diff < -120) dt = new Date(now.getFullYear() + 1, mon, day); // wrapped into next year
  return Math.round((dt.getTime() - Date.now()) / 86400000);
}

function deriveStatus(fc: FocusCampaign): CampaignStatus {
  const du = daysUntilLabel(fc.nextDate);
  const isRelease = RELEASE_RE.test(fc.nextLabel || '') || RELEASE_RE.test(fc.afterLabel || '');
  if (du != null && du >= -3 && du <= 10 && isRelease) return ST_RELEASE_WEEK;
  if (du != null && du >= -3 && du <= 45 && isRelease) return ST_NEXT_RELEASE;
  const ph = fc.channel.phase;
  if (ph === 'PRE' || ph === 'HOLD' || ph === 'START') return ST_BUILDING;
  const active = ph === 'PUSH' || ph === 'RELEASE' || ph === 'PEAK' || ph === 'SUSTAIN'
    || fc.channel.classification === 'GROWING' || fc.channel.uploads30d >= 5;
  if (active) return ST_ACTIVE;
  if (fc.channel.uploads30d >= 1) return ST_BUILDING;
  return ST_MONITORING;
}

function StatusChip({ status, big = false }: { status: CampaignStatus; big?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: big ? 7 : 5,
      padding: big ? '6px 13px' : '3px 9px', borderRadius: 20,
      background: status.color, color: WHITE,
      fontSize: big ? 11 : 9, fontWeight: 800,
      letterSpacing: '0.1em', textTransform: 'uppercase' as const,
      boxShadow: '0 1px 4px rgba(0,0,0,0.18)', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: big ? 7 : 6, height: big ? 7 : 6, borderRadius: '50%', background: 'rgba(255,255,255,0.95)' }} />
      {status.label}
    </span>
  );
}

// ── Genre tags (programming area at a glance) ─────────────────────────────
const GENRE_BY_ARTIST: Record<string, string> = {
  'k-trap': 'UK Rap', 'french the kid': 'Rap', 'mary in the junkyard': 'Indie',
  'tove lo': 'Electronic Pop', 'peter gabriel': 'Legacy / Rock', 'the snuts': 'Indie Rock',
  'anna lille': 'Pop', 'jamie webster': 'Indie / Folk', 'gener8ion': 'Electronic',
  'antony szmierek': 'Alt / Spoken Word', 'kurupt fm': 'UK Garage', 'man woman chainsaw': 'Indie / Post-Punk',
  'jjerome87': 'Rap', 'ezra collective': 'Jazz', 'tom odell': 'Pop', 'bad omens': 'Rock / Metal',
  'james blake': 'Electronic', 'tove lo music': 'Electronic Pop',
};
function genreFor(name: string): string | null {
  return GENRE_BY_ARTIST[name.trim().toLowerCase()] ?? null;
}

function GenreTag({ genre, onDark = false }: { genre: string; onDark?: boolean }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
      background: onDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.04)',
      color: onDark ? 'rgba(255,255,255,0.95)' : SMOKE,
      border: onDark ? 'none' : `1px solid ${BONE}`, whiteSpace: 'nowrap',
    }}>
      {genre}
    </span>
  );
}

// ── Ecosystem strip (is there an active content ecosystem? answer in 2s) ──
function EcosystemStrip({ fc, compact = false }: { fc: FocusCampaign; compact?: boolean }) {
  const f = new Set(fc.contentFormats);
  const items: { label: string; on: boolean; count?: number }[] = [
    { label: 'Official Video', on: f.has('Official Video') },
    { label: 'Shorts', on: fc.channel.shorts30d > 0, count: fc.channel.shorts30d },
    { label: 'BTS', on: f.has('BTS') },
    { label: 'Live', on: f.has('Live Session') },
  ];
  return (
    <div>
      {!compact && (
        <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: GHOST, marginBottom: 7 }}>
          Content Ecosystem
        </div>
      )}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: compact ? 10 : 14,
        padding: compact ? 0 : '10px 14px', borderRadius: 8,
        background: compact ? 'transparent' : PAPER, border: compact ? 'none' : `1px solid ${BONE}`,
      }}>
        {items.map((it) => (
          <span key={it.label} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: compact ? 10 : 12, fontWeight: 700,
            color: it.on ? INK : GHOST,
          }}>
            <span style={{ color: it.on ? ACCENT.green : GHOST, fontWeight: 900, fontSize: compact ? 11 : 13 }}>{it.on ? '✓' : '✗'}</span>
            {it.label}{it.on && it.count ? <span style={{ color: ACCENT.green, fontWeight: 900 }}>&nbsp;{it.count}</span> : ''}
          </span>
        ))}
      </div>
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

        /* ── Mobile responsive ────────────────────────────── */
        @media (max-width: 768px) {
          .pb-section { padding-left: 16px !important; padding-right: 16px !important; }
          .pb-hero-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
          .pb-hero-title { font-size: 42px !important; }
          .pb-shorts-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .pb-featured-card { grid-template-columns: 1fr !important; }
          .pb-featured-card .pb-featured-hero { min-height: 180px !important; height: 180px !important; }
          .pb-tier2-grid { grid-template-columns: 1fr !important; }
          .pb-tier3-grid { grid-template-columns: 1fr 1fr !important; }
          .pb-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .pb-moments-grid { grid-template-columns: 1fr 1fr !important; }
          .pb-radar-big { padding: 16px !important; }
          .pb-radar-big-items { flex-direction: column !important; }
          .pb-radar-row { grid-template-columns: 60px 1fr !important; }
          .pb-top-bar { padding: 16px !important; }
          .pb-nav-wrap { padding: 0 16px !important; }
          .pb-vid-grid { grid-template-columns: 1fr 1fr !important; }
          .pb-obs-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          .pb-campaign-card:hover { transform: none; box-shadow: none; }
        }
        @media (max-width: 480px) {
          .pb-hero-title { font-size: 34px !important; }
          .pb-shorts-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .pb-tier3-grid { grid-template-columns: 1fr !important; }
          .pb-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .pb-vid-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>


      {/* ═══════ TOP BAR ═══════ */}
      <div className="pb-top-bar" style={{
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
        <div className="pb-nav-wrap" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px' }}>
          <PulseNav />
        </div>
      )}

      {/* ═══════ HERO SECTION ═══════ */}
      <header className="pb-fade pb-section" style={{
        maxWidth: 1200, margin: '0 auto', padding: '36px 40px 48px',
      }}>
        <div className="pb-hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 440px', gap: 48, alignItems: 'start' }}>
          {/* Left — Title + intro */}
          <div>
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.25em',
              textTransform: 'uppercase' as const, color: GHOST, marginBottom: 16,
            }}>
              Virgin Music x YouTube
            </div>
            <h1 className="pb-hero-title" style={{
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
            <div className="pb-shorts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
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


      {/* ═══════ RELEASE RADAR — Chronological timeline ═══════ */}
      {hasDateMoments && (() => {
        // Merge all dated moments, sort chronologically, group by date
        const allMoments = [
          ...grouped.thisWeek,
          ...grouped.nextTwoWeeks,
          ...grouped.nextMonth,
        ].filter(m => m.date).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

        // Group by date
        const dateGroups = new Map<string, UpcomingMoment[]>();
        for (const m of allMoments) {
          const key = m.date!;
          const arr = dateGroups.get(key) ?? [];
          arr.push(m);
          dateGroups.set(key, arr);
        }
        const groups = Array.from(dateGroups.entries());

        // Find the "big week" — date with most convergence (3+ campaigns)
        const bigDay = groups.find(([, ms]) => ms.length >= 3);
        // Also find dates with 2 campaigns for secondary emphasis
        const hotDates = new Set(groups.filter(([, ms]) => ms.length >= 2).map(([d]) => d));

        // Priority tier for visual weight
        const isTier1 = (m: UpcomingMoment) => m.priority >= 80;
        const nowMs = Date.now();

        return (
          <section className="pb-fade pb-section" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 56px' }}>
            <div style={{ height: 1, background: BONE, marginBottom: 40 }} />

            <div style={{ marginBottom: 28 }}>
              <div style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '0.25em',
                textTransform: 'uppercase' as const, color: GHOST, marginBottom: 12,
              }}>
                Release Radar
              </div>
              <p style={{
                fontSize: 18, fontWeight: 500, color: WARM, lineHeight: 1.5,
                maxWidth: 620, margin: 0,
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontStyle: 'italic',
              }}>
                What&apos;s coming next — the key release moments and campaign activity across the roster.
              </p>
            </div>

            {/* ── BIG WEEK callout (when 3+ campaigns on same date) ── */}
            {bigDay && (
              <div className="pb-radar-big" style={{
                background: INK, borderRadius: 10, padding: '20px 24px',
                marginBottom: 24, color: WHITE,
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
                  <span style={{
                    fontSize: 24, fontWeight: 900, lineHeight: 1,
                    fontFamily: "Georgia, 'Times New Roman', serif",
                  }}>
                    {new Date(bigDay[0] + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.4)' }}>
                    Major Release Day
                  </span>
                </div>
                <div className="pb-radar-big-items" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {bigDay[1].map((m, i) => (
                    <div key={i} style={{
                      background: 'rgba(255,255,255,0.08)', borderRadius: 6,
                      padding: '8px 14px', flex: '1 1 200px',
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.5)', marginBottom: 3 }}>
                        {m.artist}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: WHITE, lineHeight: 1.3 }}>
                        {m.moment}
                      </div>
                      <span style={{
                        display: 'inline-block', marginTop: 4,
                        padding: '2px 7px', borderRadius: 8,
                        fontSize: 8, fontWeight: 700,
                        background: isTier1(m) ? 'rgba(45,106,79,0.3)' : 'rgba(255,255,255,0.08)',
                        color: isTier1(m) ? '#7DDFB0' : 'rgba(255,255,255,0.4)',
                      }}>
                        {m.eventType}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Timeline ── */}
            <div style={{ position: 'relative', paddingLeft: 24 }}>
              {/* Vertical line */}
              <div style={{
                position: 'absolute', left: 5, top: 4, bottom: 4, width: 2,
                background: `linear-gradient(${BONE}, ${BONE} 60%, transparent)`,
              }} />

              {groups.map(([dateStr, moments], gi) => {
                const dateObj = new Date(dateStr + 'T00:00:00');
                const diffDays = Math.round((dateObj.getTime() - nowMs) / 86400000);
                const isPast = diffDays < 0;
                const isHot = hotDates.has(dateStr);
                const isBigDay = bigDay && bigDay[0] === dateStr;
                const fmtDate = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();

                // Skip if it's the big day (already shown above)
                if (isBigDay) return null;

                return (
                  <div key={dateStr} style={{
                    display: 'flex', gap: 16, marginBottom: 16,
                    opacity: isPast ? 0.45 : 1,
                  }}>
                    {/* Date dot */}
                    <div style={{
                      position: 'absolute', left: 0,
                      width: 12, height: 12, borderRadius: '50%',
                      background: isHot ? ACCENT.green : isPast ? GHOST : BONE,
                      border: `2px solid ${isHot ? ACCENT.green : BONE}`,
                      marginTop: 4,
                    }} />

                    {/* Date label */}
                    <div style={{ width: 70, flexShrink: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 800, color: isHot ? ACCENT.green : INK,
                        letterSpacing: '0.02em',
                      }}>
                        {fmtDate}
                      </div>
                      {diffDays >= 0 && diffDays <= 7 && (
                        <div style={{ fontSize: 9, color: SMOKE, marginTop: 1 }}>
                          {diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : `In ${diffDays}d`}
                        </div>
                      )}
                    </div>

                    {/* Moments for this date */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {moments.map((m, mi) => (
                        <div key={mi} style={{
                          display: 'flex', alignItems: 'baseline', gap: 8,
                          padding: isTier1(m) ? '6px 10px' : '3px 0',
                          background: isTier1(m) ? 'rgba(45,106,79,0.04)' : 'transparent',
                          borderRadius: isTier1(m) ? 6 : 0,
                          borderLeft: isTier1(m) ? `3px solid ${ACCENT.green}` : 'none',
                        }}>
                          <span style={{
                            fontSize: 10, fontWeight: 800, color: INK,
                            letterSpacing: '0.02em', textTransform: 'uppercase' as const,
                            whiteSpace: 'nowrap',
                          }}>
                            {m.artist}
                          </span>
                          <span style={{
                            fontSize: 12, fontWeight: isTier1(m) ? 600 : 400,
                            color: isTier1(m) ? INK : WARM,
                            lineHeight: 1.3,
                          }}>
                            {m.moment}
                          </span>
                          <span style={{
                            display: 'inline-block', padding: '1px 6px', borderRadius: 8,
                            fontSize: 7, fontWeight: 700, flexShrink: 0,
                            background: isTier1(m) ? 'rgba(45,106,79,0.08)' : `${BONE}`,
                            color: isTier1(m) ? ACCENT.green : SMOKE,
                          }}>
                            {m.eventType}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}


      {/* ═══════ CAMPAIGNS — 3-Tier Hierarchy ═══════ */}
      {(() => {
        const tier1 = data.focusCampaigns.filter(fc => fc.tier === 1);
        const tier2 = data.focusCampaigns.filter(fc => fc.tier === 2);
        const tier3 = data.focusCampaigns.filter(fc => fc.tier === 3);

        return (
          <>
            {/* ── TIER 1: Featured Campaigns (large editorial cards) ── */}
            {tier1.length > 0 && (
              <section className="pb-fade pb-section" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 48px' }}>
                <div style={{ height: 2, background: INK, marginBottom: 18 }} />
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: GHOST, marginBottom: 6 }}>
                    Priority
                  </div>
                  <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em', color: INK, fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: 'italic' }}>
                    Featured Campaigns
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {tier1.map(fc => {
                    const topVids = fc.recentVideos.slice(0, 3);
                    const status = deriveStatus(fc);
                    const genre = genreFor(fc.channel.name);
                    return (
                      <div key={fc.channel.slug} className="pb-campaign-card" style={{
                        borderRadius: 12, overflow: 'hidden', background: WHITE,
                        border: `1px solid ${BONE}`,
                      }}>
                        {/* ── Hero image with artist overlay ── */}
                        <a href={fc.channelUrl ?? '#'} target="_blank" rel="noopener noreferrer" className="pb-link"
                          style={{ display: 'block', position: 'relative', overflow: 'hidden', height: 220 }}>
                          <img src={fc.heroImage} alt="" loading="lazy" className="pb-hero-img"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 25%, rgba(0,0,0,0.72) 100%)' }} />
                          {/* Status — strongest signal, top-right */}
                          <div style={{ position: 'absolute', top: 14, right: 16 }}>
                            <StatusChip status={status} big />
                          </div>
                          {/* Artist → genre, bottom-left, enlarged */}
                          <div style={{ position: 'absolute', bottom: 16, left: 18, right: 18, display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                            {fc.channel.thumbnail && <img src={fc.channel.thumbnail} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.35)', flexShrink: 0 }} />}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 26, fontWeight: 900, color: WHITE, letterSpacing: '-0.01em', lineHeight: 1.05, textShadow: '0 1px 6px rgba(0,0,0,0.45)' }}>{fc.channel.name}</div>
                              {genre && <div style={{ marginTop: 6 }}><GenreTag genre={genre} onDark /></div>}
                            </div>
                          </div>
                        </a>

                        {/* ── Card body ── */}
                        <div style={{ padding: '18px 20px 20px' }}>

                          {/* ── NEXT / AFTER dates — front and centre ── */}
                          <div style={{
                            display: 'grid', gridTemplateColumns: fc.afterDate ? '1fr 1fr' : '1fr', gap: 12,
                            padding: '12px 14px', borderRadius: 8,
                            background: 'rgba(45,106,79,0.04)', borderLeft: `3px solid ${ACCENT.green}`,
                            marginBottom: 16,
                          }}>
                            <div>
                              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: ACCENT.green, marginBottom: 4 }}>Next Release</div>
                              <div style={{ fontSize: 17, fontWeight: 700, color: INK, lineHeight: 1.25 }}>{fc.nextLabel}</div>
                              {fc.nextDate && <div style={{ fontSize: 22, fontWeight: 900, color: ACCENT.green, marginTop: 4, letterSpacing: '-0.01em' }}>{fc.nextDate}</div>}
                            </div>
                            {fc.afterDate && (
                              <div>
                                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: SMOKE, marginBottom: 4 }}>After</div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: WARM, lineHeight: 1.25 }}>{fc.afterLabel}</div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: ACCENT.green, marginTop: 4 }}>{fc.afterDate}</div>
                              </div>
                            )}
                          </div>

                          {/* ── Content ecosystem (is the ecosystem active?) ── */}
                          <div style={{ marginBottom: 14 }}>
                            <EcosystemStrip fc={fc} />
                          </div>

                          {/* ── Stats grid (Spotlight-style) ── */}
                          <div className="pb-stats-grid" style={{
                            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
                            padding: '10px 12px', borderRadius: 8, background: PAPER, marginBottom: 14,
                          }}>
                            <div>
                              <div style={{ fontSize: 16, fontWeight: 800, color: INK }}>{fc.channel.subs != null ? fmtNum(fc.channel.subs) : '—'}</div>
                              <div style={{ fontSize: 8, color: SMOKE }}>Subs</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 16, fontWeight: 800, color: fc.channel.views7d && fc.channel.views7d > 0 ? INK : SMOKE }}>{fc.channel.views7d != null ? fmtNum(fc.channel.views7d) : '—'}</div>
                              <div style={{ fontSize: 8, color: SMOKE }}>Views (7d)</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 16, fontWeight: 800, color: fc.channel.uploads30d >= 6 ? ACCENT.green : INK }}>{fc.channel.uploads30d}</div>
                              <div style={{ fontSize: 8, color: SMOKE }}>Uploads (30d)</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 16, fontWeight: 800, color: (fc.channel.subs7d ?? 0) > 0 ? ACCENT.green : SMOKE }}>
                                {fc.channel.subs7d != null && fc.channel.subs7d !== 0 ? `${fc.channel.subs7d > 0 ? '+' : ''}${fmtNum(fc.channel.subs7d)}` : '—'}
                              </div>
                              <div style={{ fontSize: 8, color: SMOKE }}>Subs (7d)</div>
                            </div>
                          </div>

                          {/* ── Why This Is A Top Project — evidence only ── */}
                          {(() => {
                            const bullets: string[] = [];
                            // Scale signal
                            if (fc.standoutVideo && fc.standoutVideo.viewCount >= 10000) {
                              const t = fc.standoutVideo.title.length > 45 ? fc.standoutVideo.title.slice(0, 42) + '...' : fc.standoutVideo.title;
                              bullets.push(`${t} has reached ${fmtNum(fc.standoutVideo.viewCount)} views`);
                            }
                            // Current signal
                            if (fc.recentVideos[0] && fc.recentVideos[0].daysAgo <= 14 && fc.recentVideos[0].id !== fc.standoutVideo?.id) {
                              bullets.push(`${fc.nowLabel.length > 40 ? fc.nowLabel.slice(0, 37) + '...' : fc.nowLabel} added ${fmtNum(fc.recentVideos[0].viewCount)} views in ${fc.recentVideos[0].daysAgo} days`);
                            } else if (fc.channel.uploads30d >= 6) {
                              bullets.push(`${fc.channel.uploads30d} uploads in the last 30 days`);
                            }
                            // Upcoming signal
                            if (fc.nextDate && fc.nextLabel) {
                              bullets.push(`${fc.nextLabel.length > 35 ? fc.nextLabel.slice(0, 32) + '...' : fc.nextLabel} lands ${fc.nextDate}`);
                            }
                            // Ecosystem signal
                            const fmts = fc.contentFormats ?? [];
                            if (fmts.length >= 3) {
                              bullets.push(`${fmts.slice(0, 4).join(' + ')} active`);
                            } else if (fmts.length >= 1) {
                              bullets.push(`${fmts.join(' + ')} active across rollout`);
                            }
                            if (bullets.length === 0) return null;
                            return (
                              <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 8, background: 'rgba(45,106,79,0.04)', borderLeft: `3px solid ${ACCENT.green}` }}>
                                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: ACCENT.green, marginBottom: 7 }}>
                                  Why This Matters
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                  {bullets.slice(0, 3).map((b, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'start', gap: 7, fontSize: 12, lineHeight: 1.4 }}>
                                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: ACCENT.green, marginTop: 5, flexShrink: 0 }} />
                                      <span style={{ color: WARM }}>{b}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}

                          {/* ── Recent uploads (thumbnail grid, Spotlight-style) ── */}
                          {topVids.length > 0 && (
                            <div>
                              <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: GHOST, marginBottom: 8 }}>Recent Uploads</div>
                              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(topVids.length, 3)}, 1fr)`, gap: 8 }}>
                                {topVids.map(v => (
                                  <a key={v.id} href={ytUrl(v.id, v.durationSec)} target="_blank" rel="noopener noreferrer" className="pb-link shorts-cell" style={{ display: 'block', textDecoration: 'none' }}>
                                    <div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden' }}>
                                      <img src={v.thumbnail} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 50%, rgba(0,0,0,0.5) 100%)' }} />
                                      <span style={{
                                        position: 'absolute', top: 4, left: 4,
                                        padding: '2px 6px', borderRadius: 4,
                                        fontSize: 7, fontWeight: 700, textTransform: 'uppercase' as const,
                                        background: v.durationSec <= 62 ? 'rgba(107,33,168,0.85)' : 'rgba(26,86,184,0.85)',
                                        color: WHITE,
                                      }}>
                                        {v.durationSec <= 62 ? 'Short' : v.format}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: INK, marginTop: 4, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {v.title}
                                    </div>
                                    <div style={{ fontSize: 9, color: SMOKE, marginTop: 1 }}>
                                      {fmtNum(v.viewCount)} views · {v.daysAgo}d ago
                                    </div>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── TIER 2: Active campaign cards (richer than grid) ── */}
            {tier2.length > 0 && (
              <section className="pb-fade pb-section" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 48px' }}>
                <div style={{ height: 1, background: BONE, marginBottom: 22 }} />
                <div style={{ marginBottom: 22 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: GHOST, marginBottom: 5 }}>
                    In Rotation
                  </div>
                  <div style={{ fontSize: 23, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.01em', color: INK, fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: 'italic' }}>
                    Active Campaigns
                  </div>
                </div>
                <div className="pb-tier2-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                  {tier2.map(fc => {
                    const status = deriveStatus(fc);
                    const genre = genreFor(fc.channel.name);
                    return (
                    <a key={fc.channel.slug} href={fc.channelUrl ?? '#'} target="_blank" rel="noopener noreferrer"
                      className="pb-campaign-card pb-link"
                      style={{ display: 'block', borderRadius: 8, overflow: 'hidden', background: WHITE, border: `1px solid ${BONE}`, textDecoration: 'none' }}>
                      <div style={{ position: 'relative', overflow: 'hidden', height: 130 }}>
                        <img src={fc.heroImage} alt="" loading="lazy" className="pb-hero-img" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 20%, rgba(0,0,0,0.66) 100%)' }} />
                        {/* Status — top-left, strong signal */}
                        <div style={{ position: 'absolute', top: 10, left: 12 }}>
                          <StatusChip status={status} />
                        </div>
                        <div style={{ position: 'absolute', bottom: 10, left: 12, right: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                          {fc.channel.thumbnail && <img src={fc.channel.thumbnail} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0 }} />}
                          <span style={{ fontSize: 16, fontWeight: 900, color: WHITE, letterSpacing: '-0.01em', textShadow: '0 1px 3px rgba(0,0,0,0.45)' }}>{fc.channel.name}</span>
                          {genre && <span style={{ marginLeft: 'auto' }}><GenreTag genre={genre} onDark /></span>}
                        </div>
                        {/* Next date badge on hero */}
                        {fc.nextDate && (
                          <div style={{ position: 'absolute', top: 10, right: 10, padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)' }}>
                            <div style={{ fontSize: 7, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: SMOKE }}>Next</div>
                            <div style={{ fontSize: 12, fontWeight: 900, color: ACCENT.green }}>{fc.nextDate}</div>
                          </div>
                        )}
                      </div>
                      <div style={{ padding: '12px 14px 14px' }}>
                        <div style={{ marginBottom: 10 }}><EcosystemStrip fc={fc} compact /></div>
                        {/* CURRENT */}
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: GHOST, marginBottom: 2 }}>Current</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.3 }}>{fc.nowLabel}</div>
                          <div style={{ fontSize: 10, color: SMOKE, marginTop: 2 }}>{fc.nowDetail}</div>
                        </div>
                        {/* NEXT + AFTER */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: GHOST, marginBottom: 2 }}>Next</div>
                            <div style={{ fontSize: 11, fontWeight: 500, color: WARM, lineHeight: 1.3 }}>{fc.nextLabel}</div>
                            {fc.nextDate && <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT.green, marginTop: 2 }}>{fc.nextDate}</div>}
                          </div>
                          <div>
                            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: GHOST, marginBottom: 2 }}>After</div>
                            <div style={{ fontSize: 11, fontWeight: 500, color: WARM, lineHeight: 1.3 }}>{fc.afterLabel}</div>
                            {fc.afterDate && <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT.green, marginTop: 2 }}>{fc.afterDate}</div>}
                          </div>
                        </div>
                        <div style={{ fontSize: 9, color: SMOKE }}>{fc.channel.uploads30d} uploads in 30d{fc.channel.subs != null && <> · {fmtNum(fc.channel.subs)} subs</>}</div>
                      </div>
                    </a>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── TIER 3: Grid view ── */}
            {tier3.length > 0 && (
              <section className="pb-fade pb-section" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 48px' }}>
                <div style={{ height: 1, background: BONE, marginBottom: 22 }} />
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' as const, color: WARM }}>
                    Other Campaigns
                  </div>
                </div>
                <div className="pb-tier3-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {tier3.map(fc => {
                    const status = deriveStatus(fc);
                    const genre = genreFor(fc.channel.name);
                    return (
                    <a key={fc.channel.slug} href={fc.channelUrl ?? '#'} target="_blank" rel="noopener noreferrer"
                      className="pb-campaign-card pb-link"
                      style={{ display: 'block', borderRadius: 8, overflow: 'hidden', background: WHITE, border: `1px solid ${BONE}`, textDecoration: 'none' }}>
                      <div style={{ position: 'relative', overflow: 'hidden', height: 80 }}>
                        <img src={fc.heroImage} alt="" loading="lazy" className="pb-hero-img" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 20%, rgba(0,0,0,0.6) 100%)' }} />
                        {/* Status dot — small but present */}
                        <div style={{ position: 'absolute', top: 7, right: 8, display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 10, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.color }} />
                          <span style={{ fontSize: 7, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: WHITE }}>{status.label}</span>
                        </div>
                        <div style={{ position: 'absolute', bottom: 6, left: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                          {fc.channel.thumbnail && <img src={fc.channel.thumbnail} alt="" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.3)' }} />}
                          <span style={{ fontSize: 11, fontWeight: 800, color: WHITE, letterSpacing: '0.02em', textShadow: '0 1px 2px rgba(0,0,0,0.45)' }}>{fc.channel.name}</span>
                        </div>
                      </div>
                      <div style={{ padding: '8px 10px 10px' }}>
                        {genre && <div style={{ marginBottom: 5 }}><GenreTag genre={genre} /></div>}
                        <div style={{ fontSize: 11, fontWeight: 600, color: INK, lineHeight: 1.25, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {fc.nowLabel}
                        </div>
                        <div style={{ fontSize: 9, color: SMOKE }}>{fc.nowDetail}</div>
                        {fc.nextDate && (
                          <div style={{ fontSize: 9, color: ACCENT.green, fontWeight: 700, marginTop: 4 }}>
                            Next: {fc.nextDate}
                          </div>
                        )}
                      </div>
                    </a>
                    );
                  })}
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

          <div className="pb-moments-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
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
      <footer className="pb-section" style={{
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
