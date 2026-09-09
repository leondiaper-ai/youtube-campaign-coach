'use client';

/**
 * THE ASSISTANT HOME
 *
 * Prepared work, not an input box. The strategist arrives and the assistant
 * has already done something; the page's job is to show what, in under a
 * minute, and to get out of the way.
 *
 * Two jobs, kept visually apart because they are genuinely different:
 * MY CAMPAIGNS is about artists we work on, SCOUT is about everyone else.
 *
 * Design language is inherited from Watcher on purpose. This is an
 * experiment to judge usefulness, and time spent on a bespoke visual
 * system is time not spent finding out whether anyone opens it twice.
 */

import { useState, useCallback } from 'react';
import Link from 'next/link';
import type { AssistantHome as HomeData, CampaignRow, ReportStatus } from '@/lib/assistant/home';
import type { CoachOverview } from '@/lib/coach-service/types';
import { SHARE_LABELS, type ShareFormat } from '@/lib/assistant/share';

const SIGNAL = '#FF3B14';
const SOFT = '#F6F1E7';
const LINE = '#E7E0D4';

const STATUS_TONE: Record<string, string> = {
  ACTION_REQUIRED: SIGNAL,
  RISK: SIGNAL,
  OPPORTUNITY: '#1B7F4B',
  WATCH: '#8A6B12',
  ON_TRACK: '#5A5A5A',
};

const REPORT_LABEL: Record<ReportStatus, string> = {
  READY: 'Ready',
  NEEDS_REFRESH: 'Needs refresh',
  NOT_GENERATED: 'Not generated',
};

function Section({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: SIGNAL }}>
        {title}
      </div>
      {subtitle && <div className="mt-0.5 text-[12px] text-ink/45">{subtitle}</div>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/* ── The report ──────────────────────────────────────────────────────── */

function Report({ o, onClose }: { o: CoachOverview; onClose: () => void }) {
  const [format, setFormat] = useState<ShareFormat | null>(null);
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);

  const share = useCallback(async (f: ShareFormat) => {
    setFormat(f); setCopied(false);
    const r = await fetch('/api/assistant', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'share', slug: o.artistId, format: f }),
    });
    const j = await r.json();
    setText(j.text ?? '');
  }, [o.artistId]);

  const risks = o.status === 'ACTION_REQUIRED' || o.status === 'RISK';

  return (
    <div className="mt-3 p-4 rounded-lg border" style={{ borderColor: LINE, background: '#FFF' }}>
      <div className="flex items-start justify-between gap-4">
        <div className="text-[13px] font-black uppercase tracking-[0.16em]">
          {o.artistName}{o.campaignName ? ` · ${o.campaignName}` : ''}
        </div>
        <button onClick={onClose} className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink/40 hover:text-ink">
          Close
        </button>
      </div>

      <div className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-ink/40">The read</div>
      <p className="mt-1 text-[15px] font-bold leading-snug">{o.headline}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink/75">{o.interpretation}</p>

      <div className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-ink/40">What&rsquo;s working</div>
      <p className="mt-1 text-[13px] leading-relaxed text-ink/75">{o.whatHappened}</p>

      {risks && (
        <>
          <div className="mt-4 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: SIGNAL }}>
            Needs attention
          </div>
          <p className="mt-1 text-[13px] leading-relaxed">{o.evidenceSummary || o.headline}</p>
        </>
      )}

      <div className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-ink/40">Next</div>
      <p className="mt-1 text-[13px] leading-relaxed">{o.recommendation}</p>
      {o.timing && <p className="mt-1 text-[12px] text-ink/55">{o.timing}</p>}

      {(o.evidence.length > 0 || o.missingContext) && (
        <>
          <div className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-ink/40">Context</div>
          <ul className="mt-1 space-y-1">
            {o.evidence.slice(0, 5).map((e, i) => (
              <li key={i} className="flex gap-2 text-[12px]">
                <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-ink/35 shrink-0 mt-1">
                  {e.sourceType.replace('_', ' ')}
                </span>
                <span className="text-ink/70">{e.claim}</span>
              </li>
            ))}
          </ul>
          {o.missingContext && (
            <p className="mt-2 text-[11px] text-ink/45">Not visible to us: {o.missingContext}</p>
          )}
        </>
      )}

      <div className="mt-5 pt-3 border-t flex items-center gap-2 flex-wrap" style={{ borderColor: LINE }}>
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-ink/40 mr-1">Share as</span>
        {(Object.keys(SHARE_LABELS) as ShareFormat[]).map(f => (
          <button
            key={f}
            onClick={() => share(f)}
            className="px-2.5 py-1 rounded text-[11px] font-bold"
            style={{
              background: format === f ? SIGNAL : SOFT,
              color: format === f ? '#FFF' : undefined,
            }}
          >
            {SHARE_LABELS[f]}
          </button>
        ))}
      </div>

      {format && (
        <div className="mt-3">
          <textarea
            readOnly
            value={text}
            rows={Math.min(20, text.split('\n').length + 1)}
            className="w-full p-3 rounded-md text-[12px] font-mono leading-relaxed"
            style={{ background: SOFT, border: `1px solid ${LINE}` }}
          />
          <button
            onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); }}
            className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: SIGNAL }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Campaign row ────────────────────────────────────────────────────── */

