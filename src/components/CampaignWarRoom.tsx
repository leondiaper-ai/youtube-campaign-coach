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

import { useMemo, useRef, useState } from 'react';
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

// ── Standardised timeline status vocabulary ──
// Every milestone card resolves to exactly one of these. Specifics live in a
// supporting note line, never in the chip.
const STD = {
  live: { label: 'Live', color: ACCENT },
  ready: { label: 'Ready', color: AMBER },
  production: { label: 'In Production', color: INDIGO },
  planned: { label: 'Planned', color: SMOKE },
  reference: { label: 'Reference', color: GHOST },
};

// Tidy display titles that carry a leading date artifact from pasted timelines,
// e.g. ", 2026 – 'Mouse' IG release" → "'Mouse' IG release". Display-only — the
// raw title is still used for matching.
function cleanTitle(s: string): string {
  const out = s.replace(/^\s*,?\s*20\d{2}\s*[–—-]\s*/, '').replace(/^\s*[,–—-]\s*/, '').trim();
  return out || s;
}

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
// The calendar week (Mon–Sun) a date falls in — gives the timeline breathing room.
function weekRange(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  const mon = new Date(d); mon.setUTCDate(d.getUTCDate() - dow);
  const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6);
  const M = (x: Date) => MONTHS[x.getUTCMonth()];
  return mon.getUTCMonth() === sun.getUTCMonth()
    ? `${M(mon)} ${mon.getUTCDate()}–${sun.getUTCDate()}`
    : `${M(mon)} ${mon.getUTCDate()} – ${M(sun)} ${sun.getUTCDate()}`;
}
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
// A pre-release teaser (pre-save / coming soon) — identity-matches a moment but
// does NOT mean its content is live yet, so it must not flip a status to Live.
const isTeaser = (u: RecentUpload) => /pre-?save|pre-?order|coming soon|🔜|link in bio|out (this|next|fri|mon|tue|wed|thu|sat|sun)/i.test(u.title);
const ytThumb = (id: string, q: 'hqdefault' | 'maxresdefault' = 'hqdefault') => `https://i.ytimg.com/vi/${id}/${q}.jpg`;
const ytUrl = (u: RecentUpload) => isShort(u) ? `https://youtube.com/shorts/${u.id}` : `https://youtube.com/watch?v=${u.id}`;

