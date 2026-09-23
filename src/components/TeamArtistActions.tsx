'use client';

/* ── THE SAME TWO BUTTONS AS THE WATCHER ──────────────────────────────
   Our own artist page has carried a Pin and a Behaviour button in its
   top-right corner for months. A regional board's artist page had
   neither, so a team could pin from the board's row but not from the
   page they were actually reading.

   Same position, same two controls, same order, and now the same
   destination shape: ours links to /campaigns?behaviour=<slug>, this
   one links to the team's OWN board with the same parameter. A team
   never lands on a board that is not theirs.

   Behaviour appears only once the artist is pinned — the same gate as
   the Watcher, and the same reason: a pin is how somebody says this one
   matters, and channel behaviour is what you want for the ones that do.
   ─────────────────────────────────────────────────────────────────── */

import { useState } from 'react';
import Link from 'next/link';

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

  /* The board's own behaviour view, carrying the key it was reached
     with. `backHref` already holds ?k= on a gated route and nothing on
     the legacy one, so the separator is decided rather than assumed. */
  const behaviourHref =
    `${backHref}${backHref.includes('?') ? '&' : '?'}behaviour=${encodeURIComponent(slug)}`;

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
      setPinned(!pinned);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between mb-8">
      <Link
        href={backHref}
        className="text-[11px] uppercase tracking-[0.18em] text-ink/55 hover:text-ink"
      >
        &larr; {backLabel}
      </Link>

      <div className="flex items-center gap-3">
        {pinned && (
          <Link
            href={behaviourHref}
            className="px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-[0.08em] no-underline transition-colors"
            style={{ background: '#2C25FF', color: '#fff' }}
            title={`Channel behaviour for ${artistName}`}
          >
            Behaviour
          </Link>
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
  );
}
