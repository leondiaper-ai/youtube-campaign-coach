import { NextRequest, NextResponse } from 'next/server';
import { loadPlan } from '@/lib/planStore';
import { readLiveSnapByHandle, readChannelMapping } from '@/lib/kvCache';
import { ARTISTS } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { classifyUploadFormat } from '@/lib/coach/matchEngine';
import { buildReleaseClusters, buildReleaseMoments } from '@/lib/coach/releaseClusters';
import type { RecentUpload } from '@/lib/artists';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'slug required' });

  const saved = await loadPlan(slug);
  if (!saved) return NextResponse.json({ error: 'plan not found' });

  const custom = await listCustomArtists();
  const allArtists = [...ARTISTS, ...custom];
  const artistConfig = allArtists.find(
    (a) => a.slug === saved.artist.toLowerCase().replace(/\s+/g, '-') ||
           a.name.toLowerCase() === saved.artist.toLowerCase()
  );

  let recentUploads: RecentUpload[] = [];
  if (artistConfig?.channelHandle) {
    const { readLiveSnapByHandle: readSnap } = await import('@/lib/kvCache');
    const snap = await readSnap(artistConfig.channelHandle);
    if (snap) recentUploads = snap.recentUploads ?? [];
  }

  const campaignStartDate = artistConfig?.campaignStartDate;

  // Classify all uploads
  const classified = recentUploads.map(u => ({
    id: u.id,
    title: u.title,
    format: classifyUploadFormat(u),
    views: u.viewCount,
    durationSec: u.durationSec,
    publishedAt: u.publishedAt,
  }));

  // Find official videos
  const officialVideos = classified.filter(u => u.format === 'Official Video');

  // Run clustering
  const clusters = buildReleaseClusters(recentUploads, {
    minAnchorViews: 5000,
    maxPillars: 6,
    campaignStartDate,
    campaignWeeks: saved.plan.totalWeeks,
    campaignEvents: saved.plan.events,
  });

  const moments = buildReleaseMoments(clusters, saved.plan.phases, campaignStartDate);

  return NextResponse.json({
    campaignStartDate,
    campaignWeeks: saved.plan.totalWeeks,
    eventCount: saved.plan.events?.length,
    events: saved.plan.events?.map(e => ({ title: e.title, dateISO: e.dateISO })),
    totalUploads: recentUploads.length,
    officialVideos,
    clusterCount: clusters.length,
    clusterAnchors: clusters.map(c => ({
      title: c.anchor.title,
      views: c.anchor.viewCount,
      publishedAt: c.anchor.publishedAt,
      supportCount: c.support.length,
    })),
    momentCount: moments.length,
  });
}