function Campaign({ row, overview, onRefresh, busy }: {
  row: CampaignRow;
  overview: CoachOverview | undefined;
  onRefresh: (slug: string) => void;
  busy: string | null;
}) {
  const [open, setOpen] = useState(false);
  const tone = row.read ? (STATUS_TONE[row.read.status] ?? '#5A5A5A') : '#9A9A9A';

  return (
    <div className="py-3.5 border-t" style={{ borderColor: LINE }}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <Link href={`/watcher/${row.slug}`} className="text-[13px] font-black uppercase tracking-[0.14em] hover:underline">
          {row.name}
        </Link>
        {row.campaignName && (
          <span className="text-[11px] text-ink/50">{row.campaignName}</span>
        )}
        {row.campaignDay != null && (
          <span className="text-[10px] text-ink/35">day {row.campaignDay}</span>
        )}
        <span className="text-[9px] font-bold uppercase tracking-[0.14em] ml-auto" style={{ color: tone }}>
          {row.read ? row.read.status.replace(/_/g, ' ') : REPORT_LABEL[row.reportStatus]}
        </span>
      </div>

      {row.read ? (
        <>
          <p className="mt-1.5 text-[14px] font-bold leading-snug">{row.read.headline}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink/65">
            <span className="font-bold">Next: </span>{row.read.next}
          </p>
        </>
      ) : (
        <p className="mt-1.5 text-[13px] text-ink/45">
          No read prepared yet.
        </p>
      )}

      <div className="mt-2 flex items-center gap-3 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink/35">
          {REPORT_LABEL[row.reportStatus]}
          {row.read ? ` · ${row.read.ageHours}h old · ${row.read.confidence} confidence` : ''}
        </span>
        <Link href={`/campaigns`} className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink/45 hover:text-ink">
          Open campaign
        </Link>
        {overview && (
          <button
            onClick={() => setOpen(o => !o)}
            className="text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: SIGNAL }}
          >
            {open ? 'Hide report' : 'View report'}
          </button>
        )}
        <button
          onClick={() => onRefresh(row.slug)}
          disabled={busy === row.slug}
          className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink/45 hover:text-ink disabled:opacity-40"
        >
          {busy === row.slug ? 'Preparing…' : row.read ? 'Refresh read' : 'Generate read'}
        </button>
      </div>

      {open && overview && <Report o={overview} onClose={() => setOpen(false)} />}
    </div>
  );
}

/* ── Scout evidence ──────────────────────────────────────────────────── */

function fmt(n: number) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : String(n);
}

/**
 * The sequence, not the prose. A strategist can judge campaign architecture
 * from a dated list of assets in seconds; they cannot judge it from three
 * paragraphs about a channel they have never heard of.
 */
function EvidenceTimeline({ timeline }: {
  timeline: { date: string; format: string; views: number; title: string }[];
}) {
  const rows = timeline.slice(0, 14);
  return (
    <div className="mt-3">
      {rows.map((t, i) => {
        const prev = rows[i - 1];
        const gap = prev
          ? Math.round((new Date(prev.date).getTime() - new Date(t.date).getTime()) / 86_400_000)
          : null;
        return (
          <div key={`${t.date}-${i}`}>
            {gap != null && gap > 0 && (
              <div className="pl-[68px] py-0.5 text-[10px] text-ink/30">↓ {gap} day{gap === 1 ? '' : 's'}</div>
            )}
            <div className="flex items-baseline gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink/45 w-[62px] shrink-0">
                {new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.12em] w-[74px] shrink-0" style={{ color: SIGNAL }}>
                {t.format}
              </span>
              <span className="text-[12px] text-ink/75 truncate">{t.title}</span>
              <span className="text-[11px] text-ink/45 ml-auto shrink-0">{fmt(t.views)}</span>
            </div>
          </div>
        );
      })}
      <p className="mt-2 text-[10px] text-ink/35">
        Lifetime view totals, read once. Not a time series — older assets have had longer to accumulate.
      </p>
    </div>
  );
}

