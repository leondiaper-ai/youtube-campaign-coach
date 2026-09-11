/**
 * CAMPAIGN PROGRESS — INDEX
 *
 * Every artist with a Deep Dive, and whether anything has been recorded
 * against it yet. Mostly this page will say "no progress recorded", and
 * that is the useful part: it shows at a glance which strategies are being
 * tracked and which are sitting in a deck nobody has reported back on.
 *
 * ── NOT A PRODUCT SURFACE ─────────────────────────────────────────────
 * This route is retained as an internal inspection view and is
 * deliberately NOT in the Watcher navigation. The campaign progress
 * intelligence is real and valuable, but people experience it through the
 * artist Deep Dive deck — which is the thing they already open, already
 * like, and already show to YouTube. Asking them to learn a second surface
 * to read the same intelligence was the wrong architecture.
 *
 * The deck reads this data via /api/campaign-cover.
 */

import Link from 'next/link';
import { listDeepDives } from '@/lib/intelligence/deepDiveStore';
import { listProgress } from '@/lib/intelligence/progressStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const C = { ink: '#0F0E17', bone: '#E6E3EC', smoke: '#6F6B80', signal: '#FF2D78' };

export default async function CampaignProgressIndex() {
  const dives = await listDeepDives();
  const rows = await Promise.all(dives.map(async d => ({
    ...d,
    progress: await listProgress(d.artistSlug).catch(() => []),
  })));

  return (
    <main style={{
      maxWidth: 820, margin: '0 auto', padding: '3rem 1.5rem 6rem',
      fontFamily: 'Inter, system-ui, sans-serif', color: C.ink, lineHeight: 1.55,
    }}>
      <Link href="/growth" style={{ color: C.smoke, fontSize: '.8rem', textDecoration: 'none' }}>← Watcher</Link>

      <h1 style={{ fontSize: 'clamp(1.7rem,4vw,2.3rem)', margin: '1.2rem 0 .4rem', letterSpacing: '-.02em' }}>
        Campaign Progress
      </h1>
      <p style={{ color: C.smoke, fontSize: '.9rem', margin: '0 0 2rem', maxWidth: '58ch' }}>
        Each Deep Dive is a fixed strategic baseline. These pages track what has happened since — what the
        team implemented, what Watcher observed, and what we are still waiting to learn.
      </p>

      {rows.map(r => {
        const inFlight = r.progress.filter(p => p.state !== 'NOT_STARTED').length;
        return (
          <Link
            key={r.artistSlug}
            href={`/campaign-progress/${r.artistSlug}`}
            style={{
              display: 'block', textDecoration: 'none', color: 'inherit',
              border: `1px solid ${C.bone}`, borderRadius: 10,
              padding: '1.1rem 1.2rem', marginBottom: '.8rem', background: '#fff',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '1.02rem' }}>{r.artistName}</strong>
              <span style={{ fontSize: '.78rem', color: inFlight ? C.signal : C.smoke, fontWeight: 600 }}>
                {inFlight
                  ? `${inFlight} recommendation${inFlight === 1 ? '' : 's'} in flight`
                  : 'No progress recorded'}
              </span>
            </div>
            <p style={{ margin: '.5rem 0 0', fontSize: '.85rem', color: C.smoke }}>
              Deep Dive {r.deckUpdated} · {r.gapCount} gaps · {r.opportunityCount} opportunities
            </p>
          </Link>
        );
      })}

      <p style={{ color: C.smoke, fontSize: '.78rem', marginTop: '2rem' }}>
        &ldquo;No progress recorded&rdquo; means nobody has told the system what was done. It is not a
        statement that nothing was done.
      </p>
    </main>
  );
}
