'use client';

import { useState } from 'react';
import Link from 'next/link';
import { fmtNum } from '@/lib/artists';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SpotlightVideo = {
  id: string;
  title: string;
  views: number;
  velocity: number;
  daysAgo: number;
  format: string;
  isShort: boolean;
  thumbnail?: string;
};

export type SpotlightChannel = {
  slug: string;
  name: string;
  subs: number | null;
  subs7d: number | null;
  views7d: number | null;
  viewsWoW: number | null;
  subsPer1kViews: number | null;
  uploads30d: number;
  shorts30d: number;
  longform30d: number;
  status: string;
  classification: string;
  multiformatScore: string | null;
  ecosystemSignal: string;
  headline: string;
  whatsWorking: string[];
  recentVideos: SpotlightVideo[];
  hasCoachPlan: boolean;
  currentMoment: string | null;
  nextMoment: string | null;
  upcomingMoment: string | null;
  grade: string;
  scoreLabel: string;
  spotlightScore: number;
  thumbnail?: string | null;
  channelHandle?: string | null;
  heroImage?: string | null;
  contentFormats?: string[];
};

// ─── Design tokens ───────────────────────────────────────────────────────────

const INK   = '#0E0E0E';
const PAPER = '#FAF7F2';
const SMOKE = '#8A847A';
const GHOST = '#C8C2B8';
const BONE  = '#E8E3DA';
const WHITE = '#FFFFFF';
const WARM  = '#4A4640';
const GREEN = '#2D6A4F';
const AMBER = '#9A6324';

const GRADE_COLOR: Record<string, string> = {
  A: '#1B8F5A', B: '#3B7DD8', C: '#D97706', D: '#DC2626', Limited: '#9CA3AF',
};
const GRADE_BG: Record<string, string> = {
  A: '#ECFDF5', B: '#EFF6FF', C: '#FFFBEB', D: '#FEF2F2', Limited: '#F9FAFB',
};
const FORMAT_STYLE: Record<string, { bg: string; fg: string }> = {
  'Official Video': { bg: '#E6F8EE', fg: GREEN },
  'Lyric Video':    { bg: '#E8F0FE', fg: '#1A56B8' },
  'Visualiser':     { bg: '#F0E8FE', fg: '#6B21A8' },
  'BTS':            { bg: '#FFF5D6', fg: '#7A5A00' },
  'Live Session':   { bg: '#FFEAD6', fg: '#8A4A1A' },
  'Shorts':         { bg: '#F3F0EA', fg: WARM },
  'Collab':         { bg: '#E6F8EE', fg: GREEN },
  'Premiere':       { bg: '#E8F0FE', fg: '#1A56B8' },
  'Trailer':        { bg: '#FFF5D6', fg: '#7A5A00' },
};

