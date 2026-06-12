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
    || /official\s*video|visuali[sz]er|lyric\s*video|\bsingle\b|album\s*release|deluxe|focus\s*track/.test(t)
    // A bare "album" drop is a release too — but not an announce / pre-order /
    // tracklist / world-building moment that merely mentions the album.
    || (/\balbum\b/.test(t) && !/announce|pre-?order|trailer|tracklist|build|story|creation|countdown|teaser|diary|photo|visual|behind|\bbts\b|making/.test(t))) return 'release';
  // World-building / content support — even when titled "reveal" (photography,
  // visual world, storytelling, BTS, diary). These group into a phase, not an
  // announcement.
  if (/photo(graphy)?|visual\s*world|artwork|aesthetic|imagery|storytelling|behind\s*the|\bbts\b|making\s*of/.test(t)) return 'support';
  if (k === 'albumAnnounce' || k === 'tourAnnounce' || /announce|pre-?order|reveal|tracklist/.test(t)) return 'announce';
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

// A short descriptor of what KIND of campaign this is, so the planner makes the
// "world" obvious (Album / EP / Single / Documentary campaign).
function campaignKindLabel(events: ParsedEvent[]): string {
  const titles = events.map((e) => e.title.toLowerCase());
  const kinds = events.map((e) => e.kind);
  const hasAlbum = kinds.includes('albumRelease')
    || titles.some((t) => /\balbum\b/.test(t) && !/announce|pre-?order|trailer|tracklist|build|story|creation|countdown|teaser|diary|photo|visual|behind|\bbts\b|making/.test(t));
  if (hasAlbum) return 'Album Campaign';
  if (titles.some((t) => /\bep\b/.test(t))) return 'EP Campaign';
  if (kinds.includes('documentaryRelease')) return 'Documentary Campaign';
  // Count actual release moments via the same classifier the timeline uses.
  const releases = events.filter((e) => momentType(e) === 'release').length;
  if (releases > 1) return 'Singles Campaign';
  if (releases === 1) return 'Single Campaign';
  return 'Campaign';
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
  // campaignKindLabel kept for future surfaces but no longer shown in the header.
  void campaignKindLabel;
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
  const headline = headlineSentence(events, nextMoment);
  const focus = currentFocus(m.primaryGap, m.currentPhase);

  return (
    <div style={{ minHeight: '100vh', background: PAPER, color: INK }}>
      <CampaignRead
        artist={plan.artist} title={campaignTitle} phase={m.currentPhase}
        headline={headline}
      />
      <CampaignStatus
        rolloutActive={recentUploads.some((u) => daysAgoNum(u.publishedAt) <= 45)}
        datesMapped={events.length > 0}
        pipelineReady={hasAssets}
        nextTitle={nextMoment ? cleanTitle(nextMoment.e.title) : undefined}
        nextDate={nextMoment ? fmtDay(nextMoment.e.dateISO) : undefined}
        focus={focus}
      />
      <CurrentYouTubeSurface recentUploads={recentUploads} campaignStart={campaignStartDate} knownTitles={knownTitles} nextLinkedEvent={nextMoment?.e.videoId ? nextMoment.e : undefined} />
      <RecentActivity recentUploads={recentUploads} liveChannel={liveChannel} campaignStart={campaignStartDate} />
      <ContentSupply events={events} library={lib} hasAssets={hasAssets} folderUrl={lib.folderUrl || driveFolderUrl} slug={props.slug} />
      <MasterTimeline
        events={events} mappings={m.mappings} phases={m.phases} activeIdx={activeIdx}
        recentUploads={recentUploads} campaignStart={campaignStartDate} knownTitles={knownTitles} pool={pool}
        folderUrl={lib.folderUrl || driveFolderUrl} slug={props.slug} hasAssets={hasAssets}
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

// Dynamic headline — always leads with the next timeline moment, never the
// asset library. Keeps the campaign page feeling current on every load.
function headlineSentence(
  events: ParsedEvent[],
  nextMoment: { e: ParsedEvent; mt: MomentType } | undefined,
): string {
  if (!nextMoment) {
    // All events in the past — campaign is done.
    if (events.length > 0) return 'Campaign rollout complete.';
    return 'Timeline being mapped.';
  }
  const e = nextMoment.e;
  const name = extractEventName(e);
  const date = fmtDay(e.dateISO);
  const today = todayISO();
  const dDays = Math.round((new Date(e.dateISO + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) / 86400000);
  const when = dDays <= 0 ? 'today' : dDays === 1 ? 'tomorrow' : dDays <= 7 ? `this week — ${date}` : date;

  if (nextMoment.mt === 'release') {
    if (e.videoId) return `Video in for ${name} — dropping ${when}.`;
    if (dDays <= 14) return `${name} drops ${when} — lock the hero asset.`;
    return `Next up: ${name} on ${when}.`;
  }
  if (nextMoment.mt === 'announce') return `${name} going out ${when}.`;
  return `${name} coming ${when}.`;
}

// Pull the human-readable event name from a timeline title.
// "Single 3 Release - ‘CAN’T SAY NO’ with Young Adz" → "Can’t Say No with Young Adz"
function extractEventName(e: ParsedEvent): string {
  const t = e.title;
  // Try quoted name first — greedy match between first and last quote so
  // apostrophes inside (CAN’T, DON’T) aren’t mistaken for closing delimiters.
  // Use simple quote chars — timeline titles use straight quotes in practice.
  const quoted = t.match(/’(.+)’\s+with\b/i) || t.match(/’(.+)’/);
  if (quoted) {
    const afterQuote = t.slice(t.lastIndexOf("’"));
    const feat = afterQuote.match(/’\s*with\s+(.+?)(?:\s*[-–(]|$)/i);
    const base = toTitleCase(quoted[1]);
    return feat ? `${base} with ${feat[1].trim()}` : base;
  }
  // Strip common prefixes and trim long album/tour titles.
  let stripped = t
    .replace(/^single\s*\d*\s*release\s*[-–—:]\s*/i, '')
    .replace(/\(on youtube\)/i, '')
    .replace(/\(.*?\)/g, '')               // remove parentheticals
    .replace(/\s+/g, ' ')
    .trim();
  // "TRAPO 2 Album Release + Tour Announce UK..." → "TRAPO 2"
  const albumParts = stripped.match(/^(.+?)\s+album\s+release/i);
  if (albumParts) stripped = albumParts[1] + ' album';
  // "Documentary Release" / "Documentary Tease" → keep as is
  if (/^documentary\b/i.test(stripped)) stripped = stripped.replace(/^documentary\s*/i, 'Documentary ').trim();
  return stripped || t;
}

function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());
}

// Current focus — the next action stage, framed forward (no "missing/needs").
function currentFocus(primaryGap: string, phase: PhaseName): string {
  // When no assets are scanned, skip asset-focused messaging — the phase message
  // is more useful until the folder is connected.
  if (primaryGap === 'No assets scanned') {
    return phase === 'BUILD' ? 'Building anticipation ahead of the release window.'
      : phase === 'RELEASE' ? 'Executing the release rollout.'
      : phase === 'SCALE' ? 'Scaling reach with sustain content.'
      : 'Extending the campaign with catalogue support.';
  }
  if (primaryGap === 'Hero YouTube Asset') return 'Preparing hero release assets.';
  if (primaryGap === 'Finished Shorts') return 'Cutting Shorts to drive discovery.';
  if (primaryGap === 'Artwork / Packaging') return 'Finishing artwork and Community packaging.';
  return phase === 'BUILD' ? 'Building anticipation ahead of the release window.'
    : phase === 'RELEASE' ? 'Executing the release rollout.'
    : phase === 'SCALE' ? 'Scaling reach with sustain content.'
    : 'Extending the campaign with catalogue support.';
}

function CampaignRead({ artist, title, phase, headline }: {
  artist: string; title: string; phase: PhaseName; headline: string;
}) {
  const pt = PHASE_TONE[phase];
  return (
    <section style={{ background: INK, color: PAPER }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '20px 40px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          {/* Static branding — no link back to the watcher, so a shared planner
              never lets external viewers navigate into the internal app. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO }}>
            <YTMark h={12} /> YouTube Rollout Status
          </div>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: MONO, color: WHITE, background: pt.color, padding: '3px 10px', borderRadius: 3 }}>{pt.label} phase</span>
        </div>
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO }}>{artist}</span>
        </div>
        <h1 style={{ fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 900, lineHeight: 0.95, letterSpacing: '-0.03em', textTransform: 'uppercase', margin: '0 0 16px', color: WHITE }}>{title}</h1>

        {/* Dynamic headline — always about the next timeline moment */}
        <p style={{ fontSize: 'clamp(17px, 2.2vw, 22px)', fontWeight: 600, lineHeight: 1.35, letterSpacing: '-0.01em', color: WHITE, margin: 0, maxWidth: 860 }}>
          {headline}
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
  // When the asset pipeline isn't connected, hide that chip entirely — the
  // Content Supply section handles the connect CTA. Only surface it once live.
  const checks = [
    { ok: rolloutActive, on: 'Content rollout active', off: 'Content rollout pending' },
    { ok: datesMapped, on: 'Campaign dates mapped', off: 'Campaign dates not set' },
    ...(pipelineReady ? [{ ok: true as const, on: 'Asset pipeline established', off: '' }] : []),
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

function CurrentYouTubeSurface({ recentUploads, campaignStart, knownTitles, nextLinkedEvent }: {
  recentUploads: RecentUpload[]; campaignStart?: string; knownTitles: string[];
  nextLinkedEvent?: ParsedEvent;
}) {
  // If the next timeline event has a linked (unlisted) video, promote it as
  // the hero — this is the single YouTube needs to know is coming next.
  if (nextLinkedEvent?.videoId) {
    const vid = nextLinkedEvent.videoId;
    const name = extractEventName(nextLinkedEvent);
    const date = fmtDay(nextLinkedEvent.dateISO);
    const today = todayISO();
    const dDays = Math.round((new Date(nextLinkedEvent.dateISO + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) / 86400000);
    const when = dDays <= 0 ? 'Dropping today' : dDays === 1 ? 'Dropping tomorrow' : dDays <= 7 ? `This week — ${date}` : date;

    return (
      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '22px 40px 0' }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.26em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}><YTMark h={11} /> Next Up on YouTube</div>
        <a href={`https://youtube.com/watch?v=${vid}`} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
          <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: INK, aspectRatio: '21 / 8' }}>
            <img src={ytThumb(vid, 'maxresdefault')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.72 }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(10,10,10,0.82) 0%, rgba(10,10,10,0.18) 70%)' }} />
            <div style={{ position: 'absolute', top: 14, left: 16, display: 'flex', gap: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: MONO, color: WHITE, background: RED, padding: '4px 10px', borderRadius: 3 }}>
                Next Single
              </span>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: MONO, color: WHITE, background: 'rgba(255,255,255,0.14)', padding: '4px 10px', borderRadius: 3 }}>Unlisted</span>
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 22px' }}>
              <div style={{ fontSize: 'clamp(18px, 2.4vw, 28px)', fontWeight: 900, color: WHITE, lineHeight: 1.15, maxWidth: 680, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>{name}</div>
              <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.6)', fontFamily: MONO, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ color: WHITE, fontWeight: 800, fontSize: 13 }}>{when}</span>
                <span>Unlisted — click to preview</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT, display: 'inline-block' }} />
                  Video ready
                </span>
              </div>
            </div>
          </div>
        </a>
      </section>
    );
  }

  if (recentUploads.length === 0) return null;

  const titleTokens = knownTitles.flatMap(tok);
  const score = (u: RecentUpload) => {
    const age = uploadAge(u.publishedAt, campaignStart);
    const ageW = age === 'recent' ? 3 : age === 'campaign' ? 2 : 1;
    const rel = shareTok(tok(u.title), titleTokens) ? 1.4 : 1;
    return ageW * rel * Math.log10(Math.max(10, u.viewCount));
  };
  // When every upload is archive (no recent campaign activity), prefer the
  // most-recently-published video — a 400-day-old upload is more representative
  // than an 8-year-old catalogue hit, regardless of view count.
  const allArchive = recentUploads.every((u) => uploadAge(u.publishedAt, campaignStart) === 'archive');
  const hero = allArchive
    ? [...recentUploads].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())[0]
    : [...recentUploads].sort((a, b) => score(b) - score(a))[0];
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

