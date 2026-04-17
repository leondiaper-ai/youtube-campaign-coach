'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ARTISTS,
  deriveFromLive,
  daysSince,
  fmtNum,
  type Artist,
  type LiveSnap as BaseLiveSnap,
  type Status,
} from '@/lib/artists';
import AddArtistButton from './AddArtistButton';
import { CoachLiveDot } from './CoachLink';
import { readCoachPlan, type CoachPlanSummary } from '@/lib/coachPlan';

type LiveSnap = BaseLiveSnap & { loading?: boolean };

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const MUTED = '#E9E2D3';

const LS_KEY = 'pih-campaign-coach-v4';

// ─────────────────────────────────────────────────────────────────────────────
// Simplified 3-tier status labels stakeholders can read instantly.
// ─────────────────────────────────────────────────────────────────────────────
type SimpleStatus = 'Needs attention' | 'At risk' | 'Healthy';
const SIMPLE_STATUS: Record<Status, SimpleStatus> = {
  'FIX FIRST':       'Needs attention',
  'ACTIVE BUT WEAK': 'Needs attention',
  'BUILDING':        'At risk',
  'MOMENTUM':        'Healthy',
  'READY':           'Healthy',
  'ALWAYS ON':       'Healthy',
};
const SIMPLE_STATUS_STYLE: Record<SimpleStatus, { bg: string; fg: string; dot: string }> = {
  'Needs attention': { bg: '#FFE2D8', fg: '#8A1F0C', dot: '#FF4A1C' },
  'At risk':         { bg: '#FFEAD6', fg: '#8A4A1A', dot: '#F08A3C' },
  'Healthy':         { bg: '#E6F8EE', fg: '#0C6A3F', dot: '#1FBE7A' },
};

// Human-readable "why" line for each status
function whyLine(status: Status, live: LiveSnap | undefined): string {
  const lastUp = daysSince(live?.lastUploadAt);
  const uploads = live?.uploads30d ?? 0;
  const shorts = live?.shorts30d ?? 0;

  switch (status) {
    case 'FIX FIRST':
      return lastUp != null ? `No uploads in ${lastUp} days` : 'No recent uploads detected';
    case 'ACTIVE BUT WEAK':
      return `Only ${uploads} upload${uploads === 1 ? '' : 's'} in 30 days`;
    case 'BUILDING':
      return `${uploads} uploads/30d — building cadence`;
    case 'MOMENTUM':
      return `Strong output — ${uploads} uploads/30d`;
    case 'READY':
      return 'Cadence is holding — ready for the next moment';
    case 'ALWAYS ON':
      return 'Between campaigns — channel is warm';
    default:
      return '';
  }
}

function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
function daysFromNow(iso: string) {
  const d = new Date(iso + 'T00:00:00').getTime();
  const now = Date.now();
  return Math.round((d - now) / (1000 * 60 * 60 * 24));
}

function YouTubeMark() {
  return (
    <svg width="16" height="12" viewBox="0 0 24 17" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M23.5 2.7A3 3 0 0 0 21.4.6C19.6 0 12 0 12 0s-7.6 0-9.4.6A3 3 0 0 0 .5 2.7C0 4.5 0 8.5 0 8.5s0 4 .5 5.8a3 3 0 0 0 2.1 2.1c1.8.6 9.4.6 9.4.6s7.6 0 9.4-.6a3 3 0 0 0 2.1-2.1c.5-1.8.5-5.8.5-5.8s0-4-.5-5.8Z"
        fill="#FF0000"
      />
      <path d="M9.6 12.3 15.8 8.5 9.6 4.7v7.6Z" fill={PAPER} />
    </svg>
  );
}

