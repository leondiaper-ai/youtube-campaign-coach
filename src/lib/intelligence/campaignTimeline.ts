/**
 * THE CAMPAIGN TIMELINE — five moments, not a schedule
 *
 * The Coach holds a full campaign plan: five dated releases running from
 * September to January, each with suggested support assets and a Shorts
 * allocation. All of that is real and none of it belongs on the deck's
 * opening page, because a page that lists every planned release is a release
 * calendar and the Coach is already a better one.
 *
 * What this returns instead is the smallest set of moments that answers one
 * question — where is this campaign, and what happens next:
 *
 *   WHAT JUST HAPPENED  →  YOU ARE HERE  →  WHAT'S NEXT
 *
 * ── THE SELECTION RULES, AND WHY THEY ARE RULES ───────────────────────
 * Editorial judgement that lives in a person's head has to be reapplied
 * every time the campaign moves. These rules reapply themselves:
 *
 *   PAST     the two most recent uploads since the Deep Dive, in publish
 *            order. Chronological, NOT ranked — a timeline that reorders
 *            itself by view count is not a timeline.
 *   NOW      always present. It is the only thing on the page that says
 *            where we are rather than what exists.
 *   NEXT     the nearest major moment from the Coach plan. One, not three.
 *   WINDOW   the Deep Dive's +7-14 day follow-up, positioned against NEXT.
 *            Shown as RECOMMENDED unless the Coach already has a long-form
 *            asset planned in that window, in which case the real plan wins
 *            and it is shown as what it is.
 *   ANCHOR   the album, when the plan holds one.
 *
 * Everything else — the singles between NEXT and ANCHOR — is counted in a
 * single line rather than dropped, because silently omitting three releases
 * would let someone read this page as "Roses, then the album".
 *
 * ── PROVENANCE IS NOT DECORATION ──────────────────────────────────────
 * OBSERVED  it is on the channel. The strongest thing we have.
 * CONFIRMED a person put a date against it in the Coach plan.
 * TENTATIVE planned, not locked.
 * RECOMMENDED  our strategy, which nobody has agreed to.
 *
 * A recommendation rendered the same way as a confirmed date is how a deck
 * ends up telling a label that the artist team committed to something they
 * have never seen. The UI keeps these quiet, but it never merges them.
 */

import { listMergedEvents, isMajor, isLongForm, type CampaignEvent } from '../coach-bot/horizon';
import type { Rollout } from './rollout';

export type MomentKind = 'PAST' | 'NOW' | 'NEXT' | 'WINDOW' | 'ANCHOR';
export type MomentProvenance = 'OBSERVED' | 'CONFIRMED' | 'TENTATIVE' | 'RECOMMENDED' | 'NOW';

export interface TimelineMoment {
  kind: MomentKind;
  provenance: MomentProvenance;
  /** "9 SEP", "22 SEP", "+7-14 DAYS", "TODAY". Formatting stays server-side. */
  dateLabel: string;
  /** yyyy-mm-dd where a real date exists. Null for the derived window. */
  date: string | null;
  daysAway: number | null;
  /** The strategic name — "First hero", not "Roses". */
  stage: string | null;
  title: string;
  /** One short line under the title. Never a sentence. */
  detail: string | null;
  /** Real YouTube asset, for PAST moments only. */
  asset: { videoId: string; thumb: string; url: string; formatLabel: string; aspect: string; views: number | null } | null;
}

export interface CampaignTimeline {
  moments: TimelineMoment[];
  /** "3 further singles between · Oct–Jan". One line, or null. */
  betweenNote: string | null;
  /** Why a moment is missing, when one is. Never silently absent. */
  coverage: string[];
}

const DAY = 86_400_000;

function label(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00Z' : ''));
  if (!Number.isFinite(d.getTime())) return iso;
  /* Three letters, always — en-GB gives "Sept" for the one month that would
     break the row. */
  const mon = d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }).slice(0, 3).toUpperCase();
  return `${d.getUTCDate()} ${mon}`;
}

function monthLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })
    : iso;
}

/**
 * "Roses - single release + announce tour" → "Roses".
 *
 * The Coach titles are working notes: they carry the release, the type and
 * often a second action in one string. The timeline wants the name of the
 * thing; the rest becomes the detail line.
 */
function splitTitle(raw: string): { title: string; detail: string | null } {
  const m = /^(.+?)\s*[-–—]\s*(.+)$/.exec(raw.trim());
  if (!m) return { title: raw.trim(), detail: null };
  const detail = m[2]
    .replace(/\bpre-order\/add\b/i, 'pre-order')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    title: m[1].trim(),
    detail: detail ? detail.charAt(0).toUpperCase() + detail.slice(1) : null,
  };
}

function provenanceOf(e: CampaignEvent): MomentProvenance {
  return e.status === 'CONFIRMED' ? 'CONFIRMED' : 'TENTATIVE';
}

export interface TimelineAsset {
  videoId: string;
  title: string;
  publishedAt: string;
  dateLabel: string;
  formatLabel: string;
  aspect: string;
  thumb: string;
  url: string;
  views: number | null;
}

