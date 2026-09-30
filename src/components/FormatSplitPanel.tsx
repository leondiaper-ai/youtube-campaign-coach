'use client';

/* ═══════════════════════════════════════════════════════════════════
   SHORTS vs LONG-FORM — one panel, used everywhere.

   The honesty problem this component exists to solve: the two format
   totals are sums over the videos we hold, while overall channel views
   is YouTube's own lifetime number. Those are different populations.
   Putting them in a row of three without saying so invites the reader
   to subtract, and on a large catalogue they would be subtracting
   numbers that do not belong together.

   So the panel always shows the gap. When coverage is incomplete an
   "unaccounted" figure appears with the same weight as the other
   numbers, and the split bar is labelled as a share of the videos we
   hold rather than of the channel. Only when coverage is complete does
   the panel say the split describes the channel.

   Loading, permission and missing-data states are distinct. Nothing
   renders as zero because data is absent.
   ═══════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const MUTED = '#E9E2D3';
const BLUE = '#2C6BFF';   // long-form
const AMBER = '#C77A16';  // Shorts
const GREY = '#B9B0A0';   // unaccounted

type Split = {
  totalViews: number;
  longformViews: number;
  shortsViews: number;
  longformShare: number;
  shortsShare: number;
  longformCount: number;
  shortsCount: number;
  coverage: {
    videosCounted: number;
    channelVideoCount: number | null;
    channelLifetimeViews: number | null;
    viewsCovered: number | null;
    confidence: 'complete' | 'partial' | 'sample';
  };
};

type Trend = {
  windowDays: number;
  shortsViews: number | null;
  longformViews: number | null;
  shortsShare: number | null;
  daysAvailable: number;
  daysRequired: number;
  ready: boolean;
};

type Payload = {
  artist: {
    name: string;
    available: boolean;
    reason?: string;
    channelTotalViews?: number | null;
    coverageLabel?: string;
    channelRepresentative?: boolean;
    windows?: { all: Split };
    trends?: { d7: Trend; d30: Trend; d90: Trend };
  };
};

const fmt = (n: number | null | undefined): string => {
  if (n == null) return '—';
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'K';
  return String(n);
};
const pct = (x: number | null | undefined) =>
  x == null ? '—' : `${Math.round(x * 100)}%`;

export default function FormatSplitPanel({ slug }: { slug: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/format-split?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((j) => live && (j?.artist ? setData(j) : setErr(true)))
      .catch(() => live && setErr(true));
    return () => { live = false; };
  }, [slug]);

  if (err) {
    return (
      <Shell>
        <div className="text-[12px] text-ink/45">Format split unavailable right now.</div>
      </Shell>
    );
  }
  if (!data) {
    return (
      <Shell>
        <div className="text-[11px] uppercase tracking-[0.16em] text-ink/30">Loading…</div>
      </Shell>
    );
  }

  const a = data.artist;

  if (!a.available) {
    /* Explicitly NOT zeros. "No inventory" and "0 Shorts views" look
       identical as numbers and mean opposite things. */
    return (
      <Shell>
        <Head />
        <div className="text-[12px] text-ink/50 mt-2">
          {a.reason === 'no-video-inventory'
            ? 'No videos cached for this channel yet, so the split cannot be calculated. This is a data gap, not a zero.'
            : 'No channel data cached yet. The split appears after the next sync.'}
        </div>
      </Shell>
    );
  }

  const s = a.windows!.all;
  const channelTotal = a.channelTotalViews ?? null;
  const counted = s.longformViews + s.shortsViews;
  /* rawGap can be NEGATIVE: the channel's lifetime total and the
     per-video counts are read at different moments in the sync, so on
     a small catalogue the videos can briefly sum higher than the
     channel figure. Observed on VENUS GRRRLS at −1,995 (0.7%).
     Clamping alone would leave an unexplained mismatch on a panel
     claiming full coverage, so the overshoot is named instead. */
  const rawGap = channelTotal != null ? channelTotal - counted : null;
  const unaccounted = rawGap != null ? Math.max(0, rawGap) : null;
  const overshoot = rawGap != null && rawGap < 0 ? -rawGap : null;
  const complete = s.coverage.confidence === 'complete';

  return (
    <Shell>
      <Head />

      {/* ── the three headline numbers ─────────────────────────── */}
      <div className="flex flex-wrap gap-x-10 gap-y-4 mt-3">
        <Metric label="Overall channel views" value={fmt(channelTotal)} note="YouTube lifetime total" />
        <Metric label="Long-form views" value={fmt(s.longformViews)} colour={BLUE}
          note={`${pct(s.longformShare)} of counted · ${s.longformCount} videos`} />
        <Metric label="Shorts views" value={fmt(s.shortsViews)} colour={AMBER}
          note={`${pct(s.shortsShare)} of counted · ${s.shortsCount} videos`} />
        {!complete && unaccounted != null && unaccounted > 0 && (
          <Metric
            label="Not yet counted"
            value={fmt(unaccounted)}
            colour={GREY}
            note="Views on videos outside our inventory"
          />
        )}
      </div>

      {/* ── the bar ────────────────────────────────────────────── */}
      <div className="mt-5">
        <div className="flex h-[10px] w-full overflow-hidden rounded" style={{ background: MUTED }}>
          <div style={{ width: `${s.longformShare * 100}%`, background: BLUE }} title="Long-form" />
          <div style={{ width: `${s.shortsShare * 100}%`, background: AMBER }} title="Shorts" />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-[10px] uppercase tracking-[0.12em] text-ink/40">
          <Key colour={BLUE} label={`Long-form ${pct(s.longformShare)}`} />
          <Key colour={AMBER} label={`Shorts ${pct(s.shortsShare)}`} />
          <span className="text-ink/30 normal-case tracking-normal text-[11px]">
            {complete
              ? 'Share of this channel’s views'
              : 'Share of the videos we hold — not of the channel total'}
          </span>
        </div>
      </div>

      {/* ── coverage, stated plainly ───────────────────────────── */}
      <div className="mt-4 text-[11px] leading-relaxed" style={{ color: 'rgba(14,14,14,0.45)' }}>
        <span className="font-bold" style={{ color: complete ? INK : 'rgba(14,14,14,0.6)' }}>
          {complete ? 'Full coverage' : `Partial coverage — ${pct(s.coverage.viewsCovered)} of lifetime views`}
        </span>
        {' · '}
        {a.coverageLabel}
        {!complete && (
          <>
            {' '}The two format totals do not add up to overall channel views, and are not meant to.
          </>
        )}
        {overshoot != null && (
          <>
            {' '}The videos sum {fmt(overshoot)} above the channel total — the two figures are
            read at different points in the sync, so they can differ slightly.
          </>
        )}
      </div>

      {a.trends && <Trends t={a.trends} />}
    </Shell>
  );
}

