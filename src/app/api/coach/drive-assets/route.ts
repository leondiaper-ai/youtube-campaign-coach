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

/** POST /api/coach/drive-assets — scan results in, classified library persisted. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, folderUrl, files, folderName } = body as {
      slug: string;
      folderUrl: string;
      files: RawDriveFile[];
      folderName?: string;
    };

    if (!slug || !folderUrl || !Array.isArray(files)) {
      return NextResponse.json(
        { error: 'slug, folderUrl and files[] are required' },
        { status: 400 },
      );
    }

    const folderId = parseDriveFolderId(folderUrl) ?? undefined;
    const library = buildLibrary(slug, folderUrl, files, { folderId, folderName });
    await saveDriveLibrary(library);

    return NextResponse.json({
      ok: true,
      slug,
      assetCount: library.assets.length,
      scannedAt: library.scannedAt,
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
