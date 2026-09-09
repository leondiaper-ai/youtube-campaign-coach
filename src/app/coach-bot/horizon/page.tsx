'use client';

/**
 * CAMPAIGN HORIZON EDITOR
 *
 * The "fix an incomplete horizon in under a minute" path. Deliberately one
 * screen: pick artist, see the computed confidence and why, add or edit
 * events inline.
 *
 * Not a new planning product. The Coach plan remains where campaigns are
 * actually planned; this is the server-side projection plus a way to correct
 * or top up what the Coach can see. The "Sync from Coach plan" button reads
 * the browser-held plan and pushes it here.
 */

import { useCallback, useEffect, useState } from 'react';
import { syncHorizon } from '@/lib/coach-bot/horizonSync';

type Ev = {
  eventId: string; eventDate: string | null; eventType: string; title: string;
  status: string; note: string | null; source: string; assetType: string | null;
};
type Horizon = {
  horizonKnown: boolean; horizonConfidence: string; horizonReason: string | null;
  planAgeDays: number | null; totalUpcoming: number;
  nextMajorMoment: { title: string; date: string | null; daysAway: number | null; type: string } | null;
  next7Days: any[]; days7to14: any[]; longFormPlannedIn7to14: boolean; warnings: string[];
};

const CONF_STYLE: Record<string, string> = {
  HIGH: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  MEDIUM: 'bg-amber-100 text-amber-900 border-amber-300',
  LOW: 'bg-orange-100 text-orange-900 border-orange-300',
  UNKNOWN: 'bg-rose-100 text-rose-900 border-rose-300',
};

const BLANK = { title: '', eventDate: '', eventType: 'SINGLE_RELEASE', status: 'PLANNED', note: '' };

