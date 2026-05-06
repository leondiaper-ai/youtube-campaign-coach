'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  deriveFromLive,
  daysSince,
  fmtNum,
  STATUS_COLOR,
  type ChannelState,
  type LiveSnap,
  type Derived,
} from '@/lib/artists';
import {
  calculateChannelScore,
  computeBenchmarkPool,
  type ChannelScore,
  type ChannelScoreInput,
  GRADE_COLOR,
  GRADE_BG,
} from '@/lib/channelScore';
import {
  generatePlan,
  type GeneratedPlan,
  type ChannelContext,
} from '@/lib/planEngine';
import CampaignPlanOutput from './CampaignPlanOutput';
import { DEPTH_COLORS, DEPTH_DISCLAIMER, type DepthLabel } from '@/lib/depthSignal';

// ── Design tokens ────────────────────────────────────────────────────────

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const BORDER = '#E8E3DA';
const MUTED = '#9B9589';
const SIGNAL = '#FF4A1C';

// ── Types ────────────────────────────────────────────────────────────────

type ArtistOption = {
  slug: string;
  name: string;
  channelHandle?: string;
};

type DepthSignalData = {
  label: DepthLabel;
  title: string;
  reason: string;
  score: number;
  suggestions: string[];
  longformCount: number;
  shortsCount: number;
  depthAssetTypes: string[];
};

type ChannelData = LiveSnap & {
  subs7Delta?: number | null;
  views7Delta?: number | null;
  depthSignal?: DepthSignalData | null;
};

type GuidanceBlock = {
  label: string;
  value: string;
  color: string;
};

// ── Main Component ───────────────────────────────────────────────────────

