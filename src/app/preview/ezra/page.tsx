/* ═══════════════════════════════════════════════════════════════════════
   EZRA COLLECTIVE — ARTIST PAGE PROTOTYPE (preview only)

   A separate route. /watcher/[slug] and the team views are untouched, and
   nothing here writes anything: every figure is read from the same cached
   snaps, stored daily readings and Chartmetric cache the production page
   uses. No YouTube request is made by loading this.

   THE BRIEF IS A FIVE-SECOND TEST, so the page is ordered by what a reader
   needs first rather than by where the data comes from:

     1  who this is, and is it healthy          (status + momentum)
     2  what should I do about it               (next action, near the top)
     3  what is being watched right now         (recent format split)
     4  where in the world                      (top three markets)
     5  what specifically is performing         (thumbnail grids)
     6  everything else                         (deeper analysis, linked)

   Two deliberate design rules, both about not misleading at a glance:

   RANKING BASIS IS ALWAYS NAMED. The thumbnail grids rank by lifetime
   views, because per-video daily deltas are not stored — only per-channel
   format sums are. So the grids say "ranked by lifetime views" rather than
   implying these are this week's winners. A five-second page is exactly
   where an unlabelled ranking does the most damage.

   LIFETIME NEVER TAKES THE BIG TYPE. See EzraFormatBlock.
   ═══════════════════════════════════════════════════════════════════════ */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ARTISTS, mergeArtistLists, deriveFromLive, fmtNum, daysSince,
  STATUS_COLOR, type ChannelState, type RecentUpload,
} from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { readLiveSnapByHandle } from '@/lib/kvCache';
import { readHistory } from '@/lib/snapshots';
import { normalizeChannelData, rawDelta } from '@/lib/youtube/normalizeChannelData';
import { resolveRowFormatSplit } from '@/lib/formatSplit';
import { readFormatDays } from '@/lib/formatHistory';
import { classifyUploadFormat } from '@/lib/formatClassifier';
import { isPinned } from '@/lib/campaignStore';
import { scanVideoGaps, whatToDoNow } from '@/components/WatcherArtistView';
import EzraFormatBlock from '@/components/preview/EzraFormatBlock';
import EzraMarkets from '@/components/preview/EzraMarkets';

export const revalidate = 600;

export const metadata = {
  title: 'Ezra Collective — Artist Page Prototype',
  description: 'Preview of a redesigned Watcher artist page. Not the production page.',
};

const SLUG = 'ezra-collective';
const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const RULE = '#E9E2D3';

/* YouTube serves a deterministic thumbnail per video id, so real imagery
   costs no API request. hqdefault exists for every public video; the
   maxres variants do not, which would leave holes in the grid. */
const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-ink/35">{children}</div>
  );
}

/** A metric with its measurement period always attached. */
function Metric({
  value, label, period, tone,
}: { value: string; label: string; period: string; tone?: string }) {
  return (
    <div>
      <div
        className="text-[28px] sm:text-[34px] font-black leading-none tracking-[-0.03em] tabular-nums"
        style={{ color: tone ?? INK }}
      >
        {value}
      </div>
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink/55 mt-2">{label}</div>
      <div className="text-[10px] text-ink/35 mt-0.5">{period}</div>
    </div>
  );
}

