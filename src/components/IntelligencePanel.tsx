'use client';

/**
 * YOUTUBE INTELLIGENCE — the compact Watcher section.
 *
 * ── WHY IT IS THIS SMALL ─────────────────────────────────────────────
 * The brief's test is "reduce the analysis I have to do, don't give me
 * another dashboard to analyse". So this renders at most a handful of
 * findings, each as four lines: what, why it matters, what to do, and
 * what triggered it. No charts, no scores, no expandable trees.
 *
 * The default state — collapsed, showing a count — is the honest one,
 * because the expected outcome on most mornings is zero.
 *
 * Loading the panel never triggers a model. The run is an explicit click.
 */

import { useState, useCallback } from 'react';
import Link from 'next/link';
import type { MorningRun, IntelligenceFinding } from '@/lib/intelligence/types';

const SIGNAL = '#FF3B14';
const SOFT = '#F6F1E7';

function Confidence({ level }: { level: 'LOW' | 'MEDIUM' | 'HIGH' }) {
  const tone = level === 'HIGH' ? '#1B7F4B' : level === 'MEDIUM' ? '#8A6B12' : '#8A2A12';
  return (
    <span className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: tone }}>
      {level} confidence
    </span>
  );
}

function FindingCard({
  f, onStatus, busy,
}: {
  f: IntelligenceFinding;
  onStatus: (id: string, artistId: string, status: string) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="py-4 border-t" style={{ borderColor: '#E7E0D4' }}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <Link
          href={`/watcher/${f.artistId}`}
          className="text-[11px] font-black uppercase tracking-[0.16em] hover:underline"
        >
          {f.artistName}
        </Link>
        <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink/35">
          {f.signal.type.replace(/_/g, ' ')}
        </span>
        {f.status !== 'NEW' && (
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink/30">
            · {f.status.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      <p className="mt-1.5 text-[15px] font-bold leading-snug">{f.headline}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink/70">{f.whyItMatters}</p>

      <p className="mt-2 text-[13px] leading-relaxed">
        <span className="font-bold">Next: </span>{f.action}
      </p>

      <div className="mt-2.5 flex items-center gap-3 flex-wrap">
        <Confidence level={f.confidence} />
        <button
          onClick={() => setOpen(o => !o)}
          className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink/45 hover:text-ink"
        >
          {open ? 'Hide evidence' : 'View evidence'}
        </button>
        {f.status === 'NEW' && (
          <>
            <button
              disabled={busy}
              onClick={() => onStatus(f.id, f.artistId, 'ACTIONED')}
              className="text-[10px] font-bold uppercase tracking-[0.14em] disabled:opacity-40"
              style={{ color: SIGNAL }}
            >
              Actioned
            </button>
            {f.caseStudyId && (
              <button
                disabled={busy}
                onClick={() => onStatus(f.id, f.artistId, 'SAVED_AS_CASE_STUDY')}
                className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink/45 hover:text-ink disabled:opacity-40"
              >
                Keep as case study
              </button>
            )}
            <button
              disabled={busy}
              onClick={() => onStatus(f.id, f.artistId, 'DISMISSED')}
              className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink/30 hover:text-ink disabled:opacity-40"
            >
              Not interesting
            </button>
          </>
        )}
      </div>

      {open && (
        <div className="mt-3 p-3 rounded-md text-[12px] leading-relaxed" style={{ background: SOFT }}>
          <p className="text-ink/60">
            <span className="font-bold uppercase tracking-[0.12em] text-[9px]">Triggered by </span>
            {f.signal.reason}
          </p>
          <p className="mt-2 text-ink/80">{f.finding}</p>
          {f.evidence.length > 0 && (
            <ul className="mt-2 space-y-1">
              {f.evidence.map((e, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-ink/35 shrink-0 mt-0.5">
                    {e.sourceType.replace('_', ' ')}
                  </span>
                  <span className="text-ink/70">{e.claim}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[10px] text-ink/35">
            {f.toolsUsed.join(', ') || 'no tools recorded'} · {(f.tokens / 1000).toFixed(1)}k tokens · {(f.latencyMs / 1000).toFixed(0)}s
          </p>
        </div>
      )}
    </div>
  );
}

export default function IntelligencePanel({ initialRun }: { initialRun: MorningRun | null }) {
  const [run, setRun] = useState<MorningRun | null>(initialRun);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * A run spans several requests: the platform caps a function at 60s and
   * one investigation can take 45. So this starts the run, then resumes it
   * until nothing is pending, rendering each partial result as it arrives.
   * The reader sees findings appear rather than a spinner that might be a
   * timeout.
   */
  const doRun = useCallback(async () => {
    setRunning(true); setError(null);
    try {
      const post = async (body: object) => {
        const r = await fetch('/api/intelligence/run', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error(`Run failed (${r.status})`);
        return r.json();
      };

      let j = await post({});
      if (!j.run) { setError(j.error ?? 'Run failed.'); return; }
      setRun(j.run);

      /* Bounded, so a bug in `pending` cannot loop forever. */
      for (let i = 0; i < 10 && j.run.pending?.length; i++) {
        j = await post({ resume: j.run.runId });
        if (!j.run) break;
        setRun(j.run);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Run failed.');
    } finally {
      setRunning(false);
    }
  }, []);

  const onStatus = useCallback(async (id: string, artistId: string, status: string) => {
    setBusy(true);
    try {
      await fetch('/api/intelligence/finding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ findingId: id, artistId, status }),
      });
      setRun(prev => prev && {
        ...prev,
        findings: prev.findings.map(f => (f.id === id ? { ...f, status: status as any } : f)),
      });
    } finally {
      setBusy(false);
    }
  }, []);

  const live = (run?.findings ?? []).filter(f => f.status !== 'DISMISSED');
  const m = run?.metrics;

  return (
    <section className="mb-8 rounded-lg border" style={{ borderColor: '#E7E0D4', background: '#FFFFFF' }}>
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: SIGNAL }}>
            YouTube Intelligence
          </div>
          <div className="mt-1 text-[15px] font-bold">
            {!run
              ? 'No run yet'
              : live.length === 0
                ? 'Nothing deserves attention'
                : `${live.length} thing${live.length === 1 ? '' : 's'} deserve${live.length === 1 ? 's' : ''} attention`}
          </div>
          {m && (
            <div className="mt-0.5 text-[11px] text-ink/45">
              {m.channelsScanned} channels scanned · {m.candidatesTriggered} triggered ·{' '}
              {m.investigationsRun} investigated · {m.suppressedFindings} suppressed
            </div>
          )}
        </div>
        <button
          onClick={doRun}
          disabled={running}
          className="shrink-0 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-[0.14em] text-white disabled:opacity-50"
          style={{ background: SIGNAL }}
        >
          {running ? 'Running…' : 'Run'}
        </button>
      </div>

      {error && (
        <p className="px-5 pb-3 text-[12px]" style={{ color: SIGNAL }}>{error}</p>
      )}

      {run && (
        <div className="px-5 pb-4">
          {live.map(f => (
            <FindingCard key={f.id} f={f} onStatus={onStatus} busy={busy} />
          ))}

          {run.caseStudies.length > 0 && (
            <div className="mt-4 pt-3 border-t" style={{ borderColor: '#E7E0D4' }}>
              <div className="text-[9px] font-black uppercase tracking-[0.18em] text-ink/40">
                Case study candidates
              </div>
              {run.caseStudies.map(c => (
                <p key={c.id} className="mt-1.5 text-[13px]">
                  <span className="font-bold">{c.artistName} — {c.title}</span>
                  <span className="text-ink/55"> · {c.potentialLearning}</span>
                </p>
              ))}
            </div>
          )}

          {run.watching.length > 0 && (
            <div className="mt-4 pt-3 border-t" style={{ borderColor: '#E7E0D4' }}>
              <div className="text-[9px] font-black uppercase tracking-[0.18em] text-ink/40">Watching</div>
              <ul className="mt-1.5 space-y-1">
                {run.watching.map(w => (
                  <li key={w.artistId} className="text-[12px] text-ink/60">
                    <span className="font-bold text-ink/80">{w.artistName}</span> — {w.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-4 text-[11px] text-ink/35">
            {live.length === 0 && m
              ? `Everything across ${m.channelsScanned} channels is behaving within its own normal range.`
              : m
                ? `Everything else across ${m.channelsScanned} channels is behaving normally.`
                : ''}
            {m && ` · ${(m.totalTokens / 1000).toFixed(1)}k tokens, ~$${m.estimatedCostUsd.toFixed(2)}, ${(m.totalMs / 1000).toFixed(0)}s`}
          </p>
        </div>
      )}
    </section>
  );
}
