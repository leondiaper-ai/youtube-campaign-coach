/* ═══════════════════════════════════════════════════════════════════════
   QUIET CHANNEL, NOISY AUDIENCE

   A channel can be COLD on this board — nothing posted, momentum falling —
   while its audience is still turning up to talk. Underworld has not
   uploaded in 90 days and carries 5,897 comments at 2.7x the roster's
   comment rate. That is not a dead channel. It is an audience waiting,
   and it is the strongest argument this system can make for feeding a
   channel that currently looks finished.

   ── WHY THIS IS FREE ──────────────────────────────────────────────────
   Every cached upload already carries commentCount. No YouTube call, no
   quota, no cron change. The expensive thing is the comment TEXT, which
   is what /api/comment-scan fetches by hand at roughly a unit per video —
   so this measures how much the audience is talking, never what they say.

   ── WHAT IT IS NOT ────────────────────────────────────────────────────
   NOT SENTIMENT. A comment count cannot tell praise from a pile-on. The
   wording this feeds must stay at "still being talked about" and never
   drift to "positive", which is a claim only reading the comments can
   support. The per-artist comment scan is where that question belongs.

   NOT A VIEW SIGNAL. Comments per thousand views is deliberately a RATE,
   so a big catalogue cannot win it by being big. A channel with ten
   million views and nobody typing scores lower than a small one with a
   talkative audience — which is the whole point.
   ═══════════════════════════════════════════════════════════════════════ */

import type { RecentUpload } from './artists';

export interface CommentDemand {
  /** Comments per 1,000 views across the cached uploads. */
  perThousand: number;
  /** Total comments the rate is drawn from. */
  comments: number;
  /** Uploads in the last 90 days. Low is the point. */
  uploads90: number;
  /** perThousand ÷ the roster norm. 2.7 means "2.7x how much we normally get". */
  vsRoster: number;
  /** Quiet channel AND an above-norm rate: the finding this file exists for. */
  isLatent: boolean;
}

/**
 * The roster's comment rate, measured 11 Oct 2026 across 74 channels with a
 * cached upload history and more than 5,000 views.
 *
 * Baked rather than computed per request so the artist page and the board
 * quote the SAME number. The board could compute it live from the snaps it
 * already holds, and that would be marginally more current and immediately
 * inconsistent with every artist page — two true numbers for one thing read
 * as one broken one. Recompute here when the roster has moved.
 */
export const ROSTER_COMMENTS_PER_1K = 0.65;

/** Below this, the rate is a rounding artefact rather than a reading. */
const MIN_VIEWS = 5_000;

/** At or under this many uploads in 90 days, the channel counts as quiet. */
const QUIET_UPLOADS_90 = 2;

/**
 * How far above the roster norm counts as "still being talked about".
 *
 * 1.5x, not 1.0x. Half the roster sits above the median by definition, and
 * a card that fires on half the roster is a list, not a finding. At 1.5x it
 * caught 9 of 33 quiet channels in the sample.
 */
const LATENT_MULTIPLE = 1.5;

export function commentDemand(uploads: RecentUpload[]): CommentDemand | null {
  if (!uploads?.length) return null;

  let views = 0;
  let comments = 0;
  let hasAny = false;
  const cutoff = Date.now() - 90 * 86_400_000;
  let uploads90 = 0;

  for (const u of uploads) {
    const v = u.viewCount ?? 0;
    const c = u.commentCount;
    if (v > 0) views += v;
    /* A null commentCount is a gap in what we hold, not a video nobody
       commented on. Counting it as zero would quietly depress the rate of
       exactly the channels whose cache is thin. */
    if (typeof c === 'number') { comments += c; hasAny = true; }
    const ts = new Date(u.publishedAt).getTime();
    if (Number.isFinite(ts) && ts >= cutoff) uploads90 += 1;
  }

  if (!hasAny || views < MIN_VIEWS) return null;

  const perThousand = (comments / views) * 1000;
  const vsRoster = perThousand / ROSTER_COMMENTS_PER_1K;

  return {
    perThousand,
    comments,
    uploads90,
    vsRoster,
    isLatent: uploads90 <= QUIET_UPLOADS_90 && vsRoster >= LATENT_MULTIPLE,
  };
}
