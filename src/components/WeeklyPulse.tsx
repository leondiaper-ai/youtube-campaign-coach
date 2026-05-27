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

const CLASSIFICATION_STYLE: Record<string, { bg: string; fg: string; dot: string }> = {
  GROWING:         { bg: '#E6F8EE', fg: '#0C6A3F', dot: '#1FBE7A' },
  WEAK_CONVERSION: { bg: '#FFEAD6', fg: '#8A4A1A', dot: '#F08A3C' },
  UNDERFED:        { bg: '#FFF5D6', fg: '#7A5A00', dot: '#FFD24C' },
  COLD:            { bg: '#FFE2D8', fg: '#8A1F0C', dot: '#FF4A1C' },
};

// ── Types (mirrors API response) ──────────────────────────────────────────────

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
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: SMOKE, marginBottom: 12, fontFamily: MONO }}>
            Loading Weekly Pulse...
          </div>
          <div style={{ width: 40, height: 3, background: BONE, borderRadius: 2, margin: '0 auto', overflow: 'hidden' }}>
            <div style={{ width: '60%', height: '100%', background: INK, borderRadius: 2, animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main style={{ background: PAPER, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: SMOKE }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Failed to load Weekly Pulse</div>
          <div style={{ fontSize: 11, fontFamily: MONO }}>{error}</div>
        </div>
      </main>
    );
  }

  const isPartner = viewMode === 'partner';
  const managed = data.managedChannels;
  const market = data.marketChannels;

  // Derived data
  const momentumChannels = managed
    .filter(c => c.classification === 'GROWING')
    .sort((a, b) => (b.views7d ?? 0) - (a.views7d ?? 0))
    .slice(0, 5);

  const issueChannels = managed.filter(c => c.classification !== 'GROWING');

  // Group issues
  type IssueGroup = { label: string; partnerLabel: string; channels: PulseChannel[] };
  const issueGroups: IssueGroup[] = [
    {
      label: 'Weak Conversion',
      partnerLabel: 'Reach strong, audience conversion can improve',
      channels: issueChannels.filter(c => c.classification === 'WEAK_CONVERSION'),
    },
    {
      label: 'Low Cadence / Underfed',
      partnerLabel: 'Opportunity to increase upload frequency',
      channels: issueChannels.filter(c => c.classification === 'UNDERFED'),
    },
    {
      label: 'Cold / Needs Reactivation',
      partnerLabel: 'Reactivation opportunity',
      channels: issueChannels.filter(c => c.classification === 'COLD'),
    },
  ].filter(g => g.channels.length > 0);

  // No-follow-up channels
  const noFollowUp = managed.filter(c =>
    c.campaignStartDate != null && c.lastUploadDaysAgo != null && c.lastUploadDaysAgo > 10
  );
  if (noFollowUp.length > 0 && !issueGroups.some(g => g.channels.some(ch => noFollowUp.includes(ch)))) {
    issueGroups.push({
      label: 'No Follow-Up Content',
      partnerLabel: 'Opportunity to deepen campaign support',
      channels: noFollowUp,
    });
  }

  // Market — best consistency
  const consistentMarket = market
    .filter(c => c.uploads30d >= 5 && c.classification === 'GROWING')
    .sort((a, b) => b.uploads30d - a.uploads30d)
    .slice(0, 5);

  // ── Email Generator ───────────────────────────────────────────────────────

  function generateEmailBody(): string {
    const topSignals = data!.insights.slice(0, 3);
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
${topSignals.map(s => `- ${s}`).join('\n')}

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
        .pulse-card { background: ${WHITE}; border: 1px solid ${BONE}; border-radius: 10px; overflow: hidden; }
        .pulse-card-inner { padding: 20px 24px; }
        @keyframes pulse { 0%, 100% { transform: translateX(-100%); } 50% { transform: translateX(100%); } }
      `}</style>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: screenshotMode ? '24px 24px' : '24px 20px 60px' }}>

        {/* ── Controls Bar ── */}
        {!screenshotMode && (
          <div className="no-print" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 20, gap: 8, flexWrap: 'wrap',
          }}>
            <a href="/" style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
              textTransform: 'uppercase', color: SMOKE, textDecoration: 'none', fontFamily: MONO,
            }}>
              ← YouTube Campaign System
            </a>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                onClick={() => setViewMode(v => v === 'internal' ? 'partner' : 'internal')}
                style={{
                  padding: '5px 12px', borderRadius: 5, border: `1px solid ${BONE}`,
                  background: WHITE, fontSize: 10, fontWeight: 700, color: INK,
                  cursor: 'pointer', fontFamily: MONO,
                }}
              >
                {isPartner ? '🤝 Partner View' : '🔒 Internal View'}
              </button>
              <button
                onClick={() => setScreenshotMode(true)}
                style={{
                  padding: '5px 12px', borderRadius: 5, border: `1px solid ${BONE}`,
                  background: WHITE, fontSize: 10, fontWeight: 700, color: INK,
                  cursor: 'pointer', fontFamily: MONO,
                }}
              >
                📷 Screenshot
              </button>
              <button
                onClick={() => window.print()}
                style={{
                  padding: '5px 12px', borderRadius: 5, border: `1px solid ${BONE}`,
                  background: WHITE, fontSize: 10, fontWeight: 700, color: INK,
                  cursor: 'pointer', fontFamily: MONO,
                }}
              >
                🖨 Print / PDF
              </button>
            </div>
          </div>
        )}

        {screenshotMode && (
          <div className="no-print" style={{ position: 'fixed', top: 12, right: 12, zIndex: 999 }}>
            <button
              onClick={() => setScreenshotMode(false)}
              style={{
                padding: '6px 14px', borderRadius: 6, border: `1px solid ${BONE}`,
                background: WHITE, fontSize: 10, fontWeight: 700, color: INK,
                cursor: 'pointer', fontFamily: MONO, boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              ✕ Exit Screenshot Mode
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            1. HERO HEADER
        ═══════════════════════════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 32 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.22em',
            textTransform: 'uppercase', color: SMOKE, marginBottom: 8, fontFamily: MONO,
          }}>
            Weekly Intelligence Briefing
          </div>

          <h1 style={{ fontSize: 36, fontWeight: 900, lineHeight: 1.1, color: INK, margin: 0 }}>
            YouTube<br />Weekly Pulse
          </h1>

          <p style={{
            fontSize: 14, color: '#5A5650', lineHeight: 1.5, marginTop: 10, maxWidth: 520,
          }}>
            UK + Global artist channel intelligence, campaign signals and content opportunities.
          </p>

          <div style={{
            display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap',
            fontSize: 10, color: SMOKE, fontFamily: MONO,
          }}>
            <span style={{ fontWeight: 700 }}>{data.weekRange}</span>
            {data.lastSyncAt && <span>Synced {timeAgo(data.lastSyncAt)}</span>}
            <span>{data.signals.totalManaged} managed artists</span>
            <span>{data.signals.totalMarket} market watch</span>
          </div>

          <div style={{
            marginTop: 16, padding: '14px 18px',
            background: WHITE, border: `1px solid ${BONE}`, borderRadius: 8,
            borderLeft: '3px solid #0E0E0E',
          }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.55, fontStyle: 'italic',
            }}>
              &ldquo;{data.editorial}&rdquo;
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════
            2. THIS WEEK'S SIGNALS
        ═══════════════════════════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 32 }}>
          <SectionHeader label="This Week's Signals" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <SignalCard label={isPartner ? 'Growing Channels' : 'Growing'} count={data.signals.growing} style={CLASSIFICATION_STYLE.GROWING} detail="Healthy cadence + conversion" />
            <SignalCard label={isPartner ? 'Conversion Gap' : 'Weak Conversion'} count={data.signals.weakConversion} style={CLASSIFICATION_STYLE.WEAK_CONVERSION} detail="Views up, subs flat" />
            <SignalCard label={isPartner ? 'Low Cadence' : 'Underfed'} count={data.signals.underfed} style={CLASSIFICATION_STYLE.UNDERFED} detail="Active but starved of content" />
            <SignalCard label={isPartner ? 'Reactivation' : 'Cold'} count={data.signals.cold} style={CLASSIFICATION_STYLE.COLD} detail="No recent uploads" />
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════
            3. THE BIG READ
        ═══════════════════════════════════════════════════════════════════════ */}
        {data.insights.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <SectionHeader label="The Big Read" />
            <div className="pulse-card">
              <div className="pulse-card-inner">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {data.insights.map((insight, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 800, color: GHOST, fontFamily: MONO,
                        minWidth: 18, textAlign: 'right', paddingTop: 2,
                      }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <p style={{
                        fontSize: 13, color: INK, lineHeight: 1.55, margin: 0,
                        fontWeight: i === 0 ? 600 : 400,
                      }}>
                        {insight}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            4. BEST VIDEO MOMENTS THIS WEEK
        ═══════════════════════════════════════════════════════════════════════ */}
        {data.topVideos.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <SectionHeader label="Best Video Moments This Week" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {data.topVideos.slice(0, 6).map(v => (
                <VideoCard key={v.id} video={v} isPartner={isPartner} />
              ))}
            </div>

            {data.topShorts.length > 0 && (
              <>
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: SMOKE, marginTop: 20, marginBottom: 10, fontFamily: MONO,
                }}>
                  Top Shorts
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                  {data.topShorts.slice(0, 4).map(v => (
                    <VideoCard key={v.id} video={v} isPartner={isPartner} />
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            5. CHANNELS WITH MOMENTUM
        ═══════════════════════════════════════════════════════════════════════ */}
        {momentumChannels.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <SectionHeader label="Channels With Momentum" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {momentumChannels.map(ch => (
                <ChannelCard key={ch.slug} channel={ch} isPartner={isPartner} variant="momentum" />
              ))}
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            6. MISSED OPPORTUNITIES
        ═══════════════════════════════════════════════════════════════════════ */}
        {issueGroups.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <SectionHeader label={isPartner ? 'Opportunities' : 'Missed Opportunities'} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {issueGroups.map((group, gi) => (
                <div key={gi}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: INK, marginBottom: 8 }}>
                    {isPartner ? group.partnerLabel : group.label}
                    <span style={{ fontSize: 9, fontWeight: 700, color: SMOKE, fontFamily: MONO, marginLeft: 8 }}>
                      {group.channels.length} channel{group.channels.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {group.channels.map(ch => (
                      <ChannelCard key={ch.slug} channel={ch} isPartner={isPartner} variant="issue" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            7. MARKET WATCH
        ═══════════════════════════════════════════════════════════════════════ */}
        {(data.marketInsights.length > 0 || consistentMarket.length > 0) && (
          <section style={{ marginBottom: 32 }}>
            <SectionHeader label="Market Watch — What the Wider Market Is Teaching Us" />
            <div className="pulse-card">
              <div className="pulse-card-inner">
                {data.marketInsights.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: consistentMarket.length > 0 ? 16 : 0 }}>
                    {data.marketInsights.map((insight, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 800, color: GHOST, fontFamily: MONO,
                          minWidth: 18, textAlign: 'right', paddingTop: 2,
                        }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <p style={{ fontSize: 12, color: INK, lineHeight: 1.55, margin: 0 }}>
                          {insight}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {consistentMarket.length > 0 && (
                  <>
                    <div style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                      textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginBottom: 8,
                    }}>
                      Standout Global Channels
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {consistentMarket.map(ch => (
                        <div key={ch.slug} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 12px', background: '#FAFAF8', borderRadius: 6,
                          border: `1px solid ${BONE}`,
                        }}>
                          {ch.thumbnail && (
                            <img src={ch.thumbnail} alt="" style={{
                              width: 28, height: 28, borderRadius: '50%', objectFit: 'cover',
                              border: `1px solid ${BONE}`, flexShrink: 0,
                            }} loading="lazy" />
                          )}
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>{ch.name}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 12, fontSize: 10, color: SMOKE, fontFamily: MONO }}>
                            <span>{ch.uploads30d} uploads/30d</span>
                            <span>{ch.shorts30d} Shorts</span>
                            {ch.subs != null && <span>{fmtNum(ch.subs)} subs</span>}
                            {ch.views7d != null && <span>{fmtNum(ch.views7d)} 7d views</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            8. PLAYBOOK OF THE WEEK
        ═══════════════════════════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 32 }}>
          <SectionHeader label="Playbook of the Week" />
          <div className="pulse-card">
            <div style={{
              padding: '18px 24px', borderBottom: `1px solid ${BONE}`,
              background: `linear-gradient(135deg, ${SOFT} 0%, ${WHITE} 100%)`,
            }}>
              <div style={{
                fontSize: 8, fontWeight: 800, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: SMOKE, fontFamily: MONO, marginBottom: 6,
              }}>
                This Week&apos;s Play
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: INK, lineHeight: 1.2 }}>
                {data.playbook.title}
              </div>
            </div>
            <div className="pulse-card-inner">
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginBottom: 4 }}>
                  Why It Matters
                </div>
                <p style={{ fontSize: 12, color: INK, lineHeight: 1.55, margin: 0 }}>{data.playbook.why}</p>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginBottom: 4 }}>
                  When to Use It
                </div>
                <p style={{ fontSize: 12, color: INK, lineHeight: 1.55, margin: 0 }}>{data.playbook.when}</p>
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginBottom: 8 }}>
                  Three Actions This Week
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.playbook.actions.map((action, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 800, color: WHITE,
                        background: INK, borderRadius: '50%',
                        width: 20, height: 20, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {i + 1}
                      </span>
                      <p style={{ fontSize: 12, color: INK, lineHeight: 1.5, margin: 0 }}>{action}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════
            9/10. EXPORT / SHARE OPTIONS + EMAIL GENERATOR
        ═══════════════════════════════════════════════════════════════════════ */}
        {!screenshotMode && (
          <section className="no-print" style={{ marginBottom: 32 }}>
            <SectionHeader label="Share & Export" />
            <div className="pulse-card">
              <div className="pulse-card-inner">
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  <ShareButton label={emailCopied ? '✓ Copied!' : 'Copy Email Summary'} onClick={() => copyToClipboard(generateEmailBody(), 'email')} active={emailCopied} />
                  <ShareButton label={slackCopied ? '✓ Copied!' : 'Copy Slack Summary'} onClick={() => copyToClipboard(generateSlackSummary(), 'slack')} active={slackCopied} />
                  <ShareButton label="Screenshot Mode" onClick={() => setScreenshotMode(true)} />
                  <ShareButton label="Print / Save PDF" onClick={() => window.print()} />
                </div>

                <div style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginBottom: 6,
                }}>
                  Email Preview
                </div>
                <div style={{
                  background: '#FAFAF8', border: `1px solid ${BONE}`,
                  borderRadius: 6, padding: '14px 16px',
                  fontSize: 11, color: INK, lineHeight: 1.6,
                  fontFamily: MONO, whiteSpace: 'pre-wrap',
                  maxHeight: 300, overflow: 'auto',
                }}>
                  {generateEmailBody()}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Footer ── */}
        {!screenshotMode && (
          <div style={{
            textAlign: 'center', fontSize: 10, color: GHOST, fontFamily: MONO,
            letterSpacing: '0.14em', textTransform: 'uppercase', paddingBottom: 24,
          }}>
            YouTube Weekly Pulse · {data.weekRange}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: SMOKE, fontFamily: MONO, whiteSpace: 'nowrap',
      }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 1, background: BONE }} />
    </div>
  );
}

function SignalCard({ label, count, style: s, detail }: {
  label: string; count: number; style: { bg: string; fg: string; dot: string }; detail: string;
}) {
  return (
    <div style={{
      background: WHITE, border: `1px solid ${BONE}`, borderRadius: 8,
      padding: '14px 16px', borderTop: `3px solid ${s.dot}`,
    }}>
      <div style={{ fontSize: 28, fontWeight: 900, color: s.fg, lineHeight: 1 }}>{count}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: INK, marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 9, color: SMOKE, marginTop: 2, fontFamily: MONO }}>{detail}</div>
    </div>
  );
}

function VideoCard({ video, isPartner }: { video: PulseVideo; isPartner: boolean }) {
  const formatColor: Record<string, { bg: string; fg: string }> = {
    'Official Video': { bg: '#0E0E0E', fg: '#FFFFFF' },
    'Short':          { bg: '#E0E7FF', fg: '#3730A3' },
    'BTS':            { bg: '#FFF5D6', fg: '#7A5A00' },
    'Live Session':   { bg: '#E6F8EE', fg: '#0C6A3F' },
    'Lyric Video':    { bg: '#F5F3FF', fg: '#7C3AED' },
    'Visualizer':     { bg: '#F5F3FF', fg: '#7C3AED' },
    'Premiere':       { bg: '#E0E7FF', fg: '#3730A3' },
    'Documentary':    { bg: '#0E0E0E', fg: '#FFFFFF' },
    'Trailer':        { bg: '#FFEAD6', fg: '#8A4A1A' },
    'Interview':      { bg: '#F3F4F6', fg: '#4B5563' },
    'Freestyle':      { bg: '#FFF5D6', fg: '#7A5A00' },
  };
  const fStyle = formatColor[video.format] ?? { bg: BONE, fg: INK };

  const contextLine = video.viewCount > 100000
    ? (isPartner ? 'Strong discovery moment.' : 'Big reach — check follow-up pipeline.')
    : video.viewCount > 20000
    ? (isPartner ? 'Solid performance this week.' : 'Healthy views — keep the cadence up.')
    : (isPartner ? 'Building audience engagement.' : 'Steady — compound with Shorts support.');

  return (
    <a
      href={ytUrl(video.id, video.durationSec)}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block', textDecoration: 'none', color: 'inherit',
        background: WHITE, border: `1px solid ${BONE}`, borderRadius: 8, overflow: 'hidden',
      }}
    >
      <div style={{ position: 'relative' }}>
        <img src={video.thumbnail} alt="" style={{ width: '100%', height: 135, objectFit: 'cover', display: 'block' }} loading="lazy" />
        <span style={{
          position: 'absolute', bottom: 6, left: 6,
          fontSize: 8, fontWeight: 800, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: fStyle.fg,
          padding: '2px 7px', borderRadius: 3, background: fStyle.bg, fontFamily: MONO,
        }}>
          {video.format}
        </span>
        <span style={{
          position: 'absolute', bottom: 6, right: 6,
          fontSize: 9, fontWeight: 700, color: WHITE,
          padding: '2px 6px', borderRadius: 3, background: 'rgba(0,0,0,0.7)', fontFamily: MONO,
        }}>
          {fmtNum(video.viewCount)} views
        </span>
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{
          fontSize: 9, fontWeight: 700, color: SMOKE, fontFamily: MONO,
          marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {video.channelName}
        </div>
        <div style={{
          fontSize: 12, fontWeight: 600, color: INK, lineHeight: 1.35,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {video.title}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 9, color: SMOKE, fontFamily: MONO }}>
          <span>{fmtNum(video.velocity)}/day</span>
          <span>{video.daysAgo}d ago</span>
        </div>
        <div style={{ fontSize: 10, color: SMOKE, marginTop: 4, lineHeight: 1.4 }}>
          {contextLine}
        </div>
      </div>
    </a>
  );
}

function ChannelCard({ channel, isPartner, variant }: {
  channel: PulseChannel; isPartner: boolean; variant: 'momentum' | 'issue';
}) {
  const cls = CLASSIFICATION_STYLE[channel.classification] ?? null;
  const isMomentum = variant === 'momentum';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: WHITE, border: `1px solid ${BONE}`, borderRadius: 8,
      padding: '12px 16px',
      borderLeft: cls ? `3px solid ${cls.dot}` : undefined,
    }}>
      {channel.thumbnail && (
        <img src={channel.thumbnail} alt="" style={{
          width: 36, height: 36, borderRadius: '50%', objectFit: 'cover',
          border: `2px solid ${BONE}`, flexShrink: 0,
        }} loading="lazy" />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{channel.name}</span>
          {channel.campaign && (
            <span style={{
              fontSize: 7, fontWeight: 800, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: '#3730A3',
              padding: '1px 6px', borderRadius: 3, background: '#E0E7FF', fontFamily: MONO,
            }}>
              {channel.campaign}
            </span>
          )}
          <span style={{
            fontSize: 7, fontWeight: 800, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: SMOKE,
            padding: '1px 6px', borderRadius: 3, background: BONE, fontFamily: MONO,
          }}>
            {channel.phase}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, fontSize: 10, color: SMOKE, fontFamily: MONO, flexWrap: 'wrap' }}>
          {channel.subs != null && <span>{fmtNum(channel.subs)} subs</span>}
          {channel.views7d != null && <span style={{ fontWeight: 700, color: channel.views7d > 10000 ? '#059669' : SMOKE }}>{fmtNum(channel.views7d)} 7d views</span>}
          {channel.subs7d != null && <span>{channel.subs7d > 0 ? '+' : ''}{fmtNum(channel.subs7d)} 7d subs</span>}
          <span>{channel.uploads30d} uploads/30d</span>
          <span>{channel.shorts30d}S / {channel.longform30d}L</span>
          {channel.subsPer1kViews != null && (
            <span style={{ color: channel.subsPer1kViews >= 5 ? '#059669' : channel.subsPer1kViews >= 2 ? '#92400E' : '#DC2626' }}>
              {channel.subsPer1kViews} subs/1K views
            </span>
          )}
          {channel.lastUploadDaysAgo != null && <span>last upload {channel.lastUploadDaysAgo}d ago</span>}
        </div>

        <div style={{
          fontSize: 11, color: isMomentum ? '#059669' : '#92400E',
          marginTop: 4, lineHeight: 1.4,
        }}>
          {isMomentum
            ? (isPartner
              ? 'Strong audience growth. Channel is in a healthy momentum state.'
              : channel.watcherRead || 'Healthy cadence and conversion.')
            : (isPartner
              ? channel.reason.replace(/cold|at risk|starved/gi, 'opportunity')
              : channel.nextAction || channel.reason)
          }
        </div>
      </div>
    </div>
  );
}

function ShareButton({ label, onClick, active }: {
  label: string; onClick: () => void; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px', borderRadius: 6,
        border: `1px solid ${active ? '#059669' : BONE}`,
        background: active ? '#E6F8EE' : WHITE,
        fontSize: 11, fontWeight: 700, color: active ? '#059669' : INK,
        cursor: 'pointer', fontFamily: MONO, transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}