// ── Identity tokens (shared with driveAssets vocabulary) ──
const STOP = new Set(['the', 'and', 'a', 'an', 'for', 'out', 'now', 'feat', 'ft', 'with', 'release', 'single', 'album', 'video', 'official', 'lyric', 'visualiser', 'visualizer', 'live', 'tour', 'day', 'song', 'announcement', 'announce', 'new', 'music', 'shorts', 'short', 'episode', 'recording', 'session', 'content', 'our', 'feature', 'mix', 'vol', 'dub', 'pre', 'ist']);
// Tokens >= 3 chars so short song codenames (PTS, NPC) match — aligned with
// the Drive identity matcher in driveAssets.ts.
function tok(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length >= 3 && !STOP.has(t));
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
      : anchorGap ? 'Hero YouTube Asset'
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

  // Next YouTube milestone — the next upcoming RELEASE moment, else the next moment.
  const upcoming = events.map((e) => ({ e, mt: momentType(e) })).filter((x) => x.e.dateISO >= t);
  const nextMoment = upcoming.find((x) => x.mt === 'release') ?? upcoming[0];
  const momentum = momentumSentence(m.summary, m.support);
  const focus = currentFocus(m.primaryGap, m.currentPhase);

  return (
    <div style={{ minHeight: '100vh', background: PAPER, color: INK }}>
      <CampaignRead
        artist={plan.artist} title={campaignTitle} phase={m.currentPhase}
        momentum={momentum}
      />
      <CampaignStatus
        rolloutActive={recentUploads.some((u) => daysAgoNum(u.publishedAt) <= 45)}
        datesMapped={events.length > 0}
        pipelineReady={hasAssets}
        nextTitle={nextMoment ? cleanTitle(nextMoment.e.title) : undefined}
        nextDate={nextMoment ? fmtDay(nextMoment.e.dateISO) : undefined}
        focus={focus}
      />
      <CurrentYouTubeSurface recentUploads={recentUploads} campaignStart={campaignStartDate} knownTitles={knownTitles} />
      <RecentActivity recentUploads={recentUploads} liveChannel={liveChannel} campaignStart={campaignStartDate} />
      <AssetSnapshot summary={m.summary} library={lib} hasAssets={hasAssets} folderUrl={lib.folderUrl || driveFolderUrl} slug={props.slug} />
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

function fmtDay(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  const mo = MONTHS[d.getUTCMonth()];
  return `${d.getUTCDate()} ${mo[0]}${mo.slice(1).toLowerCase()}`;
}

// Momentum line — what's already in place (positive, never an audit).
function momentumSentence(summary: ReturnType<typeof summarizeLibrary>, support: ReturnType<typeof supportInventory>): string {
  if (summary.total === 0) return 'Asset library not connected yet — scan the campaign folder to ground the rollout.';
  const byc = (c: DriveAssetClass) => summary.byClass.find((x) => x.cls === c)?.count ?? 0;
  const cats: { label: string; count: number }[] = [];
  if (byc('bts')) cats.push({ label: 'BTS', count: byc('bts') });
  if (byc('shorts_cutdown')) cats.push({ label: 'Shorts', count: byc('shorts_cutdown') });
  if (byc('live_performance')) cats.push({ label: 'live content', count: byc('live_performance') });
  if (summary.images) cats.push({ label: 'artwork', count: summary.images });
  if (summary.audio) cats.push({ label: 'audio masters', count: summary.audio });
  cats.sort((a, b) => b.count - a.count);
  const top = cats.slice(0, 3).map((c) => c.label);
  const list = top.length === 0 ? 'content'
    : top.length === 1 ? top[0]
    : `${top.slice(0, -1).join(', ')} and ${top[top.length - 1]}`;
  const adj = support.band === 'Deep' ? 'Deep' : support.band === 'Strong' ? 'Strong' : support.band === 'Building' ? 'Growing' : 'Early';
  return `${adj} multi-format content pipeline already in place across ${list}.`;
}

// Current focus — the next action stage, framed forward (no "missing/needs").
function currentFocus(primaryGap: string, phase: PhaseName): string {
  if (primaryGap === 'No assets scanned') return 'Connecting the YouTube asset library.';
  if (primaryGap === 'Hero YouTube Asset') return 'Preparing hero release assets.';
  if (primaryGap === 'Finished Shorts') return 'Cutting Shorts to drive discovery.';
  if (primaryGap === 'Artwork / Packaging') return 'Finishing artwork and Community packaging.';
  return phase === 'BUILD' ? 'Building anticipation ahead of the release window.'
    : phase === 'RELEASE' ? 'Executing the release rollout.'
    : phase === 'SCALE' ? 'Scaling reach with sustain content.'
    : 'Extending the campaign with catalogue support.';
}

function CampaignRead({ artist, title, phase, momentum }: {
  artist: string; title: string; phase: PhaseName; momentum: string;
}) {
  const pt = PHASE_TONE[phase];
  return (
    <section style={{ background: INK, color: PAPER }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '20px 40px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Link href="/coach" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: GHOST, textDecoration: 'none', fontFamily: MONO }}>
            <YTMark h={12} /> YouTube Rollout Status
          </Link>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: MONO, color: WHITE, background: pt.color, padding: '3px 10px', borderRadius: 3 }}>{pt.label} phase</span>
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginBottom: 6 }}>{artist}</div>
        <h1 style={{ fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 900, lineHeight: 0.95, letterSpacing: '-0.03em', textTransform: 'uppercase', margin: '0 0 16px', color: WHITE }}>{title}</h1>

        {/* Momentum — what's already in place */}
        <p style={{ fontSize: 'clamp(17px, 2.2vw, 22px)', fontWeight: 600, lineHeight: 1.35, letterSpacing: '-0.01em', color: WHITE, margin: 0, maxWidth: 860 }}>
          {momentum}
        </p>
      </div>
    </section>
  );
}

