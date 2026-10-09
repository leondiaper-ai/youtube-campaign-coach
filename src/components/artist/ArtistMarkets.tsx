'use client';

/* ═══════════════════════════════════════════════════════════════════════
   WHERE THE AUDIENCE IS — top three markets, expandable to everything.

   Client-side because it reads /api/chartmetric/territories, which is a
   cached KV lookup rather than a live Chartmetric call. Costs no quota.

   The labelling is the substance here, not the numbers. Chartmetric's
   monthly views by country is a DIFFERENT measure from the channel's
   lifetime total shown elsewhere on the page — same word "views", two
   different quantities — and some of its markets are modelled estimates
   rather than reported figures. Both facts are stated, because a reader
   who adds these three numbers together and compares them to channel
   views will get a nonsense answer and not know why.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import YouTubeTerritories from '@/components/YouTubeTerritories';

type Row = {
  rank: number; name: string; code2: string | null;
  monthlyViews: number; shareOfListed: number; isEstimate: boolean;
};
type Payload =
  | { ok: true; reportingDate: string | null; countries: Row[]; estimatedCount: number }
  | { ok: false; reason: string };

const fmt = (n: number): string => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'K';
  return String(n);
};
const pct = (x: number) => (x <= 0 ? '0%' : x < 0.01 ? '<1%' : `${Math.round(x * 100)}%`);

export default function ArtistMarkets({ slug }: { slug: string }) {
  const [t, setT] = useState<Payload | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/chartmetric/territories/${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((j) => live && setT(j))
      .catch(() => live && setT({ ok: false, reason: 'network' }));
    return () => { live = false; };
  }, [slug]);

  if (t && !t.ok) {
    return (
      <div className="text-[13px] text-ink/40">
        No Chartmetric audience data linked for this artist — markets unavailable, not zero.
      </div>
    );
  }
  if (!t) {
    return <div className="text-[13px] text-ink/30">Loading audience markets…</div>;
  }

  const top3 = t.countries.slice(0, 3);
  if (top3.length === 0) {
    return <div className="text-[13px] text-ink/40">Chartmetric returned no markets for this artist.</div>;
  }

  const maxViews = Math.max(...top3.map((c) => c.monthlyViews), 1);

  /* Days between Chartmetric's reading date and now. Only surfaced when
     it is genuinely old — printing "0 days ago" on fresh data would be
     noise. */
  const readingAge = t.reportingDate
    ? Math.floor((Date.now() - Date.parse(t.reportingDate + 'T00:00:00Z')) / 86400000)
    : null;

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-3">
        {top3.map((c) => (
          <div key={c.code2 ?? c.name}>
            <div className="flex items-baseline gap-2">
              <span className="text-[34px] sm:text-[42px] font-black leading-none tracking-[-0.03em]">
                {c.code2 ?? c.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="text-[12px] text-ink/45 leading-none pb-1">{pct(c.shareOfListed)}</span>
            </div>
            <div className="text-[13px] font-bold mt-1.5 tabular-nums">
              {fmt(c.monthlyViews)}
              {c.isEstimate && <span className="text-[10px] font-normal text-ink/40"> est.</span>}
            </div>
            <div className="text-[11px] text-ink/40">{c.name}</div>
            {/* A bar makes concentration readable at a glance — the point
                of this block is "where is the audience", and three raw
                numbers do not answer that as fast as three lengths do. */}
            <div className="mt-2 h-[3px] rounded-sm" style={{ background: '#E9E2D3' }}>
              <div
                className="h-full rounded-sm"
                style={{ width: `${(c.monthlyViews / maxViews) * 100}%`, background: '#2C6BFF' }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink/40">
        {/* "read 2026-10-01" was being taken as our staleness when it is
            Chartmetric's own reading date — we refresh every 12 hours and
            they publish per artist on their own cadence. Saying whose date
            it is removes the ambiguity, and a reading that really has gone
            quiet says so in days rather than leaving the reader to count. */}
        <span>
          Chartmetric monthly YouTube views by country — a different measure
          from lifetime channel views.
          {t.reportingDate && (
            <> Chartmetric last reported {t.reportingDate}{readingAge != null && readingAge > 14
              ? `, ${readingAge} days ago.`
              : '.'}</>
          )}
        </span>
        {t.estimatedCount > 0 && <span>{t.estimatedCount} markets modelled (est.).</span>}
        <button
          onClick={() => setOpen((v) => !v)}
          className="underline underline-offset-2 hover:text-ink/70"
        >
          {open ? 'Hide full breakdown' : `All ${t.countries.length} markets & cities`}
        </button>
      </div>

      {open && (
        <div className="mt-5 pt-4" style={{ borderTop: '1px solid #E9E2D3' }}>
          <YouTubeTerritories slug={slug} />
        </div>
      )}
    </div>
  );
}
