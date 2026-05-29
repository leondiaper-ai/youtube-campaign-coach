/**
 * GET /api/partner-briefing
 *
 * Partner-facing Weekly Campaign Briefing for YouTube UK.
 * Curates active Virgin Music campaigns, content ecosystems,
 * platform observations, upcoming moments, and playbook —
 * all framed for external collaboration, not internal diagnostics.
 *
 * Reuses the same data layer as /api/weekly-pulse (KV-cached LiveSnaps,
 * snapshot history, zero YouTube API calls at read time).
 */

import { NextResponse } from 'next/server';
import {
  ARTISTS,
  mergeArtistLists,
  deriveFromLive,
  classifyArtist,
  isVirginOwned,
  daysSince,
  type Artist,
  type ChannelState,
  type ArtistClassification,
} from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { listPinned } from '@/lib/campaignStore';
import { loadPlan, listPlans } from '@/lib/planStore';
import type { ParsedEvent } from '@/lib/planEngine';
import { readAllLiveSnaps, readSyncMeta } from '@/lib/kvCache';
import { readHistory, deltaOver } from '@/lib/snapshots';
import { normalizeChannelData, rawDelta, computeWoW } from '@/lib/youtube/normalizeChannelData';
import { classifyUploadFormat, type UploadFormatLabel } from '@/lib/coach/matchEngine';
import { computeMultiformat, type MultiformatScore } from '@/lib/contentStructure';

export const dynamic = 'force-dynamic';

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K';
  return String(n);
}

function channelUrl(handle: string | null): string | null {
  if (!handle) return null;
  const h = handle.startsWith('@') ? handle : `@${handle}`;
  return `https://www.youtube.com/${h}`;
}

// ── KV helpers (snapshot caching) ────────────────────────────────────────────

async function kv() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    const { Redis } = await import('@upstash/redis');
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

