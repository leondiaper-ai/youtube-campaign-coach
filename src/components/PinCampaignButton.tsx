'use client';

import { useState } from 'react';

export default function PinCampaignButton({
  slug,
  initiallyPinned,
}: {
  slug: string;
  initiallyPinned: boolean;
}) {
  const [pinned, setPinned] = useState(initiallyPinned);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      if (pinned) {
        await fetch(`/api/active-campaigns?slug=${slug}`, { method: 'DELETE' });
        setPinned(false);
      } else {
        await fetch('/api/active-campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug }),
        });
        setPinned(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
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
  );
}