// ── Content Supply — recommended volumes calculated from the timeline ───────
// Not a score and not fixed numbers: ranges scale with campaign length, the
// number of singles, album presence and release cadence. Shows teams what a
// well-supported YouTube campaign could look like for THIS timeline.
type SupplyRow = {
  cls: DriveAssetClass | 'community';
  label: string; have: number | null; lo: number; hi: number; note: string; href?: string;
};
function computeContentSupply(events: ParsedEvent[], lib: AssetLibrary, folderUrl?: string, linkedVideoCount?: number) {
  const isSingle = (e: ParsedEvent) => {
    if (momentType(e) !== 'release') return false;
    if (namedHeroAsset(e.title)) return false;
    const t = e.title.toLowerCase();
    if (/\balbum\b|\bep\b|bundle|acoustic|deluxe|pre-?order|focus\s*track|documentary/.test(t)) return false;
    return /\bsingle\b/.test(t) || e.kind === 'singleRelease';
  };
  const singles = events.filter(isSingle).length;
  const hasAlbum = events.some((e) => {
    if (e.kind === 'albumRelease') return true;
    const t = e.title.toLowerCase();
    // The word "album" in a release context — but not an announcement, pre-order,
    // trailer, tracklist or generic "album build / story" support moment.
    return /\balbum\b/.test(t) && !/announce|pre-?order|trailer|tracklist|build|story|creation|countdown|teaser|diary/.test(t);
  });
  const ms = events.map((e) => new Date(e.dateISO + 'T12:00:00').getTime()).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const days = ms.length > 1 ? (ms[ms.length - 1] - ms[0]) / 86400000 : 30;
  const months = Math.max(1, Math.round(days / 30.4));

  const cnt = (cls: DriveAssetClass) => lib.assets.filter((a) => a.assetClass === cls).length;
  const href = (cls: DriveAssetClass) => lib.assets.find((a) => a.assetClass === cls && a.webViewLink)?.webViewLink ?? folderUrl;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  // Shorts: campaign-length bucket, scaled by number of singles.
  const bucket = months <= 3 ? [10, 20] : months <= 6 ? [20, 40] : [40, 80];
  const shortsLo = singles > 0 ? clamp(singles * 10, bucket[0], bucket[1]) : bucket[0];
  const shortsHi = singles > 0 ? clamp(singles * 15, bucket[0], bucket[1]) : bucket[1];
  const large = hasAlbum || singles >= 3;

  const rows: SupplyRow[] = [
    { cls: 'official_video', label: 'Official Video', have: cnt('official_video') + (linkedVideoCount ?? 0), lo: Math.max(1, singles), hi: Math.max(1, singles) + (hasAlbum ? 1 : 0), note: `One per single${hasAlbum ? ' + focus track' : ''}${(linkedVideoCount ?? 0) > 0 ? ` · ${linkedVideoCount} linked` : ''}`, href: href('official_video') },
    { cls: 'visualiser', label: 'Visualiser', have: cnt('visualiser'), lo: Math.max(1, singles), hi: Math.max(1, singles), note: 'Supports singles when an official video isn’t available', href: href('visualiser') },
    { cls: 'lyric_video', label: 'Lyric Video', have: cnt('lyric_video'), lo: Math.max(1, singles), hi: Math.max(1, singles), note: 'Typically 7–10 days after a single to extend activity', href: href('lyric_video') },
    { cls: 'trailer', label: 'Trailer / Teaser', have: cnt('trailer'), lo: 1, hi: singles >= 2 ? 3 : 2, note: 'Campaign teasers, album trailers and announcement clips', href: href('trailer') },
    { cls: 'shorts_cutdown', label: 'Shorts', have: cnt('shorts_cutdown'), lo: shortsLo, hi: shortsHi, note: 'Based on campaign length and release cadence', href: href('shorts_cutdown') },
    { cls: 'bts', label: 'BTS', have: cnt('bts'), lo: Math.max(4, singles * 2), hi: Math.max(6, singles * 3), note: 'Studio, behind-the-video, songwriting and storytelling moments', href: href('bts') },
    { cls: 'live_performance', label: 'Live / Acoustic', have: cnt('live_performance'), lo: large ? 4 : 2, hi: large ? 8 : 4, note: 'Acoustic versions, live sessions and performance content', href: href('live_performance') },
  ];
  return { singles, hasAlbum, months, rows };
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
    if (!url) { setError('Paste a Drive, Dropbox or Frame.io link'); return; }
    if (!/drive\.google\.com|docs\.google\.com|dropbox\.com|frame\.io/.test(url)) { setError('That doesn’t look like a Drive, Dropbox or Frame.io link'); return; }
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
        <a href={folderUrl} target="_blank" rel="noopener noreferrer" style={openBtn}>Open Asset Library ↗</a>
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
          placeholder="Paste Google Drive, Dropbox or Frame.io URL"
          style={{ flex: 1, minWidth: 200, fontSize: 11, fontFamily: MONO, color: INK, background: WHITE, border: `1px solid ${BONE}`, borderRadius: 4, padding: '6px 9px', outline: 'none' }}
        />
        <button onClick={save} disabled={saving} style={{ ...openBtn, border: 'none', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.5 : 1 }}>{saving ? 'Saving…' : 'Connect'}</button>
        {folderUrl && <button onClick={() => { setEditing(false); setError(null); }} style={ghostBtn}>Cancel</button>}
      </div>
      {error && <div style={{ fontSize: 9, color: RED, fontFamily: MONO }}>{error}</div>}
    </div>
  );
}

