/* ═══════════════════════════════════════════════════════════════════════
   SOURCE — MANUAL IMPORT FROM charts.youtube.com

   YouTube Charts is a browser application with no documented public
   API. Its pages can be exported by a person (the download control on
   each chart), or copied as text. Either is pasted here, with the chart
   type, territory and period typed in by the person doing it, and the
   reading is stored labelled "manual import" with their note.

   The parser is header-driven and tolerant: it looks for columns that
   mean rank, previous rank, title, artist, periods on chart, the
   measure value and a YouTube URL. Tab- or comma-separated. Unknown
   columns are ignored; a file with no recognisable rank/title columns
   is rejected rather than guessed at.
   ═══════════════════════════════════════════════════════════════════════ */

import type { ChartEntry, ChartMeasure, ChartObservation } from '../types';

export const MANUAL_MEASURES: { id: ChartMeasure; label: string; measureName: string }[] = [
  { id: 'song-views-weekly', label: 'Top Songs (weekly)', measureName: 'views across official versions' },
  { id: 'music-video-views-weekly', label: 'Top Music Videos (weekly)', measureName: 'music video views' },
  { id: 'music-video-views-daily', label: 'Top Music Videos (daily)', measureName: 'music video views' },
  { id: 'shorts-creations-weekly', label: 'Top Songs on Shorts (weekly)', measureName: 'Shorts created' },
  { id: 'shorts-creations-daily', label: 'Top Songs on Shorts (daily)', measureName: 'Shorts created' },
  { id: 'trending-new-releases', label: 'Trending (new releases)', measureName: 'popularity since release' },
];

function splitLine(line: string, sep: string): string[] {
  const out: string[] = []; let cur = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted; }
    else if (ch === sep && !quoted) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

const COLUMNS: Record<string, RegExp> = {
  rank: /^(rank|position|#|pos)$/i,
  previousRank: /^(previous rank|prev(ious)?|last week|previous position|pre_rank)$/i,
  title: /^(track name|track|song|song name|title|video title|video|name)$/i,
  artist: /^(artist names?|artists?)$/i,
  periods: /^(periods on chart|weeks on chart|days on chart|time on chart)$/i,
  value: /^(views|view count|shorts creations|creations|shorts created|value)$/i,
  url: /^(youtube url|url|link|video url)$/i,
  isrc: /^isrc$/i,
  release: /^(release date|released|release)$/i,
};

export type ManualImportInput = {
  text: string; measure: ChartMeasure; territory: string; period: string; sourceUrl: string; note: string;
};

export function parseManualChart(input: ManualImportInput): { observation: ChartObservation; warnings: string[] } {
  const warnings: string[] = [];
  const lines = input.text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('Paste at least a header row and one chart row.');
  const sep = lines[0].includes('\t') ? '\t' : ',';
  const header = splitLine(lines[0], sep);
  const col: Partial<Record<keyof typeof COLUMNS, number>> = {};
  header.forEach((h, i) => { for (const [name, re] of Object.entries(COLUMNS)) if (col[name as keyof typeof COLUMNS] == null && re.test(h)) col[name as keyof typeof COLUMNS] = i; });
  if (col.title == null) throw new Error(`No title column found. Headers seen: ${header.join(' | ')}`);
  if (!/^[A-Z]{2}$|^GLOBAL$/.test(input.territory)) throw new Error('Territory must be a two-letter country code or GLOBAL.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.period)) throw new Error('Chart period must be a date (YYYY-MM-DD), e.g. the week ending shown on the chart.');
  const entries: ChartEntry[] = [];
  const num = (s?: string) => { const n = Number((s ?? '').replace(/[,\s]/g, '')); return s && s.trim() !== '' && Number.isFinite(n) ? n : null; };
  for (const line of lines.slice(1)) {
    const cells = splitLine(line, sep);
    const title = cells[col.title];
    if (!title) continue;
    const rank = col.rank != null ? num(cells[col.rank]) : null;
    const url = col.url != null ? cells[col.url] : '';
    const videoId = url?.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/)?.[1] ?? null;
    const prevRaw = col.previousRank != null ? cells[col.previousRank] : '';
    const previousRank = num(prevRaw);
    entries.push({
      rank: rank ?? entries.length + 1, previousRank,
      isNew: prevRaw ? (/new|-/i.test(prevRaw) && previousRank == null) : null,
      periodsOnChart: col.periods != null ? num(cells[col.periods]) : null,
      title, artists: col.artist != null && cells[col.artist] ? cells[col.artist].split(/,\s*|\s*&\s*/).filter(Boolean) : [],
      isrc: col.isrc != null && cells[col.isrc] ? cells[col.isrc].toUpperCase() : null,
      videoId, channelId: null, channelTitle: null,
      measureValue: col.value != null ? num(cells[col.value]) : null,
      releaseDate: col.release != null && /^\d{4}(-\d{2}-\d{2})?$/.test(cells[col.release] ?? '') ? cells[col.release] : null,
    });
  }
  if (!entries.length) throw new Error('No chart rows could be read.');
  if (col.rank == null) warnings.push('No rank column: rows were numbered in the order pasted.');
  if (col.artist == null) warnings.push('No artist column: matching relies on the title text alone.');
  const collectedAt = new Date().toISOString();
  const measure = MANUAL_MEASURES.find(m => m.id === input.measure);
  if (!measure) throw new Error('Unknown chart type.');
  return { warnings, observation: {
    id: `manual-import|${input.measure}|${input.territory}|${input.period}`,
    source: 'manual-import', measure: input.measure, territory: input.territory, period: input.period,
    periodLabel: `${measure.label} · chart dated ${input.period} · manual import`,
    sourceUrl: input.sourceUrl || 'https://charts.youtube.com/', collectedAt,
    note: input.note || null, entries: entries.sort((a, b) => a.rank - b.rank).slice(0, 200),
  } };
}
