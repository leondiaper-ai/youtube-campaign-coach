'use client';

/* ═══════════════════════════════════════════════════════════════════
   UK YOUTUBE LANDSCAPE

   The approved spreadsheet, alive. Three rankings, one question each,
   never averaged into a score — the fact that they disagree is the
   product, and a combined number would destroy it.

   Designed for a meeting screen: big rank, big artist, one or two hero
   figures, everything else quiet. Deliberately not a rendered
   spreadsheet — the top ten should be readable from across a room,
   with the full list a click away.

   Channel figures (subscribers, lifetime views) are GLOBAL and are
   labelled that way wherever they appear. Chartmetric UK is
   territory-specific. They are never divided by one another.
   ═══════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from 'react';

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const MUTED = '#E9E2D3';
const BLUE = '#2C6BFF';
const GREEN = '#0C6A3F';

type Track = { track: string; isrc: string | null; consumption: number };
type Row = {
  slug: string | null;
  artist: string;
  youtubeHandle: string | null;
  youtubeChannelUrl: string | null;
  consumption: number | null;
  consumptionRank: number | null;
  isCollab: boolean;
  tracks: Track[];
  subscribers: number | null;
  lifetimeViews: number | null;
  ukMonthlyViews: number | null;
  ukTerritoryRank: number | null;
  ukReadingDate: string | null;
};
type Data = {
  freshness: {
    consumptionFrom: string | null;
    consumptionThrough: string | null;
    watcherUpdated: string | null;
    chartmetricUpdated: string | null;
  };
  period: { id: string; label: string };
  consumption: Row[];
  crossover: Row[];
  biggestUk: Row[];
};

const fmt = (n: number | null | undefined): string => {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 2) + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'K';
  return String(n);
};
const day = (d: string | null) =>
  d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';

/* Every date on this page is derived from the data it describes.
   Nothing here is hardcoded: when next week's consumption lands, the
   range moves on its own. */
const dayYear = (d: string | null) =>
  d
    ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';

/** "23 Mar – 20 Sep 2026" — the year is stated once, at the end. */
const range = (from: string | null, to: string | null) =>
  from && to ? `${day(from)} – ${dayYear(to)}` : from || to ? dayYear(from ?? to) : '—';

/** "23 Mar – 20 Sep" — for running text, where the year is noise. */
const shortRange = (from: string | null, to: string | null) =>
  from && to ? `${day(from)} – ${day(to)}` : '—';

type Tab = 'consumption' | 'crossover' | 'biggest';

