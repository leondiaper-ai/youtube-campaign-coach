'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CAMPAIGN_STATES,
  CAMPAIGN_STATE_STYLE,
  type CampaignState,
} from '@/lib/teamWatcherStore';

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const MUTED = '#E9E2D3';
const BONE = '#EBE7DF';
const SMOKE = '#8A847A';

export default function AddArtistPage() {
  const router = useRouter();
  const [channelInput, setChannelInput] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [campaignStartDate, setCampaignStartDate] = useState('');
  const [campaignState, setCampaignState] = useState<CampaignState>('Monitoring');
  const [regionTag, setRegionTag] = useState('');
  const [step, setStep] = useState<'form' | 'resolving' | 'error'>('form');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!channelInput.trim()) return;
    setStep('resolving');
    setError('');

    try {
      // Step 1: Resolve the channel via the artists API (triggers cache write)
      const resolveRes = await fetch('/api/artists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelHandle: channelInput.trim() }),
      });

      if (!resolveRes.ok) {
        const data = await resolveRes.json().catch(() => ({ error: 'Could not resolve channel' }));
        setError(data.error ?? 'Could not resolve channel');
        setStep('error');
        return;
      }

      const artistData = await resolveRes.json();
      const channelId = artistData.channelId || artistData.artist?.channelId;
      const artistSlug = artistData.slug || artistData.artist?.slug;
      const displayName = artistData.name || artistData.artist?.name || channelInput.trim();

      if (!channelId) {
        setError('Could not resolve channel ID');
        setStep('error');
        return;
      }

      // Step 2: Add to team watcher
      const twRes = await fetch('/api/team-watcher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId,
          artistSlug: artistSlug || channelInput.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          displayName,
          campaignName,
          campaignStartDate,
          campaignState,
          regionTag,
        }),
      });

      if (!twRes.ok) {
        const data = await twRes.json().catch(() => ({ error: 'Unknown error' }));
        setError(data.error ?? 'Failed to add artist');
        setStep('error');
        return;
      }

      router.push('/team-watcher');
      router.refresh();
    } catch (err) {
      setError(String(err));
      setStep('error');
    }
  };

  return (
    <main className="min-h-screen" style={{ background: PAPER, color: INK }}>
      <div className="max-w-[560px] mx-auto px-6 py-10">
        {/* Breadcrumb */}
        <Link
          href="/team-watcher"
          className="text-[11px] uppercase tracking-[0.18em] text-ink/55 hover:text-ink"
        >
          &larr; Team Campaign Board
        </Link>

        <div className="mt-6 mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-ink/45">
          YouTube Campaign System
        </div>
        <h1 className="font-black text-[24px] leading-tight mb-8">Add Artist</h1>

        {step === 'resolving' && (
          <div className="text-[13px] text-ink/50 py-16 text-center">
            Resolving channel...
          </div>
        )}

        {step !== 'resolving' && (
          <div className="space-y-5">
            {/* Channel input */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.12em] mb-1.5" style={{ color: SMOKE }}>
                Channel Name, Handle, or URL *
              </label>
              <input
                value={channelInput}
                onChange={(e) => setChannelInput(e.target.value)}
                placeholder="e.g. @ArtistName or youtube.com/c/ArtistName"
                className="w-full text-[13px] px-3 py-2.5 rounded-lg border outline-none"
                style={{ background: SOFT, borderColor: BONE, color: INK }}
              />
            </div>

            {/* Campaign name */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.12em] mb-1.5" style={{ color: SMOKE }}>
                Campaign Name
              </label>
              <input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g. Album Launch 2026"
                className="w-full text-[13px] px-3 py-2.5 rounded-lg border outline-none"
                style={{ background: SOFT, borderColor: BONE, color: INK }}
              />
            </div>

            {/* Row: start date + region */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[10px] font-bold uppercase tracking-[0.12em] mb-1.5" style={{ color: SMOKE }}>
                  Campaign Start Date
                </label>
                <input
                  type="date"
                  value={campaignStartDate}
                  onChange={(e) => setCampaignStartDate(e.target.value)}
                  className="w-full text-[13px] px-3 py-2.5 rounded-lg border outline-none"
                  style={{ background: SOFT, borderColor: BONE, color: INK }}
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold uppercase tracking-[0.12em] mb-1.5" style={{ color: SMOKE }}>
                  Team / Region Tag
                </label>
                <input
                  value={regionTag}
                  onChange={(e) => setRegionTag(e.target.value)}
                  placeholder="e.g. UK, US, Global"
                  className="w-full text-[13px] px-3 py-2.5 rounded-lg border outline-none"
                  style={{ background: SOFT, borderColor: BONE, color: INK }}
                />
              </div>
            </div>

            {/* Campaign state */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: SMOKE }}>
                Campaign State
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {CAMPAIGN_STATES.map((s) => {
                  const active = s === campaignState;
                  const style = CAMPAIGN_STATE_STYLE[s];
                  return (
                    <button
                      key={s}
                      onClick={() => setCampaignState(s)}
                      className="px-3 py-1.5 rounded text-[11px] font-bold transition-all"
                      style={{
                        background: active ? style.bg : 'transparent',
                        color: active ? style.fg : SMOKE,
                        border: active ? `1px solid ${style.fg}40` : `1px solid ${BONE}`,
                        cursor: 'pointer',
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="text-[12px] rounded-lg px-4 py-3"
                style={{ color: '#8A1F0C', background: '#FFE2D8' }}
              >
                {error}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSubmit}
                disabled={!channelInput.trim()}
                className="px-5 py-2.5 rounded-lg text-[13px] font-bold"
                style={{
                  background: INK,
                  color: PAPER,
                  opacity: channelInput.trim() ? 1 : 0.4,
                  cursor: channelInput.trim() ? 'pointer' : 'not-allowed',
                  border: 'none',
                }}
              >
                Add Artist
              </button>
              <Link
                href="/team-watcher"
                className="px-5 py-2.5 rounded-lg text-[13px] font-semibold"
                style={{ background: SOFT, color: INK, border: `1px solid ${BONE}`, textDecoration: 'none' }}
              >
                Cancel
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
