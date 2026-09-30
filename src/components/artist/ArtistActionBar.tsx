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

/**
 * Where "back" goes, where Behaviour goes, and which store the pin writes
 * to. Omit it and the bar behaves as our own Watcher page.
 *
 * A regional board differs in exactly these three ways and in no others,
 * so they are passed rather than branched on — which is what stops the
 * team's bar drifting into a second, thinner design the way it had before.
 */
export interface ActionBarContext {
  backHref: string;
  backLabel: string;
  behaviourHref: string;
  /** Team boards pin to their own board, never to our campaign store. */
  pin:
    | { mode: 'watcher' }
    | { mode: 'team'; team: string; channelId: string };
}

const WATCHER_CONTEXT = (slug: string): ActionBarContext => ({
  backHref: '/growth',
  backLabel: '← Dashboard',
  behaviourHref: `/campaigns?behaviour=${encodeURIComponent(slug)}`,
  pin: { mode: 'watcher' },
});

export default function ArtistActionBar({
  slug,
  initiallyPinned,
  deepDive,
  reportProps,
  context,
}: {
  slug: string;
  initiallyPinned: boolean;
  deepDive: DeepDiveLink | null;
  reportProps: ReportProps;
  context?: ActionBarContext;
}) {
  const ctx = context ?? WATCHER_CONTEXT(slug);
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
      let res: Response;
      if (ctx.pin.mode === 'team') {
        /* The team always travels with the write. Without it the API
           falls back to a default board and the pin lands on somebody
           else's — a bug this codebase has already had once. */
        res = await fetch(`/api/team-watcher?team=${encodeURIComponent(ctx.pin.team)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channelId: ctx.pin.channelId,
            action: next ? 'pin' : 'unpin',
          }),
        });
      } else {
        res = next
          ? await fetch('/api/active-campaigns', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ slug }),
            })
          : await fetch(`/api/active-campaigns?slug=${encodeURIComponent(slug)}`, {
              method: 'DELETE',
            });
      }
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
        href={ctx.backHref}
        className={chip + ' text-ink/50 hover:text-ink'}
        style={{ border: `1px solid ${RULE}` }}
      >
        {ctx.backLabel}
      </Link>

      {/* The behaviour timeline is the single most-used destination from
          this page, so it is the filled button and it is always present.
          It used to appear only for pinned artists, which hid the most
          useful view precisely when you were deciding whether to pin. */}
      <Link
        href={ctx.behaviourHref}
        className={chip}
        style={{ background: INK, color: PAPER }}
      >
        Channel behaviour
      </Link>

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

      {/* Pushed to the right edge, away from the navigation.
          Everything to the left of this takes you somewhere or changes
          what the roster tracks; this one takes the page away with you.
          Grouping it with the links implied it was another destination.
          `ml-auto` only bites while the row fits on one line — once it
          wraps on a narrow screen the button simply starts the next row,
          which is the right outcome. */}
      <button
        type="button"
        onClick={() => copy('report')}
        className={chip + ' ml-auto'}
        style={{ border: `1px solid ${RULE}`, color: INK, background: 'transparent' }}
      >
        {copied === 'report' ? '✓ Copied' : 'Channel report'}
      </button>
    </div>
  );
}
