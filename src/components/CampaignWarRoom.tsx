'use client';

/**
 * CampaignWarRoom — Content Planner V4.1 (hybrid).
 *
 * One master campaign timeline as the spine, grounded by selected live YouTube
 * surfaces. Future-looking plan, supported by evidence — not a raw timeline
 * database and not a historical analytics report.
 *
 * Section hierarchy:
 *   1. Campaign Read        — editorial one-liner + secondary scores
 *   2. Current YouTube Surface — strongest relevant upload (visual)
 *   3. Asset Snapshot       — counts, Open Drive, banked chips
 *   4. Master Timeline      — type-aware milestone cards (the hero)
 *   5. Recent Activity      — compact channel pulse
 *
 * YouTube matching is age-gated: archive (old) uploads are labelled and never
 * attached to future milestones or counted as readiness.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { GeneratedPlan, ParsedEvent, PhaseName, TimelineKind, ChannelContext } from '@/lib/planEngine';
import type { RecentUpload } from '@/lib/artists';
import { fmtNum } from '@/lib/artists';
import {
  type AssetLibrary, type AssetMappingConfig, type DriveAssetClass,
  type MilestoneMapping,
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
const INDIGO = '#4338CA';
const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const PHASE_TONE: Record<PhaseName, { label: string; color: string }> = {
  BUILD: { label: 'Build', color: INDIGO },
  RELEASE: { label: 'Release', color: '#DC2626' },
  SCALE: { label: 'Scale', color: ACCENT },
  EXTEND: { label: 'Extend', color: '#D97706' },
};

// ── Moment types — drive card logic, not a single generic template ──
type MomentType = 'release' | 'announce' | 'support' | 'live' | 'archive';
const MOMENT_TONE: Record<MomentType, { label: string; color: string }> = {
  release: { label: 'Release', color: '#DC2626' },
  announce: { label: 'Announce', color: INDIGO },
  support: { label: 'Support', color: ACCENT },
  live: { label: 'Live', color: AMBER },
  archive: { label: 'Archive', color: SMOKE },
};

function momentType(ev: ParsedEvent): MomentType {
  const t = ev.title.toLowerCase();
  const k = ev.kind;
  if (/archive|catalogue|catalog|throwback|reference/.test(t)) return 'archive';
  if (k === 'singleRelease' || k === 'albumRelease' || k === 'documentaryRelease'
    || /official\s*video|visuali[sz]er|lyric\s*video|\bsingle\b|album\s*release|deluxe|focus\s*track/.test(t)) return 'release';
  if (k === 'albumAnnounce' || k === 'tourAnnounce' || /announce|pre-?order|reveal/.test(t)) return 'announce';
  if (k === 'tourDate' || k === 'liveShow' || k === 'festival' || /\blive\b|performance|tour|festival|\bgig\b|\bshow\b|vlog/.test(t)) return 'live';
  return 'support';
}

// ── Date / age helpers ──
const todayISO = () => new Date().toISOString().split('T')[0];
function dlabel(iso: string) { const d = new Date(iso + 'T12:00:00'); return { mon: MONTHS[d.getUTCMonth()], day: String(d.getUTCDate()) }; }
function daysFromNow(iso: string) { return Math.round((new Date(iso + 'T12:00:00').getTime() - Date.now()) / 86400000); }
function daysAgoNum(iso: string) { return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); }
function relDays(iso: string) {
  const d = daysAgoNum(iso);
  if (d <= 0) return 'today'; if (d === 1) return 'yesterday';
  if (d < 30) return `${d}d ago`; if (d < 365) return `${Math.round(d / 30)}mo ago`;
  return `${Math.round(d / 365)}y ago`;
}

type Age = 'recent' | 'campaign' | 'archive';
function uploadAge(iso: string, campaignStart?: string): Age {
  const days = daysAgoNum(iso);
  if (days <= 45) return 'recent';
  if (campaignStart && iso.slice(0, 10) >= campaignStart) return 'campaign';
  if (!campaignStart && days <= 150) return 'campaign';
  return 'archive';
}
const ageBadge: Record<Age, { label: string; color: string }> = {
  recent: { label: 'Recent', color: ACCENT },
  campaign: { label: 'Campaign period', color: AMBER },
  archive: { label: 'Archive reference', color: SMOKE },
};
const isShort = (u: RecentUpload) => u.durationSec > 0 && u.durationSec <= 62;
const ytThumb = (id: string, q: 'hqdefault' | 'maxresdefault' = 'hqdefault') => `https://i.ytimg.com/vi/${id}/${q}.jpg`;
const ytUrl = (u: RecentUpload) => isShort(u) ? `https://youtube.com/shorts/${u.id}` : `https://youtube.com/watch?v=${u.id}`;

// ── Identity tokens (shared with driveAssets vocabulary) ──
const STOP = new Set(['the', 'and', 'a', 'an', 'for', 'out', 'now', 'feat', 'ft', 'with', 'release', 'single', 'album', 'video', 'official', 'lyric', 'visualiser', 'visualizer', 'live', 'tour', 'day', 'song', 'announcement', 'announce', 'new', 'music', 'shorts', 'short', 'episode', 'recording', 'session', 'content', 'our', 'feature']);
function tok(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length >= 4 && !STOP.has(t));
}
const shareTok = (a: string[], b: string[]) => a.some((x) => b.includes(x));

// YouTube-native display labels (override the generic asset-class labels).
const YT_LABEL: Partial<Record<DriveAssetClass, string>> = {
  shorts_cutdown: 'Shorts Support',
  bts: 'BTS / Making-of',
  live_performance: 'Live Performance',
  audio: 'Audio / Master',
};
const clsLabel = (c: DriveAssetClass) => YT_LABEL[c] ?? ASSET_CLASS_META[c].label;

// Subtle YouTube play mark.
function YTMark({ h = 13 }: { h?: number }) {
  return (
    <svg width={Math.round(h * 1.42)} height={h} viewBox="0 0 28 20" aria-hidden style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <rect width="28" height="20" rx="5" fill="#FF0000" />
      <path d="M11.2 5.8 18.5 10l-7.3 4.2V5.8Z" fill="#fff" />
    </svg>
  );
}

// Identity tokens for a single milestone. Known release titles are only folded
// in when the milestone title actually references that release — NOT blanket,
// otherwise one upload matching any known release attaches to every milestone.
function momentTokens(title: string, knownTitles: string[]): string[] {
  const out = new Set(tok(title));
  for (const k of knownTitles) {
    const kt = tok(k);
    if (kt.some((x) => out.has(x))) kt.forEach((x) => out.add(x));
  }
  return Array.from(out);
}

const RELEASE_KINDS = new Set<TimelineKind>(['singleRelease', 'albumRelease', 'documentaryRelease']);
function phaseForDate(iso: string, firstRel?: string, lastRel?: string): PhaseName {
  if (!firstRel) return 'BUILD';
  if (iso < firstRel) return 'BUILD';
  if (lastRel && iso > lastRel) return 'SCALE';
  return 'RELEASE';
}

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

type Pool = { bts: number; shorts: number; live: number };

export default function CampaignWarRoom(props: Props) {
  const { plan, driveLibrary, driveConfig, driveFolderUrl, recentUploads = [], liveChannel, campaignStartDate } = props;
  const campaignTitle = plan.campaignName.replace(/ Campaign$/i, '');
  const lib: AssetLibrary = driveLibrary ?? { slug: props.slug, folderUrl: driveFolderUrl ?? '', scannedAt: '', assets: [] };
  const hasAssets = lib.assets.length > 0;
  const knownTitles = driveConfig?.knownTitles ?? [];

  const m = useMemo(() => {
    const summary = summarizeLibrary(lib);
    const mappings = mapAssetsToTimeline(lib, plan, driveConfig);
    const readiness = readinessScore(lib, plan, driveConfig);
    const support = supportInventory(lib);
    const events = plan.events ?? [];
    const relDates = events.filter((e) => RELEASE_KINDS.has(e.kind)).map((e) => e.dateISO).sort();
    const firstRel = relDates[0], lastRel = relDates[relDates.length - 1];
    const phases = events.map((e) => phaseForDate(e.dateISO, firstRel, lastRel));
    const currentPhase = phaseForDate(todayISO(), firstRel, lastRel);
    const releaseMaps = mappings.filter((x) => RELEASE_KINDS.has(x.kind));
    const anchorGap = releaseMaps.some((x) => !x.anchorPresent);
    const shortsGap = releaseMaps.some((x) => x.missing.includes('shorts_cutdown'));
    const artGap = releaseMaps.some((x) => x.missing.includes('artwork'));
    const primaryGap = !hasAssets ? 'No assets scanned'
      : anchorGap ? 'Official Video Assets'
      : shortsGap ? 'Finished Shorts'
      : artGap ? 'Artwork / Packaging'
      : 'None — on track';
    return { summary, mappings, readiness, support, phases, currentPhase, primaryGap };
  }, [lib, plan, driveConfig, hasAssets]);

  const events = plan.events ?? [];
  const t = todayISO();
  const activeIdx = (() => { const i = events.findIndex((e) => e.dateISO >= t); return i === -1 ? events.length - 1 : i; })();
  const pool: Pool = {
    bts: m.summary.byClass.find((c) => c.cls === 'bts')?.count ?? 0,
    shorts: m.summary.byClass.find((c) => c.cls === 'shorts_cutdown')?.count ?? 0,
    live: m.summary.byClass.find((c) => c.cls === 'live_performance')?.count ?? 0,
  };

  return (
    <div style={{ minHeight: '100vh', background: PAPER, color: INK }}>
      <CampaignRead
        artist={plan.artist} title={campaignTitle} phase={m.currentPhase}
        readiness={m.readiness} support={m.support} primaryGap={m.primaryGap}
      />
      <CurrentYouTubeSurface recentUploads={recentUploads} campaignStart={campaignStartDate} knownTitles={knownTitles} />
      <RecentActivity recentUploads={recentUploads} liveChannel={liveChannel} campaignStart={campaignStartDate} />
      <AssetSnapshot summary={m.summary} library={lib} hasAssets={hasAssets} folderUrl={lib.folderUrl || driveFolderUrl} />
      <MasterTimeline
        events={events} mappings={m.mappings} phases={m.phases} activeIdx={activeIdx}
        recentUploads={recentUploads} campaignStart={campaignStartDate} knownTitles={knownTitles} pool={pool}
        folderUrl={lib.folderUrl || driveFolderUrl}
      />
      <EditTimelineFooter
        slug={props.slug} artistName={props.artistName} currentTimeline={props.timelineText ?? ''}
        channelCtx={props.channelCtx} campaignStartDate={props.campaignStartDate}
        artist={plan.artist} title={campaignTitle}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 1. CAMPAIGN READ (editorial header)
// ══════════════════════════════════════════════════════════════════════════

function readSentence(support: ReturnType<typeof supportInventory>, primaryGap: string): string {
  const sup = support.band === 'Deep' ? 'A deep multi-format asset library'
    : support.band === 'Strong' ? 'A strong multi-format asset library'
    : support.band === 'Building' ? 'A building multi-format asset library'
    : 'Multi-format assets are still thin';
  if (primaryGap.startsWith('None')) return `${sup}, and the core YouTube release anchors are in place — time to execute.`;
  if (primaryGap === 'No assets scanned') return 'No YouTube asset library connected yet — scan the campaign folder to ground the plan.';
  const gap = primaryGap === 'Official Video Assets' ? 'the core YouTube release anchors — official video and visualiser — are still missing'
    : primaryGap === 'Finished Shorts' ? 'finished Shorts are still to be cut'
    : primaryGap === 'Artwork / Packaging' ? 'artwork and Community packaging are still to come'
    : `${primaryGap.toLowerCase()} is still missing`;
  return `${sup}, but ${gap}.`;
}

function ecosystemLine(support: ReturnType<typeof supportInventory>, primaryGap: string): string {
  const sup = support.band === 'Deep' || support.band === 'Strong' ? 'multi-format support is strong'
    : support.band === 'Building' ? 'multi-format support is building'
    : 'multi-format support is thin';
  const anchors = primaryGap === 'Official Video Assets' ? 'hero release anchors missing'
    : primaryGap.startsWith('None') ? 'release anchors in place'
    : primaryGap === 'No assets scanned' ? 'no assets scanned'
    : `${primaryGap.toLowerCase()} outstanding`;
  return `${sup} · ${anchors}`;
}

function MiniScore({ label, value, band, color, dark }: { label: string; value: number; band: string; color: string; dark?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: dark ? GHOST : SMOKE, fontFamily: MONO }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 900, fontFamily: MONO, color: dark ? WHITE : INK }}>{value}</span>
      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color, fontFamily: MONO }}>{band}</span>
    </span>
  );
}

function CampaignRead({ artist, title, phase, readiness, support, primaryGap }: {
  artist: string; title: string; phase: PhaseName;
  readiness: ReturnType<typeof readinessScore>; support: ReturnType<typeof supportInventory>; primaryGap: string;
}) {
  const relColor = readiness.band === 'Ready' || readiness.band === 'On track' ? ACCENT : readiness.band === 'Building' ? AMBER : RED;
  const supColor = support.band === 'Deep' || support.band === 'Strong' ? ACCENT : support.band === 'Building' ? AMBER : SMOKE;
  const pt = PHASE_TONE[phase];
  return (
    <section style={{ background: INK, color: PAPER }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '20px 40px 26px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Link href="/coach" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: GHOST, textDecoration: 'none', fontFamily: MONO }}>
            <YTMark h={12} /> YouTube Rollout Map
          </Link>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: MONO, color: WHITE, background: pt.color, padding: '3px 10px', borderRadius: 3 }}>{pt.label} phase</span>
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginBottom: 6 }}>{artist}</div>
        <h1 style={{ fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 900, lineHeight: 0.95, letterSpacing: '-0.03em', textTransform: 'uppercase', margin: '0 0 16px', color: WHITE }}>{title}</h1>

        {/* The editorial read — the most prominent line */}
        <p style={{ fontSize: 'clamp(17px, 2.2vw, 22px)', fontWeight: 600, lineHeight: 1.35, letterSpacing: '-0.01em', color: WHITE, margin: '0 0 16px', maxWidth: 820 }}>
          {readSentence(support, primaryGap)}
        </p>

        {/* Scores, secondary */}
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <MiniScore label="YouTube Release Readiness" value={readiness.score} band={readiness.band} color={relColor} dark />
          <MiniScore label="Multi-Format Asset Coverage" value={support.score} band={support.band} color={supColor} dark />
          <span style={{ fontSize: 10, color: GHOST, fontFamily: MONO }}>Primary gap: <span style={{ color: primaryGap.startsWith('None') ? '#86EFAC' : '#FCA5A5', fontWeight: 700 }}>{primaryGap.replace(/ —.*/, '')}</span></span>
        </div>

        {/* YouTube ecosystem descriptor — a read, not a score */}
        <div style={{ marginTop: 12, fontSize: 11, color: GHOST, fontFamily: MONO, letterSpacing: '0.04em' }}>
          <span style={{ fontWeight: 800, color: SMOKE }}>YouTube Ecosystem:</span> {ecosystemLine(support, primaryGap)}
        </div>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 2. CURRENT YOUTUBE SURFACE (one strong visual)
