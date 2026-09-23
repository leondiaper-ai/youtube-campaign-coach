'use client';

/* ── THE SAME TWO BUTTONS AS THE WATCHER ──────────────────────────────
   Our own artist page has carried a Pin and a Behaviour button in its
   top-right corner for months. A regional board's artist page had
   neither, so a team could pin from the board's row but not from the
   page they were actually reading, and the behaviour view they had been
   given was only reachable by going back.

   Same position, same two controls, same order. The one difference is
   where Behaviour lands: ours navigates to /campaigns, which is our
   pinned-campaign page and not theirs, so here the view opens in place
   underneath. Nothing about a team's board is reachable from a page
   belonging to another one.

   Behaviour appears only once the artist is pinned — the same gate as
   the Watcher, and the same reason: a pin is how somebody says this one
   matters, and channel behaviour is what you want for the ones that do.
   ─────────────────────────────────────────────────────────────────── */

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

/* On demand. Most visits to a detail page never open it, and it is a
   large chart component. */
const CampaignBehaviour = dynamic(() => import('./CampaignBehaviour'), {
  ssr: false,
  loading: () => (
    <div className="mb-8 rounded-lg px-4 py-6 text-[11px] text-ink/35 text-center"
         style={{ background: '#F6F1E7' }}>
      Loading channel behaviour…
    </div>
  ),
});

const MUTED = '#E9E2D3';

export default function TeamArtistActions({
  slug, artistName, channelId, team, backHref, backLabel, initiallyPinned,
}: {
  slug: string;
  artistName: string;
  channelId: string;
  team: string;
  backHref: string;
  backLabel: string;
  initiallyPinned: boolean;
}) {
  const [pinned, setPinned] = useState(initiallyPinned);
  const [busy, setBusy] = useState(false);
  const [showBehaviour, setShowBehaviour] = useState(false);

  /* The team always travels with the write. Without it the API falls
     back to Nordics and Australia's pin lands on somebody else's
     board — a bug this codebase has already had once. */
  const api = `/api/team-watcher?team=${encodeURIComponent(team)}`;

  async function togglePin() {
    setBusy(true);
    try {
      const res = await fetch(api, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId, action: pinned ? 'unpin' : 'pin' }),
      });
      if (!res.ok) return;
      const nowPinned = !pinned;
      setPinned(nowPinned);
      /* Unpinning takes the Behaviour button away, so it should not
         leave the panel it opened behind it. */
      if (!nowPinned) setShowBehaviour(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <Link
          href={backHref}
          className="text-[11px] uppercase tracking-[0.18em] text-ink/55 hover:text-ink"
        >
          &larr; {backLabel}
        </Link>

        <div className="flex items-center gap-3">
          {pinned && (
            <button
              onClick={() => setShowBehaviour(v => !v)}
              className="px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-[0.08em] transition-colors"
              style={
                showBehaviour
                  ? { background: 'rgba(44,37,255,0.10)', color: '#2C25FF' }
                  : { background: '#2C25FF', color: '#fff' }
              }
              title={`${showBehaviour ? 'Hide' : 'Show'} channel behaviour for ${artistName}`}
            >
              {showBehaviour ? 'Hide behaviour' : 'Behaviour'}
            </button>
          )}

          <button
            onClick={togglePin}
            disabled={busy}
            className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md transition-all disabled:opacity-40"
            style={{
              background: pinned ? '#F0E6FF' : '#F6F1E7',
              color: pinned ? '#5B21B6' : '#0E0E0E80',
            }}
            title={pinned ? 'Remove from Active Campaigns' : 'Pin to Active Campaigns'}
          >
            {busy ? '…' : pinned ? '★ Pinned' : '☆ Pin'}
          </button>
        </div>
      </div>

      {showBehaviour && (
        <div className="mb-8 pb-6" style={{ borderBottom: `1px solid ${MUTED}` }}>
          <CampaignBehaviour
            slug={slug}
            artistName={artistName}
            onClose={() => setShowBehaviour(false)}
            noBreakout
          />
        </div>
      )}
    </>
  );
}
