/* ═══════════════════════════════════════════════════════════════════
   UK LANDSCAPE — PERSISTENCE

   Two things live here, both in KV, both editable without a deploy:

     uk:consumption:period:{id}   one reporting period, never
                                  overwritten by a different period
     uk:consumption:index         the list of period ids
     uk:classification            slug → INCLUDE | CHECK | EXCLUDE

   WHY PERIODS RATHER THAN ONE RUNNING TOTAL. Week-on-week movement is
   the whole reason to capture this weekly, and you cannot recover it
   from a total that has been added to. Each period stands alone; the
   dashboard reads the newest, and the others wait for the comparison
   features to be built.

   WHY date+ISRC IS THE GRAIN ON INGEST. The VMG reports overlap: each
   one carries a rolling seven-day window ending three days before its
   report date, so consecutive daily reports repeat six of their seven
   days. Adding them naively would inflate every figure roughly
   sevenfold. ingestDailyRows keys on date+ISRC and keeps the reading
   from the LATEST source report, so a restatement supersedes rather
   than duplicates, and the source report travels with the row.
   ═══════════════════════════════════════════════════════════════════ */

import type { ConsumptionPeriod, ConsumptionArtist, Classification } from './types';
import { BASELINE_PERIOD } from './baseline';
import { CLASSIFICATION_SEED } from './classification';

const PERIOD = (id: string) => `uk:consumption:period:${id}`;
const INDEX = 'uk:consumption:index';
const CLASS = 'uk:classification';

async function kv() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    const { Redis } = await import('@upstash/redis');
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

/* ── periods ──────────────────────────────────────────────────── */

export async function listPeriodIds(): Promise<string[]> {
  const store = await kv();
  if (!store) return [BASELINE_PERIOD.periodId];
  const ids = ((await store.get(INDEX)) as string[] | null) ?? [];
  return ids.includes(BASELINE_PERIOD.periodId) ? ids : [...ids, BASELINE_PERIOD.periodId];
}

export async function readPeriod(id: string): Promise<ConsumptionPeriod | null> {
  if (id === BASELINE_PERIOD.periodId) {
    const store = await kv();
    const stored = store ? ((await store.get(PERIOD(id))) as ConsumptionPeriod | null) : null;
    return stored ?? BASELINE_PERIOD;
  }
  const store = await kv();
  if (!store) return null;
  return ((await store.get(PERIOD(id))) as ConsumptionPeriod | null) ?? null;
}

/** The period the dashboard shows: latest by dateTo. */
export async function readLatestPeriod(): Promise<ConsumptionPeriod> {
  const ids = await listPeriodIds();
  const all = (await Promise.all(ids.map(readPeriod))).filter(Boolean) as ConsumptionPeriod[];
  if (all.length === 0) return BASELINE_PERIOD;
  all.sort((a, b) => (a.dateTo < b.dateTo ? 1 : -1));
  return all[0];
}

export async function writePeriod(p: ConsumptionPeriod): Promise<void> {
  const store = await kv();
  if (!store) return;
  await store.set(PERIOD(p.periodId), { ...p, ingestedAt: new Date().toISOString() });
  const ids = ((await store.get(INDEX)) as string[] | null) ?? [];
  if (!ids.includes(p.periodId)) await store.set(INDEX, [...ids, p.periodId]);
}

/* ── classification ───────────────────────────────────────────── */

export type ClassificationMap = Record<string, Classification>;

function seedMap(): ClassificationMap {
  const m: ClassificationMap = {};
  for (const s of CLASSIFICATION_SEED.include) m[s] = 'INCLUDE';
  for (const s of CLASSIFICATION_SEED.check) m[s] = 'CHECK';
  for (const s of CLASSIFICATION_SEED.exclude) m[s] = 'EXCLUDE';
  return m;
}

/** Seed overlaid with any stored overrides. Overrides win. */
export async function readClassification(): Promise<ClassificationMap> {
  const store = await kv();
  const overrides = store ? (((await store.get(CLASS)) as ClassificationMap | null) ?? {}) : {};
  return { ...seedMap(), ...overrides };
}

/** Move one artist between buckets. No deploy required. */
export async function setClassification(slug: string, value: Classification): Promise<boolean> {
  const store = await kv();
  if (!store) return false;
  const overrides = ((await store.get(CLASS)) as ClassificationMap | null) ?? {};
  overrides[slug] = value;
  await store.set(CLASS, overrides);
  return true;
}

/* ── weekly ingestion ─────────────────────────────────────────── */

export type DailyRow = {
  date: string;
  artist: string;
  track: string;
  isrc: string;
  consumption: number;
  sourceReport?: string;
  label?: string;
  supplyChain?: string;
};

