'use client';

/* ═══════════════════════════════════════════════════════════════════
   FORMAT & AUDIENCE — recent viewing first, lifetime second.

   Watcher is a campaign monitoring tool, so what is being watched NOW
   outranks what was watched over a channel's whole history. The strip
   is ordered to say so: the 7-day split from daily readings takes the
   primary position, and the lifetime split sits beneath it as context.

   THE SUBSTITUTION THIS FILE REFUSES TO MAKE
     The lifetime split is always available; the recent split is not,
     because it needs two comparable daily readings before it means
     anything. The tempting move is to show lifetime in the primary
     position while recent data accumulates. That would put a figure
     describing ten years of a catalogue where the reader expects this
     week — the single most misleading thing this component could do.
     So the primary position holds the COLLECTION STATUS instead, and
     says plainly how far off a real 7-day figure is. Lifetime never
     moves up, and is never labelled recent.

   WHAT STAYS AT A GLANCE
     the recent split (or its collection status), the lifetime split
     with its coverage caveat, the top three markets.
   WHAT MOVES BEHIND "DETAIL"
     the 30/90-day windows, per-format counts, the unaccounted figure,
     the sync-overshoot note, the full territory breakdown.

   Coverage is stated beside the lifetime figure it qualifies, not in a
   footnote — a Shorts share read as a channel fact when it describes
   0.3% of a catalogue is the specific error this component prevents.
   ═══════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import YouTubeTerritories from './YouTubeTerritories';

const BLUE = '#2C6BFF';
const AMBER = '#C77A16';
const MUTED = '#E9E2D3';
const WARN = '#9A5B00';

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
  windowDays: number;
  shortsViews: number | null; longformViews: number | null;
  shortsShare: number | null;
  daysAvailable: number; daysRequired: number; ready: boolean;
};
type Readings = { total: number; comparable: number; first: string | null; last: string | null };
type FormatPayload = {
  artist: {
    available: boolean; reason?: string;
    channelTotalViews?: number | null;
    coverageLabel?: string;
    windows?: { all: Split };
    trends?: { d7: Trend; d30: Trend; d90: Trend };
    readings?: Readings;
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

/* Never round a real share down to "0%" — see sharePct in formatSplit.ts.
   Duplicated here rather than imported because that module is server-side
   and this is a client component; the rule is identical. */
