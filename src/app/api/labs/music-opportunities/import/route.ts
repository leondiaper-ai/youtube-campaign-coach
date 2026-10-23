import { labsEnabled, sameOrigin } from '@/lib/labs/musicOpportunities/gate';
import { labsStore, saveObservation, writeSourceCatalogue, SOURCE_CATALOGUE_CAP } from '@/lib/labs/musicOpportunities/store';
import { parseManualChart, type ManualImportInput } from '@/lib/labs/musicOpportunities/sources/manualImport';
import { parseSourceCatalogue } from '@/lib/labs/musicOpportunities/catalogue';

export const dynamic = 'force-dynamic';
const MAX_TEXT = 400_000;

/** POST { kind: 'chart', ...ManualImportInput } | { kind: 'catalogue', text, note }. Production: 404. */
export async function POST(req: Request) {
  if (!labsEnabled()) return new Response(null, { status: 404 });
  if (!sameOrigin(req)) return new Response(null, { status: 403 });
  if (!labsStore()) return Response.json({ error: 'Preview storage is not configured.' }, { status: 503 });
  const body = await req.json().catch(() => null) as (Partial<ManualImportInput> & { kind?: string; text?: string; note?: string }) | null;
  if (!body?.text || typeof body.text !== 'string') return Response.json({ error: 'Nothing to import.' }, { status: 400 });
  if (body.text.length > MAX_TEXT) return Response.json({ error: 'Paste is too large.' }, { status: 413 });
  try {
    if (body.kind === 'chart') {
      const { observation, warnings } = parseManualChart({
        text: body.text, measure: body.measure!, territory: String(body.territory ?? '').toUpperCase(),
        period: String(body.period ?? ''), sourceUrl: String(body.sourceUrl ?? ''), note: String(body.note ?? '').slice(0, 300),
      });
      const { replaced } = await saveObservation(observation);
      return Response.json({ ok: true, saved: observation.id, rows: observation.entries.length, replaced, warnings });
    }
    if (body.kind === 'catalogue') {
      const { rows, skipped, columns } = parseSourceCatalogue(body.text);
      await writeSourceCatalogue({ importedAt: new Date().toISOString(), note: String(body.note ?? '').slice(0, 300), rows });
      return Response.json({ ok: true, rows: Math.min(rows.length, SOURCE_CATALOGUE_CAP), skipped, columns, capped: rows.length > SOURCE_CATALOGUE_CAP });
    }
    return Response.json({ error: 'Unknown import kind.' }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Import failed.' }, { status: 400 });
  }
}
