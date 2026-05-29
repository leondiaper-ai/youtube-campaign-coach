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
};

// ─── Constants ────────────────────────────────────────────────────────────────

const INK = '#0E0E0E';
const MUTED = '#E9E2D3';
const GREEN = '#2D6A4F';
const GREEN_BG = '#E6F8EE';
const AMBER = '#9A6324';
const AMBER_BG = '#FFF5D6';

const GRADE_COLOR: Record<string, string> = {
  A: '#1B8F5A', B: '#3B7DD8', C: '#D97706', D: '#DC2626', Limited: '#9CA3AF',
};
const GRADE_BG: Record<string, string> = {
  A: '#ECFDF5', B: '#EFF6FF', C: '#FFFBEB', D: '#FEF2F2', Limited: '#F9FAFB',
};

const ECO_STYLE: Record<string, { bg: string; fg: string }> = {
  'Full Ecosystem':    { bg: GREEN_BG, fg: GREEN },
  'Multi-Format Active': { bg: '#E8F0FE', fg: '#1A56B8' },
  'Shorts Momentum':   { bg: '#F0E8FE', fg: '#6B21A8' },
  'Getting Started':   { bg: '#F3F0EA', fg: 'rgba(14,14,14,0.4)' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

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
    <div
      className="rounded-xl mb-4"
      style={{ background: '#FFFFFF', border: `1px solid ${MUTED}` }}
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <div>
          <div
            className="text-[9px] font-black uppercase tracking-[0.18em]"
            style={{ color: 'rgba(14,14,14,0.35)' }}
          >
            Weekly Channel Spotlight
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: 'rgba(14,14,14,0.4)' }}>
            Top performing Virgin-managed channels this week
          </div>
        </div>
        <span
          className="px-2 py-1 rounded-md text-[10px] font-bold"
          style={{ background: GREEN_BG, color: GREEN }}
        >
          {channels.length} channel{channels.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Channel tabs */}
      <div className="px-5 flex gap-1 mb-1">
        {channels.map((ch, i) => {
          const isActive = expandedSlug === ch.slug;
          return (
            <button
              key={ch.slug}
              onClick={() => setExpandedSlug(isActive ? null : ch.slug)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all"
              style={{
                background: isActive ? '#0E0E0E' : '#F6F1E7',
                color: isActive ? '#FFFFFF' : 'rgba(14,14,14,0.5)',
              }}
            >
              <span className="text-[10px] font-black" style={{ opacity: 0.5 }}>
                {i + 1}
              </span>
              {ch.name}
            </button>
          );
        })}
      </div>

      {/* Expanded report card */}
      {channels.map((ch) => {
        if (expandedSlug !== ch.slug) return null;
        const ecoStyle = ECO_STYLE[ch.ecosystemSignal] ?? ECO_STYLE['Getting Started'];
        const gradeColor = GRADE_COLOR[ch.grade] ?? GRADE_COLOR.Limited;
        const gradeBg = GRADE_BG[ch.grade] ?? GRADE_BG.Limited;

        return (
          <div key={ch.slug} className="px-5 py-4">
            {/* Headline */}
            <div className="mb-3">
              <Link
                href={`${linkPrefix}/${ch.slug}`}
                className="text-[15px] font-black hover:underline"
                style={{ color: INK, textDecoration: 'none' }}
              >
                {ch.name}
              </Link>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                  style={{ background: gradeBg, color: gradeColor }}
                >
                  Score {ch.grade}
                </span>
                <span
                  className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                  style={{ background: ecoStyle.bg, color: ecoStyle.fg }}
                >
                  {ch.ecosystemSignal}
                </span>
                {ch.hasCoachPlan && (
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                    style={{ background: '#E8F0FE', color: '#1A56B8' }}
                  >
                    Coach Plan Active
                  </span>
                )}
              </div>
              <p className="text-[12px] mt-2 leading-snug" style={{ color: 'rgba(14,14,14,0.65)' }}>
                {ch.headline}
              </p>
            </div>

            {/* Stats grid */}
            <div
              className="grid grid-cols-3 gap-3 mb-4 p-3 rounded-lg lg:grid-cols-6"
              style={{ background: '#FAF7F2' }}
            >
              <StatCell
                value={ch.subs != null ? fmtNum(ch.subs) : '—'}
                label="Subscribers"
              />
              <StatCell
                value={fmtDelta(ch.subs7d)}
                label="Subs (7d)"
                color={ch.subs7d != null && ch.subs7d > 0 ? GREEN : undefined}
              />
              <StatCell
                value={ch.views7d != null ? fmtNum(ch.views7d) : '—'}
                label="Views (7d)"
              />
              <StatCell
                value={
                  ch.viewsWoW != null
                    ? `${ch.viewsWoW >= 0 ? '+' : ''}${Math.round(ch.viewsWoW)}%`
                    : '—'
                }
                label="Views WoW"
                color={
                  ch.viewsWoW != null
                    ? ch.viewsWoW > 5
                      ? GREEN
                      : ch.viewsWoW < -10
                        ? '#8A1F0C'
                        : undefined
                    : undefined
                }
              />
              <StatCell
                value={
                  ch.subsPer1kViews != null
                    ? ch.subsPer1kViews.toFixed(1)
                    : '—'
                }
                label="Subs / 1K Views"
                color={
                  ch.subsPer1kViews != null && ch.subsPer1kViews >= 3
                    ? GREEN
                    : undefined
                }
              />
              <StatCell
                value={`${ch.uploads30d}`}
                label={`Uploads (${ch.longform30d}L · ${ch.shorts30d}S)`}
                color={ch.uploads30d >= 8 ? GREEN : ch.uploads30d >= 4 ? AMBER : undefined}
              />
            </div>

            {/* What's working */}
            {ch.whatsWorking.length > 0 && (
              <div className="mb-4">
                <div
                  className="text-[9px] font-black uppercase tracking-[0.14em] mb-1.5"
                  style={{ color: 'rgba(14,14,14,0.3)' }}
                >
                  What&apos;s Working
                </div>
                <div className="space-y-1">
                  {ch.whatsWorking.map((note, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 text-[12px] leading-snug"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full mt-[5px] shrink-0"
                        style={{ background: '#1FBE7A' }}
                      />
                      <span style={{ color: GREEN }}>{note}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent videos */}
            {ch.recentVideos.length > 0 && (
              <div className="mb-4">
                <div
                  className="text-[9px] font-black uppercase tracking-[0.14em] mb-1.5"
                  style={{ color: 'rgba(14,14,14,0.3)' }}
                >
                  Recent Uploads
                </div>
                <div className="space-y-1.5">
                  {ch.recentVideos.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center gap-2 text-[11px]"
                    >
                      <span
                        className="px-1 py-0.5 rounded text-[8px] font-bold uppercase shrink-0"
                        style={{
                          background: v.isShort ? '#F0E8FE' : '#E8F0FE',
                          color: v.isShort ? '#6B21A8' : '#1A56B8',
                        }}
                      >
                        {v.isShort ? 'Short' : v.format}
                      </span>
                      <a
                        href={`https://youtube.com/watch?v=${v.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate hover:underline"
                        style={{ color: INK, textDecoration: 'none', flex: 1, minWidth: 0 }}
                      >
                        {v.title}
                      </a>
                      <span className="shrink-0 tabular-nums" style={{ color: 'rgba(14,14,14,0.45)' }}>
                        {fmtNum(v.views)} views
                      </span>
                      <span
                        className="shrink-0 tabular-nums font-bold"
                        style={{ color: v.velocity >= 5000 ? GREEN : 'rgba(14,14,14,0.35)' }}
                      >
                        {fmtVelocity(v.velocity)}
                      </span>
                      <span className="shrink-0 text-[10px]" style={{ color: 'rgba(14,14,14,0.25)' }}>
                        {v.daysAgo}d ago
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Coach plan pipeline */}
            {ch.hasCoachPlan && (ch.currentMoment || ch.nextMoment || ch.upcomingMoment) && (
              <div className="mb-2">
                <div
                  className="text-[9px] font-black uppercase tracking-[0.14em] mb-1.5"
                  style={{ color: 'rgba(14,14,14,0.3)' }}
                >
                  Pipeline Ahead
                </div>
                <div className="flex items-center gap-2 text-[11px] flex-wrap">
                  {ch.currentMoment && (
                    <PipelineChip label="Current" value={ch.currentMoment} />
                  )}
                  {ch.nextMoment && (
                    <>
                      <span style={{ color: 'rgba(14,14,14,0.2)' }}>→</span>
                      <PipelineChip label="Next" value={ch.nextMoment} />
                    </>
                  )}
                  {ch.upcomingMoment && (
                    <>
                      <span style={{ color: 'rgba(14,14,14,0.2)' }}>→</span>
                      <PipelineChip label="Upcoming" value={ch.upcomingMoment} />
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCell({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color?: string;
}) {
  return (
    <div>
      <div
        className="text-[16px] font-black tabular-nums"
        style={{ color: color ?? INK }}
      >
        {value}
      </div>
      <div className="text-[9px]" style={{ color: 'rgba(14,14,14,0.4)' }}>
        {label}
      </div>
    </div>
  );
}

function PipelineChip({ label, value }: { label: string; value: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px]"
      style={{ background: '#F6F1E7' }}
    >
      <span className="font-bold" style={{ color: 'rgba(14,14,14,0.35)' }}>
        {label}:
      </span>
      <span className="font-medium" style={{ color: INK }}>
        {value}
      </span>
    </span>
  );
}
