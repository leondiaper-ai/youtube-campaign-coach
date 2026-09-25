/**
 * GET /api/uk-landscape/export            → .xlsx, three sheets
 * GET /api/uk-landscape/export?format=csv → CSV of one view
 *
 * The James-facing dataset, built from the CURRENT dashboard data — so
 * when next week's consumption lands, the download changes with it.
 * Nothing is snapshotted at build time and nothing is read from the
 * original static workbook.
 *
 * Deliberately excluded: the CHECK universe, Chartmetric IDs, outcome
 * codes, classification internals, freshness plumbing. This is the
 * simple output, not the engineering data.
 *
 * CSV is kept for our own convenience. XLSX is what goes to James.
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildLandscape } from '@/lib/uk-landscape/build';
import { buildXlsx, isLink, type Sheet, type Cell } from '@/lib/uk-landscape/xlsx';
import type { LandscapeRow } from '@/lib/uk-landscape/types';

export const dynamic = 'force-dynamic';

/* ── the three sheets, from live data ─────────────────────────── */

/* Channel cells come straight from the Watcher mapping. Blank where
   there is no confirmed match — a guessed handle is a wrong link. */
const handleCell = (r: LandscapeRow): Cell => r.youtubeHandle ?? null;
const channelCell = (r: LandscapeRow): Cell =>
  r.youtubeChannelUrl
    ? { text: r.youtubeHandle ?? 'View channel', link: r.youtubeChannelUrl }
    : null;

function consumptionSheet(rows: LandscapeRow[]): Sheet {
  return {
    name: 'UK Consumption',
    headers: ['Rank', 'Artist', 'YouTube Handle', 'YouTube Channel', 'UK Consumption',
      'Top Track 1', 'Consumption', 'Top Track 2', 'Consumption', 'Top Track 3', 'Consumption'],
    widths: [7, 30, 22, 20, 16, 30, 14, 30, 14, 30, 14],
    rows: rows.map((r): Cell[] => {
      const t = r.tracks;
      return [
        r.consumptionRank, r.artist, handleCell(r), channelCell(r), r.consumption,
        t[0]?.track ?? null, t[0]?.consumption ?? null,
        t[1]?.track ?? null, t[1]?.consumption ?? null,
        t[2]?.track ?? null, t[2]?.consumption ?? null,
      ];
    }),
  };
}

function crossoverSheet(rows: LandscapeRow[]): Sheet {
  return {
    name: 'Crossover',
    headers: ['Rank', 'Artist', 'YouTube Handle', 'YouTube Channel', 'UK Consumption',
      'UK YouTube Monthly Views', 'UK Territory Rank', 'Subscribers'],
    widths: [7, 30, 22, 20, 17, 26, 18, 15],
    rows: rows.map((r, i): Cell[] => [
      i + 1, r.artist, handleCell(r), channelCell(r), r.consumption,
      r.ukMonthlyViews, r.ukTerritoryRank, r.subscribers,
    ]),
  };
}

function biggestSheet(rows: LandscapeRow[]): Sheet {
  return {
    name: 'Biggest UK Artists',
    headers: ['Rank', 'Artist', 'YouTube Handle', 'YouTube Channel',
      'UK YouTube Monthly Views', 'UK Territory Rank', 'Subscribers', 'Lifetime Channel Views'],
    widths: [7, 30, 22, 20, 26, 18, 15, 23],
    rows: rows.map((r, i): Cell[] => [
      i + 1, r.artist, handleCell(r), channelCell(r),
      r.ukMonthlyViews, r.ukTerritoryRank, r.subscribers, r.lifetimeViews,
    ]),
  };
}

/* ── csv, kept for internal use ───────────────────────────────── */

const q = (v: Cell): string => {
  if (v == null) return '';
  const s = isLink(v) ? v.link : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvOf = (s: Sheet) =>
  [s.headers.map(q).join(','), ...s.rows.map((r) => r.map(q).join(','))].join('\n');

/* ── route ────────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const format = (url.searchParams.get('format') ?? 'xlsx').toLowerCase();
  const view = (url.searchParams.get('view') ?? 'all').toLowerCase();

  const l = await buildLandscape();
  const stamp = l.freshness.consumptionThrough ?? new Date().toISOString().slice(0, 10);

  const sheets: Sheet[] = [
    consumptionSheet(l.consumption),
    crossoverSheet(l.crossover),
    biggestSheet(l.biggestUk),
  ];

  if (format === 'csv') {
    const pick =
      view === 'crossover' ? sheets[1] : view === 'biggest' ? sheets[2] : sheets[0];
    return new NextResponse('﻿' + csvOf(pick), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="Virgin-UK-YouTube-${pick.name.replace(/\s+/g, '-')}-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const buf = buildXlsx(sheets);
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Virgin-UK-YouTube-${stamp}.xlsx"`,
      'Content-Length': String(buf.length),
      'Cache-Control': 'no-store',
    },
  });
}
