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

type LiveSnap = BaseLiveSnap & { loading?: boolean };

// --- Design tokens (match Coach) ---
const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const MUTED = '#E9E2D3';
const GOOD = '#1FBE7A';
const WARN = '#FFD24C';
const BAD = '#FF4A1C';

function fmtChecked(mins: number) {
  if (mins < 60) return `Checked ${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `Checked ${h}h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'Checked yesterday';
  if (d < 7) return `Checked ${d}d ago`;
  return `Checked ${d}d ago`;
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

export default function CampaignCockpit() {
  const [running, setRunning] = useState(false);
  const [live, setLive] = useState<Record<string, LiveSnap>>({});
  const [lastRunAt, setLastRunAt] = useState<number | null>(null);

  async function runChecks() {
    setRunning(true);
    setLive((prev) => {
      const next = { ...prev };
      for (const a of ARTISTS) next[a.slug] = { ...next[a.slug], loading: true };
      return next;
    });
    await Promise.all(
      ARTISTS.map(async (a) => {
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

  // auto-run on mount
  useEffect(() => {
    runChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upcoming = useMemo(
    () =>
      [...ARTISTS]
        .map((a) => ({ ...a, days: daysFromNow(a.nextMomentDate) }))
        .sort((a, b) => a.days - b.days),
    []
  );

  const effective = useMemo(
    () =>
      ARTISTS.map((a) => {
        const d = live[a.slug]
          ? deriveFromLive(live[a.slug], {
              daysToNextMoment: daysFromNow(a.nextMomentDate),
              phase: a.phase,
            })
          : null;
        return d
          ? { ...a, status: d.status, watcherRead: d.watcherRead, nextAction: d.nextAction }
          : a;
      }),
    [live]
  );

  const stats = useMemo(() => {
    const fixFirst = effective.filter((a) => a.status === 'FIX FIRST').length;
    const supportGaps = effective.filter((a) =>
      a.status === 'ACTIVE BUT WEAK' || a.status === 'BUILDING'
    ).length;
    const next7 = upcoming.filter((a) => a.days >= 0 && a.days <= 7).length;
    const cold = effective.filter((a) => {
      const l = live[a.slug];
      const u = l?.uploads30d ?? a.uploads30d;
      return u === 0;
    }).length;
    return { fixFirst, supportGaps, next7, cold };
  }, [effective, upcoming, live]);

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10" style={{ color: INK }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink/50">
            Cockpit · V1
          </div>
          <h1 className="font-black text-3xl leading-tight mt-1">
            Campaign Readiness Cockpit
          </h1>
          <p className="text-[13px] text-ink/60 mt-2 max-w-[60ch]">
            Selected artists, live checks, and next actions. One screen for what needs
            attention before the next moment hits.
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
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
          <div className="flex flex-col items-end gap-1">
            <span className="text-[9px] uppercase tracking-[0.18em] text-ink/40">For new artists</span>
            <Link
              href="/?openTimeline=1"
              className="px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-[0.14em]"
              style={{ background: INK, color: PAPER }}
            >
              Build from timeline
            </Link>
          </div>
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
          <span className="text-ink/30"> · </span>
          <span className="font-bold">{stats.next7} drops</span>
          <span className="text-ink/60"> in the next 7 days</span>
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

      {/* Artists in Focus — sorted by status severity, then by next moment proximity */}
      <SectionHeader title="Artists in focus" hint={`${ARTISTS.length} active campaigns`} />
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
            return daysFromNow(a.nextMomentDate) - daysFromNow(b.nextMomentDate);
          })
          .map((a, i, arr) => (
            <ArtistRow key={a.slug} a={a} last={i === arr.length - 1} live={live[a.slug]} />
          ))}
      </div>

      {/* Upcoming moments */}
      <div className="mt-10">
        <div>
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
                    <div className="text-[12px] font-mono">{fmtDate(a.nextMomentDate)}</div>
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
      </div>

      <div className="mt-12 text-[10px] uppercase tracking-[0.18em] text-ink/35">
        v1 · seed data · live checks wire to watcher API in phase 2
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

function ArtistRow({ a, last, live }: { a: Artist; last: boolean; live?: LiveSnap }) {
  const days = daysFromNow(a.nextMomentDate);
  const subs = live?.subs != null ? fmtNum(live.subs) : a.subs;
  const views30dDisplay = live?.views != null ? fmtNum(live.views) + ' total' : `${a.views30d} (30d)`;
  const uploads30d = live?.uploads30d != null ? live.uploads30d : a.uploads30d;
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
        <div className="font-bold text-[14px] truncate">{a.name}</div>
        <div className="text-[11px] text-ink/55 truncate">
          {a.campaign} · <span className="uppercase tracking-[0.12em]">{a.phase}</span>
        </div>
        <div className="text-[10px] text-ink/40 mt-1 font-mono flex items-center gap-1.5">
          <span>{subs} subs · {views30dDisplay} · {uploads30d} uploads/30d</span>
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
        <div className="text-[10px] text-ink/45 mt-1 font-mono">{fmtChecked(a.lastCheckedMinsAgo)}</div>
        <div className="text-[12px] mt-2">{a.nextMomentLabel}</div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-ink/45 mt-0.5">
          {fmtDate(a.nextMomentDate)} · {days === 0 ? 'today' : days < 0 ? `${-days}d ago` : `in ${days}d`}
        </div>
      </div>

      <div className="text-[12px] text-ink/70 leading-snug">{a.watcherRead}</div>
      <div className="text-[12px] text-ink/85 leading-snug font-medium">{a.nextAction}</div>

      <div className="flex flex-col gap-1.5 shrink-0">
        <Link
          href={`/watcher/${a.slug}`}
          className="px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-[0.14em] border text-center"
          style={{ borderColor: MUTED, background: SOFT, color: INK }}
        >
          Open Watcher
        </Link>
        <Link
          href={`/?artist=${a.slug}`}
          className="px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-[0.14em] text-center"
          style={{ background: INK, color: PAPER }}
        >
          Open Coach
        </Link>
      </div>
    </div>
  );
}
