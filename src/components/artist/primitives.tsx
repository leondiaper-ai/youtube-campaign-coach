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
/**
 * The hot-asset badge. Burnt orange, and deliberately none of the three
 * colours already in use:
 *
 *   GAIN green     is the growth NUMBER. The badge sat on it, which read
 *                  as another metric rather than a flag.
 *   negative red   means cold or declining on the health tiles. A positive
 *                  badge in the decline colour argues with the board.
 *   signal #FF4A1C is the VMG accent, rationed for navigation — and at
 *                  3.36:1 against white it fails AA for small text, so it
 *                  could not carry this label anyway.
 *
 * 5.65:1 against white, which clears AA for small bold text.
 */
export const HOT = '#B4411C';

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
  /** Older uploads this one has already passed. See AheadOf in videoMomentum. */
  aheadOf?: { passed: number; of: number } | null;
}

/**
 * When the grid is ranked by recent gain, the gain is what leads — putting
 * lifetime views in the primary position under a "last 7 days" ranking
 * would explain the order with the wrong number. Lifetime stays as context
 * after it. A video with no daily history shows lifetime only, which is
 * also why it sorts last: there is nothing to rank it by.
 */
export function VideoGrid({
  items, emptyNote, showGain = false, format = 'long',
}: { items: GridVideo[]; emptyNote: string; showGain?: boolean; format?: 'long' | 'short' }) {
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
            {/* The badge sits ON the tile because it is a property of the
                video, not of the row of numbers underneath.

                "Ahead of 5/5" was what the measure computes, not what
                anybody says out loud — a label reads a grid to find the
                record that is working, and the phrase for that is a hot
                asset. The ratio stays on hover, because the badge still
                has to be checkable by whoever is asked to defend it. */}
            {v.aheadOf && (
              <span
                className="absolute top-1.5 left-1.5 px-1.5 py-[3px] rounded text-[9px] font-bold uppercase tracking-wide"
                style={{ background: HOT, color: '#FFFFFF' }}
                /* The tooltip is a PROMPT, not a proof. It was four lines
                   explaining monotonic view counts, which is the reason the
                   badge is trustworthy and not the reason anyone cares. What
                   a team needs at this moment is the next move. The
                   arithmetic is in videoMomentum for whoever has to defend
                   the number.

                   The next move is not the same for the two formats, which
                   is why this reads the grid's format rather than printing
                   one line everywhere:

                     LONG-FORM  is the destination. A release this far ahead
                                should not be sitting there with one asset
                                against it — so the prompt is about building
                                more ways in. "Discovery assets" rather than
                                "support assets" on purpose: support sounds
                                like housekeeping for a record that is already
                                found, and the job of a lyric video, a
                                visualiser or a live cut is to be another
                                surface people arrive through.
                     SHORT      is a discovery surface, and a Short that
                                travels is only worth the reach if it routes
                                anybody back to the music. So the prompt is
                                whether the loop is actually closed. */
                title={`Ahead of ${
                  v.aheadOf.passed === v.aheadOf.of
                    ? format === 'short' ? 'every Short' : 'every release'
                    : `${v.aheadOf.passed} of the ${v.aheadOf.of} ${format === 'short' ? 'Shorts' : 'releases'}`
                } before it. ${
                  format === 'short'
                    ? 'Is the track tagged and linked, so this sends people to the music?'
                    : 'Has it got more discovery assets around it — lyric, visualiser, live cut?'
                }`}
              >
                Hot asset
              </span>
            )}
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