// ══════════════════════════════════════════════════════════════════════════

function CurrentYouTubeSurface({ recentUploads, campaignStart, knownTitles }: {
  recentUploads: RecentUpload[]; campaignStart?: string; knownTitles: string[];
}) {
  if (recentUploads.length === 0) return null;

  const titleTokens = knownTitles.flatMap(tok);
  const score = (u: RecentUpload) => {
    const age = uploadAge(u.publishedAt, campaignStart);
    const ageW = age === 'recent' ? 3 : age === 'campaign' ? 2 : 1;
    const rel = shareTok(tok(u.title), titleTokens) ? 1.4 : 1;
    return ageW * rel * Math.log10(Math.max(10, u.viewCount));
  };
  const hero = [...recentUploads].sort((a, b) => score(b) - score(a))[0];
  const age = uploadAge(hero.publishedAt, campaignStart);
  const ab = ageBadge[age];
  const relevant = age !== 'archive' || shareTok(tok(hero.title), titleTokens);

  const within30 = recentUploads.filter((u) => daysAgoNum(u.publishedAt) <= 30);
  const shorts30 = within30.filter(isShort).length;
  const long30 = within30.filter((u) => !isShort(u)).length;

  return (
    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '22px 40px 0' }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.26em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}><YTMark h={11} /> Live YouTube Surface</div>
      <a href={ytUrl(hero)} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: INK, aspectRatio: '21 / 8' }}>
          <img src={ytThumb(hero.id, 'maxresdefault')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.62 }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(10,10,10,0.86) 0%, rgba(10,10,10,0.25) 70%)' }} />
          <div style={{ position: 'absolute', top: 14, left: 16, display: 'flex', gap: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: MONO, color: WHITE, background: relevant ? ACCENT : SMOKE, padding: '4px 10px', borderRadius: 3 }}>
              {relevant ? 'Campaign-relevant' : 'Archive reference'}
            </span>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: MONO, color: WHITE, background: 'rgba(255,255,255,0.14)', padding: '4px 10px', borderRadius: 3 }}>{ab.label}</span>
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 22px' }}>
            <div style={{ fontSize: 'clamp(16px, 2vw, 22px)', fontWeight: 800, color: WHITE, lineHeight: 1.2, maxWidth: 620, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hero.title}</div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.6)', fontFamily: MONO, flexWrap: 'wrap' }}>
              <span style={{ color: WHITE, fontWeight: 800, fontSize: 13 }}>{fmtNum(hero.viewCount)} views</span>
              <span>{relDays(hero.publishedAt)}</span>
              <span>{isShort(hero) ? 'Short' : 'Longform'}</span>
              <span>· Last 30d: {shorts30} Shorts / {long30} longform</span>
            </div>
          </div>
        </div>
      </a>
      {!relevant && (
        <div style={{ fontSize: 10, color: SMOKE, marginTop: 8, fontFamily: MONO }}>
          No current campaign upload yet — showing the channel&rsquo;s strongest recent video as reference. It is not counted as a campaign asset.
        </div>
      )}
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 3. ASSET SNAPSHOT
// ══════════════════════════════════════════════════════════════════════════

