'use client';

import { useState } from 'react';
import Link from 'next/link';

type Result = {
  channel: {
    title: string;
    subs: number;
    totalViews: number;
    totalVideos: number;
    lastUploadDays: number | null;
    uploads30d: number;
    shorts30d: number;
  };
  state: string;
  explanation: string;
  whatsGoingOn: string;
  actions: string[];
};

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toString();
}

const stateColor: Record<string, string> = {
  ACTIVE: 'text-emerald-400',
  STRONG: 'text-emerald-400',
  INCONSISTENT: 'text-amber-400',
  UNDERUSED: 'text-amber-400',
  'NEEDS ATTENTION': 'text-red-400',
};

export default function ReadPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to read channel');
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-10 bg-neutral-950">
      <div className="w-full max-w-xl">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-xs uppercase tracking-[0.2em] text-neutral-500">
              YouTube Instant Read
            </h1>
            <Link
              href="/cockpit"
              className="text-[10px] uppercase tracking-[0.14em] text-neutral-600 hover:text-neutral-400 transition-colors"
            >
              Campaign System →
            </Link>
          </div>
          <p className="mt-2 text-sm text-neutral-400">
            Paste a channel link. Get judged instantly.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="flex gap-2 mb-8">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtube.com/@channel"
            autoFocus
            className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-sm placeholder-neutral-600 text-neutral-100 focus:outline-none focus:border-neutral-600"
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="bg-white text-neutral-950 rounded-lg px-5 py-3 text-sm font-medium hover:bg-neutral-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Reading…' : 'Get Instant Read'}
          </button>
        </form>

        {error && (
          <div className="border border-red-900/60 bg-red-950/30 text-red-300 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-7">
            <section>
              <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 mb-3">
                {result.channel.title}
              </div>
              <div
                className={`text-5xl font-semibold tracking-tight leading-none ${
                  stateColor[result.state] ?? 'text-neutral-100'
                }`}
              >
                {result.state}
              </div>
              <div className="mt-3 text-neutral-400 text-sm">{result.explanation}</div>
            </section>

            <section className="grid grid-cols-5 gap-3 border-t border-b border-neutral-900 py-4">
              <Metric label="Subs" value={formatNumber(result.channel.subs)} />
              <Metric label="Views" value={formatNumber(result.channel.totalViews)} />
              <Metric label="Uploads 30d" value={result.channel.uploads30d.toString()} />
              <Metric label="Shorts 30d" value={result.channel.shorts30d.toString()} />
              <Metric
                label="Last Upload"
                value={
                  result.channel.lastUploadDays === null
                    ? '—'
                    : `${result.channel.lastUploadDays}d`
                }
              />
            </section>

            <section>
              <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 mb-2">
                What&apos;s going on
              </div>
              <div className="text-neutral-100 text-[15px] leading-relaxed">
                {result.whatsGoingOn}
              </div>
            </section>

            <section>
              <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 mb-2">
                What to do this week
              </div>
              <ul className="space-y-2">
                {result.actions.slice(0, 2).map((a, i) => (
                  <li key={i} className="flex gap-3 text-[15px] text-neutral-100">
                    <span className="text-neutral-600">→</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </section>

            <div className="pt-2">
              <Link
                href={`/watcher?q=${encodeURIComponent(url)}`}
                className="text-xs text-neutral-500 hover:text-neutral-300 underline underline-offset-4"
              >
                View full breakdown →
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="text-base font-medium mt-1 text-neutral-100 tabular-nums">{value}</div>
    </div>
  );
}