/** ISO week key, e.g. "partner-briefing:2026-W22" */
function briefingWeekKey(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `partner-briefing:${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// ── Response Types ───────────────────────────────────────────────────────────

type BriefingVideo = {
  id: string;
  title: string;
  channelName: string;
  artistSlug: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string;
  durationSec: number;
  format: UploadFormatLabel;
  thumbnail: string;
  velocity: number;
  daysAgo: number;
};

type BriefingChannel = {
  slug: string;
  name: string;
  channelHandle: string | null;
  subs: number | null;
  totalViews: number | null;
  views7d: number | null;
  subs7d: number | null;
  viewsWoW: number | null;
  uploads30d: number;
  shorts30d: number;
  longform30d: number;
  lastUploadAt: string | null;
  lastUploadDaysAgo: number | null;
  thumbnail: string | null;
  phase: string;
  campaign: string | null;
  campaignStartDate: string | null;
  classification: ArtistClassification;
  subsPer1kViews: number | null;
  multiformatScore: MultiformatScore['score'] | null;
};

type FocusCampaign = {
  channel: BriefingChannel;
  heroImage: string;
  campaignPhase: string;
  // ── Editorial card structure ──
  nowLabel: string;
  nowDetail: string;
  nowThumbnail: string | null;
  nextLabel: string;
  nextDate: string | null;
  afterLabel: string;
  afterDate: string | null;
  youtubeFocus: string;
  channelUrl: string | null;
  hasCoachPlan: boolean;
  currentMoment: string;
  currentMomentDate: string | null;
  nextMoment: string;
  nextMomentDate: string | null;
  upcomingMoment: string;
  upcomingMomentDate: string | null;
  recentVideos: BriefingVideo[];
  // ── Editorial priority (hidden score, drives hierarchy) ──
  editorialPriority: number;
  standoutVideo: BriefingVideo | null; // biggest campaign video for scale proof
  tier: 1 | 2 | 3;                   // 1=large, 2=medium, 3=grid
  contentFormats: string[];           // active format types for tag display
};

type UpcomingMoment = {
  artist: string;
  slug: string;
  moment: string;
  date: string | null;     // ISO date if known
  timing: string;          // human readable: "4 Jun (in 7d)" or "This week"
  eventType: string;       // "Single Release", "Album Drop", "Festival", etc.
  supportSurface: string;
  rolloutNote: string;
  fromCoachPlan: boolean;  // true if sourced from a saved coach plan
  priority: number;        // 100=release, 80=supporting video, 60=community, 30=touring/press
};

type PartnerBriefingResponse = {
  weekRange: string;
  generatedAt: string;
  activeCampaignCount: number;
  focusCampaigns: FocusCampaign[];
  platformObservations: string[];
  upcomingMoments: UpcomingMoment[];
  playbook: { title: string; why: string; when: string; actions: string[] };
  topShorts: BriefingVideo[];
  topVideos: BriefingVideo[];
  ecosystemHighlights: { name: string; label: string; read: string; thumbnail: string | null; channelHandle: string | null }[];
  momentsWatching: {
    id: string; title: string; artistName: string; artistSlug: string;
    thumbnail: string; viewCount: number; velocity: number; daysAgo: number;
    format: string; durationSec: number; context: string;
  }[];
};

// Focus campaigns are pulled exclusively from pinned active campaigns
// (managed via /campaigns page). No hardcoded priority list.

// ── GET handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const redis = await kv();
    const weekKey = briefingWeekKey();

    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === '1';

    if (redis && !forceRefresh) {
      const cached = await redis.get<PartnerBriefingResponse>(weekKey);
      if (cached) {
        return NextResponse.json(cached);
      }
    }

    // Load all artists
    const custom = await listCustomArtists();
    const PULSE_EXCLUDE_NAMES = ['league of legends'];
    const allArtists = mergeArtistLists(ARTISTS, custom)
      .filter(a => {
        const name = a.name.toLowerCase();
        return !PULSE_EXCLUDE_NAMES.some(ex => name.includes(ex));
      });
    const syncMeta = await readSyncMeta();

    // Load pinned active campaigns — these are the ONLY source for focus campaigns
    const pinnedCampaigns = await listPinned();
    const pinnedSlugs = new Set(pinnedCampaigns.map(p => p.slug));

    const handles = allArtists
      .map(a => a.channelHandle)
      .filter(Boolean) as string[];
    const snapMap = await readAllLiveSnaps(handles);

    const allChannels: BriefingChannel[] = [];
    const allRecentVideos: BriefingVideo[] = [];
    const now = Date.now();
    const videoCutoff = 21 * 86400000;

    for (const a of allArtists) {
      if (!isVirginOwned(a)) continue; // Partner briefing: Virgin managed only

      const snap = a.channelHandle ? (snapMap.get(a.channelHandle) ?? null) : null;
      const history = snap?.channelId && !snap.error
        ? await readHistory(snap.channelId)
        : [];

      const nc = normalizeChannelData(snap, history);
      const subs7Val = rawDelta(nc.subs7d);
      const views7Val = rawDelta(nc.views7d);

      const subs14Raw = deltaOver(history, 14, 'subs');
      const views14Raw = deltaOver(history, 14, 'views');
      const viewsWoWResult = computeWoW(nc.views7d, views14Raw);

      const derived = snap ? deriveFromLive(snap, {
        subs7Delta: subs7Val,
        views7Delta: views7Val,
      }) : null;

      const status: ChannelState = derived?.status ?? 'COLD';
      const classification = classifyArtist(status, nc.cadence.uploads30d);

      const subsPer1kViews = views7Val && views7Val > 0 && subs7Val != null
        ? Math.round((subs7Val / views7Val) * 1000 * 10) / 10
        : null;

      const channel: BriefingChannel = {
        slug: a.slug,
        name: a.name,
        channelHandle: a.channelHandle ?? null,
        subs: nc.subs,
        totalViews: nc.views,
        views7d: views7Val,
        subs7d: subs7Val,
        viewsWoW: viewsWoWResult?.value ?? null,
        uploads30d: nc.cadence.uploads30d,
        shorts30d: nc.cadence.shorts30d,
        longform30d: Math.max(0, nc.cadence.uploads30d - nc.cadence.shorts30d),
        lastUploadAt: snap?.lastUploadAt ?? null,
        lastUploadDaysAgo: daysSince(snap?.lastUploadAt),
        thumbnail: snap?.thumbnail ?? null,
        phase: a.phase,
        campaign: a.campaign ?? null,
        campaignStartDate: a.campaignStartDate ?? null,
        classification,
        subsPer1kViews,
        multiformatScore: snap?.recentUploads ? computeMultiformat(snap.recentUploads).score : null,
      };

      allChannels.push(channel);

      // Collect recent uploads
      if (snap?.recentUploads) {
        for (const u of snap.recentUploads) {
          const ageMs = now - new Date(u.publishedAt).getTime();
          if (ageMs > videoCutoff || ageMs < 0) continue;
          const daysAgo = Math.max(1, Math.floor(ageMs / 86400000));
          const velocity = Math.round(u.viewCount / daysAgo);
          const fmt = classifyUploadFormat(u);
          if (fmt !== 'Short' && velocity < 20) continue;
          allRecentVideos.push({
            id: u.id,
            title: u.title,
            channelName: a.name,
            artistSlug: a.slug,
            viewCount: u.viewCount,
            likeCount: u.likeCount,
            commentCount: u.commentCount,
            publishedAt: u.publishedAt,
            durationSec: u.durationSec,
            format: fmt,
            thumbnail: `https://i.ytimg.com/vi/${u.id}/mqdefault.jpg`,
            velocity,
            daysAgo,
          });
        }
      }
    }

    allRecentVideos.sort((a, b) => b.velocity - a.velocity);

    // Partner briefing: only feature content from pinned campaigns
    const pinnedVideos = allRecentVideos.filter(v => pinnedSlugs.has(v.artistSlug));
    const topVideos = pinnedVideos.filter(v => v.format !== 'Short').slice(0, 6);

    // Diverse shorts — pinned artists only
    const allShortsSorted = pinnedVideos.filter(v => v.format === 'Short');
    const topShorts: BriefingVideo[] = [];
    const shortsCount = new Map<string, number>();
    for (const v of allShortsSorted) {
      const n = shortsCount.get(v.artistSlug) ?? 0;
      if (n < 2) {
        topShorts.push(v);
        shortsCount.set(v.artistSlug, n + 1);
      }
      if (topShorts.length >= 9) break;
    }

    // Video lookup by slug
    const videosBySlug = new Map<string, BriefingVideo[]>();
    allRecentVideos.forEach(v => {
      const arr = videosBySlug.get(v.artistSlug) ?? [];
      arr.push(v);
      videosBySlug.set(v.artistSlug, arr);
    });

    // ── Build Focus Campaigns ──────────────────────────────────────────────

    // Score channels for campaign relevance
    // Score pinned campaigns — all pinned campaigns appear, ranked by activity
    const campaignRelevance = (ch: BriefingChannel): number => {
      let s = 0;
      // Active campaign tag
      if (ch.campaign) s += 25;
      if (ch.phase === 'PUSH' || ch.phase === 'RELEASE') s += 20;
      // Growing
      if (ch.classification === 'GROWING') s += 20;
      // Cadence
      if (ch.uploads30d >= 4) s += 15;
      // Multiformat
      if (ch.shorts30d >= 1 && ch.longform30d >= 1) s += 15;
      // Recency
      if ((ch.lastUploadDaysAgo ?? 999) <= 7) s += 10;
      // WoW momentum
      if ((ch.viewsWoW ?? 0) > 10) s += 10;
      // Views
      if ((ch.views7d ?? 0) >= 50000) s += 10;
      else if ((ch.views7d ?? 0) >= 10000) s += 5;
      return s;
    };

    // ALL pinned active campaigns appear as focus campaigns, ranked by activity
    const rankedChannels = allChannels
      .filter(ch => pinnedSlugs.has(ch.slug))
      .map(ch => ({ ch, score: campaignRelevance(ch) }))
      .sort((a, b) => b.score - a.score);

    const phaseLabel = (phase: string): string => {
      switch (phase) {
        case 'PRE': return 'Pre-release';
        case 'START': return 'Campaign Launch';
        case 'RELEASE': return 'Release Window';
        case 'PUSH': return 'Active Push';
        case 'PEAK': return 'Peak Momentum';
        case 'SUSTAIN': return 'Sustained Rollout';
        case 'HOLD': return 'Building Towards';
        default: return 'Active';
      }
    };

    const buildNarrative = (ch: BriefingChannel): string => {
      const vids = videosBySlug.get(ch.slug) ?? [];
      const hasShorts = ch.shorts30d >= 1;
      const hasLongform = ch.longform30d >= 1;
      const growing = ch.classification === 'GROWING';
      const wow = ch.viewsWoW ?? 0;

      // Strong campaigns — full momentum
      if (hasShorts && hasLongform && growing && wow > 10) {
        return `Full content ecosystem in play — Shorts driving discovery alongside longform depth. Week-over-week momentum building with each upload.`;
      }
      if (hasShorts && hasLongform && growing) {
        return `Multi-format strategy connecting. Shorts and longform working together to build audience depth across the campaign.`;
      }
      if (growing && wow > 20) {
        return `Strong week-over-week growth. Campaign momentum accelerating with consistent content output.`;
      }
      if (ch.campaign && (ch.phase === 'PUSH' || ch.phase === 'RELEASE')) {
        return `Active rollout window. Content strategy focused on sustaining reach and deepening audience connection through the campaign.`;
      }
      if (hasShorts && !hasLongform && ch.shorts30d >= 3) {
        return `Shorts-led discovery building real momentum. Campaign surface expanding through consistent short-form output.`;
      }
      if (ch.uploads30d >= 4) {
        return `Strong upload cadence maintaining recommendation visibility. Consistent presence keeping the campaign in front of new audiences.`;
      }
      if (vids.length >= 2) {
        return `Active content rollout with multiple touchpoints. Building audience familiarity through the campaign window.`;
      }
      // Early-stage / building campaigns — always forward-looking
      if (ch.uploads30d >= 1) {
        return `Campaign building. Early content establishing the channel's presence ahead of the next phase — laying the foundation for a fuller rollout.`;
      }
      if (ch.phase === 'PRE') {
        return `Pre-release phase. Building towards the campaign launch — content strategy and audience priming in development.`;
      }
      return `Campaign just getting started. Content strategy taking shape as we build towards the full rollout window.`;
    };

    const buildContentStrategy = (ch: BriefingChannel): string => {
      const hasShorts = ch.shorts30d >= 1;
      const hasLongform = ch.longform30d >= 1;
      if (hasShorts && hasLongform) {
        return `Multi-format: ${ch.shorts30d} Shorts + ${ch.longform30d} longform in 30d. Shorts driving discovery, longform building depth.`;
      }
      if (hasShorts) {
        return `Shorts-led: ${ch.shorts30d} Shorts in 30d. Discovery-first approach building reach.`;
      }
      if (hasLongform) {
        return `Longform-led: ${ch.longform30d} longform uploads in 30d. Depth-first audience building.`;
      }
      if (ch.uploads30d >= 1) {
        return `${ch.uploads30d} upload${ch.uploads30d > 1 ? 's' : ''} in 30d. Building content foundation ahead of the campaign ramp.`;
      }
      return `Content strategy in development. Preparing for the upcoming rollout window.`;
    };

    // Ecosystem signal — uses multiformat score (anchor-aware).
    // Full Ecosystem requires Strong (anchor + Shorts + 2+ supporting formats).
    // Multi-Format Active requires Good (anchor + Shorts + 1 supporting).
    // Just Shorts + one longform is NOT multi-format strategy.
    const buildEcosystemSignal = (ch: BriefingChannel): string => {
      if (ch.multiformatScore === 'Strong') return 'Full Ecosystem';
      if (ch.multiformatScore === 'Good') return 'Multi-Format Active';
      if (ch.multiformatScore === 'Partial') {
        return ch.shorts30d >= 1 ? 'Shorts Momentum' : 'Building';
      }
      if (ch.shorts30d >= 3) return 'Shorts Momentum';
      if (ch.uploads30d >= 1) return 'Getting Started';
      return 'Getting Started';
    };

    const buildNextMoments = (ch: BriefingChannel, a: Artist | undefined): string => {
      if (a?.nextMomentLabel && a?.nextMomentDate) {
        return `${a.nextMomentLabel} — ${a.nextMomentDate}`;
      }
      if (ch.phase === 'PUSH' || ch.phase === 'RELEASE') {
        return 'Active rollout — follow-through content and supporting uploads in the campaign window.';
      }
      if (ch.phase === 'PRE') {
        return 'Pre-release build. Content teasing and audience priming ahead of the drop.';
      }
      return 'Continued content rollout and audience development.';
    }

    const buildFormatBreakdown = (ch: BriefingChannel, vids: BriefingVideo[]): string[] => {
      const formats: string[] = [];
      const titles = vids.map(v => v.title.toLowerCase());
      const fmts = vids.map(v => v.format);

      if (fmts.includes('Official Video')) formats.push('Official Video');
      if (fmts.includes('Short') || ch.shorts30d >= 1) formats.push('Shorts');
      if (titles.some(t => t.includes('bts') || t.includes('behind') || t.includes('making'))) formats.push('BTS');
      if (fmts.includes('Lyric Video')) formats.push('Lyric Video');
      if (fmts.includes('Visualizer')) formats.push('Visualizer');
      if (titles.some(t => t.includes('live') || t.includes('session') || t.includes('acoustic'))) formats.push('Live / Session');
      if (fmts.includes('Premiere')) formats.push('Premiere');
      if (fmts.includes('Trailer')) formats.push('Trailer / Announcement');

      return formats.length > 0 ? formats : ['Content uploads'];
    }

    const artistMap = new Map<string, Artist>();
    allArtists.forEach(a => artistMap.set(a.slug, a));

    // Load coach plans — match by artist slug prefix since plan slugs
    // are like "k-trap-k-trap-campaign" while artist slugs are "k-trap"
    const planIndex = await listPlans();
    const coachPlans = new Map<string, Awaited<ReturnType<typeof loadPlan>>>();

    // Build artist-slug → plan-slug mapping
    // Uses three matching strategies in order:
    //   1. Normalized slug prefix (strips hyphens, compares prefixes)
    //   2. Plan artist name → channel name (case-insensitive)
    //   3. Plan artist name normalized → channel slug normalized
    // This handles cases like tovelomusic ↔ tove-lo-campaign and
    // gener8ionworld ↔ gener8ion-campaign where slug prefixes don't work.
    const norm = (s: string) => s.replace(/-/g, '').toLowerCase();
    const normName = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase();

    // Build a name→slug lookup for all pinned artists
    const pinnedNameToSlug = new Map<string, string>();
    for (const artistSlug of Array.from(pinnedSlugs)) {
      const artist = artistMap.get(artistSlug);
      if (artist) {
        pinnedNameToSlug.set(normName(artist.name), artistSlug);
      }
    }

    const artistSlugToPlanSlug = new Map<string, string>();
    const tryAssign = (artistSlug: string, entry: { slug: string; updatedAt: string }) => {
      const existing = artistSlugToPlanSlug.get(artistSlug);
      if (!existing) {
        artistSlugToPlanSlug.set(artistSlug, entry.slug);
      } else {
        const existingEntry = planIndex.find(e => e.slug === existing);
        if (existingEntry && entry.updatedAt > existingEntry.updatedAt) {
          artistSlugToPlanSlug.set(artistSlug, entry.slug);
        }
      }
    };

    for (const entry of planIndex) {
      const planNorm = norm(entry.slug);

      // Strategy 1: normalized slug prefix matching
      for (const artistSlug of Array.from(pinnedSlugs)) {
        const artistNorm = norm(artistSlug);
        if (planNorm.startsWith(artistNorm) || artistNorm.startsWith(planNorm)) {
          tryAssign(artistSlug, entry);
        }
      }

      // Strategy 2: match plan artist name to channel name
      const planArtistNorm = normName(entry.artist);
      const matchedSlug = pinnedNameToSlug.get(planArtistNorm);
      if (matchedSlug && !artistSlugToPlanSlug.has(matchedSlug)) {
        tryAssign(matchedSlug, entry);
      }

      // Strategy 3: plan artist name normalized → channel slug contains it
      if (!matchedSlug) {
        for (const artistSlug of Array.from(pinnedSlugs)) {
          if (artistSlugToPlanSlug.has(artistSlug)) continue;
          const artistNorm = norm(artistSlug);
          if (artistNorm.includes(planArtistNorm) || planArtistNorm.includes(artistNorm)) {
            tryAssign(artistSlug, entry);
          }
        }
      }
    }

    // Load full plans for matched artists
    await Promise.all(
      Array.from(artistSlugToPlanSlug.entries()).map(async ([artistSlug, planSlug]) => {
        const plan = await loadPlan(planSlug);
        if (plan) coachPlans.set(artistSlug, plan);
      })
    );

    // Clean up event titles that start with stray date fragments
    // e.g. ", 2026 – Mr. Alligator single release" → "Mr. Alligator single release"
    const cleanTitle = (t: string) =>
      t.replace(/^[,\s]*\d{4}\s*[–—-]\s*/, '').replace(/^[,\s]+/, '').trim();

    // ── Event priority scoring ───────────────────────────────────────────
    // Priority 100: Album / Single / Official video / Documentary / Longform
    // Priority 80:  Trailer / BTS / Visualiser / Lyric video / Live session / Premiere
    // Priority 60:  Community post / Shorts support / Fan content / Collab
    // Priority 30:  Tour dates / Festivals / Radio / Press
    // Tour/festival only surface if no higher-priority content moments exist.
    const eventPriority = (kind: string, title: string): number => {
      const t = title.toLowerCase();
      // Priority 100 — core content releases
      if (kind === 'albumRelease' || kind === 'albumAnnounce') return 100;
      if (kind === 'singleRelease') return 100;
      if (kind === 'documentaryRelease') return 100;
      if (/\bofficial\s*(music\s*)?video\b/.test(t)) return 100;
      if (/\blongform\b/.test(t)) return 100;
      // Priority 80 — supporting video content
      if (kind === 'documentaryTease') return 80;
      if (/\btrailer\b/.test(t)) return 80;
      if (/\b(bts|behind\s*the\s*scenes)\b/.test(t)) return 80;
      if (/\bvisuali[sz]er\b/.test(t)) return 80;
      if (/\blyric\s*video\b/.test(t)) return 80;
      if (/\b(live\s*session|acoustic|performance\s*video)\b/.test(t)) return 80;
      if (/\bpremiere\b/.test(t)) return 80;
      // Priority 60 — community & support content
      if (kind === 'collab') return 60;
      if (kind === 'snippet') return 60;
      if (/\b(community|shorts|fan\s*content|reaction)\b/.test(t)) return 60;
      // Priority 30 — live/touring/press (only show if nothing better exists)
      if (kind === 'festival' || kind === 'tourDate' || kind === 'liveShow' || kind === 'tourAnnounce') return 30;
      if (kind === 'promoTrip' || kind === 'podcast') return 30;
      if (/\b(radio|press|interview)\b/.test(t)) return 30;
      // Default: treat as mid-tier content
      return 60;
    };

    // ── Editorial Priority Scoring ──────────────────────────────────────
    // Hidden composite score that drives visual hierarchy.
    // NOT displayed publicly — only controls card size and ordering.
    // ── Editorial Priority Score (V2) ──────────────────────────────
    // 30% momentum + 20% scale + 20% upcoming + 15% ecosystem + 10% activity + 5% planner
    const computeEditorialPriority = (
      ch: BriefingChannel,
      vids: BriefingVideo[],
      hasCoachPlan: boolean,
      nextDateStr: string | null,
    ): number => {
      let score = 0;

      // 30% Recent YouTube momentum (max 30)
      const v7 = ch.views7d ?? 0;
      if (v7 >= 500000) score += 15;
      else if (v7 >= 100000) score += 12;
      else if (v7 >= 50000) score += 9;
      else if (v7 >= 10000) score += 6;
      else if (v7 >= 5000) score += 3;
      const wow = ch.viewsWoW ?? 0;
      if (wow > 50) score += 6;
      else if (wow > 10) score += 4;
      else if (wow > 0) score += 2;
      if ((ch.subs7d ?? 0) >= 500) score += 5;
      else if ((ch.subs7d ?? 0) > 0) score += 3;
      if ((ch.subsPer1kViews ?? 0) >= 3) score += 4;

      // 20% Campaign scale — standout video (max 20)
      const bestVid = [...vids].sort((a, b) => b.viewCount - a.viewCount)[0];
      if (bestVid) {
        if (bestVid.viewCount >= 1000000) score += 20;
        else if (bestVid.viewCount >= 500000) score += 16;
        else if (bestVid.viewCount >= 100000) score += 12;
        else if (bestVid.viewCount >= 50000) score += 8;
        else if (bestVid.viewCount >= 10000) score += 4;
      }

      // 20% Upcoming importance (max 20)
      if (nextDateStr) {
        const nextDate = new Date(nextDateStr + 'T00:00:00');
        const daysUntil = Math.round((nextDate.getTime() - now) / 86400000);
        if (daysUntil >= 0 && daysUntil <= 7) score += 14;
        else if (daysUntil >= 0 && daysUntil <= 14) score += 10;
        else if (daysUntil >= 0 && daysUntil <= 30) score += 6;
      }
      if (hasCoachPlan) score += 6;

      // 15% Content ecosystem (max 15)
      if (ch.multiformatScore === 'Strong') score += 15;
      else if (ch.multiformatScore === 'Good') score += 10;
      else if (ch.multiformatScore === 'Partial') score += 5;

      // 10% Recent channel activity (max 10)
      const recent14 = vids.filter(v => v.daysAgo <= 14).length;
      if (recent14 >= 4) score += 7;
      else if (recent14 >= 2) score += 5;
      else if (recent14 >= 1) score += 3;
      if (ch.uploads30d >= 8) score += 3;

      // 5% Planner confidence (max 5)
      if (hasCoachPlan) score += 3;
      if (nextDateStr) score += 2;

      return score;
    }

    const focusCampaigns: FocusCampaign[] = rankedChannels.map(({ ch }) => {
      const vids = videosBySlug.get(ch.slug) ?? [];
      const bestVideo = [...vids].sort((a, b) => b.velocity - a.velocity)[0];
      const heroImage = bestVideo
        ? `https://i.ytimg.com/vi/${bestVideo.id}/hqdefault.jpg`
        : ch.thumbnail ?? '';
      const artist = artistMap.get(ch.slug);

      // Derive current / next / upcoming / support from coach plan events
      const coachPlan = coachPlans.get(ch.slug);
      let nextMoments = buildNextMoments(ch, artist);
      let currentMoment = '';
      let currentMomentDate: string | null = null;
      let nextMoment = '';
      let nextMomentDate: string | null = null;
      let upcomingMoment = '';
      let upcomingMomentDate: string | null = null;
      let supportOpportunity = '';
      const hasCoachPlan = !!(coachPlan?.plan?.events && coachPlan.plan.events.length > 0);

      if (hasCoachPlan) {
        const enriched = coachPlan!.plan.events
          .map((e: ParsedEvent) => {
            const d = new Date(e.dateISO + 'T00:00:00');
            const diff = Math.round((d.getTime() - now) / 86400000);
            const title = cleanTitle(e.title);
            return { ...e, title, diff, priority: eventPriority(e.kind, title) };
          });

        // Filter to recent/upcoming window, then sort by priority (desc) then date (asc)
        const recentOrUpcoming = enriched
          .filter(e => e.diff >= -7)
          .sort((a, b) => b.priority - a.priority || a.diff - b.diff);

        // If higher-priority events exist (≥60), drop tour/festival (30) from the picks
        const hasHighPriority = recentOrUpcoming.some(e => e.priority >= 60);
        const filtered = hasHighPriority
          ? recentOrUpcoming.filter(e => e.priority >= 60)
          : recentOrUpcoming;

        const evt0 = filtered[0] ?? null;
        const evt1 = filtered[1] ?? null;
        const evt2 = filtered[2] ?? null;

        // Helper to format date
        const fmtEvtDate = (iso: string) =>
          new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

        if (evt0) {
          currentMoment = evt0.title;
          currentMomentDate = fmtEvtDate(evt0.dateISO);
          nextMoments = evt0.title + ` (${currentMomentDate})`;
          if (evt1) {
            nextMoments += ` → ${evt1.title} (${fmtEvtDate(evt1.dateISO)})`;
          }
        }
        if (evt1) {
          nextMoment = evt1.title;
          nextMomentDate = fmtEvtDate(evt1.dateISO);
        }
        if (evt2) {
          upcomingMoment = evt2.title;
          upcomingMomentDate = fmtEvtDate(evt2.dateISO);
        }

        // Support opportunity based on the most relevant event type
        const relevantEvt = evt0 ?? evt1;
        if (relevantEvt) {
          const k = relevantEvt.kind;
          if (k === 'albumRelease' || k === 'albumAnnounce') {
            supportOpportunity = 'Premiere + teaser support';
          } else if (k === 'singleRelease') {
            supportOpportunity = 'Official video + Shorts support';
          } else if (k === 'festival' || k === 'tourDate' || k === 'liveShow') {
            supportOpportunity = 'Live content + Shorts';
          } else if (k === 'documentaryRelease' || k === 'documentaryTease') {
            supportOpportunity = 'Longform premiere + BTS';
          } else if (k === 'collab') {
            supportOpportunity = 'Cross-channel collab support';
          } else {
            supportOpportunity = 'Content support + Shorts';
          }
        }
      }

      // Fallbacks — "Timeline being developed" when no coach plan exists
      if (!currentMoment) {
        currentMoment = hasCoachPlan ? 'Campaign planning active' : 'Timeline being developed';
      }
      if (!nextMoment) {
        nextMoment = hasCoachPlan ? 'Campaign planning active' : 'Timeline being developed';
      }
      if (!upcomingMoment) {
        upcomingMoment = hasCoachPlan ? 'To be confirmed' : 'Timeline being developed';
      }
      if (!supportOpportunity) {
        if (ch.shorts30d >= 1 && ch.longform30d >= 1) {
          supportOpportunity = 'Multi-format ecosystem support';
        } else if (ch.shorts30d >= 1) {
          supportOpportunity = 'Shorts discovery + longform opportunity';
        } else {
          supportOpportunity = 'Content strategy + Shorts ramp';
        }
      }

      // ── NOW: derive from latest real YouTube upload ──────────────
      const latestVid = vids[0] ?? null;
      let nowLabel = '';
      let nowDetail = '';
      let nowThumbnail: string | null = null;

      if (latestVid) {
        nowLabel = `${latestVid.title}`;
        const daysAgo = latestVid.daysAgo;
        const timeAgo = daysAgo === 0 ? 'Uploaded today'
          : daysAgo === 1 ? 'Uploaded yesterday'
          : `Uploaded ${daysAgo} days ago`;
        nowDetail = latestVid.viewCount > 0
          ? `${timeAgo} · ${fmtNum(latestVid.viewCount)} views`
          : timeAgo;
        nowThumbnail = latestVid.thumbnail;
      } else if (ch.lastUploadDaysAgo != null && ch.lastUploadDaysAgo <= 14) {
        nowLabel = 'Recent upload activity';
        nowDetail = `Last upload ${ch.lastUploadDaysAgo} days ago`;
      } else {
        nowLabel = 'No recent uploads';
        nowDetail = ch.lastUploadDaysAgo != null
          ? `Last upload ${ch.lastUploadDaysAgo} days ago`
          : 'Channel inactive';
      }

      // Hero image: use latest upload thumbnail, not generic campaign art
      const latestHeroImage = nowThumbnail
        ? nowThumbnail.replace('/mqdefault.jpg', '/hqdefault.jpg')
        : heroImage;

      // ── YOUTUBE FOCUS: one real sentence, not generic ─────────
      let youtubeFocus = '';
      if (latestVid && currentMomentDate) {
        const latestFormat = latestVid.format?.toLowerCase() ?? '';
        if (/official video/i.test(latestFormat)) {
          youtubeFocus = 'Follow-through content around latest official video.';
        } else if (/bts|behind/i.test(latestFormat)) {
          youtubeFocus = 'BTS momentum building into next release.';
        } else if (/trailer/i.test(latestFormat)) {
          youtubeFocus = 'Trailer live — bridge to release window.';
        } else if (/live session|acoustic/i.test(latestFormat)) {
          youtubeFocus = 'Live session extending release reach.';
        } else if (/short/i.test(latestFormat) || latestVid.durationSec <= 62) {
          youtubeFocus = 'Shorts activity keeping channel in recommendations.';
        } else if (/visuali/i.test(latestFormat)) {
          youtubeFocus = 'Visualiser adding catalogue depth.';
        } else {
          youtubeFocus = 'Maintain upload cadence through campaign window.';
        }
      } else if (currentMomentDate) {
        youtubeFocus = 'Content needed ahead of next dated moment.';
      } else if (latestVid) {
        youtubeFocus = 'Keep momentum — follow through on latest upload.';
      } else {
        youtubeFocus = 'Needs content plan and upload activity.';
      }

      const chUrl = channelUrl(ch.channelHandle);

      return {
        channel: ch,
        heroImage: latestHeroImage,
        campaignPhase: phaseLabel(ch.phase),
        nowLabel,
        nowDetail,
        nowThumbnail,
        nextLabel: currentMoment || 'To be confirmed',
        nextDate: currentMomentDate,
        afterLabel: nextMoment || 'To be confirmed',
        afterDate: nextMomentDate,
        youtubeFocus,
        channelUrl: chUrl,
        hasCoachPlan,
        currentMoment,
        currentMomentDate,
        nextMoment: nextMoment,
        nextMomentDate,
        upcomingMoment,
        upcomingMomentDate,
        recentVideos: vids.slice(0, 5),
        editorialPriority: 0,
        standoutVideo: null,
        tier: 3 as (1 | 2 | 3),
        contentFormats: [],
      };
    });

    // ── Compute editorial priority and assign tiers ──────────────────
    for (const fc of focusCampaigns) {
      const vids = videosBySlug.get(fc.channel.slug) ?? [];
      fc.editorialPriority = computeEditorialPriority(
        fc.channel, vids, fc.hasCoachPlan,
        fc.currentMomentDate ?? null,
      );
      // Standout: best-performing video (highest views)
      const bestVid = [...vids].sort((a, b) => b.viewCount - a.viewCount)[0];
      if (bestVid) fc.standoutVideo = bestVid;
      // Content format tags
      const formats = new Set<string>();
      for (const v of vids) {
        if (v.durationSec <= 62) formats.add('Short');
        if (/official video/i.test(v.format)) formats.add('Official Video');
        else if (/lyric/i.test(v.format)) formats.add('Lyric Video');
        else if (/visuali/i.test(v.format)) formats.add('Visualiser');
        else if (/bts|behind/i.test(v.format)) formats.add('BTS');
        else if (/live session|acoustic/i.test(v.format)) formats.add('Live Session');
        else if (/collab/i.test(v.format)) formats.add('Collab');
        else if (/trailer/i.test(v.format)) formats.add('Trailer');
        else if (/premiere/i.test(v.format)) formats.add('Premiere');
      }
      fc.contentFormats = Array.from(formats);
    }

    // Sort by editorial priority (highest first)
    focusCampaigns.sort((a, b) => b.editorialPriority - a.editorialPriority);

    // Assign tiers: top 3 = Tier 1, next 3 = Tier 2, rest = Tier 3
    focusCampaigns.forEach((fc, i) => {
      if (i < 3 && fc.editorialPriority >= 25) fc.tier = 1;
      else if (i < 6 && fc.editorialPriority >= 15) fc.tier = 2;
      else fc.tier = 3;
    });

    // ── Platform Observations (scoped to pinned campaigns) ─────────────────

    const pinnedChannels = allChannels.filter(ch => pinnedSlugs.has(ch.slug));
    const platformObservations: string[] = [];

    // Shorts + longform pairing
    const multiFormatGrowing = pinnedChannels.filter(
      ch => ch.shorts30d >= 1 && ch.longform30d >= 1 && ch.classification === 'GROWING'
    );
    if (multiFormatGrowing.length >= 2) {
      platformObservations.push(
        `Campaigns pairing Shorts with longform content are sustaining momentum longer. ${multiFormatGrowing.length} active campaigns running multi-format strategies this week are all in a growth state.`
      );
    }

    // Follow-through cadence
    const highCadenceGrowing = pinnedChannels.filter(
      ch => ch.uploads30d >= 4 && ch.classification === 'GROWING'
    );
    if (highCadenceGrowing.length >= 2) {
      platformObservations.push(
        `Follow-through uploads after release day are extending recommendation activity. The campaigns posting 4+ times in 30 days are maintaining visibility well beyond the initial drop.`
      );
    }

    // Shorts discovery
    const shortsActive = pinnedChannels.filter(ch => ch.shorts30d >= 3);
    if (shortsActive.length >= 2) {
      platformObservations.push(
        `Shorts remain the primary discovery surface. Artist-led context — studio clips, behind-the-scenes, creative process — is improving engagement quality and driving deeper audience connection.`
      );
    }

    // Cadence consistency
    const consistentChannels = pinnedChannels.filter(ch => ch.uploads30d >= 3 && (ch.lastUploadDaysAgo ?? 999) <= 7);
    if (consistentChannels.length >= 3) {
      platformObservations.push(
        `Cadence consistency continues to outperform isolated drops. Channels maintaining regular upload schedules are seeing compounding recommendation signals across the roster.`
      );
    }

    // Ensure we have at least 3 observations
    if (platformObservations.length < 3) {
      platformObservations.push(
        `Content ecosystems — multiple formats working together around a single campaign — remain the clearest signal of sustained YouTube growth across the music space.`
      );
    }

    // ── Upcoming Moments (all pinned campaigns + coach plan dates) ─────────

    const upcomingMoments: UpcomingMoment[] = [];

    // Helper: format a date nicely for the timing column
    const fmtTiming = (iso: string): string => {
      const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
      if (isNaN(d.getTime())) return iso;
      const diffDays = Math.round((d.getTime() - now) / 86400000);
      const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      if (diffDays === 0) return `${dateStr} (today)`;
      if (diffDays === 1) return `${dateStr} (tomorrow)`;
      if (diffDays > 0 && diffDays <= 14) return `${dateStr} (in ${diffDays}d)`;
      if (diffDays < 0 && diffDays >= -7) return `${dateStr} (${-diffDays}d ago)`;
      return dateStr;
    };

    // Map event kind → partner-friendly event type label
    const eventTypeLabel = (kind: string): string => {
      switch (kind) {
        case 'singleRelease': return 'New Single';
        case 'albumRelease': return 'Album Drop';
        case 'albumAnnounce': return 'Album Announcement';
        case 'documentaryRelease': return 'Documentary';
        case 'documentaryTease': return 'Documentary Teaser';
        case 'festival': return 'Festival';
        case 'tourDate': return 'Live Show';
        case 'liveShow': return 'Live Show';
        case 'tourAnnounce': return 'Tour Announcement';
        case 'collab': return 'Collaboration';
        case 'podcast': return 'Podcast / Interview';
        case 'snippet': return 'Content Teaser';
        case 'promoTrip': return 'Promo Trip';
        default: return 'Content Moment';
      }
    };

    const surfaceForKind = (kind: string): string => {
      if (kind === 'albumRelease' || kind === 'albumAnnounce') return 'Official Video + Shorts + Supporting';
      if (kind === 'singleRelease') return 'Official Video + Shorts support';
      if (kind === 'festival' || kind === 'tourDate' || kind === 'liveShow') return 'Live content + Shorts';
      if (kind === 'tourAnnounce') return 'Announcement + Shorts';
      if (kind === 'collab') return 'Collab content + cross-promo';
      if (kind === 'documentaryRelease' || kind === 'documentaryTease') return 'Longform + BTS';
      return 'Content support';
    };

    // "What Happens Next" — ONLY real dates tied to real YouTube moments.
    // If there's no date from a coach plan, don't include it.
    // YouTube wants to see: singles, official videos, BTS, trailers,
    // visualisers — anchored to actual dates. Generic "timeline being
    // developed" or "pre-release content build" adds no value here.
    for (const { ch } of rankedChannels) {
      const artist = artistMap.get(ch.slug);
      const coachPlan = coachPlans.get(ch.slug);

      // Only include moments from coach plans with real dates
      if (coachPlan?.plan?.events && coachPlan.plan.events.length > 0) {
        const scoredEvents = coachPlan.plan.events
          .filter((e: ParsedEvent) => {
            const d = new Date(e.dateISO + 'T00:00:00');
            const diff = Math.round((d.getTime() - now) / 86400000);
            return diff >= -7 && diff <= 35; // last week + next ~5 weeks
          })
          .map((e: ParsedEvent) => {
            const title = cleanTitle(e.title);
            return { ...e, title, priority: eventPriority(e.kind, title) };
          })
          // Only YouTube content moments (priority >= 60) — no tour/festival/press
          .filter(e => e.priority >= 60)
          // Sort by priority (desc) then date (asc)
          .sort((a, b) => b.priority - a.priority || a.dateISO.localeCompare(b.dateISO));

        for (const evt of scoredEvents.slice(0, 4)) { // max 4 per artist
          upcomingMoments.push({
            artist: ch.name,
            slug: ch.slug,
            moment: evt.title,
            date: evt.dateISO,
            timing: fmtTiming(evt.dateISO),
            eventType: eventTypeLabel(evt.kind),
            supportSurface: surfaceForKind(evt.kind),
            rolloutNote: evt.scale === 'anchor'
              ? 'Anchor moment — full rollout planned'
              : evt.scale === 'major'
                ? 'Key campaign moment'
                : 'Supporting content drop',
            fromCoachPlan: true,
            priority: evt.priority,
          });
        }
      }

      // Also include artist metadata moments IF they have a real date
      if (artist?.nextMomentLabel && artist?.nextMomentDate) {
        // Don't duplicate if coach plan already covers this artist
        const alreadyHas = upcomingMoments.some(m => m.slug === ch.slug);
        if (!alreadyHas) {
          upcomingMoments.push({
            artist: ch.name,
            slug: ch.slug,
            moment: artist.nextMomentLabel,
            date: artist.nextMomentDate,
            timing: fmtTiming(artist.nextMomentDate),
            eventType: 'Content Moment',
            supportSurface: 'Official Video + Shorts support',
            rolloutNote: 'Full rollout planned',
            fromCoachPlan: false,
            priority: 60,
          });
        }
      }
      // No fallbacks — if there's no date, the artist doesn't appear here
    }

    // Sort: highest priority first, then by date within same priority tier
    upcomingMoments.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      if (a.date && b.date) return a.date.localeCompare(b.date);
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;
      return 0;
    });

    // ── Ecosystem Highlights ──────────────────────────────────────────────

    const ecosystemScore = (c: BriefingChannel): number => {
      let score = 0;
      if (c.shorts30d >= 1 && c.longform30d >= 1) score += 25;
      else if (c.shorts30d >= 1 || c.longform30d >= 1) score += 8;
      score += Math.min(c.shorts30d, 4) * 3;
      score += Math.min(c.longform30d, 3) * 4;
      score += Math.min(c.uploads30d, 10) * 2;
      if ((c.lastUploadDaysAgo ?? 999) <= 7) score += 10;
      if (c.classification === 'GROWING') score += 15;
      if ((c.viewsWoW ?? 0) > 20) score += 10;
      else if ((c.viewsWoW ?? 0) > 0) score += 5;
      if ((c.subsPer1kViews ?? 0) >= 2) score += 10;
      const v7d = c.views7d ?? 0;
      if (v7d >= 100000) score += 12;
      else if (v7d >= 20000) score += 8;
      else if (v7d >= 5000) score += 4;
      return score;
    }

    const ecosystemHighlights = pinnedChannels
      .filter(ch => ch.uploads30d >= 3 && (ch.shorts30d >= 1 || ch.longform30d >= 1) && (ch.lastUploadDaysAgo ?? 999) <= 14)
      .map(ch => ({ ch, score: ecosystemScore(ch) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ ch }) => {
        const hasShorts = ch.shorts30d >= 1;
        const hasLongform = ch.longform30d >= 1;
        let label = 'Active';
        let read = '';
        if (hasShorts && hasLongform && ch.uploads30d >= 5) {
          label = 'Full Ecosystem';
          read = `Shorts, longform and supporting content extending momentum beyond release day.`;
        } else if (hasShorts && hasLongform) {
          label = 'Multi-Format';
          read = `Multi-format strategy building audience depth across the campaign.`;
        } else if (hasShorts && ch.shorts30d >= 3) {
          label = 'Shorts Momentum';
          read = `Strong Shorts cadence driving discovery and new audience reach.`;
        } else {
          label = 'Building Depth';
          read = `Consistent output building audience connection through the campaign window.`;
        }
        return { name: ch.name, label, read, thumbnail: ch.thumbnail, channelHandle: ch.channelHandle };
      });

    // ── Playbook ───────────────────────────────────────────────────────────

    const playbook = generatePartnerPlaybook(pinnedChannels, pinnedVideos);

    // ── Week range ─────────────────────────────────────────────────────────

    const nowDate = new Date();
    const weekStart = new Date(nowDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekRange = `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

    // Active campaign count = number of pinned campaigns
    const activeCampaignCount = pinnedCampaigns.length;

    const response: PartnerBriefingResponse = {
      weekRange,
      generatedAt: nowDate.toISOString(),
      activeCampaignCount,
      focusCampaigns,
      platformObservations: platformObservations.slice(0, 4),
      upcomingMoments,
      playbook,
      topShorts,
      topVideos,
      ecosystemHighlights,
      // Moments We're Watching — best-performing real content from last 7 days
      momentsWatching: (() => {
        // ONLY from pinned campaigns — not all Virgin channels
        const seen = new Set<string>();
        const pinnedVids: BriefingVideo[] = [];
        for (const slug of Array.from(pinnedSlugs)) {
          const vids = videosBySlug.get(slug);
          if (vids) pinnedVids.push(...vids);
        }
        return pinnedVids
          .filter(v => v.durationSec > 62) // longform only — Shorts covered in hero
          .sort((a, b) => b.velocity - a.velocity)
          .filter(v => {
            if (v.daysAgo > 14) return false;
            if (seen.has(v.artistSlug)) return false;
            seen.add(v.artistSlug);
            return true;
          })
          .slice(0, 4)
          .map(v => ({
            id: v.id,
            title: v.title,
            artistName: v.channelName,
            artistSlug: v.artistSlug,
            thumbnail: v.thumbnail,
            viewCount: v.viewCount,
            velocity: v.velocity,
            daysAgo: v.daysAgo,
            format: v.format,
            durationSec: v.durationSec,
            // One-line editorial context
            context: (() => {
              const fc = focusCampaigns.find(c => c.channel.slug === v.artistSlug);
              if (!fc) return '';
              if (fc.nextDate) return `Building into ${fc.nextLabel} (${fc.nextDate}).`;
              if (fc.currentMomentDate) return `${fc.currentMoment} campaign active.`;
              return '';
            })(),
          }));
      })(),
    };

    if (redis) {
      try {
        await redis.set(weekKey, response, { ex: 8 * 86400 });
      } catch {
        // Cache write failure is non-fatal
      }
    }

    return NextResponse.json(response);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── Playbook Generation (partner-facing) ────────────────────────────────────

function generatePartnerPlaybook(
  channels: BriefingChannel[],
  videos: BriefingVideo[],
): PartnerBriefingResponse['playbook'] {
  const multiFormat = channels.filter(ch => ch.shorts30d >= 1 && ch.longform30d >= 1);
  const shortsHeavy = channels.filter(ch => ch.shorts30d >= 3 && ch.longform30d === 0);
  const activeNoRecent = channels.filter(ch =>
    ch.campaignStartDate != null && ch.lastUploadDaysAgo != null && ch.lastUploadDaysAgo > 7
  );

  if (activeNoRecent.length >= 2) {
    return {
      title: 'The 7–10 Day Follow-Through Window',
      why: 'Channels that sustain uploads after an official video retain recommendation surface significantly longer. The strongest campaigns treat follow-through as part of the rollout, not an afterthought.',
      when: 'Day 1–10 after any official video, premiere, or major drop.',
      actions: [
        'Day 1–3: Release a Short clip from the video — the standout moment, a reaction, or behind-the-scenes footage',
        'Day 3–7: Post a making-of or studio session piece to add depth and artist context',
        'Day 7–10: Drop a lyric video, visualiser, or acoustic version to keep the track alive in recommendations',
      ],
    };
  }

  if (shortsHeavy.length >= 1) {
    return {
      title: 'Shorts Sequencing Around a Longform Drop',
      why: 'Shorts generate discovery reach. When paired with a longform drop, they create a complete audience journey — from first impression to deeper engagement.',
      when: 'Whenever a key longform video is scheduled.',
      actions: [
        'Build a 3-Short teaser sequence in the days leading up to the longform drop',
        'Release the longform video with a same-day Short that clips the most compelling 15 seconds',
        'Follow up 3–5 days later with a reaction Short or outtake to drive traffic back to the main video',
      ],
    };
  }

  if (multiFormat.length >= 2) {
    return {
      title: 'Premiere + Community Post Sequence',
      why: 'Premieres drive simultaneous viewing and live chat engagement. A Community Post 24 hours before builds anticipation and primes the algorithm.',
      when: 'Any major drop — official videos, documentaries, longform releases.',
      actions: [
        'Schedule the premiere 48–72 hours in advance to build recommendation pre-load',
        'Post a Community Post 24 hours before with a teaser image and countdown',
        'Be present in the premiere chat for the first 30 minutes — creator engagement signals boost algorithmic response',
      ],
    };
  }

  return {
    title: 'Building a Content Ecosystem',
    why: 'The campaigns seeing sustained growth treat YouTube as an always-on platform, not a release-day moment. Multiple formats working together create compounding recommendation signals.',
    when: 'Every active campaign window.',
    actions: [
      'Pair every official video with at least 2 supporting uploads within 10 days — BTS, Shorts clips, artist-led context',
      'Maintain a minimum Shorts cadence of 2 per week during active campaign periods',
      'Add one piece of longform depth per cycle — a studio session, interview, or creative diary',
    ],
  };
}
