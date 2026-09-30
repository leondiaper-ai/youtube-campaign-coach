/**
 * GET /api/format-split?slug=<artist>            one artist
 * GET /api/format-split?team=uk|au|nordics       a team's roster
 *
 * Shorts vs long-form view split, from cached Watcher data only — no
 * YouTube API calls, so this is free to poll.
 *
 * READ THE COVERAGE FIELD. The split is across the videos we have
 * inventoried, not the channel. Our sync caps uploads at 100 (300 in
 * campaign), so for a large catalogue this is a sample and says so:
 * `coverage.confidence` is 'sample' and `isChannelRepresentative` is
 * false. Rendering a sample as a channel total is the specific error
 * this route is shaped to prevent.
 *
 * `channelTotalViews` is returned alongside but NEVER split — YouTube
 * publishes one lifetime number per channel with no format dimension,
 * and no amount of arithmetic recovers one.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ARTISTS, mergeArtistLists } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { readLiveSnapByHandle } from '@/lib/kvCache';
import {
  computeFormatSplitSet,
  coverageLabel,
  isChannelRepresentative,
} from '@/lib/formatSplit';
import { getTeam } from '@/lib/territories/markets';
import { readFormatDays, computeTrends } from '@/lib/formatHistory';

export const dynamic = 'force-dynamic';

async function forArtist(a: { slug: string; name: string; channelHandle?: string | null }) {
  const snap = a.channelHandle ? await readLiveSnapByHandle(a.channelHandle) : null;
  if (!snap) {
    return {
      slug: a.slug,
      name: a.name,
      available: false,
      reason: 'no-cached-channel-data',
      split: null,
    };
  }

  const uploads = snap.recentUploads ?? [];
  if (uploads.length === 0) {
    /* No inventory is not a zero split. Returning zeros here would
       render as "0% Shorts", which reads as a fact about the artist
       rather than a gap in our data. */
    return {
      slug: a.slug,
      name: a.name,
      available: false,
      reason: 'no-video-inventory',
      channelTotalViews: snap.views ?? null,
      split: null,
    };
  }

  const set = computeFormatSplitSet(uploads, {
    /* The cached snap has no videoCount — that field only comes from a
       live channels.list call. View coverage carries the weight here. */
    channelVideoCount: null,
    channelLifetimeViews: snap.views ?? null,
  });

  /* Trends come from stored daily deltas, never from lifetime totals.
     Empty until the cron has run on enough consecutive days. */
  const days = snap.channelId ? await readFormatDays(snap.channelId) : [];

  return {
    slug: a.slug,
    name: a.name,
    handle: a.channelHandle ?? null,
    available: true,
    trends: computeTrends(days),
    trackingDays: days.filter((d) => d.comparable).length,
    /** Channel lifetime total. Reported, never split. */
    channelTotalViews: snap.views ?? null,
    coverage: set.all.coverage,
    coverageLabel: coverageLabel(set.all.coverage),
    channelRepresentative: isChannelRepresentative(set.all.coverage),
    windows: {
      d7: set.d7,
      d30: set.d30,
      d90: set.d90,
      all: set.all,
    },
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  const team = url.searchParams.get('team');

  const all = mergeArtistLists(ARTISTS, await listCustomArtists());

  if (slug) {
    const a = all.find((x) => x.slug === slug.toLowerCase());
    if (!a) return NextResponse.json({ error: 'unknown-artist' }, { status: 404 });
    return NextResponse.json({
      note: 'Split covers inventoried videos only. See coverage.',
      artist: await forArtist(a),
    });
  }

  if (team) {
    const t = getTeam(team);
    if (!t) return NextResponse.json({ error: 'unknown-team' }, { status: 404 });
    const roster = t.roster.slugs
      ? all.filter((a) => t.roster.slugs!.includes(a.slug))
      : all.filter((a) =>
          (t.roster.ownership ?? []).includes(String(a.ownership ?? '').toLowerCase()),
        );
    const rows = await Promise.all(roster.slice(0, 60).map(forArtist));
    return NextResponse.json({
      team: { id: t.id, name: t.name, description: t.description },
      note: 'Split covers inventoried videos only. See coverage on each row.',
      rosterSize: roster.length,
      returned: rows.length,
      artists: rows,
    });
  }

  return NextResponse.json({ error: 'pass ?slug= or ?team=' }, { status: 400 });
}
