'use client';

/**
 * CAMPAIGN COACH HOME — THE ATTENTION LAYER
 *
 * Answers one question: what needs my attention?
 *
 * ── WHY THIS IS NOT A REPORT ──────────────────────────────────────────
 * A page that writes a paragraph about all thirty campaigns is a page nobody
 * reads twice. The value is in the ranking and in the willingness to say
 * "the other twenty-seven are fine" — so ON_TRACK campaigns collapse to a
 * count, and only campaigns with a live reason to look appear in full.
 *
 * ── WHY IT DOES NOT ASSESS ON LOAD ────────────────────────────────────
 * Reading is free; assessing costs a model run per campaign. Opening this
 * page shows cached readings instantly and reports the rest as "not yet
 * assessed" — never as healthy. Assessment is an explicit act, one campaign
 * or one batch at a time.
 */

import { useCallback, useEffect, useState } from 'react';
import { CoachCard, CoachStatusChip, type Overview } from './CoachPanel';

type Pending = { slug: string; name: string; campaign: string | null };
type Board = {
  generatedAt: string;
  assessed: Overview[];
  pending: Pending[];
  providerReady: boolean;
};

const RANK: Record<string, number> = {
  ACTION_REQUIRED: 4, RISK: 3, OPPORTUNITY: 2, WATCH: 1, ON_TRACK: 0,
};

export default function CoachHome() {
  const [board, setBoard] = useState<Board | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/coach-service').then(x => x.json());
    setBoard(r);
  }, []);

  useEffect(() => { load(); }, [load]);

  const assess = useCallback(async (slug: string) => {
    setBusy(slug); setErr(null);
    try {
      const r = await fetch(`/api/coach-service?slug=${encodeURIComponent(slug)}&refresh=1`).then(x => x.json());
      if (r.error) setErr(`${r.error}: ${r.detail ?? ''}`);
      await load();
    } finally { setBusy(null); }
  }, [load]);

  if (!board) {
    return <p className="p-6 text-sm text-neutral-500">Loading the Coach board…</p>;
  }

  const attention = board.assessed
    .filter(o => (RANK[o.status] ?? 0) > 0)
    .sort((a, b) => (RANK[b.status] ?? 0) - (RANK[a.status] ?? 0));
  const clear = board.assessed.filter(o => (RANK[o.status] ?? 0) === 0);

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 text-neutral-900">
      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500">
        Virgin Music · YouTube
      </div>
      <h1 className="mt-1 text-4xl font-black tracking-tight">Campaign Coach</h1>
      <p className="mt-1 text-sm text-neutral-500">{today}</p>

      {!board.providerReady && (
        <div className="mt-5 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4">
          <p className="text-sm font-semibold">No reasoning provider configured.</p>
          <p className="mt-1 text-xs text-neutral-600">
            Watcher metrics are unaffected. Set <code>XAI_API_KEY</code> on the deployment
            to let the Coach interpret them. Until then no campaign can be assessed, and
            nothing below should be read as an all-clear.
          </p>
        </div>
      )}

      {err && <p className="mt-4 rounded bg-rose-50 p-3 text-xs text-rose-800">{err}</p>}

      <p className="mt-6 text-lg font-bold">
        {attention.length
          ? `${attention.length} campaign${attention.length === 1 ? '' : 's'} worth attention`
          : board.assessed.length
            ? 'Nothing needs attention today.'
            : 'No campaigns assessed yet.'}
      </p>

      <div className="mt-4 space-y-3">
        {attention.map(o => (
          <div key={o.artistId} className="rounded-lg border border-neutral-300 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-black uppercase tracking-tight">{o.artistName}</span>
              <CoachStatusChip status={o.status} />
              {o.campaignName && <span className="text-[11px] text-neutral-500">{o.campaignName}</span>}
            </div>
            <p className="mt-2 text-sm leading-snug">{o.headline}</p>
            <p className="mt-2 text-sm text-neutral-700">
              <b>Coach:</b> {o.recommendation}
            </p>
            {o.nextCheck && (
              <p className="mt-1 text-xs text-neutral-500"><b>Next check:</b> {o.nextCheck}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={`/coach-home/${o.artistId}`}
                className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white">
                Open campaign
              </a>
              <a href={`/coach-home/${o.artistId}#why`}
                className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-semibold">
                Why?
              </a>
              <button onClick={() => assess(o.artistId)} disabled={busy === o.artistId}
                className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-40">
                {busy === o.artistId ? 'Reassessing…' : 'Reassess'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {clear.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-semibold text-neutral-600">
            {clear.length} campaign{clear.length === 1 ? '' : 's'} · no intervention required
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {clear.map(o => <CoachCard key={o.artistId} o={o} href={`/coach-home/${o.artistId}`} />)}
          </div>
        </details>
      )}

      {board.pending.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-neutral-600">
            {board.pending.length} campaign{board.pending.length === 1 ? '' : 's'} · not yet assessed
          </summary>
          <p className="mt-2 text-xs text-neutral-500">
            These have no Coach reading. That is not the same as being fine.
          </p>
          <ul className="mt-2 space-y-1">
            {board.pending.map(p => (
              <li key={p.slug} className="flex items-center gap-2 text-sm">
                <span className="font-medium">{p.name}</span>
                {p.campaign && <span className="text-xs text-neutral-500">{p.campaign}</span>}
                <button onClick={() => assess(p.slug)} disabled={!board.providerReady || busy === p.slug}
                  className="ml-auto rounded border border-neutral-300 px-2 py-1 text-[11px] font-semibold disabled:opacity-30">
                  {busy === p.slug ? 'Assessing…' : 'Assess'}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}
