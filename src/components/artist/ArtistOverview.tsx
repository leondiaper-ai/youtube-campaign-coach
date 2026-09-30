/* ═══════════════════════════════════════════════════════════════════════
   THE ARTIST OVERVIEW — the top of every artist page.

   Ordered by what a reader needs first rather than by where the data
   comes from, because the brief is a five-second test:

     1  who this is, and is it healthy        (status + momentum)
     2  how people are reacting               (one real comment)
     3  what should I do about it             (next action, near the top)
     4  what is being watched right now       (recent format split)
     5  where in the world                    (top three markets)
     6  what specifically is performing       (thumbnail grids)

   The deeper analysis — launch assessment, fix now, missed reach — follows
   underneath on the same page. Nothing here links away to find it.

   ── TWO DESIGN RULES, BOTH ABOUT NOT MISLEADING AT A GLANCE ───────────

   RANKING BASIS IS ALWAYS NAMED. The grids rank by views added in the last
   7 days where we hold enough daily per-video history, and by lifetime
   views where we do not — and they say which, every time, because those
   two orderings answer completely different questions and look identical.

   LIFETIME NEVER TAKES THE BIG TYPE. See FormatBlock.
   ═══════════════════════════════════════════════════════════════════════ */

import {
  fmtNum, daysSince, STATUS_COLOR,
  type ChannelState, type RecentUpload, type Artist,
} from '@/lib/artists';
import { resolveRowFormatSplit } from '@/lib/formatSplit';
import { readFormatDays } from '@/lib/formatHistory';
import { classifyUploadFormat } from '@/lib/formatClassifier';
import { rankByMomentum } from '@/lib/videoMomentum';
import FormatBlock from './FormatBlock';
import ArtistMarkets from './ArtistMarkets';
import AudienceLine from './AudienceLine';
import { Eyebrow, Metric, VideoGrid, INK, RULE, GAIN, LOSS } from './primitives';

/** The window both grids and the momentum ranking describe. */
const RECENT_WINDOW_DAYS = 7;

export interface ArtistOverviewProps {
  slug: string;
  artist: Artist;
  snap: { channelId?: string; views?: number | null; lastUploadAt?: string | null; recentUploads?: RecentUpload[] } | null;
  nc: {
    views: number | null;
    subs: number | null;
    cadence: { uploads30d: number };
    movementConfidence?: string | null;
    movementFreshness?: string | null;
  };
  derived: { reason?: string | null } | null;
  status: ChannelState;
  uploads: RecentUpload[];
  subs7: number | null;
  views7: number | null;
  /** Watcher's own recommendation — not a second one invented here. */
  moves: {
    primary: { label: string; action: string };
    secondary: { label: string; action: string } | null;
  };
  pinned: boolean;
}

