
'use client';
import { useState } from 'react';

export default function DeleteCampaignButton({ slug, name, onDeleted, labelled = false }: {
  slug: string; name: string; onDeleted: () => void; labelled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    if (busy || !window.confirm(`Delete “${name}” and its saved timeline? This cannot be undone.`)) return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/coach', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not delete campaign');
      onDeleted();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete campaign'); }
    finally { setBusy(false); }
  }
  return <div>
    <button type="button" aria-label={`Delete ${name}`} title={`Delete ${name}`} disabled={busy}
      onClick={() => void remove()} style={{ minWidth: 44, minHeight: 44, border: '1px solid #E8E3DA', borderRadius: 8,
        background: '#fff', color: '#9B3931', cursor: busy ? 'wait' : 'pointer', padding: '8px 12px', fontSize: labelled ? 12 : 22 }}>
      {busy ? '…' : labelled ? '× Delete campaign' : '×'}
    </button>
    {error && <p role="alert" style={{ color: '#9B3931', fontSize: 12 }}>{error}</p>}
  </div>;
}