// One card — the single source of truth for campaign assets: what's in hand vs
// the recommended volume for THIS timeline (merges the old Pipeline + Coverage).
function ContentSupply({ events, library, hasAssets, folderUrl, slug }: {
  events: ParsedEvent[]; library: AssetLibrary; hasAssets: boolean; folderUrl?: string; slug: string;
}) {
  // Count events with linked videos as banked Official Video assets
  const linkedVideoCount = events.filter((e) => e.videoId).length;
  const supply = computeContentSupply(events, library, folderUrl, linkedVideoCount);
  const range = (lo: number, hi: number) => (lo === hi ? String(lo) : `${lo}–${hi}`);

  // ── Scan freshness ──────────────────────────────────────────────────
  const scanAge = useMemo(() => {
    if (!library.scannedAt) return null;
    const ms = Date.now() - new Date(library.scannedAt).getTime();
    if (!Number.isFinite(ms) || ms < 0) return null;
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }, [library.scannedAt]);

  // ── New-asset tracking (from scan diff) ─────────────────────────────
  const newIds = useMemo(() => new Set(library.newAssetIds ?? []), [library.newAssetIds]);
  const newByClass = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of library.assets) {
      if (newIds.has(a.id)) map.set(a.assetClass, (map.get(a.assetClass) ?? 0) + 1);
    }
    return map;
  }, [library.assets, newIds]);
  const totalNew = newIds.size;
  const totalRemoved = library.removedAssetIds?.length ?? 0;

  const Row = ({ r }: { r: SupplyRow }) => {
    const have = r.have;
    const pct = r.lo > 0 && have != null ? Math.min(100, Math.round((have / r.lo) * 100)) : 0;
    const met = have != null && have >= r.lo;
    const color = met ? ACCENT : (have ?? 0) > 0 ? AMBER : GHOST;
    const classNew = newByClass.get(r.cls) ?? 0;
    const body = (
      <div style={{ padding: '11px 0', borderBottom: `1px solid ${BONE}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>
            {r.label}
            {r.href && (have ?? 0) > 0 ? <span style={{ color: ACCENT, fontSize: 9, marginLeft: 6 }}>↗</span> : null}
            {classNew > 0 && (
              <span style={{ fontSize: 8, fontWeight: 800, fontFamily: MONO, letterSpacing: '0.06em', color: ACCENT, background: 'rgba(45,106,79,0.08)', border: `1px solid ${ACCENT}30`, padding: '1px 5px', borderRadius: 3, marginLeft: 8, verticalAlign: 'middle' }}>
                +{classNew} NEW
              </span>
            )}
          </span>
          <span style={{ fontSize: 12, color: SMOKE, fontFamily: MONO, whiteSpace: 'nowrap' }}>
            <span style={{ color: INK, fontWeight: 800 }}>{have == null ? '—' : have}</span> / {range(r.lo, r.hi)}
          </span>
        </div>
        <div style={{ height: 4, background: BONE, borderRadius: 3, margin: '7px 0 6px', overflow: 'hidden', maxWidth: 340 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
        </div>
        <div style={{ fontSize: 11, color: SMOKE, lineHeight: 1.4 }}>{r.note}</div>
      </div>
    );
    return r.href && (have ?? 0) > 0
      ? <a href={r.href} target="_blank" rel="noopener noreferrer" title="Open in Asset Library" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>{body}</a>
      : body;
  };

  // ── Collapsed view when the asset folder isn't connected ──────────────
  // Roll up the supply table into a compact bar so it doesn't dominate the
  // page with empty counts. The connect CTA stays visible. Teams can expand
  // to see recommendations before connecting.
  if (!hasAssets) {
    return (
      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 40px 0' }}>
        <style>{`.supply-rollup>summary{list-style:none;cursor:pointer}.supply-rollup>summary::-webkit-details-marker{display:none}.supply-rollup .supply-chev{display:inline-block;transition:transform .15s ease}.supply-rollup[open] .supply-chev{transform:rotate(90deg)}.supply-rollup>summary:hover{background:rgba(0,0,0,0.015)}`}</style>
        <details className="supply-rollup">
          <summary style={{ background: WHITE, border: `1px solid ${BONE}`, borderRadius: 10, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span className="supply-chev" style={{ color: SMOKE, fontSize: 11, flexShrink: 0 }}>▸</span>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO, flexShrink: 0 }}>
                YouTube Content Supply
              </span>
              {linkedVideoCount > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, fontFamily: MONO, color: ACCENT, background: 'rgba(45,106,79,0.08)', border: `1px solid ${ACCENT}30`, padding: '2px 8px', borderRadius: 3, whiteSpace: 'nowrap' }}>
                  {linkedVideoCount} video{linkedVideoCount > 1 ? 's' : ''} linked
                </span>
              )}
              <span style={{ fontSize: 11, color: SMOKE }}>Connect asset folder to track</span>
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <ConnectDriveFolder slug={slug} folderUrl={folderUrl} />
            </div>
          </summary>
          <div style={{ background: WHITE, borderLeft: `1px solid ${BONE}`, borderRight: `1px solid ${BONE}`, borderBottom: `1px solid ${BONE}`, borderRadius: '0 0 10px 10px', padding: '4px 20px 16px', marginTop: -1 }}>
            <div style={{ fontSize: 11.5, color: SMOKE, lineHeight: 1.45, margin: '10px 0 12px', maxWidth: 770 }}>
              Recommended for this timeline — based on {supply.singles} single{supply.singles === 1 ? '' : 's'} · {supply.hasAlbum ? 'album release' : 'no album release'} · {supply.months}-month campaign. Guidance to support the rollout, not targets to hit.
            </div>
            {supply.rows.map((r) => <Row key={r.cls} r={r} />)}
            <div style={{ fontSize: 9.5, color: GHOST, fontFamily: MONO, marginTop: 9 }}>Recommendation scales with campaign length and release cadence.</div>
          </div>
        </details>
      </section>
    );
  }

  // ── Visual asset showcase ─────────────────────────────────────────────
  // Lead with what's available — thumbnails, classification badges, file
  // names. The category-based supply table collapses beneath: useful for
  // gap analysis but shouldn't dominate when there are strong assets to
  // show YouTube.
  const anchorAssets = library.assets.filter((a) => ASSET_CLASS_META[a.assetClass].anchor);
  const sorted = [...library.assets].sort((a, b) => {
    const ap = ASSET_CLASS_META[a.assetClass].anchor ? 0 : 1;
    const bp = ASSET_CLASS_META[b.assetClass].anchor ? 0 : 1;
    return ap - bp || a.name.localeCompare(b.name);
  });
  const hero = anchorAssets[0] ?? sorted[0];
  const isAnchor = ASSET_CLASS_META[hero.assetClass].anchor;
  const heroLabel = ASSET_CLASS_META[hero.assetClass].label;
  const thumb = hero.thumbnailUrl;
  const heroHref = hero.webViewLink ?? folderUrl;

  // Summary line: "3 Official Video · 2 Other"
  const classCounts = new Map<string, number>();
  for (const a of library.assets) {
    const label = ASSET_CLASS_META[a.assetClass].label;
    classCounts.set(label, (classCounts.get(label) ?? 0) + 1);
  }
  const summaryParts = Array.from(classCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([label, count]) => `${count} ${label}`);

  const useGrid = library.assets.length > 3;

  return (
    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 40px 0' }}>
      <div style={{ background: WHITE, border: `1.5px solid ${isAnchor ? ACCENT : AMBER}40`, borderRadius: 12, overflow: 'hidden' }}>
        {/* Header bar — asset count + type summary + library link */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '14px 20px', borderBottom: useGrid ? `1px solid ${BONE}` : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', fontFamily: MONO, color: WHITE, background: isAnchor ? ACCENT : AMBER, padding: '3px 10px', borderRadius: 3 }}>
              {library.assets.length} Asset{library.assets.length !== 1 ? 's' : ''} Ready
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, fontFamily: MONO, color: SMOKE }}>
              {summaryParts.join(' · ')}
            </span>
            {scanAge && (
              <span style={{ fontSize: 9, fontWeight: 600, fontFamily: MONO, color: SMOKE, opacity: 0.7 }}>
                Scanned {scanAge}
              </span>
            )}
            {totalNew > 0 && (
              <span style={{ fontSize: 8.5, fontWeight: 800, fontFamily: MONO, letterSpacing: '0.06em', color: ACCENT, background: 'rgba(45,106,79,0.08)', border: `1px solid ${ACCENT}30`, padding: '2px 8px', borderRadius: 3 }}>
                +{totalNew} new
              </span>
            )}
          </div>
          <ConnectDriveFolder slug={slug} folderUrl={folderUrl} />
        </div>

        {useGrid ? (
          /* ── Grid showcase for 4+ files ── */
          <div style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {sorted.map((a) => {
              const aHref = a.webViewLink ?? folderUrl;
              const aAnchor = ASSET_CLASS_META[a.assetClass].anchor;
              const aLabel = ASSET_CLASS_META[a.assetClass].label;
              return (
                <a key={a.id} href={aHref ?? '#'} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', flexDirection: 'column', borderRadius: 6, overflow: 'hidden', border: `1px solid ${BONE}`, textDecoration: 'none', color: 'inherit', background: PAPER }}>
                  {a.thumbnailUrl ? (
                    <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#111', overflow: 'hidden' }}>
                      <img src={a.thumbnailUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.1)' }}>
                        <svg width="24" height="24" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="22" fill="rgba(255,255,255,0.85)" /><polygon points="20,15 20,33 34,24" fill={aAnchor ? ACCENT : AMBER} /></svg>
                      </div>
                    </div>
                  ) : (
                    <div style={{ height: 56, background: aAnchor ? 'rgba(45,106,79,0.04)' : 'rgba(180,83,9,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="28" height="28" viewBox="0 0 48 48" fill="none"><rect x="6" y="12" width="36" height="22" rx="3" stroke={aAnchor ? ACCENT : AMBER} strokeWidth="1.5" fill="none" /><polygon points="20,17 20,29 30,23" fill={aAnchor ? ACCENT : AMBER} opacity="0.5" /></svg>
                    </div>
                  )}
                  <div style={{ padding: '6px 8px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: MONO, color: aAnchor ? ACCENT : SMOKE }}>
                      {aLabel}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: INK, fontFamily: MONO, lineHeight: 1.3, wordBreak: 'break-word' }}>
                      {a.name.length > 35 ? a.name.slice(0, 32) + '…' : a.name}
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        ) : (
          /* ── Single-hero layout for 1–3 files ── */
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
            {thumb ? (
              <a href={heroHref} target="_blank" rel="noopener noreferrer" style={{ display: 'block', width: 220, minHeight: 124, flexShrink: 0, position: 'relative', overflow: 'hidden', background: '#111' }}>
                <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.15)' }}>
                  <svg width="36" height="36" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="23" fill="rgba(255,255,255,0.9)" /><polygon points="19,15 19,33 35,24" fill={isAnchor ? ACCENT : AMBER} /></svg>
                </div>
              </a>
            ) : (
              <a href={heroHref ?? '#'} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 140, minHeight: 124, flexShrink: 0, background: isAnchor ? 'rgba(45,106,79,0.06)' : 'rgba(180,83,9,0.06)', textDecoration: 'none' }}>
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="4" y="9" width="40" height="26" rx="4" stroke={isAnchor ? ACCENT : AMBER} strokeWidth="2" fill="none" /><polygon points="19,15 19,31 33,23" fill={isAnchor ? ACCENT : AMBER} opacity="0.7" /><rect x="12" y="38" width="24" height="3" rx="1.5" fill={isAnchor ? ACCENT : AMBER} opacity="0.3" /></svg>
              </a>
            )}
            <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {library.assets.map((a) => (
                  <span key={a.id} style={{ fontSize: 12, fontWeight: 600, color: INK, fontFamily: MONO, lineHeight: 1.35 }}>
                    {a.name.length > 55 ? a.name.slice(0, 52) + '…' : a.name}
                  </span>
                ))}
              </div>
              {heroHref && (
                <a href={heroHref} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: MONO, color: WHITE, background: isAnchor ? ACCENT : AMBER, padding: '6px 14px', borderRadius: 4, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start' }}>
                  View Asset <span style={{ opacity: 0.6, fontSize: 9 }}>↗</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Collapsed supply table — gap analysis available on demand */}
        <details style={{ borderTop: `1px solid ${BONE}` }}>
          <summary style={{ padding: '10px 20px', cursor: 'pointer', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: MONO, color: GHOST, listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 8 }}>▸</span> Full Content Supply
          </summary>
          <div style={{ padding: '0 20px 16px' }}>
            <div style={{ fontSize: 11.5, color: SMOKE, lineHeight: 1.45, margin: '6px 0 12px', maxWidth: 770 }}>
              Recommended for this timeline — based on {supply.singles} single{supply.singles === 1 ? '' : 's'} · {supply.hasAlbum ? 'album release' : 'no album release'} · {supply.months}-month campaign.
            </div>
            {supply.rows.map((r) => <Row key={r.cls} r={r} />)}
          </div>
        </details>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 4. MASTER TIMELINE (type-aware cards)
// ══════════════════════════════════════════════════════════════════════════

function MasterTimeline({ events, mappings, phases, activeIdx, recentUploads, campaignStart, knownTitles, pool, folderUrl, slug, hasAssets }: {
  events: ParsedEvent[]; mappings: MilestoneMapping[]; phases: PhaseName[]; activeIdx: number;
  recentUploads: RecentUpload[]; campaignStart?: string; knownTitles: string[]; pool: Pool; folderUrl?: string; slug: string; hasAssets: boolean;
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
    //
    // FORWARD CAP: a live upload must NOT jump to a moment that's far in the
    // future. If there are 5 BTS episodes planned across the campaign and 2 are
    // already live, only the moments whose planned date is at-or-near today
    // should light up — not Episode 4 in August. We allow a 7-day forward
    // lookahead so "this week" drops still match, but nothing beyond that.
    const WINDOW_MS = 21 * 86400000;
    const NOW_MS = Date.now();
    const FORWARD_CAP_MS = 7 * 86400000;
    const nearest = (k: UploadKind, pub: number, pred: (i: number) => boolean) => {
      const cands = wantList.filter((w) =>
        w.want === k && pred(w.i) &&
        Math.abs(w.ms - pub) <= WINDOW_MS &&
        w.ms <= NOW_MS + FORWARD_CAP_MS          // ← don't jump to future moments
      );
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

  // ── Condensing ──────────────────────────────────────────────────────────
  // Hero moments (release / announce) stay separate — clustered only within a
  // 3-day window (one release week). A run of 3+ consecutive support / live
  // moments collapses into ONE phase card; the original events stay visible as
  // sub-items. This cuts repeated "Shorts / Community" cards without losing any
  // campaign moment. Release support sequences are NOT collapsed.
  const types = events.map(momentType);
  const within3 = (a: number, b: number) => Math.abs((new Date(events[a].dateISO + 'T12:00:00').getTime() - new Date(events[b].dateISO + 'T12:00:00').getTime()) / 86400000) <= 3;
  type Group = { idxs: number[]; mode: 'hero' | 'phase' | 'single' };
  const groups: Group[] = [];
  for (let i = 0; i < events.length;) {
    const ti = types[i];
    if (ti === 'release' || ti === 'announce') {
      const run = [i]; let j = i + 1;
      while (j < events.length && types[j] === ti && within3(j, run[0])) { run.push(j); j++; }
      groups.push({ idxs: run, mode: 'hero' });
      i = j;
    } else if (ti === 'support' || ti === 'live') {
      const run = [i]; let j = i + 1;
      while (j < events.length && types[j] === ti) { run.push(j); j++; }
      if (run.length >= 3) groups.push({ idxs: run, mode: 'phase' });
      else if (run.length === 2 && within3(run[1], run[0])) groups.push({ idxs: run, mode: 'hero' });
      else run.forEach((k) => groups.push({ idxs: [k], mode: 'single' }));
      i = j;
    } else {
      groups.push({ idxs: [i], mode: 'single' });
      i++;
    }
  }

  // ── Past-events rollup ──────────────────────────────────────────────────
  // Collapse completed milestones into a dropdown so the page leads with the
  // current / next milestone. A group is "past" when ALL its event indices are
  // before activeIdx (i.e. their dateISO < today).
  const fmtShort = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const pastSplit = groups.findIndex((g) => g.idxs.some((i) => i >= activeIdx));
  const pastCount = pastSplit < 0 ? groups.length : pastSplit; // all past if activeIdx beyond end
  const collapsePast = pastCount >= 2; // worth collapsing if 2+ past groups

  // ── Future tail rollup ────────────────────────────────────────────────────
  // After the past rollup, also collapse a long future tail (90+ days from the
  // first VISIBLE group) so the page stays focused.
  const groupTs = (g: Group) => new Date(events[g.idxs[0]].dateISO + 'T12:00:00').getTime();
  const presentStart = collapsePast ? pastCount : 0;
  const cutoff = groups.length > presentStart ? groupTs(groups[presentStart]) + 90 * 86400000 : 0;
  let futureSplit = groups.findIndex((g, gi) => gi > presentStart && groupTs(g) > cutoff);
  if (futureSplit < 0) futureSplit = groups.length;
  const collapseFuture = futureSplit >= presentStart + 1 && groups.length - futureSplit >= 3;

  const renderCard = (g: Group, ci: number) => {
    const { idxs, mode } = g;
    const i0 = idxs[0];
    const ev = events[i0];
    const isMulti = idxs.length > 1;
    const showPhaseLabel = ci === 0 || phases[i0] !== phases[groups[ci - 1].idxs[0]];
    const active = idxs.includes(activeIdx);
    const compact = types[i0] === 'support' || types[i0] === 'live';
    let mapping = mappings[i0];
    let liveInfo = liveByMoment.get(i0);
    let titleOverride: string | undefined;
    let includes: string[] | undefined;
    if (isMulti) {
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
      titleOverride = mode === 'phase'
        ? phaseTitle(types[i0], idxs.map((i) => events[i].title))
        : clusterTitle(types[i0], idxs.map((i) => events[i].title));
      includes = idxs.map((i) => events[i].title);
    }
    // Gap to the NEXT timeline group — drives the support Shorts cadence so a
    // long quiet stretch reads "~1 a week through <next>" instead of "this week".
    const nextG = groups[ci + 1];
    const gapDays = nextG ? Math.round((groupTs(nextG) - groupTs(g)) / 86400000) : undefined;
    const nextLabel = nextG ? fmtShort(events[nextG.idxs[0]].dateISO) : undefined;
    return (
      <MilestoneCard
        key={`${ev.dateISO}-${i0}`} ev={ev} mapping={mapping} phase={phases[i0]} active={active}
        showPhaseLabel={showPhaseLabel} compact={compact}
        recentUploads={recentUploads} campaignStart={campaignStart} knownTitles={knownTitles} pool={pool} folderUrl={folderUrl}
        live={liveInfo} titleOverride={titleOverride} includes={includes}
        gapDays={gapDays} nextLabel={nextLabel} slug={slug} hasAssets={hasAssets}
      />
    );
  };

  return (
    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 40px 0' }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.28em', textTransform: 'uppercase', color: INK, fontFamily: MONO, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}><YTMark h={12} /> YouTube Campaign Timeline</div>
      {(() => {
        const sr = shortsRecommendation(events);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 24 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: SHORTS_PURPLE, background: '#F0E8FE', border: `1px solid ${SHORTS_PURPLE}33`, padding: '3px 10px', borderRadius: 20 }}>
              <svg width="9" height="11" viewBox="0 0 10 12" aria-hidden><polygon points="0,0 10,6 0,12" fill={SHORTS_PURPLE} /></svg>
              ~{sr.lo}–{sr.hi} Shorts
            </span>
            <span style={{ fontSize: 11, color: SMOKE }}>across the campaign — cluster <strong style={{ color: INK }}>3 around every release</strong>, keep <strong style={{ color: INK }}>1–2 a week</strong> between. Each moment below shows when to drop.</span>
          </div>
        );
      })()}
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: 54, top: 6, bottom: 6, width: 2, background: BONE }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <style>{`.tl-rollup>summary{list-style:none}.tl-rollup>summary::-webkit-details-marker{display:none}.tl-rollup .tl-chev{display:inline-block;transition:transform .15s ease}.tl-rollup[open] .tl-chev{transform:rotate(90deg)}.tl-rollup[open] .tl-show{display:none}.tl-rollup:not([open]) .tl-hide{display:none}.tl-rollup>summary:hover{background:#F4F1EB}`}</style>
          {/* ── Past moments rollup ── */}
          {collapsePast && (() => {
            const past = groups.slice(0, pastCount);
            const moments = past.reduce((n, g) => n + g.idxs.length, 0);
            const first = events[past[0].idxs[0]].dateISO;
            const last = events[past[past.length - 1].idxs[0]].dateISO;
            return (
              <details className="tl-rollup">
                <summary style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 28, padding: '13px 16px', background: '#FAF8F4', border: `1px solid ${BONE}`, borderRadius: 8, cursor: 'pointer', fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK }}>
                  <span className="tl-chev" style={{ color: SMOKE, fontSize: 12 }}>▸</span>
                  <span className="tl-show">Past moments · {moments} completed · {fmtShort(first)} – {fmtShort(last)}</span>
                  <span className="tl-hide">Hide past moments</span>
                </summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
                  {past.map((g, ci) => renderCard(g, ci))}
                </div>
              </details>
            );
          })()}
          {/* ── Current + future moments (visible) ── */}
          {groups.slice(collapsePast ? pastCount : 0, collapseFuture ? futureSplit : groups.length).map((g, off) => {
            const ci = (collapsePast ? pastCount : 0) + off;
            return renderCard(g, ci);
          })}
          {/* ── Future tail rollup ── */}
          {collapseFuture && (() => {
            const hidden = groups.slice(futureSplit);
            const moments = hidden.reduce((n, g) => n + g.idxs.length, 0);
            const first = events[hidden[0].idxs[0]].dateISO;
            const last = events[hidden[hidden.length - 1].idxs[0]].dateISO;
            return (
              <details className="tl-rollup">
                <summary style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 28, padding: '13px 16px', background: '#FAF8F4', border: `1px solid ${BONE}`, borderRadius: 8, cursor: 'pointer', fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK }}>
                  <span className="tl-chev" style={{ color: SMOKE, fontSize: 12 }}>▸</span>
                  <span className="tl-show">Later in the campaign · {moments} more moments · {fmtShort(first)} – {fmtShort(last)}</span>
                  <span className="tl-hide">Hide later moments</span>
                </summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
                  {hidden.map((g, off) => renderCard(g, futureSplit + off))}
                </div>
              </details>
            );
          })()}
          {events.length === 0 && <div style={{ fontSize: 13, color: SMOKE, padding: '20px 0 0 80px' }}>No campaign moments parsed yet. Add a timeline below to populate the master view.</div>}
        </div>
      </div>
    </section>
  );
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

