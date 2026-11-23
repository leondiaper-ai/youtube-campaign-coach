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

import { formatPerformance, ROSTER_SUPPORT_BENCHMARK, FORMAT_LABEL, FORMAT_PLURAL, PROVISIONAL_AT } from '@/lib/formatPerformance';
import { readCatalogue, catalogueAsUploads } from '@/lib/catalogueStore';
import { commentDemand, ROSTER_COMMENTS_PER_1K } from '@/lib/commentDemand';
import WeeklyVideoFocus from './WeeklyVideoFocus';
import {
  fmtNum, daysSince, STATUS_COLOR,
  type ChannelState, type RecentUpload, type Artist,
} from '@/lib/artists';
import { resolveRowFormatSplit } from '@/lib/formatSplit';
import { readFormatDays } from '@/lib/formatHistory';
import { classifyUploadFormat } from '@/lib/formatClassifier';
import type { RankedGrid } from '@/lib/videoMomentum';
import FormatBlock from './FormatBlock';
import ArtistMarkets from './ArtistMarkets';
import AudienceLine from './AudienceLine';
import { Eyebrow, Metric, VideoGrid, INK, RULE, GAIN, LOSS } from './primitives';

/* Same two colours the format block uses, so a reader moving down the
   page maps blue to long-form and amber to Shorts without relearning. */
const LF_BLUE = '#2C6BFF';
const SH_AMBER = '#C77A16';

/** A share, keeping one decimal where rounding would erase the number. */
function sharePct(x: number): string {
  if (x <= 0) return '0%';
  if (x < 0.01) return '<1%';
  if (x < 0.1) return `${(x * 100).toFixed(1)}%`;
  return `${Math.round(x * 100)}%`;
}


export interface ArtistOverviewProps {
  workspaceName?: string;
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
  /** Kept in the contract for callers and future use, not rendered here —
   *  the action bar owns showing the pin state. */
  pinned: boolean;
  /**
   * Ranked grids, computed by the caller.
   *
   * They are NOT computed here because the same ranking decides which video
   * the "next action" names. Computing it in two places is how a page ends
   * up recommending one video while the grid beneath it shows another
   * leading — which is exactly the bug this arrangement removes.
   */
  topLongform: RankedGrid;
  /* The launch module, injected rather than imported. It needs upload
     history and deltas this component does not take, and it belongs
     directly above the performing grids — the newest asset is the
     thing a reader asks about first, and it was sitting four sections
     below them. */
  launchSlot?: React.ReactNode;
  topShorts: RankedGrid;
}

