/**
 * POST /api/uk-landscape/ingest
 *
 * The weekly consumption update. Send daily rows, get a period.
 *
 *   { rows: [ { Date, Artist, Track, ISRC, "UK YouTube Consumption",
 *               "Source Report", Label, "Supply Chain" } ],
 *     periodId?: string, dryRun?: boolean }
 *
 * WHY THE DEDUPE MATTERS. Each VMG Daily Trend Report carries a rolling
 * SEVEN-DAY window ending three days before its report date, so
 * consecutive reports repeat six of their seven days. Posting a month of
 * reports without deduplication would inflate every figure roughly
 * sevenfold. Rows are keyed on date+ISRC; where the same observation
 * appears in two reports the later one wins and the difference is
 * counted as a restatement rather than lost.
 *
 * Existing periods are never touched. A new file creates a new period
 * or replaces one by id, so week-on-week comparison stays possible.
 *
 * dryRun validates and reports without writing — run it first.
 */
import { NextRequest, NextResponse } from 'next/server';
import { normalizeDailyRows, foldToPeriod, writePeriod } from '@/lib/uk-landscape/store';
import type { IngestResult } from '@/lib/uk-landscape/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const expected = process.env.REVIEW_TOKEN;
  if (expected) {
    const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (bearer !== expected) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const raw: Record<string, unknown>[] = Array.isArray(body?.rows) ? body.rows : [];
  if (raw.length === 0) {
    return NextResponse.json<IngestResult>(
      { ok: false, rowsReceived: 0, rowsAccepted: 0, duplicatesDropped: 0, restatementsApplied: 0, errors: ['No rows supplied. Send { rows: [...] }.'] },
      { status: 400 },
    );
  }

  const { rows, duplicatesDropped, restatementsApplied, errors } = normalizeDailyRows(raw);
  if (rows.length === 0) {
    return NextResponse.json<IngestResult>(
      { ok: false, rowsReceived: raw.length, rowsAccepted: 0, duplicatesDropped, restatementsApplied, errors: errors.length ? errors : ['No valid rows after validation.'] },
      { status: 400 },
    );
  }

  const period = foldToPeriod(rows, body?.periodId ? String(body.periodId) : undefined);
  const result: IngestResult = {
    ok: true,
    periodId: period.periodId,
    rowsReceived: raw.length,
    rowsAccepted: rows.length,
    duplicatesDropped,
    restatementsApplied,
    dateFrom: period.dateFrom,
    dateTo: period.dateTo,
    artists: period.artists.length,
    tracks: new Set(rows.map((r) => r.isrc)).size,
    totalConsumption: period.totalConsumption,
    sourceReports: period.sourceReports,
    errors,
  };

  if (body?.dryRun) return NextResponse.json({ ...result, dryRun: true }, { status: 200 });

  await writePeriod(period);
  return NextResponse.json(result, { status: 200 });
}
