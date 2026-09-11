/**
 * THE LIVING CAMPAIGN PAGE
 *
 * One destination for a weekly conversation with YouTube, management or an
 * artist team. Where did we start, what did we recommend, what has the team
 * implemented, what has changed, what are we watching next.
 *
 * ── WHY IT IS NOT A DASHBOARD ─────────────────────────────────────────
 * No charts, no tiles, no sparklines. The numbers on this page appear
 * inside sentences with dates attached, because the reader is deciding what
 * to do next rather than monitoring a system. A chart invites "the line is
 * going up"; a sentence forces "two Shorts appeared on 9 and 10 September
 * and nothing has been published since".
 *
 * ── EMPTY SECTIONS STAY EMPTY ─────────────────────────────────────────
 * WHAT WE'RE LEARNING renders "nothing yet" when nothing has been retained,
 * and that is the correct output for a campaign two days old. A box that
 * fills itself because it exists is the failure mode of every weekly report
 * anyone has ever been asked to read.
 *
 * Server component. Everything is fetched once, server-side, and the page
 * is a static render of a fetched report — there is no interactivity to
 * justify shipping this as client JavaScript.
 */

import Link from 'next/link';
import { getCampaignProgress } from '@/lib/intelligence/campaignProgress';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const C = {
  ink: '#0F0E17',
  paper: '#FBFAFC',
  bone: '#E6E3EC',
  smoke: '#6F6B80',
  signal: '#FF2D78',
  good: '#1B8A5A',
  amber: '#B4690E',
};

const STATE_LABEL: Record<string, string> = {
  NOT_STARTED: 'Not started',
  PLANNED: 'Planned',
  IMPLEMENTED: 'Implemented',
  OBSERVING: 'Observing',
  RESULT: 'Result available',
  LEARNED: 'Learning retained',
};

const STATE_COLOUR: Record<string, string> = {
  NOT_STARTED: C.smoke,
  PLANNED: C.amber,
  IMPLEMENTED: C.signal,
  OBSERVING: C.signal,
  RESULT: C.good,
  LEARNED: C.good,
};

function fmt(n: number | null | undefined): string {
  return n == null ? '—' : n.toLocaleString('en-GB');
}

function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  if (/^\d{4}-\d{2}$/.test(iso)) {
    return new Date(`${iso}-01`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : iso;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: '2.6rem' }}>
      <h2 style={{
        fontSize: '.72rem', letterSpacing: '.16em', textTransform: 'uppercase',
        color: C.smoke, fontWeight: 600, margin: '0 0 .9rem',
      }}>{label}</h2>
      {children}
    </section>
  );
}