const pc = (x: number | null | undefined): string => {
  if (x == null) return '—';
  if (x <= 0) return '0%';
  if (x < 0.01) return '<1%';
  if (x < 0.1) return `${(x * 100).toFixed(1)}%`;
  return `${Math.round(x * 100)}%`;
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[9px] uppercase tracking-[0.14em] text-ink/40">{children}</div>
);

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
  const d7 = a?.trends?.d7;
  const readings = a?.readings;
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

  const recentReady = !!d7?.ready && d7.longformViews != null && d7.shortsViews != null;
  const recentTotal = recentReady ? (d7!.longformViews ?? 0) + (d7!.shortsViews ?? 0) : 0;
  const recentLongShare = recentTotal > 0 ? (d7!.longformViews ?? 0) / recentTotal : null;
  const recentShortShare = recentTotal > 0 ? (d7!.shortsViews ?? 0) / recentTotal : null;

  /* The honest version of "no trend yet". Zero comparable days means
     one thing when nothing has ever been stored and quite another on
     the day after the first reading. */
  const collectionStatus = (): string => {
    if (!readings || readings.total === 0) {
      return 'Not collecting yet — no daily readings stored for this channel.';
    }
    const need = d7?.daysRequired ?? 6;
    return `Collecting — ${readings.comparable} of ${need} comparable days since ${readings.first}.`;
  };

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

      {/* ══ PRIMARY — what is being watched now ══════════════════ */}
      {a?.available && (
        <div className="mb-4">
          <SectionLabel>Views gained · last 7 days</SectionLabel>
          {recentReady && recentTotal > 0 ? (
            <>
              <div className="flex h-[9px] w-[220px] overflow-hidden rounded-sm mt-1.5" style={{ background: MUTED }}>
                <div style={{ width: `${(recentLongShare ?? 0) * 100}%`, background: BLUE }} />
                <div style={{ width: `${(recentShortShare ?? 0) * 100}%`, background: AMBER }} />
              </div>
              <div className="text-[14px] mt-1.5 tabular-nums leading-snug">
                <span style={{ color: BLUE }} className="font-black">{pc(recentLongShare)}</span>
                <span className="text-ink/50"> long-form </span>
                <span className="font-black">{fmt(d7!.longformViews)}</span>
                <span className="text-ink/25"> · </span>
                <span style={{ color: AMBER }} className="font-black">{pc(recentShortShare)}</span>
                <span className="text-ink/50"> Shorts </span>
                <span className="font-black">{fmt(d7!.shortsViews)}</span>
              </div>
              <div className="text-[10px] text-ink/40 mt-0.5">
                From daily readings of videos we hold, counted only where the same video
                appears in both readings.
              </div>
            </>
          ) : recentReady ? (
            <div className="text-[12px] text-ink/45 mt-1">
              No measurable viewing across our inventory in the last 7 days.
            </div>
          ) : (
            <div className="text-[12px] mt-1" style={{ color: WARN }}>
              {collectionStatus()}
            </div>
          )}
        </div>
      )}

      {/* ══ SECONDARY — lifetime, and where the audience is ══════ */}
      <div
        className="flex flex-wrap items-start gap-x-8 gap-y-3 pt-3"
        style={{ borderTop: `1px solid ${MUTED}` }}
      >
        {s ? (
          <div className="min-w-[200px]">
            <SectionLabel>Lifetime split</SectionLabel>
            <div className="flex h-[5px] w-[130px] overflow-hidden rounded-sm mt-1.5" style={{ background: MUTED }}>
              <div style={{ width: `${s.longformShare * 100}%`, background: BLUE, opacity: 0.55 }} />
              <div style={{ width: `${s.shortsShare * 100}%`, background: AMBER, opacity: 0.55 }} />
            </div>
            <div className="text-[11px] mt-1 tabular-nums text-ink/60">
              {pc(s.longformShare)} long-form · {pc(s.shortsShare)} Shorts
            </div>
            {/* The caveat sits against the figure it qualifies. */}
            <div className="text-[10px] mt-0.5" style={{ color: complete ? 'rgba(14,14,14,0.35)' : WARN }}>
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

        {a?.channelTotalViews != null && (
          <div>
            <SectionLabel>Channel views · lifetime</SectionLabel>
            <div className="text-[14px] font-black tabular-nums mt-1 text-ink/70">
              {fmt(a.channelTotalViews)}
            </div>
          </div>
        )}

        {top3.length > 0 && (
          <div>
            <SectionLabel>Top markets · monthly</SectionLabel>
            <div className="text-[12px] tabular-nums mt-1">
              {top3.map((c, i) => (
                <span key={c.code2 ?? c.name}>
                  {i > 0 && <span className="text-ink/25"> · </span>}
                  <span className="font-black">{c.code2 ?? c.name}</span>
                  <span className="text-ink/45"> {fmt(c.monthlyViews)}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ══ DETAIL ══════════════════════════════════════════════ */}
      {open && (
        <div className="mt-4 pt-3 text-[11px] leading-relaxed" style={{ borderTop: `1px solid ${MUTED}`, color: 'rgba(14,14,14,0.5)' }}>
          {a?.trends && (
            <p className="mb-1.5">
              <b className="text-ink/70">Recent windows.</b>{' '}
              {[a.trends.d7, a.trends.d30, a.trends.d90].some((r) => r.ready)
                ? [a.trends.d7, a.trends.d30, a.trends.d90]
                    .filter((r) => r.ready)
                    .map((r) => `${r.windowDays}d: ${fmt(r.longformViews)} long-form / ${fmt(r.shortsViews)} Shorts`)
                    .join(' · ')
                : 'None of the 7, 30 or 90-day windows has enough comparable daily readings yet.'}
              {readings && readings.total > 0 && (
                <> {readings.total} reading{readings.total === 1 ? '' : 's'} stored,
                last on {readings.last}.</>
              )}
            </p>
          )}
          {s && (
            <p className="mb-1.5">
              <b className="text-ink/70">Lifetime.</b> {fmt(s.longformViews)} long-form views across{' '}
              {s.longformCount} videos, {fmt(s.shortsViews)} Shorts views across {s.shortsCount}.{' '}
              {a?.coverageLabel}. These are totals each video has accumulated since it was
              published, not viewing in any recent period.
              {unaccounted != null && <> A further {fmt(unaccounted)} lifetime views sit on videos outside our inventory and are not in this split.</>}
              {overshoot != null && <> The videos sum {fmt(overshoot)} above the channel total — the two are read at different points in the sync, so they can differ slightly.</>}
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

          {terr && <YouTubeTerritories slug={slug} />}
        </div>
      )}
    </div>
  );
}