export default function CampaignCockpit() {
  const [running, setRunning] = useState(false);
  const [live, setLive] = useState<Record<string, LiveSnap>>({});
  const [lastRunAt, setLastRunAt] = useState<number | null>(null);
  const [custom, setCustom] = useState<Artist[]>([]);
  const [coachPlans, setCoachPlans] = useState<Record<string, CoachPlanSummary | null>>({});

  const artists = useMemo<Artist[]>(() => {
    const seen = new Set<string>();
    const merged: Artist[] = [];
    for (const a of [...ARTISTS, ...custom]) {
      if (seen.has(a.slug)) continue;
      seen.add(a.slug);
      merged.push(a);
    }
    return merged;
  }, [custom]);

  async function loadCustom() {
    try {
      const r = await fetch('/api/artists');
      const j = await r.json();
      if (Array.isArray(j.artists)) setCustom(j.artists);
    } catch { /* noop */ }
  }

  async function runChecks() {
    setRunning(true);
    setLive((prev) => {
      const next = { ...prev };
      for (const a of artists) next[a.slug] = { ...next[a.slug], loading: true };
      return next;
    });
    await Promise.all(
      artists.map(async (a) => {
        const q = a.channelHandle ?? a.name;
        try {
          const r = await fetch(`/api/channel?q=${encodeURIComponent(q)}`);
          const j = await r.json();
          if (!r.ok) throw new Error(j.error ?? `${r.status}`);
          setLive((prev) => ({ ...prev, [a.slug]: { ...j, loading: false } }));
        } catch (e: any) {
          setLive((prev) => ({ ...prev, [a.slug]: { error: String(e?.message ?? e), loading: false } }));
        }
      })
    );
    setLastRunAt(Date.now());
    setRunning(false);
  }

  useEffect(() => { loadCustom(); }, []);// eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (artists.length) runChecks(); }, [artists.length]);// eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const hydrate = () => {
      const next: Record<string, CoachPlanSummary | null> = {};
      for (const a of artists) next[a.slug] = readCoachPlan(a.slug);
      setCoachPlans(next);
    };
    hydrate();
    window.addEventListener('focus', hydrate);
    return () => window.removeEventListener('focus', hydrate);
  }, [artists]);

  const effective = useMemo(
    () =>
      artists.map((a) => {
        const l = live[a.slug];
        const daysToNextMoment = a.nextMomentDate ? daysFromNow(a.nextMomentDate) : null;
        const d = l
          ? deriveFromLive(l, { daysToNextMoment, phase: a.phase })
          : null;
        return {
          ...a,
          status: (d?.status ?? 'ALWAYS ON') as Status,
          watcherRead: d?.watcherRead ?? null,
          nextAction: d?.nextAction ?? null,
        };
      }),
    [artists, live]
  );

  // Sort: needs attention first, then at risk, then healthy
  const STATUS_RANK: Record<Status, number> = {
    'FIX FIRST': 0, 'ACTIVE BUT WEAK': 1, 'BUILDING': 2,
    'MOMENTUM': 3, 'READY': 4, 'ALWAYS ON': 5,
  };
  const sorted = [...effective].sort((a, b) => {
    const s = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (s !== 0) return s;
    const aDate = coachPlans[a.slug]?.nextMoment?.date ?? a.nextMomentDate;
    const bDate = coachPlans[b.slug]?.nextMoment?.date ?? b.nextMomentDate;
    const ad = aDate ? daysFromNow(aDate) : 9999;
    const bd = bDate ? daysFromNow(bDate) : 9999;
    return ad - bd;
  });

  const needAttention = sorted.filter((a) => SIMPLE_STATUS[a.status] === 'Needs attention').length;
  const atRisk = sorted.filter((a) => SIMPLE_STATUS[a.status] === 'At risk').length;

  return (
    <div className="max-w-[960px] mx-auto px-6 py-10" style={{ color: INK }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-ink/45">
            <YouTubeMark />
            <span>YouTube Campaign System</span>
          </div>
          <h1 className="font-black text-3xl leading-tight mt-1">
            Artist overview
          </h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={runChecks}
            disabled={running}
            className="text-[11px] tracking-wide text-ink/55 hover:text-ink underline decoration-ink/20 underline-offset-4"
          >
            {running ? 'Checking…' : 'Refresh'}
          </button>
          <AddArtistButton onAdded={loadCustom} />
        </div>
      </div>

      {/* Summary strip */}
      {(needAttention + atRisk) > 0 && (
        <div
          className="flex items-center gap-3 rounded-xl px-5 py-3 mb-8 text-[13px]"
          style={{ background: needAttention > 0 ? '#FFE2D8' : SOFT }}
        >
          {needAttention > 0 && (
            <span className="font-black" style={{ color: '#8A1F0C' }}>
              {needAttention} artist{needAttention === 1 ? '' : 's'} need{needAttention === 1 ? 's' : ''} attention
            </span>
          )}
          {atRisk > 0 && (
            <>
              {needAttention > 0 && <span className="text-ink/25">·</span>}
              <span className="font-bold text-ink/70">{atRisk} at risk</span>
            </>
          )}
        </div>
      )}

      {/* Artist list — priority sorted */}
      <div className="space-y-3">
        {sorted.map((a) => (
          <ArtistCard
            key={a.slug}
            a={a}
            live={live[a.slug]}
            coach={coachPlans[a.slug] ?? null}
          />
        ))}
      </div>

      {artists.length === 0 && (
        <div className="py-12 text-center text-[13px] text-ink/55">
          No artists yet. Add a YouTube channel to get started.
        </div>
      )}

      <div className="mt-12 text-[10px] uppercase tracking-[0.18em] text-ink/30">
        Live via YouTube API · Updated {lastRunAt ? `${Math.max(0, Math.round((Date.now() - lastRunAt) / 60000))}m ago` : 'on load'}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// ARTIST CARD — replaces the old table row. Each card answers "why is this here"
// ═══════════════════════════════════════════════════════════════════════════════

type EffectiveArtist = Artist & {
  status: Status;
  watcherRead: string | null;
  nextAction: string | null;
};

function ArtistCard({
  a,
  live,
  coach,
}: {
  a: EffectiveArtist;
  live?: LiveSnap;
  coach: CoachPlanSummary | null;
}) {
  const simple = SIMPLE_STATUS[a.status];
  const style = SIMPLE_STATUS_STYLE[simple];
  const why = whyLine(a.status, live);
  const nextLabel = coach?.nextMoment?.label ?? a.nextMomentLabel ?? null;
  const nextDate = coach?.nextMoment?.date ?? a.nextMomentDate ?? null;
  const days = nextDate ? daysFromNow(nextDate) : null;
  const isLive = !!live && !live.error && !live.loading && live.subs != null;

  return (
    <Link
      href={`/watcher/${a.slug}`}
      className="block rounded-xl border p-5 hover:border-ink/20 transition-colors"
      style={{ borderColor: MUTED, background: PAPER }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Name + status */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-black text-[16px]">{a.name}</span>
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ background: style.bg, color: style.fg }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: style.dot }} />
              {simple}
            </span>
            <CoachLiveDot slug={a.slug} />
          </div>

          {/* Why this artist is here + growth signal */}
          <div className="text-[12px] text-ink/60 mt-1">
            {why}
            {isLive && <GrowthSignal live={live!} />}
          </div>

          {/* Scale: subs + views */}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-ink/40 font-mono flex-wrap">
            {isLive && live?.subs != null && <span>{fmtNum(live.subs)} subs</span>}
            {isLive && live?.views != null && <span>· {fmtNum(live.views)} views</span>}
            {live?.uploads30d != null && <span>· {live.uploads30d} uploads/30d</span>}
            {live?.loading && <span className="text-ink/25">loading…</span>}
            {live?.error && <span style={{ color: '#FF4A1C' }}>api error</span>}
          </div>
        </div>

        {/* Right side: next action + next moment */}
        <div className="shrink-0 text-right max-w-[280px]">
          {a.nextAction && (
            <div className="text-[12px] font-bold text-ink/80 leading-snug">{a.nextAction}</div>
          )}
          {nextLabel && nextDate && (
            <div className="text-[11px] text-ink/45 mt-1.5">
              {nextLabel} · {fmtDate(nextDate)}
              {days != null && (
                <span className="text-ink/35">
                  {' '}· {days === 0 ? 'today' : days < 0 ? `${-days}d ago` : `in ${days}d`}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * Inline growth signal for a Cockpit card.
 * Uses the LiveSnap data we already have — cadence + recency as proxy for growth.
 * When the snapshot history accumulates 7d of data, the Watcher page shows exact deltas.
 */
function GrowthSignal({ live }: { live: LiveSnap }) {
  const uploads = live.uploads30d ?? 0;
  const shorts = live.shorts30d ?? 0;
  const last = daysSince(live.lastUploadAt);

  // Strong output = proxy for growth
  if (uploads >= 6 && (last ?? 999) <= 3) {
    return (
      <span className="ml-2 text-[11px] font-bold" style={{ color: '#0C6A3F' }}>
        ↑ Strong output
      </span>
    );
  }
  if (uploads >= 3 && (last ?? 999) <= 7) {
    return (
      <span className="ml-2 text-[11px] font-bold" style={{ color: '#0C6A3F' }}>
        ↑ Active
      </span>
    );
  }
  if (uploads <= 1 || (last ?? 999) > 21) {
    return (
      <span className="ml-2 text-[11px] font-bold" style={{ color: '#8A1F0C' }}>
        ↓ Channel cooling off
      </span>
    );
  }
  if ((last ?? 999) > 14) {
    return (
      <span className="ml-2 text-[11px] font-bold" style={{ color: '#8A4A1A' }}>
        → Not posting
      </span>
    );
  }
  return (
    <span className="ml-2 text-[11px] font-bold text-ink/35">
      → Steady
    </span>
  );
}

function OpenCoachCell({ slug }: { slug: string }) {
  const [hasPlan, setHasPlan] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`${LS_KEY}:${slug}`);
      setHasPlan(!!raw && raw.length > 10);
    } catch {
      setHasPlan(false);
    }
  }, [slug]);
  const href = hasPlan ? `/?artist=${slug}` : `/?artist=${slug}&openTimeline=1`;
  const label = hasPlan ? 'Open campaign' : 'Set up';
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-[0.14em] text-center inline-flex items-center justify-center gap-1.5"
      style={{ background: INK, color: PAPER }}
    >
      {hasPlan && <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#1FBE7A' }} />}
      {label}
    </Link>
  );
}
