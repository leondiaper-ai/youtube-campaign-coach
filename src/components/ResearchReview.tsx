'use client';
/**
 * RESEARCH REVIEW — the one screen where a person promotes research.
 *
 * Deliberately plain. It lists what Grok has verified and scored, shows the
 * sources so the decision can be checked in one click, and offers two
 * buttons. The token is REVIEW_TOKEN, kept in this browser only; Grok never
 * holds it, which is what makes the gate a gate.
 */
import { useEffect, useState } from 'react';

const INK = '#0E0E0E', SMOKE = '#6B6B6B', HAIR = '#E6E1D8', PAPER = '#FAF7F2', SIGNAL = '#FF4A1C', MINT = '#1FBE7A';

type Example = {
  id: string; subject: string; title: string; mechanic: string | null;
  behaviourObserved: string; sequence: string[]; whyInteresting: string; whyNotObvious: string;
  possibleLearning: string; limitations: string; usefulFor: string[]; attachesTo: string[];
  scores: { mechanicValue: number; culturalRelevance: number; visualBoardValue: number } | null;
  scoredBy: string | null; verification: string; verifiedBy: string | null; verifiedAt: string | null;
  sourceUrls: string[]; observedAt: string | null; thumbnailVideoId: string | null;
  evidence: { claim: string; sourceRef: string; sourceType: string }[];
  proposals: { application: string; whatWouldHaveToBeTrue: string; proposedBy: string; at: string }[];
  promotion: { status: string; by: string; at: string; note: string | null } | null;
  boardBlockers: string[];
};

type Payload = {
  artistSlug: string; artistName: string;
  queue: Example[]; promoted: Example[]; rejected: Example[];
  notYetEligible: { id: string; subject: string; blockers: string[] }[];
};

const btn = (kind: 'primary' | 'plain' | 'danger'): React.CSSProperties => ({
  fontSize: 12, fontWeight: 700, padding: '7px 13px', borderRadius: 8, cursor: 'pointer',
  border: `1px solid ${kind === 'plain' ? HAIR : kind === 'danger' ? SIGNAL : INK}`,
  background: kind === 'primary' ? INK : '#fff', color: kind === 'primary' ? '#fff' : kind === 'danger' ? SIGNAL : INK,
});

export default function ResearchReview() {
  const [token, setToken] = useState('');
  const [by, setBy] = useState('');
  const [artist, setArtist] = useState('chvrches');
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    try {
      setToken(localStorage.getItem('review_token') ?? '');
      setBy(localStorage.getItem('review_by') ?? '');
    } catch { /* no storage — the fields stay blank */ }
  }, []);

  const load = async (t = token, a = artist) => {
    setErr(null);
    if (!t) { setData(null); return; }
    const r = await fetch(`/api/research-review?artist=${encodeURIComponent(a)}`, {
      headers: { authorization: `Bearer ${t}` }, cache: 'no-store',
    });
    const j = await r.json();
    if (!r.ok) { setErr(j.error ?? `Failed (${r.status})`); setData(null); return; }
    setData(j);
  };

  useEffect(() => { if (token) void load(token, artist); /* eslint-disable-next-line */ }, [token]);

  const decide = async (id: string, decision: 'PROMOTED' | 'REJECTED' | 'CLEAR') => {
    if (!by.trim()) { setErr('Enter your name first — a promotion is a named decision.'); return; }
    if (decision === 'PROMOTED' && !confirm('Promote this example? It becomes client-facing on the Ideas tab.')) return;
    setBusy(id); setErr(null);
    try {
      const r = await fetch('/api/research-review', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, decision, by: by.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `Failed (${r.status})`);
      await load();
    } catch (e) { setErr((e as Error).message); }
    setBusy(null);
  };

  const save = () => {
    try { localStorage.setItem('review_token', token); localStorage.setItem('review_by', by); } catch { /* ignore */ }
    void load();
  };

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px 80px', color: INK, background: PAPER, minHeight: '100vh' }}>
      <div style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: SMOKE, fontWeight: 700 }}>Human gate</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: '6px 0 4px', letterSpacing: '-.02em' }}>Research review</h1>
      <p style={{ color: SMOKE, fontSize: 14, maxWidth: 640, margin: 0 }}>
        What Grok has found, verified against the YouTube API and scored. Nothing here reaches the Ideas tab until you promote it.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '20px 0', padding: 12, border: `1px solid ${HAIR}`, borderRadius: 10, background: '#fff' }}>
        <input value={token} onChange={e => setToken(e.target.value)} placeholder="REVIEW_TOKEN" type="password"
          style={{ flex: 1, minWidth: 200, fontSize: 13, padding: '7px 10px', border: `1px solid ${HAIR}`, borderRadius: 8 }} />
        <input value={by} onChange={e => setBy(e.target.value)} placeholder="Your name"
          style={{ width: 160, fontSize: 13, padding: '7px 10px', border: `1px solid ${HAIR}`, borderRadius: 8 }} />
        <input value={artist} onChange={e => setArtist(e.target.value)} placeholder="artist slug"
          style={{ width: 130, fontSize: 13, padding: '7px 10px', border: `1px solid ${HAIR}`, borderRadius: 8 }} />
        <button onClick={save} style={btn('primary')}>Load</button>
      </div>

      {err && <div style={{ color: SIGNAL, fontSize: 13, marginBottom: 12 }}>{err}</div>}
      {!data && !err && <div style={{ color: SMOKE, fontSize: 13 }}>Enter the review token to load the queue.</div>}

      {data && (
        <>
          <Section title={`Awaiting your decision · ${data.queue.length}`} empty="Nothing waiting. Either Grok has not verified anything new, or you have reviewed it all.">
            {data.queue.map(x => <Card key={x.id} x={x} busy={busy === x.id} onDecide={decide} />)}
          </Section>
          <Section title={`Promoted · ${data.promoted.length}`} empty="Nothing promoted yet — the Ideas tab shows no external examples.">
            {data.promoted.map(x => <Card key={x.id} x={x} busy={busy === x.id} onDecide={decide} />)}
          </Section>
          <Section title={`Rejected · ${data.rejected.length}`} empty="Nothing rejected.">
            {data.rejected.map(x => <Card key={x.id} x={x} busy={busy === x.id} onDecide={decide} />)}
          </Section>
          {data.notYetEligible.length > 0 && (
            <Section title={`Not yet reviewable · ${data.notYetEligible.length}`} empty="">
              <div style={{ fontSize: 12.5, color: SMOKE }}>
                Matched to this campaign by tag but short of the gate. Grok closes these; you do not need to.
                <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                  {data.notYetEligible.map(n => <li key={n.id}><b style={{ color: INK }}>{n.subject}</b> — {n.blockers.join(' ')}</li>)}
                </ul>
              </div>
            </Section>
          )}
        </>
      )}
    </main>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const kids = Array.isArray(children) ? children.filter(Boolean) : children;
  const isEmpty = Array.isArray(kids) ? kids.length === 0 : !kids;
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', margin: '0 0 10px' }}>{title}</h2>
      {isEmpty ? <div style={{ color: SMOKE, fontSize: 13 }}>{empty}</div> : <div style={{ display: 'grid', gap: 12 }}>{children}</div>}
    </section>
  );
}

