'use client';

import { useState, useEffect, useRef } from 'react';

// ── Design Tokens ─────────────────────────────────────────────────────────────

const INK    = '#0E0E0E';
const PAPER  = '#FAF7F2';
const SOFT   = '#F6F1E7';
const BONE   = '#EBE7DF';
const SMOKE  = '#8A847A';
const GHOST  = '#C8C2B8';
const WHITE  = '#FFFFFF';
const MONO   = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace';

// Muted editorial palette for signal accents — no bright dashboard colors
const SIGNAL_TONES: Record<string, { accent: string; muted: string }> = {
  GROWING:         { accent: '#2D6A4F', muted: '#95B8A6' },
  WEAK_CONVERSION: { accent: '#9A6324', muted: '#C4A87C' },
  UNDERFED:        { accent: '#7A6520', muted: '#BBA95E' },
  COLD:            { accent: '#8A3A2A', muted: '#C48A7C' },
};

// ── Types ────────────────────────────────────────────────────────────────────

type PulseChannel = {
  slug: string;
  name: string;
  isVirgin: boolean;
  channelHandle: string | null;
  subs: number | null;
  totalViews: number | null;
  views7d: number | null;
  subs7d: number | null;
  viewsWoW: number | null;
  subsWoW: number | null;
  uploads30d: number;
  shorts30d: number;
  longform30d: number;
  lastUploadAt: string | null;
  lastUploadDaysAgo: number | null;
  thumbnail: string | null;
  phase: string;
  campaign: string | null;
  campaignStartDate: string | null;
  status: string;
  classification: string;
  reason: string;
  nextAction: string;
  watcherRead: string;
  cadenceLabel: string;
  subsPer1kViews: number | null;
};

type PulseVideo = {
  id: string;
  title: string;
  channelName: string;
  artistSlug: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string;
  durationSec: number;
  format: string;
  thumbnail: string;
  velocity: number;
  daysAgo: number;
};

type Playbook = {
  title: string;
  why: string;
  when: string;
  actions: string[];
};

type PulseData = {
  weekRange: string;
  generatedAt: string;
  lastSyncAt: string | null;
  signals: { growing: number; weakConversion: number; underfed: number; cold: number; totalManaged: number; totalMarket: number; total: number };
  managedChannels: PulseChannel[];
  marketChannels: PulseChannel[];
  topVideos: PulseVideo[];
  topShorts: PulseVideo[];
  rollups: unknown[];
  editorial: string;
  insights: string[];
  playbook: Playbook;
  marketInsights: string[];
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
  if (dur <= 62) return `https://www.youtube.com/shorts/${id}`;
  return `https://www.youtube.com/watch?v=${id}`;
}

