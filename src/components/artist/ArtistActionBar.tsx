'use client';

/* ═══════════════════════════════════════════════════════════════════════
   ARTIST ACTION BAR — everything you can DO with this artist, at the top.

   The page below is one long read. That is the right shape for the
   analysis, but it makes the actions unreachable if they sit at the
   bottom: "open the behaviour timeline" is something you want on arrival,
   not after scrolling past thirty thumbnails. So the actions come first
   and stay together.

   Pinning is here rather than buried because the pin is what makes an
   artist a tracked project — it decides what appears in the briefings and
   the campaign board. It is a roster-level decision taken while looking
   at one artist, which is exactly why it belongs on this page.

   The deep dive link only renders when a deck exists (see lib/deepDiveLink).
   Decks marked `publicLink` get a visible warning: this page is internal
   and needs a login, the deck does not, and the two must not look alike
   when someone is about to paste a URL into an email.
   ═══════════════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import Link from 'next/link';
import { useCopyUpdate, type ReportProps } from '@/components/WatcherReport';
import type { DeepDiveLink } from '@/lib/deepDiveLink';
import { INK, PAPER, RULE } from './primitives';

const PIN_ON = '#2C25FF';

export default function ArtistActionBar({
  slug,
  initiallyPinned,
  deepDive,
  reportProps,
}: {
  slug: string;
  initiallyPinned: boolean;
  deepDive: DeepDiveLink | null;
  reportProps: ReportProps;
}) {
  const [pinned, setPinned] = useState(initiallyPinned);
  const [busy, setBusy] = useState(false);
  const { copied, copy } = useCopyUpdate(reportProps);

  /* Same contract as the old PinCampaignButton: the API route owns the
     store, this only reflects it. The optimistic flip is reverted on
     failure rather than left showing a pin that was never saved. */
  async function togglePin() {
    if (busy) return;
    setBusy(true);
    const next = !pinned;
    setPinned(next);
    try {
      const res = next
        ? await fetch('/api/active-campaigns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug }),
          })
        : await fetch(`/api/active-campaigns?slug=${encodeURIComponent(slug)}`, {
            method: 'DELETE',
          });
      if (!res.ok) setPinned(!next);
    } catch {
      setPinned(!next);
    } finally {
      setBusy(false);
    }
  }

  const chip =
    'px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-[0.1em] no-underline ' +
    'transition-colors whitespace-nowrap';

  return (
    <div
      className="flex flex-wrap items-center gap-2 mb-10 pb-5"
      style={{ borderBottom: `1px solid ${RULE}` }}
    >
      <Link
        href="/growth"
        className={chip + ' text-ink/50 hover:text-ink'}
        style={{ border: `1px solid ${RULE}` }}
      >
        ← Dashboard
      </Link>

      {/* The behaviour timeline is the single most-used destination from
          this page, so it is the filled button and it is always present.
          It used to appear only for pinned artists, which hid the most
          useful view precisely when you were deciding whether to pin. */}
      <Link
        href={`/campaigns?behaviour=${encodeURIComponent(slug)}`}
        className={chip}
        style={{ background: INK, color: PAPER }}
      >
        Channel behaviour
      </Link>

      <button
        type="button"
        onClick={() => copy('report')}
        className={chip}
        style={{ border: `1px solid ${RULE}`, color: INK, background: 'transparent' }}
      >
        {copied === 'report' ? '✓ Copied' : 'Copy report'}
      </button>

      <button
        type="button"
        onClick={togglePin}
        disabled={busy}
        aria-pressed={pinned}
        className={chip}
        style={
          pinned
            ? { background: PIN_ON, color: '#fff', border: `1px solid ${PIN_ON}` }
            : { border: `1px solid ${RULE}`, color: INK, background: 'transparent' }
        }
      >
        {pinned ? '★ Tracked project' : '☆ Track project'}
      </button>

      {deepDive && (
        <Link
          href={deepDive.href}
          title={deepDive.title}
          className={chip + ' text-ink/70 hover:text-ink'}
          style={{ border: `1px solid ${RULE}` }}
        >
          Deep dive
          {deepDive.updated && (
            <span className="font-bold normal-case tracking-normal text-ink/35 ml-1.5">
              {deepDive.updated}
            </span>
          )}
          {deepDive.publicLink && (
            <span className="font-bold normal-case tracking-normal text-ink/35 ml-1.5">
              · public link
            </span>
          )}
        </Link>
      )}
    </div>
  );
}
