'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { AgentMemoryData } from '@/app/api/agent-memory/route';

// ── Design tokens — research-lab palette ────────────────────────────────────
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
const TEAL = '#0D9488';

const HEALTH_COLORS: Record<string, string> = {
  HEALTHY: GREEN, BUILDING: AMBER, 'WEAK CONVERSION': AMBER, 'AT RISK': RED, COLD: RED,
};

const OUTLIER_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  overperformer:       { bg: '#ECFDF5', fg: GREEN, label: 'Outperforming' },
  underperformer:      { bg: '#FEF2F2', fg: RED, label: 'Underperforming' },
  unexpected_pattern:  { bg: '#FFFBEB', fg: AMBER, label: 'Unexpected' },
  dormant_interest:    { bg: '#F5F3FF', fg: PURPLE, label: 'Dormant Interest' },
};

const QUESTION_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  gathering_evidence:  { bg: '#F5F3FF', fg: PURPLE, label: 'Gathering Evidence' },
  early_signal:        { bg: '#FFFBEB', fg: AMBER, label: 'Early Signal' },
  needs_investigation: { bg: '#F3F4F6', fg: ACCENT, label: 'Needs Investigation' },
};

// ── Component ────────────────────────────────────────────────────────────────

export default function AgentMemory() {
  const [data, setData] = useState<AgentMemoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    winners: true,
    ecosystems: true,
    playbooks: true,
    outliers: true,
    assetIntel: false,
    assetPatterns: false,
    questions: true,
    learnings: false,
  });

  useEffect(() => {
    fetch('/api/agent-memory')
      .then((r) => { if (!r.ok) throw new Error('Failed'); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError('Failed to load intelligence data'); setLoading(false); });
  }, []);

  const toggle = (key: string) => setOpenSections((p) => ({ ...p, [key]: !p[key] }));

  if (loading) {
    return (
      <main style={{ background: BG, minHeight: '100vh' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: MUTED, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
            Scanning channels…
          </div>
          <div style={{ fontSize: 11, color: MUTED, opacity: 0.5, marginTop: 8 }}>
            Analysing ecosystems, assets, and campaign outcomes
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
            Internal · Research Desk
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', margin: 0 }}>
            YouTube Intelligence Lab
          </h1>
          <p style={{ fontSize: 12, color: MUTED, marginTop: 6, lineHeight: 1.6, maxWidth: 620 }}>
            What campaigns are working? What should we bank for the future? What patterns are emerging?
            This page surfaces discoveries across {data.meta.channelCount} monitored channels.
          </p>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 10, fontFamily: 'monospace', color: MUTED }}>
            <span>{data.meta.channelCount} channels</span>
            <span>·</span>
            <span>{data.meta.campaignCount} active campaigns</span>
            <span>·</span>
            <span>Updated {new Date(data.meta.lastUpdated).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </header>

        {/* ── Section 1: Emerging Winners ────────────────────────── */}
        <Section
          id="winners" num="01" title="Emerging Winners"
          subtitle="Channels outperforming expectations — the most interesting, not the biggest"
          open={openSections.winners} toggle={() => toggle('winners')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.emergingWinners.map((w) => (
              <div key={w.slug} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Link href={`/team-watcher/${w.slug}`} style={{ fontSize: 14, fontWeight: 700, color: INK, textDecoration: 'none' }} className="hover:underline">
                      {w.artist}
                    </Link>
                    <HealthDot status={w.healthStatus} />
                    {w.subs != null && (
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: MUTED }}>{formatSubs(w.subs)}</span>
                    )}
                  </div>
                  <span style={{ fontSize: 10, fontFamily: 'monospace', color: MUTED }}>{w.campaign}</span>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: TEAL, fontWeight: 700, marginBottom: 6 }}>
                    Why Interesting
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {w.whyInteresting.map((r, i) => (
                      <span key={i} style={{ fontSize: 10, padding: '3px 10px', background: `${TEAL}08`, border: `1px solid ${TEAL}20`, borderRadius: 6, color: INK }}>
                        {r}
                      </span>
                    ))}
                  </div>
                </div>

                {w.potentialSuccessFactors.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: BLUE, fontWeight: 700, marginBottom: 6 }}>
                      Potential Success Factors
                    </div>
                    <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
                      {w.potentialSuccessFactors.join(' · ')}
                    </div>
                  </div>
                )}

                <div>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: PURPLE, fontWeight: 700, marginBottom: 6 }}>
                    Questions
                  </div>
                  {w.questions.map((q, i) => (
                    <div key={i} style={{ fontSize: 11, color: MUTED, lineHeight: 1.6, paddingLeft: 10, borderLeft: `2px solid ${PURPLE}20`, marginBottom: 3 }}>
                      {q}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 10, fontFamily: 'monospace', color: MUTED, paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
                  <span>{w.uploadCadence} uploads/30d</span>
                  <span>{w.formatCount} formats</span>
                  <span>Conversion: {w.conversionLabel}</span>
                </div>
              </div>
            ))}
            {data.emergingWinners.length === 0 && (
              <div style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>No emerging winners surfaced this period.</div>
            )}
          </div>
        </Section>

        {/* ── Section 2: Best Ecosystems ─────────────────────────── */}
        <Section
          id="ecosystems" num="02" title="Best Ecosystems"
          subtitle="Ranked by ecosystem quality — consistency, format diversity, and campaign support"
          open={openSections.ecosystems} toggle={() => toggle('ecosystems')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {data.ecosystems.map((e, idx) => (
              <div key={e.slug} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', background: idx % 2 === 0 ? SURFACE : BG, borderRadius: idx === 0 ? '8px 8px 0 0' : idx === data.ecosystems.length - 1 ? '0 0 8px 8px' : 0, border: `1px solid ${BORDER}`, borderTop: idx > 0 ? 'none' : undefined }}>
                {/* Rank */}
                <span style={{ fontSize: 16, fontWeight: 900, color: idx < 3 ? TEAL : `${INK}25`, fontFamily: 'monospace', minWidth: 28, textAlign: 'center' }}>
                  {idx + 1}
                </span>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Link href={`/team-watcher/${e.slug}`} style={{ fontSize: 13, fontWeight: 700, color: INK, textDecoration: 'none' }} className="hover:underline">
                      {e.artist}
                    </Link>
                    <HealthDot status={e.healthStatus} />
                    <span style={{ fontSize: 9, fontFamily: 'monospace', color: MUTED }}>{e.campaign}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {e.formats.map((f) => (
                      <span key={f} style={{ fontSize: 8, fontFamily: 'monospace', padding: '1px 6px', borderRadius: 3, background: '#F3F4F6', color: ACCENT }}>
                        {f}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 16, fontSize: 10, fontFamily: 'monospace', color: MUTED, flexShrink: 0 }}>
                  <span>{e.uploads30d} upl</span>
                  <span>{e.shorts30d}S/{e.longform30d}L</span>
                  <span>{e.conversionLabel}</span>
                </div>

                {/* Score bar */}
                <div style={{ width: 60, flexShrink: 0 }}>
                  <div style={{ height: 4, background: `${TEAL}15`, borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${e.score}%`, background: TEAL, borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: TEAL, textAlign: 'right', marginTop: 2 }}>
                    {e.score}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Section 3: Playbooks Worth Banking ─────────────────── */}
        <Section
          id="playbooks" num="03" title="Playbooks Worth Banking"
          subtitle="Campaign case studies — what happened, what worked, would we reuse it?"
          open={openSections.playbooks} toggle={() => toggle('playbooks')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.playbooks.map((p) => (
              <div key={p.slug} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '16px 20px' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Link href={`/team-watcher/${p.slug}`} style={{ fontSize: 14, fontWeight: 700, color: INK, textDecoration: 'none' }} className="hover:underline">
                      {p.artist}
                    </Link>
                    <HealthDot status={p.healthStatus} />
                  </div>
                  <span style={{
                    fontSize: 10, fontFamily: 'monospace', fontWeight: 700, padding: '3px 10px', borderRadius: 4,
                    background: p.wouldReuse ? '#ECFDF5' : '#FEF2F2',
                    color: p.wouldReuse ? GREEN : RED,
                  }}>
                    {p.wouldReuse ? 'WOULD REUSE' : 'NEEDS WORK'}
                  </span>
                </div>

                {/* What Happened */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: ACCENT, fontWeight: 700, marginBottom: 4 }}>
                    What Happened
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                    <span><strong>{p.whatHappened.totalUploads}</strong> uploads</span>
                    <span><strong>{p.whatHappened.shorts}</strong> Shorts</span>
                    <span><strong>{p.whatHappened.longform}</strong> Longform</span>
                  </div>
                  {p.whatHappened.formats.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                      {p.whatHappened.formats.map((f) => (
                        <span key={f} style={{ fontSize: 8, fontFamily: 'monospace', padding: '2px 6px', borderRadius: 3, background: '#F3F4F6', color: ACCENT }}>
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* What Worked */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: GREEN, fontWeight: 700, marginBottom: 4 }}>
                    What Worked
                  </div>
                  {p.whatWorked.map((w, i) => (
                    <div key={i} style={{ fontSize: 11, color: MUTED, lineHeight: 1.6, paddingLeft: 10, borderLeft: `2px solid ${GREEN}20`, marginBottom: 3 }}>
                      {w}
                    </div>
                  ))}
                </div>

                {/* Coach plan info if available */}
                {p.planWeeks > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: BLUE, fontWeight: 700, marginBottom: 4 }}>
                      Coach Plan
                    </div>
                    <div style={{ fontSize: 11, color: MUTED }}>
                      {p.planWeeks}-week plan{p.strategy ? ` · Strategy: ${p.strategy}` : ''}{p.completionRate > 0 ? ` · ${p.completionRate}% completed` : ''}
                    </div>
                    {p.timeline.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        {p.timeline.slice(0, 5).map((t, i) => (
                          <span key={i} style={{ fontSize: 9, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 4, background: `${BLUE}08`, color: BLUE }}>
                            {t.date} — {t.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
                  {p.tags.map((t) => (
                    <span key={t} style={{ fontSize: 9, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 4, background: '#F3F4F6', color: ACCENT, fontWeight: 600 }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {data.playbooks.length === 0 && (
              <div style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>No campaigns with enough data for a case study yet.</div>
            )}
          </div>
        </Section>

        {/* ── Section 4: Interesting Outliers ─────────────────────── */}
        <Section
          id="outliers" num="04" title="Interesting Outliers"
          subtitle="Channels behaving differently from expectations — worth investigating"
          open={openSections.outliers} toggle={() => toggle('outliers')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.outliers.map((o, i) => {
              const style = OUTLIER_STYLE[o.category] || OUTLIER_STYLE.unexpected_pattern;
              return (
                <div key={i} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Link href={`/team-watcher/${o.slug}`} style={{ fontSize: 13, fontWeight: 700, color: INK, textDecoration: 'none' }} className="hover:underline">
                        {o.artist}
                      </Link>
                      <HealthDot status={o.healthStatus} />
                      {o.subs != null && (
                        <span style={{ fontSize: 10, fontFamily: 'monospace', color: MUTED }}>{formatSubs(o.subs)}</span>
                      )}
                    </div>
                    <span style={{ fontSize: 9, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 4, background: style.bg, color: style.fg, fontWeight: 600 }}>
                      {style.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: INK }}>{o.observation}</div>
                  {o.details.map((d, j) => (
                    <div key={j} style={{ fontSize: 11, color: MUTED, lineHeight: 1.6, paddingLeft: 10, borderLeft: `2px solid ${style.fg}20`, marginBottom: 3 }}>
                      {d}
                    </div>
                  ))}
                </div>
              );
            })}
            {data.outliers.length === 0 && (
              <div style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>No notable outliers detected this period.</div>
            )}
          </div>
        </Section>

        {/* ── Section 5: Asset Intelligence ───────────────────────── */}
        <Section
          id="assetIntel" num="05" title="Asset Intelligence"
          subtitle="What assets are campaigns deploying — and what's missing?"
          open={openSections.assetIntel} toggle={() => toggle('assetIntel')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {data.assetIntel.map((a, idx) => (
              <div key={a.assetType} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', background: idx % 2 === 0 ? SURFACE : BG, borderRadius: idx === 0 ? '8px 8px 0 0' : idx === data.assetIntel.length - 1 ? '0 0 8px 8px' : 0, border: `1px solid ${BORDER}`, borderTop: idx > 0 ? 'none' : undefined }}>
                <span style={{ fontSize: 12, fontWeight: 700, minWidth: 120 }}>{a.assetType}</span>

                {/* Bar */}
                <div style={{ flex: 1 }}>
                  <div style={{ height: 16, background: `${RED}10`, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ height: '100%', width: `${a.percentage}%`, background: a.percentage >= 50 ? GREEN : a.percentage >= 25 ? AMBER : RED, borderRadius: 4, transition: 'width 0.3s' }} />
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 8, fontSize: 10, fontFamily: 'monospace', flexShrink: 0 }}>
                  <span style={{ color: GREEN, fontWeight: 600 }}>{a.available} have</span>
                  <span style={{ color: RED }}>{a.missing} missing</span>
                  <span style={{ color: MUTED }}>({a.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
          {data.assetIntel.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 9, fontFamily: 'monospace', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Most missing: {data.assetIntel.filter((a) => a.percentage < 50).map((a) => a.assetType).join(', ') || 'None'}
            </div>
          )}
        </Section>

        {/* ── Section 6: Asset Success Patterns ──────────────────── */}
        <Section
          id="assetPatterns" num="06" title="Asset Success Patterns"
          subtitle="Observations, not conclusions — let the evidence emerge"
          open={openSections.assetPatterns} toggle={() => toggle('assetPatterns')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.assetPatterns.map((ap) => (
              <div key={ap.assetType} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '14px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                  {ap.assetType}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <PatternColumn
                    label={`With ${ap.assetType}`}
                    count={ap.withAsset.count}
                    cadence={ap.withAsset.avgCadence}
                    formats={ap.withAsset.avgFormatCount}
                    healthyPct={ap.withAsset.healthyPct}
                    accent={GREEN}
                  />
                  <PatternColumn
                    label={`Without ${ap.assetType}`}
                    count={ap.withoutAsset.count}
                    cadence={ap.withoutAsset.avgCadence}
                    formats={ap.withoutAsset.avgFormatCount}
                    healthyPct={ap.withoutAsset.healthyPct}
                    accent={MUTED}
                  />
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Section 7: Open Questions ──────────────────────────── */}
        <Section
          id="questions" num="07" title="Open Questions"
          subtitle="Things we cannot confidently answer yet — tracking what we're still learning"
          open={openSections.questions} toggle={() => toggle('questions')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.openQuestions.map((q, i) => {
              const st = QUESTION_STYLE[q.status] || QUESTION_STYLE.gathering_evidence;
              return (
                <div key={i} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, flex: 1 }}>{q.question}</div>
                    <span style={{ fontSize: 9, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 4, background: st.bg, color: st.fg, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {st.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 10, fontFamily: 'monospace', color: MUTED }}>
                    <span>{q.evidenceCount} campaigns observed</span>
                    {q.relatedCampaigns.length > 0 && (
                      <span>Related: {q.relatedCampaigns.join(', ')}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* ── Section 8: Weekly Learnings ─────────────────────────── */}
        <Section
          id="learnings" num="08" title="Weekly Learnings"
          subtitle="Confirmed, challenged, and still unknown — a genuine research mindset"
          open={openSections.learnings} toggle={() => toggle('learnings')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(['confirmed', 'challenged', 'unknown'] as const).map((cat) => {
              const items = data.weeklyLearnings.filter((l) => l.category === cat);
              if (items.length === 0) return null;
              const catStyle = { confirmed: { color: GREEN, label: 'Confirmed' }, challenged: { color: AMBER, label: 'Challenged' }, unknown: { color: PURPLE, label: 'Unknown' } }[cat];
              return (
                <div key={cat}>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: catStyle.color, fontWeight: 700, marginBottom: 8 }}>
                    {catStyle.label}
                  </div>
                  {items.map((l, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, marginBottom: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', marginTop: 6, flexShrink: 0, background: catStyle.color }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: INK, lineHeight: 1.6 }}>{l.text}</div>
                        <div style={{ fontSize: 10, fontFamily: 'monospace', color: MUTED, marginTop: 4 }}>{l.campaign}</div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </Section>

      </div>
    </main>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

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

function HealthDot({ status }: { status: string }) {
  const c = HEALTH_COLORS[status] || MUTED;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontFamily: 'monospace' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
      {status}
    </span>
  );
}

function PatternColumn({ label, count, cadence, formats, healthyPct, accent }: {
  label: string; count: number; cadence: number; formats: number; healthyPct: number; accent: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: accent, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </div>
      <div style={{ fontSize: 11, color: MUTED, lineHeight: 2 }}>
        <div><strong style={{ color: INK }}>{count}</strong> campaigns</div>
        <div>Avg cadence: <strong style={{ color: INK }}>{cadence}</strong>/month</div>
        <div>Avg formats: <strong style={{ color: INK }}>{formats}</strong></div>
        <div>Healthy: <strong style={{ color: healthyPct >= 40 ? GREEN : healthyPct >= 20 ? AMBER : RED }}>{healthyPct}%</strong></div>
      </div>
    </div>
  );
}

function formatSubs(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M subs`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K subs`;
  return `${n} subs`;
}
