'use client';
/* The secret is POSTed as a JSON body and exchanged for an httpOnly
   cookie. It is never placed in the URL, never stored in the browser,
   and never compiled into the bundle. */
import { useState } from 'react';

export default function SecretPrompt() {
  const [v, setV] = useState('');
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(false);
    const r = await fetch('/api/market-watch/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: v }),
    });
    setBusy(false);
    if (r.ok) { setV(''); window.location.reload(); } else setErr(true);
  }

  return (
    <main className="min-h-screen bg-page flex items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-[340px]">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink/40 mb-2">
          Market Watch
        </div>
        <h1 className="font-black text-[20px] leading-tight mb-5">Experimental feature</h1>
        <input
          type="password"
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="Access key"
          autoFocus
          className="w-full rounded-control border border-lineStrong bg-surface px-3 py-2 text-body"
        />
        <button
          type="submit"
          disabled={busy || !v}
          className="mt-3 w-full rounded-control bg-ink text-page text-[11px] font-bold uppercase tracking-[0.14em] py-2.5 disabled:opacity-40"
        >
          {busy ? 'Checking…' : 'Continue'}
        </button>
        {err && <p className="text-[12px] text-negative mt-3">Not recognised.</p>}
      </form>
    </main>
  );
}
