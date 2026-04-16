import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ARTISTS, deriveFromLive, fmtNum, daysSince, STATUS_COLOR } from '@/lib/artists';
import { fetchChannelSnap } from '@/lib/youtube';
import { detectOpportunities, IMPACT_COLOR, IMPACT_RANK, type Opportunity } from '@/lib/opportunities';
import { readHistory, deltaOver, seriesForField } from '@/lib/snapshots';
import { decideWatcher, DECISION_COLOR, VERDICT_LABEL } from '@/lib/watcherDecision';
import Sparkline from '@/components/Sparkline';

export const revalidate = 600;

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const MUTED = '#E9E2D3';

export default async function WatcherPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const artist = ARTISTS.find((a) => a.slug === slug);
  if (!artist) notFound();

  const live = artist.channelHandle ? await fetchChannelSnap(artist.channelHandle) : null;
  const daysToNextMoment = artist.nextMomentDate
    ? Math.round(
        (new Date(artist.nextMomentDate + 'T00:00:00').getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      )
    : null;
  const derived = live
    ? deriveFromLive(live, { daysToNextMoment, phase: artist.phase })
    : null;
  const status = derived?.status ?? artist.status;
  const lastUpDays = daysSince(live?.lastUploadAt);

  const opps = detectOpportunities(artist, live, daysToNextMoment).sort(
    (a, b) => IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact]
  );

  const history = live?.channelId ? await readHistory(live.channelId) : [];
  const subs7 = deltaOver(history, 7, 'subs');
  const subs30 = deltaOver(history, 30, 'subs');
  const views7 = deltaOver(history, 7, 'views');
  const views30 = deltaOver(history, 30, 'views');
  const subsSeries = seriesForField(history, 'subs', 30);
  const viewsSeries = seriesForField(history, 'views', 30);

  // --- Decision block (System 1) ---
  const decision = decideWatcher({
    artist,
    live,
    opps,
    daysToNextMoment,
    subs7,
    subs30,
    views7,
    history,
  });
  const isLive = !!(live && !live.error);

  const channelOpps = opps.filter((o) => !o.videoId);
  const criticalOpps = channelOpps.filter((o) => o.impact === 'HIGH');
  const secondaryOpps = channelOpps.filter((o) => o.impact !== 'HIGH');
  const videoOppsAll = opps.filter((o) => !!o.videoId);

  // Group per-video opportunities
  const videoGroups = new Map<string, Opportunity[]>();
  for (const o of videoOppsAll) {
    const arr = videoGroups.get(o.videoId!) ?? [];
    arr.push(o);
    videoGroups.set(o.videoId!, arr);
  }
  const videoCards = Array.from(videoGroups.entries())
    .map(([id, items]: [string, Opportunity[]]) => ({
      id,
      title: items[0].videoTitle ?? id,
      views: items[0].videoViews ?? 0,
      items: items
        .slice()
        .sort((a, b) => IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact]),
    }))
    .sort((a, b) => b.views - a.views);

  const dc = DECISION_COLOR[decision.type];
  const s = STATUS_COLOR[status];

  return (
    <main className="bg-paper min-h-screen" style={{ color: INK }}>
      <div className="max-w-[960px] mx-auto px-6 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/cockpit" className="text-[11px] uppercase tracking-[0.18em] text-ink/55 hover:text-ink">
            ← Cockpit
          </Link>
          <Link
            href="/opportunities"
            className="text-[11px] uppercase tracking-[0.18em] text-ink/55 hover:text-ink"
          >
            Scanner →
          </Link>
        </div>

        {/* Header */}
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink/50">
          Watcher · {artist.campaign} · {artist.phase}
        </div>
        <h1 className="font-black text-3xl mt-1">{artist.name}</h1>

        {/* ─────────────────── 1. DECISION (System 1) ─────────────────── */}
        <section
          className="mt-6 rounded-2xl border-2 p-6"
          style={{ borderColor: INK, background: PAPER }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-black uppercase tracking-[0.18em]"
              style={{ background: dc.bg, color: dc.fg }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: dc.dot }} />
              {decision.type}
            </span>
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ background: s.bg, color: s.fg }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
              {VERDICT_LABEL[decision.verdict]}
            </span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-ink/45">
              confidence · {decision.confidence}
            </span>
            <span className="text-[10px] uppercase tracking-[0.14em] ml-auto"
              style={{ color: isLive ? '#0C6A3F' : '#FF4A1C' }}>
              {isLive ? 'live · YouTube API' : 'seed data'}
            </span>
          </div>

          {/* Headline action */}
          <div className="mt-4 text-[20px] font-black leading-tight">
            {decision.headline}
          </div>

          {/* Supporting signals */}
          <ul className="mt-4 space-y-1.5">
            {decision.signals.map((sig, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-ink/75">
                <span className="mt-[7px] w-1 h-1 rounded-full shrink-0" style={{ background: INK }} />
                <span>{sig}</span>
              </li>
            ))}
          </ul>

          {/* Expected impact / if ignored */}
          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="rounded-lg p-3" style={{ background: SOFT }}>
              <div className="text-[9px] uppercase tracking-[0.18em] text-ink/45">Expected impact</div>
              <div className="text-[12px] text-ink/80 mt-1 leading-snug">
                {decision.expectedImpact}
              </div>
            </div>
            <div className="rounded-lg p-3" style={{ background: SOFT }}>
              <div className="text-[9px] uppercase tracking-[0.18em] text-ink/45">If ignored</div>
              <div className="text-[12px] text-ink/80 mt-1 leading-snug">{decision.ifIgnored}</div>
            </div>
          </div>
        </section>

        {/* ─────────────────── 2. SIGNAL SNAPSHOT ─────────────────── */}
        <div className="flex items-baseline justify-between mt-10 mb-3">
          <h2 className="font-black text-lg">Signal snapshot</h2>
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink/45">
            {history.length > 0 ? `${history.length}d tracked` : 'snapshot starts today'}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SignalCard
            label="Subscribers"
            current={live?.subs != null ? fmtNum(live.subs) : artist.subs}
            d7={subs7}
            d30={subs30}
            series={subsSeries}
          />
          <SignalCard
            label="Total views"
            current={live?.views != null ? fmtNum(live.views) : '—'}
            d7={views7}
            d30={views30}
            series={viewsSeries}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <MiniStat label="Uploads · 30d" value={String(live?.uploads30d ?? artist.uploads30d)} />
          <MiniStat label="Last upload" value={lastUpDays != null ? `${lastUpDays}d ago` : '—'} />
        </div>

        {/* When the decision is MAINTAIN / ACCELERATE, don't pile on work —
            tuck the full opportunity list behind one summary instead. */}
        {(decision.type === 'MAINTAIN' || decision.type === 'ACCELERATE') &&
          (criticalOpps.length + secondaryOpps.length + videoOppsAll.length) > 0 && (
            <details className="mt-10 group">
              <summary
                className="cursor-pointer list-none rounded-xl border px-5 py-4 flex items-center justify-between hover:bg-ink/[0.02] transition"
                style={{ borderColor: MUTED, background: PAPER }}
              >
                <div>
                  <div className="font-black text-lg">Everything else Watcher is tracking</div>
                  <div className="text-[11px] text-ink/55 mt-0.5">
                    {criticalOpps.length + secondaryOpps.length} channel · {videoOppsAll.length} catalogue. Not worth acting on while the plan is working.
                  </div>
                </div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink/45 flex items-center gap-2">
                  SIDELINED
                  <span className="text-ink/40 group-open:rotate-180 transition">▾</span>
                </div>
              </summary>
              <div className="space-y-3 mt-3">
                {[...criticalOpps, ...secondaryOpps].map((o) => (
                  <OpportunityCard key={o.id} o={o} weight="medium" />
                ))}
                {videoOppsAll.length > 0 &&
                  Array.from(
                    videoOppsAll.reduce((m, o) => {
                      const arr = m.get(o.videoId!) ?? [];
                      arr.push(o);
                      m.set(o.videoId!, arr);
                      return m;
                    }, new Map<string, Opportunity[]>())
                  ).map(([id, items]: [string, Opportunity[]]) => (
                    <VideoGapCard
                      key={id}
                      video={{
                        id,
                        title: items[0].videoTitle ?? id,
                        views: items[0].videoViews ?? 0,
                        items,
                      }}
                    />
                  ))}
              </div>
            </details>
          )}

        {/* ─────────────────── 3. FIX THESE NOW (critical) ─────────────────── */}
        {decision.type !== 'MAINTAIN' && decision.type !== 'ACCELERATE' && criticalOpps.length > 0 && (
          <>
            <div className="flex items-baseline justify-between mt-10 mb-3">
              <h2 className="font-black text-lg">Fix these now</h2>
              <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: '#8A1F0C' }}>
                CRITICAL · {criticalOpps.length}
              </div>
            </div>
            <div className="space-y-3">
              {criticalOpps.map((o) => (
                <OpportunityCard key={o.id} o={o} weight="strong" />
              ))}
            </div>
          </>
        )}

        {/* ─────────────────── 4. IMPROVE PERFORMANCE (secondary) ─────────────────── */}
        {decision.type !== 'MAINTAIN' && decision.type !== 'ACCELERATE' && secondaryOpps.length > 0 && (
          <>
            <div className="flex items-baseline justify-between mt-10 mb-3">
              <h2 className="font-black text-lg">Improve performance</h2>
              <div className="text-[10px] uppercase tracking-[0.18em] text-ink/55">
                SECONDARY · {secondaryOpps.length}
              </div>
            </div>
            <div className="space-y-3">
              {secondaryOpps.map((o) => (
                <OpportunityCard key={o.id} o={o} weight="medium" />
              ))}
            </div>
          </>
        )}

        {/* ─────────────────── 5. UNLOCK CATALOGUE VALUE (collapsed) ─────────────────── */}
        {decision.type !== 'MAINTAIN' && decision.type !== 'ACCELERATE' && videoCards.length > 0 && (
          <details className="mt-10 group">
            <summary
              className="cursor-pointer list-none rounded-xl border px-5 py-4 flex items-center justify-between hover:bg-ink/[0.02] transition"
              style={{ borderColor: MUTED, background: PAPER }}
            >
              <div>
                <div className="font-black text-lg">Unlock catalogue value</div>
                <div className="text-[11px] text-ink/55 mt-0.5">
                  {videoCards.length} top video{videoCards.length === 1 ? '' : 's'} with missing lyric cuts, visualizers, Shorts or captions
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-ink/45 flex items-center gap-2">
                OPPORTUNITY
                <span className="text-ink/40 group-open:rotate-180 transition">▾</span>
              </div>
            </summary>
            <div className="space-y-3 mt-3">
              {videoCards.map((v) => (
                <VideoGapCard key={v.id} video={v} />
              ))}
            </div>
          </details>
        )}

        {opps.length === 0 && (
          <div
            className="mt-10 rounded-xl border p-5 text-[13px] text-ink/55"
            style={{ borderColor: MUTED, background: PAPER }}
          >
            Nothing flagged. Channel is covered for now.
          </div>
        )}

        {/* ─────────────────── 6. NEXT MOMENT ─────────────────── */}
        <h2 className="font-black text-lg mt-10 mb-3">Next moment</h2>
        <div className="rounded-xl border p-4" style={{ borderColor: MUTED, background: PAPER }}>
          <div className="text-[13px] font-bold">{artist.nextMomentLabel}</div>
          <div className="text-[11px] text-ink/55 mt-0.5 font-mono">
            {artist.nextMomentDate}
            {daysToNextMoment != null && daysToNextMoment >= 0 && ` · in ${daysToNextMoment}d`}
          </div>
        </div>

        {/* ─────────────────── 7. EXECUTE ─────────────────── */}
        <div className="mt-12 flex items-center justify-between">
          <div className="text-[12px] text-ink/55 max-w-[50ch]">
            Ready to execute? Open Coach to turn these actions into a plan.
          </div>
          <Link
            href={`/?artist=${slug}`}
            className="px-5 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-[0.14em]"
            style={{ background: INK, color: PAPER }}
          >
            Open Coach →
          </Link>
        </div>

        <div className="mt-10 text-[10px] uppercase tracking-[0.18em] text-ink/35">
          Scanner points · Watcher knows · Coach ships
        </div>
      </div>
    </main>
  );
}

