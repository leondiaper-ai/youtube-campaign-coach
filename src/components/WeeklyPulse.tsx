'use client';

import { useState, useEffect, useRef } from 'react';

// ── Design System ────────────────────────────────────────────────────────────

const INK    = '#0E0E0E';
const PAPER  = '#FAF7F2';
const SMOKE  = '#8A847A';
const GHOST  = '#C8C2B8';
const BONE   = '#E8E3DA';
const WHITE  = '#FFFFFF';
const WARM   = '#4A4640';
const YT_RED = '#FF0000';

const ACCENT = {
  green:  '#2D6A4F',
  amber:  '#9A6324',
  ochre:  '#7A6520',
  ember:  '#8A3A2A',
};

// ── Types ────────────────────────────────────────────────────────────────────

type PulseChannel = {
  slug: string; name: string; isVirgin: boolean; channelHandle: string | null;
  subs: number | null; totalViews: number | null; views7d: number | null; subs7d: number | null;
  viewsWoW: number | null; subsWoW: number | null;
  uploads30d: number; shorts30d: number; longform30d: number;
  lastUploadAt: string | null; lastUploadDaysAgo: number | null; thumbnail: string | null;
  phase: string; campaign: string | null; campaignStartDate: string | null;
  status: string; classification: string; reason: string; nextAction: string;
  watcherRead: string; cadenceLabel: string; subsPer1kViews: number | null;
};

type PulseVideo = {
  id: string; title: string; channelName: string; artistSlug: string;
  viewCount: number; likeCount: number; commentCount: number;
  publishedAt: string; durationSec: number; format: string;
  thumbnail: string; velocity: number; daysAgo: number;
};

type Playbook = { title: string; why: string; when: string; actions: string[] };

type PulseData = {
  weekRange: string; generatedAt: string; lastSyncAt: string | null;
  signals: { growing: number; weakConversion: number; underfed: number; cold: number; totalManaged: number; totalMarket: number; total: number };
  managedChannels: PulseChannel[]; marketChannels: PulseChannel[];
  topVideos: PulseVideo[]; topShorts: PulseVideo[];
  rollups: unknown[]; editorial: string; insights: string[];
  playbook: Playbook; marketInsights: string[];
};

// ── Utilities ─────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K';
  return String(n);
}

function timeAgo(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1) return 'today';
  if (d < 2) return 'yesterday';
  if (d < 7) return `${Math.floor(d)}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

function ytUrl(id: string, dur: number): string {
  return dur <= 62 ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`;
}

// ── SVG Logos ─────────────────────────────────────────────────────────────────

function VirginLogo({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.35} viewBox="0 0 200 70" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="54" fill={INK} fontSize="58" fontWeight="900" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" letterSpacing="-0.02em">
        Virgin
      </text>
    </svg>
  );
}

function VirginScriptLogo({ width = 160 }: { width?: number }) {
  // Script-style "Virgin Music" wordmark
  const h = width * 0.38;
  return (
    <svg width={width} height={h} viewBox="0 0 320 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="68" fill={INK} fontSize="62" fontWeight="900" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" letterSpacing="-0.02em">
        Virgin
      </text>
      <text x="0" y="108" fill={INK} fontSize="38" fontWeight="700" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" letterSpacing="0.02em">
        Music
      </text>
    </svg>
  );
}

function YouTubeLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size * 2.8} height={size} viewBox="0 0 90 32" xmlns="http://www.w3.org/2000/svg">
      {/* Play button icon */}
      <rect x="0" y="4" width="28" height="20" rx="5" fill={YT_RED} />
      <polygon points="11,9 11,19 21,14" fill={WHITE} />
      {/* YouTube text */}
      <text x="34" y="21" fill={INK} fontSize="16" fontWeight="800" fontFamily="Inter, system-ui, sans-serif" letterSpacing="0.01em">
        YouTube
      </text>
    </svg>
  );
}

