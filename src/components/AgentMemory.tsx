'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { AgentMemoryData } from '@/app/api/agent-memory/route';

// ── Design tokens — cooler, research-lab palette ─────────────────────────────
const BG = '#F5F6F8';
const SURFACE = '#FFFFFF';
const INK = '#1A1D23';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';
const ACCENT = '#4B5563';
const GREEN = '#059669';
const AMBER = '#D97706';
const PURPLE = '#7C3AED';
const RED = '#DC2626';
const BLUE = '#2563EB';

const CONF_STYLE = {
  high:         { bg: '#ECFDF5', fg: GREEN, label: 'High Confidence' },
  medium:       { bg: '#FFFBEB', fg: AMBER, label: 'Medium Confidence' },
  experimental: { bg: '#F5F3FF', fg: PURPLE, label: 'Experimental' },
};

const OUTCOME_STYLE = {
  positive: { bg: '#ECFDF5', fg: GREEN },
  neutral:  { bg: '#F9FAFB', fg: MUTED },
  negative: { bg: '#FEF2F2', fg: RED },
  pending:  { bg: '#F5F3FF', fg: PURPLE },
};

const HYPO_STATUS = {
  testing:            { bg: '#F5F3FF', fg: PURPLE, label: 'Testing' },
  growing_confidence: { bg: '#FFFBEB', fg: AMBER, label: 'Growing Confidence' },
  high_confidence:    { bg: '#ECFDF5', fg: GREEN, label: 'High Confidence' },
  rejected:           { bg: '#FEF2F2', fg: RED, label: 'Rejected' },
};

// ── Component ────────────────────────────────────────────────────────────────

