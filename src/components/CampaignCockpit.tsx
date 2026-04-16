'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ARTISTS,
  STATUS_COLOR,
  STATUS_RANK,
  deriveFromLive,
  daysSince,
  fmtNum,
  type Artist,
  type LiveSnap as BaseLiveSnap,
  type Status,
} from '@/lib/artists';
import AddArtistButton from './AddArtistButton';
import { CoachLiveDot } from './CoachLink';

type LiveSnap = BaseLiveSnap & { loading?: boolean };

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const MUTED = '#E9E2D3';
const BAD = '#FF4A1C';

const LS_KEY = 'pih-campaign-coach-v4';

function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
function daysFromNow(iso: string) {
  const d = new Date(iso + 'T00:00:00').getTime();
  const now = Date.now();
  return Math.round((d - now) / (1000 * 60 * 60 * 24));
}

function StatusChip({ status }: { status: Status }) {
  const c = STATUS_COLOR[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-[0.14em]"
      style={{ background: c.bg, color: c.fg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
      {status}
    </span>
  );
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

  // auto-run on mount + load custom artists
  useEffect(() => {
    loadCustom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // re-run checks whenever the artists list changes (e.g. after Add)
  useEffect(() => {
    if (artists.length) runChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artists.length]);

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

  const upcoming = useMemo(
    () =>
      artists
        .filter((a) => !!a.nextMomentDate)
        .map((a) => ({ ...a, days: daysFromNow(a.nextMomentDate!) }))
        .sort((a, b) => a.days - b.days),
    [artists]
  );

  const stats = useMemo(() => {
    const fixFirst = effective.filter((a) => a.status === 'FIX FIRST').length;
    const supportGaps = effective.filter((a) =>
      a.status === 'ACTIVE BUT WEAK' || a.status === 'BUILDING'
    ).length;
    const next7 = upcoming.filter((a) => a.days >= 0 && a.days <= 7).length;
    const cold = effective.filter((a) => {
      const l = live[a.slug];
      const u = l?.uploads30d;
      return u === 0;
    }).length;
    return { fixFirst, supportGaps, next7, cold };
  }, [effective, upcoming, live]);

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10" style={{ color: INK }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-ink/50">
            <YouTubeMark />
            <span>YouTube Cockpit · V1</span>
          </div>
          <h1 className="font-black text-3xl leading-tight mt-1">
            Campaign Readiness Cockpit
          </h1>
          <p className="text-[13px] text-ink/60 mt-2 max-w-[60ch]">
            Live YouTube channel signals, campaign state, and next actions. One screen for
            what needs attention before the next moment hits.
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <Link
            href="/growth"
            className="text-[11px] tracking-wide text-ink/55 hover:text-ink underline decoration-ink/20 underline-offset-4"
          >
            growth
          </Link>
          <Link
            href="/opportunities"
            className="text-[11px] tracking-wide text-ink/55 hover:text-ink underline decoration-ink/20 underline-offset-4"
          >
            opportunities
          </Link>
          <button
            onClick={runChecks}
            disabled={running}
            className="text-[11px] tracking-wide text-ink/55 hover:text-ink underline decoration-ink/20 underline-offset-4"
          >
            {running ? 'Refreshing…' : 'refresh checks'}
          </button>
          <AddArtistButton onAdded={loadCustom} />
        </div>
      </div>

      {/* Needs attention summary */}
      <div
        className="flex items-center justify-between rounded-xl border px-5 py-3 mb-8"
        style={{ borderColor: MUTED, background: SOFT }}
      >
        <div className="text-[13px]">
          <span className="font-black" style={{ color: BAD }}>
            {stats.fixFirst + stats.supportGaps} campaigns
          </span>
          <span className="text-ink/70"> need attention</span>
          {stats.next7 > 0 && (
            <>
              <span className="text-ink/30"> · </span>
              <span className="font-bold">{stats.next7} drops</span>
              <span className="text-ink/60"> in the next 7 days</span>
            </>
          )}
          {stats.cold > 0 && (
            <>
              <span className="text-ink/30"> · </span>
              <span className="font-bold" style={{ color: BAD }}>{stats.cold} cold</span>
            </>
          )}
        </div>
        <div className="text-[11px] text-ink/50">
          {running
            ? 'Refreshing…'
            : lastRunAt
            ? (() => {
                const ago = Math.round((Date.now() - lastRunAt) / 60000);
                if (ago < 1) return 'Updated just now';
                if (ago === 1) return 'Updated 1m ago';
                if (ago < 60) return `Updated ${ago}m ago`;
                return `Updated ${new Date(lastRunAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
              })()
            : 'Not yet checked'}
        </div>
      </div>

      {/* Artists in Focus */}
      <SectionHeader title="Artists in focus" hint={`${artists.length} ${artists.length === 1 ? 'channel' : 'channels'}`} />
      <div className="rounded-xl overflow-hidden border" style={{ borderColor: MUTED, background: PAPER }}>
        <div className="grid grid-cols-[1.4fr_1.2fr_1.6fr_1.6fr_auto] gap-4 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-ink/45 border-b" style={{ borderColor: MUTED, background: SOFT }}>
          <div>Artist</div>
          <div>Status · Next moment</div>
          <div>Watcher read</div>
          <div>Next action</div>
          <div className="text-right">Open</div>
        </div>
        {[...effective]
          .sort((a, b) => {
            const s = STATUS_RANK[a.status] - STATUS_RANK[b.status];
            if (s !== 0) return s;
            const ad = a.nextMomentDate ? daysFromNow(a.nextMomentDate) : 9999;
            const bd = b.nextMomentDate ? daysFromNow(b.nextMomentDate) : 9999;
            return ad - bd;
          })
          .map((a, i, arr) => (
            <ArtistRow key={a.slug} a={a} last={i === arr.length - 1} live={live[a.slug]} />
          ))}
        {artists.length === 0 && (
          <div className="px-5 py-8 text-center text-[13px] text-ink/55">
            No artists yet. Hit <span className="font-bold">+ Add artist</span> to pull a YouTube channel in.
          </div>
        )}
      </div>

      {/* Upcoming moments — only renders if a real Coach timeline has set a date */}
      {upcoming.length > 0 && (
        <div className="mt-10">
          <SectionHeader title="Upcoming moments" hint="Next 14 days" />
          <div className="rounded-xl border divide-y" style={{ borderColor: MUTED, background: PAPER }}>
            {upcoming
              .filter((a) => a.days >= 0 && a.days <= 14)
              .map((a) => (
                <div key={a.slug} className="flex items-center justify-between px-4 py-3" style={{ borderColor: MUTED }}>
                  <div className="min-w-0">
                    <div className="text-[12px] font-bold truncate">{a.name}</div>
                    <div className="text-[11px] text-ink/55 truncate">{a.nextMomentLabel}</div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="text-[12px] font-mono">{fmtDate(a.nextMomentDate!)}</div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-ink/45">
                      {a.days === 0 ? 'today' : a.days === 1 ? 'tomorrow' : `in ${a.days}d`}
                    </div>
                  </div>
                </div>
              ))}
            {upcoming.filter((a) => a.days >= 0 && a.days <= 14).length === 0 && (
              <div className="px-4 py-6 text-[12px] text-ink/45">Nothing in the next 14 days.</div>
            )}
          </div>
        </div>
      )}

      <div className="mt-12 text-[10px] uppercase tracking-[0.18em] text-ink/35">
        Live via YouTube Data API · Watcher tracks channels daily · Coach plans stay local to this browser
      </div>
    </div>
  );
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <h2 className="font-black text-lg">{title}</h2>
      {hint && <div className="text-[10px] uppercase tracking-[0.18em] text-ink/45">{hint}</div>}
    </div>
  );
}

type EffectiveArtist = Artist & {
  status: Status;
  watcherRead: string | null;
  nextAction: string | null;
};

function ArtistRow({ a, last, live }: { a: EffectiveArtist; last: boolean; live?: LiveSnap }) {
  const days = a.nextMomentDate ? daysFromNow(a.nextMomentDate) : null;
  const subs = live?.subs != null ? fmtNum(live.subs) : null;
  const totalViews = live?.views != null ? fmtNum(live.views) + ' total' : null;
  const uploads30d = live?.uploads30d;
  const lastUpDays = daysSince(live?.lastUploadAt);
  const isLive = !!live && !live.error && !live.loading && live.subs != null;

  return (
    <div
      className={`grid grid-cols-[1.4fr_1.2fr_1.6fr_1.6fr_auto] gap-4 px-5 py-4 items-center ${
        last ? '' : 'border-b'
      }`}
      style={{ borderColor: MUTED }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="font-bold text-[14px] truncate">{a.name}</div>
          <CoachLiveDot slug={a.slug} />
          {a.custom && (
            <span className="text-[9px] uppercase tracking-[0.14em] text-ink/40 font-mono">added</span>
          )}
        </div>
        <div className="text-[11px] text-ink/55 truncate">
          {a.campaign ? `${a.campaign} · ` : ''}
          <span className="uppercase tracking-[0.12em]">{a.phase}</span>
        </div>
        <div className="text-[10px] text-ink/40 mt-1 font-mono flex items-center gap-1.5 flex-wrap">
          {subs ? (
            <span>
              {subs} subs
              {totalViews ? ` · ${totalViews}` : ''}
              {uploads30d != null ? ` · ${uploads30d} uploads/30d` : ''}
            </span>
          ) : (
            <span className="text-ink/30">awaiting live data…</span>
          )}
          {live?.loading && <span className="text-ink/30">· loading…</span>}
          {live?.error && <span className="text-[#FF4A1C]" title={live.error}>· api error</span>}
          {isLive && <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#1FBE7A' }} title="Live data" />}
        </div>
        {lastUpDays != null && (
          <div className="text-[10px] text-ink/40 mt-0.5 font-mono">last upload {lastUpDays}d ago</div>
        )}
      </div>

      <div>
        <StatusChip status={a.status} />
        {a.nextMomentLabel && a.nextMomentDate ? (
          <>
            <div className="text-[12px] mt-2">{a.nextMomentLabel}</div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-ink/45 mt-0.5">
              {fmtDate(a.nextMomentDate)} · {days === 0 ? 'today' : (days ?? 0) < 0 ? `${-(days ?? 0)}d ago` : `in ${days}d`}
            </div>
          </>
        ) : (
          <div className="text-[11px] text-ink/45 mt-2 italic">No campaign timeline set.</div>
        )}
      </div>

      <div className="text-[12px] text-ink/70 leading-snug">
        {a.watcherRead ?? <span className="text-ink/30">—</span>}
      </div>
      <div className="text-[12px] text-ink/85 leading-snug font-medium">
        {a.nextAction ?? <span className="text-ink/30 font-normal">—</span>}
      </div>

      <div className="flex flex-col gap-1.5 shrink-0">
        <Link
          href={`/watcher/${a.slug}`}
          className="px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-[0.14em] border text-center"
          style={{ borderColor: MUTED, background: SOFT, color: INK }}
        >
          Open Watcher
        </Link>
        <OpenCoachCell slug={a.slug} />
      </div>
    </div>
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