// ── Play Icon Overlay ────────────────────────────────────────────────────────

function PlayIcon({ size = 32 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'rgba(0,0,0,0.65)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width={size * 0.4} height={size * 0.4} viewBox="0 0 12 14" fill="none">
        <polygon points="0,0 12,7 0,14" fill={WHITE} />
      </svg>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WeeklyPulse() {
  const [data, setData] = useState<PulseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'internal' | 'partner'>('internal');
  const [screenshotMode, setScreenshotMode] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [slackCopied, setSlackCopied] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/weekly-pulse')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  // Loading
  if (loading) return (
    <main style={{ background: PAPER, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: GHOST }}>
          Preparing briefing
        </div>
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

  const isPartner = viewMode === 'partner';
  const managed = data.managedChannels;
  const market = data.marketChannels;

  // Derived data
  const momentumChannels = managed.filter(c => c.classification === 'GROWING')
    .sort((a, b) => (b.views7d ?? 0) - (a.views7d ?? 0)).slice(0, 4);

  const issueChannels = managed.filter(c => c.classification !== 'GROWING');
  type IssueGroup = { label: string; partnerLabel: string; count: number; topChannels: PulseChannel[] };
  const issueGroups: IssueGroup[] = [
    { label: 'Conversion opportunity', partnerLabel: 'Conversion opportunity', count: issueChannels.filter(c => c.classification === 'WEAK_CONVERSION').length, topChannels: issueChannels.filter(c => c.classification === 'WEAK_CONVERSION').slice(0, 3) },
    { label: 'Cadence opportunity', partnerLabel: 'Cadence opportunity', count: issueChannels.filter(c => c.classification === 'UNDERFED').length, topChannels: issueChannels.filter(c => c.classification === 'UNDERFED').slice(0, 3) },
    { label: 'Reactivation ready', partnerLabel: 'Reactivation ready', count: issueChannels.filter(c => c.classification === 'COLD').length, topChannels: issueChannels.filter(c => c.classification === 'COLD').slice(0, 3) },
  ].filter(g => g.count > 0);

  const consistentMarket = market.filter(c => c.uploads30d >= 5 && c.classification === 'GROWING')
    .sort((a, b) => b.uploads30d - a.uploads30d).slice(0, 4);

  const featureVideo = data.topVideos[0] ?? null;
  const supportingVideos = data.topVideos.slice(1, 4);
  const topShorts = data.topShorts.slice(0, 5);

  // Generators
  function generateEmailBody(): string {
    const topVids = data!.topVideos.slice(0, 3).map(v => `${v.channelName} — "${v.title}" (${fmtNum(v.viewCount)} views)`);
    return `Subject: YouTube Pulse — ${data!.weekRange}\n\n${data!.editorial}\n\nTop moments:\n${topVids.map(v => `- ${v}`).join('\n')}\n\nSignals: ${data!.signals.growing} growing · ${data!.signals.cold} cold · ${data!.signals.weakConversion} conversion opportunity\n\nPlaybook: ${data!.playbook.title}`;
  }
  function generateSlackSummary(): string {
    const topVids = data!.topVideos.slice(0, 3).map(v => `• ${v.channelName} — ${fmtNum(v.viewCount)} views`);
    return `*YouTube Pulse — ${data!.weekRange}*\n\n${data!.editorial}\n\n*Top:*\n${topVids.join('\n')}\n\n*Signals:* ${data!.signals.growing} growing · ${data!.signals.cold} cold\n\n*Play:* ${data!.playbook.title}`;
  }
  function copyToClipboard(text: string, type: 'email' | 'slack') {
    navigator.clipboard.writeText(text).then(() => {
      if (type === 'email') { setEmailCopied(true); setTimeout(() => setEmailCopied(false), 2000); }
      if (type === 'slack') { setSlackCopied(true); setTimeout(() => setSlackCopied(false), 2000); }
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     RENDER — Magazine editorial layout
  ═══════════════════════════════════════════════════════════════════════════ */

  return (
    <div ref={pageRef} style={{ background: PAPER, minHeight: '100vh', color: INK, overflowX: 'hidden', position: 'relative' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @media print { .no-print { display: none !important; } }
        a.pulse-link { text-decoration: none; color: inherit; }
        a.pulse-link:hover { opacity: 0.85; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .pulse-fade { animation: fadeUp 0.6s ease-out both; }
        .pulse-grain {
          position: relative;
        }
        .pulse-grain::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
          background-repeat: repeat;
          background-size: 200px 200px;
          pointer-events: none;
          z-index: 0;
        }
        .pulse-grain > * { position: relative; z-index: 1; }
        .shorts-thumb { transition: transform 0.2s ease; }
        .shorts-thumb:hover { transform: scale(1.03); }
        .momentum-row { transition: background 0.15s ease; }
        .momentum-row:hover { background: rgba(14,14,14,0.03); }
      `}</style>


      {/* ══════════════════════════════════════════════════════════════════════
          TOP BAR — Logos + controls
      ══════════════════════════════════════════════════════════════════════ */}
      {!screenshotMode && (
        <div className="no-print" style={{
          maxWidth: 1200, margin: '0 auto', padding: '18px 40px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <VirginScriptLogo width={100} />
            <span style={{ color: BONE, fontSize: 18, fontWeight: 300 }}>&times;</span>
            <YouTubeLogo size={22} />
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => setViewMode(v => v === 'internal' ? 'partner' : 'internal')}
              style={{ padding: '5px 14px', borderRadius: 20, border: 'none', background: 'transparent', fontSize: 10, fontWeight: 600, color: SMOKE, cursor: 'pointer' }}>
              {isPartner ? 'Partner' : 'Internal'}
            </button>
            <button onClick={() => document.getElementById('pulse-share')?.scrollIntoView({ behavior: 'smooth' })}
              style={{ padding: '5px 14px', borderRadius: 20, border: 'none', background: 'transparent', fontSize: 10, fontWeight: 600, color: SMOKE, cursor: 'pointer' }}>
              Share
            </button>
          </div>
        </div>
      )}

      {screenshotMode && (
        <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, zIndex: 999 }}>
          <button onClick={() => setScreenshotMode(false)}
            style={{ padding: '6px 14px', borderRadius: 20, border: 'none', background: INK, fontSize: 10, fontWeight: 700, color: WHITE, cursor: 'pointer' }}>
            Exit
          </button>
        </div>
      )}


      {/* ══════════════════════════════════════════════════════════════════════
          HERO — Split layout: title left, Shorts wall right
      ══════════════════════════════════════════════════════════════════════ */}
      <header className="pulse-fade pulse-grain" style={{
        maxWidth: 1200, margin: '0 auto', padding: '50px 40px 60px',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 380px', gap: 48, alignItems: 'start',
        }}>
          {/* Left — Title block */}
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32,
            }}>
              <VirginScriptLogo width={140} />
            </div>

            <h1 style={{
              fontSize: 80, fontWeight: 900, lineHeight: 0.88,
              letterSpacing: '-0.045em', color: INK,
              margin: '0 0 0 -4px', fontFamily: 'Inter, system-ui, sans-serif',
            }}>
              YouTube<br />Pulse.
            </h1>

            <div style={{
              marginTop: 20, fontSize: 10, fontWeight: 800,
              letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: SMOKE,
              maxWidth: 380,
            }}>
              Your weekly dive into what&apos;s driving growth.
            </div>

            <div style={{
              marginTop: 28, fontSize: 11, fontWeight: 500,
              letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: GHOST,
            }}>
              {data.weekRange}
            </div>

            {/* Signals — compact row */}
            <div style={{ display: 'flex', gap: 24, marginTop: 36 }}>
              {[
                { n: data.signals.growing, label: 'Growing', color: ACCENT.green },
                { n: data.signals.weakConversion, label: 'Conversion', color: ACCENT.amber },
                { n: data.signals.underfed, label: 'Cadence', color: ACCENT.ochre },
                { n: data.signals.cold, label: 'Cold', color: ACCENT.ember },
              ].map((sig, i) => (
                <div key={i} style={{ textAlign: 'left' }}>
                  <div style={{
                    fontSize: 36, fontWeight: 900, color: sig.color,
                    lineHeight: 1, letterSpacing: '-0.03em',
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}>
                    {sig.n}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: SMOKE, marginTop: 5, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>
                    {sig.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Shorts visual wall */}
          <div>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase' as const, color: GHOST, marginBottom: 6,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect width="12" height="12" rx="3" fill={YT_RED} />
                <polygon points="4.5,3 4.5,9 9,6" fill={WHITE} />
              </svg>
              Top Shorts This Week
            </div>
            <div style={{
              fontFamily: "'Georgia', serif", fontStyle: 'italic', fontSize: 13,
              color: SMOKE, marginBottom: 14, lineHeight: 1.3,
            }}>
              across our roster
            </div>

            {/* Shorts stack — vertical thumbnails */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {topShorts.map((v, i) => (
                <a key={v.id} href={ytUrl(v.id, v.durationSec)} target="_blank" rel="noopener noreferrer"
                  className="pulse-link shorts-thumb">
                  <div style={{
                    display: 'grid', gridTemplateColumns: '90px 1fr', gap: 12,
                    alignItems: 'center', padding: '8px 10px',
                    background: i === 0 ? 'rgba(255,0,0,0.04)' : 'transparent',
                    borderRadius: 6, border: i === 0 ? `1px solid rgba(255,0,0,0.12)` : `1px solid ${BONE}`,
                  }}>
                    {/* Thumbnail with play overlay */}
                    <div style={{ position: 'relative', borderRadius: 4, overflow: 'hidden', aspectRatio: '9/16', maxHeight: 56 }}>
                      <img src={v.thumbnail} alt="" loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <div style={{
                        position: 'absolute', inset: 0, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,0,0,0.2)',
                      }}>
                        <PlayIcon size={20} />
                      </div>
                    </div>
                    <div>
                      <div style={{
                        fontSize: 12, fontWeight: 700, color: INK, lineHeight: 1.25,
                        overflow: 'hidden', display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                      }}>
                        {v.title}
                      </div>
                      <div style={{ fontSize: 10, color: SMOKE, marginTop: 3, display: 'flex', gap: 6 }}>
                        <span>{v.channelName}</span>
                        <span style={{ color: YT_RED, fontWeight: 700 }}>{fmtNum(v.viewCount)}</span>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </header>


      {/* ══════════════════════════════════════════════════════════════════════
          EDITORIAL LEDE — magazine opener
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="pulse-fade" style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 40px 0',
      }}>
        <div style={{ height: 1, background: BONE }} />
        <div style={{ padding: '40px 0', maxWidth: 640 }}>
          <p style={{
            fontSize: 22, fontWeight: 500, color: INK,
            lineHeight: 1.5, letterSpacing: '-0.01em',
            margin: 0, fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            {data.editorial}
          </p>
          <div style={{ display: 'flex', gap: 16, marginTop: 20, fontSize: 10, color: GHOST }}>
            <span>{data.signals.totalManaged} managed</span>
            <span style={{ color: BONE }}>|</span>
            <span>{data.signals.totalMarket} market watch</span>
            {data.lastSyncAt && (
              <>
                <span style={{ color: BONE }}>|</span>
                <span>Synced {timeAgo(data.lastSyncAt)}</span>
              </>
            )}
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════════════
          BIG READ + MOMENTS — side by side (magazine spread)
      ══════════════════════════════════════════════════════════════════════ */}
      <section style={{
        maxWidth: 1200, margin: '0 auto', padding: '20px 40px 0',
      }}>
        <div style={{ height: 1, background: BONE, marginBottom: 40 }} />

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48,
        }}>
          {/* LEFT — The Big Read */}
          <div>
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.2em',
              textTransform: 'uppercase' as const, color: GHOST, marginBottom: 20,
            }}>
              The Big Read
            </div>

            {data.insights.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {data.insights.slice(0, 4).map((insight, i) => (
                  <p key={i} style={{
                    fontSize: i === 0 ? 17 : 14,
                    fontWeight: i === 0 ? 600 : 400,
                    color: i === 0 ? INK : WARM,
                    lineHeight: 1.55, margin: 0,
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}>
                    {insight}
                  </p>
                ))}
              </div>
            )}

            <div style={{ marginTop: 24, fontSize: 10, color: GHOST }}>
              {data.signals.totalManaged} channels tracked · {data.signals.growing + data.signals.weakConversion + data.signals.underfed + data.signals.cold} classified
            </div>
          </div>

          {/* RIGHT — Moments This Week */}
          <div>
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.2em',
              textTransform: 'uppercase' as const, color: GHOST, marginBottom: 20,
            }}>
              Moments This Week
            </div>

            {featureVideo && (
              <div>
                {/* Hero video */}
                <a href={ytUrl(featureVideo.id, featureVideo.durationSec)} target="_blank" rel="noopener noreferrer"
                  className="pulse-link">
                  <div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
                    <img src={featureVideo.thumbnail} alt="" loading="lazy"
                      style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }} />
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      padding: '40px 20px 16px',
                      background: 'linear-gradient(transparent 0%, rgba(0,0,0,0.7) 100%)',
                    }}>
                      <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
                        {featureVideo.format}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: WHITE, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                        {featureVideo.title}
                      </div>
                    </div>
                    <div style={{ position: 'absolute', top: 12, right: 12 }}>
                      <PlayIcon size={36} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>{featureVideo.channelName}</span>
                    <span style={{ fontSize: 11, color: SMOKE }}>{fmtNum(featureVideo.viewCount)} views</span>
                    <span style={{ fontSize: 11, color: YT_RED, fontWeight: 600 }}>{fmtNum(featureVideo.velocity)}/day</span>
                  </div>
                </a>

                {/* Supporting videos — compact row */}
                <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                  {supportingVideos.map(v => (
                    <a key={v.id} href={ytUrl(v.id, v.durationSec)} target="_blank" rel="noopener noreferrer"
                      className="pulse-link" style={{ flex: 1 }}>
                      <div style={{ borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                        <img src={v.thumbnail} alt="" loading="lazy"
                          style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: INK, lineHeight: 1.25, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                        {v.title}
                      </div>
                      <div style={{ fontSize: 9, color: SMOKE, marginTop: 3 }}>
                        {v.channelName} · {fmtNum(v.viewCount)}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════════════
          MOMENTUM + OPPORTUNITIES — compact 2-column
      ══════════════════════════════════════════════════════════════════════ */}
      <section style={{
        maxWidth: 1200, margin: '0 auto', padding: '60px 40px 0',
      }}>
        <div style={{ height: 1, background: BONE, marginBottom: 40 }} />

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48,
        }}>
          {/* LEFT — Momentum */}
          <div>
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.2em',
              textTransform: 'uppercase' as const, color: GHOST, marginBottom: 12,
            }}>
              Channels With Momentum
            </div>
            <h2 style={{
              fontSize: 28, fontWeight: 900, lineHeight: 1.05,
              letterSpacing: '-0.03em', color: INK, margin: '0 0 20px',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}>
              {momentumChannels.length} channels in{' '}
              <span style={{ color: ACCENT.green }}>growth state.</span>
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {momentumChannels.map((ch, i) => (
                <div key={ch.slug} className="momentum-row" style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 8px',
                  borderBottom: i < momentumChannels.length - 1 ? `1px solid ${BONE}` : 'none',
                  borderRadius: 4,
                }}>
                  {ch.thumbnail && (
                    <img src={ch.thumbnail} alt="" loading="lazy"
                      style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>{ch.name}</div>
                    <div style={{ fontSize: 10, color: SMOKE }}>
                      {ch.uploads30d} uploads/30d · {ch.cadenceLabel}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: ACCENT.green, letterSpacing: '-0.02em' }}>
                      {ch.views7d != null ? fmtNum(ch.views7d) : '—'}
                    </div>
                    <div style={{ fontSize: 8, color: GHOST, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>7d views</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — Opportunities */}
          {issueGroups.length > 0 && (
            <div>
              <div style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '0.2em',
                textTransform: 'uppercase' as const, color: GHOST, marginBottom: 12,
              }}>
                Opportunities
              </div>
              <h2 style={{
                fontSize: 28, fontWeight: 900, lineHeight: 1.05,
                letterSpacing: '-0.03em', color: INK, margin: '0 0 24px',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}>
                Where there&apos;s{' '}
                <span style={{ fontStyle: 'italic', fontWeight: 500, color: WARM }}>room to grow.</span>
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                {issueGroups.map((group, gi) => (
                  <div key={gi}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 28, fontWeight: 900, color: INK, lineHeight: 1, letterSpacing: '-0.02em' }}>
                        {group.count}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: SMOKE, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>
                        {isPartner ? group.partnerLabel : group.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {group.topChannels.map(ch => (
                        <div key={ch.slug} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {ch.thumbnail && (
                            <img src={ch.thumbnail} alt="" loading="lazy"
                              style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: INK }}>{ch.name}</div>
                            <div style={{ fontSize: 10, color: SMOKE }}>
                              {ch.nextAction || ch.reason}
                            </div>
                          </div>
                        </div>
                      ))}
                      {group.count > 3 && (
                        <div style={{ fontSize: 9, color: GHOST, marginLeft: 32 }}>
                          + {group.count - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════════════
          MARKET WATCH — compact editorial
      ══════════════════════════════════════════════════════════════════════ */}
      {(data.marketInsights.length > 0 || consistentMarket.length > 0) && (
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 40px 0' }}>
          <div style={{ height: 1, background: BONE, marginBottom: 40 }} />

          <div style={{
            display: 'grid', gridTemplateColumns: '260px 1fr', gap: 48,
          }}>
            <div>
              <div style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '0.2em',
                textTransform: 'uppercase' as const, color: GHOST, marginBottom: 12,
              }}>
                Market Watch
              </div>
              <h2 style={{
                fontSize: 24, fontWeight: 900, lineHeight: 1.1,
                letterSpacing: '-0.03em', color: INK, margin: 0,
                fontFamily: 'Inter, system-ui, sans-serif',
              }}>
                What the wider market is{' '}
                <span style={{ fontStyle: 'italic', fontWeight: 500, color: WARM }}>teaching us.</span>
              </h2>

              {consistentMarket.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: GHOST, marginBottom: 10 }}>
                    Reference channels
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {consistentMarket.map(ch => (
                      <div key={ch.slug} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 10px 4px 4px', borderRadius: 20,
                        border: `1px solid ${BONE}`, background: WHITE,
                      }}>
                        {ch.thumbnail && (
                          <img src={ch.thumbnail} alt="" loading="lazy"
                            style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
                        )}
                        <span style={{ fontSize: 10, fontWeight: 600, color: INK }}>{ch.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 4 }}>
              {data.marketInsights.map((insight, i) => (
                <p key={i} style={{
                  fontSize: i === 0 ? 16 : 13,
                  fontWeight: i === 0 ? 500 : 400,
                  color: i === 0 ? INK : WARM,
                  lineHeight: 1.55, margin: 0, maxWidth: 520,
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}>
                  {insight}
                </p>
              ))}
            </div>
          </div>
        </section>
      )}


      {/* ══════════════════════════════════════════════════════════════════════
          PLAYBOOK — dark premium section
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="pulse-grain" style={{
        background: INK, color: PAPER, marginTop: 60,
        padding: '64px 0',
        position: 'relative',
      }}>
        {/* Red accent stripe at top */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: YT_RED }} />

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60 }}>
            <div>
              <div style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '0.22em',
                textTransform: 'uppercase' as const, color: 'rgba(250,247,242,0.35)', marginBottom: 18,
              }}>
                Playbook of the Week
              </div>
              <h2 style={{
                fontSize: 36, fontWeight: 900, lineHeight: 1.05,
                letterSpacing: '-0.03em', color: PAPER, margin: 0,
                fontFamily: 'Inter, system-ui, sans-serif',
              }}>
                {data.playbook.title}
              </h2>
              <p style={{
                fontSize: 15, fontWeight: 400, color: 'rgba(250,247,242,0.65)',
                lineHeight: 1.6, marginTop: 20, maxWidth: 400,
                fontFamily: 'Inter, system-ui, sans-serif',
              }}>
                {data.playbook.why}
              </p>
              <p style={{
                fontSize: 11, fontStyle: 'italic', color: 'rgba(250,247,242,0.35)',
                marginTop: 14,
              }}>
                {data.playbook.when}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {data.playbook.actions.map((action, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 16, alignItems: 'flex-start',
                  padding: '20px 0',
                  borderBottom: i < data.playbook.actions.length - 1 ? '1px solid rgba(250,247,242,0.08)' : 'none',
                }}>
                  <span style={{
                    fontSize: 38, fontWeight: 900, color: 'rgba(255,0,0,0.2)',
                    lineHeight: 1, minWidth: 36,
                    letterSpacing: '-0.03em',
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}>
                    {i + 1}
                  </span>
                  <p style={{
                    fontSize: 13, color: 'rgba(250,247,242,0.8)',
                    lineHeight: 1.55, margin: 0, paddingTop: 8,
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}>
                    {action}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════════════
          SHARE + FOOTER
      ══════════════════════════════════════════════════════════════════════ */}
      {!screenshotMode && (
        <section id="pulse-share" className="no-print" style={{
          maxWidth: 1200, margin: '0 auto', padding: '48px 40px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.2em',
              textTransform: 'uppercase' as const, color: GHOST,
            }}>
              Share This Briefing
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <ActionPill label={emailCopied ? 'Copied' : 'Email'} onClick={() => copyToClipboard(generateEmailBody(), 'email')} active={emailCopied} />
              <ActionPill label={slackCopied ? 'Copied' : 'Slack'} onClick={() => copyToClipboard(generateSlackSummary(), 'slack')} active={slackCopied} />
              <ActionPill label="Screenshot" onClick={() => setScreenshotMode(true)} />
              <ActionPill label="Print" onClick={() => window.print()} />
            </div>
          </div>
        </section>
      )}

      <footer style={{
        maxWidth: 1200, margin: '0 auto', padding: '16px 40px 36px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <VirginScriptLogo width={60} />
          <span style={{ color: BONE, fontSize: 12 }}>&times;</span>
          <YouTubeLogo size={14} />
        </div>
        <div style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: GHOST }}>
          YouTube Pulse · {data.weekRange}
        </div>
      </footer>
    </div>
  );
}


// ── Sub-components ────────────────────────────────────────────────────────────

function ActionPill({ label, onClick, active }: {
  label: string; onClick: () => void; active?: boolean;
}) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 16px', borderRadius: 20, border: 'none',
      background: active ? INK : WHITE, fontSize: 10, fontWeight: 600,
      color: active ? WHITE : INK, cursor: 'pointer', transition: 'all 0.2s',
    }}>
      {label}
    </button>
  );
}
