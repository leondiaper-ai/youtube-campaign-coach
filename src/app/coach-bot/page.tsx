'use client';

/**
 * COACH BOT — RECOMMENDATION REVIEW
 *
 * Deliberately minimal. The brief is explicit that the main interface for
 * this phase is Grok itself; this page exists only so approve / modify /
 * reject is possible outside a chat window, and so recommendations are
 * inspectable.
 *
 * The reason field is mandatory on modify and reject because the reason is
 * the product. A bare "rejected" teaches the system nothing.
 */

import { useCallback, useEffect, useState } from 'react';

type Rec = {
  id: string; createdAt: string; artistSlug: string; artistName: string;
  campaignName: string | null; campaignDay: number | null; phase: string | null;
  status: string; whatHappened: string; soWhat: string; recommendation: string;
  when: string; evidence: string; evidenceClasses: string[]; confidence: string;
  nextCheck: string; missingEvidence: string; producedBy: string;
  feedback?: { decision: string; reason: string; missingContext?: string; candidateLearning?: string; at: string };
};

const STATUS_STYLE: Record<string, string> = {
  ON_TRACK: 'bg-emerald-100 text-emerald-900',
  WATCH: 'bg-sky-100 text-sky-900',
  ACTION_REQUIRED: 'bg-amber-200 text-amber-950',
  OPPORTUNITY: 'bg-violet-100 text-violet-900',
  RISK: 'bg-rose-200 text-rose-950',
};

export default function CoachBotPage() {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/coach-bot/recommendations').then(x => x.json());
    setRecs(r.recommendations ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function decide(id: string, decision: 'approve' | 'modify' | 'reject') {
    let reason = '';
    let missingContext: string | undefined;
    let candidateLearning: string | undefined;
    let modifiedRecommendation: string | undefined;

    if (decision !== 'approve') {
      reason = window.prompt('Why? This is the part the system learns from.') ?? '';
      if (!reason.trim()) return;
      missingContext = window.prompt('What did the Coach not know? (optional)') || undefined;
      candidateLearning = window.prompt('State it as a testable rule for future coaching (optional — it will be stored as an untested hypothesis, not a rule)') || undefined;
    }
    if (decision === 'modify') {
      modifiedRecommendation = window.prompt('Revised recommendation:') || undefined;
    }

    await fetch('/api/coach-bot/recommendations', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, decision, reason, missingContext, candidateLearning, modifiedRecommendation }),
    });
    await load();
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 text-neutral-900">
      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500">Virgin Music · YouTube</div>
      <h1 className="mt-1 text-4xl font-black tracking-tight">Campaign Coach</h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600">
        Recommendations written by the Grok Bot through the Watcher MCP server. Approve, modify or
        reject — the reason is stored against the campaign and the Coach reads it back before
        recommending anything similar again.
      </p>

      {loading && <p className="mt-6 text-sm text-neutral-500">Loading…</p>}
      {!loading && recs.length === 0 && (
        <p className="mt-6 rounded border border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-600">
          No recommendations yet. Ask the Coach in Grok — for example <b>&ldquo;Coach K-Trap&rdquo;</b> —
          and anything it judges worth acting on will appear here. If it decides no intervention is
          required, nothing is recorded, which is the intended behaviour.
        </p>
      )}

      <ul className="mt-6 space-y-4">
        {recs.map(r => (
          <li key={r.id} id={r.id} className="rounded-lg border border-neutral-300 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
              <span className={`rounded px-2 py-[2px] ${STATUS_STYLE[r.status] ?? 'bg-neutral-200'}`}>
                {r.status.replace('_', ' ')}
              </span>
              <span className="text-neutral-800">{r.artistName}</span>
              {r.campaignDay && <span className="text-neutral-500">day {r.campaignDay}</span>}
              {r.phase && <span className="text-neutral-500">{r.phase}</span>}
              <span className="text-neutral-400">confidence {r.confidence}</span>
              {r.feedback && (
                <span className="rounded bg-blue-100 px-2 py-[2px] text-blue-900">
                  {r.feedback.decision}
                </span>
              )}
            </div>

            <dl className="mt-3 space-y-2 text-sm">
              <div><dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">What happened</dt><dd>{r.whatHappened}</dd></div>
              <div><dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">So what</dt><dd>{r.soWhat}</dd></div>
              <div><dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Recommendation</dt><dd className="font-semibold">{r.recommendation}</dd></div>
              <div><dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">When</dt><dd>{r.when}</dd></div>
              <div><dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Evidence</dt>
                <dd className="text-neutral-600">{r.evidence}
                  {r.evidenceClasses?.length > 0 && (
                    <span className="ml-1 text-[10px] uppercase text-neutral-400">[{r.evidenceClasses.join(', ')}]</span>
                  )}
                </dd></div>
              <div><dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Missing evidence</dt>
                <dd className="text-amber-800">{r.missingEvidence}</dd></div>
              <div><dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Next check</dt><dd className="text-neutral-600">{r.nextCheck}</dd></div>
            </dl>

            {r.feedback && (
              <div className="mt-3 rounded bg-neutral-100 p-3 text-xs">
                <b>Your verdict:</b> {r.feedback.decision} — {r.feedback.reason}
                {r.feedback.missingContext && <div className="mt-1"><b>Missing context:</b> {r.feedback.missingContext}</div>}
                {r.feedback.candidateLearning && (
                  <div className="mt-1"><b>Candidate learning (untested):</b> {r.feedback.candidateLearning}</div>
                )}
              </div>
            )}

            {!r.feedback && (
              <div className="mt-3 flex gap-2">
                <button onClick={() => decide(r.id, 'approve')} className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Approve</button>
                <button onClick={() => decide(r.id, 'modify')} className="rounded bg-amber-500 px-3 py-1 text-xs font-semibold text-white">Modify</button>
                <button onClick={() => decide(r.id, 'reject')} className="rounded bg-rose-600 px-3 py-1 text-xs font-semibold text-white">Reject</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