export async function buildCampaignTimeline(
  slug: string,
  assets: TimelineAsset[],
  rollout: Rollout,
  now = Date.now(),
): Promise<CampaignTimeline> {
  const coverage: string[] = [];
  const moments: TimelineMoment[] = [];

  /* ── PAST ─────────────────────────────────────────────────────────
     Publish order, oldest first. The cover ranks assets editorially;
     a timeline must not, or the arrow of time stops meaning anything. */
  const past = [...assets]
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
    .slice(-2);

  for (const a of past) {
    moments.push({
      kind: 'PAST',
      provenance: 'OBSERVED',
      dateLabel: a.dateLabel,
      date: a.publishedAt.slice(0, 10),
      daysAway: Math.round((new Date(a.publishedAt).getTime() - now) / DAY),
      stage: null,
      title: a.title,
      detail: null,
      asset: {
        videoId: a.videoId, thumb: a.thumb, url: a.url,
        formatLabel: a.formatLabel, aspect: a.aspect, views: a.views,
      },
    });
  }
  if (!past.length) {
    coverage.push('No uploads observed since the Deep Dive — the timeline opens at today rather than at nothing.');
  }

  /* ── NOW ──────────────────────────────────────────────────────────── */
  moments.push({
    kind: 'NOW', provenance: 'NOW',
    dateLabel: 'TODAY', date: new Date(now).toISOString().slice(0, 10), daysAway: 0,
    stage: null, title: 'You are here', detail: null, asset: null,
  });

  /* ── The Coach plan ───────────────────────────────────────────────── */
  const events = await listMergedEvents(slug, now).catch(() => [] as CampaignEvent[]);
  const upcoming = events
    .filter(e => e.eventDate && new Date(e.eventDate + 'T00:00:00Z').getTime() >= now - DAY)
    .sort((a, b) => (a.eventDate ?? '').localeCompare(b.eventDate ?? ''));

  if (!upcoming.length) {
    coverage.push('No dated campaign moments are held for this artist. The forward plan is unknown to this system, not empty.');
    return { moments, betweenNote: null, coverage };
  }

  const daysTo = (iso: string) =>
    Math.round((new Date(iso + 'T00:00:00Z').getTime() - now) / DAY);

  /* ── NEXT — the nearest thing that makes other content compete ───── */
  const next = upcoming.find(e => isMajor(e.eventType)) ?? upcoming[0];
  const nextSplit = splitTitle(next.title);
  const heroStage = rollout.items.find(i => i.spineStatus === 'NEXT')?.title ?? null;

  moments.push({
    kind: 'NEXT',
    provenance: provenanceOf(next),
    dateLabel: label(next.eventDate!),
    date: next.eventDate,
    daysAway: daysTo(next.eventDate!),
    stage: heroStage,
    title: nextSplit.title,
    detail: nextSplit.detail,
    asset: null,
  });

  /* ── WINDOW — the 7-14 days after NEXT ────────────────────────────
     This is the Deep Dive's single clearest recommendation for this
     artist, and it only earns a place on the page while it is still a
     recommendation. If somebody has already planned a long-form asset
     into that window, the plan is the better information and replaces
     it — the deck should not keep advising something that is booked. */
  const winStart = new Date(next.eventDate + 'T00:00:00Z').getTime() + 7 * DAY;
  const winEnd = winStart + 7 * DAY;
  const planned = upcoming.find(e =>
    e.eventId !== next.eventId && isLongForm(e.eventType) && e.eventDate
    && new Date(e.eventDate + 'T00:00:00Z').getTime() >= winStart
    && new Date(e.eventDate + 'T00:00:00Z').getTime() <= winEnd);

  const secondDestination = rollout.items.find(i => i.title === 'Second destination');

  if (planned) {
    const s = splitTitle(planned.title);
    moments.push({
      kind: 'WINDOW', provenance: provenanceOf(planned),
      dateLabel: label(planned.eventDate!), date: planned.eventDate,
      daysAway: daysTo(planned.eventDate!),
      stage: 'Second destination', title: s.title, detail: s.detail, asset: null,
    });
  } else if (secondDestination && !['LIVE', 'COMPLETE'].includes(secondDestination.status)) {
    moments.push({
      kind: 'WINDOW', provenance: 'RECOMMENDED',
      dateLabel: '+7-14 DAYS', date: null, daysAway: null,
      stage: 'Second destination',
      /* The formats the Deep Dive named, in the Deep Dive's order. Not a
         list of everything YouTube supports. */
      title: 'Lyric · Live · Performance',
      /* The reason this is on the page at all, in six words. 0 of 4 Screen
         Violence heroes had anything land in this window. */
      detail: 'Nothing landed here last campaign',
      asset: null,
    });
  }

  /* ── ANCHOR — the album ───────────────────────────────────────────── */
  const album = upcoming.find(e => e.eventType === 'ALBUM_RELEASE');
  if (album) {
    const s = splitTitle(album.title);
    moments.push({
      kind: 'ANCHOR', provenance: provenanceOf(album),
      dateLabel: label(album.eventDate!), date: album.eventDate,
      daysAway: daysTo(album.eventDate!),
      stage: rollout.items.find(i => i.title === 'Give every song a home')?.title ?? 'Album',
      title: s.title, detail: 'Album', asset: null,
    });
  } else {
    coverage.push('No album date is held in the campaign plan.');
  }

  /* ── What we left out, stated ─────────────────────────────────────── */
  const shown = new Set(moments.map(m => m.date).filter(Boolean));
  const between = upcoming.filter(e =>
    isMajor(e.eventType) && e.eventDate && !shown.has(e.eventDate)
    && (!album || e.eventDate < album.eventDate!));

  const betweenNote = between.length
    ? `${between.length} further release${between.length === 1 ? '' : 's'} in the plan between `
      + `${monthLabel(between[0].eventDate!)} and ${monthLabel(between[between.length - 1].eventDate!)}`
    : null;

  return { moments, betweenNote, coverage };
}
