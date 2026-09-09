'use client';

/**
 * THE RESEARCHER — INTERFACE
 *
 * Deliberately plain. The brief is explicit that the interface is secondary
 * to research quality, and an elaborate dashboard here would be exactly the
 * "AI theatre" it warns against. One question box, the seed questions, the
 * findings list with approve/modify/reject, and — importantly — the tool
 * trace and the suppressed findings, so the system can be audited rather
 * than admired.
 *
 * Showing SUPPRESSED findings is a deliberate choice. A research tool that
 * silently hides what the model tried to say gives you no way to tell a
 * working gate from a broken one.
 */

import { useCallback, useEffect, useState } from 'react';

type Seed = { id: string; question: string; answerable: 'yes' | 'partial' | 'no'; limitation?: string };
type Finding = {
  id: string; claim: string; whyItMatters: string; confidence: string; status: string;
  counterEvidence: string | null; nextTest: string; potentialAction: string | null;
  evidence: { basis: string; artists: string[]; sampleSize: number; metrics: string[]; caveats: string[] };
  gate: { passed: boolean; score: number; reasons: string[] };
  humanFeedback?: { decision: string; reasoning: string };
  producedBy: string;
};

const ANSWERABLE_STYLE: Record<string, string> = {
  yes: 'bg-emerald-100 text-emerald-900',
  partial: 'bg-amber-100 text-amber-900',
  no: 'bg-rose-100 text-rose-900',
};