export type IngestResult = {
  ok: boolean;
  periodId?: string;
  rowsReceived: number;
  rowsAccepted: number;
  duplicatesDropped: number;
  restatementsApplied: number;
  dateFrom?: string;
  dateTo?: string;
  artists?: number;
  tracks?: number;
  totalConsumption?: number;
  sourceReports?: string[];
  errors: string[];
};

function req(r: Record<string, unknown>, k: string): string {
  const v = r[k];
  return v == null ? '' : String(v).trim();
}

/**
 * Take raw daily rows and fold them into one period.
 *
 * Deduplication is on date+ISRC, because the source reports overlap by
 * six days out of seven. Where the same observation appears twice, the
 * row from the later source report wins and the earlier is counted as a
 * restatement rather than silently dropped.
 */
export function normalizeDailyRows(raw: Record<string, unknown>[]): {
  rows: DailyRow[];
  duplicatesDropped: number;
  restatementsApplied: number;
  errors: string[];
} {
  const errors: string[] = [];
  const keep = new Map<string, DailyRow>();
  let duplicatesDropped = 0;
  let restatementsApplied = 0;

  raw.forEach((r, i) => {
    const date = req(r, 'Date') || req(r, 'date');
    const isrc = req(r, 'ISRC') || req(r, 'isrc');
    const artist = req(r, 'Artist') || req(r, 'artist');
    const track = req(r, 'Track') || req(r, 'track');
    const cRaw = req(r, 'UK YouTube Consumption') || req(r, 'consumption');
    const consumption = Number(cRaw);
    const sourceReport = req(r, 'Source Report') || req(r, 'sourceReport') || undefined;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      if (errors.length < 20) errors.push(`row ${i + 1}: bad or missing Date "${date}"`);
      return;
    }
    if (!isrc) {
      if (errors.length < 20) errors.push(`row ${i + 1}: missing ISRC`);
      return;
    }
    if (!Number.isFinite(consumption)) {
      if (errors.length < 20) errors.push(`row ${i + 1}: consumption "${cRaw}" is not a number`);
      return;
    }

    const key = `${date}|${isrc}`;
    const existing = keep.get(key);
    const next: DailyRow = {
      date, artist, track, isrc, consumption, sourceReport,
      label: req(r, 'Label') || undefined,
      supplyChain: req(r, 'Supply Chain') || undefined,
    };
    if (!existing) { keep.set(key, next); return; }
    duplicatesDropped++;
    // A later report supersedes an earlier one for the same observation.
    const newer = (next.sourceReport ?? '') > (existing.sourceReport ?? '');
    if (newer) {
      if (existing.consumption !== next.consumption) restatementsApplied++;
      keep.set(key, next);
    }
  });

  return { rows: Array.from(keep.values()), duplicatesDropped, restatementsApplied, errors };
}

/** Fold deduplicated daily rows into a period, ranked like VMG ranks it. */
export function foldToPeriod(rows: DailyRow[], periodId?: string): ConsumptionPeriod {
  const dates = rows.map((r) => r.date).sort();
  const dateFrom = dates[0] ?? '';
  const dateTo = dates[dates.length - 1] ?? '';

  const byArtist = new Map<string, { total: number; tracks: Map<string, { track: string; isrc: string; c: number }> }>();
  for (const r of rows) {
    let a = byArtist.get(r.artist);
    if (!a) { a = { total: 0, tracks: new Map() }; byArtist.set(r.artist, a); }
    a.total += r.consumption;
    const t = a.tracks.get(r.isrc);
    if (t) t.c += r.consumption;
    else a.tracks.set(r.isrc, { track: r.track, isrc: r.isrc, c: r.consumption });
  }

  const artists: ConsumptionArtist[] = Array.from(byArtist.entries())
    .map(([artist, v]) => ({
      artist,
      rank: 0,
      consumption: v.total,
      // Reported strings containing a comma are multi-artist credits.
      isCollab: /,\s|\sx\s|\s&\s/i.test(artist),
      watcherSlug: null,
      tracks: Array.from(v.tracks.values())
        .sort((x, y) => y.c - x.c)
        .slice(0, 3)
        .map((t) => ({ track: t.track, isrc: t.isrc, consumption: t.c })),
    }))
    .sort((a, b) => b.consumption - a.consumption);
  artists.forEach((a, i) => (a.rank = i + 1));

  const reports = Array.from(new Set(rows.map((r) => r.sourceReport).filter(Boolean))) as string[];

  return {
    periodId: periodId ?? `${dateFrom}_${dateTo}`,
    periodLabel: `${dateFrom} – ${dateTo}`,
    dateFrom,
    dateTo,
    source: 'VMG United Kingdom Daily Trend, YouTube tab',
    totalConsumption: rows.reduce((s, r) => s + r.consumption, 0),
    artists,
    sourceReports: reports.sort(),
  };
}