function SignalCard({
  label,
  current,
  d7,
  d30,
  series,
}: {
  label: string;
  current: string;
  d7: { delta: number; pct: number } | null;
  d30: { delta: number; pct: number } | null;
  series: { x: number; y: number }[];
}) {
  const fmtDelta = (d: { delta: number; pct: number } | null) => {
    if (!d) return '—';
    const sign = d.delta > 0 ? '+' : d.delta < 0 ? '' : '±';
    const n =
      Math.abs(d.delta) >= 1_000_000
        ? (d.delta / 1_000_000).toFixed(1) + 'M'
        : Math.abs(d.delta) >= 1_000
        ? (d.delta / 1_000).toFixed(1) + 'K'
        : String(d.delta);
    return `${sign}${n} (${(d.pct * 100).toFixed(1)}%)`;
  };
  const colorFor = (d: { delta: number } | null) =>
    !d ? '#8A8A8A' : d.delta > 0 ? '#0C6A3F' : d.delta < 0 ? '#8A1F0C' : '#8A8A8A';
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: MUTED, background: PAPER }}>
      <div className="flex items-baseline justify-between">
        <div className="text-[10px] uppercase tracking-[0.18em] text-ink/45">{label}</div>
        <div className="font-black text-xl tabular-nums">{current}</div>
      </div>
      <div className="mt-3">
        <Sparkline data={series} width={280} height={44} />
      </div>
      <div className="flex items-center justify-between mt-3 text-[11px] font-mono">
        <div>
          <span className="text-ink/45 uppercase tracking-[0.12em] text-[9px] mr-1">7d</span>
          <span style={{ color: colorFor(d7) }}>{fmtDelta(d7)}</span>
        </div>
        <div>
          <span className="text-ink/45 uppercase tracking-[0.12em] text-[9px] mr-1">30d</span>
          <span style={{ color: colorFor(d30) }}>{fmtDelta(d30)}</span>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border px-4 py-3" style={{ borderColor: MUTED, background: PAPER }}>
      <div className="text-[10px] uppercase tracking-[0.18em] text-ink/45">{label}</div>
      <div className="font-black text-xl mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function VideoGapCard({
  video,
}: {
  video: { id: string; title: string; views: number; items: Opportunity[] };
}) {
  const worst = video.items.reduce<Opportunity['impact']>(
    (acc, o) => (IMPACT_RANK[o.impact] < IMPACT_RANK[acc] ? o.impact : acc),
    'LOW'
  );
  const c = IMPACT_COLOR[worst];
  return (
    <article
      className="rounded-xl border-l-4 border p-5"
      style={{ borderColor: MUTED, borderLeftColor: c.dot, background: PAPER }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a
            href={`https://www.youtube.com/watch?v=${video.id}`}
            target="_blank"
            rel="noreferrer"
            className="font-black text-[15px] hover:underline underline-offset-4 decoration-ink/30 truncate inline-block max-w-[52ch]"
            title={video.title}
          >
            {video.title}
          </a>
          <div className="text-[11px] text-ink/55 mt-0.5 font-mono">
            {video.views.toLocaleString()} views · {video.items.length} {video.items.length === 1 ? 'gap' : 'gaps'}
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-[0.14em] shrink-0"
          style={{ background: c.bg, color: c.fg }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
          {worst}
        </span>
      </div>
      <ul className="mt-4 space-y-2.5">
        {video.items.map((o) => {
          const ic = IMPACT_COLOR[o.impact];
          return (
            <li key={o.id} className="flex items-start gap-3 text-[13px]">
              <span
                className="mt-1 w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: ic.dot }}
              />
              <div className="min-w-0">
                <div className="font-bold">{o.subtype.replace(/^Top video /i, '')}</div>
                <div className="text-ink/85 leading-snug mt-0.5">{o.action}</div>
                <details className="group mt-1">
                  <summary className="cursor-pointer list-none text-[10px] uppercase tracking-[0.14em] text-ink/45 hover:text-ink select-none">
                    Why <span className="text-ink/30 group-open:rotate-180 inline-block transition">▾</span>
                  </summary>
                  <div className="text-ink/60 leading-snug mt-1 text-[12px] max-w-[72ch]">
                    {o.impactRange}
                  </div>
                </details>
              </div>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function OpportunityCard({ o, weight = 'strong' }: { o: Opportunity; weight?: 'strong' | 'medium' }) {
  const c = IMPACT_COLOR[o.impact];
  const strong = weight === 'strong';
  return (
    <article
      className={strong ? 'rounded-xl border-l-4 border-2 p-5' : 'rounded-xl border-l-4 border p-5'}
      style={{
        borderColor: strong ? INK : MUTED,
        borderLeftColor: c.dot,
        background: PAPER,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className={strong ? 'font-black text-[16px]' : 'font-black text-[14px]'}>{o.subtype}</h3>
          {o.videoId && o.videoTitle && (
            <a
              href={`https://www.youtube.com/watch?v=${o.videoId}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-ink/55 hover:text-ink underline decoration-ink/20 underline-offset-4 mt-1 inline-block truncate max-w-[48ch]"
              title={o.videoTitle}
            >
              {o.videoTitle}
              {o.videoViews != null && (
                <span className="text-ink/35 ml-1">· {o.videoViews.toLocaleString()} views</span>
              )}
            </a>
          )}
        </div>
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-[0.14em] shrink-0"
          style={{ background: c.bg, color: c.fg }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
          {o.impact}
        </span>
      </div>
      <div className="mt-3 text-[13px] text-ink/70 leading-snug">
        <span className="text-ink/45 uppercase tracking-[0.12em] text-[10px] mr-2">Signal</span>
        {o.signal}
      </div>
      <div className={strong ? 'mt-3 text-[14px] text-ink leading-snug font-bold' : 'mt-2 text-[13px] text-ink/85 leading-snug font-medium'}>
        <span className="text-ink/45 uppercase tracking-[0.12em] text-[10px] mr-2">Action</span>
        {o.action}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 pt-3 border-t" style={{ borderColor: MUTED }}>
        <details className="group">
          <summary className="cursor-pointer list-none text-[11px] uppercase tracking-[0.14em] text-ink/50 hover:text-ink select-none">
            Why it matters <span className="text-ink/35 group-open:rotate-180 inline-block transition">▾</span>
          </summary>
          <div className="text-[12px] text-ink/70 leading-snug mt-2 max-w-[72ch]">
            {o.impactRange}
          </div>
        </details>
        {o.relatedVideos && o.relatedVideos.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer list-none text-[11px] uppercase tracking-[0.14em] text-ink/50 hover:text-ink select-none">
              Show {o.relatedVideos.length} affected {o.relatedVideos.length === 1 ? 'video' : 'videos'} <span className="text-ink/35 group-open:rotate-180 inline-block transition">▾</span>
            </summary>
            <ul className="mt-2 space-y-1.5 w-full">
              {o.relatedVideos.map((v) => (
                <li key={v.id} className="text-[12px] flex items-center justify-between gap-3">
                  <a
                    href={`https://www.youtube.com/watch?v=${v.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate max-w-[52ch] text-ink/75 hover:text-ink underline decoration-ink/20 underline-offset-4"
                    title={v.title}
                  >
                    {v.title}
                  </a>
                  {v.viewCount != null && (
                    <span className="text-[11px] text-ink/40 font-mono shrink-0">
                      {v.viewCount.toLocaleString()}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </article>
  );
}
