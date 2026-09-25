/**
 * GET /api/uk-landscape
 *
 * The three rankings, built from the three persisted layers. No
 * Chartmetric requests are made here — UK figures come from the
 * snapshots already in KV, so a page load costs nothing upstream.
 */
import { NextResponse } from 'next/server';
import { buildLandscape } from '@/lib/uk-landscape/build';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    return NextResponse.json(await buildLandscape(), { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'failed' },
      { status: 500 },
    );
  }
}
