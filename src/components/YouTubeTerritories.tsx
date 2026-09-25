'use client';

/* ═══════════════════════════════════════════════════════════════════
   YOUTUBE TERRITORIES

   Mounted through WatcherArtistView's existing `footer` slot, so that
   component is not edited at all. Fetches client-side after paint from
   our own origin, so a slow or dead Chartmetric cannot delay the
   artist page's server render or throw into it. Renders NOTHING on any
   failure — an artist Chartmetric has never heard of simply has no
   territories section, rather than an error box on a page that is
   otherwise fine.

   WHY IT IS SPLIT INTO SCALE AND MOMENTUM

   A ranked list of ten countries is a dashboard. The useful reading is
   that those are two different questions with two different answers.
   Ezra's scale markets are the US, the UK and France — where the
   audience already is, and where a release lands on day one. His
   momentum markets are Japan, Brazil, Chile and Poland — where the
   audience is arriving, which is a touring, subtitling and
   partnerships question, not a promo one.

   And momentum has to mean OUTPACING, not growing. In this window
   almost every Ezra territory roughly doubled, so "+119%" alone says
   nothing; the median territory did +107%. What matters is which
   markets beat the artist's own lift. That baseline is drawn from the
   data every time, never hardcoded, so it moves with the artist and
   the window.
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
      medianChangePct: number | null;
      countries: Row[];
      cities: Row[];
      listedTotal: number;
      estimatedCount: number;
    }
  | { ok: false; reason: string };

const fmt = (n: number) =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 2) + 'M'
  : n >= 1_000 ? Math.round(n / 1_000) + 'k'
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

  const scale = data.countries.slice(0, 8);
  const peak = scale[0]?.monthlyViews ?? 0;
  const median = data.medianChangePct;

  /* Outpacing the artist's own lift, with an absolute floor so a
     territory of 800 views does not out-rank one adding 50,000. */
  const MIN_CHANGE = 5_000;
  const risers =
    median == null
      ? []
      : data.countries
          .filter(
            (c) =>
              c.changePct != null &&
              c.changeViews != null &&
              c.changeViews >= MIN_CHANGE &&
              c.changePct > median,
          )
          .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))
          .slice(0, 4);

  const fallers = data.countries
    .filter((c) => c.changeViews != null && c.changeViews <= -MIN_CHANGE)
    .sort((a, b) => (a.changeViews ?? 0) - (b.changeViews ?? 0))
    .slice(0, 3);

  const cities = data.cities.slice(0, 8);
  const reporting = fmtDate(data.reportingDate);
  const windowLabel =
    data.previousDate && reporting ? `${fmtDate(data.previousDate)} → ${reporting}` : 'vs previous reading';

  return (
    <section className="mt-10">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: BAR }} />
        <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-ink/50">
          YouTube territories
        </h2>
      </div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-ink/30 mb-3 ml-4">
        Chartmetric · monthly video views{reporting ? ` · reading ${reporting}` : ''}
      </div>

      {/* ── SCALE MARKETS ───────────────────────────────────────── */}
      <div className="rounded-lg px-4 py-4" style={{ background: PAPER, border: `1px solid ${MUTED}` }}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-1">
          <div className="text-[10px] uppercase tracking-[0.14em] text-ink/40 font-bold">
            Scale markets
          </div>
          <div className="text-[10px] tabular-nums text-ink/35">
            {fmt(data.listedTotal)} across {data.countries.length} territories
          </div>
        </div>
        <div className="text-[11px] text-ink/45 mb-3 leading-snug">
          Where the audience already is — the markets a release lands in on day one.
        </div>

        <div className="flex flex-col gap-1.5">
          {scale.map((c) => (
            <div key={c.code2 ?? c.name} className="flex items-center gap-2 sm:gap-3">
              <div className="w-[104px] sm:w-[150px] shrink-0 flex items-center gap-1.5 min-w-0">
                <span className="text-[13px] leading-none shrink-0">{flag(c.code2)}</span>
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
                    opacity: c.isEstimate ? 0.4 : 1,
                  }}
                />
              </div>

              <div className="w-[52px] shrink-0 text-right text-[12px] font-black tabular-nums text-ink/80">
                {fmt(c.monthlyViews)}
              </div>
              <div className="hidden sm:block w-[42px] shrink-0 text-right text-[11px] tabular-nums text-ink/35">
                {(c.shareOfListed * 100).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 text-[10px] text-ink/30 leading-snug">
          Share is of the {data.countries.length} territories Chartmetric returns for this artist —
          the only total the response supplies.
          {data.estimatedCount > 0 &&
            ` ${data.estimatedCount} are marked ‘est’: modelled by Chartmetric rather than measured.`}
        </div>
      </div>

      {/* ── MOMENTUM MARKETS ────────────────────────────────────── */}
      {risers.length > 0 && median != null && (
        <div
          className="rounded-lg px-4 py-4 mt-3"
          style={{ background: PAPER, border: `1px solid ${MUTED}` }}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-1">
            <div className="text-[10px] uppercase tracking-[0.14em] text-ink/40 font-bold">
              Momentum markets
            </div>
            <div className="text-[10px] tabular-nums text-ink/35">{windowLabel}</div>
          </div>
          <div className="text-[11px] text-ink/45 mb-3 leading-snug">
            Where the audience is arriving. Every territory grew this window — the median did{' '}
            <span className="tabular-nums font-bold text-ink/60">+{median.toFixed(0)}%</span>. These
            beat it.
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {risers.map((c) => (
              <div key={c.code2 ?? c.name} className="px-3 py-2.5" style={{ border: `1px solid ${MUTED}` }}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[12px] leading-none shrink-0">{flag(c.code2)}</span>
                  <span className="text-[11px] text-ink/60 truncate">{c.name}</span>
                  {c.isEstimate && <span className="text-[9px] text-ink/30 shrink-0">est</span>}
                </div>
                <div className="text-[19px] font-black tabular-nums leading-tight mt-1" style={{ color: UP }}>
                  +{(c.changePct ?? 0).toFixed(0)}%
                </div>
                <div className="text-[10px] tabular-nums text-ink/40 mt-0.5">
                  +{fmt(c.changeViews ?? 0)} to {fmt(c.monthlyViews)}
                </div>
              </div>
            ))}
          </div>

          {fallers.length > 0 && (
            <div className="mt-3 pt-3 flex flex-wrap items-center gap-x-4 gap-y-1" style={{ borderTop: `1px solid ${MUTED}` }}>
              <span className="text-[10px] uppercase tracking-[0.14em] text-ink/35 font-bold">
                Softening
              </span>
              {fallers.map((c) => (
                <span key={c.code2 ?? c.name} className="text-[11px] tabular-nums text-ink/50">
                  {flag(c.code2)} {c.name}{' '}
                  <span style={{ color: DOWN }}>
                    −{fmt(Math.abs(c.changeViews ?? 0))} ({(c.changePct ?? 0).toFixed(0)}%)
                  </span>
                </span>
              ))}
            </div>
          )}

          <div className="mt-3 text-[10px] text-ink/30 leading-snug">
            Change is Chartmetric&apos;s current reading against its previous one
            {data.windowDays ? `, ${data.windowDays} days apart` : ''}. Territories with no earlier
            reading are excluded rather than shown as growth from zero, and a territory must have
            added at least {fmt(MIN_CHANGE)} views to qualify — a small market doubling is not a
            bigger story than a large one adding tens of thousands.
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {cities.map((c) => (
              <div
                key={`${c.name}-${c.code2}`}
                className="px-3 py-2"
                style={{ border: `1px solid ${MUTED}` }}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[12px] leading-none shrink-0">{flag(c.code2)}</span>
                  <span className="text-[11px] text-ink/60 truncate">{c.name}</span>
                </div>
                <div className="text-[15px] font-black tabular-nums mt-0.5 text-ink/80">
                  {fmt(c.monthlyViews)}
                </div>
                {c.marketLeader && (
                  <div
                    className="text-[10px] text-ink/30 truncate"
                    title={`Most-viewed artist in ${c.name}, per Chartmetric`}
                  >
                    biggest here: {c.marketLeader}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-2 text-[10px] text-ink/25 leading-snug">
        Chartmetric YouTube&#8209;for&#8209;Artists, monthly video views by territory — a different
        measurement from the lifetime channel totals above, not a different set of videos.
      </div>
    </section>
  );
}
