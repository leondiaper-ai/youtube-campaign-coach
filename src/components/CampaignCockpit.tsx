'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

// --- Design tokens (match Coach) ---
const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const MUTED = '#E9E2D3';
const GOOD = '#1FBE7A';
const WARN = '#FFD24C';
const BAD = '#FF4A1C';

type Status = 'READY' | 'FIX FIRST' | 'ACTIVE BUT WEAK' | 'BUILDING' | 'MOMENTUM';

const STATUS_COLOR: Record<Status, { bg: string; fg: string; dot: string }> = {
  'READY':            { bg: '#E6F8EE', fg: '#0C6A3F', dot: GOOD },
  'MOMENTUM':         { bg: '#E6F8EE', fg: '#0C6A3F', dot: GOOD },
  'BUILDING':         { bg: '#FFF5D6', fg: '#7A5A00', dot: WARN },
  'ACTIVE BUT WEAK':  { bg: '#FFEAD6', fg: '#8A4A1A', dot: '#F08A3C' },
  'FIX FIRST':        { bg: '#FFE2D8', fg: '#8A1F0C', dot: BAD },
};

type Artist = {
  slug: string;
  name: string;
  campaign: string;
  phase: 'PRE' | 'START' | 'RELEASE' | 'PUSH' | 'PEAK' | 'SUSTAIN';
  status: Status;
  nextMomentLabel: string;
  nextMomentDate: string; // ISO
  watcherRead: string;
  nextAction: string;
  subs: string;
  views30d: string;
  uploads30d: number;
  channelHandle?: string;
  lastCheckedMinsAgo: number;
};

const STATUS_RANK: Record<Status, number> = {
  'FIX FIRST': 0,
  'ACTIVE BUT WEAK': 1,
  'BUILDING': 2,
  'MOMENTUM': 3,
  'READY': 4,
};

function fmtChecked(mins: number) {
  if (mins < 60) return `Checked ${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `Checked ${h}h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'Checked yesterday';
  if (d < 7) return `Checked ${d}d ago`;
  return `Checked ${d}d ago`;
}

const ARTISTS: Artist[] = [
  {
    slug: 'ezra-collective',
    name: 'Ezra Collective',
    campaign: 'Album Cycle — TBD',
    phase: 'PRE',
    status: 'FIX FIRST',
    nextMomentLabel: 'Pre-campaign channel setup',
    nextMomentDate: '2026-04-22',
    watcherRead: 'Quiet 38 days. Trailer outdated.',
    nextAction: 'Refresh trailer & playlists before announce.',
    subs: '312K',
    views30d: '1.4M',
    uploads30d: 0,
    channelHandle: '@ezracollective',
    lastCheckedMinsAgo: 35,
  },
  {
    slug: 'k-trap',
    name: 'K-Trap',
    campaign: 'Change — Single Cycle',
    phase: 'PUSH',
    status: 'MOMENTUM',
    nextMomentLabel: 'PUSH content drop',
    nextMomentDate: '2026-04-19',
    watcherRead: 'Change at 1.2M, +18% week.',
    nextAction: 'Cut a BTS Short for drop day.',
    subs: '142K',
    views30d: '4.6M',
    uploads30d: 7,
    channelHandle: '@ktrap',
    lastCheckedMinsAgo: 120,
  },
  {
    slug: 'tom-odell',
    name: 'Tom Odell',
    campaign: 'Tour Announce',
    phase: 'START',
    status: 'BUILDING',
    nextMomentLabel: 'Tour announce video',
    nextMomentDate: '2026-04-28',
    watcherRead: 'Catalogue strong. No uploads in 21d.',
    nextAction: 'Schedule announce teaser + pinned post.',
    subs: '1.1M',
    views30d: '3.2M',
    uploads30d: 1,
    channelHandle: '@tomodell',
    lastCheckedMinsAgo: 240,
  },
  {
    slug: 'bad-omens',
    name: 'Bad Omens',
    campaign: 'Festival Run',
    phase: 'PEAK',
    status: 'ACTIVE BUT WEAK',
    nextMomentLabel: 'Coachella weekend recap',
    nextMomentDate: '2026-04-20',
    watcherRead: 'Watch-time flat 7d. Shorts gap.',
    nextAction: 'Cut 3 Shorts from festival within 24h.',
    subs: '2.4M',
    views30d: '5.8M',
    uploads30d: 5,
    channelHandle: '@badomens',
    lastCheckedMinsAgo: 55,
  },
  {
    slug: 'james-blake',
    name: 'James Blake',
    campaign: 'Catalogue Sustain',
    phase: 'SUSTAIN',
    status: 'READY',
    nextMomentLabel: 'Live session premiere',
    nextMomentDate: '2026-05-02',
    watcherRead: 'Premieres converting 32%. Holding cadence.',
    nextAction: 'Schedule next premiere window.',
    subs: '895K',
    views30d: '2.1M',
    uploads30d: 3,
    channelHandle: '@jamesblake',
    lastCheckedMinsAgo: 18,
  },
];

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

  const upcoming = useMemo(
    () =>
      [...ARTISTS]
        .map((a) => ({ ...a, days: daysFromNow(a.nextMomentDate) }))
        .sort((a, b) => a.days - b.days),
    []
  );

  const stats = useMemo(() => {
    const fixFirst = ARTISTS.filter((a) => a.status === 'FIX FIRST').length;
    const supportGaps = ARTISTS.filter((a) =>
      a.status === 'ACTIVE BUT WEAK' || a.status === 'BUILDING'
    ).length;
    const next7 = upcoming.filter((a) => a.days >= 0 && a.days <= 7).length;
    const cold = ARTISTS.filter((a) => a.uploads30d === 0).length;
    return { fixFirst, supportGaps, next7, cold };
  }, [upcoming]);

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
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => {
              setRunning(true);
              setTimeout(() => setRunning(false), 1200);
            }}
            disabled={running}
            className="text-[12px] font-bold uppercase tracking-[0.14em] text-ink/60 hover:text-ink underline decoration-ink/20 underline-offset-4"
          >
            {running ? 'Running…' : 'Run checks'}
          </button>
          <Link
            href="/?openTimeline=1"
            className="px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-[0.14em]"
            style={{ background: INK, color: PAPER }}
          >
            Build from timeline
          </Link>
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
        <div className="text-[10px] uppercase tracking-[0.18em] text-ink/45">
          Live · auto-refreshing
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
        {[...ARTISTS]
          .sort((a, b) => {
            const s = STATUS_RANK[a.status] - STATUS_RANK[b.status];
            if (s !== 0) return s;
            return daysFromNow(a.nextMomentDate) - daysFromNow(b.nextMomentDate);
          })
          .map((a, i, arr) => (
            <ArtistRow key={a.slug} a={a} last={i === arr.length - 1} />
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

function ArtistRow({ a, last }: { a: Artist; last: boolean }) {
  const days = daysFromNow(a.nextMomentDate);
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
        <div className="text-[10px] text-ink/40 mt-1 font-mono">
          {a.subs} subs · {a.views30d} (30d) · {a.uploads30d} uploads
        </div>
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