export default async function ArtistOverview({
  slug, artist, snap, nc, derived, status, uploads, subs7, views7, moves, pinned,
}: ArtistOverviewProps) {
  const days = snap?.channelId ? await readFormatDays(snap.channelId) : [];
  const split = resolveRowFormatSplit(uploads, days, snap?.views ?? null);

  const shorts = uploads.filter(u => classifyUploadFormat(u) === 'short');
  const longform = uploads.filter(u => classifyUploadFormat(u) !== 'short');

  const toCandidate = (u: RecentUpload) => ({
    id: u.id, title: u.title, views: u.viewCount, publishedAt: u.publishedAt,
  });

  /* Both grids ranked in parallel — each is one MGET, and doing them in
     sequence would put two avoidable round trips in the render. */
  const [topLongform, topShorts] = await Promise.all([
    rankByMomentum(longform.map(toCandidate), { windowDays: RECENT_WINDOW_DAYS, limit: 4 }),
    rankByMomentum(shorts.map(toCandidate), { windowDays: RECENT_WINDOW_DAYS, limit: 4 }),
  ]);

  const lastUpDays = snap?.lastUploadAt ? daysSince(snap.lastUploadAt) : null;

  /* STATUS_COLOR carries three values per state: a dot for the marker, a
     darker fg that stays legible as text on paper, and a bg. Using the
     dot colour for text would fail contrast on the lighter states. */
  const statusTheme = STATUS_COLOR[status] ?? { bg: RULE, fg: INK, dot: INK };

  return (
    <>
      {/* ═══ 1. WHO, AND IS IT HEALTHY ═══════════════════════════ */}
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <Eyebrow>Virgin Music Group · YouTube Watcher</Eyebrow>
          {pinned && (
            <span
              className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-[0.1em]"
              style={{ background: '#2C25FF', color: '#fff' }}
            >
              Tracked project
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

        {/* ═══ 2. HOW PEOPLE ARE REACTING ════════════════════════ */}
        <AudienceLine slug={slug} />
      </header>

      {/* ═══ 3. WHAT TO DO — kept near the top ══════════════════ */}
      <section className="mt-9 pl-5" style={{ borderLeft: `3px solid ${statusTheme.dot}` }}>
        <Eyebrow>Next action</Eyebrow>
        <div className="text-[19px] sm:text-[23px] font-black leading-snug tracking-[-0.015em] mt-2 max-w-[30ch]">
          {moves.primary.label}
        </div>
        <div className="text-[13px] text-ink/60 mt-2 leading-relaxed max-w-[68ch]">
          {moves.primary.action}
        </div>
        {moves.secondary && (
          <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${RULE}` }}>
            <Eyebrow>Then</Eyebrow>
            <div className="text-[14px] font-bold leading-snug mt-1.5 max-w-[40ch]">
              {moves.secondary.label}
            </div>
            <div className="text-[12px] text-ink/55 mt-1 leading-relaxed max-w-[68ch]">
              {moves.secondary.action}
            </div>
          </div>
        )}
      </section>

      {/* ═══ MOMENTUM ═══════════════════════════════════════════ */}
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
            tone={views7 != null && views7 > 0 ? GAIN : undefined}
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
            tone={subs7 != null ? (subs7 > 0 ? GAIN : subs7 < 0 ? LOSS : undefined) : undefined}
          />
          <Metric
            value={String(nc.cadence.uploads30d)}
            label="Uploads"
            period={lastUpDays != null ? `30 days · last ${lastUpDays}d ago` : 'Last 30 days'}
          />
        </div>
        {/* These two fields often carry the same word ("stale · stale"),
            which read as a stutter rather than as information. Print the
            second only when it adds something. */}
        {(() => {
          const conf = nc.movementConfidence ? String(nc.movementConfidence).toLowerCase() : null;
          const fresh = nc.movementFreshness ? String(nc.movementFreshness).toLowerCase() : null;
          if (!conf && !fresh) return null;
          const detail = fresh && fresh !== conf ? ` · ${fresh}` : '';
          return (
            <div className="text-[10px] text-ink/35 mt-5">
              7-day movement figures are {conf ?? fresh}{detail} — from the last successful sync,
              not a live read.
            </div>
          );
        })()}
      </section>

      {/* ═══ 4+5. FORMAT + MARKETS, side by side ════════════════ */}
      <section className="mt-12 pt-8 grid gap-12 lg:grid-cols-2" style={{ borderTop: `1px solid ${RULE}` }}>
        <div>
          <Eyebrow>Where viewing comes from · last 7 days</Eyebrow>
          <div className="mt-5">
            <FormatBlock
              split={split}
              lifetimeCounts={{ longform: longform.length, shorts: shorts.length }}
            />
          </div>
        </div>
        <div>
          <Eyebrow>Where the audience is</Eyebrow>
          <div className="mt-5">
            <ArtistMarkets slug={slug} />
          </div>
        </div>
      </section>

      {/* ═══ 6. WHAT IS PERFORMING ══════════════════════════════ */}
      <section className="mt-14 pt-8" style={{ borderTop: `1px solid ${RULE}` }}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Eyebrow>
            {topLongform.basis === 'recent' ? 'Long-form · moving now' : 'Top long-form'}
          </Eyebrow>
          <span className="text-[10px] text-ink/35">{topLongform.note}</span>
        </div>
        <div className="mt-5">
          <VideoGrid
            items={topLongform.items}
            showGain={topLongform.basis === 'recent'}
            emptyNote="No long-form videos in our cached inventory."
          />
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-2 mt-12">
          <Eyebrow>{topShorts.basis === 'recent' ? 'Shorts · moving now' : 'Top Shorts'}</Eyebrow>
          <span className="text-[10px] text-ink/35">{topShorts.note}</span>
        </div>
        <div className="mt-5">
          <VideoGrid
            items={topShorts.items}
            showGain={topShorts.basis === 'recent'}
            emptyNote="No Shorts in our cached inventory — none published, or none within the uploads we hold."
          />
        </div>
      </section>
    </>
  );
}
