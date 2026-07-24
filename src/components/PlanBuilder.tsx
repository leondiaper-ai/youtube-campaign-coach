'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { generatePlan, type GeneratedPlan, type ChannelContext } from '@/lib/planEngine';
import CampaignPlanOutput from './CampaignPlanOutput';

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const BORDER = '#E8E3DA';
const MUTED = '#9B9589';
const SIGNAL = '#FF4A1C';

type Step = 'input' | 'result';

export default function PlanBuilder({
  artistOptions,
}: {
  artistOptions: { slug: string; name: string; channelHandle?: string }[];
}) {
  const [step, setStep] = useState<Step>('input');
  const [artistName, setArtistName] = useState('');
  const [selectedSlug, setSelectedSlug] = useState('');
  const [timeline, setTimeline] = useState('');
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [channelCtx, setChannelCtx] = useState<ChannelContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // When an artist is selected from dropdown, fetch channel context
  const handleArtistSelect = useCallback(
    async (slug: string) => {
      setSelectedSlug(slug);
      const artist = artistOptions.find((a) => a.slug === slug);
      if (!artist) {
        setArtistName('');
        setChannelCtx(null);
        return;
      }
      setArtistName(artist.name);

      if (artist.channelHandle) {
        try {
          const res = await fetch(
            `/api/channel?handle=${encodeURIComponent(artist.channelHandle)}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data && !data.error) {
              setChannelCtx({
                state: data.status ?? 'COLD',
                uploads30d: data.uploads30d ?? 0,
                shorts30d: data.shorts30d ?? 0,
                subs: data.subs ?? undefined,
                views7Delta: data.views7Delta ?? null,
                subs7Delta: data.subs7Delta ?? null,
                lastUploadDaysAgo: data.lastUploadDaysAgo ?? undefined,
              });
              return;
            }
          }
        } catch {
          // fall through
        }
      }
      setChannelCtx(null);
    },
    [artistOptions]
  );

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
    setLoading(true);

    // Simulate brief processing
    setTimeout(() => {
      const result = generatePlan(timeline, artistName, channelCtx);
      if (!result) {
        setError(
          "Could not parse any dates from the timeline. Try adding dates like \"15 June - single release\"."
        );
        setLoading(false);
        return;
      }
      setPlan(result);
      setStep('result');
      setLoading(false);
    }, 300);
  }, [timeline, artistName, channelCtx]);

  const handleBack = useCallback(() => {
    setStep('input');
    setPlan(null);
  }, []);

  if (step === 'result' && plan) {
    return (
      <div
        className="min-h-screen"
        style={{ background: PAPER, color: INK }}
      >
        <div className="max-w-[900px] mx-auto px-6 py-10">
          <CampaignPlanOutput plan={plan} onBack={handleBack} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: PAPER, color: INK }}
    >
      <div className="max-w-[680px] mx-auto px-6 py-10">
        {/* Header */}
        <Nav />

        {/* Hero */}
        <div style={{ marginTop: 48, marginBottom: 40 }}>
          <h1
            style={{
              fontSize: 36,
              fontWeight: 900,
              lineHeight: 1.15,
              color: INK,
              margin: 0,
            }}
          >
            Build a YouTube
            <br />
            Content Plan
          </h1>
          <p
            style={{
              fontSize: 15,
              color: '#5A5650',
              lineHeight: 1.6,
              marginTop: 12,
              maxWidth: 480,
            }}
          >
            Paste a messy campaign timeline. Get a structured YouTube rollout
            with phases, weekly actions, watchouts, and smart recommendations
            shaped by channel intelligence.
          </p>
        </div>

        {/* Artist selector */}
        <div style={{ marginBottom: 20 }}>
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
                <option value="">Select an artist…</option>
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

          {/* Channel context badge */}
          {channelCtx && (
            <div
              style={{
                marginTop: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                color: MUTED,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background:
                    channelCtx.state === 'HEALTHY'
                      ? '#1FBE7A'
                      : channelCtx.state === 'BUILDING'
                      ? '#3B82F6'
                      : channelCtx.state === 'COLD'
                      ? '#9CA3AF'
                      : '#F59E0B',
                }}
              />
              <span>
                Channel intelligence loaded — {channelCtx.state.toLowerCase()}
                {channelCtx.subs
                  ? ` · ${(channelCtx.subs / 1000).toFixed(0)}K subs`
                  : ''}
              </span>
            </div>
          )}
        </div>

        {/* Timeline input */}
        <div style={{ marginBottom: 20 }}>
          <Label text="Campaign Timeline" />
          <textarea
            value={timeline}
            onChange={(e) => {
              setTimeline(e.target.value);
              if (error) setError('');
            }}
            placeholder={`Paste your campaign timeline here. Any format works:\n\n15 June — Single release "Track Name"\n28 June — Album drop\nJuly — Tour starts\n3 August — Festival appearance\nSeptember — Documentary release`}
            rows={12}
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

        {/* Error */}
        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#991B1B',
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px 24px',
            borderRadius: 10,
            border: 'none',
            background: loading ? '#D1D5DB' : INK,
            color: '#FFFFFF',
            fontSize: 15,
            fontWeight: 800,
            cursor: loading ? 'not-allowed' : 'pointer',
            letterSpacing: '0.02em',
            transition: 'background 0.15s',
          }}
        >
          {loading ? 'Building plan…' : 'Build Content Plan'}
        </button>

        {/* Hint */}
        <div
          style={{
            marginTop: 32,
            padding: '14px 16px',
            borderRadius: 10,
            background: SOFT,
            border: `1px solid ${BORDER}`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: MUTED,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              marginBottom: 6,
            }}
          >
            How it works
          </div>
          <div style={{ fontSize: 13, color: '#5A5650', lineHeight: 1.6 }}>
            The plan engine parses your timeline into key moments, assigns
            campaign phases (Build → Release → Scale → Extend), generates
            weekly content actions per event type, and produces channel-aware
            watchouts and YouTube opportunities. If the artist has a tracked
            channel, recommendations adapt to their current state.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function Nav() {
  return (
    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: MUTED }}>
      <span>YouTube Campaign System</span>
      <span style={{ color: '#D1C9BD' }}>·</span>
      <div className="flex items-center gap-1 mt-0">
        <span
          className="px-3 py-1.5 rounded-md text-[13px] font-black"
          style={{ background: SOFT }}
        >
          Content Plan
        </span>
        <Link
          href="/growth"
          className="px-3 py-1.5 rounded-md text-[13px] font-bold hover:bg-[#F6F1E7] transition-colors"
          style={{ color: MUTED }}
        >
          Channel Health
        </Link>
        <Link
          href="/growth"
          className="px-3 py-1.5 rounded-md text-[13px] font-bold hover:bg-[#F6F1E7] transition-colors"
          style={{ color: MUTED }}
        >
          All Artists
        </Link>
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
