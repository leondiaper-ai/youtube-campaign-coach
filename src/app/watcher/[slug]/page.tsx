import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ARTISTS, deriveFromLive, fmtNum, daysSince, STATUS_COLOR } from '@/lib/artists';
import { fetchChannelSnap } from '@/lib/youtube';
import { detectOpportunities, IMPACT_COLOR, IMPACT_RANK, type Opportunity } from '@/lib/opportunities';
import { readHistory, deltaOver, seriesForField } from '@/lib/snapshots';
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
  const watcherRead = derived?.watcherRead ?? artist.watcherRead;
  const nextAction = derived?.nextAction ?? artist.nextAction;
  const objective = derived?.objective;
  const impact = derived?.impact;
  const c = STATUS_COLOR[status];
  const lastUpDays = daysSince(live?.lastUploadAt);

  const opps = detectOpportunities(artist, live, daysToNextMoment).sort(
    (a, b) => IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact]
  );

  const history = live?.channelId ? await readHistory(live.channelId) : [];
  const subs7 = deltaOver(history, 7, 'subs');
  const subs30 = deltaOver(history, 30, 'subs');
  const views7 = deltaOver(history, 7, 'views');
  const subsSeries = seriesForField(history, 'subs', 30);
  const viewsSeries = seriesForField(history, 'views', 30);

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

        {/* 1. Status / state of play */}
        <div className="mt-6 rounded-xl border p-5" style={{ borderColor: MUTED, background: PAPER }}>
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ background: c.bg, color: c.fg }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
              {status}
            </span>
            {live && !live.error && (
              <span className="text-[10px] uppercase tracking-[0.14em] text-ink/45">live · YouTube API</span>
            )}
            {(!live || live.error) && (
              <span className="text-[10px] uppercase tracking-[0.14em]" style={{ color: '#FF4A1C' }}>
                seed data — live fetch unavailable
              </span>
            )}
          </div>
          <div className="text-[15px] mt-3">{watcherRead}</div>
          {objective && (
            <div className="text-[13px] text-ink/70 mt-2">
              <span className="text-ink/45 uppercase tracking-[0.12em] text-[10px] mr-2">Objective</span>
              {objective}
            </div>
          )}
        </div>

        {/* 2. Action this week */}
        <h2 className="font-black text-lg mt-10 mb-3">Action this week</h2>
        <div
          className="rounded-xl border-l-4 border p-5"
          style={{ borderColor: MUTED, borderLeftColor: INK, background: PAPER }}
        >
          <div className="text-[15px] font-medium">{nextAction}</div>
          {impact && (
            <div className="text-[12px] text-ink/60 mt-2">
              <span className="text-ink/45 uppercase tracking-[0.12em] text-[10px] mr-2">Why it matters</span>
              {impact}
            </div>
          )}
        </div>

        {/* Growth */}
        <div className="flex items-baseline justify-between mt-10 mb-3">
          <h2 className="font-black text-lg">Growth</h2>
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink/45">
            {history.length > 0 ? `${history.length}d tracked` : 'snapshot starts today'}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <GrowthCard
            label="Subscribers"
            current={live?.subs != null ? fmtNum(live.subs) : '—'}
            d7={subs7}
            d30={subs30}
            series={subsSeries}
          />
          <GrowthCard
            label="Total views"
            current={live?.views != null ? fmtNum(live.views) : '—'}
            d7={views7}
            d30={deltaOver(history, 30, 'views')}
            series={viewsSeries}
          />
        </div>

        {/* 3. Channel snapshot */}
        <h2 className="font-black text-lg mt-10 mb-3">Channel snapshot</h2>
        <div className="grid grid-cols-4 gap-3">
          <Stat label="Subscribers" value={live?.subs != null ? fmtNum(live.subs) : artist.subs} />
          <Stat label="Total views" value={live?.views != null ? fmtNum(live.views) : '—'} />
          <Stat label="Uploads · 30d" value={String(live?.uploads30d ?? artist.uploads30d)} />
          <Stat label="Last upload" value={lastUpDays != null ? `${lastUpDays}d ago` : '—'} />
        </div>

        {/* 4. What's Missing */}
        <div className="flex items-baseline justify-between mt-10 mb-3">
          <h2 className="font-black text-lg">What&rsquo;s missing</h2>
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink/45">
            {opps.length} {opps.length === 1 ? 'opportunity' : 'opportunities'}
          </div>
        </div>
        {opps.length > 0 ? (
          <div className="space-y-3">
            {opps.map((o) => (
              <OpportunityCard key={o.id} o={o} />
            ))}
          </div>
        ) : (
          <div
            className="rounded-xl border p-5 text-[13px] text-ink/55"
            style={{ borderColor: MUTED, background: PAPER }}
          >
            Nothing flagged. Channel is covered for now.
          </div>
        )}

        {/* 5. Next moment */}
        <h2 className="font-black text-lg mt-10 mb-3">Next moment</h2>
        <div className="rounded-xl border p-4" style={{ borderColor: MUTED, background: PAPER }}>
          <div className="text-[13px] font-bold">{artist.nextMomentLabel}</div>
          <div className="text-[11px] text-ink/55 mt-0.5 font-mono">{artist.nextMomentDate}</div>
        </div>

        {/* 6. Open Coach */}
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

function GrowthCard({
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
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: MUTED, background: PAPER }}
    >
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border px-4 py-3" style={{ borderColor: MUTED, background: PAPER }}>
      <div className="text-[10px] uppercase tracking-[0.18em] text-ink/45">{label}</div>
      <div className="font-black text-2xl mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function OpportunityCard({ o }: { o: Opportunity }) {
  const c = IMPACT_COLOR[o.impact];
  return (
    <article
      className="rounded-xl border-l-4 border p-5"
      style={{ borderColor: MUTED, borderLeftColor: c.dot, background: PAPER }}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-black text-[15px]">{o.subtype}</h3>
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-[0.14em] shrink-0"
          style={{ background: c.bg, color: c.fg }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
          {o.impact} · {o.impactRange}
        </span>
      </div>
      <div className="mt-3 text-[13px] text-ink/70 leading-snug">
        <span className="text-ink/45 uppercase tracking-[0.12em] text-[10px] mr-2">Signal</span>
        {o.signal}
      </div>
      <div className="mt-2 text-[13px] text-ink/85 leading-snug font-medium">
        <span className="text-ink/45 uppercase tracking-[0.12em] text-[10px] mr-2">Action</span>
        {o.action}
      </div>
    </article>
  );
}
