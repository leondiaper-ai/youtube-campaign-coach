/* ═══════════════════════════════════════════════════════════════════════
   ARTIST PAGE PRIMITIVES

   The small pieces the artist overview is built from, in one place so the
   page and anything that reuses it cannot drift apart.

   The only opinionated one is Metric: the measurement period is a required
   prop, not an optional one. A page that sets "29M" and "+338K" in the same
   row, one lifetime and one weekly, is unreadable unless every figure says
   which it is — and the way that guarantee survives future edits is to make
   the type system refuse a metric without a period.
   ═══════════════════════════════════════════════════════════════════════ */

import { fmtNum, daysSince } from '@/lib/artists';

export const INK = '#0E0E0E';
export const PAPER = '#FAF7F2';
export const RULE = '#E9E2D3';
export const GAIN = '#0C6A3F';
export const LOSS = '#8A1F0C';

/* YouTube serves a deterministic thumbnail per video id, so real imagery
   costs no API request. hqdefault exists for every public video; the
   maxres variants do not, which would leave holes in the grid. */
export const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-ink/35">{children}</div>
  );
}

/** A metric with its measurement period always attached. */
export function Metric({
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

export interface GridVideo {
  id: string;
  title: string;
  views: number;
  publishedAt: string;
  /** Views added in the ranking window, when we hold daily history. */
  recentGain?: number | null;
}

/**
 * When the grid is ranked by recent gain, the gain is what leads — putting
 * lifetime views in the primary position under a "last 7 days" ranking
 * would explain the order with the wrong number. Lifetime stays as context
 * after it. A video with no daily history shows lifetime only, which is
 * also why it sorts last: there is nothing to rank it by.
 */
export function VideoGrid({
  items, emptyNote, showGain = false,
}: { items: GridVideo[]; emptyNote: string; showGain?: boolean }) {
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
          {showGain && v.recentGain != null ? (
            <div className="text-[11px] mt-0.5 tabular-nums">
              <span className="font-bold" style={{ color: GAIN }}>
                +{fmtNum(v.recentGain)}
              </span>
              <span className="text-ink/45">
                {' '}· {fmtNum(v.views)} total · {daysSince(v.publishedAt)}d ago
              </span>
            </div>
          ) : (
            <div className="text-[11px] text-ink/45 mt-0.5 tabular-nums">
              {fmtNum(v.views)} views · {daysSince(v.publishedAt)}d ago
              {showGain && <span className="text-ink/30"> · no daily history</span>}
            </div>
          )}
        </a>
      ))}
    </div>
  );
}
