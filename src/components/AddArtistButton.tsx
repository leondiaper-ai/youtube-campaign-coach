'use client';

import { useState } from 'react';

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const MUTED = '#E9E2D3';
const SOFT = '#F6F1E7';

const PHASES = ['PRE', 'START', 'RELEASE', 'PUSH', 'PEAK', 'SUSTAIN'] as const;

export default function AddArtistButton({ onAdded }: { onAdded?: () => void }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<(typeof PHASES)[number]>('PRE');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/artists', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: input.trim(), phase }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `Failed (${r.status})`);
      setInput('');
      setOpen(false);
      onAdded?.();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-[0.14em]"
        style={{ background: INK, color: PAPER }}
      >
        + Add artist
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(14,14,14,0.48)' }}
          onClick={() => !busy && setOpen(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={submit}
            className="w-full max-w-[460px] rounded-xl border p-6"
            style={{ borderColor: MUTED, background: PAPER, color: INK }}
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink/50">
              Add artist · YouTube
            </div>
            <h3 className="font-black text-xl mt-1">Pull a channel into Watcher</h3>
            <p className="text-[12px] text-ink/60 mt-2">
              Paste a YouTube URL, handle (e.g. <span className="font-mono">@ktrap</span>),
              channel ID, or just the artist name. We&rsquo;ll resolve it live.
            </p>

            <label className="block mt-4 text-[10px] uppercase tracking-[0.18em] text-ink/45">
              Channel handle / URL / name
            </label>
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="@artistname  ·  https://youtube.com/@artistname  ·  UCxxx..."
              className="w-full mt-1 px-3 py-2 rounded-md border text-[14px]"
              style={{ borderColor: MUTED, background: SOFT }}
              disabled={busy}
            />

            <label className="block mt-4 text-[10px] uppercase tracking-[0.18em] text-ink/45">
              Campaign phase
            </label>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {PHASES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPhase(p)}
                  className="px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-[0.14em] border"
                  style={{
                    borderColor: phase === p ? INK : MUTED,
                    background: phase === p ? INK : 'transparent',
                    color: phase === p ? PAPER : INK,
                  }}
                  disabled={busy}
                >
                  {p}
                </button>
              ))}
            </div>

            {err && (
              <div
                className="mt-4 rounded-md p-3 text-[12px]"
                style={{ background: '#FFE2D8', color: '#8A1F0C' }}
              >
                {err}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-[0.14em] border"
                style={{ borderColor: MUTED, color: INK }}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-[0.14em] disabled:opacity-40"
                style={{ background: INK, color: PAPER }}
              >
                {busy ? 'Resolving…' : 'Resolve + add'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
