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
import ChannelAuditButton from '@/components/ChannelAuditButton';
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

/* The default context is what every /watcher/[slug] page gets, so these two
   links fire for every artist an Australian user opens. Unscoped, they walked
   straight back into the UK workspace. */
const WATCHER_CONTEXT = (slug: string, market = 'uk'): ActionBarContext => {
  const q = market && market !== 'uk' ? `?market=${market}` : '';
  return {
    backHref: `/growth${q}`,
    backLabel: '← Dashboard',
    behaviourHref: `/campaigns${q}${q ? '&' : '?'}behaviour=${encodeURIComponent(slug)}`,
    pin: { mode: 'watcher' },
  };
};

export default function ArtistActionBar({
  slug,
  initiallyPinned,
  deepDive,
  reportProps,
  context,
  market = 'uk',
}: {
  slug: string;
  initiallyPinned: boolean;
  deepDive: DeepDiveLink | null;
  reportProps: ReportProps;
  context?: ActionBarContext;
  /** Market this page belongs to, so the default links stay in it. */
  market?: string;
}) {
  const ctx = context ?? WATCHER_CONTEXT(slug, market);
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
              body: JSON.stringify({ slug, market }),
            })
          : await fetch(`/api/active-campaigns?slug=${encodeURIComponent(slug)}&market=${encodeURIComponent(market)}`, {
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

  const chip = 'px-2 py-2 rounded text-xs font-semibold no-underline transition-colors whitespace-nowrap';
  return <div className="flex flex-wrap items-center gap-3 mb-8 pb-4 border-b" style={{borderColor:RULE}}>
    <Link href={ctx.backHref} className={chip+' text-ink/45 hover:text-ink'}>{ctx.backLabel}</Link>
    <span className="h-4 w-px bg-black/10" aria-hidden />
    <Link href={ctx.behaviourHref} className={chip+' text-ink hover:underline'}>Channel behaviour ↗</Link>
    {deepDive && <Link href={deepDive.href} title={deepDive.title+(deepDive.updated?' · '+deepDive.updated:'')} className={chip+' text-ink/60 hover:text-ink hover:underline'}>Deep dive ↗</Link>}
    <div className="ml-auto flex items-center gap-3">
      <button type="button" onClick={togglePin} disabled={busy} aria-pressed={pinned} className={chip+' text-ink/55 hover:text-ink'} title={pinned?'Stop following this campaign':'Follow this campaign'}>{pinned?'★ Following':'☆ Follow'}</button>
      <ChannelAuditButton slug={slug} name={reportProps.artistName} />
      <details className="relative"><summary className="list-none cursor-pointer text-xl px-2 py-1 rounded hover:bg-black/5" aria-label="More channel actions" title="More actions">⋯</summary><div className="absolute right-0 top-full mt-2 z-30 bg-white border rounded-lg p-1 shadow-lg min-w-[180px]" style={{borderColor:RULE}}><button type="button" onClick={()=>copy('report')} className="text-xs text-left w-full px-3 py-2 rounded hover:bg-black/5">{copied==='report'?'✓ Report copied':'Copy channel report'}</button></div></details>
    </div>
  </div>;
}