// A name for a longer RUN of same-type support/live moments (a campaign phase).
function phaseTitle(type: MomentType, titles: string[]): string {
  const t = titles.join(' ').toLowerCase();
  if (type === 'live') {
    if (/tour|festival|\bgig\b|\bshow\b|road/.test(t)) return 'Tour Content Phase';
    return 'Live Content Phase';
  }
  // support
  if (/photo|visual|world|aesthetic|\bart\b|imagery/.test(t)) return 'World Building Phase';
  if (/record|studio|\bbts\b|behind|making|session/.test(t)) return 'Recording Phase';
  if (/story|songwriting|diary|personality|fan|creation/.test(t)) return 'Storytelling Phase';
  if (/acoustic|live/.test(t)) return 'Acoustic Phase';
  return 'Content Phase';
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
      <a href={href} target="_blank" rel="noopener noreferrer" title="Open in Asset Library"
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
    actions.push(hasShortPool ? 'Drop 3 Shorts around release — tease, drop-day, follow-up' : 'Plan 3 release Shorts — tease, drop-day, follow-up');
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
    if (pool.bts > 0 || pool.shorts > 0 || present.includes('bts')) actions.push('Cut 1–2 Shorts from this session to keep the week active');
    else actions.push('Capture content + 1–2 Shorts for this week');
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

// ── Suggested Support ──────────────────────────────────────────────────────
// A YouTube strategist's nudge: what content could support this moment. Always
// framed as opportunity, filtered by what's already available, with sequencing.
type Suggestion = { label: string; timing?: string };
function suggestedSupport(type: MomentType, present: DriveAssetClass[], pool: Pool, named: string | null, title: string): Suggestion[] {
  const has = (c: DriveAssetClass) => present.includes(c);
  const t = title.toLowerCase();

  if (type === 'announce') {
    return [
      { label: 'Announcement trailer' },
      { label: 'Community Post' },
      { label: 'Tour announcement content' },
      { label: 'Short-form cutdowns' },
      { label: 'Pre-order messaging' },
    ];
  }
  if (type === 'release') {
    // Official-video moment
    if (named === 'Official Video') {
      return [
        { label: 'Premiere', timing: 'Release day' },
        { label: 'Premiere reminder Short', timing: '24h before' },
        { label: 'Community Post' },
        { label: 'BTS follow-up', timing: '+3–7 days' },
        { label: 'Reaction / behind-the-scenes', timing: '+7 days' },
      ];
    }
    // Visualiser moment
    if (named === 'Visualiser') {
      return [
        ...(!has('lyric_video') ? [{ label: 'Lyric Video', timing: '+7–10 days' }] : []),
        { label: 'Shorts cutdowns' },
        { label: 'Community Post' },
      ];
    }
    // Album release
    if (/\balbum\b/.test(t)) {
      return [
        { label: 'Focus track video', timing: 'Release week' },
        { label: 'Album trailer' },
        { label: 'Community Posts' },
        { label: 'Shorts across release week' },
        { label: 'Live performance content' },
        { label: 'Fan-focused content' },
      ];
    }
    // Single release — filter by what's already in hand
    const out: Suggestion[] = [];
    if (!has('official_video') && !has('visualiser') && !has('lyric_video')) out.push({ label: 'Official Video or Visualiser', timing: 'Release week' });
    out.push({ label: 'Community Post', timing: 'Release week' });
    if (!has('shorts_cutdown') && pool.shorts < 2) out.push({ label: '2 Shorts cutdowns', timing: 'Release week' });
    if (!has('lyric_video')) out.push({ label: 'Lyric Video', timing: '+7–10 days' });
    out.push({ label: 'BTS clip', timing: '+14–21 days' });
    out.push({ label: 'Acoustic / live session', timing: '+14–21 days' });
    out.push({ label: 'Story behind the song', timing: '+14–21 days' });
    return out;
  }
  if (type === 'live') {
    return [
      { label: 'Vertical performance Shorts' },
      { label: 'Live performance upload' },
      { label: 'Community Post' },
    ];
  }
  if (type === 'support') {
    return [
      { label: '1–2 Shorts from this session' },
      { label: 'Community Post' },
    ];
  }
  return []; // archive
}

// ── Shorts cadence ─────────────────────────────────────────────────────────
// How many Shorts to drop around a given moment, and when — so teams scanning
// the timeline see the short-form rhythm and where best to post.
const SHORTS_PURPLE = '#6B21A8';
function shortsForMoment(type: MomentType, title: string): { count: string; when: string } | null {
  const t = title.toLowerCase();
  if (type === 'release') {
    if (/\balbum\b/.test(t)) return { count: '4–5', when: 'across release week' };
    return { count: '3', when: 'tease · drop-day · follow-up' };
  }
  if (type === 'announce') return { count: '2', when: 'announcement cutdowns' };
  if (type === 'live') return { count: '1–2', when: 'vertical performance' };
  if (type === 'support') return { count: '1–2', when: 'this week' };
  return null; // archive
}

// Campaign-wide Shorts recommendation (range), used for the timeline cadence
// line. Mirrors the Content Supply calc: length bucket scaled by singles.
function shortsRecommendation(events: ParsedEvent[]): { lo: number; hi: number } {
  const isSingle = (e: ParsedEvent) => {
    if (momentType(e) !== 'release') return false;
    if (namedHeroAsset(e.title)) return false;
    const t = e.title.toLowerCase();
    if (/\balbum\b|\bep\b|bundle|acoustic|deluxe|pre-?order|focus\s*track|documentary/.test(t)) return false;
    return /\bsingle\b/.test(t) || e.kind === 'singleRelease';
  };
  const singles = events.filter(isSingle).length;
  const ms = events.map((e) => new Date(e.dateISO + 'T12:00:00').getTime()).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const months = Math.max(1, Math.round((ms.length > 1 ? (ms[ms.length - 1] - ms[0]) / 86400000 : 30) / 30.4));
  const bucket = months <= 3 ? [10, 20] : months <= 6 ? [20, 40] : [40, 80];
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return {
    lo: singles > 0 ? clamp(singles * 10, bucket[0], bucket[1]) : bucket[0],
    hi: singles > 0 ? clamp(singles * 15, bucket[0], bucket[1]) : bucket[1],
  };
}

// ── Link Video — inline paste field on milestone cards ────────────────────
// Lets the team paste a YouTube URL directly onto a timeline moment, linking
// the unlisted/scheduled video as a banked Official Video asset.
function LinkVideoButton({ slug, eventTitle }: { slug: string; eventTitle: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const extractVideoId = (url: string): string | null => {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    return m?.[1] ?? null;
  };

  const save = async () => {
    if (saving) return;
    const raw = (inputRef.current?.value ?? '').trim();
    if (!raw) { setError('Paste a YouTube URL'); return; }
    const videoId = extractVideoId(raw);
    if (!videoId) { setError('Could not find a YouTube video ID'); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/coach/link-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planSlug: slug, videoId, videoTitle: eventTitle, matchEventTitle: eventTitle }),
      });
      if (!res.ok) throw new Error('link failed');
      setOpen(false);
      router.refresh();
    } catch { setError('Could not link — please try again'); }
    finally { setSaving(false); }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Link an unlisted YouTube video to this moment"
        style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: MONO, color: AMBER, background: `${AMBER}12`, border: `1px solid ${AMBER}33`, borderRadius: 4, padding: '3px 9px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M6.5 3.5L11 8l-4.5 4.5M2 8h9" stroke={AMBER} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Link Video
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <input
          ref={inputRef} autoFocus
          onChange={() => { if (error) setError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setOpen(false); }}
          placeholder="Paste YouTube URL"
          style={{ flex: 1, minWidth: 180, fontSize: 11, fontFamily: MONO, color: INK, background: WHITE, border: `1px solid ${BONE}`, borderRadius: 4, padding: '5px 8px', outline: 'none' }}
        />
        <button
          onClick={save} disabled={saving}
          style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: MONO, color: WHITE, background: AMBER, border: 'none', borderRadius: 4, padding: '5px 10px', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.5 : 1 }}
        >{saving ? 'Linking…' : 'Link'}</button>
        <button
          onClick={() => { setOpen(false); setError(null); }}
          style={{ fontSize: 9, fontWeight: 700, fontFamily: MONO, color: SMOKE, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px' }}
        >Cancel</button>
      </div>
      {error && <div style={{ fontSize: 9, color: RED, fontFamily: MONO }}>{error}</div>}
    </div>
  );
}

