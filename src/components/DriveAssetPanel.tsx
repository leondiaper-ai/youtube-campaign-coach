'use client';

/**
 * DriveAssetPanel — Google Drive asset intelligence for a campaign.
 *
 * Renders five things, answering the campaign's asset questions:
 *   1. Asset Library Snapshot   — what do we have?
 *   2. Campaign Readiness Score — what's missing / what should YouTube know next?
 *   3. Banked Content Opportunities — what can we build?
 *   4. Timeline + Asset Mapping — where does it sit, what's ready per milestone?
 *
 * Pure presentation — all logic comes from driveAssets.ts.
 */

import type { GeneratedPlan } from '@/lib/planEngine';
import {
  type AssetLibrary,
  type AssetMappingConfig,
  type DriveAssetClass,
  type MilestoneReadiness,
  type ReadinessScore,
  type SupportInventory,
  type SupportBand,
  ASSET_CLASS_META,
  summarizeLibrary,
  bankedOpportunities,
  mapAssetsToTimeline,
  readinessScore,
  supportInventory,
} from '@/lib/driveAssets';

// ── Editorial design tokens (campaign detail style) ──
const PAPER = '#FAF7F2';
const INK = '#0E0E0E';
const ACCENT_GREEN = '#2D6A4F';
const BONE = '#EBE7DF';
const SMOKE = '#8A847A';
const GHOST = '#C8C2B8';
const WHITE = '#FFFFFF';
const AMBER = '#D97706';
const RED = '#DC2626';
const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace';

// ── Media-type icon glyphs (kept text-only to match editorial restraint) ──
const MEDIA_GLYPH: Record<string, string> = {
  video: '▶', image: '▦', audio: '♪', doc: '▤', other: '·',
};

const READINESS_TONE: Record<MilestoneReadiness, { color: string; label: string; dot: string }> = {
  ready:           { color: ACCENT_GREEN, label: 'Ready',        dot: ACCENT_GREEN },
  anchor_partial:  { color: AMBER,        label: 'Anchor ready', dot: AMBER },
  support_partial: { color: '#B45309',    label: 'Support only', dot: '#B45309' },
  missing:         { color: RED,          label: 'Missing',      dot: RED },
  na:              { color: GHOST,        label: '—',            dot: GHOST },
};

function fmtBytes(n?: number): string {
  if (!n) return '';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB';
  if (n >= 1e6) return (n / 1e6).toFixed(0) + ' MB';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' KB';
  return n + ' B';
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const label = (cls: DriveAssetClass) => ASSET_CLASS_META[cls].label;

// ── Section header ──
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 800, letterSpacing: '0.3em',
      textTransform: 'uppercase', color: GHOST, fontFamily: MONO,
      marginBottom: 14,
    }}>
      {children}
    </div>
  );
}

// ── Empty state ──
function EmptyState({ folderUrl }: { folderUrl?: string }) {
  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 40px 0' }}>
      <div style={{ width: '100%', height: 1, background: BONE, marginBottom: 24 }} />
      <SectionLabel>Drive Asset Library</SectionLabel>
      <div style={{
        padding: '28px 24px', background: WHITE,
        border: `1px dashed ${GHOST}`, borderRadius: 8,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: INK, marginBottom: 6 }}>
          No asset library connected yet
        </div>
        <div style={{ fontSize: 13, color: SMOKE, lineHeight: 1.5, maxWidth: 560 }}>
          Add a Drive folder or paste asset scan results to map this
          campaign&rsquo;s raw assets to the rollout timeline.
        </div>
        {folderUrl && (
          <a
            href={folderUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block', marginTop: 14,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', fontFamily: MONO,
              color: WHITE, background: ACCENT_GREEN,
              padding: '6px 14px', borderRadius: 4, textDecoration: 'none',
            }}
          >
            Open configured folder ↗
          </a>
        )}
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN PANEL
// ══════════════════════════════════════════════════════════════════════════