export default function AgentMemory() {
  const [data, setData] = useState<AgentMemoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    patterns: true,
    campaigns: true,
    decisions: false,
    epistemic: false,
    accuracy: false,
    hypotheses: true,
    learning: false,
    principles: false,
    counterfactual: false,
  });

  useEffect(() => {
    fetch('/api/agent-memory')
      .then((r) => { if (!r.ok) throw new Error('Failed'); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError('Failed to load agent memory'); setLoading(false); });
  }, []);

  const toggle = (key: string) => setOpenSections((p) => ({ ...p, [key]: !p[key] }));

  if (loading) {
    return (
      <main style={{ background: BG, minHeight: '100vh' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: MUTED, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
            Building agent memory…
          </div>
          <div style={{ fontSize: 11, color: MUTED, opacity: 0.5, marginTop: 8 }}>
            Scanning watcher data, coach plans, and campaign patterns
          </div>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main style={{ background: BG, minHeight: '100vh' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: RED }}>{error || 'No data available'}</div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ background: BG, color: INK, minHeight: '100vh' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <header style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.2em', color: MUTED, marginBottom: 6 }}>
            Internal · Experimental
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', margin: 0 }}>
            YouTube Agent Memory
          </h1>
          <p style={{ fontSize: 12, color: MUTED, marginTop: 6, lineHeight: 1.6, maxWidth: 600 }}>
            What are we learning? This page captures campaign patterns, decision quality, hypotheses,
            and emerging intelligence across Watcher and Coach.
          </p>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 10, fontFamily: 'monospace', color: MUTED }}>
            <span>{data.meta.artistCount} channels monitored</span>
            <span>·</span>
            <span>{data.meta.campaignCount} active campaigns</span>
            <span>·</span>
            <span>Updated {new Date(data.meta.lastUpdated).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </header>

        {/* ── Section 1: Pattern Watch ────────────────────────────── */}
        <Section
          id="patterns"
          num="01"
          title="Pattern Watch"
          subtitle="Emerging patterns across all campaigns"
          open={openSections.patterns}
          toggle={() => toggle('patterns')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(['high', 'medium', 'experimental'] as const).map((conf) => {
              const group = data.patterns.filter((p) => p.confidence === conf);
              if (group.length === 0) return null;
              return (
                <div key={conf}>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: CONF_STYLE[conf].fg, marginBottom: 8 }}>
                    {CONF_STYLE[conf].label} Patterns
                  </div>
                  {group.map((p, i) => (
                    <div key={i} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '14px 18px', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.4 }}>{p.title}</div>
                          <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, marginTop: 4 }}>{p.description}</div>
                        </div>
                        <ConfBadge level={p.confidence} />
                      </div>
                      <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 10, color: MUTED, fontFamily: 'monospace' }}>
                        <span>{p.evidenceCount} evidence points</span>
                        <span>{p.campaignsObserved.length} campaigns observed</span>
                        <span>Updated {p.lastUpdated}</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </Section>

        {/* ── Section 2: Campaign Intelligence Memory ─────────────── */}
        <Section
          id="campaigns"
          num="02"
          title="Campaign Intelligence Memory"
          subtitle="Snapshot of each campaign from Watcher and Coach"
          open={openSections.campaigns}
          toggle={() => toggle('campaigns')}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${BORDER}` }}>
                  {['Artist', 'Campaign', 'Type', 'State', 'Health', 'Cadence', 'Formats', 'Conversion', 'Coach Action'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: MUTED, fontWeight: 700 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.campaigns.map((c) => (
                  <tr key={c.slug} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: '10px 10px', fontWeight: 700 }}>
                      <Link href={`/team-watcher/${c.slug}`} style={{ color: INK, textDecoration: 'none' }} className="hover:underline">
                        {c.artist}
                      </Link>
                    </td>
                    <td style={{ padding: '10px 10px', color: MUTED }}>{c.campaignName}</td>
                    <td style={{ padding: '10px 10px' }}>
                      <span style={{ fontSize: 9, fontFamily: 'monospace', padding: '2px 6px', borderRadius: 4, background: '#F3F4F6', color: ACCENT }}>
                        {c.campaignType}
                      </span>
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <span style={{ fontSize: 9, fontFamily: 'monospace', padding: '2px 6px', borderRadius: 4, background: '#F3F4F6', color: ACCENT }}>
                        {c.campaignState}
                      </span>
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <HealthDot status={c.watcher.healthStatus} />
                    </td>
                    <td style={{ padding: '10px 10px', fontFamily: 'monospace', fontSize: 11 }}>
                      {c.watcher.uploadCadence}/30d
                    </td>
                    <td style={{ padding: '10px 10px', fontSize: 10, color: MUTED }}>
                      {c.watcher.shortsRatio}% S · {c.watcher.longformRatio}% L
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <span style={{ fontSize: 9, fontFamily: 'monospace', padding: '2px 6px', borderRadius: 4, background: c.watcher.conversionScore === 'Strong' ? '#ECFDF5' : c.watcher.conversionScore === 'Weak' ? '#FEF2F2' : '#F9FAFB', color: c.watcher.conversionScore === 'Strong' ? GREEN : c.watcher.conversionScore === 'Weak' ? RED : MUTED }}>
                        {c.watcher.conversionScore}
                      </span>
                    </td>
                    <td style={{ padding: '10px 10px', fontSize: 11, color: MUTED, maxWidth: 200 }}>
                      {c.coach.currentRecommendation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── Section 3: Decision Intelligence ─────────────────────── */}
        <Section
          id="decisions"
          num="03"
          title="Decision Intelligence"
          subtitle="Track the quality of recommendations, not just outcomes"
          open={openSections.decisions}
          toggle={() => toggle('decisions')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.decisions.map((d, i) => (
              <div key={i} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{d.artist}</span>
                      <ConfBadge level={d.confidence} />
                      <span style={{ ...badgeStyle(OUTCOME_STYLE[d.outcome]), fontSize: 9 }}>
                        {d.outcome}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                      Recommendation: {d.recommendation}
                    </div>
                    <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.5 }}>
                      <strong style={{ color: ACCENT }}>Why:</strong> {d.why}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 10, fontSize: 10, color: MUTED }}>
                  <strong style={{ color: ACCENT }}>Evidence:</strong>{' '}
                  {d.supportingEvidence.join(' · ')}
                </div>

                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
                  <span style={{ fontFamily: 'monospace', color: ACCENT, fontWeight: 600 }}>
                    Decision Quality:
                  </span>
                  <span style={{ color: d.decisionQuality.includes('Good Decision / Good') ? GREEN : d.decisionQuality.includes('Bad') || d.decisionQuality.includes('Needs') ? AMBER : MUTED }}>
                    {d.decisionQuality}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Section 4: Knowns / Beliefs / Unknowns ──────────────── */}
        <Section
          id="epistemic"
          num="04"
          title="Knowns / Beliefs / Unknowns"
          subtitle="Distinguish what we know from what we think from what we don't know"
          open={openSections.epistemic}
          toggle={() => toggle('epistemic')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.epistemicMap.map((e, i) => (
              <div key={i} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '14px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                  <Link href={`/team-watcher/${e.slug}`} style={{ color: INK, textDecoration: 'none' }} className="hover:underline">
                    {e.artist}
                  </Link>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, fontSize: 11 }}>
                  <div>
                    <div style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: GREEN, fontWeight: 700, marginBottom: 6 }}>
                      Knowns
                    </div>
                    {e.knowns.map((k, j) => (
                      <div key={j} style={{ color: MUTED, lineHeight: 1.6, paddingLeft: 8, borderLeft: `2px solid ${GREEN}20`, marginBottom: 4 }}>
                        {k}
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: AMBER, fontWeight: 700, marginBottom: 6 }}>
                      Beliefs
                    </div>
                    {e.beliefs.map((b, j) => (
                      <div key={j} style={{ color: MUTED, lineHeight: 1.6, paddingLeft: 8, borderLeft: `2px solid ${AMBER}20`, marginBottom: 4 }}>
                        {b}
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: PURPLE, fontWeight: 700, marginBottom: 6 }}>
                      Unknowns
                    </div>
                    {e.unknowns.map((u, j) => (
                      <div key={j} style={{ color: MUTED, lineHeight: 1.6, paddingLeft: 8, borderLeft: `2px solid ${PURPLE}20`, marginBottom: 4 }}>
                        {u}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Section 5: Recommendation Accuracy ──────────────────── */}
        <Section
          id="accuracy"
          num="05"
          title="Recommendation Accuracy"
          subtitle="Which recommendation types consistently appear valuable?"
          open={openSections.accuracy}
          toggle={() => toggle('accuracy')}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${BORDER}` }}>
                  {['Recommendation Type', 'Times Used', 'Positive', 'Neutral', 'Negative', 'Pending'].map((h) => (
                    <th key={h} style={{ textAlign: h === 'Recommendation Type' ? 'left' : 'center', padding: '8px 10px', fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: MUTED, fontWeight: 700 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recAccuracy.map((r) => (
                  <tr key={r.type} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: '10px 10px', fontWeight: 600 }}>{r.type}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 }}>{r.timesUsed}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'center', color: GREEN, fontFamily: 'monospace' }}>{r.positive || '—'}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'center', color: MUTED, fontFamily: 'monospace' }}>{r.neutral || '—'}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'center', color: RED, fontFamily: 'monospace' }}>{r.negative || '—'}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'center', color: PURPLE, fontFamily: 'monospace' }}>{r.pending || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── Section 6: Hypothesis Tracker ────────────────────────── */}
        <Section
          id="hypotheses"
          num="06"
          title="Hypothesis Tracker"
          subtitle="Building an evidence-based playbook over time"
          open={openSections.hypotheses}
          toggle={() => toggle('hypotheses')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.hypotheses.map((h, i) => {
              const st = HYPO_STATUS[h.status];
              return (
                <div key={i} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.4, marginBottom: 4 }}>{h.title}</div>
                      <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>{h.description}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
                      <ConfBadge level={h.confidence} />
                      <span style={{ fontSize: 9, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 4, background: st.bg, color: st.fg, fontWeight: 600 }}>
                        {st.label}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 10, color: MUTED, fontFamily: 'monospace' }}>
                    <span>{h.campaignsTested} campaigns tested</span>
                    <span>{h.evidenceCount} evidence points</span>
                    {h.supportingCampaigns.length > 0 && (
                      <span>Observed: {h.supportingCampaigns.slice(0, 3).join(', ')}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* ── Section 7: Agent Learning Notes ──────────────────────── */}
        <Section
          id="learning"
          num="07"
          title="Agent Learning Notes"
          subtitle="Plain-English summaries of what we're observing"
          open={openSections.learning}
          toggle={() => toggle('learning')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.learningNotes.length === 0 && (
              <div style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>No learning notes generated yet.</div>
            )}
            {data.learningNotes.map((n, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', marginTop: 5, flexShrink: 0, background: n.type === 'positive' ? GREEN : n.type === 'negative' ? RED : MUTED }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: INK, lineHeight: 1.6 }}>{n.text}</div>
                  <div style={{ fontSize: 10, color: MUTED, fontFamily: 'monospace', marginTop: 4 }}>
                    {n.campaign} · {n.date}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Section 8: First Principles Library ──────────────────── */}
        <Section
          id="principles"
          num="08"
          title="First Principles Library"
          subtitle="Foundational beliefs that guide recommendations"
          open={openSections.principles}
          toggle={() => toggle('principles')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.principles.map((p) => (
              <div key={p.id} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ fontSize: 18, fontWeight: 900, color: `${INK}15`, fontFamily: 'monospace', lineHeight: 1, flexShrink: 0, minWidth: 28 }}>
                    {String(p.id).padStart(2, '0')}
                  </span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.4, marginBottom: 4 }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>{p.description}</div>
                    {p.relatedCampaigns.length > 0 && (
                      <div style={{ fontSize: 10, color: MUTED, fontFamily: 'monospace', marginTop: 6 }}>
                        Observed in: {p.relatedCampaigns.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Section 9: Counterfactual Thinking ──────────────────── */}
        <Section
          id="counterfactual"
          num="09"
          title="Counterfactual Thinking"
          subtitle="What might have happened if we had done nothing?"
          open={openSections.counterfactual}
          toggle={() => toggle('counterfactual')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.counterfactuals.map((c, i) => (
              <div key={i} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '14px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{c.artist}</div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                  <AttributionBar label="Content Support" pct={c.contentSupport} color={BLUE} />
                  <AttributionBar label="Release Event" pct={c.releaseEvent} color={AMBER} />
                  <AttributionBar label="External Discovery" pct={c.externalDiscovery} color={MUTED} />
                </div>
                <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>{c.note}</div>
                <div style={{ marginTop: 6 }}>
                  <ConfBadge level={c.interventionConfidence} />
                </div>
              </div>
            ))}
          </div>
        </Section>

      </div>
    </main>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Section({
  id, num, title, subtitle, open, toggle, children,
}: {
  id: string; num: string; title: string; subtitle: string;
  open: boolean; toggle: () => void; children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 32 }}>
      <button
        onClick={toggle}
        style={{
          display: 'flex', alignItems: 'baseline', gap: 10, width: '100%',
          background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0',
          textAlign: 'left', borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: MUTED, fontWeight: 600 }}>{num}</span>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: INK }}>{title}</span>
          <span style={{ fontSize: 11, color: MUTED, marginLeft: 12 }}>{subtitle}</span>
        </div>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: MUTED }}>
          {open ? '▲ collapse' : '▼ expand'}
        </span>
      </button>
      {open && (
        <div style={{ paddingTop: 16 }}>
          {children}
        </div>
      )}
    </section>
  );
}

function ConfBadge({ level }: { level: 'high' | 'medium' | 'experimental' }) {
  const s = CONF_STYLE[level];
  return (
    <span style={{ fontSize: 9, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 4, background: s.bg, color: s.fg, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

function HealthDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    HEALTHY: GREEN, BUILDING: AMBER, 'WEAK CONVERSION': AMBER, 'AT RISK': RED, COLD: RED,
  };
  const c = colors[status] || MUTED;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontFamily: 'monospace' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
      {status}
    </span>
  );
}

function AttributionBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
        <span style={{ color: MUTED }}>{label}</span>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: 4, background: `${color}15`, borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

function badgeStyle(s: { bg: string; fg: string }): React.CSSProperties {
  return {
    fontFamily: 'monospace', padding: '2px 8px', borderRadius: 4,
    background: s.bg, color: s.fg, fontWeight: 600, textTransform: 'capitalize',
  };
}
