import { NextResponse } from 'next/server';
import { readLiveSnapByHandle } from '@/lib/kvCache';
import { buildReleaseClusters } from '@/lib/coach/releaseClusters';
import { classifyUploadFormat } from '@/lib/coach/matchEngine';

export const dynamic = 'force-dynamic';

export async function GET() {
  const snap = await readLiveSnapByHandle('@KTrap1');
  if (!snap) return NextResponse.json({ error: 'No snap for K-Trap' });

  const uploads = snap.recentUploads ?? [];

  const classified = uploads.map(u => ({
    title: u.title,
    durationSec: u.durationSec,
    viewCount: u.viewCount,
    format: classifyUploadFormat(u),
    publishedAt: u.publishedAt,
  }));

  const clusters = buildReleaseClusters(uploads, {
    treatLongformAsAnchor: true,
    minAnchorViews: 500,
  });

  return NextResponse.json({
    uploadCount: uploads.length,
    uploads: classified,
    clusterCount: clusters.length,
    clusters: clusters.map(c => ({
      anchor: c.anchor.title,
      anchorFormat: c.anchorFormat,
      anchorViews: c.anchor.viewCount,
      anchorDuration: c.anchor.durationSec,
      supportCount: c.support.length,
      coverageLabel: c.coverageLabel,
      coverageScore: c.coverageScore,
      insights: c.insights,
    })),
  });
}
