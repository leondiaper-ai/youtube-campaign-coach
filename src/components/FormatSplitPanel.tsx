'use client';

/* ═══════════════════════════════════════════════════════════════════
   FORMAT & AUDIENCE — one compact strip, not two panels.

   This replaces the oversized standalone panel. It was correct and
   badly placed: a bordered box at the foot of the page that made
   people scroll to reach it, in a layout whose own idiom is small
   label/value cards under a dotted section heading.

   So it now borrows that idiom exactly, and folds the territory
   summary in beside the format split. Two bolted-on modules become
   one line of the page.

   WHAT STAYS AT A GLANCE
     the format share, the coverage caveat, the top three markets.
   WHAT MOVES BEHIND "DETAIL"
     the unaccounted figure, the sync-overshoot note, the counts, the
     per-window trends.

   The safeguards are unchanged, only relocated. Incomplete coverage is
   still stated in the always-visible line, because that is the one
   caveat a reader must not be able to miss — a Shorts share read as a
   channel fact when it describes 0.3% of a catalogue is the specific
   error this component exists to prevent.
   ═══════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import YouTubeTerritories from './YouTubeTerritories';

const BLUE = '#2C6BFF';
const AMBER = '#C77A16';
const MUTED = '#E9E2D3';

type Split = {
  longformViews: number; shortsViews: number;
  longformShare: number; shortsShare: number;
  longformCount: number; shortsCount: number;
  coverage: {
    videosCounted: number;
    channelLifetimeViews: number | null;
    viewsCovered: number | null;
    confidence: 'complete' | 'partial' | 'sample';
  };
};
type Trend = {
  windowDays: number; shortsViews: number | null; longformViews: number | null;
  daysAvailable: number; daysRequired: number; ready: boolean;
};
type FormatPayload = {
  artist: {
    available: boolean; reason?: string;
    channelTotalViews?: number | null;
    coverageLabel?: string;
    windows?: { all: Split };
    trends?: { d7: Trend; d30: Trend; d90: Trend };
  };
};
type TerrRow = { rank: number; name: string; code2: string | null; monthlyViews: number; shareOfListed: number; isEstimate: boolean };
type TerrPayload =
  | { ok: true; reportingDate: string | null; countries: TerrRow[]; estimatedCount: number }
  | { ok: false; reason: string };

const fmt = (n: number | null | undefined): string => {
  if (n == null) return '—';
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'K';
  return String(n);
};
const pc = (x: number | null | undefined) => (x == null ? '—' : `${Math.round(x * 100)}%`);

export default function FormatSplitPanel({ slug }: { slug: string }) {
  const [f, setF] = useState<FormatPayload | null>(null);
  const [t, setT] = useState<TerrPayload | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/format-split?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json()).then((j) => live && setF(j)).catch(() => live && setF(null));
    fetch(`/api/chartmetric/territories/${encodeURIComponent(slug)}`)
      .then((r) => r.json()).then((j) => live && setT(j))
      .catch(() => live && setT({ ok: false, reason: 'network' }));
    return () => { live = false; };
  }, [slug]);

  const a = f?.artist;
  const s = a?.available ? a.windows?.all : undefined;
  const terr = t && t.ok ? t : null;
  const top3 = terr?.countries?.slice(0, 3) ?? [];

  /* Nothing to say yet — stay silent rather than occupy space with a
     skeleton. The rest of the page is the product. */
  if (!f && !t) return null;

  const complete = s?.coverage.confidence === 'complete';
  const counted = s ? s.longformViews + s.shortsViews : 0;
  const rawGap = s && a?.channelTotalViews != null ? a.channelTotalViews - counted : null;
  const unaccounted = rawGap != null && rawGap > 0 ? rawGap : null;
  const overshoot = rawGap != null && rawGap < 0 ? -rawGap : null;

  return (
    <div className="mt-2">
      <div className="text-[10px] uppercase tracking-[0.16em] text-ink/35 mb-3 flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: '#0E0E0E' }} />
        Format &amp; audience
        <button
          onClick={() => setOpen((v) => !v)}
          className="ml-auto text-[9px] uppercase tracking-[0.14em] text-ink/35 hover:text-ink/70"
        >
          {open ? 'Hide detail' : 'Detail'}
        </button>
      </div>

      <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
        {/* ── format split ─────────────────────────────────── */}
        {s ? (
          <div className="min-w-[210px]">
            <div className="flex h-[7px] w-[190px] overflow-hidden rounded-sm" style={{ background: MUTED }}>
              <div style={{ width: `${s.longformShare * 100}%`, background: BLUE }} />
              <div style={{ width: `${s.shortsShare * 100}%`, background: AMBER }} />
            </div>
            <div className="text-[12px] mt-1.5 tabular-nums">
              <span style={{ color: BLUE }} className="font-black">{pc(s.longformShare)}</span>
              <span className="text-ink/45"> long-form · </span>
              <span style={{ color: AMBER }} className="font-black">{pc(s.shortsShare)}</span>
              <span className="text-ink/45"> Shorts</span>
            </div>
            {/* The caveat a reader must not miss stays out here. */}
            <div className="text-[10px] mt-0.5" style={{ color: complete ? 'rgba(14,14,14,0.35)' : '#9A5B00' }}>
              {complete
                ? 'Whole channel'
                : `Of ${pc(s.coverage.viewsCovered)} of views we hold — not the channel`}
            </div>
          </div>
        ) : a && !a.available ? (
          <div className="text-[11px] text-ink/40 max-w-[240px]">
            No video inventory cached yet — the split is unavailable, not zero.
          </div>
        ) : null}

        {/* ── channel total ────────────────────────────────── */}
        {a?.channelTotalViews != null && (
          <div>
            <div className="text-[15px] font-black tabular-nums leading-none">
              {fmt(a.channelTotalViews)}
            </div>
            <div className="text-[9px] uppercase tracking-[0.12em] text-ink/40 mt-1">
              Channel views · lifetime
            </div>
          </div>
        )}

        {/* ── top markets ──────────────────────────────────── */}
        {top3.length > 0 && (
          <div>
            <div className="text-[12px] tabular-nums">
              {top3.map((c, i) => (
                <span key={c.code2 ?? c.name}>
                  {i > 0 && <span className="text-ink/25"> · </span>}
                  <span className="font-black">{c.code2 ?? c.name}</span>
                  <span className="text-ink/45"> {fmt(c.monthlyViews)}</span>
                </span>
              ))}
            </div>
            <div className="text-[9px] uppercase tracking-[0.12em] text-ink/40 mt-1">
              Top markets · monthly
            </div>
          </div>
        )}
      </div>

      {/* ── detail ───────────────────────────────────────────── */}
      {open && (
        <div className="mt-4 pt-3 text-[11px] leading-relaxed" style={{ borderTop: `1px solid ${MUTED}`, color: 'rgba(14,14,14,0.5)' }}>
          {s && (
            <p className="mb-1.5">
              <b className="text-ink/70">Format.</b> {fmt(s.longformViews)} long-form views across{' '}
              {s.longformCount} videos, {fmt(s.shortsViews)} Shorts views across {s.shortsCount}.{' '}
              {a?.coverageLabel}.
              {unaccounted != null && <> A further {fmt(unaccounted)} lifetime views sit on videos outside our inventory and are not in this split.</>}
              {overshoot != null && <> The videos sum {fmt(overshoot)} above the channel total — the two are read at different points in the sync, so they can differ slightly.</>}
            </p>
          )}
          {a?.trends && (
            <p className="mb-1.5">
              <b className="text-ink/70">Trends.</b>{' '}
              {a.trends.d7.ready
                ? [a.trends.d7, a.trends.d30, a.trends.d90].filter((r) => r.ready).map((r) =>
                    `${r.windowDays}d: ${fmt(r.longformViews)} long-form / ${fmt(r.shortsViews)} Shorts`).join(' · ')
                : `Collecting daily readings — ${a.trends.d7.daysAvailable} of ${a.trends.d7.daysRequired} days needed for a 7-day figure.`}
            </p>
          )}
          {terr && (
            <p className="mb-3">
              <b className="text-ink/70">Audience.</b> Chartmetric monthly YouTube views by country
              {terr.reportingDate ? `, read ${terr.reportingDate}` : ''} — a different measure from
              the lifetime channel total above.
              {terr.estimatedCount > 0 && ` ${terr.estimatedCount} of these markets are modelled estimates.`}
              {terr.countries.length > 3 && ` ${terr.countries.length} markets returned in total.`}
            </p>
          )}

          {/* The full country and city breakdown, unchanged — it just
              lives behind the expansion now instead of occupying the
              foot of every page. */}
          {terr && <YouTubeTerritories slug={slug} />}
        </div>
      )}
    </div>
  );
}
