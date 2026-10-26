'use client';
import { useState } from 'react';
export default function AccessPrompt() {
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const res = await fetch('/api/owned-channels/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ secret }) });
      if (res.ok) { setSecret(''); window.location.reload(); }
      else setError(res.status === 429 ? 'Too many attempts. Try again later.' : 'Access key not recognised.');
    } catch { setError('Could not connect. Please try again.'); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-paper text-ink flex items-center justify-center px-6">
    <form onSubmit={submit} className="w-full max-w-sm bg-surface border border-line rounded-card p-6">
      <p className="text-meta text-muted mb-2">Virgin Music UK</p>
      <h1 className="text-h2 font-black mb-2">Owned Channels</h1>
      <p className="text-body text-secondary mb-5">Enter the team access key to view the network.</p>
      <label className="block text-body font-semibold">Access key<input type="password" autoComplete="current-password" required value={secret} onChange={e => setSecret(e.target.value)} className="mt-2 w-full rounded-control border border-line px-3 py-2" /></label>
      <button disabled={busy || !secret} className="mt-4 w-full rounded-control bg-ink text-paper py-2 font-bold disabled:opacity-50">{busy ? 'Checking…' : 'Continue'}</button>
      {error && <p role="alert" className="text-body text-negative mt-3">{error}</p>}
      <a href="/growth" className="inline-block mt-5 text-meta text-secondary">← Back to Watcher</a>
    </form>
  </main>;
}
