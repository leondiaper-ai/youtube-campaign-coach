'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ChannelContext } from '@/lib/planEngine';

type Props = {
  slug: string;
  artist: string;
  campaignName: string;
  timeline: string;
  channelCtx: ChannelContext | null;
  campaignStartDate?: string;
  market?: string;
};

export default function CoachTimelineEditor(props: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(props.timeline);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = draft.trim() !== props.timeline.trim();

  async function save() {
    if (!changed || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist: props.artist, timeline: draft.trim(), channelCtx: props.channelCtx,
          customSlug: props.slug, campaignName: props.campaignName,
          campaignStartDate: props.campaignStartDate ?? null, market: props.market,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Could not save the timeline.');
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the timeline.');
    } finally { setSaving(false); }
  }

  return (
    <section className="mt-7 pt-4 border-t border-line">
      <button type="button" aria-expanded={open} aria-controls="coach-timeline-editor"
        onClick={() => { setError(null); setDraft(props.timeline); setOpen(!open); }}
        className="text-micro font-bold uppercase tracking-widest text-muted hover:text-ink">
        Adjust timeline {open ? '▾' : '▸'}
      </button>
      {open && (
        <form id="coach-timeline-editor" className="mt-3" onSubmit={e => { e.preventDefault(); void save(); }}>
          <label htmlFor="coach-timeline-text" className="sr-only">Campaign timeline</label>
          <textarea id="coach-timeline-text" value={draft} onChange={e => setDraft(e.target.value)}
            disabled={saving} rows={Math.max(6, draft.split('\n').length + 1)}
            className="w-full rounded-control border border-line-strong bg-surface p-3 text-meta text-ink font-mono leading-relaxed resize-y" />
          {error && <p role="alert" className="text-meta text-negative mt-2">{error}</p>}
          <div className="flex flex-wrap gap-3 mt-3">
            <button type="submit" disabled={!changed || saving}
              className="rounded-control bg-ink text-white px-4 py-2 text-meta font-semibold disabled:opacity-40">
              {saving ? 'Regenerating…' : 'Save & Regenerate'}
            </button>
            <button type="button" disabled={saving} onClick={() => { setDraft(props.timeline); setOpen(false); setError(null); }}
              className="rounded-control border border-line px-4 py-2 text-meta text-muted">Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}
