import { NextResponse } from 'next/server';
import { listPlans } from '@/lib/planStore';
import { loadDriveLibrary } from '@/lib/driveStore';
import { parseDriveFolderId } from '@/lib/driveAssets';
import { getCampaignConfig } from '@/lib/campaignConfig';

/**
 * GET /api/coach/drive-campaigns
 *
 * Returns every campaign that has a Google Drive folder linked — either via
 * the in-app "Connect Drive folder" control (stored in KV) or via the
 * baked-in campaign config. The scheduled drive-asset-scan task calls this
 * once at the start of each run to discover which folders to scan.
 *
 * Response shape:
 *   { campaigns: Array<{ slug, artist, campaignName, folderUrl, folderId, folderName, lastScannedAt }> }
 */
export async function GET() {
  try {
    const plans = await listPlans();

    const campaigns: {
      slug: string;
      artist: string;
      campaignName: string;
      folderUrl: string;
      folderId: string;
      folderName?: string;
      lastScannedAt?: string;
    }[] = [];

    // Check each plan for a linked Drive folder (KV first, then config fallback)
    await Promise.all(
      plans.map(async (plan) => {
        const lib = await loadDriveLibrary(plan.slug).catch(() => null);
        const cfg = getCampaignConfig(plan.slug);

        // Prefer the runtime-linked folder (KV), fall back to config
        const folderUrl = lib?.folderUrl || cfg?.driveFolderUrl;
        if (!folderUrl) return; // no folder linked — skip

        const folderId = parseDriveFolderId(folderUrl);
        if (!folderId) return; // unparseable URL — skip

        campaigns.push({
          slug: plan.slug,
          artist: plan.artist,
          campaignName: plan.campaignName,
          folderUrl,
          folderId,
          folderName: lib?.folderName || cfg?.driveFolderName,
          lastScannedAt: lib?.scannedAt || undefined,
        });
      }),
    );

    return NextResponse.json({ campaigns });
  } catch (err) {
    console.error('GET /api/coach/drive-campaigns error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