function VideoGrid({
  items, emptyNote,
}: { items: { id: string; title: string; views: number; publishedAt: string }[]; emptyNote: string }) {
  if (items.length === 0) {
    return <div className="text-[12px] text-ink/40">{emptyNote}</div>;
  }
  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {items.map((v) => (
        <a
          key={v.id}
          href={`https://www.youtube.com/watch?v=${v.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group no-underline"
        >
          <div
            className="relative overflow-hidden rounded-lg"
            style={{ background: RULE, aspectRatio: '16 / 9' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumb(v.id)}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              /* A thumbnail can 404 or be blocked. The tile keeps its
                 shape and the title still reads — a broken image icon in
                 a polished grid is worse than an empty frame. */
              style={{ display: 'block' }}
            />
          </div>
          <div className="text-[12px] font-bold leading-snug mt-2 text-ink line-clamp-2">{v.title}</div>
          <div className="text-[11px] text-ink/45 mt-0.5 tabular-nums">
            {fmtNum(v.views)} views · {daysSince(v.publishedAt)}d ago
          </div>
        </a>
      ))}
    </div>
  );
}

export default async function EzraPreviewPage() {
  const all = mergeArtistLists(ARTISTS, await listCustomArtists());
  const artist = all.find((a) => a.slug === SLUG);
  if (!artist?.channelHandle) notFound();

  const snap = await readLiveSnapByHandle(artist.channelHandle);
  const history = snap?.channelId && !snap.error ? await readHistory(snap.channelId) : [];
  const nc = normalizeChannelData(snap, history);
  const subs7 = rawDelta(nc.subs7d);
  const views7 = rawDelta(nc.views7d);
  const derived = snap ? deriveFromLive(snap, { subs7Delta: subs7, views7Delta: views7 }) : null;
  const status: ChannelState = derived?.status ?? 'COLD';

  const uploads: RecentUpload[] = snap?.recentUploads ?? [];
  const days = snap?.channelId ? await readFormatDays(snap.channelId) : [];
  const split = resolveRowFormatSplit(uploads, days, snap?.views ?? null);
  const campaignPinned = await isPinned(SLUG);

  const shorts = uploads.filter((u) => classifyUploadFormat(u) === 'short');
  const longform = uploads.filter((u) => classifyUploadFormat(u) !== 'short');

  const topLongform = [...longform]
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 4)
    .map((u) => ({ id: u.id, title: u.title, views: u.viewCount, publishedAt: u.publishedAt }));
  const topShorts = [...shorts]
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 4)
    .map((u) => ({ id: u.id, title: u.title, views: u.viewCount, publishedAt: u.publishedAt }));

  /* The recommendation is Watcher's own, not a new one invented here. */
  const lastUpDays = snap?.lastUploadAt ? daysSince(snap.lastUploadAt) : null;
  const moves = whatToDoNow(
    { type: status === 'COLD' ? 'FIX' : 'MAINTAIN', headline: derived?.reason ?? '', signals: [] },
    uploads,
    scanVideoGaps(uploads),
    {
      isColdMode: status === 'COLD',
      daysToNextMoment: null,
      momentLabel: artist.nextMomentLabel ?? null,
      uploads30d: nc.cadence.uploads30d,
      lastUpDays,
      subs7delta: subs7,
      views7delta: views7,
    },
  );

  /* STATUS_COLOR carries three values per state: a dot for the marker, a
     darker fg that stays legible as text on paper, and a bg. Using the
     dot colour for text would fail contrast on the lighter states. */
  const statusTheme = STATUS_COLOR[status] ?? { bg: RULE, fg: INK, dot: INK };

  return (
    <main style={{ background: PAPER, color: INK }} className="min-h-screen">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-8 sm:py-12">
        {/* ── preview banner — this is not production ────────────── */}
        <div className="flex flex-wrap items-center gap-3 mb-10">
          <span
            className="px-2 py-1 rounded text-[9px] font-black uppercase tracking-[0.14em]"
            style={{ background: INK, color: PAPER }}
          >
            Prototype
          </span>
          <span className="text-[11px] text-ink/45">
            Design preview. The live page is{' '}
            <Link href={`/watcher/${SLUG}`} className="underline underline-offset-2">
              /watcher/{SLUG}
            </Link>
            .
          </span>
        </div>

        {/* ═══ 1. WHO, AND IS IT HEALTHY ═══════════════════════════ */}
        <header>
          <div className="flex flex-wrap items-center gap-3">
            <Eyebrow>Virgin Music Group · YouTube Watcher</Eyebrow>
            {campaignPinned && (
              <span
                className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-[0.1em]"
                style={{ background: '#2C25FF', color: '#fff' }}
              >
                Active campaign
              </span>
            )}
          </div>
          <h1
            className="font-black tracking-[-0.045em] leading-[0.9] mt-4"
            style={{ fontSize: 'clamp(2.8rem,8vw,6rem)' }}
          >
            {artist.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2.5 mt-4">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: statusTheme.dot }} />
            <span className="text-[13px] font-bold uppercase tracking-[0.1em]" style={{ color: statusTheme.fg }}>
              {status}
            </span>
            {derived?.reason && (
              <span className="text-[13px] text-ink/50 max-w-[54ch]">— {derived.reason}</span>
            )}
          </div>
        </header>

        {/* ═══ 2. WHAT TO DO — kept near the top ═══════════════════ */}
        <section className="mt-9 pl-5" style={{ borderLeft: `3px solid ${statusTheme.dot}` }}>
          <Eyebrow>Next action</Eyebrow>
          <div className="text-[19px] sm:text-[23px] font-black leading-snug tracking-[-0.015em] mt-2 max-w-[30ch]">
            {moves.primary.label}
          </div>
          <div className="text-[13px] text-ink/60 mt-2 leading-relaxed max-w-[68ch]">
            {moves.primary.action}
          </div>
        </section>

        {/* ═══ 3. MOMENTUM ════════════════════════════════════════ */}
        <section className="mt-12 pt-8" style={{ borderTop: `1px solid ${RULE}` }}>
          <Eyebrow>Channel momentum</Eyebrow>
          <div className="grid gap-7 mt-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            <Metric
              value={nc.views != null ? fmtNum(nc.views) : '—'}
              label="Channel views"
              period="Lifetime total"
            />
            <Metric
              value={views7 != null ? `+${fmtNum(views7)}` : '—'}
              label="Views added"
              period="Last 7 days"
              tone={views7 != null && views7 > 0 ? '#0C6A3F' : undefined}
            />
            <Metric
              value={nc.subs != null ? fmtNum(nc.subs) : '—'}
              label="Subscribers"
              period="Current"
            />
            <Metric
              value={subs7 != null ? `${subs7 >= 0 ? '+' : ''}${fmtNum(subs7)}` : '—'}
              label="Subscriber change"
              period="Last 7 days"
              tone={subs7 != null ? (subs7 > 0 ? '#0C6A3F' : subs7 < 0 ? '#8A1F0C' : undefined) : undefined}
            />
            <Metric
              value={String(nc.cadence.uploads30d)}
              label="Uploads"
              period={lastUpDays != null ? `30 days · last ${lastUpDays}d ago` : 'Last 30 days'}
            />
          </div>
          {nc.movementConfidence && nc.movementFreshness && (
            <div className="text-[10px] text-ink/35 mt-5">
              Movement confidence {String(nc.movementConfidence).toLowerCase()} · {nc.movementFreshness}
            </div>
          )}
        </section>

        {/* ═══ 4. FORMAT + MARKETS, side by side ══════════════════ */}
        <section className="mt-12 pt-8 grid gap-12 lg:grid-cols-2" style={{ borderTop: `1px solid ${RULE}` }}>
          <div>
            <Eyebrow>Where viewing comes from · last 7 days</Eyebrow>
            <div className="mt-5">
              <EzraFormatBlock
                split={split}
                lifetimeCounts={{ longform: longform.length, shorts: shorts.length }}
              />
            </div>
          </div>
          <div>
            <Eyebrow>Where the audience is</Eyebrow>
            <div className="mt-5">
              <EzraMarkets slug={SLUG} />
            </div>
          </div>
        </section>

        {/* ═══ 5. WHAT IS PERFORMING ══════════════════════════════ */}
        <section className="mt-14 pt-8" style={{ borderTop: `1px solid ${RULE}` }}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Eyebrow>Top long-form</Eyebrow>
            <span className="text-[10px] text-ink/35">
              Ranked by lifetime views — per-video recent gains are not stored
            </span>
          </div>
          <div className="mt-5">
            <VideoGrid items={topLongform} emptyNote="No long-form videos in our cached inventory." />
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-2 mt-12">
            <Eyebrow>Top Shorts</Eyebrow>
            <span className="text-[10px] text-ink/35">Ranked by lifetime views</span>
          </div>
          <div className="mt-5">
            <VideoGrid
              items={topShorts}
              emptyNote="No Shorts in our cached inventory — none published, or none within the uploads we hold."
            />
          </div>
        </section>

        {/* ═══ 6. EVERYTHING ELSE ═════════════════════════════════ */}
        <section className="mt-14 pt-8" style={{ borderTop: `1px solid ${RULE}` }}>
          <Eyebrow>Full campaign intelligence</Eyebrow>
          <div className="text-[13px] text-ink/55 mt-3 max-w-[64ch] leading-relaxed">
            Launch assessment, missed reach, opportunity scan, conversion read and the campaign
            behaviour timeline are unchanged and still live on the production page. This prototype
            covers the overview only — nothing has been moved or removed.
          </div>
          <div className="flex flex-wrap gap-3 mt-5">
            <Link
              href={`/watcher/${SLUG}`}
              className="px-4 py-2 rounded text-[11px] font-black uppercase tracking-[0.1em] no-underline"
              style={{ background: INK, color: PAPER }}
            >
              Full analysis
            </Link>
            <Link
              href={`/campaigns?behaviour=${SLUG}`}
              className="px-4 py-2 rounded text-[11px] font-black uppercase tracking-[0.1em] no-underline"
              style={{ border: `1px solid ${RULE}`, color: INK }}
            >
              Channel behaviour
            </Link>
          </div>
          {moves.secondary && (
            <div className="mt-9 pt-6" style={{ borderTop: `1px solid ${RULE}` }}>
              <Eyebrow>Secondary move</Eyebrow>
              <div className="text-[15px] font-bold leading-snug mt-2 max-w-[40ch]">
                {moves.secondary.label}
              </div>
              <div className="text-[12px] text-ink/55 mt-1.5 leading-relaxed max-w-[68ch]">
                {moves.secondary.action}
              </div>
            </div>
          )}
        </section>

        <footer className="mt-16 pt-6 text-[10px] text-ink/30" style={{ borderTop: `1px solid ${RULE}` }}>
          Prototype · reads cached Watcher data only · no YouTube API requests on load
        </footer>
      </div>
    </main>
  );
}