/* ── The page ────────────────────────────────────────────────────────── */

export default function AssistantHomeView({ initial }: { initial: HomeData }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [scouting, setScouting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [openEvidence, setOpenEvidence] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const r = await fetch('/api/assistant', { cache: 'no-store' });
    setData(await r.json());
  }, []);

  const refresh = useCallback(async (slug: string) => {
    setBusy(slug); setNote(null);
    try {
      const r = await fetch('/api/assistant', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'refresh', slug }),
      });
      const j = await r.json();
      if (j.error) setNote(`Could not prepare a read: ${j.detail ?? j.error}`);
      else await reload();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Refresh failed.');
    } finally { setBusy(null); }
  }, [reload]);

  const runScout = useCallback(async () => {
    setScouting(true); setNote(null);
    try {
      /* One mission per request — discovery alone is ~20s and the platform
         kills the function at 60. */
      for (const m of ['POST_HERO', 'MULTI_FORMAT', 'LIVE']) {
        await fetch('/api/scout', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ missions: [m], discoverOnly: true, discoveryLimit: 8 }),
        });
      }
      await reload();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Scout run failed.');
    } finally { setScouting(false); }
  }, [reload]);

  const investigate = useCallback(async (mission: string) => {
    setScouting(true); setNote(null);
    try {
      await fetch('/api/scout', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'investigate', mission, limit: 2 }),
      });
      await reload();
    } finally { setScouting(false); }
  }, [reload]);

  const s = data.scout;
  const a = s.activity;

  return (
    <div>
      {/* ── TODAY ─────────────────────────────────────────────────── */}
      <section className="p-5 rounded-lg border" style={{ borderColor: LINE, background: '#FFF' }}>
        <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: SIGNAL }}>
          Today
        </div>
        <ul className="mt-2 space-y-1">
          {data.today.map((l, i) => (
            <li
              key={i}
              className="text-[14px]"
              style={{ fontWeight: l.attention ? 700 : 400, color: l.attention ? undefined : '#4A4A4A' }}
            >
              {l.text}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-ink/35">
          {data.lastScoutRun
            ? `Last Scout run ${new Date(data.lastScoutRun).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
            : 'Scout has not run yet'}
          {' · '}
          Reading this page costs nothing — work happens when you press a button.
        </p>
      </section>

      {note && (
        <p className="mt-3 text-[12px]" style={{ color: SIGNAL }}>{note}</p>
      )}

      {/* ── SCOUT FOUND ───────────────────────────────────────────── */}
      {s.found.length > 0 && (
        <Section title="Scout found">
          {s.found.map(({ finding, caseStudy }) => (
            <div key={finding.id} className="py-4 border-t" style={{ borderColor: LINE }}>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[13px] font-black uppercase tracking-[0.14em]">{finding.subjectName}</span>
                <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink/40">
                  {finding.trigger.kind.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="mt-1.5 text-[15px] font-bold leading-snug">{finding.headline}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink/70">{finding.whyItMatters}</p>
              {caseStudy && (
                <p className="mt-1.5 text-[13px] leading-relaxed">
                  <span className="font-bold">Possible lesson: </span>{caseStudy.possibleLearning}
                </p>
              )}
              <button
                onClick={() => setOpenEvidence(openEvidence === finding.id ? null : finding.id)}
                className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ color: SIGNAL }}
              >
                {openEvidence === finding.id ? 'Hide evidence' : 'View evidence'}
              </button>
              {openEvidence === finding.id && (
                <div className="mt-2 p-3 rounded-md" style={{ background: SOFT }}>
                  <p className="text-[12px] text-ink/60">
                    <span className="font-bold uppercase tracking-[0.12em] text-[9px]">Triggered by </span>
                    {finding.trigger.reason}
                  </p>
                  <p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-ink/40">Scout read</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink/80">{finding.finding}</p>
                  {caseStudy?.limitations && (
                    <>
                      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-ink/40">Limitations</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-ink/70">{caseStudy.limitations}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* ── MY CAMPAIGNS ──────────────────────────────────────────── */}
      <Section title="My campaigns" subtitle="Prepared reads for the campaigns you have pinned">
        {data.campaigns.length === 0 ? (
          <p className="text-[13px] text-ink/45">
            No campaigns pinned. Pin one from <Link href="/campaigns" className="underline">Active Campaigns</Link> and
            the assistant will prepare a read for it.
          </p>
        ) : (
          data.campaigns.map(row => (
            <Campaign
              key={row.slug} row={row}
              overview={data.overviews[row.slug]}
              onRefresh={refresh} busy={busy}
            />
          ))
        )}
      </Section>

      {/* ── SCOUT ─────────────────────────────────────────────────── */}
      <Section title="Scout" subtitle="Researching music YouTube outside our roster">
        {s.found.length === 0 && (
          <p className="text-[13px] text-ink/55">
            No material Scout findings yet. What Scout is currently researching is below.
          </p>
        )}

        <div className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-ink/40">Watching</div>
        {s.watching.length === 0 ? (
          <p className="mt-1 text-[13px] text-ink/45">No open investigations.</p>
        ) : (
          s.watching.map(w => (
            <div key={w.channelId} className="mt-2.5 pt-2.5 border-t" style={{ borderColor: LINE }}>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[12px] font-black uppercase tracking-[0.14em]">{w.title}</span>
                <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink/40">
                  {w.missions.join(' · ').replace(/_/g, ' ')}
                </span>
                <span className="text-[9px] uppercase tracking-[0.14em] text-ink/30 ml-auto">
                  {w.observationCount} observation{w.observationCount === 1 ? '' : 's'}
                </span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-ink/65">{w.whyWatching}</p>
            </div>
          ))
        )}

        <div className="mt-6 text-[10px] font-black uppercase tracking-[0.18em] text-ink/40">Researching</div>
        <div className="mt-2 space-y-3">
          {s.missions.map(m => (
            <div key={m.id} className="pt-2.5 border-t" style={{ borderColor: LINE }}>
              <div className="flex items-baseline gap-2">
                <span className="text-[11px] font-black uppercase tracking-[0.16em]">{m.id.replace(/_/g, ' ')}</span>
                <button
                  onClick={() => investigate(m.id)}
                  disabled={scouting}
                  className="text-[10px] font-bold uppercase tracking-[0.14em] ml-auto disabled:opacity-40"
                  style={{ color: SIGNAL }}
                >
                  Investigate
                </button>
              </div>
              <p className="mt-0.5 text-[12px] text-ink/60">{m.question}</p>
              <p className="mt-1 text-[11px] text-ink/40">
                {m.channelsDiscovered} discovered · {m.channelsWatched} watched ·{' '}
                {m.investigations} investigated · {m.findings} finding{m.findings === 1 ? '' : 's'} ·{' '}
                {m.caseStudies} case stud{m.caseStudies === 1 ? 'y' : 'ies'}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3 flex-wrap">
          <button
            onClick={runScout}
            disabled={scouting}
            className="px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-[0.14em] text-white disabled:opacity-50"
            style={{ background: SIGNAL }}
          >
            {scouting ? 'Running…' : 'Run Scout'}
          </button>
          <span className="text-[11px] text-ink/40">
            Scout this week · {a.discovered} channels discovered · {a.qualified} qualified ·{' '}
            {a.investigated} investigated · {a.retained} retained
            {a.quotaUnits ? ` · ${a.quotaUnits} API units` : ''}
          </span>
        </div>
        <p className="mt-1 text-[10px] text-ink/30">
          {s.universeSize} channels in the Scout universe. Discovery volume is not itself a result —
          the number that matters is what was retained.
        </p>

        {data.inactiveMissions.length > 0 && (
          <details className="mt-4">
            <summary className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink/35 cursor-pointer">
              {data.inactiveMissions.length} research questions not being asked, and why
            </summary>
            <ul className="mt-2 space-y-1.5">
              {data.inactiveMissions.map(m => (
                <li key={m.id} className="text-[11px] text-ink/55">
                  <span className="font-bold">{m.id.replace(/_/g, ' ')}</span> — {m.rationale}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Section>
    </div>
  );
}
