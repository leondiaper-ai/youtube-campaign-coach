'use client';

import { useState, useEffect, useRef } from 'react';

// ── Design System (matched to Music Decision site) ───────────────────────────

const INK    = '#0E0E0E';
const PAPER  = '#FAF7F2';
const SMOKE  = '#8A847A';
const GHOST  = '#C8C2B8';
const BONE   = '#E8E3DA';
const WHITE  = '#FFFFFF';
const WARM   = '#4A4640';
const FAINT  = 'rgba(14,14,14,0.06)';

// Accent tones — muted, editorial
const ACCENT = {
  green:  '#2D6A4F',
  amber:  '#9A6324',
  ochre:  '#7A6520',
  ember:  '#8A3A2A',
  coral:  '#C75D3A',
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

  // Error
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

  // Derived
  const momentumChannels = managed.filter(c => c.classification === 'GROWING')
    .sort((a, b) => (b.views7d ?? 0) - (a.views7d ?? 0)).slice(0, 4);

  const issueChannels = managed.filter(c => c.classification !== 'GROWING');
  type IssueGroup = { label: string; partnerLabel: string; count: number; topChannels: PulseChannel[] };
  const issueGroups: IssueGroup[] = [
    { label: 'Weak Conversion', partnerLabel: 'Conversion opportunity', count: issueChannels.filter(c => c.classification === 'WEAK_CONVERSION').length, topChannels: issueChannels.filter(c => c.classification === 'WEAK_CONVERSION').slice(0, 3) },
    { label: 'Underfed', partnerLabel: 'Cadence opportunity', count: issueChannels.filter(c => c.classification === 'UNDERFED').length, topChannels: issueChannels.filter(c => c.classification === 'UNDERFED').slice(0, 3) },
    { label: 'Cold', partnerLabel: 'Reactivation', count: issueChannels.filter(c => c.classification === 'COLD').length, topChannels: issueChannels.filter(c => c.classification === 'COLD').slice(0, 3) },
  ].filter(g => g.count > 0);

  const consistentMarket = market.filter(c => c.uploads30d >= 5 && c.classification === 'GROWING')
    .sort((a, b) => b.uploads30d - a.uploads30d).slice(0, 4);

  const featureVideo = data.topVideos[0] ?? null;
  const supportingVideos = data.topVideos.slice(1, 3);
  const topShorts = data.topShorts.slice(0, 3);

  // Email/Slack generators
  function generateEmailBody(): string {
    const topVids = data!.topVideos.slice(0, 3).map(v => `${v.channelName} — "${v.title}" (${fmtNum(v.viewCount)} views)`);
    return `Subject: YouTube Weekly Pulse — ${data!.weekRange}\n\n${data!.editorial}\n\nTop moments:\n${topVids.map(v => `- ${v}`).join('\n')}\n\nSignals: ${data!.signals.growing} growing · ${data!.signals.cold} cold · ${data!.signals.weakConversion} weak conversion\n\nPlaybook: ${data!.playbook.title}`;
  }
  function generateSlackSummary(): string {
    const topVids = data!.topVideos.slice(0, 3).map(v => `• ${v.channelName} — ${fmtNum(v.viewCount)} views`);
    return `*YouTube Weekly Pulse — ${data!.weekRange}*\n\n${data!.editorial}\n\n*Top:*\n${topVids.join('\n')}\n\n*Signals:* ${data!.signals.growing} growing · ${data!.signals.cold} cold\n\n*Play:* ${data!.playbook.title}`;
  }
  function copyToClipboard(text: string, type: 'email' | 'slack') {
    navigator.clipboard.writeText(text).then(() => {
      if (type === 'email') { setEmailCopied(true); setTimeout(() => setEmailCopied(false), 2000); }
      if (type === 'slack') { setSlackCopied(true); setTimeout(() => setSlackCopied(false), 2000); }
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════════════════ */

  return (
    <div ref={pageRef} style={{ background: PAPER, minHeight: '100vh', color: INK, overflowX: 'hidden' }}>
      <style>{`
        @media print { .no-print { display: none !important; } }
        a.pulse-link { text-decoration: none; color: inherit; }
        a.pulse-link:hover { opacity: 0.85; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .pulse-fade { animation: fadeUp 0.6s ease-out both; }
      `}</style>


      {/* ══════════════════════════════════════════════════════════════════════
          TOP BAR — Logos + controls
      ══════════════════════════════════════════════════════════════════════ */}
      {!screenshotMode && (
        <div className="no-print" style={{
          maxWidth: 1100, margin: '0 auto', padding: '20px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* Virgin Music wordmark */}
            <svg width="80" height="16" viewBox="0 0 80 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <text x="0" y="12" fill={INK} fontSize="11" fontWeight="800" letterSpacing="0.08em" fontFamily="Inter, system-ui, sans-serif">VIRGIN</text>
            </svg>
            <span style={{ color: BONE, fontSize: 14 }}>×</span>
            {/* YouTube wordmark */}
            <svg width="70" height="16" viewBox="0 0 70 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <text x="0" y="12" fill="#FF0000" fontSize="11" fontWeight="800" letterSpacing="0.04em" fontFamily="Inter, system-ui, sans-serif">YouTube</text>
            </svg>
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
          HERO — The editorial anchor
      ══════════════════════════════════════════════════════════════════════ */}
      <header className="pulse-fade" style={{
        maxWidth: 1100, margin: '0 auto', padding: '60px 32px 0',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
          textTransform: 'uppercase' as const, color: GHOST,
        }}>
          Weekly Intelligence Briefing
        </div>

        <h1 style={{
          fontSize: 72, fontWeight: 800, lineHeight: 0.92,
          letterSpacing: '-0.04em', color: INK,
          margin: '20px 0 0', maxWidth: 700,
        }}>
          Weekly<br />Pulse.
        </h1>

        <div style={{
          marginTop: 20, fontSize: 11, fontWeight: 600,
          letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: SMOKE,
        }}>
          {data.weekRange}
        </div>
      </header>

      {/* Editorial lede — the emotional anchor */}
      <section className="pulse-fade" style={{
        maxWidth: 1100, margin: '0 auto', padding: '48px 32px 0',
      }}>
        <div style={{ maxWidth: 580 }}>
          <p style={{
            fontSize: 24, fontWeight: 500, color: INK,
            lineHeight: 1.45, letterSpacing: '-0.01em',
            margin: 0,
          }}>
            {data.editorial}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 32, fontSize: 10, color: GHOST }}>
          <span>{data.signals.totalManaged} managed</span>
          <span>{data.signals.totalMarket} market watch</span>
          {data.lastSyncAt && <span>Synced {timeAgo(data.lastSyncAt)}</span>}
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════════════
          SIGNALS — confident numbers, not dashboard
      ══════════════════════════════════════════════════════════════════════ */}
      <section style={{
        maxWidth: 1100, margin: '0 auto', padding: '80px 32px 0',
      }}>
        <div style={{ height: 1, background: BONE, marginBottom: 48 }} />

        <div style={{ display: 'flex', gap: 0 }}>
          {[
            { n: data.signals.growing, label: isPartner ? 'Growing' : 'Growing', color: ACCENT.green },
            { n: data.signals.weakConversion, label: isPartner ? 'Conversion gap' : 'Weak conversion', color: ACCENT.amber },
            { n: data.signals.underfed, label: isPartner ? 'Low cadence' : 'Underfed', color: ACCENT.ochre },
            { n: data.signals.cold, label: isPartner ? 'Reactivation' : 'Cold', color: ACCENT.ember },
          ].map((sig, i) => (
            <div key={i} style={{
              flex: 1, paddingLeft: i === 0 ? 0 : 28,
              borderLeft: i === 0 ? 'none' : `1px solid ${BONE}`,
            }}>
              <div style={{
                fontSize: 48, fontWeight: 800, color: sig.color,
                lineHeight: 1, letterSpacing: '-0.03em',
              }}>
                {sig.n}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: SMOKE, marginTop: 8, letterSpacing: '0.02em' }}>
                {sig.label}
              </div>
            </div>
          ))}
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════════════
          THE BIG READ — editorial intelligence
      ══════════════════════════════════════════════════════════════════════ */}
      {data.insights.length > 0 && (
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '100px 32px 0' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '200px 1fr', gap: 40,
          }}>
            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
                textTransform: 'uppercase' as const, color: GHOST, marginBottom: 12,
              }}>
                The Big Read
              </div>
              <div style={{
                fontSize: 11, color: SMOKE, lineHeight: 1.5,
              }}>
                {data.signals.totalManaged} channels tracked.<br />
                {data.signals.growing + data.signals.weakConversion + data.signals.underfed + data.signals.cold} classified this week.
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              {data.insights.slice(0, 4).map((insight, i) => (
                <p key={i} style={{
                  fontSize: i === 0 ? 20 : 15,
                  fontWeight: i === 0 ? 500 : 400,
                  color: i === 0 ? INK : WARM,
                  lineHeight: 1.55, margin: 0,
                  maxWidth: 560,
                }}>
                  {insight}
                </p>
              ))}
            </div>
          </div>
        </section>
      )}


      {/* ══════════════════════════════════════════════════════════════════════
          FEATURED MOMENT — magazine hero
      ══════════════════════════════════════════════════════════════════════ */}
      {featureVideo && (
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '100px 32px 0' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
            textTransform: 'uppercase' as const, color: GHOST, marginBottom: 28,
          }}>
            Moments This Week
          </div>

          {/* Feature — full cinematic */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
            <a href={ytUrl(featureVideo.id, featureVideo.durationSec)} target="_blank" rel="noopener noreferrer"
              className="pulse-link" style={{ display: 'block' }}>
              <div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden' }}>
                <img src={featureVideo.thumbnail} alt="" loading="lazy"
                  style={{ width: '100%', height: 380, objectFit: 'cover', display: 'block' }} />
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  padding: '60px 28px 24px',
                  background: 'linear-gradient(transparent 0%, rgba(0,0,0,0.75) 100%)',
                }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
                    textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.6)', marginBottom: 6,
                  }}>
                    {featureVideo.format}
                  </div>
                  <div style={{
                    fontSize: 26, fontWeight: 800, color: WHITE,
                    lineHeight: 1.15, letterSpacing: '-0.02em',
                  }}>
                    {featureVideo.title}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{featureVideo.channelName}</span>
                <span style={{ fontSize: 12, color: SMOKE }}>{fmtNum(featureVideo.viewCount)} views</span>
                <span style={{ fontSize: 12, color: GHOST }}>{fmtNum(featureVideo.velocity)}/day</span>
              </div>
            </a>

            {/* Supporting stack */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {supportingVideos.map(v => (
                <a key={v.id} href={ytUrl(v.id, v.durationSec)} target="_blank" rel="noopener noreferrer"
                  className="pulse-link" style={{ display: 'block' }}>
                  <div style={{ borderRadius: 4, overflow: 'hidden' }}>
                    <img src={v.thumbnail} alt="" loading="lazy"
                      style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block' }} />
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                      textTransform: 'uppercase' as const, color: SMOKE, marginBottom: 3,
                    }}>
                      {v.channelName}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.3 }}>
                      {v.title}
                    </div>
                    <div style={{ fontSize: 10, color: GHOST, marginTop: 4 }}>
                      {fmtNum(v.viewCount)} views · {fmtNum(v.velocity)}/day
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Shorts — quiet inline mention */}
          {topShorts.length > 0 && (
            <div style={{ marginTop: 40, display: 'flex', gap: 32, alignItems: 'flex-start' }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase' as const, color: GHOST, paddingTop: 2, flexShrink: 0, width: 80,
              }}>
                Shorts
              </div>
              <div style={{ display: 'flex', gap: 24, flex: 1 }}>
                {topShorts.map(v => (
                  <a key={v.id} href={ytUrl(v.id, v.durationSec)} target="_blank" rel="noopener noreferrer"
                    className="pulse-link" style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.3 }}>
                      {v.title.length > 50 ? v.title.substring(0, 50) + '…' : v.title}
                    </div>
                    <div style={{ fontSize: 10, color: SMOKE, marginTop: 3 }}>
                      {v.channelName} · {fmtNum(v.viewCount)}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>
      )}


      {/* ══════════════════════════════════════════════════════════════════════
          MOMENTUM — curated editorial mentions
      ══════════════════════════════════════════════════════════════════════ */}
      {momentumChannels.length > 0 && (
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '100px 32px 0' }}>
          <div style={{ height: 1, background: BONE, marginBottom: 48 }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60 }}>
            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
                textTransform: 'uppercase' as const, color: GHOST, marginBottom: 14,
              }}>
                Channels With Momentum
              </div>
              <h2 style={{
                fontSize: 32, fontWeight: 800, lineHeight: 1.1,
                letterSpacing: '-0.02em', color: INK, margin: 0,
              }}>
                {momentumChannels.length} channels<br />
                <span style={{ color: ACCENT.green }}>in growth state.</span>
              </h2>
              <p style={{ fontSize: 14, color: SMOKE, lineHeight: 1.5, marginTop: 16, maxWidth: 360 }}>
                Consistent cadence and conversion are the common thread. These are the channels setting the pace this week.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {momentumChannels.map((ch, i) => (
                <div key={ch.slug} style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '20px 0',
                  borderBottom: i < momentumChannels.length - 1 ? `1px solid ${BONE}` : 'none',
                }}>
                  {ch.thumbnail && (
                    <img src={ch.thumbnail} alt="" loading="lazy"
                      style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{ch.name}</div>
                    <div style={{ fontSize: 11, color: SMOKE, marginTop: 2 }}>
                      {ch.uploads30d} uploads/30d
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT.green }}>{ch.views7d != null ? fmtNum(ch.views7d) : '—'}</div>
                    <div style={{ fontSize: 9, color: GHOST }}>7d views</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}


      {/* ══════════════════════════════════════════════════════════════════════
          OPPORTUNITIES — curated, not exhaustive
      ══════════════════════════════════════════════════════════════════════ */}
      {issueGroups.length > 0 && (
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '100px 32px 0' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
            textTransform: 'uppercase' as const, color: GHOST, marginBottom: 14,
          }}>
            {isPartner ? 'Opportunities' : 'Open Opportunities'}
          </div>
          <h2 style={{
            fontSize: 32, fontWeight: 800, lineHeight: 1.1,
            letterSpacing: '-0.02em', color: INK, margin: '0 0 40px',
            maxWidth: 500,
          }}>
            Where attention<br />
            <span style={{ fontStyle: 'italic', fontWeight: 500, color: WARM }}>isn&apos;t converting.</span>
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 40 }}>
            {issueGroups.map((group, gi) => (
              <div key={gi}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20 }}>
                  <span style={{ fontSize: 36, fontWeight: 800, color: INK, lineHeight: 1, letterSpacing: '-0.02em' }}>
                    {group.count}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: SMOKE }}>
                    {isPartner ? group.partnerLabel : group.label}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {group.topChannels.map(ch => (
                    <div key={ch.slug} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {ch.thumbnail && (
                        <img src={ch.thumbnail} alt="" loading="lazy"
                          style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      )}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{ch.name}</div>
                        <div style={{ fontSize: 10, color: SMOKE }}>
                          {ch.nextAction || ch.reason}
                        </div>
                      </div>
                    </div>
                  ))}
                  {group.count > 3 && (
                    <div style={{ fontSize: 10, color: GHOST, marginTop: 4 }}>
                      + {group.count - 3} more
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}


      {/* ══════════════════════════════════════════════════════════════════════
          MARKET WATCH — editorial intelligence
      ══════════════════════════════════════════════════════════════════════ */}
      {(data.marketInsights.length > 0 || consistentMarket.length > 0) && (
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '100px 32px 0' }}>
          <div style={{ height: 1, background: BONE, marginBottom: 48 }} />

          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 60 }}>
            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
                textTransform: 'uppercase' as const, color: GHOST, marginBottom: 14,
              }}>
                Market Watch
              </div>
              <h2 style={{
                fontSize: 28, fontWeight: 800, lineHeight: 1.1,
                letterSpacing: '-0.02em', color: INK, margin: 0,
              }}>
                What the wider<br />market is<br />
                <span style={{ fontStyle: 'italic', fontWeight: 500, color: WARM }}>teaching us.</span>
              </h2>

              {consistentMarket.length > 0 && (
                <div style={{ marginTop: 32 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: GHOST, marginBottom: 12 }}>
                    Reference channels
                  </div>
                  {consistentMarket.map(ch => (
                    <div key={ch.slug} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      {ch.thumbnail && (
                        <img src={ch.thumbnail} alt="" loading="lazy"
                          style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                      )}
                      <span style={{ fontSize: 12, fontWeight: 600, color: INK }}>{ch.name}</span>
                      <span style={{ fontSize: 10, color: GHOST }}>{ch.uploads30d}/30d</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 32 }}>
              {data.marketInsights.map((insight, i) => (
                <p key={i} style={{
                  fontSize: i === 0 ? 18 : 14,
                  fontWeight: i === 0 ? 500 : 400,
                  color: i === 0 ? INK : WARM,
                  lineHeight: 1.55, margin: 0, maxWidth: 500,
                }}>
                  {insight}
                </p>
              ))}
            </div>
          </div>
        </section>
      )}


      {/* ══════════════════════════════════════════════════════════════════════
          PLAYBOOK — dark editorial feature
      ══════════════════════════════════════════════════════════════════════ */}
      <section style={{
        background: INK, color: PAPER, marginTop: 100,
        padding: '80px 0',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60 }}>
            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
                textTransform: 'uppercase' as const, color: 'rgba(250,247,242,0.4)', marginBottom: 20,
              }}>
                Playbook of the Week
              </div>
              <h2 style={{
                fontSize: 40, fontWeight: 800, lineHeight: 1.05,
                letterSpacing: '-0.03em', color: PAPER, margin: 0,
              }}>
                {data.playbook.title}
              </h2>
              <p style={{
                fontSize: 16, fontWeight: 400, color: 'rgba(250,247,242,0.7)',
                lineHeight: 1.6, marginTop: 24, maxWidth: 420,
              }}>
                {data.playbook.why}
              </p>
              <p style={{
                fontSize: 12, fontStyle: 'italic', color: 'rgba(250,247,242,0.4)',
                marginTop: 16,
              }}>
                {data.playbook.when}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, paddingTop: 8 }}>
              {data.playbook.actions.map((action, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 20, alignItems: 'flex-start',
                  padding: '24px 0',
                  borderBottom: i < data.playbook.actions.length - 1 ? '1px solid rgba(250,247,242,0.1)' : 'none',
                }}>
                  <span style={{
                    fontSize: 42, fontWeight: 800, color: 'rgba(250,247,242,0.15)',
                    lineHeight: 1, minWidth: 40,
                    letterSpacing: '-0.03em',
                  }}>
                    {i + 1}
                  </span>
                  <p style={{
                    fontSize: 14, color: 'rgba(250,247,242,0.85)',
                    lineHeight: 1.55, margin: 0, paddingTop: 8,
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
          SHARE — minimal
      ══════════════════════════════════════════════════════════════════════ */}
      {!screenshotMode && (
        <section id="pulse-share" className="no-print" style={{
          maxWidth: 1100, margin: '0 auto', padding: '60px 32px',
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.18em',
            textTransform: 'uppercase' as const, color: GHOST, marginBottom: 20,
          }}>
            Share This Briefing
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <ActionPill label={emailCopied ? 'Copied' : 'Email summary'} onClick={() => copyToClipboard(generateEmailBody(), 'email')} active={emailCopied} />
            <ActionPill label={slackCopied ? 'Copied' : 'Slack summary'} onClick={() => copyToClipboard(generateSlackSummary(), 'slack')} active={slackCopied} />
            <ActionPill label="Screenshot" onClick={() => setScreenshotMode(true)} />
            <ActionPill label="Print / PDF" onClick={() => window.print()} />
          </div>
        </section>
      )}


      {/* Colophon */}
      <footer style={{
        maxWidth: 1100, margin: '0 auto', padding: '20px 32px 40px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: GHOST }}>
          YouTube Weekly Pulse · {data.weekRange}
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
      padding: '8px 18px', borderRadius: 20, border: 'none',
      background: active ? INK : WHITE, fontSize: 11, fontWeight: 600,
      color: active ? WHITE : INK, cursor: 'pointer', transition: 'all 0.2s',
    }}>
      {label}
    </button>
  );
}
