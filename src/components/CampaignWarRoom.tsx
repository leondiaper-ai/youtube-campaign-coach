'use client';

/**
 * CampaignWarRoom — Content Planner V4.
 *
 * One master campaign timeline as the storytelling spine. Everything else
 * (readiness, support inventory, asset snapshot, YouTube activity) exists to
 * support it, not compete with it.
 *
 * Page order:
 *   1. Campaign header  — artist · campaign · phase + Release Readiness +
 *      Support Inventory + Primary Gap (compact, above the fold)
 *   2. Asset snapshot   — counts, Open Drive, banked opportunities
 *   3. Master timeline  — the hero. Each milestone merges campaign info,
 *      assets available/missing, YouTube context, and recommended actions.
 *   4. YouTube activity — slim context strip (never the hero)
 *   5. Edit timeline    — compact regenerate affordance
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type {
  GeneratedPlan, ParsedEvent, PhaseName, TimelineKind, ChannelContext,
} from '@/lib/planEngine';
import type { RecentUpload } from '@/lib/artists';
import { fmtNum } from '@/lib/artists';
import {
  type AssetLibrary, type AssetMappingConfig, type DriveAssetClass,
  type MilestoneReadiness, type MilestoneMapping,
  ASSET_CLASS_META, summarizeLibrary, mapAssetsToTimeline,
  readinessScore, supportInventory,
} from '@/lib/driveAssets';

// ── Editorial palette ──
const PAPER = '#FAF7F2';
const INK = '#0E0E0E';
const ACCENT = '#2D6A4F';
const BONE = '#E7E2D8';
const SMOKE = '#857F74';
const GHOST = '#B8B2A6';
const WHITE = '#FFFFFF';
const AMBER = '#B45309';
const RED = '#B91C1C';
const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const PHASE_TONE: Record<PhaseName, { label: string; color: string }> = {
  BUILD: { label: 'Build', color: '#4338CA' },
  RELEASE: { label: 'Release', color: '#DC2626' },
  SCALE: { label: 'Scale', color: ACCENT },
  EXTEND: { label: 'Extend', color: '#D97706' },
};

const READINESS_TONE: Record<MilestoneReadiness, { label: string; color: string }> = {
  ready: { label: 'Ready', color: ACCENT },
  anchor_partial: { label: 'Anchor Ready', color: AMBER },
  support_partial: { label: 'Support Only', color: AMBER },
  missing: { label: 'Not Started', color: RED },
  na: { label: '—', color: GHOST },
};

// ── Date helpers ──
const todayISO = () => new Date().toISOString().split('T')[0];
function dlabel(iso: string): { mon: string; day: string } {
  const d = new Date(iso + 'T12:00:00');
  return { mon: MONTHS[d.getUTCMonth()], day: String(d.getUTCDate()) };
}
function daysFromNow(iso: string): number {
  return Math.round((new Date(iso + 'T12:00:00').getTime() - Date.now()) / 86400000);
}
function relDays(iso: string): string {
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.round(d / 30)}mo ago`;
  return `${Math.round(d / 365)}y ago`;
}

const STOP = new Set(['the', 'and', 'release', 'single', 'album', 'video', 'official', 'feat', 'ft', 'with', 'live', 'tour', 'day', 'out', 'now', 'song', 'announcement', 'announce']);
function tok(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length >= 4 && !STOP.has(t));
}

const clsLabel = (c: DriveAssetClass) => ASSET_CLASS_META[c].label;

// ── Phase model from events ──
const RELEASE_KINDS = new Set<TimelineKind>(['singleRelease', 'albumRelease', 'documentaryRelease']);
function phaseForDate(iso: string, firstRel?: string, lastRel?: string): PhaseName {
  if (!firstRel) return 'BUILD';
  if (iso < firstRel) return 'BUILD';
  if (lastRel && iso > lastRel) return 'SCALE';
  return 'RELEASE';
}

// ── Recommended actions per milestone ──
function recommendedActions(m: MilestoneMapping, hasAnchor: boolean): string[] {
  const out: string[] = [];
  const missing = new Set(m.missing);
  if (!hasAnchor) out.push('Secure anchor video (official video / visualiser)');
  if (m.kind === 'singleRelease' || m.kind === 'albumRelease') {
    if (hasAnchor) out.push('Schedule Premiere');
    if (missing.has('shorts_cutdown')) out.push('Prepare Shorts bridge');
  }
  if (m.kind === 'albumAnnounce') {
    out.push('Community post + announcement trailer');
    out.push('YouTube notification moment');
  }
  if (m.kind === 'documentaryRelease') {
    out.push('Documentary Premiere');
    out.push('Cut doc clip Shorts');
  }
  if (m.kind === 'tourDate' || m.kind === 'liveShow' || m.kind === 'festival') {
    out.push('Capture live Shorts');
    out.push('Performance upload');
  }
  if (missing.has('artwork')) out.push('Prepare artwork / thumbnail pack');
  if (out.length === 0) out.push('Maintain cadence — bridge Short or Community post');
  return out.slice(0, 3);
}

const ANCHOR_CLASSES = new Set<DriveAssetClass>(['official_video', 'visualiser', 'lyric_video', 'documentary']);

// ── Props ──
type Props = {
  plan: GeneratedPlan;
  slug: string;
  artistName: string;
  timelineText?: string;
  channelCtx: ChannelContext | null;
  campaignStartDate?: string;
  driveLibrary?: AssetLibrary | null;
  driveConfig?: AssetMappingConfig;
  driveFolderUrl?: string;
  recentUploads?: RecentUpload[];
  liveChannel?: {
    subs?: number; views?: number; uploads30d?: number; shorts30d?: number;
    lastUploadDaysAgo?: number; views7Delta?: number | null; subs7Delta?: number | null;
  } | null;
};

export default function CampaignWarRoom(props: Props) {
  const { plan, driveLibrary, driveConfig, driveFolderUrl, recentUploads = [], liveChannel } = props;
  const campaignTitle = plan.campaignName.replace(/ Campaign$/i, '');

  const lib: AssetLibrary = driveLibrary ?? { slug: props.slug, folderUrl: driveFolderUrl ?? '', scannedAt: '', assets: [] };
  const hasAssets = lib.assets.length > 0;

  const { summary, mappings, readiness, support, primaryGap, phases, currentPhase } = useMemo(() => {
    const summary = summarizeLibrary(lib);
    const mappings = mapAssetsToTimeline(lib, plan, driveConfig);
    const readiness = readinessScore(lib, plan, driveConfig);
    const support = supportInventory(lib);

    const events = plan.events ?? [];
    const relDates = events.filter((e) => RELEASE_KINDS.has(e.kind)).map((e) => e.dateISO).sort();
    const firstRel = relDates[0];
    const lastRel = relDates[relDates.length - 1];
    const phases = events.map((e) => phaseForDate(e.dateISO, firstRel, lastRel));
    const currentPhase = phaseForDate(todayISO(), firstRel, lastRel);

    // Primary gap — the dominant missing thing across release milestones.
    const releaseMaps = mappings.filter((m) => RELEASE_KINDS.has(m.kind));
    const anchorGap = releaseMaps.some((m) => !m.anchorPresent);
    const shortsGap = releaseMaps.some((m) => m.missing.includes('shorts_cutdown'));
    const artGap = releaseMaps.some((m) => m.missing.includes('artwork'));
    const primaryGap = !hasAssets ? 'No assets scanned'
      : anchorGap ? 'Official Video Assets'
      : shortsGap ? 'Finished Shorts'
      : artGap ? 'Artwork / Packaging'
      : 'None — on track';

    return { summary, mappings, readiness, support, primaryGap, phases, currentPhase };
  }, [lib, plan, driveConfig, hasAssets]);

  // Channel context for the active milestone.
  const lastUploadDays = liveChannel?.lastUploadDaysAgo
    ?? (recentUploads.length ? Math.round((Date.now() - Math.max(...recentUploads.map((u) => new Date(u.publishedAt).getTime()))) / 86400000) : undefined);
  const shorts30d = liveChannel?.shorts30d
    ?? recentUploads.filter((u) => u.durationSec <= 62 && (Date.now() - new Date(u.publishedAt).getTime()) / 86400000 <= 30).length;

  // Active milestone = next upcoming (or last if all past).
  const events = plan.events ?? [];
  const t = todayISO();
  const activeIdx = (() => {
    const i = events.findIndex((e) => e.dateISO >= t);
    return i === -1 ? events.length - 1 : i;
  })();

  return (
    <div style={{ minHeight: '100vh', background: PAPER, color: INK }}>
      <CampaignHeader
        artist={plan.artist}
        title={campaignTitle}
        phase={currentPhase}
        readiness={readiness}
        support={support}
        primaryGap={primaryGap}
      />

      <AssetSnapshot
        summary={summary}
        library={lib}
        hasAssets={hasAssets}
        folderUrl={lib.folderUrl || driveFolderUrl}
      />

      <MasterTimeline
        events={events}
        mappings={mappings}
        phases={phases}
        activeIdx={activeIdx}
        recentUploads={recentUploads}
        lastUploadDays={lastUploadDays}
        shorts30d={shorts30d}
      />

      <YouTubeContext recentUploads={recentUploads} liveChannel={liveChannel} lastUploadDays={lastUploadDays} shorts30d={shorts30d} />

      <EditTimelineFooter
        slug={props.slug}
        artistName={props.artistName}
        currentTimeline={props.timelineText ?? ''}
        channelCtx={props.channelCtx}
        campaignStartDate={props.campaignStartDate}
        artist={plan.artist}
        title={campaignTitle}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 1. CAMPAIGN HEADER
// ══════════════════════════════════════════════════════════════════════════

function ScoreReadout({ label, score, band, color, dark }: { label: string; score: number; band: string; color: string; dark?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: dark ? GHOST : SMOKE, fontFamily: MONO, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 30, fontWeight: 900, fontFamily: MONO, lineHeight: 1, letterSpacing: '-0.03em', color: dark ? WHITE : INK }}>{score}</span>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color, fontFamily: MONO }}>{band}</span>
      </div>
    </div>
  );
}

function CampaignHeader({ artist, title, phase, readiness, support, primaryGap }: {
  artist: string; title: string; phase: PhaseName;
  readiness: ReturnType<typeof readinessScore>;
  support: ReturnType<typeof supportInventory>;
  primaryGap: string;
}) {
  const relColor = readiness.band === 'Ready' || readiness.band === 'On track' ? ACCENT : readiness.band === 'Building' ? AMBER : RED;
  const supColor = support.band === 'Deep' || support.band === 'Strong' ? ACCENT : support.band === 'Building' ? AMBER : SMOKE;
  const pt = PHASE_TONE[phase];
  return (
    <section style={{ background: INK, color: PAPER }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '22px 40px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <Link href="/coach" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: GHOST, textDecoration: 'none', fontFamily: MONO }}>
            ← Rollout Map
          </Link>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: MONO, color: WHITE, background: pt.color, padding: '3px 10px', borderRadius: 3 }}>
            {pt.label} phase
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 24 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginBottom: 8 }}>{artist}</div>
            <h1 style={{ fontSize: 'clamp(30px, 4.5vw, 52px)', fontWeight: 900, lineHeight: 0.92, letterSpacing: '-0.03em', textTransform: 'uppercase', margin: 0, color: WHITE }}>{title}</h1>
          </div>
          <div style={{ display: 'flex', gap: 32, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <ScoreReadout label="Release Readiness" score={readiness.score} band={readiness.band} color={relColor} dark />
            <ScoreReadout label="Support Inventory" score={support.score} band={support.band} color={supColor} dark />
            <div>
              <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginBottom: 4 }}>Primary Gap</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: primaryGap.startsWith('None') ? ACCENT : '#FCA5A5', letterSpacing: '-0.01em' }}>{primaryGap}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 2. ASSET SNAPSHOT
// ══════════════════════════════════════════════════════════════════════════

function bankedStatuses(lib: AssetLibrary) {
  const n = (pred: (c: DriveAssetClass) => boolean) => lib.assets.filter((a) => pred(a.assetClass)).length;
  const finishedShorts = lib.assets.filter((a) => a.assetClass === 'shorts_cutdown' && a.classConfidence === 'high').length;
  const sourceShorts = lib.assets.filter((a) => a.assetClass === 'shorts_cutdown').length;
  return [
    { label: 'Official Video', ready: n((c) => c === 'official_video') > 0 },
    { label: 'BTS', ready: n((c) => c === 'bts') > 0 },
    { label: 'Shorts', ready: finishedShorts > 0, partial: finishedShorts === 0 && sourceShorts > 0 },
    { label: 'Live Performance', ready: n((c) => c === 'live_performance') > 0 },
    { label: 'Artwork', ready: lib.assets.some((a) => a.mediaType === 'image') },
  ];
}

function AssetSnapshot({ summary, library, hasAssets, folderUrl }: {
  summary: ReturnType<typeof summarizeLibrary>; library: AssetLibrary; hasAssets: boolean; folderUrl?: string;
}) {
  const bts = summary.byClass.find((c) => c.cls === 'bts')?.count ?? 0;
  const shorts = summary.byClass.find((c) => c.cls === 'shorts_cutdown')?.count ?? 0;
  const live = summary.byClass.find((c) => c.cls === 'live_performance')?.count ?? 0;
  const counts = [
    { k: 'Total', v: summary.total },
    { k: 'BTS', v: bts },
    { k: 'Shorts', v: shorts },
    { k: 'Live', v: live },
    { k: 'Artwork', v: summary.images },
    { k: 'Audio', v: summary.audio },
  ];

  return (
    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '20px 40px 0' }}>
      <div style={{ background: WHITE, border: `1px solid ${BONE}`, borderRadius: 10, padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: hasAssets ? 14 : 0 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO }}>
            Asset Snapshot{library.folderName ? ` · ${library.folderName}` : ''}
          </div>
          {folderUrl && (
            <a href={folderUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: MONO, color: WHITE, background: ACCENT, padding: '5px 12px', borderRadius: 4, textDecoration: 'none' }}>
              Open Drive ↗
            </a>
          )}
        </div>

        {!hasAssets ? (
          <div style={{ fontSize: 13, color: SMOKE, lineHeight: 1.5, paddingTop: 14 }}>
            No asset library connected yet. Add a Drive folder or paste asset scan results to map this campaign&rsquo;s raw assets to the timeline below.
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
              {counts.map((c) => (
                <div key={c.k}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: INK, fontFamily: MONO, lineHeight: 1, letterSpacing: '-0.03em' }}>{c.v}</div>
                  <div style={{ fontSize: 8, fontWeight: 800, color: SMOKE, fontFamily: MONO, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 5 }}>{c.k}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${BONE}` }}>
              {bankedStatuses(library).map((b) => {
                const color = b.ready ? ACCENT : b.partial ? AMBER : RED;
                const text = b.ready ? `${b.label} Ready` : b.partial ? `${b.label} Sources` : `${b.label} Missing`;
                return (
                  <span key={b.label} style={{ fontSize: 10, fontFamily: MONO, fontWeight: 700, color, background: WHITE, border: `1px solid ${color}33`, padding: '3px 9px', borderRadius: 3 }}>
                    {b.ready ? '✓' : b.partial ? '◐' : '✕'} {text}
                  </span>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 3. MASTER CAMPAIGN TIMELINE (hero)
// ══════════════════════════════════════════════════════════════════════════

function MasterTimeline({ events, mappings, phases, activeIdx, recentUploads, lastUploadDays, shorts30d }: {
  events: ParsedEvent[]; mappings: MilestoneMapping[]; phases: PhaseName[]; activeIdx: number;
  recentUploads: RecentUpload[]; lastUploadDays?: number; shorts30d: number;
}) {
  return (
    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 40px 0' }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.28em', textTransform: 'uppercase', color: INK, fontFamily: MONO, marginBottom: 4 }}>
        Master Campaign Timeline
      </div>
      <div style={{ fontSize: 12, color: SMOKE, marginBottom: 24 }}>
        What&rsquo;s happening · what assets exist · what&rsquo;s missing · what to do next
      </div>

      <div style={{ position: 'relative' }}>
        {/* spine */}
        <div style={{ position: 'absolute', left: 54, top: 6, bottom: 6, width: 2, background: BONE }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {events.map((ev, i) => (
            <MilestoneCard
              key={`${ev.dateISO}-${i}`}
              ev={ev}
              mapping={mappings[i]}
              phase={phases[i]}
              active={i === activeIdx}
              showPhaseLabel={i === 0 || phases[i] !== phases[i - 1]}
              recentUploads={recentUploads}
              lastUploadDays={lastUploadDays}
              shorts30d={shorts30d}
            />
          ))}
          {events.length === 0 && (
            <div style={{ fontSize: 13, color: SMOKE, padding: '20px 0 0 80px' }}>
              No campaign moments parsed yet. Add a timeline below to populate the master view.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Chip({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const color = ok ? ACCENT : RED;
  return (
    <span style={{ fontSize: 10, fontFamily: MONO, fontWeight: 700, color, background: ok ? 'rgba(45,106,79,0.08)' : 'rgba(185,28,28,0.06)', border: `1px solid ${color}30`, padding: '2px 8px', borderRadius: 3, whiteSpace: 'nowrap' }}>
      {ok ? '✓' : '✕'} {children}
    </span>
  );
}

function MilestoneCard({ ev, mapping, phase, active, showPhaseLabel, recentUploads, lastUploadDays, shorts30d }: {
  ev: ParsedEvent; mapping?: MilestoneMapping; phase: PhaseName; active: boolean; showPhaseLabel: boolean;
  recentUploads: RecentUpload[]; lastUploadDays?: number; shorts30d: number;
}) {
  const d = dlabel(ev.dateISO);
  const dfn = daysFromNow(ev.dateISO);
  const pt = PHASE_TONE[phase];
  const readiness = mapping?.readiness ?? 'na';
  const rt = READINESS_TONE[readiness];
  const hasAnchor = !!mapping?.anchorPresent;

  // available content classes (qualifying, content only), distinct
  const availableClasses: DriveAssetClass[] = Array.from(new Set<DriveAssetClass>(
    (mapping?.assets ?? [])
      .map((a) => a.assetClass)
      .filter((c) => c !== 'press_doc' && c !== 'other'),
  ));
  const missing = mapping?.missing ?? [];
  const actions = mapping ? recommendedActions(mapping, hasAnchor) : ['Add assets to assess readiness'];

  // YouTube content already live for this moment (title token overlap)
  const evTokens = tok(ev.title);
  const liveForMoment = evTokens.length
    ? recentUploads.filter((u) => { const ut = tok(u.title); return evTokens.some((x) => ut.includes(x)); }).slice(0, 2)
    : [];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '108px 1fr', alignItems: 'start', gap: 0 }}>
      {/* Date rail */}
      <div style={{ position: 'relative', paddingTop: 4 }}>
        {showPhaseLabel && (
          <div style={{ position: 'absolute', top: -22, left: 0, fontSize: 8, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: pt.color, fontFamily: MONO }}>
            {pt.label}
          </div>
        )}
        <div style={{ textAlign: 'right', paddingRight: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: SMOKE, fontFamily: MONO }}>{d.mon}</div>
          <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1, color: INK, fontFamily: MONO, letterSpacing: '-0.03em' }}>{d.day}</div>
          <div style={{ fontSize: 8, color: GHOST, fontFamily: MONO, marginTop: 2 }}>{dfn >= 0 ? `in ${dfn}d` : `${-dfn}d ago`}</div>
        </div>
        {/* node */}
        <div style={{ position: 'absolute', right: -5, top: 8, width: 12, height: 12, borderRadius: '50%', background: active ? pt.color : WHITE, border: `2px solid ${pt.color}`, zIndex: 1 }} />
      </div>

      {/* Card */}
      <div style={{
        background: WHITE,
        border: active ? `2px solid ${pt.color}` : `1px solid ${BONE}`,
        boxShadow: active ? `0 0 0 4px ${pt.color}12` : 'none',
        borderRadius: 10, padding: '14px 18px 16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-0.01em', textTransform: 'uppercase', color: INK, lineHeight: 1.15 }}>
            {ev.title}
          </div>
          <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: MONO, color: WHITE, background: rt.color, padding: '4px 10px', borderRadius: 3 }}>
            {rt.label}
          </span>
        </div>

        {/* Assets row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginBottom: 6 }}>Assets available</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {availableClasses.length ? availableClasses.map((c) => <Chip key={c} ok>{clsLabel(c)}</Chip>)
                : <span style={{ fontSize: 11, color: GHOST, fontFamily: MONO }}>none yet</span>}
            </div>
          </div>
          {missing.length > 0 && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginBottom: 6 }}>Missing</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {missing.map((c) => <Chip key={c} ok={false}>{clsLabel(c)}</Chip>)}
              </div>
            </div>
          )}
        </div>

        {/* YouTube context */}
        {(liveForMoment.length > 0 || active) && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${BONE}` }}>
            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginBottom: 6 }}>YouTube context</div>
            {liveForMoment.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {liveForMoment.map((u) => (
                  <a key={u.id} href={`https://youtube.com/watch?v=${u.id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: ACCENT, textDecoration: 'none' }}>
                    ✓ Already live: {u.title.length > 54 ? u.title.slice(0, 51) + '…' : u.title} · {fmtNum(u.viewCount)} views
                  </a>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: SMOKE }}>
                {lastUploadDays != null ? `Last upload ${lastUploadDays}d ago` : 'No recent uploads'} · {shorts30d} Shorts in 30d
              </div>
            )}
          </div>
        )}

        {/* Recommended actions */}
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${BONE}` }}>
          <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginBottom: 6 }}>Recommended next</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {actions.map((a, i) => (
              <div key={i} style={{ fontSize: 12.5, color: INK, lineHeight: 1.35, display: 'flex', gap: 8 }}>
                <span style={{ color: pt.color, fontWeight: 800 }}>›</span>{a}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 4. YOUTUBE ACTIVITY (slim context, not hero)
// ══════════════════════════════════════════════════════════════════════════

function YouTubeContext({ recentUploads, liveChannel, lastUploadDays, shorts30d }: {
  recentUploads: RecentUpload[];
  liveChannel?: Props['liveChannel'];
  lastUploadDays?: number; shorts30d: number;
}) {
  if (recentUploads.length === 0 && !liveChannel) return null;
  const sorted = [...recentUploads].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  const latest = sorted[0];
  const topRecent = [...recentUploads].sort((a, b) => b.viewCount - a.viewCount)[0];
  const premieres = recentUploads.filter((u) => u.actualStart || u.live !== 'none').length;

  const items = [
    latest && { k: 'Latest upload', v: `${latest.title.length > 40 ? latest.title.slice(0, 37) + '…' : latest.title} · ${relDays(latest.publishedAt)}` },
    { k: 'Recent Shorts', v: `${shorts30d} in last 30d` },
    topRecent && { k: 'Top recent', v: `${fmtNum(topRecent.viewCount)} views` },
    { k: 'Premiere history', v: premieres > 0 ? `${premieres} detected` : 'none detected' },
  ].filter(Boolean) as { k: string; v: string }[];

  return (
    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '36px 40px 0' }}>
      <div style={{ borderTop: `1px solid ${BONE}`, paddingTop: 16 }}>
        <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginBottom: 12 }}>
          YouTube Activity — context
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          {items.map((it) => (
            <div key={it.k}>
              <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: SMOKE, fontFamily: MONO, marginBottom: 4 }}>{it.k}</div>
              <div style={{ fontSize: 12.5, color: INK, lineHeight: 1.35 }}>{it.v}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 5. EDIT TIMELINE (compact footer)
// ══════════════════════════════════════════════════════════════════════════

function EditTimelineFooter({ slug, artistName, currentTimeline, channelCtx, campaignStartDate, artist, title }: {
  slug: string; artistName: string; currentTimeline: string; channelCtx: ChannelContext | null; campaignStartDate?: string; artist: string; title: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(currentTimeline);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasChanges = draft.trim() !== currentTimeline.trim();

  const save = async () => {
    if (!hasChanges || saving) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/coach', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist: artistName, timeline: draft.trim(), channelCtx, customSlug: slug, campaignStartDate: campaignStartDate ?? null }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'Failed to regenerate'); return; }
      setOpen(false); router.refresh();
    } catch { setError('Network error'); } finally { setSaving(false); }
  };

  return (
    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 40px 40px' }}>
      <div style={{ borderTop: `1px solid ${BONE}`, paddingTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {currentTimeline ? (
            <button onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO }}>Adjust timeline</span>
              <span style={{ fontSize: 7, color: GHOST, transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
            </button>
          ) : <span />}
          <span style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO }}>{artist} · {title}</span>
        </div>

        {open && (
          <div style={{ marginTop: 12 }}>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={Math.max(6, draft.split('\n').length + 1)}
              style={{ width: '100%', padding: '10px 12px', fontSize: 12, lineHeight: 1.6, color: INK, border: `1px solid ${hasChanges ? AMBER : BONE}`, borderRadius: 4, background: WHITE, outline: 'none', fontFamily: MONO, resize: 'vertical', boxSizing: 'border-box' }} />
            {error && <div style={{ marginTop: 8, fontSize: 11, color: RED }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={save} disabled={!hasChanges || saving} style={{ fontSize: 11, fontWeight: 700, padding: '8px 20px', background: hasChanges && !saving ? INK : BONE, color: hasChanges && !saving ? PAPER : GHOST, border: 'none', borderRadius: 4, cursor: hasChanges && !saving ? 'pointer' : 'default' }}>
                {saving ? 'Regenerating…' : 'Save & Regenerate'}
              </button>
              <button onClick={() => { setDraft(currentTimeline); setOpen(false); }} style={{ fontSize: 11, fontWeight: 600, padding: '8px 16px', background: 'none', color: SMOKE, border: `1px solid ${BONE}`, borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