export default function UKLandscape() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState(false);
  const [tab, setTab] = useState<Tab>('consumption');
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [sortCross, setSortCross] = useState<'uk' | 'consumption'>('uk');

  useEffect(() => {
    fetch('/api/uk-landscape')
      .then((r) => r.json())
      .then((j) => (j?.consumption ? setData(j) : setErr(true)))
      .catch(() => setErr(true));
  }, []);

  useEffect(() => {
    setShowAll(false);
    setOpen(null);
  }, [tab]);

  const crossRows = useMemo(() => {
    if (!data) return [];
    const r = data.crossover.slice();
    if (sortCross === 'consumption') r.sort((a, b) => (b.consumption ?? 0) - (a.consumption ?? 0));
    else r.sort((a, b) => (b.ukMonthlyViews ?? 0) - (a.ukMonthlyViews ?? 0));
    return r;
  }, [data, sortCross]);

  /* Headline figures. Each tab gets the two or three numbers someone
     would say out loud when presenting it — deliberately per-tab, and
     deliberately never combined across tabs into a single score. */
  const headline = useMemo((): { value: string; label: string; note?: string }[] => {
    if (!data) return [];
    const sum = (rs: Row[], k: 'consumption' | 'ukMonthlyViews') =>
      rs.reduce((t, r) => t + (r[k] ?? 0), 0);

    if (tab === 'consumption') {
      const matched = data.consumption.filter((r) => r.youtubeChannelUrl).length;
      return [
        { value: fmt(sum(data.consumption, 'consumption')), label: 'Total UK consumption', note: data.period.label },
        { value: String(data.consumption.length), label: 'Reported artists' },
        { value: `${matched}/${data.consumption.length}`, label: 'Matched to a channel' },
      ];
    }
    if (tab === 'crossover') {
      return [
        { value: String(data.crossover.length), label: 'Artists in both' },
        { value: fmt(sum(data.crossover, 'consumption')), label: 'Their UK consumption' },
        { value: fmt(sum(data.crossover, 'ukMonthlyViews')), label: 'Their UK monthly views' },
      ];
    }
    const ukFirst = data.biggestUk.filter((r) => r.ukTerritoryRank === 1).length;
    return [
      { value: String(data.biggestUk.length), label: 'Artists with UK audience data' },
      { value: fmt(sum(data.biggestUk, 'ukMonthlyViews')), label: 'Combined UK monthly views' },
      { value: String(ukFirst), label: 'Where UK is their #1 territory' },
    ];
  }, [data, tab]);

  if (err) {
    return (
      <div className="text-[13px] text-ink/50">
        UK Landscape data is not available right now.
      </div>
    );
  }
  if (!data) {
    return <div className="text-[11px] uppercase tracking-[0.18em] text-ink/30">Loading…</div>;
  }

  const rows: Row[] = tab === 'consumption' ? data.consumption : tab === 'crossover' ? crossRows : data.biggestUk;
  const shown = showAll ? rows : rows.slice(0, 20);

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'consumption', label: 'UK Consumption', count: data.consumption.length },
    { id: 'crossover', label: 'Crossover', count: data.crossover.length },
    { id: 'biggest', label: 'Biggest UK Artists', count: data.biggestUk.length },
  ];

  return (
    <div style={{ color: INK }}>
      {/* ── header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-1">
        <h1 className="font-black tracking-tight" style={{ fontSize: 'clamp(1.7rem,3.4vw,2.6rem)', lineHeight: 1.02 }}>
          UK YouTube Landscape
        </h1>
        <a
          href="/api/uk-landscape/export"
          className="px-4 py-2 rounded text-[10px] font-black uppercase tracking-[0.12em] no-underline shrink-0"
          style={{ background: INK, color: PAPER }}
        >
          Download UK YouTube Data
        </a>
      </div>
      <div className="text-[15px] text-ink/70 mb-6 max-w-[62ch] leading-snug">
        Virgin&apos;s UK YouTube performance across our consumption data and the wider UK
        YouTube audience.
      </div>

      {/* ── the three datasets ─────────────────────────────────────
          Named separately, each with its OWN period. They do not
          cover the same window and the page must not imply they do:
          consumption is a date RANGE, the other two are readings
          taken on a day. */}
      <div className="flex flex-wrap gap-x-10 gap-y-3 mb-7 pb-5" style={{ borderBottom: `1px solid ${MUTED}` }}>
        {[
          {
            name: 'VMG UK Consumption',
            detail: range(data.freshness.consumptionFrom, data.freshness.consumptionThrough),
          },
          {
            name: 'Watcher Channel Data',
            detail: `Updated ${dayYear(data.freshness.watcherUpdated)}`,
          },
          {
            name: 'Chartmetric UK Audience',
            detail: `Monthly views · Updated ${dayYear(data.freshness.chartmetricUpdated)}`,
          },
        ].map((s) => (
          <div key={s.name}>
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-ink/55">
              {s.name}
            </div>
            <div className="text-[11px] text-ink/40 mt-0.5 tabular-nums">{s.detail}</div>
          </div>
        ))}
      </div>

      {/* ── tabs ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-7">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-2 rounded text-[11px] font-black uppercase tracking-[0.1em] transition-colors"
            style={
              tab === t.id
                ? { background: INK, color: PAPER }
                : { background: PAPER, color: 'rgba(14,14,14,0.55)', border: `1px solid ${MUTED}` }
            }
          >
            {t.label}
            <span className="ml-2 opacity-50 tabular-nums">{t.count}</span>
          </button>
        ))}
      </div>

      {/* ── question ───────────────────────────────────────────── */}
      {/* One line each. The methodology that used to live here — the
          collaboration rule, tracks vs videos — moved to the source
          note at the foot of the page. */}
      <div className="text-[13px] text-ink/55 mb-5 max-w-[70ch] leading-snug">
        {tab === 'consumption' &&
          `Artists and tracks ranked by VMG UK YouTube consumption, ${shortRange(
            data.freshness.consumptionFrom,
            data.freshness.consumptionThrough,
          )}.`}
        {tab === 'crossover' &&
          'Where VMG UK consumption overlaps with the wider UK YouTube audience.'}
        {tab === 'biggest' && 'Virgin artists ranked by current UK YouTube monthly views.'}
      </div>

      {/* ── headline figures ───────────────────────────────────── */}
      <div className="flex flex-wrap gap-x-10 gap-y-5 mb-7 pb-6" style={{ borderBottom: `1px solid ${MUTED}` }}>
        {headline.map((h) => (
          <div key={h.label}>
            <div className="font-black tabular-nums leading-none" style={{ fontSize: 'clamp(1.6rem,3.2vw,2.5rem)' }}>
              {h.value}
            </div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-ink/40 mt-1.5">{h.label}</div>
            {h.note && <div className="text-[10px] text-ink/25 mt-0.5">{h.note}</div>}
          </div>
        ))}
      </div>

      {tab === 'crossover' && (
        <div className="flex items-center gap-2 mb-4 text-[10px] uppercase tracking-[0.12em] text-ink/35">
          <span>Rank by</span>
          {(['uk', 'consumption'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortCross(s)}
              className="px-2.5 py-1 rounded font-bold"
              style={
                sortCross === s
                  ? { background: BLUE, color: '#fff' }
                  : { background: PAPER, border: `1px solid ${MUTED}`, color: 'rgba(14,14,14,0.5)' }
              }
            >
              {s === 'uk' ? 'UK YouTube' : 'VMG Consumption'}
            </button>
          ))}
        </div>
      )}

      {/* ── rows ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        {shown.map((r, i) => {
          const rank = tab === 'consumption' ? r.consumptionRank ?? i + 1 : i + 1;
          const key = (r.slug ?? r.artist) + i;
          const isOpen = open === key;
          /* Rank hierarchy: the top three carry the room, four to ten
             stay legible, the tail recedes. A flat list reads as a
             spreadsheet and nobody looks at the top of it. */
          const lead = rank <= 3;
          const rankColor = lead ? INK : rank <= 10 ? 'rgba(14,14,14,0.55)' : 'rgba(14,14,14,0.26)';
          return (
            <div key={key} className="rounded-lg" style={{ background: PAPER, border: `1px solid ${MUTED}` }}>
              <div
                className={`flex items-center gap-4 sm:gap-6 px-4 sm:px-5 ${lead ? 'py-5' : 'py-4'} ${tab === 'consumption' && r.tracks.length ? 'cursor-pointer' : ''}`}
                onClick={() => tab === 'consumption' && r.tracks.length && setOpen(isOpen ? null : key)}
              >
                <div
                  className="font-black tabular-nums shrink-0 text-right"
                  style={{
                    fontSize: lead ? 'clamp(1.5rem,3vw,2.6rem)' : 'clamp(1.05rem,2vw,1.7rem)',
                    width: 56,
                    color: rankColor,
                    lineHeight: 1,
                  }}
                >
                  {rank}
                </div>

                <div className="min-w-0 flex-1">
                  <div
                    className="font-black leading-tight truncate"
                    style={{ fontSize: lead ? 'clamp(1.1rem,1.9vw,1.5rem)' : 'clamp(0.95rem,1.5vw,1.2rem)' }}
                  >
                    {r.artist}
                    {r.isCollab && (
                      <span className="ml-2 text-[9px] uppercase tracking-[0.14em] text-ink/30 align-middle">collab</span>
                    )}
                  </div>
                  {/* Channel identity sits here rather than as its own column:
                      a raw URL on every row would drown the ranking. Blank
                      where Watcher has no confirmed match — never guessed. */}
                  {r.youtubeChannelUrl && (
                    <a
                      href={r.youtubeChannelUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 mt-1 text-[11px] no-underline hover:underline"
                      style={{ color: 'rgba(14,14,14,0.45)' }}
                    >
                      <svg width="13" height="10" viewBox="0 0 24 17" aria-hidden="true">
                        <path d="M23.5 2.7A3 3 0 0 0 21.4.6C19.6 0 12 0 12 0s-7.6 0-9.4.6A3 3 0 0 0 .5 2.7C0 4.5 0 8.5 0 8.5s0 4 .5 5.8a3 3 0 0 0 2.1 2.1c1.8.6 9.4.6 9.4.6s7.6 0 9.4-.6a3 3 0 0 0 2.1-2.1c.5-1.8.5-5.8.5-5.8s0-4-.5-5.8Z" fill="#FF0000"/>
                        <path d="M9.6 12.3 15.8 8.5 9.6 4.7v7.6Z" fill="#FAF7F2"/>
                      </svg>
                      {r.youtubeHandle ?? 'View channel'}
                    </a>
                  )}
                  {tab === 'consumption' && r.tracks.length > 0 && (
                    <div className="text-[11px] text-ink/40 mt-0.5 truncate">
                      {r.tracks[0].track}
                      {r.tracks.length > 1 && ` · +${r.tracks.length - 1} more`}
                    </div>
                  )}
                  {tab === 'consumption' && !r.youtubeChannelUrl && (
                    <div className="text-[10px] text-ink/25 mt-1">No matched channel</div>
                  )}
                  {tab === 'biggest' && r.ukTerritoryRank != null && (
                    <div className="text-[11px] text-ink/40 mt-0.5">
                      UK is their #{r.ukTerritoryRank} YouTube territory
                    </div>
                  )}
                </div>

                {/* hero metrics */}
                {tab === 'consumption' && (
                  <div className="text-right shrink-0">
                    <div className="font-black tabular-nums leading-none" style={{ fontSize: 'clamp(1.1rem,2vw,1.6rem)' }}>
                      {fmt(r.consumption)}
                    </div>
                    <div className="text-[9px] uppercase tracking-[0.14em] text-ink/35 mt-1">UK consumption</div>
                  </div>
                )}

                {tab === 'crossover' && (
                  <div className="flex items-center gap-5 sm:gap-8 shrink-0">
                    <div className="text-right">
                      <div className="font-black tabular-nums leading-none" style={{ fontSize: 'clamp(0.95rem,1.7vw,1.35rem)' }}>
                        {fmt(r.consumption)}
                      </div>
                      <div className="text-[9px] uppercase tracking-[0.12em] text-ink/35 mt-1">VMG consumption</div>
                    </div>
                    <div className="text-right">
                      <div
                        className="font-black tabular-nums leading-none"
                        style={{ fontSize: 'clamp(0.95rem,1.7vw,1.35rem)', color: BLUE }}
                      >
                        {fmt(r.ukMonthlyViews)}
                      </div>
                      <div className="text-[9px] uppercase tracking-[0.12em] text-ink/35 mt-1">UK YouTube monthly</div>
                    </div>
                    <div className="hidden sm:block text-right w-[78px]">
                      <div className="font-black tabular-nums leading-none text-[15px]" style={{ color: GREEN }}>
                        #{r.ukTerritoryRank ?? '—'}
                      </div>
                      <div className="text-[9px] uppercase tracking-[0.12em] text-ink/35 mt-1">UK territory</div>
                    </div>
                  </div>
                )}

                {tab === 'biggest' && (
                  <div className="flex items-center gap-5 sm:gap-8 shrink-0">
                    <div className="text-right">
                      <div
                        className="font-black tabular-nums leading-none"
                        style={{ fontSize: 'clamp(1.05rem,1.9vw,1.55rem)', color: BLUE }}
                      >
                        {fmt(r.ukMonthlyViews)}
                      </div>
                      <div className="text-[9px] uppercase tracking-[0.12em] text-ink/35 mt-1">UK YouTube monthly</div>
                    </div>
                    <div className="hidden md:block text-right w-[80px]">
                      <div className="font-bold tabular-nums leading-none text-[13px] text-ink/60">{fmt(r.subscribers)}</div>
                      <div className="text-[9px] uppercase tracking-[0.12em] text-ink/30 mt-1">Subs · global</div>
                    </div>
                    <div className="hidden lg:block text-right w-[92px]">
                      <div className="font-bold tabular-nums leading-none text-[13px] text-ink/60">{fmt(r.lifetimeViews)}</div>
                      <div className="text-[9px] uppercase tracking-[0.12em] text-ink/30 mt-1">Lifetime · global</div>
                    </div>
                  </div>
                )}
              </div>

              {/* expanded tracks */}
              {tab === 'consumption' && isOpen && r.tracks.length > 0 && (
                <div className="px-4 sm:px-5 pb-4" style={{ borderTop: `1px solid ${MUTED}` }}>
                  <div className="text-[9px] uppercase tracking-[0.14em] text-ink/30 pt-3 pb-2">
                    Biggest consuming tracks
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {r.tracks.map((t, j) => (
                      <div key={t.isrc ?? j} className="flex items-center gap-3">
                        <div className="text-[12px] text-ink/60 flex-1 min-w-0 truncate">{t.track}</div>
                        <div className="h-[8px] flex-1 max-w-[220px] hidden sm:block" style={{ background: MUTED }}>
                          <div
                            className="h-full"
                            style={{
                              width: `${Math.max((t.consumption / (r.tracks[0].consumption || 1)) * 100, 2)}%`,
                              background: BLUE,
                            }}
                          />
                        </div>
                        <div className="text-[12px] font-black tabular-nums text-ink/80 w-[62px] text-right">
                          {fmt(t.consumption)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {rows.length > 20 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-4 px-4 py-2 rounded text-[10px] font-black uppercase tracking-[0.12em]"
          style={{ background: PAPER, border: `1px solid ${MUTED}`, color: 'rgba(14,14,14,0.55)' }}
        >
          {showAll ? 'Show top 20' : `Show all ${rows.length}`}
        </button>
      )}

      {/* The top of the page says what this is. The bottom says where
          it comes from, and carries the methodology detail that would
          otherwise clutter the tab intros. */}
      <div className="mt-10 pt-5 max-w-[80ch]" style={{ borderTop: `1px solid ${MUTED}` }}>
        <div className="text-[9px] uppercase tracking-[0.16em] text-ink/30 mb-2.5">Sources</div>
        <dl className="text-[11px] text-ink/40 leading-relaxed">
          <div className="mb-1.5">
            <dt className="inline font-bold text-ink/55">VMG UK Consumption</dt>
            <dd className="inline">
              {' '}— internal Virgin UK YouTube consumption reporting. Ranked exactly as
              reported: collaborations are kept whole and nothing is merged. Figures are
              tracks, not individual videos.
            </dd>
          </div>
          <div className="mb-1.5">
            <dt className="inline font-bold text-ink/55">Chartmetric UK Audience</dt>
            <dd className="inline"> — artist-level UK YouTube audience data, as monthly views.</dd>
          </div>
          <div>
            <dt className="inline font-bold text-ink/55">Watcher</dt>
            <dd className="inline">
              {' '}— channel-level YouTube data such as subscribers and lifetime views. These
              are global figures, not UK.
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