function Card({ x, busy, onDecide }: { x: Example; busy: boolean; onDecide: (id: string, d: 'PROMOTED' | 'REJECTED' | 'CLEAR') => void }) {
  const s = x.scores;
  const state = x.promotion?.status ?? 'AWAITING';
  return (
    <article style={{ border: `1px solid ${state === 'PROMOTED' ? MINT : HAIR}`, borderRadius: 12, background: '#fff', padding: 16 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        {x.thumbnailVideoId && (
          <a href={`https://www.youtube.com/watch?v=${x.thumbnailVideoId}`} target="_blank" rel="noopener" style={{ flexShrink: 0 }}>
            <img src={`https://i.ytimg.com/vi/${x.thumbnailVideoId}/mqdefault.jpg`} alt="" width={160} style={{ borderRadius: 8, display: 'block' }} />
          </a>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <b style={{ fontSize: 16 }}>{x.subject}</b>
            <span style={{ fontSize: 12, color: SMOKE }}>{x.mechanic}</span>
            <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', padding: '2px 7px', borderRadius: 6, background: state === 'PROMOTED' ? MINT : state === 'REJECTED' ? SIGNAL : INK, color: '#fff' }}>{state}</span>
          </div>
          <div style={{ fontSize: 13.5, marginTop: 6 }}>{x.behaviourObserved}</div>
          {x.sequence.length > 0 && <ol style={{ fontSize: 12.5, color: SMOKE, margin: '6px 0 0', paddingLeft: 18 }}>{x.sequence.map((st, i) => <li key={i}>{st}</li>)}</ol>}
          <div style={{ fontSize: 12.5, marginTop: 8 }}><b>Why it matters:</b> {x.possibleLearning}</div>
          <div style={{ fontSize: 12.5, marginTop: 4, color: SMOKE }}><b>Limitations:</b> {x.limitations}</div>
          <div style={{ fontSize: 12, marginTop: 8, color: SMOKE }}>
            Attaches to: <b style={{ color: INK }}>{x.attachesTo.join(', ') || '—'}</b> · tags {x.usefulFor.join(', ')}
            {s && <> · scores M{s.mechanicValue} C{s.culturalRelevance} V{s.visualBoardValue} ({x.scoredBy})</>}
            · {x.verification}{x.verifiedBy ? ` by ${x.verifiedBy}` : ''}{x.observedAt ? ` · observed ${x.observedAt}` : ''}
          </div>
          <div style={{ fontSize: 12, marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {x.sourceUrls.map(u => <a key={u} href={u} target="_blank" rel="noopener" style={{ color: INK }}>{u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}</a>)}
          </div>
          {x.proposals.length > 0 && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: PAPER, fontSize: 12.5 }}>
              <b>Grok proposes</b>
              {x.proposals.map((p, i) => <div key={i} style={{ marginTop: 4 }}>{p.application} <span style={{ color: SMOKE }}>— if: {p.whatWouldHaveToBeTrue} ({p.proposedBy}, {p.at.slice(0, 10)})</span></div>)}
            </div>
          )}
          {x.promotion && <div style={{ fontSize: 12, marginTop: 8, color: SMOKE }}>{x.promotion.status} by {x.promotion.by}, {x.promotion.at.slice(0, 10)}{x.promotion.note ? ` — ${x.promotion.note}` : ''}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {state !== 'PROMOTED' && <button disabled={busy} onClick={() => onDecide(x.id, 'PROMOTED')} style={btn('primary')}>✓ Promote to Ideas tab</button>}
            {state !== 'REJECTED' && <button disabled={busy} onClick={() => onDecide(x.id, 'REJECTED')} style={btn('danger')}>Reject</button>}
            {state !== 'AWAITING' && <button disabled={busy} onClick={() => onDecide(x.id, 'CLEAR')} style={btn('plain')}>Undo</button>}
          </div>
        </div>
      </div>
    </article>
  );
}
