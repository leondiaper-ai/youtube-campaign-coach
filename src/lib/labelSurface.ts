/* ═══════════════════════════════════════════════════════════════════════
   A SECOND PUBLISHING SURFACE, SERVER-SIDE

   Some campaigns do not run entirely on the artist's own channel. Palaye
   Royale is the case: the official videos go out on Sumerian Records, so
   anything reading only the artist channel is missing the hero.

   ── WHY THIS EXISTS WHEN public/live/second-surface.js ALREADY DID IT ──
   That file merges in the BROWSER, after /api/campaign-cover has already
   chosen the hero and written the read. So the merge could add the asset
   to the strip and never promote it: on 11 Oct the Palaye page led on a
   28 September Short and said "Lost In Translation out 2 October, with no
   video on the channel yet" — two days after the official video landed on
   Sumerian and appeared in that very strip.

   It could not have fixed itself either. Its own "THE SERVER'S LEAD WINS"
   rule exists for a good reason — it has thumbnails and dates, not the
   campaign plan, so it cannot tell a release from a Tuesday — and that
   rule is exactly what pinned the Short in place.

   The decision and the evidence have to be in the same place. That place
   is the API, which is what second-surface.js itself names as the right
   long-term home. This is that move.

   ── WHAT IT WILL NOT DO ───────────────────────────────────────────────
   It never brings the label's own performance across. Sumerian has
   thousands of uploads and almost none are Palaye; pulling a label's
   channel totals into an artist's campaign would be the most misleading
   thing this layer could do.

   Only uploads whose TITLE contains the artist's full name are merged —
   the same `matched` bar /api/label-watch uses. Description-only and
   partial-name hits are `flagged` there for a human to confirm, and they
   do not cross this line.
   ═══════════════════════════════════════════════════════════════════════ */

import { readLiveSnapByHandle } from './kvCache';
import type { RecentUpload } from './artists';

type Surface = { label: string; artist: string; sourceName: string };

/**
 * Keyed by the slug /api/campaign-cover knows. An artist absent from here
 * does none of this — CHVRCHES and Kings of Leon never enter the function.
 *
 * Kept in step with SURFACES in public/live/second-surface.js by hand.
 * Two copies is one too many; the client file becomes redundant once
 * every surface reads the merged payload, and should be deleted then.
 */
const SURFACES: Record<string, Surface> = {
  palayeroyale: {
    label: '@sumerianrecords',
    artist: 'Palaye Royale',
    sourceName: 'Sumerian Records',
  },
};

export const hasLabelSurface = (slug: string): boolean => !!SURFACES[slug];

export const labelSourceName = (slug: string): string | null =>
  SURFACES[slug]?.sourceName ?? null;

/** Lowercase, collapse whitespace, strip punctuation that varies. */
const norm = (s: string) =>
  (s ?? '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

export interface LabelUpload extends RecentUpload {
  /** The channel it was published on, for attribution on the card. */
  source: string;
}

/**
 * The label's uploads that are confidently this artist's, published on or
 * after `startAt`.
 *
 * Reads the label channel's cached snap — the same KV the rest of the
 * board reads — so this costs no YouTube quota and cannot fail the page
 * by being slow upstream. A label with no cached snap yields nothing,
 * which leaves the campaign showing the artist channel alone: true, just
 * not complete.
 */
export async function labelSurfaceUploads(
  slug: string,
  startAt: Date | null,
): Promise<LabelUpload[]> {
  const cfg = SURFACES[slug];
  if (!cfg) return [];

  let snap: Awaited<ReturnType<typeof readLiveSnapByHandle>> = null;
  try {
    snap = await readLiveSnapByHandle(cfg.label);
  } catch {
    return [];
  }
  const uploads = snap?.recentUploads ?? [];
  if (!uploads.length) return [];

  const full = norm(cfg.artist);
  const out: LabelUpload[] = [];
  for (const u of uploads) {
    if (!u?.id || !u.publishedAt) continue;
    /* TITLE only. See the header: description matches are `flagged`, not
       `matched`, and a flagged asset must never reach a page unconfirmed. */
    if (!norm(u.title ?? '').includes(full)) continue;
    const at = new Date(u.publishedAt);
    if (!Number.isFinite(at.getTime())) continue;
    if (startAt && at < startAt) continue;
    out.push({ ...u, source: cfg.sourceName });
  }
  return out;
}