export default async function CampaignProgressPage(
  { params }: { params: { slug: string } },
) {
  const report = await getCampaignProgress(params.slug);

  if (!report.deepDive) {
    return (
      <main style={{ maxWidth: 780, margin: '0 auto', padding: '4rem 1.5rem', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <h1>{report.artistName}</h1>
        <p style={{ color: C.smoke }}>
          No Deep Dive exists for this artist, so there is no strategic baseline to track progress against.
        </p>
        <Link href="/growth" style={{ color: C.signal }}>← Watcher</Link>
      </main>
    );
  }

  const dd = report.deepDive;
  const tracked = report.recommendations.filter(r => r.status !== 'NOT_STARTED');
  const open = report.recommendations.filter(r => r.status === 'NOT_STARTED');
  const learnings = report.recommendations.flatMap(r => r.learning);
  const changed = report.freshness?.checks.filter(c => c.verdict === 'CHANGED') ?? [];

  /* Uploads observed across every tracked recommendation, deduplicated —
     the same two Shorts support both reopening recommendations and should
     be listed once. */
  type Upload = NonNullable<(typeof tracked)[number]['observedSince']>['uploads'][number];
  const uploads = Array.from(new Map<string, Upload>(
    tracked.flatMap(r => r.observedSince?.uploads ?? []).map(u => [u.videoId, u] as const),
  ).values()).sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));

  return (
    <main style={{
      maxWidth: 820, margin: '0 auto', padding: '3rem 1.5rem 6rem',
      fontFamily: 'Inter, system-ui, sans-serif', color: C.ink, background: C.paper,
      lineHeight: 1.55,
    }}>
      <Link href="/growth" style={{ color: C.smoke, fontSize: '.8rem', textDecoration: 'none' }}>← Watcher</Link>

      <header style={{ marginTop: '1.4rem', borderBottom: `1px solid ${C.bone}`, paddingBottom: '1.6rem' }}>
        <h1 style={{ fontSize: 'clamp(1.9rem,5vw,2.8rem)', margin: 0, letterSpacing: '-.02em' }}>
          {report.artistName} <span style={{ color: C.smoke, fontWeight: 400 }}>× YouTube</span>
        </h1>
        <p style={{ color: C.smoke, fontSize: '.85rem', margin: '.5rem 0 0' }}>
          Living campaign record · generated {shortDate(report.generatedAt)}
        </p>
      </header>

      {/* ── DEEP DIVE ─────────────────────────────────────────────── */}
      <Section label="Where we started">
        <div style={{ background: '#fff', border: `1px solid ${C.bone}`, borderRadius: 10, padding: '1.3rem 1.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.5rem' }}>
            <strong style={{ fontSize: '1rem' }}>{dd.title}</strong>
            <span style={{ color: C.smoke, fontSize: '.8rem' }}>
              Figures captured {shortDate(dd.capturedAt)}
            </span>
          </div>
          <p style={{ margin: '.9rem 0 0', fontSize: '.95rem' }}>{dd.thesis}</p>
          {dd.deckUrl && (
            <a href={dd.deckUrl} style={{ color: C.signal, fontSize: '.82rem', display: 'inline-block', marginTop: '.8rem' }}>
              Open the full Deep Dive →
            </a>
          )}
        </div>

        {changed.length > 0 && (
          <div style={{
            marginTop: '.9rem', borderLeft: `3px solid ${C.amber}`, paddingLeft: '.9rem',
            fontSize: '.85rem', color: C.ink,
          }}>
            <strong style={{ color: C.amber }}>Since this analysis</strong>
            <ul style={{ margin: '.4rem 0 0', paddingLeft: '1.1rem' }}>
              {changed.map((c, i) => <li key={i} style={{ marginBottom: '.3rem' }}>{c.message}</li>)}
            </ul>
            <p style={{ color: C.smoke, margin: '.6rem 0 0', fontSize: '.8rem' }}>
              The Deep Dive is not wrong — it records what we saw and recommended at that date. The campaign has
              since moved, and this page measures that movement against it.
            </p>
          </div>
        )}
      </Section>

      {/* ── WHAT WE SAID ──────────────────────────────────────────── */}
      <Section label="What we said">
        <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
          {report.recommendations.map(r => (
            <li key={r.recommendation.id} style={{ marginBottom: '.55rem', fontSize: '.93rem' }}>
              {r.recommendation.point}
              <span style={{
                marginLeft: '.5rem', fontSize: '.7rem', fontWeight: 600,
                color: STATE_COLOUR[r.status], letterSpacing: '.04em',
              }}>
                {STATE_LABEL[r.status].toUpperCase()}
              </span>
            </li>
          ))}
        </ol>
        <p style={{ color: C.smoke, fontSize: '.8rem', marginTop: '.8rem' }}>
          {report.summary.total} recommendations · {report.summary.inFlight} in flight ·{' '}
          {report.summary.notStarted} not started. Nothing is removed because implementation has begun.
        </p>
      </Section>

      {/* ── WHAT WE'VE DONE ───────────────────────────────────────── */}
      <Section label="What we've done">
        {tracked.length === 0 ? (
          <p style={{ color: C.smoke, fontSize: '.9rem' }}>
            Nothing has been recorded as implemented. That means nobody has told the system what was done —
            not that nothing was done.
          </p>
        ) : tracked.map(r => (
          <div key={r.recommendation.id} style={{
            background: '#fff', border: `1px solid ${C.bone}`, borderLeft: `3px solid ${STATE_COLOUR[r.status]}`,
            borderRadius: 8, padding: '1.1rem 1.2rem', marginBottom: '.9rem',
          }}>
            <div style={{ fontSize: '.93rem', fontWeight: 600 }}>{r.recommendation.point}</div>
            <div style={{ fontSize: '.75rem', color: C.smoke, margin: '.35rem 0 .7rem' }}>
              {STATE_LABEL[r.status]} · stated by {r.implementation?.statedBy} ·{' '}
              {shortDate(r.implementation?.statedAt)}
              {r.implementation?.precision === 'month' && ' (month precision — exact date not recorded)'}
            </div>
            <p style={{ margin: 0, fontSize: '.88rem' }}>{r.implementation?.note}</p>
          </div>
        ))}
      </Section>

      {/* ── WHAT'S HAPPENED SINCE ─────────────────────────────────── */}
      <Section label="What's happened since">
        {uploads.length > 0 ? (
          <>
            <p style={{ fontSize: '.8rem', color: C.smoke, margin: '0 0 .6rem' }}>
              OBSERVED — published on the channel. These support the implementation above; they do not by
              themselves establish that it happened.
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.87rem' }}>
              <tbody>
                {uploads.map(u => (
                  <tr key={u.videoId} style={{ borderBottom: `1px solid ${C.bone}` }}>
                    <td style={{ padding: '.55rem 0', color: C.smoke, whiteSpace: 'nowrap', width: 110 }}>
                      {shortDate(u.publishedAt)}
                    </td>
                    <td style={{ padding: '.55rem .6rem' }}>
                      <a href={`https://www.youtube.com/watch?v=${u.videoId}`}
                         target="_blank" rel="noopener" style={{ color: C.ink }}>
                        {u.title}
                      </a>
                      <span style={{ color: C.smoke, fontSize: '.75rem', marginLeft: '.5rem' }}>{u.kind}</span>
                    </td>
                    <td style={{ padding: '.55rem 0', textAlign: 'right', color: C.smoke, whiteSpace: 'nowrap' }}>
                      {fmt(u.views)} views
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: '.75rem', color: C.smoke, marginTop: '.6rem' }}>
              Lifetime view totals read once. Not velocity, and not to be divided by asset age.
            </p>
          </>
        ) : (
          <p style={{ color: C.smoke, fontSize: '.9rem' }}>No uploads observed since implementation.</p>
        )}

        {tracked[0]?.observedSince?.channelMovement?.length ? (
          <p style={{ fontSize: '.87rem', marginTop: '1rem' }}>
            <span style={{ fontSize: '.75rem', color: C.smoke, letterSpacing: '.06em' }}>DERIVED · </span>
            {tracked[0].observedSince.channelMovement
              .filter(m => m.delta != null)
              .map(m => `${m.delta! >= 0 ? '+' : ''}${fmt(m.delta)} ${m.metric}`)
              .join(' · ') || 'no movement recorded in the snapshot series'}
            {' '}over {tracked[0].observedSince.channelMovement[0]?.over}.
          </p>
        ) : null}

        {report.watcherReads.latest && (
          <p style={{ fontSize: '.85rem', marginTop: '1rem', color: C.smoke }}>
            Latest Campaign Read ({shortDate(report.watcherReads.latest.generatedAt)}):{' '}
            <span style={{ color: C.ink }}>{report.watcherReads.latest.headline}</span>
          </p>
        )}
      </Section>

      {/* ── WHAT WE'RE WATCHING ───────────────────────────────────── */}
      <Section label="What we're watching">
        {tracked.map(r => (
          <p key={r.recommendation.id} style={{ fontSize: '.88rem', margin: '0 0 .7rem' }}>
            <strong style={{ fontWeight: 600 }}>{r.recommendation.point}</strong>
            <br />
            <span style={{ color: C.smoke }}>{r.nextWatch}</span>
          </p>
        ))}
        {open.length > 0 && (
          <p style={{ fontSize: '.85rem', color: C.smoke, marginTop: '1rem' }}>
            {open.length} recommendation{open.length === 1 ? '' : 's'} not yet started:{' '}
            {open.map(r => r.recommendation.needTags[0] ?? 'untagged').filter((v, i, a) => a.indexOf(v) === i).join(', ')}.
          </p>
        )}
      </Section>

      {/* ── WHAT WE'RE LEARNING ───────────────────────────────────── */}
      <Section label="What we're learning">
        {learnings.length === 0 ? (
          <p style={{ color: C.smoke, fontSize: '.9rem' }}>
            Nothing yet. No result has accumulated long enough to review, and no conclusion has been retained.
            This stays empty until one is.
          </p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '.9rem' }}>
            {learnings.map((l, i) => (
              <li key={i} style={{ marginBottom: '.5rem' }}>
                {l.statement}
                <span style={{ color: C.smoke, fontSize: '.75rem' }}> · retained {shortDate(l.retainedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ── WHAT WE'RE SEEING ELSEWHERE ───────────────────────────── */}
      <Section label="What we're seeing elsewhere">
        <p style={{ color: C.smoke, fontSize: '.9rem' }}>{report.seeingElsewhere.note}</p>
        {!report.seeingElsewhere.ready && report.seeingElsewhere.candidateCount > 0 && (
          <p style={{ color: C.smoke, fontSize: '.8rem' }}>
            {report.seeingElsewhere.candidateCount} external example(s) are in the library awaiting verification.
          </p>
        )}
      </Section>

      <footer style={{ marginTop: '3.5rem', borderTop: `1px solid ${C.bone}`, paddingTop: '1.2rem' }}>
        <h3 style={{ fontSize: '.7rem', letterSpacing: '.14em', color: C.smoke, textTransform: 'uppercase', margin: '0 0 .6rem' }}>
          What this page can and cannot say
        </h3>
        <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '.78rem', color: C.smoke }}>
          {report.limitations.map((l, i) => <li key={i} style={{ marginBottom: '.3rem' }}>{l}</li>)}
        </ul>
      </footer>
    </main>
  );
}
