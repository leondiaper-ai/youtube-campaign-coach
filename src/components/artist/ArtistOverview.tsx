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
  topLongform, topShorts, launchSlot,
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
  /* Free — commentCount is already on every cached upload. */
  const demand = commentDemand(uploads);

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
        <Eyebrow>Virgin Music Group</Eyebrow>
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
        {demand?.isLatent && (
          <div
            className="mt-7 rounded-lg px-4 py-3"
            style={{ background: 'rgba(12,106,63,0.06)', border: '1px solid rgba(12,106,63,0.18)' }}
          >
            {/* "2.4x the roster's comment rate" asks the reader to hold
                two abstractions — what a roster is, and what a comment
                rate is — before the sentence means anything. "Our average
                channel" is the same fact with nothing to decode, and the
                multiple reads instantly against it. */}
            <div className="text-[13px] font-bold text-ink leading-snug">
              The audience is still here
              <span className="font-normal text-ink/60">
                {' '}— they comment {demand.vsRoster.toFixed(1)}× more than on our average channel
                {demand.uploads90 === 0
                  ? ', and nothing has been posted in 90 days'
                  : `, on just ${demand.uploads90} upload${demand.uploads90 === 1 ? '' : 's'} in 90 days`}
              </span>
            </div>
            <div className="text-[11px] text-ink/45 mt-1 tabular-nums">
              {fmtNum(demand.comments)} comments · {demand.perThousand.toFixed(2)} comments per 1,000 views
              <span className="text-ink/35">, against {ROSTER_COMMENTS_PER_1K} on an average channel</span>
            </div>
            {/* The finding is only half of it. A card that says an audience
                is waiting and then stops is an observation; the reason to
                surface this at all is that somebody should go and post.

                Two moves, because they are different jobs: something new to
                watch, and a reply to the people already there. The second
                costs nothing and is the one that gets skipped. */}
            <div className="text-[12px] font-semibold mt-2.5 leading-snug" style={{ color: GAIN }}>
              Worth feeding — put something up, and reply to the people already talking.
            </div>
          </div>
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

        {/* ── BEST ASSET AFTER THE VIDEO ───────────────────────────
            Condensed to a glance. The full version carried its own
            headline sentence, upload counts, median ages and a
            four-line caption; all of that is still true and almost
            none of it was being read. What survives is the ranking,
            the number, and the one comparison that makes the number
            mean anything — this channel against the roster. The rest
            moved into the row's own tooltip. */}
        <div>
            <Eyebrow>Best asset after the video</Eyebrow>
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
            {perf.bestSupport && (
              <div className="text-[13px] text-ink mt-2.5 leading-snug">
                <strong>{FORMAT_PLURAL[perf.bestSupport.type] ?? `${perf.bestSupport.label}s`}</strong>
                {perf.bestSupport.vsHero != null && (
                  <span className="text-ink/55">
                    {' '}— {Math.round(perf.bestSupport.vsHero * 100)}% of an official video here
                  </span>
                )}
                {!perf.clear && perf.support.length > 1 && (
                  <span className="text-ink/40">, but close to {(FORMAT_PLURAL[perf.support[1].type] ?? `${perf.support[1].label}s`).toLowerCase()}</span>
                )}
              </div>
            )}

            <div className="mt-3 space-y-1.5">
              {perf.support.map((r) => {
                const top = perf.support[0].median || 1;
                const bench = ROSTER_SUPPORT_BENCHMARK[r.type];
                const ahead = bench && r.vsHero != null && r.vsHero >= bench.ratio;
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
                    {/* Against the roster, because this channel's own
                        number alone does not say whether it is good. */}
                    <span className="w-[92px] shrink-0 text-right tabular-nums text-ink/40">
                      {r.vsHero != null ? `${Math.round(r.vsHero * 100)}%` : '—'}
                      {bench && (
                        <span style={ahead ? { color: GAIN } : undefined}>
                          {' '}/ {Math.round(bench.ratio * 100)}%
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* ── WHERE THE NUMBERS CAME FROM, AND THEIR ONE BIAS ──────
                At 365 days the age spread within a format was small enough
                to leave in a tooltip. Read across a whole catalogue it is
                not: CHVRCHES' lyric videos have a median age of 6.5 years
                against 3.1 for their visualisers, so part of any gap is
                simply time to accumulate. Stating the span and the oldest
                format's age lets a reader discount it; hiding it on hover
                would let the ranking read as settled. */}
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

            {/* The caption that stood here explained the two percentages,
                printed the official-video median and defined the dot. Cut:
                the pair reads as "ours / theirs" without being told, and
                everything else it said is on the row it qualifies — the
                dot carries its own title, and the row tooltip has the
                upload count, the median age and the age-bias caveat. */}
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