export default function DriveAssetPanel({
  library,
  plan,
  config,
  folderUrl,
}: {
  library: AssetLibrary | null;
  plan: GeneratedPlan;
  config?: AssetMappingConfig;
  folderUrl?: string;
}) {
  if (!library || library.assets.length === 0) {
    return <EmptyState folderUrl={folderUrl} />;
  }

  const summary = summarizeLibrary(library);
  const opportunities = bankedOpportunities(library);
  const mappings = mapAssetsToTimeline(library, plan, config);
  const readiness = readinessScore(library, plan, config);
  const support = supportInventory(library);

  return (
    <div style={{ background: PAPER, color: INK }}>
      {/* Divider + section title */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 40px 0' }}>
        <div style={{ width: '100%', height: 1, background: BONE, marginBottom: 24 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
          <SectionLabel>Drive Asset Library</SectionLabel>
          {library.folderUrl && (
            <a
              href={library.folderUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', fontFamily: MONO,
                color: WHITE, background: ACCENT_GREEN,
                padding: '6px 14px', borderRadius: 4, textDecoration: 'none',
              }}
            >
              Open Drive ↗
            </a>
          )}
        </div>
      </section>

      {/* ── 1. ASSET LIBRARY SNAPSHOT ── */}
      <Snapshot summary={summary} library={library} />

      {/* ── 2. RELEASE READINESS + SUPPORT INVENTORY ── */}
      <ScoreCards readiness={readiness} support={support} />

      {/* ── 3. BANKED CONTENT OPPORTUNITIES ── */}
      <Opportunities opportunities={opportunities} />

      {/* ── 4. TIMELINE + ASSET MAPPING ── */}
      <TimelineMapping mappings={mappings} />
    </div>
  );
}

// ── 1. Snapshot ──
function Snapshot({
  summary,
  library,
}: {
  summary: ReturnType<typeof summarizeLibrary>;
  library: AssetLibrary;
}) {
  const stats = [
    { k: 'Total assets', v: summary.total },
    { k: 'Videos', v: summary.videos },
    { k: 'Images', v: summary.images },
    { k: 'Audio', v: summary.audio },
    { k: 'Docs', v: summary.docs },
  ];
  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '12px 40px 0' }}>
      <div style={{
        background: WHITE, border: `1px solid ${BONE}`, borderRadius: 10,
        padding: '20px 24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: INK, letterSpacing: '-0.01em' }}>
            {library.folderName || 'Asset folder'}
          </div>
          <div style={{ fontSize: 10, color: GHOST, fontFamily: MONO, letterSpacing: '0.06em' }}>
            Last updated {fmtDate(summary.lastUpdated)} · scanned {fmtDate(library.scannedAt)}
          </div>
        </div>

        {/* Stat row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {stats.map((s) => (
            <div key={s.k}>
              <div style={{ fontSize: 30, fontWeight: 900, color: INK, fontFamily: MONO, lineHeight: 1, letterSpacing: '-0.03em' }}>
                {s.v}
              </div>
              <div style={{ fontSize: 9, fontWeight: 700, color: SMOKE, fontFamily: MONO, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 6 }}>
                {s.k}
              </div>
            </div>
          ))}
        </div>

        {/* Class breakdown chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 18, paddingTop: 16, borderTop: `1px solid ${BONE}` }}>
          {summary.byClass.map((c) => (
            <span key={c.cls} style={{
              fontSize: 11, fontFamily: MONO, color: c.anchor ? ACCENT_GREEN : SMOKE,
              background: c.anchor ? 'rgba(45,106,79,0.08)' : PAPER,
              border: `1px solid ${c.anchor ? 'rgba(45,106,79,0.25)' : BONE}`,
              padding: '3px 9px', borderRadius: 3,
            }}>
              {c.label} <strong style={{ color: INK }}>{c.count}</strong>
            </span>
          ))}
        </div>

        {/* File list (compact) */}
        <details style={{ marginTop: 16 }}>
          <summary style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: GHOST, fontFamily: MONO, cursor: 'pointer',
          }}>
            All {summary.total} files
          </summary>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {library.assets.map((a) => (
              <a key={a.id}
                href={a.webViewLink || '#'}
                target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 8px', borderRadius: 4, textDecoration: 'none',
                  color: 'inherit', background: PAPER,
                }}>
                <span style={{ fontSize: 12, color: SMOKE, width: 14, textAlign: 'center' }}>
                  {MEDIA_GLYPH[a.mediaType]}
                </span>
                <span style={{ fontSize: 12, color: INK, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.name}
                </span>
                <span style={{ fontSize: 10, color: ASSET_CLASS_META[a.assetClass].anchor ? ACCENT_GREEN : SMOKE, fontFamily: MONO }}>
                  {label(a.assetClass)}
                </span>
                {a.sizeBytes ? (
                  <span style={{ fontSize: 9, color: GHOST, fontFamily: MONO, width: 56, textAlign: 'right' }}>
                    {fmtBytes(a.sizeBytes)}
                  </span>
                ) : null}
              </a>
            ))}
          </div>
        </details>
      </div>
    </section>
  );
}