export default function CoachPage({
  artistOptions,
}: {
  artistOptions: ArtistOption[];
}) {
  const [selectedSlug, setSelectedSlug] = useState('');
  const [artistName, setArtistName] = useState('');
  const [channelData, setChannelData] = useState<ChannelData | null>(null);
  const [derived, setDerived] = useState<Derived | null>(null);
  const [channelScore, setChannelScore] = useState<ChannelScore | null>(null);
  const [channelCtx, setChannelCtx] = useState<ChannelContext | null>(null);
  const [loadingChannel, setLoadingChannel] = useState(false);

  const [timeline, setTimeline] = useState('');
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Artist selection ───────────────────────────────────────────────────

  const handleArtistSelect = useCallback(
    async (slug: string) => {
      setSelectedSlug(slug);
      const artist = artistOptions.find((a) => a.slug === slug);
      if (!artist) {
        setArtistName('');
        setChannelData(null);
        setDerived(null);
        setChannelScore(null);
        setChannelCtx(null);
        return;
      }
      setArtistName(artist.name);

      if (artist.channelHandle) {
        setLoadingChannel(true);
        try {
          const res = await fetch(
            `/api/channel?q=${encodeURIComponent(artist.channelHandle)}`
          );
          if (res.ok) {
            const data: ChannelData = await res.json();
            if (data && !data.error) {
              setChannelData(data);

              // Derive channel state
              const d = deriveFromLive(data, {
                subs7Delta: data.subs7Delta ?? null,
                views7Delta: data.views7Delta ?? null,
              });
              setDerived(d);

              // Compute channel score
              const scoreInput: ChannelScoreInput = {
                views7Delta: data.views7Delta ?? null,
                subs7Delta: data.subs7Delta ?? null,
                uploads30d: data.uploads30d ?? 0,
                shorts30d: data.shorts30d ?? 0,
                lastUploadAt: data.lastUploadAt ?? null,
                subs: data.subs ?? null,
              };
              const pool = computeBenchmarkPool([scoreInput]);
              const score = calculateChannelScore(scoreInput, pool);
              setChannelScore(score);

              // Build channel context for plan engine
              const lastDays = daysSince(data.lastUploadAt);
              const momentum = deriveMomentum(data);
              const ctx: ChannelContext = {
                state: d?.status ?? 'COLD',
                uploads30d: data.uploads30d ?? 0,
                shorts30d: data.shorts30d ?? 0,
                subs: data.subs ?? undefined,
                views7Delta: data.views7Delta ?? null,
                subs7Delta: data.subs7Delta ?? null,
                lastUploadDaysAgo: lastDays ?? undefined,
                momentum,
              };
              setChannelCtx(ctx);
              setLoadingChannel(false);
              return;
            }
          }
        } catch {
          // fall through
        }
        setLoadingChannel(false);
      }
      setChannelData(null);
      setDerived(null);
      setChannelScore(null);
      setChannelCtx(null);
    },
    [artistOptions]
  );

  // ── Plan generation ────────────────────────────────────────────────────

  const handleGenerate = useCallback(() => {
    if (!timeline.trim()) {
      setError('Paste a timeline — even a rough one works.');
      return;
    }
    if (!artistName.trim()) {
      setError('Enter an artist name.');
      return;
    }
    setError('');
    setPlanLoading(true);

    setTimeout(() => {
      const result = generatePlan(timeline, artistName, channelCtx);
      if (!result) {
        setError(
          'Could not parse any dates from the timeline. Try adding dates like "15 June - single release".'
        );
        setPlanLoading(false);
        return;
      }
      setPlan(result);
      setPlanLoading(false);
    }, 300);
  }, [timeline, artistName, channelCtx]);

  const handleBack = useCallback(() => {
    setPlan(null);
  }, []);

  // ── Guidance derivation ────────────────────────────────────────────────

  const guidance = channelData ? buildGuidance(channelData, derived) : null;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: PAPER, color: INK }}>
      <div className="max-w-[800px] mx-auto px-6 py-10">
        {/* Nav */}
        <Nav />

        {/* Page Title */}
        <div style={{ marginTop: 40, marginBottom: 32 }}>
          <h1
            style={{
              fontSize: 36,
              fontWeight: 900,
              lineHeight: 1.15,
              color: INK,
              margin: 0,
            }}
          >
            YouTube Campaign Coach
          </h1>
          <p
            style={{
              fontSize: 15,
              color: '#5A5650',
              lineHeight: 1.6,
              marginTop: 10,
              maxWidth: 520,
            }}
          >
            Select an artist, review their channel state, then build a campaign
            plan shaped by real channel intelligence.
          </p>
        </div>

        {/* Artist Selector */}
        <div style={{ marginBottom: 28 }}>
          <Label text="Artist" />
          {artistOptions.length > 0 ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={selectedSlug}
                onChange={(e) => handleArtistSelect(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: `1px solid ${BORDER}`,
                  background: '#FFFFFF',
                  fontSize: 14,
                  color: INK,
                  cursor: 'pointer',
                  appearance: 'none',
                }}
              >
                <option value="">Select an artist...</option>
                {artistOptions.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.name}
                  </option>
                ))}
              </select>
              <span
                style={{
                  fontSize: 12,
                  color: MUTED,
                  alignSelf: 'center',
                  whiteSpace: 'nowrap',
                }}
              >
                or
              </span>
              <input
                type="text"
                value={!selectedSlug ? artistName : ''}
                onChange={(e) => {
                  setSelectedSlug('');
                  setArtistName(e.target.value);
                  setChannelData(null);
                  setDerived(null);
                  setChannelScore(null);
                  setChannelCtx(null);
                }}
                placeholder="Type a name"
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: `1px solid ${BORDER}`,
                  background: '#FFFFFF',
                  fontSize: 14,
                  color: INK,
                }}
              />
            </div>
          ) : (
            <input
              type="text"
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              placeholder="Artist name"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
                background: '#FFFFFF',
                fontSize: 14,
                color: INK,
              }}
            />
          )}
        </div>

        {loadingChannel && (
          <div
            style={{
              fontSize: 13,
              color: MUTED,
              marginBottom: 24,
              padding: '10px 14px',
              background: SOFT,
              borderRadius: 8,
            }}
          >
            Loading channel intelligence...
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────────── */}
        {/* SECTION 1: Channel / Campaign State                            */}
        {/* ──────────────────────────────────────────────────────────────── */}
        {channelData && derived && !loadingChannel && (
          <div
            style={{
              marginBottom: 28,
              padding: '18px 20px',
              borderRadius: 12,
              background: '#FFFFFF',
              border: `1px solid ${BORDER}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <SectionLabel text="Channel State" />
              {channelScore && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 8px',
                    borderRadius: 6,
                    border: `1px solid ${GRADE_COLOR[channelScore.grade]}33`,
                    background: GRADE_BG[channelScore.grade],
                    fontSize: 12,
                    fontWeight: 600,
                    color: GRADE_COLOR[channelScore.grade],
                  }}
                >
                  <span style={{ fontSize: 14 }}>{channelScore.grade}</span>
                  <span style={{ fontSize: 10, opacity: 0.7, fontWeight: 400 }}>
                    score
                  </span>
                </div>
              )}
            </div>

            {/* Status badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <StatusBadge status={derived.status} />
              <span style={{ fontSize: 13, color: '#5A5650', lineHeight: 1.4 }}>
                {derived.reason}
              </span>
            </div>

            {/* Key metrics */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                gap: 8,
                marginBottom: 12,
              }}
            >
              <MetricCell
                label="Subscribers"
                value={channelData.subs != null ? fmtNum(channelData.subs) : '—'}
              />
              <MetricCell
                label="Views 7d"
                value={
                  channelData.views7Delta != null
                    ? `${channelData.views7Delta >= 0 ? '+' : ''}${fmtNum(channelData.views7Delta)}`
                    : '—'
                }
                color={
                  channelData.views7Delta != null
                    ? channelData.views7Delta > 0
                      ? '#0C6A3F'
                      : channelData.views7Delta < 0
                      ? SIGNAL
                      : MUTED
                    : MUTED
                }
              />
              <MetricCell
                label="Subs 7d"
                value={
                  channelData.subs7Delta != null
                    ? `${channelData.subs7Delta >= 0 ? '+' : ''}${fmtNum(channelData.subs7Delta)}`
                    : '—'
                }
                color={
                  channelData.subs7Delta != null
                    ? channelData.subs7Delta > 0
                      ? '#0C6A3F'
                      : channelData.subs7Delta < 0
                      ? SIGNAL
                      : MUTED
                    : MUTED
                }
              />
              <MetricCell
                label="Uploads 30d"
                value={String(channelData.uploads30d ?? 0)}
              />
              <MetricCell
                label="Shorts 30d"
                value={String(channelData.shorts30d ?? 0)}
              />
              <MetricCell
                label="Last Upload"
                value={
                  channelData.lastUploadAt
                    ? `${daysSince(channelData.lastUploadAt)}d ago`
                    : '—'
                }
              />
            </div>

            {/* Quick diagnosis */}
            <div
              style={{
                fontSize: 12,
                color: MUTED,
                fontStyle: 'italic',
                lineHeight: 1.5,
              }}
            >
              {derived.watcherRead}
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────────── */}
        {/* SECTION 2: Build Content Plan                                   */}
        {/* ──────────────────────────────────────────────────────────────── */}
        <div
          style={{
            marginBottom: 28,
            padding: '18px 20px',
            borderRadius: 12,
            background: '#FFFFFF',
            border: `1px solid ${BORDER}`,
          }}
        >
          <SectionLabel text="Build Content Plan" />
          <div style={{ marginTop: 12 }}>
            <Label text="Campaign Timeline" />
            <textarea
              value={timeline}
              onChange={(e) => {
                setTimeline(e.target.value);
                if (error) setError('');
              }}
              placeholder={`Paste your campaign timeline here. Any format works:\n\n15 June — Single release "Track Name"\n28 June — Album drop\nJuly — Tour starts\n3 August — Festival appearance\nSeptember — Documentary release`}
              rows={10}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 10,
                border: `1px solid ${BORDER}`,
                background: PAPER,
                fontSize: 14,
                color: INK,
                lineHeight: 1.6,
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 6,
              }}
            >
              <span style={{ fontSize: 11, color: MUTED }}>
                Dates, releases, tour dates, festivals — paste whatever you have.
              </span>
              <span style={{ fontSize: 11, color: MUTED }}>
                {timeline.split('\n').filter((l) => l.trim()).length} lines
              </span>
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#991B1B',
                fontSize: 13,
                marginTop: 12,
              }}
            >
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={planLoading}
            style={{
              width: '100%',
              marginTop: 14,
              padding: '14px 24px',
              borderRadius: 10,
              border: 'none',
              background: planLoading ? '#D1D5DB' : INK,
              color: '#FFFFFF',
              fontSize: 15,
              fontWeight: 800,
              cursor: planLoading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.02em',
              transition: 'background 0.15s',
            }}
          >
            {planLoading ? 'Building plan...' : 'Build Content Plan'}
          </button>
        </div>

        {/* ──────────────────────────────────────────────────────────────── */}
        {/* SECTION 3: Generated Campaign Plan                             */}
        {/* ──────────────────────────────────────────────────────────────── */}
        {plan && (
          <div style={{ marginBottom: 28 }}>
            <CampaignPlanOutput plan={plan} onBack={handleBack} />
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────────── */}
        {/* SECTION 4: Live Campaign Guidance                              */}
        {/* ──────────────────────────────────────────────────────────────── */}
        {guidance && channelData && derived && (
          <div
            style={{
              marginBottom: 28,
              padding: '18px 20px',
              borderRadius: 12,
              background: '#FFFFFF',
              border: `1px solid ${BORDER}`,
            }}
          >
            <SectionLabel text="Live Campaign Guidance" />

            {/* Guidance blocks */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 8,
                marginTop: 14,
                marginBottom: 16,
              }}
            >
              {guidance.blocks.map((b, i) => (
                <div
                  key={i}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: SOFT,
                    border: `1px solid ${BORDER}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: MUTED,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      marginBottom: 4,
                    }}
                  >
                    {b.label}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: b.color,
                      lineHeight: 1.4,
                    }}
                  >
                    {b.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Momentum direction */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 16,
                padding: '10px 14px',
                borderRadius: 8,
                background: SOFT,
              }}
            >
              <span style={{ fontSize: 16 }}>
                {guidance.momentum === 'rising'
                  ? '↑'
                  : guidance.momentum === 'falling'
                  ? '↓'
                  : '→'}
              </span>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: MUTED,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  Momentum
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color:
                      guidance.momentum === 'rising'
                        ? '#0C6A3F'
                        : guidance.momentum === 'falling'
                        ? SIGNAL
                        : MUTED,
                  }}
                >
                  {guidance.momentum === 'rising'
                    ? 'Rising'
                    : guidance.momentum === 'falling'
                    ? 'Falling'
                    : 'Flat'}
                </div>
              </div>
            </div>

            {/* Depth Signal */}
            {channelData.depthSignal && (() => {
              const ds = channelData.depthSignal;
              const dc = DEPTH_COLORS[ds.label];
              return (
                <div
                  style={{
                    marginBottom: 16,
                    padding: '12px 16px',
                    borderRadius: 8,
                    background: dc.bg,
                    border: `1px solid ${dc.text}20`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: dc.dot,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: dc.text,
                      }}
                    >
                      {ds.title}
                    </span>
                    <span style={{ fontSize: 10, color: `${dc.text}80` }}>
                      {ds.longformCount} longform · {ds.shortsCount} Shorts
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: `${dc.text}CC`, lineHeight: 1.5 }}>
                    {ds.reason}
                  </div>
                  {ds.depthAssetTypes.length > 0 && (
                    <div style={{ fontSize: 10, color: `${dc.text}99`, marginTop: 4 }}>
                      Detected: {ds.depthAssetTypes.join(', ')}
                    </div>
                  )}
                  {ds.suggestions.length > 0 && (
                    <div style={{ fontSize: 10, color: `${dc.text}80`, marginTop: 2 }}>
                      Add: {ds.suggestions.slice(0, 4).join(', ')}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 9,
                      color: `${dc.text}50`,
                      marginTop: 8,
                      lineHeight: 1.4,
                    }}
                  >
                    {DEPTH_DISCLAIMER}
                  </div>
                </div>
              );
            })()}

            {/* Recommendations */}
            {guidance.recommendations.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: MUTED,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    marginBottom: 8,
                  }}
                >
                  Recommendations
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {guidance.recommendations.map((rec, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: '#EEF2FF',
                        border: '1px solid #C7D2FE',
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: '#3730A3',
                      }}
                    >
                      <span style={{ flexShrink: 0, marginTop: 1 }}>{'>'}</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer tagline */}
        <div
          style={{
            marginTop: 32,
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#D1C9BD',
          }}
        >
          Watcher watches · Coach directs · Campaigns track
        </div>
      </div>
    </div>
  );
}

