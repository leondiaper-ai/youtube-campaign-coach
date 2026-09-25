/**
 * GET /api/uk-landscape/export?view=consumption|crossover|biggest
 *
 * The James-facing dataset as CSV, built from the CURRENT dashboard
 * data — so when next week's consumption lands, the download changes
 * with it. Nothing is snapshotted at build time.
 *
 * CSV rather than XLSX because this project has no spreadsheet library
 * and adding one to produce a three-tab file is not worth it: Google
 * Sheets opens a CSV directly. A fake "Open in Google Sheets" button
 * would be worse than an honest download.
 *
 * Deliberately excluded: the CHECK universe, Chartmetric IDs, outcome
 * codes, classification internals. This is the simple output, not the
 * engineering data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildLandscape } from '@/lib/uk-landscape/build';
import type { LandscapeRow } from '@/lib/uk-landscape/types';

export const dynamic = 'force-dynamic';

const q = (v: unknown): string => {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const line = (cells: unknown[]) => cells.map(q).join(',');

function consumptionCsv(rows: LandscapeRow[]): string {
  const out = [
    line(['RANK', 'ARTIST', 'UK CONSUMPTION', 'BIGGEST CONSUMING TRACK', 'TRACK CONSUMPTION',
      'SECOND BIGGEST TRACK', 'TRACK CONSUMPTION', 'THIRD BIGGEST TRACK', 'TRACK CONSUMPTION']),
  ];
  for (const r of rows) {
    const t = r.tracks;
    out.push(line([r.consumptionRank, r.artist, r.consumption,
      t[0]?.track ?? '', t[0]?.consumption ?? '',
      t[1]?.track ?? '', t[1]?.consumption ?? '',
      t[2]?.track ?? '', t[2]?.consumption ?? '']));
  }
  return out.join('\n');
}

function crossoverCsv(rows: LandscapeRow[]): string {
  const out = [line(['RANK', 'ARTIST', 'UK CONSUMPTION', 'UK YOUTUBE MONTHLY VIEWS', 'UK TERRITORY RANK', 'SUBSCRIBERS'])];
  rows.forEach((r, i) =>
    out.push(line([i + 1, r.artist, r.consumption, r.ukMonthlyViews, r.ukTerritoryRank, r.subscribers])));
  return out.join('\n');
}

function biggestCsv(rows: LandscapeRow[]): string {
  const out = [line(['RANK', 'ARTIST', 'UK YOUTUBE MONTHLY VIEWS', 'UK TERRITORY RANK', 'SUBSCRIBERS', 'LIFETIME CHANNEL VIEWS'])];
  rows.forEach((r, i) =>
    out.push(line([i + 1, r.artist, r.ukMonthlyViews, r.ukTerritoryRank, r.subscribers, r.lifetimeViews])));
  return out.join('\n');
}

export async function GET(req: NextRequest) {
  const view = (new URL(req.url).searchParams.get('view') ?? 'all').toLowerCase();
  const l = await buildLandscape();
  const stamp = l.freshness.consumptionThrough ?? new Date().toISOString().slice(0, 10);

  let body: string;
  let name: string;
  if (view === 'consumption') {
    body = consumptionCsv(l.consumption);
    name = `Virgin-UK-YouTube-Consumption-${stamp}.csv`;
  } else if (view === 'crossover') {
    body = crossoverCsv(l.crossover);
    name = `Virgin-UK-YouTube-Crossover-${stamp}.csv`;
  } else if (view === 'biggest') {
    body = biggestCsv(l.biggestUk);
    name = `Virgin-UK-YouTube-Biggest-Artists-${stamp}.csv`;
  } else {
    body = [
      'UK CONSUMPTION', consumptionCsv(l.consumption), '',
      'CONSUMPTION x UK YOUTUBE', crossoverCsv(l.crossover), '',
      'BIGGEST VIRGIN ARTISTS ON UK YOUTUBE', biggestCsv(l.biggestUk), '',
      `UK Consumption uses VMG internal YouTube consumption reporting (through ${l.freshness.consumptionThrough ?? '—'}).`,
      `UK YouTube Audience uses Chartmetric artist-level YouTube territory data (through ${l.freshness.chartmetricUpdated ?? '—'}).`,
    ].join('\n');
    name = `Virgin-UK-YouTube-Landscape-${stamp}.csv`;
  }

  return new NextResponse('﻿' + body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  });
}