// ── 2. Release Readiness + Support Inventory (two cards) ──
const RELEASE_BAND_COLOR: Record<ReadinessScore['band'], string> = {
  'Ready': ACCENT_GREEN, 'On track': ACCENT_GREEN, 'Building': AMBER, 'Thin': RED,
};
const SUPPORT_BAND_COLOR: Record<SupportBand, string> = {
  'Deep': ACCENT_GREEN, 'Strong': ACCENT_GREEN, 'Building': AMBER, 'Weak': SMOKE,
};

function ScoreCards({ readiness, support }: { readiness: ReadinessScore; support: SupportInventory }) {
  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '12px 40px 0' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 12,
      }}>
        {/* CARD 1 — Release Readiness (primary, dark) */}
        <div style={{ background: INK, color: PAPER, borderRadius: 10, padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO }}>
                Release Readiness
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 48, fontWeight: 900, fontFamily: MONO, lineHeight: 1, letterSpacing: '-0.04em', color: WHITE }}>
                  {readiness.score}
                </span>
                <span style={{ fontSize: 11, color: GHOST, fontFamily: MONO }}>/100</span>
              </div>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: WHITE, background: RELEASE_BAND_COLOR[readiness.band],
              padding: '4px 12px', borderRadius: 4, fontFamily: MONO, whiteSpace: 'nowrap',
            }}>
              {readiness.band}
            </span>
          </div>

          {/* Main gap */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginBottom: 5 }}>
              Main gap
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: WHITE }}>
              {readiness.headline}
            </div>
          </div>

          {/* Factor bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 16 }}>
            {readiness.factors.map((f) => {
              const pct = f.max > 0 ? (f.points / f.max) * 100 : 0;
              return (
                <div key={f.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: PAPER, fontWeight: 600 }}>{f.label}</span>
                    <span style={{ fontSize: 9, color: GHOST, fontFamily: MONO }}>{f.points}/{f.max}</span>
                  </div>
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.12)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: pct >= 70 ? ACCENT_GREEN : pct >= 40 ? AMBER : RED, borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CARD 2 — Support Inventory (secondary, light) */}
        <div style={{ background: WHITE, border: `1px solid ${BONE}`, borderRadius: 10, padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO }}>
                Support Inventory
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 48, fontWeight: 900, fontFamily: MONO, lineHeight: 1, letterSpacing: '-0.04em', color: INK }}>
                  {support.score}
                </span>
                <span style={{ fontSize: 11, color: GHOST, fontFamily: MONO }}>/100</span>
              </div>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: WHITE, background: SUPPORT_BAND_COLOR[support.band],
              padding: '4px 12px', borderRadius: 4, fontFamily: MONO, whiteSpace: 'nowrap',
            }}>
              {support.band}
            </span>
          </div>

          {/* Support depth */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginBottom: 5 }}>
              Support depth
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: INK }}>
              {support.depth}
            </div>
          </div>

          {/* Best available formats */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginBottom: 8 }}>
              Best available formats
            </div>
            {support.bestFormats.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {support.bestFormats.map((b) => (
                  <span key={b.label} style={{
                    fontSize: 11, fontFamily: MONO, color: INK,
                    background: PAPER, border: `1px solid ${BONE}`,
                    padding: '3px 9px', borderRadius: 3,
                  }}>
                    {b.label} <strong>{b.count}</strong>
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: SMOKE }}>No supporting material yet.</div>
            )}
            <div style={{ fontSize: 9, color: GHOST, fontFamily: MONO, marginTop: 10, letterSpacing: '0.04em' }}>
              Support only — does not imply release readiness.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── 3. Opportunities ──