// ── Guidance builder ─────────────────────────────────────────────────────

function deriveMomentum(data: ChannelData): 'rising' | 'flat' | 'falling' {
  const v7 = data.views7Delta;
  if (v7 == null) return 'flat';
  if (v7 > 5000) return 'rising';
  if (v7 < -1000) return 'falling';
  return 'flat';
}

function buildGuidance(
  data: ChannelData,
  derived: Derived | null
): {
  blocks: GuidanceBlock[];
  momentum: 'rising' | 'flat' | 'falling';
  recommendations: string[];
} {
  const blocks: GuidanceBlock[] = [];
  const u = data.uploads30d ?? 0;
  const s = data.shorts30d ?? 0;
  const v7 = data.views7Delta ?? 0;
  const s7 = data.subs7Delta ?? 0;

  // Cadence assessment
  if (u >= 4) {
    blocks.push({ label: 'Cadence', value: 'Good posting cadence', color: '#0C6A3F' });
  } else if (u >= 2) {
    blocks.push({ label: 'Cadence', value: 'Cadence could improve', color: '#92400E' });
  } else {
    blocks.push({ label: 'Cadence', value: 'Cadence is critically low', color: SIGNAL });
  }

  // Shorts assessment
  if (s >= 4) {
    blocks.push({
      label: 'Shorts',
      value: 'Active Shorts strategy driving reach',
      color: '#0C6A3F',
    });
  } else if (s >= 1) {
    blocks.push({
      label: 'Shorts',
      value: 'Some Shorts activity — room to increase',
      color: '#92400E',
    });
  } else {
    blocks.push({
      label: 'Shorts',
      value: 'No Shorts — missing primary reach driver',
      color: SIGNAL,
    });
  }

  // Conversion assessment
  if (v7 > 0 && s7 <= 0) {
    blocks.push({
      label: 'Conversion',
      value: 'Views coming but subscribers flat — conversion issue',
      color: SIGNAL,
    });
  } else if (s7 > 0 && v7 > 0) {
    blocks.push({
      label: 'Conversion',
      value: 'Both views and subscribers growing',
      color: '#0C6A3F',
    });
  } else {
    blocks.push({
      label: 'Conversion',
      value: 'Views declining — reach needs attention',
      color: SIGNAL,
    });
  }

  // Momentum
  const momentum = deriveMomentum(data);

  // Recommendations (max 2)
  const recommendations: string[] = [];
  const status = derived?.status ?? 'COLD';

  const REC_MAP: Record<ChannelState, string> = {
    COLD: 'Start warm-up immediately with 2-3 Shorts this week',
    'AT RISK': 'Increase posting cadence — aim for 2+ uploads this week',
    'WEAK CONVERSION':
      'Add artist-connection content (BTS, commentary) to improve subscriber conversion',
    BUILDING: 'Maintain cadence and prepare for release window',
    HEALTHY:
      'Channel is strong — maximize release moments with Premieres and live activation',
  };

  recommendations.push(REC_MAP[status]);

  // Add a second recommendation based on specifics
  if (s === 0 && status !== 'COLD') {
    recommendations.push(
      'Start Shorts immediately — they are the primary discovery driver on YouTube.'
    );
  } else if (momentum === 'falling' && status !== 'AT RISK') {
    recommendations.push(
      'Momentum is dropping — increase posting frequency this week to reverse the trend.'
    );
  }

  return { blocks, momentum, recommendations: recommendations.slice(0, 2) };
}

