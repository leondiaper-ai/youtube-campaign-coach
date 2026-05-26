'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const BONE = '#EBE7DF';
const SMOKE = '#8A847A';

export default function AddArtistModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [channelInput, setChannelInput] = useState('');
  const [step, setStep] = useState<'form' | 'resolving' | 'error'>('form');
  const [error, setError] = useState('');

  function reset() {
    setChannelInput('');
    setStep('form');
    setError('');
    setOpen(false);
  }

  async function handleSubmit() {
    if (!channelInput.trim()) return;
    setStep('resolving');
    setError('');

    try {
      // Resolve channel via artists API
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

      // Add to team watcher with defaults
      const twRes = await fetch('/api/team-watcher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId,
          artistSlug: artistSlug || channelInput.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          displayName,
          campaignName: '',
          campaignStartDate: '',
          campaignState: 'Monitoring',
          regionTag: '',
        }),
      });

      if (!twRes.ok) {
        const data = await twRes.json().catch(() => ({ error: 'Unknown error' }));
        setError(data.error ?? 'Failed to add artist');
        setStep('error');
        return;
      }

      reset();
      router.refresh();
    } catch (err) {
      setError(String(err));
      setStep('error');
    }
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-lg text-[12px] font-bold"
        style={{ background: INK, color: PAPER, border: 'none', cursor: 'pointer' }}
      >
        + Add Artist
      </button>

      {/* Modal backdrop + dialog */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(14,14,14,0.4)' }}
          onClick={(e) => { if (e.target === e.currentTarget) reset(); }}
        >
          <div
            className="rounded-2xl shadow-xl w-full max-w-[440px] mx-4"
            style={{ background: PAPER }}
          >
            <div className="px-6 pt-6 pb-5">
              <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/35 mb-1">
                Add Artist · YouTube
              </div>
              <h2 className="font-black text-[20px] leading-tight mb-1">
                Add channel to Team Board
              </h2>
              <p className="text-[12px] text-ink/45 mb-5">
                Paste a YouTube URL, handle, or channel name. We'll resolve it and start tracking.
              </p>

              {step === 'resolving' ? (
                <div className="text-[13px] text-ink/50 py-8 text-center">
                  Adding channel...
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="block text-[9px] font-bold uppercase tracking-[0.12em] mb-1.5" style={{ color: SMOKE }}>
                      Channel Handle / URL / Name
                    </label>
                    <input
                      value={channelInput}
                      onChange={(e) => setChannelInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && channelInput.trim()) handleSubmit();
                      }}
                      placeholder="@artistname · https://youtube.com/@artistname · UCxxx.."
                      autoFocus
                      className="w-full text-[13px] px-3 py-2.5 rounded-lg border outline-none"
                      style={{ background: SOFT, borderColor: BONE, color: INK }}
                    />
                  </div>

                  {error && (
                    <div
                      className="text-[12px] rounded-lg px-4 py-2.5 mb-4"
                      style={{ color: '#8A1F0C', background: '#FFE2D8' }}
                    >
                      {error}
                    </div>
                  )}

                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={reset}
                      className="px-4 py-2 rounded-lg text-[12px] font-semibold"
                      style={{ background: SOFT, color: INK, border: `1px solid ${BONE}`, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={!channelInput.trim()}
                      className="px-5 py-2 rounded-lg text-[12px] font-bold"
                      style={{
                        background: INK,
                        color: PAPER,
                        border: 'none',
                        opacity: channelInput.trim() ? 1 : 0.4,
                        cursor: channelInput.trim() ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Monitor
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Inline version for empty states — renders as a larger button */
export function AddArtistModalInline() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [channelInput, setChannelInput] = useState('');
  const [step, setStep] = useState<'form' | 'resolving' | 'error'>('form');
  const [error, setError] = useState('');

  function reset() {
    setChannelInput('');
    setStep('form');
    setError('');
    setOpen(false);
  }

  async function handleSubmit() {
    if (!channelInput.trim()) return;
    setStep('resolving');
    setError('');

    try {
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

      const twRes = await fetch('/api/team-watcher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId,
          artistSlug: artistSlug || channelInput.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          displayName,
          campaignName: '',
          campaignStartDate: '',
          campaignState: 'Monitoring',
          regionTag: '',
        }),
      });

      if (!twRes.ok) {
        const data = await twRes.json().catch(() => ({ error: 'Unknown error' }));
        setError(data.error ?? 'Failed to add artist');
        setStep('error');
        return;
      }

      reset();
      router.refresh();
    } catch (err) {
      setError(String(err));
      setStep('error');
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-block px-5 py-2.5 rounded-lg text-[13px] font-bold"
        style={{ background: '#0E0E0E', color: '#FAF7F2', border: 'none', cursor: 'pointer' }}
      >
        + Add Artist
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(14,14,14,0.4)' }}
          onClick={(e) => { if (e.target === e.currentTarget) reset(); }}
        >
          <div
            className="rounded-2xl shadow-xl w-full max-w-[440px] mx-4"
            style={{ background: '#FAF7F2' }}
          >
            <div className="px-6 pt-6 pb-5">
              <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/35 mb-1">
                Add Artist · YouTube
              </div>
              <h2 className="font-black text-[20px] leading-tight mb-1">
                Add channel to Team Board
              </h2>
              <p className="text-[12px] text-ink/45 mb-5">
                Paste a YouTube URL, handle, or channel name. We'll resolve it and start tracking.
              </p>

              {step === 'resolving' ? (
                <div className="text-[13px] text-ink/50 py-8 text-center">
                  Adding channel...
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="block text-[9px] font-bold uppercase tracking-[0.12em] mb-1.5" style={{ color: '#8A847A' }}>
                      Channel Handle / URL / Name
                    </label>
                    <input
                      value={channelInput}
                      onChange={(e) => setChannelInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && channelInput.trim()) handleSubmit();
                      }}
                      placeholder="@artistname · https://youtube.com/@artistname · UCxxx.."
                      autoFocus
                      className="w-full text-[13px] px-3 py-2.5 rounded-lg border outline-none"
                      style={{ background: '#F6F1E7', borderColor: '#EBE7DF', color: '#0E0E0E' }}
                    />
                  </div>

                  {error && (
                    <div
                      className="text-[12px] rounded-lg px-4 py-2.5 mb-4"
                      style={{ color: '#8A1F0C', background: '#FFE2D8' }}
                    >
                      {error}
                    </div>
                  )}

                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={reset}
                      className="px-4 py-2 rounded-lg text-[12px] font-semibold"
                      style={{ background: '#F6F1E7', color: '#0E0E0E', border: '1px solid #EBE7DF', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={!channelInput.trim()}
                      className="px-5 py-2 rounded-lg text-[12px] font-bold"
                      style={{
                        background: '#0E0E0E',
                        color: '#FAF7F2',
                        border: 'none',
                        opacity: channelInput.trim() ? 1 : 0.4,
                        cursor: channelInput.trim() ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Monitor
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
