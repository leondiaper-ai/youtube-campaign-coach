import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ARTISTS, deriveFromLive, fmtNum, daysSince, STATUS_COLOR } from '@/lib/artists';
import { fetchChannelSnap } from '@/lib/youtube';

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

  return (
    <main className="bg-paper min-h-screen" style={{ color: INK }}>
      <div className="max-w-[960px] mx-auto px-6 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/cockpit" className="text-[11px] uppercase tracking-[0.18em] text-ink/55 hover:text-ink">
            ← Cockpit
          </Link>
          <Link
            href={`/?artist=${slug}`}
            className="px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ background: INK, color: PAPER }}
          >
            Open Coach
          </Link>
        </div>

        {/* Header */}
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink/50">
          Watcher · {artist.campaign} · {artist.phase}
        </div>
        <h1 className="font-black text-3xl mt-1">{artist.name}</h1>

        {/* Headline status */}
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
          <div className="text-[13px] text-ink/70 mt-1">
            <span className="text-ink/45 uppercase tracking-[0.12em] text-[10px] mr-2">
              {status === 'ALWAYS ON' ? 'This week' : 'Next'}
            </span>
            {nextAction}
          </div>
          {impact && (
            <div className="text-[12px] text-ink/55 mt-2 italic">{impact}</div>
          )}
        </div>

        {/* Channel snapshot */}
        <h2 className="font-black text-lg mt-10 mb-3">Channel snapshot</h2>
        <div className="grid grid-cols-4 gap-3">
          <Stat label="Subscribers" value={live?.subs != null ? fmtNum(live.subs) : artist.subs} />
          <Stat label="Total views" value={live?.views != null ? fmtNum(live.views) : '—'} />
          <Stat label="Uploads · 30d" value={String(live?.uploads30d ?? artist.uploads30d)} />
          <Stat label="Last upload" value={lastUpDays != null ? `${lastUpDays}d ago` : '—'} />
        </div>

        {/* Next moment */}
        <h2 className="font-black text-lg mt-10 mb-3">Next moment</h2>
        <div className="rounded-xl border p-4" style={{ borderColor: MUTED, background: PAPER }}>
          <div className="text-[13px] font-bold">{artist.nextMomentLabel}</div>
          <div className="text-[11px] text-ink/55 mt-0.5 font-mono">{artist.nextMomentDate}</div>
        </div>

        {/* What's next */}
        <h2 className="font-black text-lg mt-10 mb-3">Coming next in Watcher</h2>
        <ul className="text-[12px] text-ink/65 leading-relaxed space-y-1.5">
          <li>· Recent uploads with view counts and momentum trend</li>
          <li>· Format mix (long-form / Shorts / Premieres) and gaps</li>
          <li>· Pre/post campaign comparison once a Coach plan is linked</li>
          <li>· One-click shareable PDF report for artist teams and labels</li>
        </ul>

        <div className="mt-12 text-[10px] uppercase tracking-[0.18em] text-ink/35">
          v0.5 · live channel signals · richer view in next pass
        </div>
      </div>
    </main>
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