export default async function ArtistOverview({
  slug, artist, snap, nc, derived, status, uploads, subs7, views7, moves: _moves, pinned: _pinned,
  topLongform, topShorts, launchSlot, workspaceName = 'Virgin Music Group',
}: ArtistOverviewProps) {
  const days = snap?.channelId ? await readFormatDays(snap.channelId) : [];
  const split = resolveRowFormatSplit(uploads, days, snap?.views ?? null);

  /* Which format earns its cost ON THIS CHANNEL. Every page here tells a
     team to build more formats around a release; this is the only thing
     that says which one to build. Computed from the uploads already
     loaded — no extra call. */
  /* ── CATALOGUE FIRST, CACHE AS FALLBACK ────────────────────────────
     The cached window is ~100 recent uploads inside 365 days, which for a
     heritage channel is nothing. CHVRCHES has 324M lifetime views and that
     window returned NO readable format — so the panel fell back to roster
     norms ranking visualiser first, when their own catalogue says lyric
     video by a wide margin (median 1.68M across 12, against 100K across 3
     visualisers). The fallback was not merely silent, it was backwards.

     When a stored catalogue exists the window opens to the whole channel,
     because a format's history is the point. Age bias is NOT corrected —
     see the note rendered under the bars. */
  const catalogue = await readCatalogue(slug).catch(() => null);
  const perfUploads = catalogue?.videos.length ? catalogueAsUploads(catalogue) : uploads;
  const perf = formatPerformance(perfUploads, catalogue?.videos.length ? 36_500 : 365);
  const leadingFormat = perf.bestSupport ? (FORMAT_PLURAL[perf.bestSupport.type] ?? perf.bestSupport.label) : null;
  const closeAlternative = !perf.clear && perf.support.length > 1
    ? (FORMAT_PLURAL[perf.support[1].type] ?? perf.support[1].label).toLowerCase() : null;
  /* Free — commentCount is already on every cached upload. */
  const demand = commentDemand(uploads);
  // Show the actual videos behind the comment signal, not a generic channel link.
  const discussionVideos = uploads
    .filter(u => u.id && typeof u.commentCount === 'number' && u.commentCount > 0)
    .sort((a, b) => (b.commentCount ?? 0) - (a.commentCount ?? 0))
    .slice(0, 3);

  const shorts = uploads.filter(u => classifyUploadFormat(u) === 'short');
  const longform = uploads.filter(u => classifyUploadFormat(u) !== 'short');

  const lastUpDays = snap?.lastUploadAt ? daysSince(snap.lastUploadAt) : null;

  /* STATUS_COLOR carries three values per state: a dot for the marker, a
     darker fg that stays legible as text on paper, and a bg. Using the
     dot colour for text would fail contrast on the lighter states. */
  const statusTheme = STATUS_COLOR[status] ?? { bg: RULE, fg: INK, dot: INK };

  return (
    <>
      {/* ═══ 1. WHO, AND IS IT HEALTHY ═══════════════════════════ */}
      <header>
        {/* No "Tracked project" badge and no second Watcher mark here: the
            action bar directly above already carries both, and on the live
            page they read as a stutter rather than as emphasis. */}
        <Eyebrow>{workspaceName}</Eyebrow>
        <h1
          className="font-black tracking-[-0.045em] leading-[0.9] mt-4"
          style={{ fontSize: 'clamp(2.8rem,8vw,6rem)' }}
        >
          {artist.name}
        </h1>
        {(() => {
          const raw = artist.channelHandle?.trim();
          const id = snap?.channelId && /^UC[A-Za-z0-9_-]{22}$/.test(snap.channelId) ? snap.channelId : null;
          const handle = raw?.startsWith('@') ? raw : null;
          const url = id
            ? `https://www.youtube.com/channel/${id}`
            : handle && /^@[A-Za-z0-9._-]+$/.test(handle)
              ? `https://www.youtube.com/${handle}`
              : raw && /^UC[A-Za-z0-9_-]{22}$/.test(raw)
                ? `https://www.youtube.com/channel/${raw}`
                : null;
          if (!url) return null;
          return <div className="flex flex-wrap items-center gap-3 mt-4 text-[13px]">
            {handle && <span className="font-semibold text-ink/65">{handle}</span>}
            {!handle && id && <span className="font-mono text-[11px] text-ink/55">{id}</span>}
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-bold underline underline-offset-4 text-[#2458CC] hover:text-[#163c93]">
              View YouTube channel <span aria-hidden="true">↗</span>
            </a>
          </div>;
        })()}
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

      {/* Weekly intelligence: compact explanation on the destination artist page.
          Only name a video when the grid has measured recent movement. */}
      {(() => {
        const reliable = nc.movementConfidence !== 'stale' && nc.movementConfidence !== 'limited';
        if (!reliable) return null;
        const noUploads = nc.cadence.uploads30d === 0;
        const leader = [...topLongform.items, ...topShorts.items]
          .filter(v => v.recentGain != null && v.recentGain > 0 && v.spanDays != null && v.spanDays >= 5 && v.spanDays <= 9)
          .sort((a, b) => (b.recentGain ?? 0) - (a.recentGain ?? 0))[0];
        const strongViews = views7 != null && views7 >= 10000;
        const growth = subs7 != null && subs7 >= 100;
        const quietDemand = noUploads && strongViews;
        const flatSubs = strongViews && subs7 != null && subs7 <= 0;
        if (!quietDemand && !growth && !flatSubs) return null;
        const isCatalogue = quietDemand && leader && Date.now() - Date.parse(leader.publishedAt) > 365 * 86400000;
        const newer = isCatalogue
          ? uploads.filter(u => Date.parse(u.publishedAt) > Date.parse(leader.publishedAt) && Date.now() - Date.parse(u.publishedAt) < 365 * 86400000)
          : [];
        const leadText = leader
          ? `“${leader.title}” added ${fmtNum(leader.recentGain ?? 0)} views over ${leader.spanDays} days.`
          : 'We do not yet have enough comparable video history to identify the track responsible.';
        const headline = quietDemand ? 'Audience active, channel quiet' : flatSubs ? 'Views growing, subscribers flat' : 'Subscriber growth picking up';
        const context = quietDemand
          ? `${fmtNum(views7 ?? 0)} views added in seven days with no uploads in 30 days. ${leadText}`
          : flatSubs
            ? `${fmtNum(views7 ?? 0)} views in seven days without subscriber growth. ${leadText}`
            : `+${fmtNum(subs7 ?? 0)} subscribers in seven days. ${leadText}`;
        const action = isCatalogue && newer.length
          ? 'An older video is attracting attention while newer uploads exist. Where you control the video, connect viewers to the newer music through playlists, descriptions or end screens.'
          : quietDemand
            ? 'Use the current viewing activity to plan a relevant follow-up. Check rights and ownership before changing catalogue video links.'
            : flatSubs
              ? 'Connect the most-viewed content to the wider channel and a relevant next watch, where you have editing access.'
              : 'Keep the release active with a relevant follow-up. Use the strongest recent video and its existing supporting formats to choose the next asset.';
        // Keep the artist explanation visually consistent with the weekly
        // finding that led here: blue = quiet catalogue demand, amber = views
        // without subscriber growth, green = subscriber growth.
        const theme = quietDemand && (views7 ?? 0) >= 50000
          ? { fg: '#315D9D', bg: 'rgba(72,127,202,0.07)', border: 'rgba(72,127,202,0.23)' }
          : flatSubs
            ? { fg: '#985319', bg: 'rgba(233,154,59,0.07)', border: 'rgba(233,154,59,0.24)' }
            : growth
              ? { fg: '#0C6A3F', bg: 'rgba(31,190,122,0.06)', border: 'rgba(31,190,122,0.22)' }
              : { fg: '#985319', bg: 'rgba(233,154,59,0.07)', border: 'rgba(233,154,59,0.24)' };
        return (
          <div className="mt-7 rounded-lg px-4 py-3" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
            <div className="text-[13px] font-bold" style={{ color: theme.fg }}>{headline}</div>
            <div className="text-[12px] text-ink/65 mt-1 leading-relaxed">{context}</div>
            <div className="text-[12px] font-semibold mt-2 leading-relaxed" style={{ color: theme.fg }}>Worth a look: {action}</div>
          </div>
        );
      })()}

      {/* ═══ NEXT ACTION — removed for now ══════════════════════
          The "Next action" / "Then" block used to sit here, printing
          whatToDoNow's primary and secondary moves.

          It is the rendering that has gone, not the engine: `moves` is
          still computed in WatcherArtistView and still passed in below,
          and it still feeds the channel report. Restoring the section is
          re-adding this markup, not rebuilding anything.

          Worth knowing before it comes back: the moves come from a rule
          cascade, so the phrasing is fixed and repeats across the roster
          — "Activate the collab network" reads the same on every artist
          that has a feature. The figures inside it are real (the top
          mover is now the same video the grid ranks first), but the
          sentences around them are templates. ══════════════════════ */}

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
        {/* ─── LIFETIME SPLIT ──────────────────────────────────────
            Sits with the headline numbers because it answers the same
            question they do — what has this channel earned, all time —
            and the row above already establishes that register with
            "Channel views · Lifetime total".

            It reads from split.lifetime rather than the top-level shares,
            which are the RECENT figures once a channel has a recent
            basis. Kept visually subordinate (half-strength bar, small
            type) so it cannot be mistaken for this week's behaviour, and
            the coverage caveat sits in amber directly beneath the
            percentages rather than a tooltip away: a split measured over
            part of the catalogue is not a fact about the channel. */}
        {/* ── THE AUDIENCE HAS NOT LEFT ──────────────────────────────
            Only prints when the channel is quiet AND the comment rate is
            well above the roster norm, because that combination is the
            argument: this looks finished and is not. On a busy channel
            the same number is just a number, so it stays off.

            Says "talked about", never "positive". A comment count cannot
            tell praise from a pile-on — that needs the text, which is
            what the per-artist comment scan is for. */}
        <div id="channel-momentum"><WeeklyVideoFocus uploads={uploads} /></div>
        {demand?.isLatent && (
          <section
            className="mt-7 overflow-hidden rounded-xl border"
            style={{ background: 'rgba(12,106,63,0.035)', borderColor: 'rgba(12,106,63,0.18)' }}
            aria-label="Audience activity opportunity"
          >
            <div className="px-5 py-5 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.13em]" style={{ color: GAIN }}>
                    Audience opportunity
                  </div>
                  <h3 className="mt-1.5 text-[19px] sm:text-[21px] font-extrabold tracking-tight text-ink">
                    The audience is still here
                  </h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink/65">
                    {demand.vsRoster.toFixed(1)}× the average comment rate
                    {demand.uploads90 === 0
                      ? ' despite no uploads in 90 days.'
                      : ` with just ${demand.uploads90} upload${demand.uploads90 === 1 ? '' : 's'} in 90 days.`}
                  </p>
                </div>
                <div className="shrink-0 rounded-lg bg-white/75 border px-3 py-2 text-right tabular-nums" style={{ borderColor: 'rgba(12,106,63,0.14)' }}>
                  <div className="text-[22px] leading-none font-black" style={{ color: GAIN }}>{demand.vsRoster.toFixed(1)}×</div>
                  <div className="mt-1 text-[10px] font-semibold text-ink/50">comment rate vs average</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink/50 tabular-nums">
                <span><strong className="text-ink/75">{fmtNum(demand.comments)}</strong> comments</span>
                <span><strong className="text-ink/75">{demand.perThousand.toFixed(2)}</strong> per 1,000 views</span>
                <span>Channel average: {ROSTER_COMMENTS_PER_1K} per 1,000 views</span>
              </div>
              <div className="mt-4 rounded-md bg-white/60 px-3.5 py-3 border-l-[3px]" style={{ borderLeftColor: GAIN }}>
                <span className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: GAIN }}>Next step</span>
                <p className="mt-0.5 text-[13px] font-semibold text-ink/85">Post something new and respond to existing comments.</p>
              </div>
            </div>
            {discussionVideos.length > 0 && (
              <div className="border-t px-5 py-4 sm:px-6" style={{ borderColor: 'rgba(12,106,63,0.14)', background: 'rgba(255,255,255,0.4)' }}>
                <div className="text-[11px] font-bold text-ink/60 mb-2.5">Most commented videos</div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {discussionVideos.map(u => (
                    <a key={u.id} href={`https://www.youtube.com/watch?v=${encodeURIComponent(u.id)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="group min-w-0 rounded-lg border border-black/10 bg-white/70 px-3 py-2.5 no-underline hover:border-black/25 hover:bg-white transition-colors"
                      title={u.title}>
                      <span className="block text-[12px] font-semibold text-ink/85 leading-snug line-clamp-2 group-hover:underline">{u.title}</span>
                      <span className="mt-1.5 block text-[11px] font-semibold tabular-nums" style={{ color: GAIN }}>{fmtNum(u.commentCount ?? 0)} comments ↗</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Lifetime split and the format read share a row. The split was
            a 340px block with the rest of the width empty beside it, and
            the format read was a full-width section further down that
            said the same KIND of thing — what this channel's output is
            made of, and which part of it works. Together they are one
            glance instead of two. */}
        <div className="mt-8 grid gap-10 lg:grid-cols-[340px_1fr] items-start">
        {split?.lifetime && (
          <div>
            <Eyebrow>Lifetime split</Eyebrow>
            <div
              className="flex h-[8px] w-full overflow-hidden rounded-sm mt-2.5"
              style={{ background: RULE }}
            >
              <div style={{ width: `${split.lifetime.longformShare * 100}%`, background: LF_BLUE, opacity: 0.55 }} />
              <div style={{ width: `${split.lifetime.shortsShare * 100}%`, background: SH_AMBER, opacity: 0.75 }} />
            </div>
            <div className="text-[13px] text-ink/70 mt-2 tabular-nums">
              {sharePct(split.lifetime.longformShare)} long-form ·{' '}
              {sharePct(split.lifetime.shortsShare)} Shorts
            </div>
            {/* The coverage caveat ("Of 62% of views we hold — not the
                channel") used to print here. It is still true and still
                matters, but on a headline row it read as a disclaimer
                attached to every artist rather than as information. It
                remains one click away under Lifetime detail in the format
                block, where a reader who cares about the denominator is
                already looking. */}
          </div>
        )}

        {/* Show which supporting formats have performed best on this channel. */}
        <div>
            <Eyebrow>What works on this channel</Eyebrow>
            {/* ── NOTHING READABLE YET ──────────────────────────────
                The section still prints. The question it answers —
                what should we make after the video — does not stop
                being worth answering because this channel has not made
                enough yet to answer it from its own history. So the
                roster figures stand in, which is what a team has to aim
                at until the channel has its own number. */}
            {/* ── THE CHANNEL'S OWN FORMATS ──────────────────────────
                Shown before falling back to the roster, because this is
                the channel's real answer. Peter Gabriel publishes no
                lyric videos, visualisers or BTS at all — he publishes
                every song twice, as a Bright-Side and a Dark-Side mix.
                Blank read as "we cannot tell"; this says what he does. */}
            {perf.support.length === 0 && perf.variants.length > 0 && (
              <>
                <div className="text-[13px] text-ink mt-2.5 leading-snug">
                  <strong>{perf.variants[0].label}</strong>
                  <span className="text-ink/55">
                    {' '}— {(perf.variants[0].median / (perf.variants[1].median || 1)).toFixed(1)}× the{' '}
                    {perf.variants[1].label}
                  </span>
                </div>
                <div className="mt-3 space-y-1.5">
                  {perf.variants.map((v, i) => (
                    <div key={v.label} className="flex items-center gap-2 text-[11px] whitespace-nowrap">
                      <span className="w-[108px] shrink-0 text-ink/70 truncate" title={v.label}>{v.label}</span>
                      <span className="flex-1 h-[6px] rounded-sm overflow-hidden" style={{ background: RULE }}>
                        <span
                          className="block h-full"
                          style={{ width: `${Math.max((v.median / perf.variants[0].median) * 100, 3)}%`, background: i === 0 ? GAIN : '#B8B0A2' }}
                        />
                      </span>
                      <span className="w-[46px] shrink-0 text-right tabular-nums font-bold text-ink">
                        {fmtNum(v.median)}
                      </span>
                      <span className="w-[34px] shrink-0 text-right tabular-nums text-ink/35">
                        n{v.count}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-ink/35 mt-2.5 leading-relaxed">
                  This channel&rsquo;s own formats. No lyric videos, visualisers or
                  BTS to compare.
                </div>
              </>
            )}
            {perf.support.length === 0 && perf.variants.length === 0 && (
              <>
                <div className="text-[13px] text-ink/70 mt-2.5 leading-snug">
                  {catalogue?.videos.length
                    ? <>No lyric videos, visualisers, live or BTS uploads found across all {catalogue.retrieved} uploads on this channel.</>
                    : <>Not enough support assets here yet to read this channel&rsquo;s own &mdash; only the recent upload window has been read. Collect the full catalogue to answer this properly.</>}
                </div>
                <div className="mt-3 space-y-1.5">
                  {(['VISUALIZER', 'LIVE', 'LYRIC_VIDEO', 'BTS'] as const).map((t) => {
                    const b = ROSTER_SUPPORT_BENCHMARK[t];
                    return (
                      <div key={t} className="flex items-center gap-2 text-[11px] whitespace-nowrap">
                        <span className="w-[76px] shrink-0 text-ink/70">{FORMAT_LABEL[t]}</span>
                        <span className="flex-1 h-[6px] rounded-sm overflow-hidden" style={{ background: RULE }}>
                          <span className="block h-full" style={{ width: `${(b.ratio / 0.4) * 100}%`, background: '#B8B0A2' }} />
                        </span>
                        <span className="w-[92px] shrink-0 text-right tabular-nums text-ink/45">
                          {Math.round(b.ratio * 100)}% of video
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="text-[10px] text-ink/35 mt-2.5 leading-relaxed">
                  What each format typically reaches across the roster, as a share of
                  the official video on the same channel. Aim here until this channel
                  has its own history.
                </div>
              </>
            )}
            {perf.support.length > 0 && (
              <>
            {perf.bestSupport && leadingFormat && (
              <div className="mt-2.5">
                <div className="text-[15px] font-bold text-ink leading-snug">
                  {leadingFormat}{closeAlternative ? ` and ${closeAlternative} lead` : perf.bestSupport.type === 'BTS' ? ' leads' : ' lead'}
                </div>
                <p className="mt-1.5 text-[12px] text-ink/55 leading-relaxed">
                  Supporting assets ranked by median views per upload.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 text-[9px] text-ink/40 mt-3 mb-1 uppercase tracking-wide">
              <span className="w-[46px] text-right">Median views</span>
            </div>
            <div className="mt-3 space-y-1.5">
              {perf.support.map((r) => {
                const top = perf.support[0].median || 1;
                return (
                  <div
                    key={r.type}
                    className="flex items-center gap-2 text-[11px] whitespace-nowrap"
                    title={`${r.count} upload${r.count === 1 ? '' : 's'}, median age ${r.medianAgeDays} days. Median views per upload, so one hit does not carry a format. Views accumulate, so an older format has had longer to gather them.`}
                  >
                    <span className="w-[76px] shrink-0 text-ink/70">
                      {r.label}
                      {r.count <= PROVISIONAL_AT && (
                        <span
                          className="text-ink/30"
                          title={`Only ${r.count} uploads — indicative, not settled.`}
                        > ·</span>
                      )}
                    </span>
                    <span className="flex-1 h-[6px] rounded-sm overflow-hidden" style={{ background: RULE }}>
                      <span
                        className="block h-full"
                        style={{ width: `${Math.max((r.median / top) * 100, 3)}%`, background: r === perf.support[0] ? GAIN : '#B8B0A2' }}
                      />
                    </span>
                    <span className="w-[46px] shrink-0 text-right tabular-nums font-bold text-ink">
                      {fmtNum(r.median)}
                    </span>
                  </div>
                );
              })}
            </div>

            <details className="mt-2.5 text-[10px] text-ink/40 leading-relaxed">
              <summary className="cursor-pointer hover:text-ink/65">About these figures</summary>
            {catalogue?.videos.length ? (
              <div className="text-[10px] text-ink/35 mt-2.5 leading-relaxed">
                Across all {catalogue.retrieved} uploads
                {catalogue.oldest ? `, back to ${catalogue.oldest.slice(0, 7)}` : ''}.
                Median views per upload, so one hit does not carry a format.
                Views accumulate, so an older format has had longer to gather them
                {perf.support.length > 0
                  ? ` — ${FORMAT_PLURAL[perf.support[0].type] ?? perf.support[0].label} here have a median age of ${Math.round(perf.support[0].medianAgeDays / 30.44)} months.`
                  : '.'}
              </div>
            ) : (
              <div className="text-[10px] text-ink/35 mt-2.5 leading-relaxed">
                From the recent upload window only, not the full catalogue.
              </div>
            )}

            </details>
              </>
            )}
          </div>
        </div>

        {/* The movement-provenance line ("7-day movement figures are
            stale — from the last successful sync, not a live read") used
            to sit here. Removed: it printed on essentially every artist,
            so it stopped reading as a caveat about these numbers and
            started reading as boilerplate under the headline row.

            The underlying fields are untouched — nc.movementConfidence
            and nc.movementFreshness — so a surface that needs to flag a
            genuinely old sync can still do it. If that matters, the
            honest version is conditional: say something only when the
            reading is old enough to change a decision, rather than on
            every render. */}
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

      {/* ═══ 6. THE NEWEST ASSET ════════════════════════════════ */}
      {launchSlot && (
        <section className="mt-14 pt-8" style={{ borderTop: `1px solid ${RULE}` }}>
          {launchSlot}
        </section>
      )}

      {/* ═══ 7. WHAT IS PERFORMING ══════════════════════════════ */}
      <section className={launchSlot ? 'mt-12' : 'mt-14 pt-8'}
        style={launchSlot ? undefined : { borderTop: `1px solid ${RULE}` }}>
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
            format="short"
            emptyNote="No Shorts in our cached inventory — none published, or none within the uploads we hold."
          />
        </div>
      </section>
    </>
  );
}
