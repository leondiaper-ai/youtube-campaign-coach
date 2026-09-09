'use client';

/**
 * ARTIST / CAMPAIGN COACH VIEW
 *
 * The richer panel for a single campaign. Its only job is to fetch and hand
 * the structured output to CoachPanel — the artist is fixed by the route, so
 * nothing here ever asks the user to say who they are looking at, and every
 * follow-up inherits that context automatically.
 */

import { useCallback, useEffect, useState } from 'react';
import { CoachPanel, CoachUnavailable, type Overview } from './CoachPanel';

export default function ArtistCoach({ slug }: { slug: string }) {
  const [o, setO] = useState<Overview | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (refresh = false) => {
    setBusy(true); setProblem(null);
    try {
      const r = await fetch(`/api/coach-service?slug=${encodeURIComponent(slug)}${refresh ? '&refresh=1' : ''}`)
        .then(x => x.json());
      if (r.error) { setProblem(r.detail ?? r.error); setO(null); }
      else setO(r);
    } catch (e) {
      setProblem(String(e));
    } finally { setBusy(false); }
  }, [slug]);

  useEffect(() => { load(false); }, [load]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <a href="/coach-home" className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-900">
        ← Coach home
      </a>

      <div className="mt-4">
        {busy && !o && <p className="text-sm text-neutral-500">Reading the campaign…</p>}
        {problem && !o && <CoachUnavailable detail={problem} />}
        {o && <CoachPanel o={o} onRefresh={() => load(true)} />}
      </div>

      {problem && !o && (
        <button onClick={() => load(true)} disabled={busy}
          className="mt-4 rounded bg-neutral-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">
          {busy ? 'Assessing…' : 'Try assessing now'}
        </button>
      )}
    </main>
  );
}