/* ── trends ──────────────────────────────────────────────────── */

function Trends({ t }: { t: { d7: Trend; d30: Trend; d90: Trend } }) {
  const rows = [t.d7, t.d30, t.d90];
  const anyReady = rows.some((r) => r.ready);

  return (
    <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${MUTED}` }}>
      <div className="text-[9px] uppercase tracking-[0.16em] text-ink/30 mb-2">
        Views gained by format
      </div>
      {!anyReady ? (
        /* Daily tracking started recently. Saying so is more useful
           than a number built from too few days. */
        <div className="text-[11px] text-ink/45">
          Collecting daily readings — {rows[0].daysAvailable} day
          {rows[0].daysAvailable === 1 ? '' : 's'} so far. The 7-day figure appears at{' '}
          {rows[0].daysRequired} days.
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          {rows.map((r) => (
            <div key={r.windowDays} className="text-[11px]">
              <div className="text-[9px] uppercase tracking-[0.12em] text-ink/35 mb-0.5">
                Last {r.windowDays} days
              </div>
              {r.ready ? (
                <div className="tabular-nums">
                  <span style={{ color: BLUE }} className="font-bold">{fmt(r.longformViews)}</span>
                  <span className="text-ink/30"> long-form · </span>
                  <span style={{ color: AMBER }} className="font-bold">{fmt(r.shortsViews)}</span>
                  <span className="text-ink/30"> Shorts</span>
                </div>
              ) : (
                <div className="text-ink/35">
                  {r.daysAvailable}/{r.daysRequired} days collected
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── chrome ──────────────────────────────────────────────────── */

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-lg p-5" style={{ background: PAPER, border: `1px solid ${MUTED}`, color: INK }}>
    {children}
  </div>
);

const Head = () => (
  <div className="text-[10px] uppercase tracking-[0.16em] text-ink/40">
    Shorts vs long-form
  </div>
);

function Metric({ label, value, note, colour }: {
  label: string; value: string; note?: string; colour?: string;
}) {
  return (
    <div>
      <div className="font-black tabular-nums leading-none"
        style={{ fontSize: 'clamp(1.3rem,2.4vw,1.9rem)', color: colour ?? INK }}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-ink/45 mt-1.5">{label}</div>
      {note && <div className="text-[10px] text-ink/30 mt-0.5">{note}</div>}
    </div>
  );
}

const Key = ({ colour, label }: { colour: string; label: string }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: colour }} />
    {label}
  </span>
);