export default function ResearcherPage() {
  const [ready, setReady] = useState<boolean | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [setupMsg, setSetupMsg] = useState<string | null>(null);
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const [artists, setArtists] = useState<{ slug: string; name: string }[]>([]);

  const [question, setQuestion] = useState('');
  const [artistSlug, setArtistSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [trace, setTrace] = useState<{ tool: string; ms: number; ok: boolean }[]>([]);
  const [suppressed, setSuppressed] = useState<{ claim: string; reasons: string[]; score: number }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [findings, setFindings] = useState<Finding[]>([]);

  const loadFindings = useCallback(async () => {
    const r = await fetch('/api/researcher/findings').then(x => x.json());
    setFindings(r.findings ?? []);
  }, []);

  useEffect(() => {
    fetch('/api/researcher/ask').then(r => r.json()).then(r => {
      setReady(r.ready); setProvider(r.provider ? `${r.provider} · ${r.model}` : null);
      setSeeds(r.seedQuestions ?? []); setSetupMsg(r.setup ?? null);
    });
    fetch('/api/researcher/tools', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tool: 'list_roster', args: {} }),
    }).then(r => r.json()).then(r => setArtists(r.result?.artists ?? []));
    loadFindings();
  }, [loadFindings]);

  async function ask(q?: string, qid?: string) {
    const text = (q ?? question).trim();
    if (!text) return;
    setBusy(true); setError(null); setAnswer(null); setTrace([]); setSuppressed([]);
    try {
      const r = await fetch('/api/researcher/ask', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: text, artistSlug: artistSlug || undefined, questionId: qid }),
      }).then(x => x.json());
      if (r.error) setError(`${r.error}${r.setup ? ` — ${r.setup}` : ''}`);
      else {
        setAnswer(r.answer); setTrace(r.toolCalls ?? []); setSuppressed(r.suppressed ?? []);
        await loadFindings();
      }
    } catch (e) { setError(String((e as Error).message)); }
    finally { setBusy(false); }
  }

  async function decide(id: string, decision: 'approve' | 'modify' | 'reject') {
    let reasoning = '';
    let candidateLearning: string | undefined;
    if (decision !== 'approve') {
      reasoning = window.prompt('Why? (this is the useful part — what did the Researcher not know?)') ?? '';
      if (!reasoning.trim()) return;
      candidateLearning = window.prompt('Optional: state that as a testable rule for future research. Leave blank to skip.') || undefined;
    }
    await fetch('/api/researcher/findings', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, decision, reasoning, candidateLearning }),
    });
    await loadFindings();
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 text-neutral-900">
      <header className="mb-8">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500">Virgin Music · YouTube</div>
        <h1 className="mt-1 text-4xl font-black tracking-tight">The Researcher</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">
          Watcher tells you what happened. This asks whether it is unusual, whether it happens
          elsewhere, and whether it should change what we recommend. It reads the same data and
          will say when the data cannot answer a question.
        </p>
        <div className="mt-3 text-xs text-neutral-500">
          {ready === null ? 'Checking…'
            : ready ? <>Model: <span className="font-semibold text-neutral-800">{provider}</span></>
            : <span className="text-amber-700">No model configured. The tool layer still works. {setupMsg}</span>}
        </div>
      </header>

      {/* Ask */}
      <section className="rounded-lg border border-neutral-300 bg-white p-4">
        <div className="flex flex-wrap gap-2">
          <select value={artistSlug} onChange={e => setArtistSlug(e.target.value)}
            className="rounded border border-neutral-300 px-2 py-2 text-sm">
            <option value="">Whole roster</option>
            {artists.map(a => <option key={a.slug} value={a.slug}>{a.name}</option>)}
          </select>
          <input value={question} onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !busy) ask(); }}
            placeholder="Ask a research question…"
            className="min-w-[280px] flex-1 rounded border border-neutral-300 px-3 py-2 text-sm" />
          <button onClick={() => ask()} disabled={busy || !ready}
            className="rounded bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            {busy ? 'Researching…' : 'Research'}
          </button>
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500">Seed questions</div>
          <ul className="mt-2 space-y-1">
            {seeds.map(s => (
              <li key={s.id} className="flex items-start gap-2 text-sm">
                <span className={`mt-[3px] rounded px-1.5 py-[1px] text-[10px] font-bold uppercase ${ANSWERABLE_STYLE[s.answerable]}`}>
                  {s.answerable}
                </span>
                <button onClick={() => { setQuestion(s.question); ask(s.question, s.id); }}
                  disabled={busy || !ready || s.answerable === 'no'}
                  className="text-left hover:underline disabled:cursor-not-allowed disabled:text-neutral-400 disabled:no-underline">
                  {s.question}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-neutral-500">
            Questions marked <b>no</b> are disabled on purpose: the data cannot support an answer,
            and producing one anyway is how a research system starts being wrong confidently.
            Hover a label to see the limitation in the seed list returned by the API.
          </p>
        </div>
      </section>

      {error && <div className="mt-4 rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">{error}</div>}

      {answer && (
        <section className="mt-6 rounded-lg border border-neutral-300 bg-white p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500">Response</div>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed">{answer}</pre>
          {trace.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-neutral-600">
                Tool trace ({trace.length} calls)
              </summary>
              <ul className="mt-1 text-xs text-neutral-500">
                {trace.map((t, i) => (
                  <li key={i}>{t.ok ? '✓' : '✗'} {t.tool} · {t.ms}ms</li>
                ))}
              </ul>
            </details>
          )}
          {suppressed.length > 0 && (
            <details className="mt-3" open>
              <summary className="cursor-pointer text-xs font-semibold text-amber-700">
                {suppressed.length} finding{suppressed.length > 1 ? 's' : ''} suppressed by the quality gate
              </summary>
              <ul className="mt-2 space-y-2 text-xs">
                {suppressed.map((s, i) => (
                  <li key={i} className="rounded border border-amber-200 bg-amber-50 p-2">
                    <div className="font-medium text-neutral-800">{s.claim}</div>
                    <div className="mt-1 text-amber-800">Score {s.score}/12 · {s.reasons.join(' ')}</div>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {/* Findings */}
      <section className="mt-8">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500">
          Knowledge store · {findings.length} finding{findings.length === 1 ? '' : 's'}
        </h2>
        {findings.length === 0 && (
          <p className="mt-2 text-sm text-neutral-500">
            Nothing yet. Findings appear here only after passing the quality gate.
          </p>
        )}
        <ul className="mt-3 space-y-3">
          {findings.map(f => (
            <li key={f.id} className="rounded-lg border border-neutral-300 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                <span className="rounded bg-neutral-900 px-1.5 py-[2px] text-white">{f.status}</span>
                <span className="text-neutral-500">confidence {f.confidence}</span>
                <span className="text-neutral-500">n={f.evidence.sampleSize}</span>
                <span className="text-neutral-400">gate {f.gate.score}/12</span>
                {f.humanFeedback && (
                  <span className="rounded bg-blue-100 px-1.5 py-[2px] text-blue-900">
                    human: {f.humanFeedback.decision}
                  </span>
                )}
              </div>
              <p className="mt-2 font-semibold leading-snug">{f.claim}</p>
              <p className="mt-1 text-sm text-neutral-600">{f.whyItMatters}</p>

              <dl className="mt-3 space-y-1 text-xs text-neutral-600">
                <div><dt className="inline font-semibold">Evidence: </dt><dd className="inline">{f.evidence.basis}</dd></div>
                {f.evidence.artists.length > 0 && (
                  <div><dt className="inline font-semibold">Artists: </dt><dd className="inline">{f.evidence.artists.join(', ')}</dd></div>
                )}
                <div><dt className="inline font-semibold">Counter-evidence: </dt>
                  <dd className="inline">{f.counterEvidence || <span className="text-amber-700">none recorded</span>}</dd></div>
                <div><dt className="inline font-semibold">Next test: </dt><dd className="inline">{f.nextTest}</dd></div>
                {f.evidence.caveats.length > 0 && (
                  <div><dt className="inline font-semibold">Caveats: </dt><dd className="inline">{f.evidence.caveats.join(' ')}</dd></div>
                )}
              </dl>

              {f.humanFeedback?.reasoning && (
                <p className="mt-2 rounded bg-neutral-100 p-2 text-xs text-neutral-700">
                  <b>Your note:</b> {f.humanFeedback.reasoning}
                </p>
              )}

              {!f.humanFeedback && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => decide(f.id, 'approve')}
                    className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Approve</button>
                  <button onClick={() => decide(f.id, 'modify')}
                    className="rounded bg-amber-500 px-3 py-1 text-xs font-semibold text-white">Modify</button>
                  <button onClick={() => decide(f.id, 'reject')}
                    className="rounded bg-rose-600 px-3 py-1 text-xs font-semibold text-white">Reject</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