export default function HorizonEditor() {
  const [artists, setArtists] = useState<{ slug: string; name: string }[]>([]);
  const [slug, setSlug] = useState('');
  const [horizon, setHorizon] = useState<Horizon | null>(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [draft, setDraft] = useState({ ...BLANK });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/researcher/tools', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tool: 'list_roster', args: {} }),
    }).then(r => r.json()).then(r => setArtists(r.result?.artists ?? []));
  }, []);

  const load = useCallback(async (s: string) => {
    if (!s) return;
    setBusy(true);
    const r = await fetch(`/api/campaign-horizon?slug=${encodeURIComponent(s)}`).then(x => x.json());
    setHorizon(r.horizon); setEvents(r.events ?? []);
    setTypes(r.eventTypes ?? []); setStatuses(r.eventStatuses ?? []);
    setBusy(false);
  }, []);

  useEffect(() => { if (slug) load(slug); }, [slug, load]);

  async function addEvent() {
    if (!draft.title.trim()) { setMsg('A title is required.'); return; }
    setBusy(true);
    await fetch('/api/campaign-horizon', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, event: { ...draft, eventDate: draft.eventDate || null } }),
    });
    setDraft({ ...BLANK }); setMsg(null);
    await load(slug);
  }

  async function patch(eventId: string, fields: Record<string, unknown>) {
    setBusy(true);
    await fetch('/api/campaign-horizon', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, eventId, ...fields }),
    });
    await load(slug);
  }

  async function remove(eventId: string) {
    if (!window.confirm('Delete this event?')) return;
    setBusy(true);
    await fetch(`/api/campaign-horizon?slug=${encodeURIComponent(slug)}&eventId=${eventId}`, { method: 'DELETE' });
    await load(slug);
  }

  async function doSync() {
    setBusy(true);
    const r = await syncHorizon(slug);
    setMsg(r === null
      ? 'No Coach plan found in this browser for that artist. Add events manually below.'
      : `Synced ${r.replaced} event(s) from the Coach plan.`);
    await load(slug);
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 text-neutral-900">
      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500">Virgin Music · YouTube</div>
      <h1 className="mt-1 text-4xl font-black tracking-tight">Campaign Horizon</h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600">
        What is <em>supposed</em> to happen next. The Coach reads this before giving any timing advice,
        and refuses to give one when the plan here is stale or empty.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <select value={slug} onChange={e => setSlug(e.target.value)}
          className="rounded border border-neutral-300 px-2 py-2 text-sm">
          <option value="">Choose an artist…</option>
          {artists.map(a => <option key={a.slug} value={a.slug}>{a.name}</option>)}
        </select>
        <button onClick={doSync} disabled={!slug || busy}
          className="rounded border border-neutral-400 px-3 py-2 text-sm font-semibold disabled:opacity-40">
          Sync from Coach plan
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-neutral-600">{msg}</p>}

      {horizon && (
        <>
          <section className={`mt-6 rounded-lg border p-4 ${CONF_STYLE[horizon.horizonConfidence] ?? 'bg-neutral-100'}`}>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
              <span>Horizon {horizon.horizonConfidence}</span>
              <span className="opacity-70">{horizon.totalUpcoming} upcoming</span>
              {horizon.planAgeDays !== null && <span className="opacity-70">updated {horizon.planAgeDays}d ago</span>}
            </div>
            {horizon.horizonReason && <p className="mt-2 text-sm">{horizon.horizonReason}</p>}
            {horizon.nextMajorMoment && (
              <p className="mt-2 text-sm">
                <b>Next major moment:</b> {horizon.nextMajorMoment.title}
                {horizon.nextMajorMoment.date && ` — ${horizon.nextMajorMoment.date}`}
                {horizon.nextMajorMoment.daysAway !== null && ` (${horizon.nextMajorMoment.daysAway} days away)`}
              </p>
            )}
            {horizon.longFormPlannedIn7to14 && (
              <p className="mt-1 text-sm"><b>A long-form asset is already planned in the 7–14 day window.</b></p>
            )}
            {horizon.warnings.map((w, i) => <p key={i} className="mt-1 text-xs opacity-80">⚠ {w}</p>)}
          </section>

          {/* Add */}
          <section className="mt-6 rounded-lg border border-neutral-300 bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500">Add an event</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })}
                placeholder="Title, e.g. Single 2" className="min-w-[200px] flex-1 rounded border border-neutral-300 px-2 py-2 text-sm" />
              <input type="date" value={draft.eventDate} onChange={e => setDraft({ ...draft, eventDate: e.target.value })}
                className="rounded border border-neutral-300 px-2 py-2 text-sm" />
              <select value={draft.eventType} onChange={e => setDraft({ ...draft, eventType: e.target.value })}
                className="rounded border border-neutral-300 px-2 py-2 text-sm">
                {types.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
              <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}
                className="rounded border border-neutral-300 px-2 py-2 text-sm">
                {statuses.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button onClick={addEvent} disabled={busy}
                className="rounded bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Add</button>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              Leave the date blank for a planned asset with no date yet — the Coach will know it exists
              but won&apos;t time anything against it. Mark <b>CONFIRMED</b> only when the date is locked;
              that is what lifts confidence to HIGH.
            </p>
          </section>

          {/* Events */}
          <section className="mt-6">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500">
              {events.length} event{events.length === 1 ? '' : 's'}
            </div>
            <ul className="mt-2 space-y-2">
              {events.map(e => (
                <li key={e.eventId} className="flex flex-wrap items-center gap-2 rounded border border-neutral-300 bg-white p-2 text-sm">
                  <input type="date" defaultValue={e.eventDate ?? ''}
                    onBlur={ev => ev.target.value !== (e.eventDate ?? '') && patch(e.eventId, { eventDate: ev.target.value })}
                    className="rounded border border-neutral-200 px-2 py-1 text-xs" />
                  <span className="min-w-[160px] flex-1 font-medium">{e.title}</span>
                  <select defaultValue={e.eventType} onChange={ev => patch(e.eventId, { eventType: ev.target.value })}
                    className="rounded border border-neutral-200 px-1 py-1 text-xs">
                    {types.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                  <select defaultValue={e.status} onChange={ev => patch(e.eventId, { status: ev.target.value })}
                    className="rounded border border-neutral-200 px-1 py-1 text-xs">
                    {statuses.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span className="text-[10px] uppercase text-neutral-400">{e.source}</span>
                  <button onClick={() => remove(e.eventId)} className="rounded bg-rose-600 px-2 py-1 text-xs font-semibold text-white">×</button>
                </li>
              ))}
            </ul>
            {events.length === 0 && (
              <p className="mt-2 text-sm text-neutral-500">
                No events. Sync from the Coach plan or add the next release above — two events is usually
                enough to move the Coach from UNKNOWN to a usable horizon.
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
