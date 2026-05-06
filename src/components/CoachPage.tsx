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
  generatePlan,
  type GeneratedPlan,
  type ChannelContext,
} from '@/lib/planEngine';
import CampaignPlanOutput from './CampaignPlanOutput';

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

type ChannelData = LiveSnap & {
  subs7Delta?: number | null;
  views7Delta?: number | null;
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

              const d = deriveFromLive(data, {
                subs7Delta: data.subs7Delta ?? null,
                views7Delta: data.views7Delta ?? null,
              });
              setDerived(d);

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

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: PAPER, color: INK }}>
      <div className="max-w-[800px] mx-auto px-6 py-10">
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
            Content Planner
          </h1>
          <p
            style={{
              fontSize: 15,
              color: '#5A5650',
              lineHeight: 1.6,
              marginTop: 8,
              maxWidth: 480,
            }}
          >
            Paste a campaign timeline. Get a YouTube rollout.
          </p>
        </div>

        {/* Artist Selector */}
        <div style={{ marginBottom: 24 }}>
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
              marginBottom: 20,
              padding: '8px 14px',
              background: SOFT,
              borderRadius: 8,
            }}
          >
            Loading channel data...
          </div>
        )}

        {/* ── Channel State (compact) ─────────────────────────────── */}
        {channelData && derived && !loadingChannel && (
          <ChannelStrip data={channelData} derived={derived} />
        )}

        {/* ── Timeline Input ──────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <Label text="Campaign Timeline" />
          <textarea
            value={timeline}
            onChange={(e) => {
              setTimeline(e.target.value);
              if (error) setError('');
            }}
            placeholder={`Paste dates, releases, tour, festivals — any format:\n\n15 June — Single release "Track Name"\n28 June — Album drop\nJuly — Tour starts\n3 August — Festival\nSeptember — Documentary`}
            rows={8}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: 10,
              border: `1px solid ${BORDER}`,
              background: '#FFFFFF',
              fontSize: 14,
              color: INK,
              lineHeight: 1.6,
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />

          {error && (
            <div
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#991B1B',
                fontSize: 13,
                marginTop: 10,
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
              marginTop: 12,
              padding: '14px 24px',
              borderRadius: 10,
              border: 'none',
              background: planLoading ? '#D1D5DB' : INK,
              color: '#FFFFFF',
              fontSize: 15,
              fontWeight: 800,
              cursor: planLoading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.02em',
            }}
          >
            {planLoading ? 'Building...' : 'Build Rollout'}
          </button>
        </div>

        {/* ── Generated Plan (the product) ────────────────────────── */}
        {plan && (
          <div style={{ marginBottom: 28 }}>
            <CampaignPlanOutput plan={plan} onBack={handleBack} />
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: 32,
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#D1C9BD',
          }}
        >
          Watcher watches · Coach plans · Campaigns track
        </div>
      </div>
    </div>
  );
}

// ── Channel strip — compact, one-line channel context ────────────────────

function ChannelStrip({ data, derived }: { data: ChannelData; derived: Derived }) {
  const sc = STATUS_COLOR[derived.status];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 24,
        padding: '10px 14px',
        borderRadius: 8,
        background: '#FFFFFF',
        border: `1px solid ${BORDER}`,
        fontSize: 12,
        flexWrap: 'wrap',
      }}
    >
      {/* Status dot + label */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: sc.dot,
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 700, color: sc.fg, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {derived.status}
        </span>
      </span>

      <Separator />

      {/* Key numbers */}
      <Stat label="Subs" value={data.subs != null ? fmtNum(data.subs) : '—'} />
      <Stat
        label="7d views"
        value={data.views7Delta != null ? `${data.views7Delta >= 0 ? '+' : ''}${fmtNum(data.views7Delta)}` : '—'}
        color={data.views7Delta != null && data.views7Delta > 0 ? '#0C6A3F' : undefined}
      />
      <Stat label="Uploads 30d" value={String(data.uploads30d ?? 0)} />
      <Stat label="Shorts 30d" value={String(data.shorts30d ?? 0)} />
      {data.lastUploadAt && (
        <Stat label="Last upload" value={`${daysSince(data.lastUploadAt)}d ago`} />
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
      <span style={{ color: MUTED, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontWeight: 700, color: color ?? INK, fontSize: 13 }}>{value}</span>
    </span>
  );
}

function Separator() {
  return <span style={{ width: 1, height: 14, background: BORDER, flexShrink: 0 }} />;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function deriveMomentum(data: ChannelData): 'rising' | 'flat' | 'falling' {
  const v7 = data.views7Delta;
  if (v7 == null) return 'flat';
  if (v7 > 5000) return 'rising';
  if (v7 < -1000) return 'falling';
  return 'flat';
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
