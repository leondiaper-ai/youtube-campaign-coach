'use client';

/**
 * COACH UI — ONE OUTPUT, THREE RENDERINGS
 *
 * CoachStatusChip  — the status, everywhere
 * CoachCard        — compact. Attention lists and deck surfaces
 * CoachPanel       — full. Artist and campaign pages
 *
 * All three read the same CoachOverview. None of them fetches a model, and
 * none of them decides what the Coach thinks; if a surface needs different
 * intelligence, that belongs in the service, not here. Keeping the judgement
 * out of the components is what stops the Watcher home and the artist page
 * quietly disagreeing about the same campaign.
 */

import { useCallback, useState } from 'react';

/* Local structural types. Deliberately not imported from the service: these
   components are also rendered in contexts that only have JSON over the
   wire, and a shared runtime import would drag server code into the bundle. */
type Status = 'ON_TRACK' | 'WATCH' | 'ACTION_REQUIRED' | 'OPPORTUNITY' | 'RISK';

export interface Evidence {
  sourceType: 'WATCHER' | 'PUBLIC_YOUTUBE' | 'EXTERNAL' | 'COACH_INFERENCE';
  claim: string;
  sourceRef?: string | null;
}
export interface Action { id: string; label: string; investigationType: string }

export interface Overview {
  artistId: string; artistName: string;
  campaignName: string | null; generatedAt: string;
  status: Status; headline: string; whatHappened: string; interpretation: string;
  recommendation: string; timing: string; evidenceSummary: string;
  evidence: Evidence[]; confidence: string; missingContext: string;
  nextCheck: string; suggestedActions: Action[];
  producedBy: string; toolsUsed: string[]; cached?: boolean;
  horizonConfidence?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number; turns: number };
}

const STATUS_STYLE: Record<Status, string> = {
  ACTION_REQUIRED: 'bg-rose-600 text-white',
  RISK: 'bg-orange-600 text-white',
  OPPORTUNITY: 'bg-emerald-600 text-white',
  WATCH: 'bg-amber-500 text-white',
  ON_TRACK: 'bg-neutral-200 text-neutral-700',
};

const SOURCE_LABEL: Record<Evidence['sourceType'], string> = {
  WATCHER: 'Watcher',
  PUBLIC_YOUTUBE: 'YouTube',
  EXTERNAL: 'External',
  COACH_INFERENCE: 'Coach inference',
};

export function CoachStatusChip({ status }: { status: Status }) {
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLE[status] ?? STATUS_STYLE.ON_TRACK}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

/* ── Evidence ───────────────────────────────────────────────────────── */

/**
 * Collapsed to a source list by default. The distinction that must always be
 * visible even when collapsed is whether COACH_INFERENCE is in the mix —
 * that is the difference between "we measured this" and "the model thinks
 * this", and burying it is how a coaching tool starts being trusted for the
 * wrong claims.
 */