// ── Campaign Status — compact, dynamic readout right below the hero ──
function CampaignStatus({ rolloutActive, datesMapped, pipelineReady, nextTitle, nextDate, focus }: {
  rolloutActive: boolean; datesMapped: boolean; pipelineReady: boolean;
  nextTitle?: string; nextDate?: string; focus: string;
}) {
  const checks = [
    { ok: rolloutActive, on: 'Content rollout active', off: 'Content rollout pending' },
    { ok: datesMapped, on: 'Campaign dates mapped', off: 'Campaign dates not set' },
    { ok: pipelineReady, on: 'Asset pipeline established', off: 'Asset pipeline not connected' },
  ];
  const Field = ({ label, value }: { label: string; value: string }) => (
    <div>
      <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: INK, lineHeight: 1.3 }}>{value}</div>
    </div>
  );
  return (
    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 40px 0' }}>
      <div style={{ background: WHITE, border: `1px solid ${BONE}`, borderRadius: 10, padding: '16px 20px' }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginBottom: 12 }}>Campaign Status</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {checks.map((c) => {
            const color = c.ok ? ACCENT : SMOKE;
            return (
              <span key={c.on} style={{ fontSize: 11, fontFamily: MONO, fontWeight: 700, color, background: c.ok ? 'rgba(45,106,79,0.07)' : 'rgba(133,127,116,0.06)', border: `1px solid ${color}33`, padding: '4px 11px', borderRadius: 4 }}>
                {c.ok ? '✓' : '○'} {c.ok ? c.on : c.off}
              </span>
            );
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18, paddingTop: 14, borderTop: `1px solid ${BONE}` }}>
          {nextTitle && <Field label="Next Major Moment" value={`${nextTitle}${nextDate ? ` — ${nextDate}` : ''}`} />}
          <Field label="Current Focus" value={focus} />
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

function bankedStatuses(lib: AssetLibrary, folderUrl?: string) {
  const n = (cls: DriveAssetClass) => lib.assets.filter((a) => a.assetClass === cls).length;
  // First Drive link for a class, falling back to the campaign folder.
  const href = (match: (a: AssetLibrary['assets'][number]) => boolean) =>
    lib.assets.find((a) => match(a) && a.webViewLink)?.webViewLink ?? folderUrl;
  const finished = lib.assets.filter((a) => a.assetClass === 'shorts_cutdown' && a.classConfidence === 'high').length;
  const sources = n('shorts_cutdown');
  return [
    { label: 'Official Video', ready: n('official_video') > 0, href: href((a) => a.assetClass === 'official_video') },
    { label: 'BTS', ready: n('bts') > 0, href: href((a) => a.assetClass === 'bts') },
    { label: 'Shorts', ready: finished > 0, partial: finished === 0 && sources > 0, href: href((a) => a.assetClass === 'shorts_cutdown') },
    { label: 'Live Performance', ready: n('live_performance') > 0, href: href((a) => a.assetClass === 'live_performance') },
    { label: 'Artwork', ready: lib.assets.some((a) => a.mediaType === 'image'), href: href((a) => a.mediaType === 'image') },
  ];
}

// Connect / change a campaign's Drive folder URL inline. Saves to KV via the
// drive-assets API (URL-only attach — no scan), then refreshes the page so the
// link goes live immediately. Classification still happens on a later scan.
function ConnectDriveFolder({ slug, folderUrl }: { slug: string; folderUrl?: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Read straight from the input on save rather than mirroring into React state —
  // robust no matter how the value is entered (typing, paste, autofill).
  const inputRef = useRef<HTMLInputElement>(null);

  const openBtn: React.CSSProperties = { fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: MONO, color: WHITE, background: ACCENT, padding: '5px 12px', borderRadius: 4, textDecoration: 'none' };
  const ghostBtn: React.CSSProperties = { fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: MONO, color: SMOKE, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px' };

  const save = async () => {
    if (saving) return;
    const url = (inputRef.current?.value ?? '').trim();
    if (!url) { setError('Paste a Drive or Dropbox folder link'); return; }
    if (!/drive\.google\.com|docs\.google\.com|dropbox\.com/.test(url)) { setError('That doesn’t look like a Drive or Dropbox link'); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/coach/drive-assets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, folderUrl: url }),
      });
      if (!res.ok) throw new Error('save failed');
      setEditing(false);
      router.refresh();
    } catch { setError('Could not save — please try again'); }
    finally { setSaving(false); }
  };

  if (folderUrl && !editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <a href={folderUrl} target="_blank" rel="noopener noreferrer" style={openBtn}>Open YouTube Asset Library ↗</a>
        <button onClick={() => setEditing(true)} style={ghostBtn}>Change</button>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 300 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          ref={inputRef} defaultValue={folderUrl ?? ''}
          onChange={() => { if (error) setError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
          placeholder="Paste Google Drive or Dropbox folder URL"
          style={{ flex: 1, minWidth: 200, fontSize: 11, fontFamily: MONO, color: INK, background: WHITE, border: `1px solid ${BONE}`, borderRadius: 4, padding: '6px 9px', outline: 'none' }}
        />
        <button onClick={save} disabled={saving} style={{ ...openBtn, border: 'none', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.5 : 1 }}>{saving ? 'Saving…' : 'Connect'}</button>
        {folderUrl && <button onClick={() => { setEditing(false); setError(null); }} style={ghostBtn}>Cancel</button>}
      </div>
      {error && <div style={{ fontSize: 9, color: RED, fontFamily: MONO }}>{error}</div>}
    </div>
  );
}

function AssetSnapshot({ summary, library, hasAssets, folderUrl, slug }: {
  summary: ReturnType<typeof summarizeLibrary>; library: AssetLibrary; hasAssets: boolean; folderUrl?: string; slug: string;
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
          <ConnectDriveFolder slug={slug} folderUrl={folderUrl} />
        </div>
        {!hasAssets ? (
          <div style={{ fontSize: 13, color: SMOKE, lineHeight: 1.5, paddingTop: 14 }}>
            {folderUrl
              ? 'Drive folder connected. The classified asset library and timeline mapping appear here once the folder is scanned.'
              : 'No YouTube asset library connected yet. Paste this campaign’s Drive folder URL above to connect it — the link goes live straight away, and assets map onto the timeline once the folder is scanned.'}
          </div>
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
            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${BONE}`, marginBottom: 8 }}>Multi-Format Asset Coverage</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {bankedStatuses(library, folderUrl).map((b) => {
                const color = b.ready ? ACCENT : b.partial ? AMBER : SMOKE;
                const mark = b.ready ? '✓' : b.partial ? '◐' : '○';
                const text = b.ready ? `${b.label} Ready` : b.partial ? `${b.label} Sources` : `${b.label} To Source`;
                const chipStyle: React.CSSProperties = { fontSize: 10, fontFamily: MONO, fontWeight: 700, color, background: WHITE, border: `1px solid ${color}33`, padding: '3px 9px', borderRadius: 3, display: 'inline-flex', alignItems: 'center', gap: 4 };
                // Clickable when there's a Drive destination AND something to point at.
                return (b.href && (b.ready || b.partial)) ? (
                  <a key={b.label} href={b.href} target="_blank" rel="noopener noreferrer" title="Open in YouTube Asset Library" style={{ ...chipStyle, textDecoration: 'none', cursor: 'pointer' }}>
                    {mark} {text} <span style={{ opacity: 0.5, fontSize: 9 }}>↗</span>
                  </a>
                ) : (
                  <span key={b.label} style={chipStyle}>{mark} {text}</span>
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
// 4. MASTER TIMELINE (type-aware cards)
// ══════════════════════════════════════════════════════════════════════════

function MasterTimeline({ events, mappings, phases, activeIdx, recentUploads, campaignStart, knownTitles, pool, folderUrl }: {
  events: ParsedEvent[]; mappings: MilestoneMapping[]; phases: PhaseName[]; activeIdx: number;
  recentUploads: RecentUpload[]; campaignStart?: string; knownTitles: string[]; pool: Pool; folderUrl?: string;
}) {
  // Reflect when a support/live moment's content actually goes live: assign each
  // recent BTS/live upload to the NEAREST-by-date moment of that kind (so one
  // upload never lights up every BTS episode).
  const liveByMoment = (() => {
    // Group a longform (the MAIN asset) with its supporting Shorts onto ONE
    // moment, rather than spreading them across separate dates. Only genuinely
    // RECENT uploads count, so old catalogue reposts don't light up the future.
    const map = new Map<number, { primary?: RecentUpload; shorts: RecentUpload[] }>();
    const recent = recentUploads.filter((u) => uploadAge(u.publishedAt, campaignStart) === 'recent');
    const wantList = events
      .map((e, i) => ({ i, want: momentWantsKind(momentType(e)), ms: new Date(e.dateISO + 'T12:00:00').getTime() }))
      .filter((w) => w.want);
    const matchable = recent.filter((u) => { const k = uploadKind(u); return k === 'bts' || k === 'live'; });
    const newest = (a: RecentUpload, b: RecentUpload) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    // An upload only counts as a moment going live when it's TIME-ALIGNED with
    // that moment's planned date. Without this gate the matcher attaches a recent
    // upload to the nearest same-kind moment no matter how far apart — so a
    // catalogue live performance from weeks ago lights up a planned vlog in the
    // future ("NOW LIVE" on something that hasn't happened). A 21-day window keeps
    // genuine on-time / slightly-early drops while rejecting unrelated content.
    const WINDOW_MS = 21 * 86400000;
    const nearest = (k: UploadKind, pub: number, pred: (i: number) => boolean) => {
      const cands = wantList.filter((w) => w.want === k && pred(w.i) && Math.abs(w.ms - pub) <= WINDOW_MS);
      if (!cands.length) return undefined;
      cands.sort((a, b) => Math.abs(a.ms - pub) - Math.abs(b.ms - pub));
      return cands[0].i;
    };
    // 1. Longforms → their own nearest moment (one main asset per moment).
    for (const u of matchable.filter((u) => u.durationSec > 62).sort(newest)) {
      const i = nearest(uploadKind(u), new Date(u.publishedAt).getTime(), (idx) => !map.has(idx));
      if (i == null) continue;
      map.set(i, { primary: u, shorts: [] });
    }
    // 2. Shorts → group onto the nearest moment that already has a longform of
    //    the same kind; otherwise mark their own nearest free moment.
    for (const u of matchable.filter((u) => u.durationSec > 0 && u.durationSec <= 62).sort(newest)) {
      const k = uploadKind(u); const pub = new Date(u.publishedAt).getTime();
      const grouped = nearest(k, pub, (idx) => map.get(idx)?.primary != null);
      if (grouped != null) { map.get(grouped)!.shorts.push(u); continue; }
      const i = nearest(k, pub, (idx) => !map.has(idx));
      if (i != null) map.set(i, { shorts: [u] });
    }
    return map;
  })();

  // Cluster adjacent same-type moments within a 3-day window into ONE card —
  // the timeline shows campaign moments, not database rows.
  const types = events.map(momentType);
  const CLUSTER_TYPES = new Set<MomentType>(['release', 'announce', 'live', 'support']);
  const clusters: number[][] = [];
  for (let i = 0; i < events.length; i++) {
    const prev = clusters[clusters.length - 1];
    if (prev) {
      const j = prev[0];
      const within3 = Math.abs((new Date(events[i].dateISO + 'T12:00:00').getTime() - new Date(events[j].dateISO + 'T12:00:00').getTime()) / 86400000) <= 3;
      if (types[j] === types[i] && within3 && CLUSTER_TYPES.has(types[i])) { prev.push(i); continue; }
    }
    clusters.push([i]);
  }

  return (
    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 40px 0' }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.28em', textTransform: 'uppercase', color: INK, fontFamily: MONO, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}><YTMark h={12} /> YouTube Campaign Timeline</div>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: 54, top: 6, bottom: 6, width: 2, background: BONE }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {clusters.map((idxs, ci) => {
            const i0 = idxs[0];
            const ev = events[i0];
            const isCluster = idxs.length > 1;
            const showPhaseLabel = ci === 0 || phases[i0] !== phases[clusters[ci - 1][0]];
            const active = idxs.includes(activeIdx);
            let mapping = mappings[i0];
            let liveInfo = liveByMoment.get(i0);
            let titleOverride: string | undefined;
            let includes: string[] | undefined;
            if (isCluster) {
              const maps = idxs.map((i) => mappings[i]);
              const seen = new Set<string>();
              const assets = maps.flatMap((m) => m.assets).filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
              mapping = {
                ...maps[0],
                assets,
                present: Array.from(new Set(maps.flatMap((m) => m.present))),
                missing: Array.from(new Set(maps.flatMap((m) => m.missing))),
                anchorPresent: maps.some((m) => m.anchorPresent),
              };
              const lives = idxs.map((i) => liveByMoment.get(i)).filter(Boolean) as { primary?: RecentUpload; shorts: RecentUpload[] }[];
              const primary = lives.map((l) => l.primary).find(Boolean);
              const shorts = lives.flatMap((l) => l.shorts ?? []);
              liveInfo = (primary || shorts.length) ? { primary, shorts } : undefined;
              titleOverride = clusterTitle(types[i0], idxs.map((i) => events[i].title));
              includes = idxs.map((i) => events[i].title);
            }
            return (
              <MilestoneCard
                key={`${ev.dateISO}-${i0}`} ev={ev} mapping={mapping} phase={phases[i0]} active={active}
                showPhaseLabel={showPhaseLabel}
                recentUploads={recentUploads} campaignStart={campaignStart} knownTitles={knownTitles} pool={pool} folderUrl={folderUrl}
                live={liveInfo} titleOverride={titleOverride} includes={includes}
              />
            );
          })}
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

// Valid hero asset classes — any ONE satisfies hero coverage for a release.
const HERO_CLS: DriveAssetClass[] = ['official_video', 'visualiser', 'lyric_video', 'documentary'];
// Hero-asset titles: explicit "official video / visualiser / lyric", plus the
// common bare "(Official)" parenthetical artists use for the official video on
// their channel. "(Official Audio)" is deliberately NOT matched (no closing
// paren straight after "official").
const isHeroUploadTitle = (t: string) => /official\s*(music\s*)?video|visuali[sz]er|\blyric\b|\(official\)/i.test(t);

// When the timeline names a SPECIFIC deliverable, be specific about it rather
// than listing generic hero alternatives.
function namedHeroAsset(title: string): string | null {
  const t = title.toLowerCase();
  if (/visuali[sz]er/.test(t)) return 'Visualiser';
  if (/lyric/.test(t)) return 'Lyric Video';
  if (/official\s*(music\s*)?video|\bomv\b/.test(t)) return 'Official Video';
  if (/trailer/.test(t)) return 'Trailer';
  return null;
}

// A name for a cluster of same-type moments in the same window.
function clusterTitle(type: MomentType, titles: string[]): string {
  const t = titles.join(' ').toLowerCase();
  if (type === 'release') return 'Release Week';
  if (type === 'announce') return /album/.test(t) ? 'Album Announcement Week' : 'Announcement Week';
  if (type === 'live') return 'Live Week';
  if (type === 'support') return /recording|bts|studio/.test(t) ? 'Recording Week' : 'Content Week';
  return 'Campaign Week';
}

// What kind of moment a recent upload reflects — used to mark support/live
// moments as "Live on YouTube" even when titles don't share identity tokens.
type UploadKind = 'hero' | 'bts' | 'live' | 'short' | 'other';
function uploadKind(u: RecentUpload): UploadKind {
  const t = u.title.toLowerCase();
  if (isHeroUploadTitle(t)) return 'hero';
  if (/behind\s*the\s*scenes|\bbts\b|making\s*of|in\s*the\s*studio|recording|\bsession\b|\bvlog\b|day\s*in\s*the\s*life|diary|bandycam/.test(t)) return 'bts';
  if (/\blive\b|performance|\bgig\b|festival|on\s*tour|acoustic|live\s*from|live\s*at/.test(t)) return 'live';
  if (u.durationSec > 0 && u.durationSec <= 62) return 'short';
  return 'other';
}
function momentWantsKind(type: MomentType): UploadKind | null {
  return type === 'support' ? 'bts' : type === 'live' ? 'live' : null;
}

// A matched-asset chip that links to its Google Drive file/folder when known.
function AssetChip({ cls, href, suffix }: { cls: DriveAssetClass; href?: string; suffix?: string }) {
  const base: React.CSSProperties = {
    fontSize: 10, fontFamily: MONO, fontWeight: 700, color: ACCENT,
    background: 'rgba(45,106,79,0.08)', border: `1px solid ${ACCENT}30`,
    padding: '2px 8px', borderRadius: 3, whiteSpace: 'nowrap',
    display: 'inline-flex', alignItems: 'center', gap: 4,
  };
  const label = clsLabel(cls) + (suffix ? ` ${suffix}` : '');
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title="Open in YouTube Asset Library"
        style={{ ...base, textDecoration: 'none', cursor: 'pointer' }}>
        ✓ {label} <span style={{ opacity: 0.55, fontSize: 9 }}>↗</span>
      </a>
    );
  }
  // No Drive URL — visually softer, not clickable.
  return <span style={{ ...base, color: SMOKE, background: 'rgba(133,127,116,0.08)', border: `1px solid ${BONE}`, opacity: 0.85 }}>✓ {label}</span>;
}

// Per-type status + actions — no generic repetition.
function cardLogic(type: MomentType, mapping: MilestoneMapping | undefined, pool: Pool, named: string | null = null) {
  const present = Array.from(new Set((mapping?.assets ?? []).map((a) => a.assetClass).filter((c) => c !== 'press_doc' && c !== 'other'))) as DriveAssetClass[];
  const anchor = !!mapping?.anchorPresent;
  const hasShortPool = pool.shorts > 0;
  let status = { label: 'Planned', color: SMOKE };
  let missing: DriveAssetClass[] = [];
  const actions: string[] = [];

  if (type === 'release') {
    // Status is finalised in the card via the hero hierarchy (Drive vs YouTube).
    status = anchor ? { label: 'Hero Asset Ready', color: AMBER } : { label: 'Needs Hero YouTube Asset', color: RED };
    // Hero coverage is "any one valid hero asset" — never list missing hero
    // alternatives. Only flag non-hero gaps (packaging).
    missing = (mapping?.missing ?? []).filter((c) => c === 'artwork');
    if (!anchor) actions.push(named
      ? `Produce the ${named} ahead of release week — not in the asset library yet`
      : 'Lock a hero asset (official video / visualiser / lyric video) before release week');
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

function MilestoneCard({ ev, mapping, phase, active, showPhaseLabel, recentUploads, campaignStart, knownTitles, pool, folderUrl, live, titleOverride, includes }: {
  ev: ParsedEvent; mapping?: MilestoneMapping; phase: PhaseName; active: boolean; showPhaseLabel: boolean;
  recentUploads: RecentUpload[]; campaignStart?: string; knownTitles: string[]; pool: Pool; folderUrl?: string;
  live?: { primary?: RecentUpload; shorts: RecentUpload[] };
  titleOverride?: string; includes?: string[];
}) {
  // Direct Drive link for a matched asset class: the matching file, else the folder.
  const linkFor = (c: DriveAssetClass) =>
    (mapping?.assets ?? []).find((a) => a.assetClass === c && a.webViewLink)?.webViewLink ?? folderUrl;
  const dfn = daysFromNow(ev.dateISO);
  const pt = PHASE_TONE[phase];
  const type = momentType(ev);
  const mt = MOMENT_TONE[type];
  const displayTitle = cleanTitle(titleOverride ?? ev.title);
  const named = namedHeroAsset(includes && includes.length ? includes.join(' ') : ev.title); // specific deliverable named in the timeline
  const { present, missing, actions, hasContent } = cardLogic(type, mapping, pool, named);

  // YouTube context — current (non-archive) uploads that identity-match THIS
  // milestone (known titles fold in only when the milestone references them).
  const evTokens = momentTokens(ev.title, knownTitles);
  const liveMatch = evTokens.length === 0 ? undefined : recentUploads
    .filter((u) => shareTok(tok(u.title), evTokens) && uploadAge(u.publishedAt, campaignStart) !== 'archive')
    .sort((a, b) => b.viewCount - a.viewCount)[0];

  // ── Live-on-YouTube + hero coverage ─────────────────────────────────────
  // Release: a hero-type upload identity-matched to this milestone.
  // Support/live: a type-matched recent upload assigned to this moment (so the
  // timeline reflects when a BTS / live moment actually goes live).
  const heroLive = type === 'release' && liveMatch && isHeroUploadTitle(liveMatch.title) ? liveMatch : undefined;
  const isSupportType = type === 'support' || type === 'live';
  const primaryLive = isSupportType ? live?.primary : undefined;       // the main longform asset, if live
  const shortLives = isSupportType ? (live?.shorts ?? []) : [];        // supporting Shorts, if live
  const heroInDrive = !!mapping?.anchorPresent;
  const mainFormat = type === 'live' ? 'full performance' : 'longform';
  // A non-release moment whose title identity-matches a genuinely live upload
  // the kind-based matcher didn't surface (a freestyle, a featured drop). Keeps
  // the status honest — no PLANNED chip sitting above an "already live" video.
  const softLive = (!heroLive && !primaryLive && shortLives.length === 0
    && type !== 'release' && type !== 'archive'
    && liveMatch && !isTeaser(liveMatch)) ? liveMatch : undefined;

  // ── Standardised primary status ─────────────────────────────────────────
  // Every card resolves to ONE of five labels: LIVE / READY / IN PRODUCTION /
  // PLANNED / REFERENCE. The specific detail (which hero asset, what's live,
  // what's still to source) moves to the supporting note line under the title —
  // never into the status chip itself.
  let displayStatus: { label: string; color: string };
  let statusNote: string;
  let statusHref: string | undefined;
  let statusTitle = 'Open in YouTube Asset Library';
  const driveHref = hasContent ? (present[0] ? linkFor(present[0]) : folderUrl) : undefined;

  if (type === 'archive') {
    displayStatus = STD.reference; statusNote = 'Catalogue reference informing the rollout';
    statusHref = driveHref;
  } else if (heroLive) {
    displayStatus = STD.live; statusNote = 'Hero asset live on YouTube';
    statusHref = ytUrl(heroLive); statusTitle = 'Watch the hero asset on YouTube';
  } else if (primaryLive) {
    displayStatus = STD.live;
    statusNote = type === 'live' ? 'Full performance live on YouTube' : 'Longform asset live on YouTube';
    statusHref = ytUrl(primaryLive); statusTitle = 'Watch on YouTube';
  } else if (shortLives.length) {
    displayStatus = STD.live; statusNote = `Supporting Short live — main ${mainFormat} still to come`;
    statusHref = ytUrl(shortLives[0]); statusTitle = 'Watch on YouTube';
  } else if (softLive) {
    displayStatus = STD.live;
    statusNote = type === 'live' ? 'Performance live on YouTube' : 'Already live on YouTube';
    statusHref = ytUrl(softLive); statusTitle = 'Watch on YouTube';
  } else if (type === 'release') {
    if (heroInDrive) { displayStatus = STD.ready; statusNote = 'Hero asset in the YouTube library'; }
    else if (named) { displayStatus = STD.production; statusNote = `${named} in production — not in the library yet`; }
    else { displayStatus = STD.planned; statusNote = 'Hero asset still to be locked for release week'; }
    statusHref = driveHref;
  } else if (type === 'announce') {
    if (present.length) { displayStatus = STD.ready; statusNote = 'Announcement assets partly in place'; }
    else { displayStatus = STD.planned; statusNote = 'Announcement trailer and artwork to prepare'; }
    statusHref = driveHref;
  } else if (type === 'live') {
    if (present.length || pool.live > 0) { displayStatus = STD.ready; statusNote = 'Performance content in the library'; }
    else { displayStatus = STD.planned; statusNote = 'Performance capture planned'; }
    statusHref = driveHref;
  } else { // support
    if (present.length || pool.bts > 0 || pool.shorts > 0) { displayStatus = STD.ready; statusNote = 'Session content in the library'; }
    else { displayStatus = STD.planned; statusNote = 'Content capture planned for this moment'; }
    statusHref = driveHref;
  }

  // The main upload to surface + any supporting Shorts shown on the SAME card.
  let mainLive: RecentUpload | undefined;
  let supportingShorts: RecentUpload[] = [];
  if (type === 'release') mainLive = heroLive;
  else if (primaryLive) { mainLive = primaryLive; supportingShorts = shortLives; }
  else if (shortLives.length) { mainLive = shortLives[0]; supportingShorts = shortLives.slice(1); }
  else mainLive = softLive ?? (type === 'archive' ? liveMatch : undefined);

  const liveLabel = heroLive ? 'Hero asset live on YouTube'
    : primaryLive ? (type === 'live' ? 'Performance live' : 'Longform live')
    : shortLives.length ? 'Supporting Short live'
    : 'Already live';
  const shownActions = heroLive
    ? ['Live — amplify with a Community post, Shorts and a playlist add']
    : primaryLive
      ? ['Main asset live — amplify with a Community post and a playlist add']
      : shortLives.length
        ? [`Supporting Short live — the main ${mainFormat} is still to come`]
        : actions;

  const isLive = !!(heroLive || primaryLive || shortLives.length || softLive);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '108px 1fr', alignItems: 'start' }}>
      <div style={{ position: 'relative', paddingTop: 4 }}>
        {showPhaseLabel && <div style={{ position: 'absolute', top: -22, left: 0, fontSize: 8, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: pt.color, fontFamily: MONO }}>{pt.label}</div>}
        <div style={{ textAlign: 'right', paddingRight: 22 }}>
          {isLive ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.08em', color: ACCENT, fontFamily: MONO, lineHeight: 1.1 }}>NOW LIVE</div>
              <div style={{ fontSize: 8, color: GHOST, fontFamily: MONO, marginTop: 5 }}>planned {weekRange(ev.dateISO)}</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 800, color: INK, fontFamily: MONO, letterSpacing: '0', lineHeight: 1.3 }}>{weekRange(ev.dateISO)}</div>
              <div style={{ fontSize: 8, color: GHOST, fontFamily: MONO, marginTop: 5 }}>{dfn >= 0 ? `in ${dfn}d` : `${-dfn}d ago`}</div>
            </>
          )}
        </div>
        <div style={{ position: 'absolute', right: -5, top: 8, width: 12, height: 12, borderRadius: '50%', background: isLive ? ACCENT : (active ? mt.color : WHITE), border: `2px solid ${isLive ? ACCENT : mt.color}`, zIndex: 1 }} />
      </div>

      <div style={{ background: WHITE, border: active ? `2px solid ${mt.color}` : `1px solid ${BONE}`, boxShadow: active ? `0 0 0 4px ${mt.color}12` : 'none', borderRadius: 10, padding: '13px 18px 15px', borderLeft: `3px solid ${mt.color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: mt.color, fontFamily: MONO }}>{mt.label}{includes && includes.length ? ` · ${includes.length} moments` : ''}</span>
            <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-0.01em', textTransform: 'uppercase', color: INK, lineHeight: 1.15, marginTop: 3 }}>{displayTitle}</div>
            <div style={{ fontSize: 11.5, color: SMOKE, marginTop: 4, lineHeight: 1.35 }}>{statusNote}</div>
            {includes && includes.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: SMOKE, fontFamily: MONO }}>Includes</span>
                {includes.map((t, k) => (
                  <span key={k} style={{ fontSize: 10, fontWeight: 700, fontFamily: MONO, color: mt.color, background: `${mt.color}12`, border: `1px solid ${mt.color}33`, padding: '2px 8px', borderRadius: 3, whiteSpace: 'nowrap' }}>
                    {cleanTitle(t).replace(/:.*$/, '').trim()}
                  </span>
                ))}
              </div>
            )}
          </div>
          {statusHref ? (
            <a href={statusHref} target="_blank" rel="noopener noreferrer" title={statusTitle}
              style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: MONO, color: WHITE, background: displayStatus.color, padding: '4px 10px', borderRadius: 3, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {displayStatus.label} <span style={{ opacity: 0.6, fontSize: 8 }}>↗</span>
            </a>
          ) : (
            <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: MONO, color: WHITE, background: displayStatus.color, padding: '4px 10px', borderRadius: 3 }}>{displayStatus.label}</span>
          )}
        </div>

        {/* Assets — only when something is genuinely present or missing */}
        {(present.length > 0 || missing.length > 0) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 11 }}>
            {present.length > 0 && (
              <div>
                <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginBottom: 6 }}>Matched assets</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{present.map((c) => <AssetChip key={c} cls={c} href={linkFor(c)} suffix={HERO_CLS.includes(c) ? 'Available' : undefined} />)}</div>
              </div>
            )}
            {missing.length > 0 && (
              <div>
                <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginBottom: 6 }}>Still to source</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{missing.map((c) => <Chip key={c} ok={false}>{clsLabel(c)}</Chip>)}</div>
              </div>
            )}
          </div>
        )}

        {/* YouTube context — the main live upload, with supporting Shorts on the same card */}
        {mainLive && (
          <div style={{ marginTop: 11 }}>
            <a href={ytUrl(mainLive)} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
              <img src={ytThumb(mainLive.id)} alt="" style={{ width: 64, height: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: ACCENT, fontWeight: 600, lineHeight: 1.3 }}>
                ✓ {liveLabel}: {mainLive.title.length > 46 ? mainLive.title.slice(0, 43) + '…' : mainLive.title} · {fmtNum(mainLive.viewCount)} views · {relDays(mainLive.publishedAt)}
              </span>
            </a>
            {supportingShorts.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO }}>Supporting Shorts</span>
                {supportingShorts.slice(0, 4).map((s) => (
                  <a key={s.id} href={ytUrl(s)} target="_blank" rel="noopener noreferrer" title={s.title} style={{ position: 'relative', display: 'block', textDecoration: 'none' }}>
                    <img src={ytThumb(s.id)} alt="" style={{ width: 46, height: 26, objectFit: 'cover', borderRadius: 3, border: `1px solid ${BONE}` }} />
                    <span style={{ position: 'absolute', bottom: 1, right: 2, fontSize: 7, fontWeight: 800, color: WHITE, fontFamily: MONO, textShadow: '0 0 3px rgba(0,0,0,0.9)' }}>{fmtNum(s.viewCount)}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* One or two tailored actions */}
        <div style={{ marginTop: 11, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {shownActions.map((a, i) => (
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