function bankedStatuses(lib: AssetLibrary) {
  const n = (cls: DriveAssetClass) => lib.assets.filter((a) => a.assetClass === cls).length;
  const finished = lib.assets.filter((a) => a.assetClass === 'shorts_cutdown' && a.classConfidence === 'high').length;
  const sources = n('shorts_cutdown');
  return [
    { label: 'Official Video', ready: n('official_video') > 0 },
    { label: 'BTS', ready: n('bts') > 0 },
    { label: 'Shorts', ready: finished > 0, partial: finished === 0 && sources > 0 },
    { label: 'Live Performance', ready: n('live_performance') > 0 },
    { label: 'Artwork', ready: lib.assets.some((a) => a.mediaType === 'image') },
  ];
}

function AssetSnapshot({ summary, library, hasAssets, folderUrl }: {
  summary: ReturnType<typeof summarizeLibrary>; library: AssetLibrary; hasAssets: boolean; folderUrl?: string;
}) {
  const counts = [
    { k: 'Total', v: summary.total },
    { k: 'BTS', v: summary.byClass.find((c) => c.cls === 'bts')?.count ?? 0 },
    { k: 'Shorts', v: summary.byClass.find((c) => c.cls === 'shorts_cutdown')?.count ?? 0 },
    { k: 'Live', v: summary.byClass.find((c) => c.cls === 'live_performance')?.count ?? 0 },
    { k: 'Artwork', v: summary.images },
    { k: 'Audio', v: summary.audio },
  ];
  return (
    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 40px 0' }}>
      <div style={{ background: WHITE, border: `1px solid ${BONE}`, borderRadius: 10, padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: hasAssets ? 4 : 0 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO }}>
            YouTube Content Pipeline{library.folderName ? ` · ${library.folderName}` : ''}
          </div>
          {folderUrl && <a href={folderUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: MONO, color: WHITE, background: ACCENT, padding: '5px 12px', borderRadius: 4, textDecoration: 'none' }}>Open YouTube Asset Library ↗</a>}
        </div>
        {!hasAssets ? (
          <div style={{ fontSize: 13, color: SMOKE, lineHeight: 1.5, paddingTop: 14 }}>No YouTube asset library connected yet. Add a Drive folder or paste asset scan results to map this campaign&rsquo;s content supply to the timeline below.</div>
        ) : (
          <>
          <div style={{ fontSize: 11, color: SMOKE, margin: '6px 0 14px' }}>The YouTube content supply feeding this campaign.</div>
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
                const text = b.ready ? `${b.label} Ready` : b.partial ? `${b.label} Sources Available` : `${b.label} Missing`;
                return <span key={b.label} style={{ fontSize: 10, fontFamily: MONO, fontWeight: 700, color, background: WHITE, border: `1px solid ${color}33`, padding: '3px 9px', borderRadius: 3 }}>{b.ready ? '✓' : b.partial ? '◐' : '✕'} {text}</span>;
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 4. MASTER TIMELINE (type-aware cards)
// ══════════════════════════════════════════════════════════════════════════

function MasterTimeline({ events, mappings, phases, activeIdx, recentUploads, campaignStart, knownTitles, pool, folderUrl }: {
  events: ParsedEvent[]; mappings: MilestoneMapping[]; phases: PhaseName[]; activeIdx: number;
  recentUploads: RecentUpload[]; campaignStart?: string; knownTitles: string[]; pool: Pool; folderUrl?: string;
}) {
  return (
    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 40px 0' }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.28em', textTransform: 'uppercase', color: INK, fontFamily: MONO, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}><YTMark h={12} /> YouTube Campaign Timeline</div>
      <div style={{ fontSize: 12, color: SMOKE, marginBottom: 24 }}>What&rsquo;s happening · what exists · what&rsquo;s missing · what&rsquo;s ready for YouTube</div>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: 54, top: 6, bottom: 6, width: 2, background: BONE }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {events.map((ev, i) => (
            <MilestoneCard
              key={`${ev.dateISO}-${i}`} ev={ev} mapping={mappings[i]} phase={phases[i]} active={i === activeIdx}
              showPhaseLabel={i === 0 || phases[i] !== phases[i - 1]}
              recentUploads={recentUploads} campaignStart={campaignStart} knownTitles={knownTitles} pool={pool} folderUrl={folderUrl}
            />
          ))}
          {events.length === 0 && <div style={{ fontSize: 13, color: SMOKE, padding: '20px 0 0 80px' }}>No campaign moments parsed yet. Add a timeline below to populate the master view.</div>}
        </div>
      </div>
    </section>
  );
}

function Chip({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const color = ok ? ACCENT : RED;
  return <span style={{ fontSize: 10, fontFamily: MONO, fontWeight: 700, color, background: ok ? 'rgba(45,106,79,0.08)' : 'rgba(185,28,28,0.06)', border: `1px solid ${color}30`, padding: '2px 8px', borderRadius: 3, whiteSpace: 'nowrap' }}>{ok ? '✓' : '✕'} {children}</span>;
}

// A matched-asset chip that links to its Google Drive file/folder when known.
function AssetChip({ cls, href }: { cls: DriveAssetClass; href?: string }) {
  const base: React.CSSProperties = {
    fontSize: 10, fontFamily: MONO, fontWeight: 700, color: ACCENT,
    background: 'rgba(45,106,79,0.08)', border: `1px solid ${ACCENT}30`,
    padding: '2px 8px', borderRadius: 3, whiteSpace: 'nowrap',
    display: 'inline-flex', alignItems: 'center', gap: 4,
  };
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title="Open in YouTube Asset Library"
        style={{ ...base, textDecoration: 'none', cursor: 'pointer' }}>
        ✓ {clsLabel(cls)} <span style={{ opacity: 0.55, fontSize: 9 }}>↗</span>
      </a>
    );
  }
  // No Drive URL — visually softer, not clickable.
  return <span style={{ ...base, color: SMOKE, background: 'rgba(133,127,116,0.08)', border: `1px solid ${BONE}`, opacity: 0.85 }}>✓ {clsLabel(cls)}</span>;
}