function EvidenceBlock({ items, summary }: { items: Evidence[]; summary: string }) {
  const [open, setOpen] = useState(false);
  if (!items.length && !summary) return null;

  const sources = Array.from(new Set(items.map(i => SOURCE_LABEL[i.sourceType])));

  return (
    <div className="mt-3 border-t border-neutral-200 pt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-800"
      >
        <span>Evidence</span>
        <span className="font-normal normal-case tracking-normal text-neutral-600">
          {sources.join(' · ') || 'not itemised'}
        </span>
        <span className="ml-auto">{open ? '−' : '+'}</span>
      </button>
      {summary && !open && <p className="mt-1 text-xs text-neutral-600">{summary}</p>}
      {open && (
        <ul className="mt-2 space-y-1.5">
          {items.map((e, i) => (
            <li key={i} className="text-xs">
              <span className={`mr-2 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                e.sourceType === 'COACH_INFERENCE'
                  ? 'bg-violet-100 text-violet-800'
                  : 'bg-neutral-100 text-neutral-600'
              }`}>
                {SOURCE_LABEL[e.sourceType]}
              </span>
              <span className="text-neutral-700">{e.claim}</span>
              {e.sourceRef && <span className="ml-1 text-neutral-400">({e.sourceRef})</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Follow-ups ─────────────────────────────────────────────────────── */

/**
 * The pattern Grok's own UI does well: the next question is offered rather
 * than typed. Answers open inline and stack, so the artist context is never
 * restated and the reasoning stays next to the reading that prompted it.
 */
function Investigations({ artistId, actions }: { artistId: string; actions: Action[] }) {
  type Slot = { key: string; label: string; body: string; loading: boolean; meta?: string };
  const [open, setOpen] = useState<Slot[]>([]);

  /* Keyed rather than indexed. Investigations take many seconds, so two
     clicks in flight at once is normal, and writing results back by array
     index would let a slow answer land in a fast one's slot. */
  const run = useCallback(async (a: Action) => {
    const key = `${a.id}_${Date.now()}`;
    setOpen(o => [...o, { key, label: a.label, body: '', loading: true }]);
    const settle = (patch: Partial<Slot>) =>
      setOpen(o => o.map(x => x.key === key ? { ...x, ...patch, loading: false } : x));
    try {
      const r = await fetch('/api/coach-service', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ artistId, investigationType: a.investigationType, question: a.label }),
      });
      const j = await r.json();
      settle({
        body: j.answer ?? `${j.error ?? 'Failed'} — ${j.detail ?? ''}`,
        meta: j.producedBy ? `${j.producedBy} · ${(j.toolsUsed ?? []).join(', ')}` : undefined,
      });
    } catch (e) {
      settle({ body: String(e) });
    }
  }, [artistId]);

  if (!actions.length) return null;

  return (
    <div className="mt-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        Suggested investigations
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {actions.map(a => (
          <button key={a.id} onClick={() => run(a)}
            className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-800 transition hover:border-neutral-900 hover:bg-neutral-900 hover:text-white">
            → {a.label}
          </button>
        ))}
      </div>

      {open.map(o => (
        <div key={o.key} className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <div className="text-xs font-bold text-neutral-900">{o.label}</div>
          {o.loading
            ? <p className="mt-1 text-xs text-neutral-500">Reasoning over Watcher data…</p>
            : <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-neutral-700">{o.body}</p>}
          {o.meta && <p className="mt-2 text-[10px] text-neutral-400">{o.meta}</p>}
        </div>
      ))}
    </div>
  );
}

/* ── Compact ────────────────────────────────────────────────────────── */

export function CoachCard({ o, href }: { o: Overview; href?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-black uppercase tracking-tight">{o.artistName}</span>
        <CoachStatusChip status={o.status} />
        {o.campaignName && <span className="text-[11px] text-neutral-500">{o.campaignName}</span>}
      </div>
      <p className="mt-2 text-sm leading-snug text-neutral-900">{o.headline}</p>
      <p className="mt-2 text-xs text-neutral-600">
        <b className="text-neutral-800">Coach:</b> {o.recommendation}
      </p>
      {o.nextCheck && (
        <p className="mt-1 text-xs text-neutral-500"><b>Next check:</b> {o.nextCheck}</p>
      )}
      {href && (
        <a href={href} className="mt-3 inline-block text-xs font-semibold text-neutral-900 underline">
          Open campaign
        </a>
      )}
    </div>
  );
}

/* ── Full ───────────────────────────────────────────────────────────── */

export function CoachPanel({ o, onRefresh }: { o: Overview; onRefresh?: () => void }) {
  return (
    <section className="rounded-xl border border-neutral-300 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500">
          Campaign Coach
        </span>
        <CoachStatusChip status={o.status} />
        <span className="text-[10px] uppercase tracking-wider text-neutral-400">
          {o.confidence} confidence
        </span>
        {onRefresh && (
          <button onClick={onRefresh}
            className="ml-auto text-[11px] font-semibold text-neutral-500 underline hover:text-neutral-900">
            Refresh
          </button>
        )}
      </div>

      <h2 className="mt-2 text-xl font-black leading-tight tracking-tight">{o.headline}</h2>

      {o.whatHappened && (
        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">What happened</div>
          <p className="mt-1 text-sm leading-relaxed text-neutral-800">{o.whatHappened}</p>
        </div>
      )}
      {o.interpretation && (
        <div className="mt-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Coach view</div>
          <p className="mt-1 text-sm leading-relaxed text-neutral-800">{o.interpretation}</p>
        </div>
      )}

      <div className="mt-3 rounded-lg bg-neutral-900 p-3 text-white">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Recommendation</div>
        <p className="mt-1 text-sm leading-relaxed">{o.recommendation}</p>
        {o.timing && <p className="mt-1 text-xs text-neutral-300"><b>Timing:</b> {o.timing}</p>}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {o.nextCheck && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Next check</div>
            <p className="mt-1 text-sm text-neutral-800">{o.nextCheck}</p>
          </div>
        )}
        {o.missingContext && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Missing context</div>
            <p className="mt-1 text-sm text-neutral-800">{o.missingContext}</p>
          </div>
        )}
      </div>

      {/* The forward plan is the single biggest determinant of how useful this
          reading is, and validation showed the Coach asking for release dates
          in six of eight outputs. So when the horizon is weak, the fix is one
          click away rather than buried in a settings page. */}
      {(o.horizonConfidence === 'UNKNOWN' || o.horizonConfidence === 'LOW') && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="text-xs text-amber-900">
            <b>No usable forward plan.</b> The Coach can read history and performance,
            but will not give timing advice without the next release dates.
          </p>
          <a href={`/coach-bot/horizon?slug=${encodeURIComponent(o.artistId)}`}
            className="mt-2 inline-block rounded bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white">
            Add the next two dates
          </a>
        </div>
      )}

      <EvidenceBlock items={o.evidence} summary={o.evidenceSummary} />
      <Investigations artistId={o.artistId} actions={o.suggestedActions} />

      <p className="mt-4 text-[10px] text-neutral-400">
        {o.producedBy} · {new Date(o.generatedAt).toLocaleString('en-GB')}
        {o.cached ? ' · cached' : ''}
        {o.toolsUsed.length ? ` · ${o.toolsUsed.length} Watcher tools` : ''}
        {o.usage ? ` · ${o.usage.totalTokens.toLocaleString()} tokens over ${o.usage.turns} turns` : ''}
      </p>
    </section>
  );
}

/* ── Not-configured state ───────────────────────────────────────────── */

/**
 * Shown instead of a panel when no reasoning provider is set. It states the
 * cause rather than showing an empty card, because an empty card reads as
 * "nothing to report" — the one message that must never be sent by accident.
 */
export function CoachUnavailable({ detail }: { detail: string }) {
  return (
    <section className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-5">
      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500">Campaign Coach</div>
      <p className="mt-2 text-sm font-semibold text-neutral-900">Not yet reasoning.</p>
      <p className="mt-1 text-xs text-neutral-600">{detail}</p>
      <p className="mt-2 text-xs text-neutral-500">
        Watcher data is unaffected — this only disables interpretation.
      </p>
    </section>
  );
}
