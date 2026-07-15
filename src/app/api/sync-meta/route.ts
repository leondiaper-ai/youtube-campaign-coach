import { NextResponse } from 'next/server';
import { readSyncMeta } from '@/lib/kvCache';

export const revalidate = 600;

/** GET /api/sync-meta — returns last sync info for freshness labels */
export async function GET() {
  const meta = await readSyncMeta();
  return NextResponse.json(meta ?? { lastSyncAt: null, status: 'none' });
}