function MilestoneCard({ ev, mapping, phase, active, showPhaseLabel, recentUploads, campaignStart, knownTitles, pool, folderUrl, live, titleOverride, includes, compact, gapDays, nextLabel, slug, hasAssets }: {
  ev: ParsedEvent; mapping?: MilestoneMapping; phase: PhaseName; active: boolean; showPhaseLabel: boolean;
  recentUploads: RecentUpload[]; campaignStart?: string; knownTitles: string[]; pool: Pool; folderUrl?: string;
  live?: { primary?: RecentUpload; shorts: RecentUpload[] };
  titleOverride?: string; includes?: string[]; compact?: boolean; gapDays?: number; nextLabel?: string; slug: string; hasAssets: boolean;
}) {
  // Direct Drive link for a matched asset class: the matching file, else the folder.
  const linkFor = (c: DriveAssetClass) =>
    (mapping?.assets ?? []).find((a) => a.assetClass === c && a.webViewLink)?.webViewLink ?? folderUrl;
  const dfn = daysFromNow(ev.dateISO);
  const pt = PHASE_TONE[phase];
  const type = momentType(ev);
  const mt = MOMENT_TONE[type];
  // Visual hierarchy: hero moments (singles / album / announcement) carry the
  // most weight; support (BTS / live / tour) sits a notch down; archive lowest.
  // So tour/live activity never visually outweighs music release moments.
  const heroMoment = type === 'release' || type === 'announce';
  const titleSize = heroMoment ? 17 : type === 'archive' ? 13 : 14.5;
  const borderW = heroMoment ? 4 : type === 'archive' ? 2 : 3;
  const titleColor = type === 'archive' ? SMOKE : INK;
  const displayTitle = cleanTitle(titleOverride ?? ev.title);
  const named = namedHeroAsset(includes && includes.length ? includes.join(' ') : ev.title); // specific deliverable named in the timeline
  const { present, actions, hasContent } = cardLogic(type, mapping, pool, named);

  // YouTube context — current (non-archive) uploads that identity-match THIS
  // milestone (known titles fold in only when the milestone references them).
  const evTokens = momentTokens(ev.title, knownTitles);
  const liveMatch = evTokens.length === 0 ? undefined : recentUploads
    .filter((u) => shareTok(tok(u.title), evTokens) && uploadAge(u.publishedAt, campaignStart) !== 'archive')
    .sort((a, b) => b.viewCount - a.viewCount)[0];

  // ── Live-on-YouTube + hero coverage ─────────────────────────────────────
  // Release: an identity-matched upload that looks like the actual release (not
  // BTS, a Short, live performance, or a teaser/pre-save).  Previously required
  // isHeroUploadTitle, but many releases don't tag "Official Video" in the title
  // — so we now accept any upload that isn't obviously support content.
  // Support/live: a type-matched recent upload assigned to this moment (so the
  // timeline reflects when a BTS / live moment actually goes live).
  const liveKind = liveMatch ? uploadKind(liveMatch) : undefined;
  const heroLive = type === 'release' && liveMatch
    && (liveKind === 'hero' || (liveKind === 'other' && !isTeaser(liveMatch)))
    ? liveMatch : undefined;
  const isSupportType = type === 'support' || type === 'live';
  const primaryLive = isSupportType ? live?.primary : undefined;       // the main longform asset, if live
  const shortLives = isSupportType ? (live?.shorts ?? []) : [];        // supporting Shorts, if live
  const heroInDrive = !!mapping?.anchorPresent;
  const mainFormat = type === 'live' ? 'full performance' : 'longform';
  // A non-release moment whose title identity-matches a genuinely live upload
  // the kind-based matcher didn't surface (a freestyle, a featured drop). Keeps
  // the status honest — no PLANNED chip sitting above an "already live" video.
  // GUARD: never let a future-planned moment show as "live" just because a
  // recent upload shares a title token. Without this, Episode 4 planned for
  // August lights up because "BTS" appears in both titles.
  const eventMs = new Date(ev.dateISO + 'T12:00:00').getTime();
  const softLive = (!heroLive && !primaryLive && shortLives.length === 0
    && type !== 'release' && type !== 'archive'
    && liveMatch && !isTeaser(liveMatch)
    && eventMs <= Date.now() + 7 * 86400000) ? liveMatch : undefined;

  // ── Linked video (unlisted/scheduled asset attached directly to event) ──
  // When a ParsedEvent carries a videoId, the video is a known asset (typically
  // unlisted on YouTube, ready to publish). Treat it as "READY" — the team can
  // preview it but it hasn't gone live yet.
  const linkedVideoId = ev.videoId;
  const linkedVideoUrl = linkedVideoId
    ? `https://youtube.com/watch?v=${linkedVideoId}`
    : undefined;

  // ── Standardised primary status ─────────────────────────────────────────
  // Every card resolves to ONE of five labels: LIVE / READY / IN PRODUCTION /
  // PLANNED / REFERENCE. The specific detail (which hero asset, what's live,
  // what's still to source) moves to the supporting note line under the title —
  // never into the status chip itself.
  let displayStatus: { label: string; color: string };
  let statusNote: string;
  let statusHref: string | undefined;
  let statusTitle = 'Open in Asset Library';
  const driveHref = hasContent ? (present[0] ? linkFor(present[0]) : folderUrl) : undefined;

  if (type === 'archive') {
    displayStatus = STD.reference; statusNote = 'Catalogue reference informing the rollout';
    statusHref = driveHref;
  } else if (linkedVideoId && !heroLive) {
    // Unlisted/scheduled video linked directly — treat as READY
    displayStatus = STD.ready; statusNote = 'Video linked — unlisted and ready to publish';
    statusHref = linkedVideoUrl; statusTitle = 'Preview the linked video on YouTube';
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
    else if (named && hasAssets) { displayStatus = STD.production; statusNote = `${named} in production — not in the library yet`; }
    else if (named) { displayStatus = STD.planned; statusNote = `${named} to prepare for release week`; }
    else if (hasAssets) { displayStatus = STD.planned; statusNote = 'Hero asset still to be locked for release week'; }
    else { displayStatus = STD.planned; statusNote = 'Release week planned'; }
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
  // Shorts get their own prominent cue (below) — strip them from the verbose
  // suggestion list so the rhythm isn't duplicated.
  const suggestions = (isLive ? [] : suggestedSupport(type, present, pool, named, ev.title)).filter((s) => !/short/i.test(s.label));
  // How many Shorts to drop around this moment, and when.
  let shortsCue = !isLive && type !== 'archive' ? shortsForMoment(type, ev.title) : null;
  // Gap-aware support cadence: when a support/world-building moment sits a long
  // way before the next content moment, "this week" undersells it. Keep ~1 a
  // week running through the gap so the channel never goes quiet.
  if (shortsCue && type === 'support' && gapDays && gapDays >= 11) {
    const weeks = Math.max(2, Math.round(gapDays / 7));
    shortsCue = { count: `${weeks}`, when: nextLabel ? `~1 a week through ${nextLabel}` : '~1 a week through the gap' };
  }

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

      <div style={{ background: WHITE, border: active ? `2px solid ${mt.color}` : `1px solid ${BONE}`, boxShadow: active ? `0 0 0 4px ${mt.color}12` : 'none', borderRadius: 10, padding: heroMoment ? '14px 18px 16px' : '12px 18px 13px', borderLeft: `${borderW}px solid ${mt.color}`, opacity: type === 'archive' ? 0.9 : 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: mt.color, fontFamily: MONO }}>{mt.label}{includes && includes.length ? ` · ${includes.length} moments` : ''}</span>
            <div style={{ fontSize: titleSize, fontWeight: 900, letterSpacing: '-0.01em', textTransform: 'uppercase', color: titleColor, lineHeight: 1.15, marginTop: 3 }}>{displayTitle}</div>
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

        {/* Shorts cue — where best to drop short-form for this moment */}
        {shortsCue && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: SHORTS_PURPLE, background: '#F0E8FE', border: `1px solid ${SHORTS_PURPLE}33`, padding: '3px 10px', borderRadius: 20 }}>
              <svg width="9" height="11" viewBox="0 0 10 12" aria-hidden><polygon points="0,0 10,6 0,12" fill={SHORTS_PURPLE} /></svg>
              {shortsCue.count} Shorts
            </span>
            <span style={{ fontSize: 11.5, color: SMOKE }}>{shortsCue.when}</span>
          </div>
        )}

        {/* Assets currently available for this moment — prominent green banner.
            Hidden when the content is already live on YouTube — no point linking
            to the library for something the audience can already watch. */}
        {!isLive && (present.length > 0 || (heroInDrive && mapping)) && (() => {
          const thumbAsset = mapping?.assets.find((a) => a.thumbnailUrl);
          const thumbUrl = thumbAsset?.thumbnailUrl;
          const assetHref = thumbAsset?.webViewLink ?? folderUrl;
          return (
            <div style={{ marginTop: 11, background: 'rgba(45,106,79,0.06)', border: `1px solid ${ACCENT}30`, borderRadius: 6, padding: 0, overflow: 'hidden', display: 'flex', alignItems: 'stretch' }}>
              {/* Thumbnail preview if available */}
              {thumbUrl && (
                <a href={assetHref} target="_blank" rel="noopener noreferrer" style={{ display: 'block', width: 88, minHeight: 56, flexShrink: 0, position: 'relative', overflow: 'hidden', background: '#111' }}>
                  <img src={thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.12)' }}>
                    <svg width="22" height="22" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="22" fill="rgba(255,255,255,0.85)" /><polygon points="20,15 20,33 34,24" fill={ACCENT} /></svg>
                  </div>
                </a>
              )}
              <div style={{ flex: 1, padding: '8px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, fontWeight: 900, color: ACCENT, fontFamily: MONO, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {heroInDrive ? '✓ Hero Asset Ready' : '✓ Assets Available'}
                    </span>
                    {present.map((c) => <AssetChip key={c} cls={c} href={linkFor(c)} />)}
                  </div>
                  {folderUrl && (
                    <a href={folderUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: MONO, color: WHITE, background: ACCENT, padding: '4px 10px', borderRadius: 3, textDecoration: 'none', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      View in Library <span style={{ opacity: 0.6, fontSize: 8 }}>↗</span>
                    </a>
                  )}
                </div>
                {mapping && mapping.assets.length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: '3px 12px' }}>
                    {mapping.assets.slice(0, 4).map((a) => (
                      <span key={a.id} style={{ fontSize: 10, color: SMOKE, fontFamily: MONO }}>
                        {a.name.length > 40 ? a.name.slice(0, 37) + '…' : a.name}
                      </span>
                    ))}
                    {mapping.assets.length > 4 && <span style={{ fontSize: 10, color: GHOST, fontFamily: MONO }}>+{mapping.assets.length - 4} more</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
        {/* Fallback: show raw file count when assets exist but aren't classified into known types.
            Also hidden when live — same reasoning as the green banner above. */}
        {!isLive && present.length === 0 && !heroInDrive && mapping && mapping.assets.length > 0 && (
          <div style={{ marginTop: 11, background: 'rgba(180,83,9,0.06)', border: `1px solid ${AMBER}30`, borderRadius: 6, padding: '8px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: AMBER, fontFamily: MONO, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {mapping.assets.length} file{mapping.assets.length === 1 ? '' : 's'} in library
                </span>
              </div>
              {folderUrl && (
                <a href={folderUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: MONO, color: WHITE, background: AMBER, padding: '4px 10px', borderRadius: 3, textDecoration: 'none', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  View in Library <span style={{ opacity: 0.6, fontSize: 8 }}>↗</span>
                </a>
              )}
            </div>
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: '3px 12px' }}>
              {mapping.assets.slice(0, 4).map((a) => (
                <span key={a.id} style={{ fontSize: 10, color: SMOKE, fontFamily: MONO }}>
                  {a.name.length > 40 ? a.name.slice(0, 37) + '…' : a.name}
                </span>
              ))}
              {mapping.assets.length > 4 && <span style={{ fontSize: 10, color: GHOST, fontFamily: MONO }}>+{mapping.assets.length - 4} more</span>}
            </div>
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

        {/* Linked unlisted video — shows when no public match exists */}
        {linkedVideoId && !mainLive && (
          <div style={{ marginTop: 11 }}>
            <a href={linkedVideoUrl!} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
              <img src={`https://i.ytimg.com/vi/${linkedVideoId}/mqdefault.jpg`} alt="" style={{ width: 64, height: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#B45309', fontWeight: 600, lineHeight: 1.3 }}>
                Unlisted — ready to publish. Click to preview.
              </span>
            </a>
          </div>
        )}

        {/* Link Video button — release/announce moments without a linked video */}
        {heroMoment && !linkedVideoId && !isLive && (
          <div style={{ marginTop: 11 }}>
            <LinkVideoButton slug={slug} eventTitle={ev.title} />
          </div>
        )}

        {/* Live → amplification nudge. Compact support/live → cadence line.
            Otherwise (release/announce) → full sequenced Suggested Support. */}
        {isLive ? (
          <div style={{ marginTop: 11, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {shownActions.map((a, i) => (
              <div key={i} style={{ fontSize: 12.5, color: INK, lineHeight: 1.35, display: 'flex', gap: 8 }}>
                <span style={{ color: mt.color, fontWeight: 800 }}>›</span>{a}
              </div>
            ))}
          </div>
        ) : compact ? (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO }}>Also</span>
            <span style={{ fontSize: 12, color: INK, fontWeight: 600 }}>
              {type === 'live' ? 'Live performance upload · Community Post' : 'Community Posts'}
            </span>
          </div>
        ) : suggestions.length > 0 ? (
          <div style={{ marginTop: 13 }}>
            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginBottom: 7 }}>Suggested Support</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {suggestions.map((s, i) => (
                <div key={i} style={{ fontSize: 12.5, color: INK, lineHeight: 1.3, display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ color: mt.color, fontWeight: 800, flexShrink: 0 }}>+</span>
                  <span>{s.label}{s.timing && <span style={{ color: SMOKE, fontSize: 11, marginLeft: 7 }}>· {s.timing}</span>}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
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
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: GHOST, fontFamily: MONO, marginBottom: 12 }}>Recent Activity · Channel Pulse</div>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {(() => {
              const Stat = ({ value, label, color = INK }: { value: string; label: string; color?: string }) => (
                <div style={{ textAlign: 'left', lineHeight: 1.05 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color, fontFamily: MONO, letterSpacing: '-0.02em' }}>{value}</div>
                  <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: SMOKE, fontFamily: MONO, marginTop: 4 }}>{label}</div>
                </div>
              );
              return (
                <>
                  {lastDays != null && <Stat value={lastDays === 0 ? 'Today' : `${lastDays}d`} label="Last upload" />}
                  <Stat value={`${shorts30}/${long30}`} label="Shorts / Long · 30d" />
                  {liveChannel?.subs != null && <Stat value={fmtNum(liveChannel.subs)} label="Subs" />}
                  {v7 != null && <Stat value={`${v7 >= 0 ? '+' : ''}${fmtNum(v7)}`} label="Views · 7d" color={v7 > 0 ? ACCENT : INK} />}
                  {s7 != null && <Stat value={`${s7 >= 0 ? '+' : ''}${fmtNum(s7)}`} label="Subs · 7d" color={s7 > 0 ? ACCENT : INK} />}
                </>
              );
            })()}
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