// ── Main Component ────────────────────────────────────────────────────────────

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

  if (loading) {
    return (
      <main style={{ background: PAPER, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: SMOKE, marginBottom: 16 }}>
            Preparing your briefing
          </div>
          <div style={{ width: 48, height: 2, background: BONE, borderRadius: 1, margin: '0 auto', overflow: 'hidden' }}>
            <div style={{ width: '50%', height: '100%', background: INK, borderRadius: 1, animation: 'pulse-slide 2s ease-in-out infinite' }} />
          </div>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main style={{ background: PAPER, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: SMOKE }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Failed to load briefing</div>
          <div style={{ fontSize: 11, fontFamily: MONO }}>{error}</div>
        </div>
      </main>
    );
  }

  const isPartner = viewMode === 'partner';
  const managed = data.managedChannels;
  const market = data.marketChannels;

  // Derived
  const momentumChannels = managed
    .filter(c => c.classification === 'GROWING')
    .sort((a, b) => (b.views7d ?? 0) - (a.views7d ?? 0))
    .slice(0, 5);

  const issueChannels = managed.filter(c => c.classification !== 'GROWING');

  type IssueGroup = { label: string; partnerLabel: string; channels: PulseChannel[] };
  const issueGroups: IssueGroup[] = [
    { label: 'Weak Conversion', partnerLabel: 'Conversion opportunity', channels: issueChannels.filter(c => c.classification === 'WEAK_CONVERSION') },
    { label: 'Underfed', partnerLabel: 'Cadence opportunity', channels: issueChannels.filter(c => c.classification === 'UNDERFED') },
    { label: 'Cold', partnerLabel: 'Reactivation opportunity', channels: issueChannels.filter(c => c.classification === 'COLD') },
  ].filter(g => g.channels.length > 0);

  const consistentMarket = market
    .filter(c => c.uploads30d >= 5 && c.classification === 'GROWING')
    .sort((a, b) => b.uploads30d - a.uploads30d)
    .slice(0, 4);

  // Feature video = top 1, supporting = next 3
  const featureVideo = data.topVideos[0] ?? null;
  const supportingVideos = data.topVideos.slice(1, 4);
  const topShorts = data.topShorts.slice(0, 3);

  // ── Email / Slack ──────────────────────────────────────────────────────────

  function generateEmailBody(): string {
    const topVids = data!.topVideos.slice(0, 3).map(v =>
      `${v.channelName} — "${v.title}" (${fmtNum(v.viewCount)} views)`
    );
    const opps = issueGroups.slice(0, 3).map(g => {
      const names = g.channels.slice(0, 2).map(c => c.name).join(', ');
      return isPartner ? `${g.partnerLabel}: ${names}` : `${g.label}: ${names}`;
    });

    return `Subject: YouTube Weekly Pulse — ${data!.weekRange}

Hi all,

Quick weekly YouTube pulse from the UK/global channel tracker.

This week's read:
${data!.editorial}

Top signals:
${data!.insights.slice(0, 3).map(s => `- ${s}`).join('\n')}

Channels/videos worth watching:
${topVids.length > 0 ? topVids.map(v => `- ${v}`).join('\n') : '- No standout moments this week'}

Opportunities this week:
${opps.length > 0 ? opps.map(o => `- ${o}`).join('\n') : '- No major issues flagged'}

Thanks,
Leon`;
  }

  function generateSlackSummary(): string {
    const topVids = data!.topVideos.slice(0, 3).map(v =>
      `• ${v.channelName} — "${v.title}" (${fmtNum(v.viewCount)} views)`
    );
    return `*YouTube Weekly Pulse — ${data!.weekRange}*

${data!.editorial}

*Top Moments:*
${topVids.length > 0 ? topVids.join('\n') : '• No standout moments this week'}

*Signals:* ${data!.signals.growing} growing · ${data!.signals.weakConversion} weak conversion · ${data!.signals.underfed} underfed · ${data!.signals.cold} cold

*Playbook:* ${data!.playbook.title}`;
  }

  function copyToClipboard(text: string, type: 'email' | 'slack') {
    navigator.clipboard.writeText(text).then(() => {
      if (type === 'email') { setEmailCopied(true); setTimeout(() => setEmailCopied(false), 2000); }
      if (type === 'slack') { setSlackCopied(true); setTimeout(() => setSlackCopied(false), 2000); }
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div ref={pageRef} style={{ background: PAPER, minHeight: '100vh', color: INK }}>
      <style>{`
        @media print { .no-print { display: none !important; } }
        @keyframes pulse-slide { 0%, 100% { transform: translateX(-100%); } 50% { transform: translateX(200%); } }
        a.vid-link:hover { opacity: 0.88; }
      `}</style>

      <div style={{ maxWidth: 740, margin: '0 auto', padding: screenshotMode ? '32px 24px' : '20px 24px 80px' }}>

        {/* ── Nav ── */}
        {!screenshotMode && (
          <nav className="no-print" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 48, paddingTop: 12,
          }}>
            <a href="/" style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.2em',
              textTransform: 'uppercase', color: GHOST, textDecoration: 'none',
            }}>
              Campaign System
            </a>
            <div style={{ display: 'flex', gap: 4 }}>
              <NavPill label={isPartner ? 'Partner' : 'Internal'} onClick={() => setViewMode(v => v === 'internal' ? 'partner' : 'internal')} />
              <NavPill label="Share" onClick={() => document.getElementById('pulse-share')?.scrollIntoView({ behavior: 'smooth' })} />
            </div>
          </nav>
        )}

        {screenshotMode && (
          <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, zIndex: 999 }}>
            <button
              onClick={() => setScreenshotMode(false)}
              style={{
                padding: '6px 14px', borderRadius: 20, border: 'none',
                background: INK, fontSize: 10, fontWeight: 700, color: WHITE,
                cursor: 'pointer', letterSpacing: '0.04em',
              }}
            >
              Exit Screenshot
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            HERO — The Week's Read
        ═══════════════════════════════════════════════════════════════════ */}
        <header style={{ marginBottom: 72 }}>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.22em',
            textTransform: 'uppercase', color: GHOST, marginBottom: 20,
          }}>
            Weekly Intelligence Briefing
          </div>

          <h1 style={{
            fontSize: 52, fontWeight: 900, lineHeight: 1.0, color: INK,
            margin: 0, letterSpacing: '-0.02em',
          }}>
            Weekly Pulse
          </h1>

          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: SMOKE, marginTop: 10,
          }}>
            {data.weekRange}
          </div>

          {/* Editorial pull quote — the centerpiece */}
          <blockquote style={{
            marginTop: 40, marginBottom: 0,
            paddingLeft: 0, marginLeft: 0, marginRight: 0,
            borderLeft: 'none',
            maxWidth: 600,
          }}>
            <p style={{
              fontSize: 21, fontWeight: 500, color: INK, lineHeight: 1.5,
              margin: 0, letterSpacing: '-0.01em',
            }}>
              {data.editorial}
            </p>
          </blockquote>

          <div style={{
            display: 'flex', gap: 20, marginTop: 28, fontSize: 10, color: SMOKE, letterSpacing: '0.02em',
          }}>
            <span>{data.signals.totalManaged} managed channels</span>
            <span style={{ color: BONE }}>·</span>
            <span>{data.signals.totalMarket} market watch</span>
            {data.lastSyncAt && (
              <>
                <span style={{ color: BONE }}>·</span>
                <span>Data synced {timeAgo(data.lastSyncAt)}</span>
              </>
            )}
          </div>
        </header>


        {/* ═══════════════════════════════════════════════════════════════════
            SIGNAL LINE — not cards, a single editorial statement
        ═══════════════════════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 72 }}>
          <Divider />
          <div style={{
            display: 'flex', gap: 0, marginTop: 28,
          }}>
            {[
              { n: data.signals.growing, label: isPartner ? 'Growing' : 'Growing', tone: SIGNAL_TONES.GROWING },
              { n: data.signals.weakConversion, label: isPartner ? 'Conversion Gap' : 'Weak Conversion', tone: SIGNAL_TONES.WEAK_CONVERSION },
              { n: data.signals.underfed, label: isPartner ? 'Low Cadence' : 'Underfed', tone: SIGNAL_TONES.UNDERFED },
              { n: data.signals.cold, label: isPartner ? 'Reactivation' : 'Cold', tone: SIGNAL_TONES.COLD },
            ].map((sig, i) => (
              <div key={i} style={{
                flex: 1,
                paddingLeft: i === 0 ? 0 : 20,
                borderLeft: i === 0 ? 'none' : `1px solid ${BONE}`,
              }}>
                <div style={{
                  fontSize: 36, fontWeight: 900, color: sig.tone.accent,
                  lineHeight: 1, letterSpacing: '-0.02em',
                }}>
                  {sig.n}
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 600, color: SMOKE,
                  marginTop: 6, letterSpacing: '0.02em',
                }}>
                  {sig.label}
                </div>
              </div>
            ))}
          </div>
        </section>


        {/* ═══════════════════════════════════════════════════════════════════
            THE BIG READ — editorial insights
        ═══════════════════════════════════════════════════════════════════ */}
        {data.insights.length > 0 && (
          <section style={{ marginBottom: 72 }}>
            <SectionLabel text="The Big Read" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 24 }}>
              {data.insights.map((insight, i) => (
                <div key={i} style={{
                  maxWidth: 600,
                  paddingLeft: i === 0 ? 0 : undefined,
                }}>
                  {i === 0 ? (
                    <p style={{
                      fontSize: 17, fontWeight: 500, color: INK, lineHeight: 1.6,
                      margin: 0,
                    }}>
                      {insight}
                    </p>
                  ) : (
                    <p style={{
                      fontSize: 14, fontWeight: 400, color: '#4A4640', lineHeight: 1.65,
                      margin: 0,
                    }}>
                      {insight}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}


        {/* ═══════════════════════════════════════════════════════════════════
            MOMENTS THIS WEEK — feature + supporting
        ═══════════════════════════════════════════════════════════════════ */}
        {featureVideo && (
          <section style={{ marginBottom: 72 }}>
            <SectionLabel text="Moments This Week" />

            {/* Feature video — large */}
            <a
              href={ytUrl(featureVideo.id, featureVideo.durationSec)}
              target="_blank"
              rel="noopener noreferrer"
              className="vid-link"
              style={{
                display: 'block', textDecoration: 'none', color: 'inherit',
                marginTop: 24,
              }}
            >
              <div style={{
                position: 'relative', borderRadius: 8, overflow: 'hidden',
                marginBottom: 14,
              }}>
                <img
                  src={featureVideo.thumbnail}
                  alt=""
                  style={{ width: '100%', height: 320, objectFit: 'cover', display: 'block' }}
                  loading="lazy"
                />
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  padding: '40px 24px 20px',
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                }}>
                  <span style={{
                    fontSize: 8, fontWeight: 700, letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)',
                  }}>
                    {featureVideo.format}
                  </span>
                  <div style={{
                    fontSize: 22, fontWeight: 800, color: WHITE, lineHeight: 1.2,
                    marginTop: 4, letterSpacing: '-0.01em',
                  }}>
                    {featureVideo.title}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>
                  {featureVideo.channelName}
                </span>
                <span style={{ fontSize: 11, color: SMOKE }}>
                  {fmtNum(featureVideo.viewCount)} views
                </span>
                <span style={{ fontSize: 11, color: SMOKE }}>
                  {fmtNum(featureVideo.velocity)}/day
                </span>
                <span style={{ fontSize: 11, color: GHOST }}>
                  {featureVideo.daysAgo}d ago
                </span>
              </div>
            </a>

            {/* Supporting videos — compact row */}
            {supportingVideos.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.min(supportingVideos.length, 3)}, 1fr)`,
                gap: 16, marginTop: 28,
              }}>
                {supportingVideos.map(v => (
                  <a
                    key={v.id}
                    href={ytUrl(v.id, v.durationSec)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vid-link"
                    style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
                  >
                    <div style={{ borderRadius: 6, overflow: 'hidden', marginBottom: 10 }}>
                      <img src={v.thumbnail} alt="" style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} loading="lazy" />
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: SMOKE, marginBottom: 3 }}>
                      {v.channelName}
                    </div>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.3,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {v.title}
                    </div>
                    <div style={{ fontSize: 10, color: SMOKE, marginTop: 4 }}>
                      {fmtNum(v.viewCount)} views · {fmtNum(v.velocity)}/day
                    </div>
                  </a>
                ))}
              </div>
            )}

            {/* Shorts — minimal mention */}
            {topShorts.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <div style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: GHOST, marginBottom: 12,
                }}>
                  Shorts worth noting
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {topShorts.map(v => (
                    <a
                      key={v.id}
                      href={ytUrl(v.id, v.durationSec)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        textDecoration: 'none', color: 'inherit',
                        padding: '8px 0',
                      }}
                    >
                      <div style={{
                        width: 48, height: 48, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
                      }}>
                        <img src={v.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12, fontWeight: 600, color: INK,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {v.title}
                        </div>
                        <div style={{ fontSize: 10, color: SMOKE, marginTop: 2 }}>
                          {v.channelName} · {fmtNum(v.viewCount)} views
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}


        {/* ═══════════════════════════════════════════════════════════════════
            MOMENTUM — clean, editorial channel mentions
        ═══════════════════════════════════════════════════════════════════ */}
        {momentumChannels.length > 0 && (
          <section style={{ marginBottom: 72 }}>
            <SectionLabel text="Channels With Momentum" />
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 0 }}>
              {momentumChannels.map((ch, i) => (
                <div key={ch.slug} style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '18px 0',
                  borderBottom: i < momentumChannels.length - 1 ? `1px solid ${BONE}` : 'none',
                }}>
                  {ch.thumbnail && (
                    <img src={ch.thumbnail} alt="" style={{
                      width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
                    }} loading="lazy" />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: INK }}>{ch.name}</span>
                      {ch.campaign && (
                        <span style={{ fontSize: 10, color: SMOKE }}>{ch.campaign}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: SMOKE, marginTop: 3, lineHeight: 1.4 }}>
                      {isPartner
                        ? 'Strong audience growth and healthy engagement.'
                        : ch.watcherRead || 'Healthy cadence and conversion.'
                      }
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {ch.views7d != null && (
                      <div style={{ fontSize: 15, fontWeight: 800, color: SIGNAL_TONES.GROWING.accent }}>
                        {fmtNum(ch.views7d)}
                      </div>
                    )}
                    <div style={{ fontSize: 9, color: GHOST, marginTop: 2 }}>7d views</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}


        {/* ═══════════════════════════════════════════════════════════════════
            OPPORTUNITIES — editorial groupings, not card lists
        ═══════════════════════════════════════════════════════════════════ */}
        {issueGroups.length > 0 && (
          <section style={{ marginBottom: 72 }}>
            <SectionLabel text={isPartner ? 'Opportunities' : 'Open Opportunities'} />
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 36 }}>
              {issueGroups.map((group, gi) => (
                <div key={gi}>
                  <div style={{
                    display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14,
                  }}>
                    <span style={{
                      fontSize: 14, fontWeight: 700, color: INK,
                    }}>
                      {isPartner ? group.partnerLabel : group.label}
                    </span>
                    <span style={{ fontSize: 10, color: GHOST }}>
                      {group.channels.length} channel{group.channels.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {group.channels.slice(0, 5).map((ch, i) => (
                      <div key={ch.slug} style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '12px 0',
                        borderBottom: i < Math.min(group.channels.length, 5) - 1 ? `1px solid ${BONE}` : 'none',
                      }}>
                        {ch.thumbnail && (
                          <img src={ch.thumbnail} alt="" style={{
                            width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
                          }} loading="lazy" />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{ch.name}</span>
                        </div>
                        <div style={{ fontSize: 11, color: SMOKE, maxWidth: 300, textAlign: 'right' }}>
                          {isPartner
                            ? ch.reason.replace(/cold|at risk|starved/gi, 'opportunity')
                            : ch.nextAction || ch.reason
                          }
                        </div>
                      </div>
                    ))}
                    {group.channels.length > 5 && (
                      <div style={{ fontSize: 10, color: GHOST, marginTop: 8 }}>
                        + {group.channels.length - 5} more
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}


        {/* ═══════════════════════════════════════════════════════════════════
            MARKET INTELLIGENCE — editorial prose, not cards
        ═══════════════════════════════════════════════════════════════════ */}
        {(data.marketInsights.length > 0 || consistentMarket.length > 0) && (
          <section style={{ marginBottom: 72 }}>
            <SectionLabel text="Market Watch" />
            <div style={{ marginTop: 24 }}>
              {data.marketInsights.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 600 }}>
                  {data.marketInsights.map((insight, i) => (
                    <p key={i} style={{
                      fontSize: i === 0 ? 15 : 13, fontWeight: 400,
                      color: i === 0 ? INK : '#4A4640',
                      lineHeight: 1.6, margin: 0,
                    }}>
                      {insight}
                    </p>
                  ))}
                </div>
              )}

              {consistentMarket.length > 0 && (
                <div style={{ marginTop: 32 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: GHOST, marginBottom: 14,
                  }}>
                    Reference channels
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {consistentMarket.map(ch => (
                      <div key={ch.slug} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 14px 8px 8px',
                        background: WHITE, borderRadius: 24,
                      }}>
                        {ch.thumbnail && (
                          <img src={ch.thumbnail} alt="" style={{
                            width: 26, height: 26, borderRadius: '50%', objectFit: 'cover',
                          }} loading="lazy" />
                        )}
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: INK, lineHeight: 1.2 }}>{ch.name}</div>
                          <div style={{ fontSize: 9, color: SMOKE }}>{ch.uploads30d} uploads/30d</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}


        {/* ═══════════════════════════════════════════════════════════════════
            PLAYBOOK — the strategy recommendation
        ═══════════════════════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 72 }}>
          <Divider />
          <div style={{ marginTop: 40 }}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.18em',
              textTransform: 'uppercase', color: GHOST, marginBottom: 14,
            }}>
              Playbook of the Week
            </div>

            <h2 style={{
              fontSize: 28, fontWeight: 900, color: INK, lineHeight: 1.15,
              margin: 0, letterSpacing: '-0.01em', maxWidth: 500,
            }}>
              {data.playbook.title}
            </h2>

            <p style={{
              fontSize: 15, fontWeight: 400, color: '#4A4640', lineHeight: 1.6,
              marginTop: 20, maxWidth: 560, marginBottom: 0,
            }}>
              {data.playbook.why}
            </p>

            <div style={{
              fontSize: 12, color: SMOKE, marginTop: 16, fontStyle: 'italic',
            }}>
              {data.playbook.when}
            </div>

            <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {data.playbook.actions.map((action, i) => (
                <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <span style={{
                    fontSize: 24, fontWeight: 900, color: BONE,
                    lineHeight: 1, minWidth: 28,
                    fontFamily: MONO,
                  }}>
                    {i + 1}
                  </span>
                  <p style={{
                    fontSize: 13, color: INK, lineHeight: 1.55, margin: 0,
                    paddingTop: 4,
                  }}>
                    {action}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>


        {/* ═══════════════════════════════════════════════════════════════════
            SHARE — minimal, tucked at the end
        ═══════════════════════════════════════════════════════════════════ */}
        {!screenshotMode && (
          <section id="pulse-share" className="no-print" style={{ marginBottom: 48 }}>
            <Divider />
            <div style={{ marginTop: 32 }}>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.18em',
                textTransform: 'uppercase', color: GHOST, marginBottom: 20,
              }}>
                Share This Briefing
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <ActionPill
                  label={emailCopied ? 'Copied' : 'Copy email summary'}
                  onClick={() => copyToClipboard(generateEmailBody(), 'email')}
                  active={emailCopied}
                />
                <ActionPill
                  label={slackCopied ? 'Copied' : 'Copy Slack summary'}
                  onClick={() => copyToClipboard(generateSlackSummary(), 'slack')}
                  active={slackCopied}
                />
                <ActionPill label="Screenshot mode" onClick={() => setScreenshotMode(true)} />
                <ActionPill label="Print / PDF" onClick={() => window.print()} />
              </div>
            </div>
          </section>
        )}


        {/* ── Colophon ── */}
        <footer style={{
          paddingTop: 40, paddingBottom: 32, textAlign: 'center',
        }}>
          <div style={{
            fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: GHOST,
          }}>
            YouTube Weekly Pulse · {data.weekRange}
          </div>
        </footer>

      </div>
    </div>
  );
}


// ── Sub-components ────────────────────────────────────────────────────────────

function Divider() {
  return <div style={{ height: 1, background: BONE }} />;
}

function SectionLabel({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
      textTransform: 'uppercase', color: SMOKE,
    }}>
      {text}
    </div>
  );
}

function NavPill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 14px', borderRadius: 20, border: 'none',
        background: 'transparent', fontSize: 10, fontWeight: 600,
        color: SMOKE, cursor: 'pointer', letterSpacing: '0.02em',
      }}
    >
      {label}
    </button>
  );
}

function ActionPill({ label, onClick, active }: {
  label: string; onClick: () => void; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 18px', borderRadius: 20,
        border: 'none',
        background: active ? INK : WHITE,
        fontSize: 11, fontWeight: 600,
        color: active ? WHITE : INK,
        cursor: 'pointer', letterSpacing: '0.01em',
        transition: 'all 0.2s',
      }}
    >
      {label}
    </button>
  );
}