function Opportunities({ opportunities }: { opportunities: ReturnType<typeof bankedOpportunities> }) {
  const STATUS_TONE = {
    banked:      { color: ACCENT_GREEN, label: 'Banked',      bg: 'rgba(45,106,79,0.07)', border: 'rgba(45,106,79,0.25)' },
    partial:     { color: AMBER,        label: 'Buildable',   bg: 'rgba(217,119,6,0.07)', border: 'rgba(217,119,6,0.25)' },
    recommended: { color: SMOKE,        label: 'Missing',     bg: PAPER,                  border: BONE },
  } as const;

  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 40px 0' }}>
      <SectionLabel>Banked Content Opportunities</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
        {opportunities.map((o, i) => {
          const tone = STATUS_TONE[o.status];
          return (
            <div key={i} style={{
              background: WHITE, border: `1px solid ${tone.border}`, borderRadius: 8,
              padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: INK, lineHeight: 1.2 }}>{o.output}</span>
                <span style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: tone.color, background: tone.bg, border: `1px solid ${tone.border}`,
                  padding: '3px 8px', borderRadius: 3, fontFamily: MONO, flexShrink: 0,
                }}>
                  {tone.label}
                </span>
              </div>
              <div style={{ fontSize: 12, color: SMOKE, lineHeight: 1.45 }}>{o.note}</div>
              {o.sourceClasses.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {o.sourceClasses.map((c) => (
                    <span key={c} style={{ fontSize: 9, color: SMOKE, fontFamily: MONO, background: PAPER, border: `1px solid ${BONE}`, padding: '2px 6px', borderRadius: 2 }}>
                      {label(c)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── 4. Timeline mapping ──
function TimelineMapping({ mappings }: { mappings: ReturnType<typeof mapAssetsToTimeline> }) {
  if (mappings.length === 0) return null;
  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 40px 0' }}>
      <SectionLabel>Timeline + Asset Mapping</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {mappings.map((m, i) => {
          const tone = READINESS_TONE[m.readiness];
          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '96px 1fr auto', gap: 16, alignItems: 'center',
              background: WHITE, border: `1px solid ${BONE}`,
              borderLeft: `3px solid ${tone.dot}`,
              borderRadius: 6, padding: '12px 16px',
            }}>
              {/* Date */}
              <div style={{ fontSize: 11, color: SMOKE, fontFamily: MONO, letterSpacing: '0.02em' }}>
                {fmtDate(m.dateISO)}
              </div>

              {/* Title + matched/missing */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.title}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
                  {m.present.map((c) => (
                    <span key={`p-${c}`} style={{ fontSize: 9, color: ACCENT_GREEN, fontFamily: MONO, background: 'rgba(45,106,79,0.08)', padding: '2px 6px', borderRadius: 2 }}>
                      ✓ {label(c)}
                    </span>
                  ))}
                  {m.missing.map((c) => (
                    <span key={`m-${c}`} style={{ fontSize: 9, color: SMOKE, fontFamily: MONO, background: PAPER, border: `1px dashed ${GHOST}`, padding: '2px 6px', borderRadius: 2 }}>
                      ✕ {label(c)}
                    </span>
                  ))}
                  {m.assets.length > 0 && (
                    <span style={{ fontSize: 9, color: GHOST, fontFamily: MONO, padding: '2px 4px' }}>
                      {m.assets.length} file{m.assets.length === 1 ? '' : 's'} matched
                    </span>
                  )}
                </div>
              </div>

              {/* Readiness badge */}
              <div style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: tone.color, fontFamily: MONO, whiteSpace: 'nowrap',
              }}>
                {tone.label}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