// Per-type status + actions — no generic repetition.
function cardLogic(type: MomentType, mapping: MilestoneMapping | undefined, pool: Pool) {
  const present = Array.from(new Set((mapping?.assets ?? []).map((a) => a.assetClass).filter((c) => c !== 'press_doc' && c !== 'other'))) as DriveAssetClass[];
  const anchor = !!mapping?.anchorPresent;
  const hasShortPool = pool.shorts > 0;
  let status = { label: 'Planned', color: SMOKE };
  let missing: DriveAssetClass[] = [];
  const actions: string[] = [];

  if (type === 'release') {
    status = anchor && (mapping?.missing.length === 0)
      ? { label: 'YouTube Ready', color: ACCENT }
      : anchor ? { label: 'Hero Asset Ready', color: AMBER } : { label: 'Needs Hero YouTube Asset', color: RED };
    missing = (mapping?.missing ?? []).filter((c) => ['official_video', 'visualiser', 'lyric_video', 'artwork'].includes(c));
    if (!anchor) actions.push('Lock official video / visualiser before release week');
    else actions.push('Schedule the Premiere + Community moment');
    actions.push(hasShortPool ? 'Cut Shorts from the pool to bridge release week' : 'Plan release-week Shorts Support');
  } else if (type === 'announce') {
    status = present.length ? { label: 'Assets Partial', color: AMBER } : { label: 'Planned', color: SMOKE };
    missing = (mapping?.missing ?? []).filter((c) => ['trailer', 'artwork'].includes(c));
    actions.push('Prepare announcement trailer, artwork and Community post');
    actions.push('Premiere + pre-save / pre-order moment');
  } else if (type === 'live') {
    status = (present.length || pool.live > 0) ? { label: 'Content Ready', color: ACCENT } : { label: 'Planned', color: SMOKE };
    actions.push('Cut vertical performance Shorts');
    if (pool.live > 0 || present.includes('live_performance')) actions.push('Cut a live performance upload from this footage');
  } else if (type === 'archive') {
    status = { label: 'Reference', color: GHOST };
    actions.push('Archive reference — useful for catalogue context only');
  } else { // support
    status = (present.length || pool.bts > 0 || pool.shorts > 0) ? { label: 'Content Ready', color: ACCENT } : { label: 'Planned', color: SMOKE };
    if (pool.bts > 0 || pool.shorts > 0 || present.includes('bts')) actions.push('Cut Shorts from this session footage');
    else actions.push('Capture YouTube content for this moment');
  }
  // Is there real YouTube content behind this moment (so the status can link to Drive)?
  const hasContent =
    type === 'archive' ? true
    : type === 'release' ? (anchor || present.length > 0)
    : type === 'announce' ? present.length > 0
    : type === 'live' ? (present.length > 0 || pool.live > 0)
    : (present.length > 0 || pool.bts > 0 || pool.shorts > 0); // support
  return { present, status, missing, actions: actions.slice(0, 2), hasContent };
}