// ── Sub-components ───────────────────────────────────────────────────────

function Nav() {
  return (
    <div
      className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em]"
      style={{ color: MUTED }}
    >
      <span>YouTube Campaign System</span>
      <span style={{ color: '#D1C9BD' }}>·</span>
      <div className="flex items-center gap-1 mt-0">
        <Link
          href="/growth"
          className="px-3 py-1.5 rounded-md text-[13px] font-bold hover:bg-[#F6F1E7] transition-colors"
          style={{ color: MUTED }}
        >
          Watcher
        </Link>
        <span
          className="px-3 py-1.5 rounded-md text-[13px] font-black"
          style={{ background: SOFT }}
        >
          Coach
        </span>
        <Link
          href="/campaigns"
          className="px-3 py-1.5 rounded-md text-[13px] font-bold hover:bg-[#F6F1E7] transition-colors"
          style={{ color: MUTED }}
        >
          Active Campaigns
        </Link>
      </div>
    </div>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 800,
        color: INK,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
      }}
    >
      {text}
    </div>
  );
}

function Label({ text }: { text: string }) {
  return (
    <label
      style={{
        display: 'block',
        fontSize: 11,
        fontWeight: 700,
        color: MUTED,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        marginBottom: 6,
      }}
    >
      {text}
    </label>
  );
}

function StatusBadge({ status }: { status: ChannelState }) {
  const sc = STATUS_COLOR[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 6,
        background: sc.bg,
        color: sc.fg,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: sc.dot,
        }}
      />
      {status}
    </span>
  );
}

function MetricCell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div
      style={{
        padding: '8px 10px',
        borderRadius: 6,
        background: SOFT,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: MUTED,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: color ?? INK,
        }}
      >
        {value}
      </div>
    </div>
  );
}