const ECO_STYLE: Record<string, { bg: string; fg: string }> = {
  'Full Ecosystem':      { bg: '#E6F8EE', fg: GREEN },
  'Multi-Format Active': { bg: '#E8F0FE', fg: '#1A56B8' },
  'Shorts Momentum':     { bg: '#F0E8FE', fg: '#6B21A8' },
  'Building':            { bg: '#FFF5D6', fg: '#7A5A00' },
  'Getting Started':     { bg: '#F3F0EA', fg: 'rgba(14,14,14,0.4)' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDelta(n: number | null): string {
  if (n == null) return '—';
  const sign = n >= 0 ? '+' : '';
  if (Math.abs(n) >= 1_000_000) return `${sign}${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${sign}${(n / 1_000).toFixed(1)}K`;
  return `${sign}${n}`;
}

function fmtVelocity(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M/day`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K/day`;
  return `${v}/day`;
}

function ytUrl(id: string, isShort: boolean): string {
  return isShort
    ? `https://www.youtube.com/shorts/${id}`
    : `https://www.youtube.com/watch?v=${id}`;
}

function channelUrl(handle: string | null): string | null {
  if (!handle) return null;
  return `https://www.youtube.com/${handle.startsWith('@') ? handle : `@${handle}`}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function WeeklySpotlight({
  channels,
  linkPrefix = '/watcher',
}: {
  channels: SpotlightChannel[];
  linkPrefix?: string;
}) {
  const [expandedSlug, setExpandedSlug] = useState<string | null>(
    channels.length > 0 ? channels[0].slug : null
  );

  if (channels.length === 0) return null;

  return (
    <div>
      <style>{`
        .spot-card { transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .spot-card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.08); }
        .spot-hero-img { transition: transform 0.4s ease; }
        .spot-card:hover .spot-hero-img { transform: scale(1.03); }
        .spot-vid { transition: transform 0.15s ease, box-shadow 0.15s ease; border-radius: 6px; overflow: hidden; }
        .spot-vid:hover { transform: scale(1.03); box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
      `}</style>

      {/* ─── Channel selector tabs (with avatars) ─────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {channels.map((ch, i) => {
          const isActive = expandedSlug === ch.slug;
          return (
            <button
              key={ch.slug}
              onClick={() => setExpandedSlug(isActive ? null : ch.slug)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 14px 6px 6px',
                borderRadius: 24, border: 'none', cursor: 'pointer',
                background: isActive ? INK : WHITE,
                color: isActive ? WHITE : WARM,
                fontSize: 12, fontWeight: isActive ? 700 : 500,
                boxShadow: isActive ? 'none' : `0 0 0 1px ${BONE}`,
                transition: 'all 0.2s ease',
              }}
            >
              {ch.thumbnail ? (
                <img
                  src={ch.thumbnail}
                  alt=""
                  style={{
                    width: 24, height: 24, borderRadius: '50%', objectFit: 'cover',
                    border: isActive ? '2px solid rgba(255,255,255,0.3)' : `2px solid ${BONE}`,
                  }}
                />
              ) : (
                <span style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: isActive ? 'rgba(255,255,255,0.15)' : BONE,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700,
                }}>
                  {i + 1}
                </span>
              )}
              {ch.name}
            </button>
          );
        })}
      </div>

      {/* ─── Expanded card ────────────────────────────────────────── */}
      {channels.map((ch) => {
        if (expandedSlug !== ch.slug) return null;
        const ecoStyle = ECO_STYLE[ch.ecosystemSignal] ?? ECO_STYLE['Getting Started'];
        const gradeColor = GRADE_COLOR[ch.grade] ?? GRADE_COLOR.Limited;
        const gradeBg = GRADE_BG[ch.grade] ?? GRADE_BG.Limited;
        const chUrl = channelUrl(ch.channelHandle ?? null);

        return (
          <div
            key={ch.slug}
            className="spot-card"
            style={{
              background: WHITE, borderRadius: 14,
              border: `1px solid ${BONE}`, overflow: 'hidden',
            }}
          >
            {/* ── Hero image + overlay ──────────────────────────── */}
            {ch.heroImage && (
              <div style={{ position: 'relative', overflow: 'hidden', height: 200 }}>
                <img
                  src={ch.heroImage}
                  alt=""
                  loading="lazy"
                  className="spot-hero-img"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(transparent 30%, rgba(0,0,0,0.65) 100%)',
                }} />
                {/* Artist name + avatar on image */}
                <div style={{
                  position: 'absolute', bottom: 16, left: 20,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  {ch.thumbnail && (
                    <img src={ch.thumbnail} alt="" style={{
                      width: 36, height: 36, borderRadius: '50%', objectFit: 'cover',
                      border: '2px solid rgba(255,255,255,0.3)',
                    }} />
                  )}
                  <div>
                    {chUrl ? (
                      <a href={chUrl} target="_blank" rel="noopener noreferrer"
                        style={{ color: WHITE, textDecoration: 'none', fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>
                        {ch.name}
                      </a>
                    ) : (
                      <span style={{ color: WHITE, fontSize: 18, fontWeight: 800 }}>{ch.name}</span>
                    )}
                  </div>
                </div>
                {/* Ecosystem signal on image — kept minimal */}
              </div>
            )}

            {/* ── Body ─────────────────────────────────────────── */}
            <div style={{ padding: '20px 24px 24px' }}>

              {/* No hero fallback: show name inline */}
              {!ch.heroImage && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  {ch.thumbnail && (
                    <img src={ch.thumbnail} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${BONE}` }} />
                  )}
                  <div style={{ fontSize: 18, fontWeight: 800, color: INK }}>{ch.name}</div>
                </div>
              )}

              {/* Headline */}
              <p style={{ fontSize: 14, lineHeight: 1.5, color: WARM, margin: '0 0 12px', maxWidth: 600 }}>
                {ch.headline}
              </p>

              {/* ── Content format tags ────────────────────────── */}
              {ch.contentFormats && ch.contentFormats.length > 0 && (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 16 }}>
                  {ch.contentFormats.map((fmt) => {
                    const s = FORMAT_STYLE[fmt] ?? { bg: '#F3F0EA', fg: WARM };
                    return (
                      <span
                        key={fmt}
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: 20,
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          background: s.bg,
                          color: s.fg,
                        }}
                      >
                        {fmt}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* ── Stats grid ─────────────────────────────────── */}
              <div className="spot-stats-grid" style={{
                display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12,
                padding: '14px 16px', borderRadius: 10, background: PAPER, marginBottom: 20,
              }}>
                <StatCell value={ch.subs != null ? fmtNum(ch.subs) : '—'} label="Subscribers" />
                <StatCell value={fmtDelta(ch.subs7d)} label="Subs (7d)" color={ch.subs7d != null && ch.subs7d > 0 ? GREEN : undefined} />
                <StatCell value={ch.views7d != null ? fmtNum(ch.views7d) : '—'} label="Views (7d)" />
                <StatCell
                  value={ch.viewsWoW != null ? `${ch.viewsWoW >= 0 ? '+' : ''}${Math.round(ch.viewsWoW)}%` : '—'}
                  label="Views WoW"
                  color={ch.viewsWoW != null ? (ch.viewsWoW > 5 ? GREEN : ch.viewsWoW < -10 ? '#8A1F0C' : undefined) : undefined}
                />
                <StatCell
                  value={ch.subsPer1kViews != null ? ch.subsPer1kViews.toFixed(1) : '—'}
                  label="Subs / 1K Views"
                  color={ch.subsPer1kViews != null && ch.subsPer1kViews >= 3 ? GREEN : undefined}
                />
                <StatCell
                  value={`${ch.uploads30d}`}
                  label="Uploads (30d)"
                  sublabel={`${ch.longform30d} longform · ${ch.shorts30d} Shorts`}
                  color={ch.uploads30d >= 8 ? GREEN : ch.uploads30d >= 4 ? AMBER : undefined}
                />
              </div>

              {/* ── What's working ──────────────────────────────── */}
              {ch.whatsWorking.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: GHOST, marginBottom: 8,
                  }}>
                    What&apos;s Working
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {ch.whatsWorking.map((note, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'start', gap: 8, fontSize: 12, lineHeight: 1.5 }}>
                        <span style={{
                          width: 5, height: 5, borderRadius: '50%', background: GREEN,
                          marginTop: 6, flexShrink: 0,
                        }} />
                        <span style={{ color: WARM }}>{note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Recent videos (thumbnail grid) ─────────────── */}
              {ch.recentVideos.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: GHOST, marginBottom: 10,
                  }}>
                    Recent Uploads
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${Math.min(ch.recentVideos.length, 3)}, 1fr)`,
                    gap: 10,
                  }}>
                    {ch.recentVideos.slice(0, 3).map((v) => (
                      <a
                        key={v.id}
                        href={ytUrl(v.id, v.isShort)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="spot-vid"
                        style={{ display: 'block', textDecoration: 'none', color: INK }}
                      >
                        <div style={{ position: 'relative' }}>
                          <img
                            src={v.thumbnail || `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`}
                            alt=""
                            loading="lazy"
                            style={{
                              width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block',
                              borderRadius: '6px 6px 0 0',
                            }}
                          />
                          <div style={{
                            position: 'absolute', inset: 0,
                            background: 'linear-gradient(transparent 50%, rgba(0,0,0,0.4) 100%)',
                            borderRadius: '6px 6px 0 0',
                          }} />
                          {/* Format badge */}
                          <span style={{
                            position: 'absolute', top: 6, left: 6,
                            padding: '2px 7px', borderRadius: 4,
                            fontSize: 8, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                            background: v.isShort ? 'rgba(107,33,168,0.85)' : 'rgba(26,86,184,0.85)',
                            color: WHITE, backdropFilter: 'blur(4px)',
                          }}>
                            {v.isShort ? 'Short' : v.format}
                          </span>
                          {/* Velocity badge */}
                          <span style={{
                            position: 'absolute', bottom: 6, right: 6,
                            padding: '2px 7px', borderRadius: 4,
                            fontSize: 9, fontWeight: 700,
                            background: 'rgba(0,0,0,0.65)', color: WHITE,
                            backdropFilter: 'blur(4px)',
                          }}>
                            {fmtVelocity(v.velocity)}
                          </span>
                        </div>
                        <div style={{ padding: '8px 8px 10px', background: PAPER, borderRadius: '0 0 6px 6px' }}>
                          <div style={{
                            fontSize: 11, fontWeight: 600, color: INK, lineHeight: 1.3,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {v.title}
                          </div>
                          <div style={{ fontSize: 10, color: SMOKE, marginTop: 3 }}>
                            {fmtNum(v.views)} views · {v.daysAgo}d ago
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>

                  {/* Remaining videos as compact rows */}
                  {ch.recentVideos.length > 3 && (
                    <div style={{ marginTop: 8 }}>
                      {ch.recentVideos.slice(3).map((v) => (
                        <a
                          key={v.id}
                          href={ytUrl(v.id, v.isShort)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '5px 0', textDecoration: 'none', color: INK,
                            borderBottom: `1px solid ${BONE}`,
                          }}
                        >
                          <img
                            src={v.thumbnail || `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`}
                            alt="" loading="lazy"
                            style={{ width: 48, height: 27, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }}
                          />
                          <span style={{
                            padding: '1px 5px', borderRadius: 3, fontSize: 8, fontWeight: 700,
                            textTransform: 'uppercase',
                            background: v.isShort ? '#F0E8FE' : '#E8F0FE',
                            color: v.isShort ? '#6B21A8' : '#1A56B8', flexShrink: 0,
                          }}>
                            {v.isShort ? 'Short' : v.format}
                          </span>
                          <span style={{ flex: 1, fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                            {v.title}
                          </span>
                          <span style={{ fontSize: 10, color: SMOKE, flexShrink: 0 }}>
                            {fmtNum(v.views)}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 600, color: v.velocity >= 5000 ? GREEN : SMOKE, flexShrink: 0 }}>
                            {fmtVelocity(v.velocity)}
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Pipeline ahead ─────────────────────────────── */}
              {ch.hasCoachPlan && (ch.currentMoment || ch.nextMoment || ch.upcomingMoment) && (
                <div>
                  <div style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: GHOST, marginBottom: 8,
                  }}>
                    Pipeline Ahead
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 11 }}>
                    {ch.currentMoment && <PipelineChip label="Current" value={ch.currentMoment} />}
                    {ch.nextMoment && (
                      <><span style={{ color: GHOST }}>→</span><PipelineChip label="Next" value={ch.nextMoment} /></>
                    )}
                    {ch.upcomingMoment && (
                      <><span style={{ color: GHOST }}>→</span><PipelineChip label="Upcoming" value={ch.upcomingMoment} /></>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCell({ value, label, sublabel, color }: { value: string; label: string; sublabel?: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color ?? INK, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div style={{ fontSize: 9, color: SMOKE, marginTop: 1 }}>{label}</div>
      {sublabel && <div style={{ fontSize: 8, color: GHOST, marginTop: 1 }}>{sublabel}</div>}
    </div>
  );
}

function PipelineChip({ label, value }: { label: string; value: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '5px 10px', borderRadius: 6,
      background: '#F6F1E7', fontSize: 11,
    }}>
      <span style={{ fontWeight: 700, color: SMOKE }}>{label}:</span>
      <span style={{ fontWeight: 500, color: INK }}>{value}</span>
    </span>
  );
}
