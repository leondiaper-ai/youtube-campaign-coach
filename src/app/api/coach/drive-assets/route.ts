import { NextRequest, NextResponse } from 'next/server';
import {
  buildLibrary,
  parseDriveFolderId,
  type RawDriveFile,
} from '@/lib/driveAssets';
import { saveDriveLibrary, loadDriveLibrary, deleteDriveLibrary } from '@/lib/driveStore';

/**
 * Drive asset scanning API.
 *
 * The Next.js app cannot call the Google Drive MCP itself — that runs in the
 * agent/Cowork layer. So the flow is:
 *   1. An agent scans the campaign's Drive folder via the Drive MCP
 *      (search_files / list_recent_files / get_file_metadata).
 *   2. It POSTs the raw file list + folder URL here.
 *   3. We classify the files (driveAssets.ts) and persist the AssetLibrary
 *      keyed by campaign slug.
 *   4. The coach page GETs the persisted library and renders the panel.
 *
 * This keeps classification + persistence server-side and deterministic, while
 * the Drive read stays in the connected MCP where the credentials live.
 */

/**
 * POST /api/coach/drive-assets
 *
 * Two modes, both keyed by slug:
 *   • Attach a folder URL (no `files`) — saves/updates the campaign's Drive
 *     folder link so the page can show it and the timeline can deep-link into
 *     it. Any already-scanned assets are preserved. This is what the in-app
 *     "Connect Drive folder" control uses.
 *   • Full scan (`files[]` provided) — classifies the raw file list and
 *     replaces the asset library. Used by the agent after a Drive MCP scan.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, folderUrl, files, folderName } = body as {
      slug: string;
      folderUrl: string;
      files?: RawDriveFile[];
      folderName?: string;
    };

    if (!slug || !folderUrl) {
      return NextResponse.json(
        { error: 'slug and folderUrl are required' },
        { status: 400 },
      );
    }

    const folderId = parseDriveFolderId(folderUrl) ?? undefined;

    let library;
    if (Array.isArray(files)) {
      // Full scan: classify and replace.
      library = buildLibrary(slug, folderUrl, files, { folderId, folderName });

      // ── Compute scan diff against previous scan ─────────────────────
      // Lets the UI show "3 new assets since last scan" without re-scanning.
      const existing = await loadDriveLibrary(slug);
      if (existing && existing.assets.length > 0) {
        const prevIds = new Set(existing.assets.map((a) => a.id));
        const currIds = new Set(library.assets.map((a) => a.id));
        library.previousScannedAt = existing.scannedAt;
        library.newAssetIds = library.assets
          .filter((a) => !prevIds.has(a.id))
          .map((a) => a.id);
        library.removedAssetIds = existing.assets
          .filter((a) => !currIds.has(a.id))
          .map((a) => a.id);
      }
    } else {
      // URL-only attach: keep any existing scanned assets, just (re)point the
      // folder. loadDriveLibrary falls back to a baked seed where one exists.
      const existing = await loadDriveLibrary(slug);
      library = existing
        ? { ...existing, folderUrl, folderId, folderName: folderName ?? existing.folderName }
        : { slug, folderUrl, folderId, folderName, scannedAt: '', assets: [] };
    }

    await saveDriveLibrary(library);

    return NextResponse.json({
      ok: true,
      slug,
      assetCount: library.assets.length,
      scannedAt: library.scannedAt,
      newAssets: library.newAssetIds?.length ?? 0,
      removedAssets: library.removedAssetIds?.length ?? 0,
    });
  } catch (err) {
    console.error('POST /api/coach/drive-assets error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/** GET /api/coach/drive-assets?slug=… — return the persisted library. */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  }
  const library = await loadDriveLibrary(slug);
  return NextResponse.json({ library });
}

/** DELETE /api/coach/drive-assets?slug=… — clear a campaign's library. */
export async function DELETE(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  }
  await deleteDriveLibrary(slug);
  return NextResponse.json({ ok: true });
}