function MilestoneCard({ ev, mapping, phase, active, showPhaseLabel, recentUploads, campaignStart, knownTitles, pool, folderUrl }: {
  ev: ParsedEvent; mapping?: MilestoneMapping; phase: PhaseName; active: boolean; showPhaseLabel: boolean;
  recentUploads: RecentUpload[]; campaignStart?: string; knownTitles: string[]; pool: Pool; folderUrl?: string;
}) {
  // Direct Drive link for a matched asset class: the matching file, else the folder.
  const linkFor = (c: DriveAssetClass) =>
    (mapping?.assets ?? []).find((a) => a.assetClass === c && a.webViewLink)?.webViewLink ?? folderUrl;
  const d = dlabel(ev.dateISO);
  const dfn = daysFromNow(ev.dateISO);
  const pt = PHASE_TONE[phase];
  const type = momentType(ev);
  const mt = MOMENT_TONE[type];
  const { present, status, missing, actions, hasContent } = cardLogic(type, mapping, pool);
  // When content exists, the status badge links to the matched Drive file, else the asset-library folder.
  const statusHref = hasContent ? (present[0] ? linkFor(present[0]) : folderUrl) : undefined;

  // YouTube context — only CURRENT (non-archive) uploads that identity-match
  // THIS milestone (known titles fold in only when the milestone references them).
  const evTokens = momentTokens(ev.title, knownTitles);
  const liveMatch = evTokens.length === 0 ? undefined : recentUploads
    .filter((u) => shareTok(tok(u.title), evTokens) && uploadAge(u.publishedAt, campaignStart) !== 'archive')
    .sort((a, b) => b.viewCount - a.viewCount)[0];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '108px 1fr', alignItems: 'start' }}>
      <div style={{ position: 'relative', paddingTop: 4 }}>
        {showPhaseLabel && <div style={{ position: 'absolute', top: -22, left: 0, fontSize: 8, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: pt.color, fontFamily: MONO }}>{pt.label}</div>}
        <div style={{ textAlign: 'right', paddingRight: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: SMOKE, fontFamily: MONO }}>{d.mon}</div>
          <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1, color: INK, fontFamily: MONO, letterSpacing: '-0.03em' }}>{d.day}</div>
          <div style={{ fontSize: 8, color: GHOST, fontFamily: MONO, marginTop: 2 }}>{dfn >= 0 ? `in ${dfn}d` : `${-dfn}d ago`}</div>
        </div>
        <div style={{ position: 'absolute', right: -5, top: 8, width: 12, height: 12, borderRadius: '50%', background: active ? mt.color : WHITE, border: `2px solid ${mt.color}`, zIndex: 1 }} />
      </div>

      <div style={{ background: WHITE, border: active ? `2px solid ${mt.color}` : `1px solid ${BONE}`, boxShadow: active ? `0 0 0 4px ${mt.color}12` : 'none', borderRadius: 10, padding: '13px 18px 15px', borderLeft: `3px solid ${mt.color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: mt.color, fontFamily: MONO }}>{mt.label}</span>
            <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-0.01em', textTransform: 'uppercase', color: INK, lineHeight: 1.15, marginTop: 3 }}>{ev.title}</div>
          </div>
          {statusHref ? (
            <a href={statusHref} target="_blank" rel="noopener noreferrer" title="Open in YouTube Asset Library"
              style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: MONO, color: WHITE, background: status.color, padding: '4px 10px', borderRadius: 3, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {status.label} <span style={{ opacity: 0.6, fontSize: 8 }}>↗</span>
            </a>
          ) : (
            <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: MONO, color: WHITE, background: status.color, padding: '4px 10px', borderRadius: 3 }}>{status.label}</span>
          )}
        </div>

        {/* Assets — only when something is genuinely present or missing */}
        {(present.length > 0 || missing.length > 0) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 11 }}>
            {present.length > 0 && (
              <div>
                <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginBottom: 6 }}>Matched assets</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{present.map((c) => <AssetChip key={c} cls={c} href={linkFor(c)} />)}</div>
              </div>
            )}
            {missing.length > 0 && (
              <div>
                <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginBottom: 6 }}>Missing</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{missing.map((c) => <Chip key={c} ok={false}>{clsLabel(c)}</Chip>)}</div>
              </div>
            )}
          </div>
        )}

        {/* YouTube context — current matches only */}
        {liveMatch && (
          <div style={{ marginTop: 11, display: 'flex', alignItems: 'center', gap: 10 }}>
            <a href={ytUrl(liveMatch)} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
              <img src={ytThumb(liveMatch.id)} alt="" style={{ width: 64, height: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: ACCENT, fontWeight: 600, lineHeight: 1.3 }}>
                ✓ Already live: {liveMatch.title.length > 46 ? liveMatch.title.slice(0, 43) + '…' : liveMatch.title} · {fmtNum(liveMatch.viewCount)} views · {relDays(liveMatch.publishedAt)}
              </span>
            </a>
          </div>
        )}

        {/* One or two tailored actions */}
        <div style={{ marginTop: 11, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {actions.map((a, i) => (
            <div key={i} style={{ fontSize: 12.5, color: INK, lineHeight: 1.35, display: 'flex', gap: 8 }}>
              <span style={{ color: mt.color, fontWeight: 800 }}>›</span>{a}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 5. RECENT ACTIVITY / CHANNEL PULSE
// ══════════════════════════════════════════════════════════════════════════

function RecentActivity({ recentUploads, liveChannel, campaignStart }: {
  recentUploads: RecentUpload[]; liveChannel?: Props['liveChannel']; campaignStart?: string;
}) {
  if (recentUploads.length === 0 && !liveChannel) return null;
  const sorted = [...recentUploads].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  const recent = sorted.filter((u) => daysAgoNum(u.publishedAt) <= 60).slice(0, 6);
  const within30 = recentUploads.filter((u) => daysAgoNum(u.publishedAt) <= 30);
  const shorts30 = within30.filter(isShort).length;
  const long30 = within30.filter((u) => !isShort(u)).length;
  const lastDays = sorted.length ? daysAgoNum(sorted[0].publishedAt) : undefined;
  const v7 = liveChannel?.views7Delta, s7 = liveChannel?.subs7Delta;

  return (
    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '22px 40px 0' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO }}>Recent Activity · Channel Pulse</div>
          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: SMOKE, fontFamily: MONO, flexWrap: 'wrap' }}>
            {lastDays != null && <span>Last upload {lastDays === 0 ? 'today' : `${lastDays}d ago`}</span>}
            <span>{shorts30} Shorts / {long30} longform · 30d</span>
            {liveChannel?.subs != null && <span>{fmtNum(liveChannel.subs)} subs</span>}
            {v7 != null && <span style={{ color: v7 > 0 ? ACCENT : SMOKE }}>{v7 >= 0 ? '+' : ''}{fmtNum(v7)} views/7d</span>}
            {s7 != null && <span style={{ color: s7 > 0 ? ACCENT : SMOKE }}>{s7 >= 0 ? '+' : ''}{fmtNum(s7)} subs/7d</span>}
          </div>
        </div>
        {recent.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {recent.map((u) => {
              const ab = ageBadge[uploadAge(u.publishedAt, campaignStart)];
              return (
                <a key={u.id} href={ytUrl(u)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ position: 'relative', aspectRatio: '16 / 9', borderRadius: 6, overflow: 'hidden', background: INK }}>
                    <img src={ytThumb(u.id)} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <span style={{ position: 'absolute', top: 5, left: 5, fontSize: 7, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: MONO, color: WHITE, background: isShort(u) ? 'rgba(67,56,202,0.85)' : 'rgba(10,10,10,0.7)', padding: '2px 5px', borderRadius: 2 }}>{isShort(u) ? 'Short' : 'Long'}</span>
                  </div>
                  <div style={{ fontSize: 11, color: INK, marginTop: 5, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.title}</div>
                  <div style={{ fontSize: 9, color: SMOKE, fontFamily: MONO, marginTop: 2 }}>{fmtNum(u.viewCount)} · {relDays(u.publishedAt)} · {ab.label}</div>
                </a>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: SMOKE }}>No uploads in the last 60 days.</div>
        )}
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// EDIT TIMELINE (compact footer)
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
      const res = await fetch('/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ artist: artistName, timeline: draft.trim(), channelCtx, customSlug: slug, campaignStartDate: campaignStartDate ?? null }) });
      if (!res.ok) { const dd = await res.json().catch(() => ({})); setError(dd.error || 'Failed to regenerate'); return; }
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
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={Math.max(6, draft.split('\n').length + 1)} style={{ width: '100%', padding: '10px 12px', fontSize: 12, lineHeight: 1.6, color: INK, border: `1px solid ${hasChanges ? AMBER : BONE}`, borderRadius: 4, background: WHITE, outline: 'none', fontFamily: MONO, resize: 'vertical', boxSizing: 'border-box' }} />
            {error && <div style={{ marginTop: 8, fontSize: 11, color: RED }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={save} disabled={!hasChanges || saving} style={{ fontSize: 11, fontWeight: 700, padding: '8px 20px', background: hasChanges && !saving ? INK : BONE, color: hasChanges && !saving ? PAPER : GHOST, border: 'none', borderRadius: 4, cursor: hasChanges && !saving ? 'pointer' : 'default' }}>{saving ? 'Regenerating…' : 'Save & Regenerate'}</button>
              <button onClick={() => { setDraft(currentTimeline); setOpen(false); }} style={{ fontSize: 11, fontWeight: 600, padding: '8px 16px', background: 'none', color: SMOKE, border: `1px solid ${BONE}`, borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
