'use client';

/* ═══════════════════════════════════════════════════════════════════
   YOUTUBE TERRITORIES — the first Chartmetric module

   Mounted through WatcherArtistView's existing `footer` slot, so that
   component is not edited at all. It fetches client-side, after paint,
   from our own origin: a slow or dead Chartmetric cannot delay the
   artist page's server render, and cannot throw into it.

   It renders NOTHING until it has data, and nothing at all on failure.
   An artist Chartmetric has never heard of simply has no territories
   section — no empty state, no apology, no error box on a page that is
   otherwise fine.

   The source line is not decoration. These are YouTube-for-Artists
   figures for the artist entity across YouTube, which is a different
   population from the owned channel above them on the page. Ezra's
   territories total 1.4m monthly views; his channel has 28.6m lifetime
   views. Anyone reading the two as the same number is reading a false
   comparison, so the scope is stated where the numbers are.
   ═══════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';

const PAPER = '#FAF7F2';
const MUTED = '#E9E2D3';
const UP = '#0C6A3F';
const DOWN = '#8A1F0C';
const BAR = '#2C6BFF';

type Row = {
  rank: number;
  name: string;
  code2: string | null;
  continent: string | null;
  monthlyViews: number;
  previousViews: number | null;
  changeViews: number | null;
  changePct: number | null;
  isEstimate: boolean;
  shareOfListed: number;
  marketLeader: string | null;
};

type Payload =
  | {
      ok: true;
      artist: { slug: string; name: string; channelId: string };
      chartmetric: { artistId: number; artistName: string | null };
      reportingDate: string | null;
      previousDate: string | null;
      windowDays: number | null;
      countries: Row[];
      cities: Row[];
      listedTotal: number;
      estimatedCount: number;
    }
  | { ok: false; reason: string };

const fmt = (n: number) =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M'
  : n >= 1_000 ? (n / 1_000).toFixed(n >= 100_000 ? 0 : 1) + 'k'
  : String(n);

const fmtDate = (d: string | null) =>
  d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null;

const flag = (code2: string | null) =>
  code2 && /^[A-Za-z]{2}$/.test(code2)
    ? String.fromCodePoint(
        ...code2.toUpperCase().split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
      )
    : '';

export default function YouTubeTerritories({ slug }: { slug: string }) {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/chartmetric/territories/${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((j) => live && setData(j))
      .catch(() => live && setData({ ok: false, reason: 'network' }));
    return () => {
      live = false;
    };
  }, [slug]);

  if (!data || !data.ok || data.countries.length === 0) return null;

  const countries = data.countries.slice(0, 10);
  const peak = countries[0]?.monthlyViews ?? 0;

  /* Momentum needs a comparison that means something. A territory that
     went 100 → 200 is +100% and irrelevant next to one that added
     80,000 views, so the floor is on the absolute change and the sort
     is on it too — percentage is shown alongside, never alone. */
  const MIN_CHANGE = 2_000;
  const movers = data.countries
    .filter((c) => c.changeViews != null && Math.abs(c.changeViews) >= MIN_CHANGE)
    .sort((a, b) => Math.abs(b.changeViews!) - Math.abs(a.changeViews!))
    .slice(0, 6);

  const cities = data.cities.slice(0, 8);
  const reporting = fmtDate(data.reportingDate);

  return (
    <section className="mt-10">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full" style={{ background: BAR }} />
        <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-ink/50">
          YouTube territories
        </h2>
      </div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-ink/30 mb-3 ml-4">
        YouTube&#8209;for&#8209;Artists · Chartmetric
        {reporting ? ` · reading ${reporting}` : ''}
      </div>

      {/* ── TOP MARKETS ─────────────────────────────────────────── */}
      <div className="rounded-lg px-4 py-4" style={{ background: PAPER, border: `1px solid ${MUTED}` }}>
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-ink/40 font-bold">
            Top markets · monthly views
          </div>
          <div className="text-[10px] tabular-nums text-ink/35">
            {fmt(data.listedTotal)} across {data.countries.length} territories
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          {countries.map((c) => (
            <div key={c.code2 ?? c.name} className="flex items-center gap-3">
              <div className="w-[152px] shrink-0 flex items-center gap-1.5 min-w-0">
                <span className="text-[13px] leading-none">{flag(c.code2)}</span>
                <span className="text-[12px] text-ink/70 truncate">{c.name}</span>
                {c.isEstimate && (
                  <span
                    className="text-[9px] text-ink/30 shrink-0"
                    title="Chartmetric models this territory rather than measuring it"
                  >
                    est
                  </span>
                )}
              </div>

              <div className="flex-1 h-[14px] relative min-w-0" style={{ background: MUTED }}>
                <div
                  className="h-full absolute left-0 top-0"
                  style={{
                    width: peak > 0 ? `${Math.max((c.monthlyViews / peak) * 100, 1.5)}%` : '0%',
                    background: BAR,
                    opacity: c.isEstimate ? 0.45 : 1,
                  }}
                />
              </div>

              <div className="w-[62px] shrink-0 text-right text-[12px] font-black tabular-nums text-ink/80">
                {fmt(c.monthlyViews)}
              </div>
              <div className="w-[42px] shrink-0 text-right text-[11px] tabular-nums text-ink/35">
                {(c.shareOfListed * 100).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 text-[10px] text-ink/30 leading-snug">
          Share is of the {data.countries.length} territories Chartmetric returns for this artist,
          which is the only total the response supplies.
          {data.estimatedCount > 0 &&
            ` ${data.estimatedCount} of them are marked as modelled rather than measured.`}
        </div>
      </div>

      {/* ── MARKET MOMENTUM ─────────────────────────────────────── */}
      {movers.length > 0 && (
        <div
          className="rounded-lg px-4 py-4 mt-3"
          style={{ background: PAPER, border: `1px solid ${MUTED}` }}
        >
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-[10px] uppercase tracking-[0.14em] text-ink/40 font-bold">
              Market momentum
            </div>
            <div className="text-[10px] tabular-nums text-ink/35">
              {data.previousDate && reporting
                ? `${fmtDate(data.previousDate)} → ${reporting}`
                : 'vs previous reading'}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {movers.map((c) => {
              const rising = (c.changeViews ?? 0) > 0;
              return (
                <div key={c.code2 ?? c.name} className="px-3 py-2" style={{ border: `1px solid ${MUTED}` }}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[12px] leading-none">{flag(c.code2)}</span>
                    <span className="text-[11px] text-ink/60 truncate">{c.name}</span>
                  </div>
                  <div
                    className="text-[15px] font-black tabular-nums mt-0.5"
                    style={{ color: rising ? UP : DOWN }}
                  >
                    {rising ? '+' : '−'}
                    {fmt(Math.abs(c.changeViews ?? 0))}
                  </div>
                  <div className="text-[10px] tabular-nums text-ink/35">
                    {rising ? '+' : '−'}
                    {Math.abs(c.changePct ?? 0).toFixed(0)}% · now {fmt(c.monthlyViews)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 text-[10px] text-ink/30 leading-snug">
            Ranked by absolute change, not percentage — a small territory doubling is not a bigger
            story than a large one adding tens of thousands. Territories with no earlier reading are
            excluded rather than shown as growth from zero.
          </div>
        </div>
      )}

      {/* ── TOP CITIES ──────────────────────────────────────────── */}
      {cities.length > 0 && (
        <div
          className="rounded-lg px-4 py-4 mt-3"
          style={{ background: PAPER, border: `1px solid ${MUTED}` }}
        >
          <div className="text-[10px] uppercase tracking-[0.14em] text-ink/40 font-bold mb-3">
            Top cities
          </div>
          <div className="grid grid-cols-4 gap-2">
            {cities.map((c) => (
              <div key={`${c.name}-${c.code2}`} className="px-3 py-2" style={{ border: `1px solid ${MUTED}` }}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[12px] leading-none">{flag(c.code2)}</span>
                  <span className="text-[11px] text-ink/60 truncate">{c.name}</span>
                </div>
                <div className="text-[15px] font-black tabular-nums mt-0.5 text-ink/80">
                  {fmt(c.monthlyViews)}
                </div>
                {c.marketLeader && (
                  <div className="text-[10px] text-ink/30 truncate" title={`Most-viewed artist in ${c.name}`}>
                    top here: {c.marketLeader}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-2 text-[10px] text-ink/25 leading-snug">
        Chartmetric YouTube&#8209;for&#8209;Artists, artist&#8209;entity scope — the artist&apos;s
        wider YouTube presence, not only the owned channel above.
      </div>
    </section>
  );
}
