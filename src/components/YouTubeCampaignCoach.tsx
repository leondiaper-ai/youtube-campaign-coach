'use client';
// PIH Campaign Coach v2.2 — Weekly Rhythm widget
import { useState, useMemo, useCallback, useEffect, createContext, useContext } from 'react';
import { useSearchParams } from 'next/navigation';
import ConversionChip from '@/components/ConversionChip';
import {
  aiDecisionLayer,
  cadenceComparison,
  recentSignal,
  DECISION_STATE_META,
  MOMENTUM_LABEL,
  type PhaseName as CoachPhaseName,
  type WatcherEventLike,
} from '@/lib/coach';

// ═══════════════════════════════════════════════════════════════════════════════
// ARTIST SLUG CONTEXT — lets any child component know which artist we're editing
// ═══════════════════════════════════════════════════════════════════════════════
const ArtistSlugCtx = createContext<string>('');

// Resolved artist info fetched once on mount when ?artist=slug is present.
type ResolvedArtist = { slug: string; name: string; channelHandle?: string; phase?: string } | null;
const ResolvedArtistCtx = createContext<ResolvedArtist>(null);

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type PhaseName = 'BUILD' | 'RELEASE' | 'SCALE' | 'EXTEND';
type ActionType = 'short' | 'video' | 'post' | 'live' | 'playlist' | 'collab' | 'afterparty';
type ActionIntent = 'engage' | 'tease' | 'convert' | 'distribute';
type ActionStatus = 'planned' | 'done' | 'missed';
type ActionSystem = 1 | 2;
type VideoSubtype = 'official' | 'lyric' | 'visualiser' | 'live' | 'collab';
type DropType = 'official' | 'albumTrailer' | 'vlog' | 'performance' | 'tour' | 'announcement';
type Distribution = { collab?: boolean; paidPush?: boolean; crossPost?: boolean };
type DayLabel = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
type WeekStatus = 'cold' | 'warm' | 'hot' | 'cooling';
type ChannelTier = 'small' | 'mid' | 'large';

type MomentSignal = 'strong' | 'weak' | 'neutral';

type MomentMetrics = {
  views?: number;
  comments?: number;
  subsGained?: number;
  signal?: MomentSignal;
};

type CampaignAction = {
  id: string;
  title: string;
  type: ActionType;
  day: DayLabel;
  date?: string;              // ISO date string e.g. '2026-04-03'
  status: ActionStatus;
  system: ActionSystem;
  intent: ActionIntent;
  notes?: string;
  featuredArtist?: string;
  metrics?: MomentMetrics;
  momentRole?: MomentRole;
  trackId?: string;           // links to a TrackContentPlan
  dropWindowId?: string;      // groups into a DropWindow
  videoSubtype?: VideoSubtype;    // format of the video (official / lyric / artwork / live / collab)
  dropType?: DropType;            // campaign role of a hero drop (official / album trailer / vlog / etc.)
  distribution?: Distribution;    // collab / paid push / cross-post flags
};

type Feedback = {
  subsGained?: number;
  views?: number;
  comments?: number;
  engagementNote?: string;
};

type CampaignWeek = {
  week: number;
  label?: string;              // optional user-editable week label
  dateRange: string;
  actions: CampaignAction[];
  feedback: Feedback;
};

type CampaignPhase = {
  name: PhaseName;
  weekStart: number;
  weekEnd: number;
  color: string;
};

type CampaignTargets = {
  subsTarget: number;          // e.g. 500000 — goal subs at campaign end
  viewsTarget: number;         // e.g. 2000000 — total campaign views goal
  shortsPerWeek: number;       // e.g. 3 — target shorts output per week
  videosPerWeek: number;       // e.g. 1 — target video output per week
  postsPerWeek: number;        // e.g. 3 — target community posts per week
  communityPerWeek: number;    // e.g. 2 — target comment replies / engagement per week
};

// Auto-derive campaign targets from the channel's starting size and planned output.
// No user input required — updates live as the plan and watcher data change.
function autoTargets(planLike: {
  subscriberCount?: number;
  weeks?: { actions: { type: string }[] }[];
}): CampaignTargets {
  const startingSubs = planLike.subscriberCount || 0;
  // Growth multiplier tiered by channel size (smaller channels grow faster pct-wise).
  let growthPct: number;
  if (startingSubs < 10_000)          growthPct = 0.25;
  else if (startingSubs < 100_000)    growthPct = 0.18;
  else if (startingSubs < 1_000_000)  growthPct = 0.10;
  else                                growthPct = 0.05;
  const subsTarget = Math.max(1_000, Math.round(startingSubs * (1 + growthPct)));

  // Views target: expected views-per-drop × planned hero-drop count.
  // Heuristic: a "hero" drop (video/collab/live) on a healthy channel earns ~80% of subs
  // in the 30-day rolling window. We lean conservative to avoid unrealistic goals.
  const dropCount = (planLike.weeks || []).reduce(
    (n, w) => n + w.actions.filter((a) => a.type === 'video' || a.type === 'collab' || a.type === 'live').length,
    0,
  );
  const viewsPerDrop = Math.max(1_000, Math.round(startingSubs * 0.8));
  const viewsTarget = Math.max(viewsPerDrop * Math.max(1, dropCount), Math.round(startingSubs * 2));

  return {
    subsTarget,
    viewsTarget,
    shortsPerWeek: 3,
    videosPerWeek: 1,
    postsPerWeek: 3,
    communityPerWeek: 2,
  };
}

type ManualOverrides = {
  currentSubs?: number;
  totalViews?: number;
  // Per-drop manual toggles for things the YouTube API can't see.
  // Keyed by track.id (e.g. 'live-<videoId>' or planned action id).
  communityPostDone?: Record<string, boolean>;
  // Channel-level toggles for YouTube features the public API doesn't expose.
  merchShelfActive?: boolean;
  bandsintownActive?: boolean;
  // Manual counter — YouTube's cross-channel Collab tool isn't in the public API.
  collabsCount?: number;
};

type NextDropEdit = {
  name: string;
  weekNum: number;
  type: CampaignMoment['type'];
  goal: string;
  checklist: string[];
};

type CampaignPlan = {
  artist: string;
  campaignName: string;
  /** Artist slug — locks this plan to a specific artist. Populated from ?artist= URL param. */
  slug?: string;
  /** YouTube channel handle or ID — locks this plan to a specific channel. */
  channelHandle?: string;
  subscriberCount: number;     // starting subs (baseline)
  baselineSubs?: number;       // optional manual baseline at campaign start
  baselineViews?: number;
  startDate: string;
  weeks: CampaignWeek[];
  targets?: CampaignTargets;
  manualOverrides?: ManualOverrides;
  nextDropEdits?: Record<number, NextDropEdit>;
  tracks?: TrackContentPlan[];
  dropWindows?: DropWindow[];
  dropPlans?: DropPlan[];
  supportPlans?: SupportPlan[];
  moments?: CampaignMoment[];
  /** Concrete YouTube planner cards — each real-world event converted into an actionable moment. */
  youtubeMoments?: YouTubeMoment[];
  /** True for the seeded K Trap reference campaign; false/undefined for user-created campaigns. */
  isExample?: boolean;
};

type CoachTip = {
  week: number;
  message: string;
  priority: 'high' | 'medium' | 'low';
};

// ── TRACK CONTENT SYSTEM ──────────────────────────────────────────────────────

type MomentRole = 'hero' | 'support' | 'repackage' | 'push';

type TrackContentItem = {
  id: string;
  label: string;              // e.g. "Official Video", "Lyric Video", "Short #1"
  role: MomentRole;           // hero / support / repackage / push
  contentType: ActionType;    // short / video / post / live / playlist
  done: boolean;
  actionId?: string;          // links to a CampaignAction if created
};

type TrackContentPlan = {
  trackId: string;            // unique ID for the track
  trackName: string;          // e.g. '"Change" ft. Featured Artist'
  momentWeek: number;         // links to CAMPAIGN_MOMENTS weekNum
  items: TrackContentItem[];
};

type ContentStatus = 'underbuilt' | 'building' | 'ready';

type DropWindow = {
  id: string;
  label: string;              // e.g. "Change Drop Window"
  weekNum: number;
  actionIds: string[];        // grouped CampaignAction IDs within the window
};

// ── SUPPORT CONTENT SYSTEM (execution-driven, per-drop) ─────────────────────
// Every video/anchor moment generates a structured filming checklist.
// 3-phase: PRE DROP → DROP DAY → POST DROP
// 3-status: not_recorded → recorded → posted

type SupportStatus = 'not_recorded' | 'recorded' | 'posted';
type SupportPhase = 'pre' | 'drop' | 'post';

type SupportItem = {
  id: string;
  label: string;              // e.g. "Hook Short", "Drop Clip v1"
  contentType: ActionType;    // short / video / post
  phase: SupportPhase;        // pre / drop / post
  status: SupportStatus;      // not_recorded → recorded → posted
};

type SupportPlan = {
  planId: string;             // unique ID, e.g. 'support-4'
  momentWeek: number;         // links to CAMPAIGN_MOMENTS weekNum
  momentName: string;         // e.g. '"Change" ft. Featured Artist'
  momentDate: string;         // ISO date of the drop
  hasFeature: boolean;        // true if collab → adds "Collab Clip" to POST
  items: SupportItem[];
};

// Old DropPlan kept for backwards compat during migration
type DropPlanSlot = {
  id: string;
  label: string;
  contentType: ActionType;
  timing: 'before' | 'after';
  daysOffset: number;
  done: boolean;
};

type DropPlan = {
  dropId: string;
  momentWeek: number;
  momentName: string;
  momentDate: string;
  slots: DropPlanSlot[];
};

type ViewMode = 'campaign' | 'drop';

// ── YOUTUBE MOMENT PLANNER CARDS ────────────────────────────────────────────
// Each real-world campaign event that has YouTube content potential becomes a
// YouTubeMoment — a concrete planner card with support stack, not commentary.

type YouTubeMomentType =
  | 'official_video'
  | 'lyric_video'
  | 'visualizer'
  | 'album_announce'
  | 'album_release'
  | 'deluxe_release'
  | 'tour'
  | 'festival'
  | 'promo_trip'
  | 'activation'
  | 'catalogue'
  | 'live_show'
  | 'tour_announce';

type YouTubeMomentStatus = 'core_missing' | 'partial' | 'planned' | 'complete';

type YouTubeMoment = {
  id: string;
  title: string;
  date: string;              // ISO date
  phase: PhaseName;
  momentType: YouTubeMomentType;
  headline: string;          // one-line: why this matters on YouTube
  expectedSupport: string[]; // concrete support items
  status: YouTubeMomentStatus;
  reason: string;            // why this exists in the planner
  weekNum: number;           // links to CampaignWeek
  priority: 'high' | 'medium' | 'low';
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

// Default phases for the seed/demo plan. For dynamically-generated plans,
// enrichPlanWeeks assigns phase labels to each week and
// getPhaseForWeek reads those labels, so this is just the fallback.
const CAMPAIGN_PHASES: CampaignPhase[] = [
  { name: 'BUILD',   weekStart: 1,    weekEnd: 4,   color: '#2C25FF' },
  { name: 'RELEASE', weekStart: 5,    weekEnd: 10,  color: '#1FBE7A' },
  { name: 'SCALE',   weekStart: 11,   weekEnd: 22,  color: '#FF4A1C' },
  { name: 'EXTEND',  weekStart: 23,   weekEnd: 200, color: '#FFD3C9' },
];

const ACTION_LABELS: Record<ActionType, string> = {
  short: 'Shorts', video: 'Video', post: 'Post', live: 'Live', playlist: 'Playlist', collab: 'Collab', afterparty: 'Afterparty',
};

const ACTION_PILL: Record<ActionType, { icon: string; color: string }> = {
  short:      { icon: '▶', color: '#FFD24C' },
  video:      { icon: '◆', color: '#FF4A1C' },
  post:       { icon: '◎', color: '#2C25FF' },
  live:       { icon: '●', color: '#FF4A1C' },
  playlist:   { icon: '≡', color: '#1FBE7A' },
  collab:     { icon: '◉', color: '#1FBE7A' },
  afterparty: { icon: '★', color: '#2C25FF' },
};

// ── ACTION TILES ─────────────────────────────────────────────────────────────
// Bold, tactile building-block tiles for instant content creation

type TileKind = 'video' | 'shorts' | 'collab' | 'live' | 'afterparty';

const TILE_META: Record<TileKind, {
  label: string;
  bg: string;
  actionType: ActionType;
  system: ActionSystem;
  intent: ActionIntent;
  role: MomentRole;
  defaultTitle: string;
}> = {
  video:      { label: 'VIDEO',      bg: '#FF4A1C', actionType: 'video',      system: 2, intent: 'convert',    role: 'hero',    defaultTitle: 'New Video' },
  shorts:     { label: 'SHORTS',     bg: '#FFD24C', actionType: 'short',      system: 1, intent: 'engage',     role: 'push',    defaultTitle: 'New Short' },
  collab:     { label: 'COLLAB',     bg: '#1FBE7A', actionType: 'collab',     system: 2, intent: 'convert',    role: 'hero',    defaultTitle: 'New Collab' },
  live:       { label: 'LIVE',       bg: '#2C25FF', actionType: 'live',       system: 1, intent: 'engage',     role: 'support', defaultTitle: 'New Live' },
  afterparty: { label: 'AFTERPARTY', bg: '#2C25FF', actionType: 'afterparty', system: 1, intent: 'distribute', role: 'push',    defaultTitle: 'Afterparty' },
};

const TILE_KINDS: TileKind[] = ['video', 'shorts', 'collab', 'live', 'afterparty'];

const STATUS_STYLE: Record<ActionStatus, { bg: string; text: string; border: string }> = {
  done:    { bg: 'rgba(31,190,122,0.06)', text: '#0E0E0E', border: 'transparent' },
  missed:  { bg: 'rgba(255,74,28,0.06)', text: '#FF4A1C', border: 'transparent' },
  planned: { bg: 'transparent', text: '#0E0E0E', border: 'transparent' },
};

const TEMP: Record<WeekStatus, { text: string; dot: string }> = {
  cold:    { text: '#2C25FF', dot: '#2C25FF' },
  warm:    { text: '#FFD24C', dot: '#FFD24C' },
  hot:     { text: '#FF4A1C', dot: '#FF4A1C' },
  cooling: { text: '#0E0E0E', dot: '#0E0E0E' },
};

const INTENT_META: Record<ActionIntent, { label: string; color: string }> = {
  engage:     { label: 'Engage',     color: '#2C25FF' },
  tease:      { label: 'Tease',      color: '#FFD24C' },
  convert:    { label: 'Convert',    color: '#FF4A1C' },
  distribute: { label: 'Distribute', color: '#1FBE7A' },
};

const SYSTEM_LABEL: Record<ActionSystem, string> = { 1: 'S1', 2: 'S2' };

const STATUS_CYCLE: ActionStatus[] = ['planned', 'done', 'missed'];
const ACTION_TYPES: ActionType[] = ['short', 'video', 'post', 'live', 'collab', 'afterparty'];
const SYSTEMS: ActionSystem[] = [1, 2];
const INTENTS: ActionIntent[] = ['engage', 'tease', 'convert', 'distribute'];
const DAYS: DayLabel[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const SIGNALS: MomentSignal[] = ['strong', 'neutral', 'weak'];
const SIGNAL_META: Record<MomentSignal, { label: string; color: string; icon: string }> = {
  strong:  { label: 'Strong', color: '#1FBE7A', icon: '▲' },
  neutral: { label: 'Neutral', color: '#0E0E0E', icon: '—' },
  weak:    { label: 'Weak', color: '#FF4A1C', icon: '▼' },
};
const MOMENT_TYPES: CampaignMoment['type'][] = ['single', 'collab', 'album', 'announcement', 'milestone', 'anchor'];

const MOMENT_ROLES: MomentRole[] = ['hero', 'support', 'repackage', 'push'];
const MOMENT_ROLE_META: Record<MomentRole, { label: string; color: string; icon: string; desc: string }> = {
  hero:      { label: 'Hero',      color: '#FF4A1C', icon: '◆', desc: 'Official video / anchor content' },
  support:   { label: 'Support',   color: '#2C25FF', icon: '◇', desc: 'Lyric video, BTS, live session' },
  repackage: { label: 'Repackage', color: '#FFD24C', icon: '↻', desc: 'Remix, visualiser, reaction edit' },
  push:      { label: 'Push',      color: '#1FBE7A', icon: '▶', desc: 'Shorts, community posts, engagement' },
};

// Default content template for a new track
function makeDefaultTrackItems(trackName: string): TrackContentItem[] {
  let _tid = 0;
  const tid = () => `tc-${Date.now()}-${++_tid}`;
  return [
    { id: tid(), label: 'Official Video', role: 'hero', contentType: 'video', done: false },
    { id: tid(), label: 'Lyric / Visualiser', role: 'support', contentType: 'video', done: false },
    { id: tid(), label: 'Behind the Scenes', role: 'support', contentType: 'short', done: false },
    { id: tid(), label: 'Teaser Short #1', role: 'push', contentType: 'short', done: false },
    { id: tid(), label: 'Teaser Short #2', role: 'push', contentType: 'short', done: false },
    { id: tid(), label: 'Community Post', role: 'push', contentType: 'post', done: false },
  ];
}

// Default drop plan for an anchor moment — 3 before + 2 after pattern
function makeDefaultDropPlan(moment: CampaignMoment): DropPlan {
  let _sid = 0;
  const sid = () => `ds-${moment.weekNum}-${Date.now()}-${++_sid}`;
  const isAlbum = moment.type === 'album';
  return {
    dropId: `drop-${moment.weekNum}`,
    momentWeek: moment.weekNum,
    momentName: moment.name,
    momentDate: moment.date,
    slots: isAlbum ? [
      { id: sid(), label: 'Countdown Short #1', contentType: 'short', timing: 'before', daysOffset: 7, done: false },
      { id: sid(), label: 'Countdown Short #2', contentType: 'short', timing: 'before', daysOffset: 5, done: false },
      { id: sid(), label: 'Countdown Short #3', contentType: 'short', timing: 'before', daysOffset: 3, done: false },
      { id: sid(), label: 'Pre-save Push', contentType: 'post', timing: 'before', daysOffset: 2, done: false },
      { id: sid(), label: 'Final Teaser', contentType: 'short', timing: 'before', daysOffset: 1, done: false },
      { id: sid(), label: 'Release Day Recap', contentType: 'short', timing: 'after', daysOffset: 1, done: false },
      { id: sid(), label: 'Fan Reactions', contentType: 'short', timing: 'after', daysOffset: 3, done: false },
      { id: sid(), label: 'Deep Dive / Breakdown', contentType: 'video', timing: 'after', daysOffset: 5, done: false },
    ] : [
      { id: sid(), label: 'Teaser Short #1', contentType: 'short', timing: 'before', daysOffset: 5, done: false },
      { id: sid(), label: 'Teaser Short #2', contentType: 'short', timing: 'before', daysOffset: 3, done: false },
      { id: sid(), label: 'Behind the Scenes', contentType: 'short', timing: 'before', daysOffset: 1, done: false },
      { id: sid(), label: 'Reaction / Clip', contentType: 'short', timing: 'after', daysOffset: 2, done: false },
      { id: sid(), label: 'Community Post', contentType: 'post', timing: 'after', daysOffset: 3, done: false },
    ],
  };
}

// ── SUPPORT PLAN TEMPLATE ────────────────────────────────────────────────────
// Structured filming checklist — every video becomes a content engine

const SUPPORT_STATUS_CYCLE: SupportStatus[] = ['not_recorded', 'recorded', 'posted'];
const SUPPORT_STATUS_META: Record<SupportStatus, { label: string; short: string; color: string; bg: string; icon: string }> = {
  not_recorded: { label: 'Not Recorded', short: 'NR',  color: '#0E0E0E', bg: 'rgba(14,14,14,0.04)',    icon: '○' },
  recorded:     { label: 'Recorded',     short: 'REC', color: '#FFD24C', bg: 'rgba(255,210,76,0.08)', icon: '◑' },
  posted:       { label: 'Posted',       short: 'UP',  color: '#1FBE7A', bg: 'rgba(31,190,122,0.08)', icon: '●' },
};

const SUPPORT_PHASE_META: Record<SupportPhase, { label: string; color: string }> = {
  pre:  { label: 'PRE DROP',  color: '#2C25FF' },
  drop: { label: 'DROP DAY',  color: '#FF4A1C' },
  post: { label: 'POST DROP', color: '#1FBE7A' },
};

function makeSupportPlan(moment: CampaignMoment): SupportPlan {
  let _n = 0;
  const sid = () => `sp-${moment.weekNum}-${Date.now()}-${++_n}`;
  const hasFeature = moment.type === 'collab';
  const isAlbum = moment.type === 'album';

  const items: SupportItem[] = [
    // PRE DROP — build anticipation, give the team a shot list
    { id: sid(), label: 'Hook Short',       contentType: 'short', phase: 'pre',  status: 'not_recorded' },
    { id: sid(), label: 'Artist Face Clip', contentType: 'short', phase: 'pre',  status: 'not_recorded' },
    { id: sid(), label: 'Tease Frame',      contentType: 'short', phase: 'pre',  status: 'not_recorded' },

    // DROP DAY — maximise first 24h
    { id: sid(), label: 'Drop Clip v1',     contentType: 'short', phase: 'drop', status: 'not_recorded' },
    { id: sid(), label: 'Drop Clip v2',     contentType: 'short', phase: 'drop', status: 'not_recorded' },
    { id: sid(), label: 'Caption Variants', contentType: 'post',  phase: 'drop', status: 'not_recorded' },

    // POST DROP — sustain and extend
    { id: sid(), label: 'Reaction Clip',    contentType: 'short', phase: 'post', status: 'not_recorded' },
    { id: sid(), label: 'Breakdown Clip',   contentType: 'short', phase: 'post', status: 'not_recorded' },
    { id: sid(), label: 'Performance Clip', contentType: 'short', phase: 'post', status: 'not_recorded' },
  ];

  // Collab feature → add collab clip
  if (hasFeature) {
    items.push({ id: sid(), label: 'Collab Clip', contentType: 'short', phase: 'post', status: 'not_recorded' });
  }

  // Always add trend version at the end
  items.push({ id: sid(), label: 'Trend Version', contentType: 'short', phase: 'post', status: 'not_recorded' });

  // Album gets extra PRE items
  if (isAlbum) {
    items.splice(3, 0,
      { id: sid(), label: 'Countdown Short',  contentType: 'short', phase: 'pre',  status: 'not_recorded' },
      { id: sid(), label: 'Pre-save Push',    contentType: 'post',  phase: 'pre',  status: 'not_recorded' },
    );
    items.push(
      { id: sid(), label: 'Fan Reactions',     contentType: 'short', phase: 'post', status: 'not_recorded' },
      { id: sid(), label: 'Deep Dive',         contentType: 'video', phase: 'post', status: 'not_recorded' },
    );
  }

  return {
    planId: `support-${moment.weekNum}`,
    momentWeek: moment.weekNum,
    momentName: moment.name,
    momentDate: moment.date,
    hasFeature,
    items,
  };
}

function getContentStatus(items: TrackContentItem[]): ContentStatus {
  if (items.length === 0) return 'underbuilt';
  const doneCount = items.filter((i) => i.done).length;
  const total = items.length;
  if (doneCount === total) return 'ready';
  if (doneCount >= Math.ceil(total * 0.4)) return 'building';
  return 'underbuilt';
}

const CONTENT_STATUS_META: Record<ContentStatus, { label: string; color: string }> = {
  underbuilt: { label: 'Underbuilt', color: '#FF4A1C' },
  building:   { label: 'Building',   color: '#FFD24C' },
  ready:      { label: 'Ready',      color: '#1FBE7A' },
};

const LS_KEY = 'pih-campaign-coach-v4';

// ═══════════════════════════════════════════════════════════════════════════════
// CAMPAIGN NARRATIVE — story context for each phase and key moment
// ═══════════════════════════════════════════════════════════════════════════════

const PHASE_NARRATIVE: Record<PhaseName, { goal: string; role: string; summary: string }> = {
  'BUILD':   { goal: 'Build pre-release momentum',       role: 'Warming the algorithm with Shorts + Posts before the first drop',  summary: 'Build pre-release momentum — warm the channel.' },
  'RELEASE': { goal: 'Launch and land the release',       role: 'First drops enter the feed — hero content + multi-format support', summary: 'Launch singles + videos — land the release.' },
  'SCALE':   { goal: 'Expand reach via tour + festivals', role: 'Tour content, festival recaps, and live moments drive reach',      summary: 'Scale through tours, festivals, and expansion.' },
  'EXTEND':  { goal: 'Keep the catalogue alive',          role: 'Long-tail content keeps the release in conversation',              summary: 'Extend the campaign — keep the story alive.' },
};

type CampaignMoment = {
  weekNum: number;
  date: string;              // ISO date string e.g. '2026-04-03'
  name: string;
  type: 'single' | 'collab' | 'album' | 'announcement' | 'milestone' | 'anchor';
  isAnchor?: boolean;        // true for key campaign-defining moments
  why: string;
  prepNote: string;
};

const CAMPAIGN_MOMENTS: CampaignMoment[] = [];

// ═══════════════════════════════════════════════════════════════════════════════
// NARRATIVE HELPERS — context for "why this week matters"
// ═══════════════════════════════════════════════════════════════════════════════

function getWeekNarrative(week: CampaignWeek, phase: CampaignPhase | undefined): { momentName: string | null; weekGoal: string; campaignRole: string } {
  const moment = CAMPAIGN_MOMENTS.find((m) => m.weekNum === week.week);
  if (moment) {
    return { momentName: moment.name, weekGoal: moment.why, campaignRole: `This is a key moment in ${phase?.name || 'the campaign'}. ${moment.why}.` };
  }

  // Non-moment weeks still serve the phase
  if (!phase) return { momentName: null, weekGoal: 'Keep the campaign moving', campaignRole: 'Maintain activity' };
  const narrative = PHASE_NARRATIVE[phase.name];

  // Check if next moment is coming
  const nextMoment = CAMPAIGN_MOMENTS.find((m) => m.weekNum > week.week);
  if (nextMoment && nextMoment.weekNum - week.week <= 2) {
    return { momentName: null, weekGoal: `Warm up for ${nextMoment.name}`, campaignRole: `${nextMoment.prepNote}. ${narrative.role}.` };
  }

  return { momentName: null, weekGoal: narrative.goal, campaignRole: narrative.role };
}

function getInactionRisk(status: WeekStatus, week: CampaignWeek, phase: CampaignPhase | undefined, tier: ChannelTier): { risk: string; urgency: 'critical' | 'warning' | 'low' } {
  const nextMoment = CAMPAIGN_MOMENTS.find((m) => m.weekNum > week.week);
  const weeksToNext = nextMoment ? nextMoment.weekNum - week.week : 99;
  const missed = week.actions.filter((a) => a.status === 'missed').length;

  // Critical: moment imminent + channel not ready
  if (weeksToNext <= 2 && status !== 'hot') {
    return { risk: `${nextMoment!.name} is ${weeksToNext === 1 ? 'next week' : 'in 2 weeks'} and channel is ${status}. ${nextMoment!.name} will underperform.`, urgency: 'critical' };
  }
  if (phase?.name === 'RELEASE' && status === 'cold') {
    return { risk: 'Channel is cold during the release phase. Drop will not land.', urgency: 'critical' };
  }
  if (status === 'cooling' && missed >= 2) {
    return { risk: `${missed} missed uploads this week. Every day of silence makes recovery harder — audience forgets.`, urgency: 'critical' };
  }
  if (status === 'cooling') {
    return { risk: `Channel heat is dropping. Without uploads in the next ${tier === 'small' ? '2–3' : '3–4'} days, momentum resets to cold.`, urgency: 'warning' };
  }
  if (status === 'cold') {
    return { risk: 'Channel is invisible to the algorithm. New uploads will get minimal distribution until consistency returns.', urgency: 'warning' };
  }
  if (status === 'warm' && weeksToNext <= 4) {
    return { risk: `Need to reach hot before ${nextMoment?.name || 'next moment'}. Warm is not enough for a drop to perform.`, urgency: 'warning' };
  }
  return { risk: '', urgency: 'low' };
}

function getToWinThisWeek(week: CampaignWeek, status: WeekStatus, tier: ChannelTier): string[] {
  const wins: string[] = [];
  const planned = week.actions.filter((a) => a.status === 'planned');
  const missed = week.actions.filter((a) => a.status === 'missed');
  const s2 = planned.filter((a) => a.system === 2);
  const videos = planned.filter((a) => a.type === 'video');
  const shorts = planned.filter((a) => a.type === 'short');

  if (missed.length > 0) wins.push(`Recover ${missed.length} missed action${missed.length > 1 ? 's' : ''} — post today`);
  if (s2.length > 0) wins.push(`Land the anchor: ${s2[0].title}`);
  else if (videos.length > 0) wins.push(`Drop the video: ${videos[0].title}`);
  if (shorts.length > 0 && status !== 'hot') wins.push(`Post ${Math.min(shorts.length, 3)}+ Shorts to warm the algorithm`);
  if (status === 'warm') wins.push('Push into hot — one more strong week');
  if (status === 'hot' && planned.length > 0) wins.push(`Execute all ${planned.length} remaining actions — don\'t break rhythm`);
  if (wins.length === 0 && planned.length > 0) wins.push(`Complete ${planned.length} planned action${planned.length > 1 ? 's' : ''}`);
  if (wins.length === 0) wins.push('Maintain cadence — stay visible');

  return wins.slice(0, 3);
}

function getNextMomentBridge(activeWeek: CampaignWeek, nextMoment: { week: CampaignWeek; idx: number; reason: string } | null): { prepAction: string; why: string } | null {
  if (!nextMoment) return null;
  const moment = CAMPAIGN_MOMENTS.find((m) => m.weekNum === nextMoment.week.week);
  if (!moment) return { prepAction: `Start preparing content for Week ${nextMoment.week.week}`, why: `${nextMoment.reason} is coming up` };
  const weeksAway = nextMoment.week.week - activeWeek.week;
  if (weeksAway <= 0) return null;
  return { prepAction: moment.prepNote, why: `${moment.name} in ${weeksAway} week${weeksAway > 1 ? 's' : ''} — ${moment.why}` };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const PHASE_COLORS: Record<PhaseName, string> = {
  BUILD: '#2C25FF', RELEASE: '#1FBE7A', SCALE: '#FF4A1C', EXTEND: '#FFD3C9',
};

/**
 * Derive CampaignPhase[] from a plan's week labels. If weeks have labels
 * (set by enrichPlanWeeks), use those. Otherwise fall back to CAMPAIGN_PHASES.
 * This ensures the UI renders the correct phases for plans of any length.
 */
function getPlanPhases(plan: CampaignPlan): CampaignPhase[] {
  const hasLabels = plan.weeks.some((w) => w.label);
  if (!hasLabels) return CAMPAIGN_PHASES;

  const phaseOrder: PhaseName[] = ['BUILD', 'RELEASE', 'SCALE', 'EXTEND'];
  const phases: CampaignPhase[] = [];

  for (const name of phaseOrder) {
    const weeksInPhase = plan.weeks.filter((w) => w.label === name);
    if (weeksInPhase.length === 0) continue;
    phases.push({
      name,
      weekStart: weeksInPhase[0].week,
      weekEnd: weeksInPhase[weeksInPhase.length - 1].week,
      color: PHASE_COLORS[name],
    });
  }

  // If no phases were derived (e.g. labels missing), fall back
  return phases.length > 0 ? phases : CAMPAIGN_PHASES;
}

function getPhaseForWeek(weekNum: number, plan?: CampaignPlan): CampaignPhase | undefined {
  // If the plan has week labels (set by enrichPlanWeeks), use those for
  // dynamic plans that go beyond the default 24-week ranges.
  if (plan && plan.weeks) {
    const w = plan.weeks.find((wk) => wk.week === weekNum);
    if (w?.label) {
      const name = w.label as PhaseName;
      // Build a synthetic CampaignPhase from the label
      const color = PHASE_COLORS[name] ?? '#FFD3C9';
      // Find the contiguous range of this phase
      const samePhase = plan.weeks.filter((wk) => wk.label === name);
      const weekStart = samePhase[0]?.week ?? weekNum;
      const weekEnd = samePhase[samePhase.length - 1]?.week ?? weekNum;
      return { name, weekStart, weekEnd, color };
    }
  }
  return CAMPAIGN_PHASES.find((p) => weekNum >= p.weekStart && weekNum <= p.weekEnd);
}

function getTier(subs: number): ChannelTier {
  if (subs >= 100000) return 'large';
  if (subs >= 10000) return 'mid';
  return 'small';
}

function formatSubs(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return n.toLocaleString();
}

const TIER_LABELS: Record<ChannelTier, string> = { small: 'SMALL', mid: 'MID', large: 'LARGE' };

function tierExpectedDone(tier: ChannelTier): number {
  return tier === 'small' ? 4 : tier === 'mid' ? 3 : 2;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPERATURE LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

function calcWeekStatus(week: CampaignWeek, tier: ChannelTier, prevStatus?: WeekStatus): WeekStatus {
  const done = week.actions.filter((a) => a.status === 'done').length;
  const missed = week.actions.filter((a) => a.status === 'missed').length;
  const fb = week.feedback || {};
  const hasFeedback = (fb.subsGained && fb.subsGained > 0) || (fb.comments && fb.comments > 0) || (fb.views && fb.views > 0);
  const expected = tierExpectedDone(tier);

  if (done >= expected && hasFeedback) return 'hot';
  if ((prevStatus === 'hot' || prevStatus === 'warm') && (missed > 0 || done < Math.max(2, expected - 1))) return 'cooling';
  if (done >= 2) return 'warm';
  return 'cold';
}

function getWeekStatuses(weeks: CampaignWeek[], tier: ChannelTier): WeekStatus[] {
  const s: WeekStatus[] = [];
  for (let i = 0; i < weeks.length; i++) {
    s.push(calcWeekStatus(weeks[i], tier, i > 0 ? s[i - 1] : undefined));
  }
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERPRETATION ENGINE (used in collapsible details only)
// ═══════════════════════════════════════════════════════════════════════════════

function getWeekMeaning(week: CampaignWeek, status: WeekStatus, tier: ChannelTier, prev?: WeekStatus): string {
  const done = week.actions.filter((a) => a.status === 'done').length;
  const missed = week.actions.filter((a) => a.status === 'missed').length;
  const fb = week.feedback || {};
  const hasVideo = week.actions.some((a) => a.type === 'video' && a.status === 'done');

  if (status === 'hot') {
    if (hasVideo && fb.comments && fb.comments > 100) return 'Strong execution — video plus active comments pushed channel into peak condition.';
    if (fb.subsGained && fb.subsGained > 200) return 'Channel firing. Sub growth confirms audience is locked in.';
    return 'Peak condition. Consistent output and response — don\'t break cadence.';
  }
  if (status === 'cooling') {
    if (missed >= 2) return 'Momentum broken — multiple missed uploads this week.';
    if (prev === 'hot') return 'Dropped the ball after a strong week. Momentum bleeding out.';
    return 'No consistent activity — channel heat is dying.';
  }
  if (status === 'warm') {
    if (fb.comments && fb.comments > 20) return 'Engagement returning — audience responding. Push harder.';
    if (done >= 3) return 'Good execution. Channel warming — one more strong week to break through.';
    return 'Steady activity building momentum. Not enough to coast.';
  }
  if (week.actions.length === 0) return 'Nothing planned. Channel is invisible.';
  if (missed > 0) return 'Planned content missed — audience not re-engaged yet.';
  return 'Not enough activity to move the needle.';
}

function getFeedbackTag(key: string, value: number | undefined): string | null {
  if (!value || value === 0) return null;
  if (key === 'subsGained') return value > 200 ? 'Audience surging' : value > 50 ? 'Audience building' : 'Audience trickling in';
  if (key === 'views') return value > 30000 ? 'Distribution strong' : value > 10000 ? 'Distribution improving' : 'Views building';
  if (key === 'comments') return value > 100 ? 'Engagement strong' : value > 20 ? 'Engagement strengthening' : 'Early engagement';
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERDICT
// ═══════════════════════════════════════════════════════════════════════════════

function getVerdict(statuses: WeekStatus[], weeks: CampaignWeek[]): { headline: string; summary: string; color: string } {
  let latestIdx = -1;
  for (let i = statuses.length - 1; i >= 0; i--) {
    if (weeks[i].actions.some((a) => a.status === 'done' || a.status === 'missed')) { latestIdx = i; break; }
  }
  if (latestIdx === -1) return { headline: 'CAMPAIGN NOT STARTED', summary: 'No actions completed. Start executing Week 1 now.', color: '#71717a' };

  const current = statuses[latestIdx];
  const phase = getPhaseForWeek(weeks[latestIdx].week);
  const phaseName = phase ? phase.name : '';

  if (current === 'hot') {
    if (phaseName === 'RELEASE') return { headline: 'DROP WINDOW OPEN', summary: 'Channel is hot during release window. Execute now.', color: '#fb7185' };
    return { headline: 'CHANNEL IS HOT', summary: 'Audience engaged, momentum strong. Keep building.', color: '#fb7185' };
  }
  if (current === 'cooling') return { headline: 'MOMENTUM SLIPPING', summary: 'Resume uploads before this stalls completely.', color: '#f97316' };
  if (current === 'warm') return { headline: 'ALMOST THERE', summary: 'One more strong week to reach peak condition.', color: '#fbbf24' };
  return { headline: 'CHANNEL IS COLD', summary: 'Audience is not warmed up. Increase cadence now.', color: '#818cf8' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRIMARY ACTION — ONE clear instruction per week
// ═══════════════════════════════════════════════════════════════════════════════

function getPrimaryAction(week: CampaignWeek, status: WeekStatus, tier: ChannelTier): string {
  const missed = week.actions.filter((a) => a.status === 'missed');
  const planned = week.actions.filter((a) => a.status === 'planned');
  const done = week.actions.filter((a) => a.status === 'done');
  const s2Planned = planned.filter((a) => a.system === 2);
  const videoPlanned = planned.filter((a) => a.type === 'video');
  const total = week.actions.length;

  // All done
  if (total > 0 && done.length === total) return 'All actions complete — maintain rhythm';

  // Missed recovery takes priority
  if (missed.length >= 2) return 'Recover missed cadence — post today';
  if (missed.length === 1) return `Recover: ${missed[0].title}`;

  // S2 drop upcoming
  if (s2Planned.length > 0) return `Prepare for: ${s2Planned[0].title}`;

  // Video ready
  if (videoPlanned.length > 0 && status !== 'cold') return `Drop the video: ${videoPlanned[0].title}`;

  // Status-based
  if (status === 'cold') {
    if (tier === 'small') return 'Post 3–4 Shorts this week';
    return 'Increase posting frequency';
  }
  if (status === 'cooling') return 'Resume uploads — don\'t let it stall';
  if (status === 'warm') {
    if (videoPlanned.length > 0) return `Drop the video this week`;
    return 'Increase Shorts to 4+ this week';
  }
  if (status === 'hot') {
    if (planned.length > 0) return `Execute remaining ${planned.length} actions`;
    return 'Don\'t break rhythm';
  }

  // Fallback — next planned action
  if (planned.length > 0) return `Next: ${planned[0].title}`;
  return 'Plan content for this week';
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE-AWARE COACH ENGINE — max 2 tips per week, short & action-focused
// ═══════════════════════════════════════════════════════════════════════════════

function generateCoachTips(weeks: CampaignWeek[], statuses: WeekStatus[]): CoachTip[] {
  const allTips: CoachTip[] = [];

  for (let i = 0; i < weeks.length; i++) {
    const w = weeks[i];
    const phase = getPhaseForWeek(w.week);
    if (!phase) continue;
    const phaseName = phase.name;
    const status = statuses[i];
    const done = w.actions.filter((a) => a.status === 'done').length;
    const missed = w.actions.filter((a) => a.status === 'missed').length;
    const planned = w.actions.filter((a) => a.status === 'planned').length;
    const shorts = w.actions.filter((a) => a.type === 'short');
    const videos = w.actions.filter((a) => a.type === 'video');
    const s2Actions = w.actions.filter((a) => a.system === 2);
    const collabs = w.actions.filter((a) => a.featuredArtist);

    // Collect candidates for this week, then take top 2
    const weekTips: CoachTip[] = [];

    // Upcoming S2 drops
    const upcomingS2 = s2Actions.filter((a) => a.status === 'planned');
    if (upcomingS2.length > 0) {
      weekTips.push({ week: w.week, message: `Warm up before "${upcomingS2[0].title}" drops`, priority: 'high' });
    }

    // Collab without cross-content
    if (collabs.length > 0) {
      const collabDone = collabs.filter((a) => a.status === 'done');
      const hasShortAboutCollab = shorts.some((a) =>
        a.title.toLowerCase().includes('collab') ||
        a.title.toLowerCase().includes('feat') ||
        collabs.some((c) => c.featuredArtist && a.title.toLowerCase().includes(c.featuredArtist.toLowerCase()))
      );
      if (collabDone.length > 0 && !hasShortAboutCollab) {
        weekTips.push({ week: w.week, message: `Post a Short riding the ${collabDone[0].featuredArtist} collab`, priority: 'high' });
      }
    }

    // Missed actions
    if (missed >= 2) {
      weekTips.push({ week: w.week, message: 'Recover missed uploads now', priority: 'high' });
    }

    // Shorts / long-form balance
    const shortsDone = shorts.filter((a) => a.status === 'done').length;
    const videosDone = videos.filter((a) => a.status === 'done').length;
    if (videosDone > 0 && shortsDone === 0) {
      weekTips.push({ week: w.week, message: 'Add Shorts to feed the algorithm between videos', priority: 'medium' });
    }
    if (shortsDone >= 3 && videosDone === 0 && phaseName !== 'BUILD') {
      weekTips.push({ week: w.week, message: 'Balance with a video — Shorts warm up, videos convert', priority: 'medium' });
    }

    // Phase-specific
    if (phaseName === 'BUILD' && planned > 0 && done === 0 && missed === 0) {
      weekTips.push({ week: w.week, message: 'Post something today — break the silence', priority: 'high' });
    }
    if (phaseName === 'RELEASE' && videos.length === 0 && w.week > 5) {
      weekTips.push({ week: w.week, message: 'Plan a video — Release phase needs hero content', priority: 'medium' });
    }
    if (phaseName === 'SCALE' && (status === 'cold' || status === 'cooling')) {
      weekTips.push({ week: w.week, message: 'Increase posting frequency', priority: 'high' });
    }
    if (phaseName === 'SCALE' && s2Actions.length === 0) {
      weekTips.push({ week: w.week, message: 'Add an anchor moment (S2 action)', priority: 'medium' });
    }
    if (phaseName === 'RELEASE') {
      const s2Planned = s2Actions.filter((a) => a.status === 'planned');
      if (s2Planned.length > 0 && status !== 'hot') {
        weekTips.push({ week: w.week, message: 'Warm up NOW — drop will underperform on a cold channel', priority: 'high' });
      }
      if (done >= 3 && status === 'hot') {
        weekTips.push({ week: w.week, message: 'Execute every planned action — this is the window', priority: 'high' });
      }
    }
    if (phaseName === 'EXTEND' && planned === 0 && done === 0) {
      weekTips.push({ week: w.week, message: 'Post reaction content — keep the conversation alive', priority: 'medium' });
    }

    // Sort by priority, take top 2
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    weekTips.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    const top2 = weekTips.slice(0, 2);
    for (const t of top2) { allTips.push(t); }
  }

  return allTips;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED THIS WEEK (coach view only)
// ═══════════════════════════════════════════════════════════════════════════════

function getActiveWeekIdx(weeks: CampaignWeek[]): number {
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].actions.some((a) => a.status !== 'planned')) return i;
  }
  return 0;
}

function getRequiredThisWeek(weeks: CampaignWeek[], statuses: WeekStatus[], tier: ChannelTier): string {
  let latestIdx = -1;
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].actions.some((a) => a.status === 'done' || a.status === 'missed')) { latestIdx = i; break; }
  }
  if (latestIdx === -1) return 'Execute all Week 1 actions — no exceptions';

  const status = statuses[latestIdx];
  const w = weeks[latestIdx];
  const missed = w.actions.filter((a) => a.status === 'missed');
  const planned = w.actions.filter((a) => a.status === 'planned');

  if (status === 'cooling' && missed.length > 0) {
    const missedShorts = missed.filter((a) => a.type === 'short').length;
    if (missedShorts > 0) return `Post ${missedShorts + 1} Shorts before Friday or momentum dies`;
    return 'Resume cadence now — every missed day makes recovery harder';
  }
  if (status === 'warm') {
    if (tier === 'small') return 'Post 2–3 Shorts this week to push into hot zone';
    const hasVideoPlanned = planned.some((a) => a.type === 'video');
    if (hasVideoPlanned) return 'Drop the video this week — channel is ready for it';
    return 'Add a video or increase Short cadence to break through';
  }
  if (status === 'cold') {
    if (tier === 'small') return 'Post 3–4 Shorts this week — channel is invisible without them';
    return 'Upload consistently — minimum 2–3 pieces this week';
  }
  if (status === 'hot') {
    if (planned.length > 0) return `Maintain cadence — execute remaining ${planned.length} planned actions`;
    return 'Don\'t break rhythm — channel is in the zone';
  }
  if (planned.length > 0) {
    const next = planned[0];
    return `Complete: ${ACTION_LABELS[next.type]} — ${next.title}`;
  }
  return 'All planned actions completed — sustain activity';
}

function getThisWeekTracking(weeks: CampaignWeek[]): {
  status: 'on_track' | 'behind' | 'off_track' | 'not_started';
  done: number; total: number; missed: number; planned: number; message: string;
} {
  const idx = getActiveWeekIdx(weeks);
  const w = weeks[idx];
  const done = w.actions.filter((a) => a.status === 'done').length;
  const missed = w.actions.filter((a) => a.status === 'missed').length;
  const planned = w.actions.filter((a) => a.status === 'planned').length;
  const total = w.actions.length;

  if (total === 0) return { status: 'not_started', done: 0, total: 0, missed: 0, planned: 0, message: 'No actions planned this week.' };
  const allPlanned = w.actions.every((a) => a.status === 'planned');
  if (allPlanned) return { status: 'not_started', done, total, missed, planned, message: 'Week not started. Begin executing.' };

  const rate = done / total;
  if (rate >= 0.7) return { status: 'on_track', done, total, missed, planned, message: `${done}/${total} complete. On pace.` };
  if (rate >= 0.4) {
    const remaining = total - done - missed;
    return { status: 'behind', done, total, missed, planned, message: `${remaining > 0 ? `${remaining} more needed to stay on track` : 'Complete remaining actions today'}.` };
  }
  if (missed > 0) return { status: 'off_track', done, total, missed, planned, message: `${missed} missed, only ${done} done. Recover now.` };
  return { status: 'off_track', done, total, missed, planned, message: `Only ${done}/${total} done. Pick up the pace.` };
}

function getConsequenceProjection(status: WeekStatus, weeks: CampaignWeek[], activeIdx: number, tier: ChannelTier): string | null {
  const w = weeks[activeIdx];
  const planned = w.actions.filter((a) => a.status === 'planned').length;
  const missed = w.actions.filter((a) => a.status === 'missed').length;

  if (status === 'hot') {
    if (missed > 0) return 'If uploads stop → channel drops to Warm within days';
    return null;
  }
  if (status === 'warm') {
    if (planned > 0) return `If remaining ${planned} action${planned > 1 ? 's are' : ' is'} missed → stays Warm`;
    return 'If no uploads in 3 days → channel cools down';
  }
  if (status === 'cooling') return `If no activity in ${tier === 'small' ? '3' : '4'} days → returns to Cold`;
  if (status === 'cold') return 'Every day without uploads makes reactivation harder';
  return null;
}

function getAdaptiveRecommendation(weeks: CampaignWeek[], activeIdx: number): string | null {
  if (activeIdx < 1) return null;
  const prevWeek = weeks[activeIdx - 1];
  const prevMissed = prevWeek.actions.filter((a) => a.status === 'missed');
  if (prevMissed.length === 0) return null;
  const prevMissedShorts = prevMissed.filter((a) => a.type === 'short').length;
  if (prevMissedShorts >= 2) return `Missed ${prevMissedShorts} Shorts last week — post ${Math.min(prevMissedShorts + 2, 5)} this week`;
  if (prevMissed.length >= 2) return `${prevMissed.length} missed last week — increase output`;
  return `Missed ${ACTION_LABELS[prevMissed[0].type]} last week — prioritise it early`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEXT MAJOR MOMENT — find the next upcoming week or S2 drop
// ═══════════════════════════════════════════════════════════════════════════════

function getNextMajorMoment(weeks: CampaignWeek[], activeIdx: number): { week: CampaignWeek; idx: number; reason: string } | null {
  // Look forward from activeIdx
  for (let i = activeIdx + 1; i < weeks.length; i++) {
    const w = weeks[i];
    const s2 = w.actions.filter((a) => a.system === 2 && a.status === 'planned');
    const collab = w.actions.find((a) => a.featuredArtist && a.status === 'planned');
    if (s2.length > 0) return { week: w, idx: i, reason: s2[0].title };
    if (collab) return { week: w, idx: i, reason: `${collab.title}` };
  }
  // Fallback: next week with planned actions
  for (let i = activeIdx + 1; i < weeks.length; i++) {
    if (weeks[i].actions.some((a) => a.status === 'planned')) {
      return { week: weeks[i], idx: i, reason: weeks[i].label || `Week ${weeks[i].week}` };
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEED DATA — Artist Campaign: Campaign (Spring–Summer 2026)
// ═══════════════════════════════════════════════════════════════════════════════

let _id = 0;
function uid(): string { return `a-${++_id}`; }

// ── DATE & ANCHOR HELPERS ────────────────────────────────────────────────────

const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SHORT_DAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

/** Format ISO date → "Jun 12, 2026" */
function fmtDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Format ISO date → "WED" */
function fmtDay(iso: string): DayLabel {
  const d = new Date(iso + 'T12:00:00');
  return SHORT_DAYS[d.getDay()] as DayLabel;
}

/** Compute campaign week number from a date and the campaign start date */
function dateToWeek(iso: string, startDate: string): number {
  const d = new Date(iso + 'T12:00:00');
  const s = new Date(startDate + 'T12:00:00');
  const diff = Math.floor((d.getTime() - s.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, diff + 1);
}

/** Get the date for a given campaign week + day offset (0=Mon) */
function weekToDate(weekNum: number, startDate: string, dayOffset: number = 0): string {
  const s = new Date(startDate + 'T12:00:00');
  const d = new Date(s.getTime() + ((weekNum - 1) * 7 + dayOffset) * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/** Get anchor moments only */
function getAnchors(): CampaignMoment[] {
  return CAMPAIGN_MOMENTS.filter((m) => m.isAnchor);
}

/** Find nearest anchor to a given date, returns { anchor, daysDelta, label } */
function nearestAnchor(iso: string): { anchor: CampaignMoment; days: number; label: string } | null {
  const anchors = getAnchors();
  if (anchors.length === 0) return null;
  const d = new Date(iso + 'T12:00:00').getTime();
  let best: CampaignMoment | null = null;
  let bestDist = Infinity;
  for (const a of anchors) {
    const ad = new Date(a.date + 'T12:00:00').getTime();
    const dist = Math.abs(ad - d);
    if (dist < bestDist) { best = a; bestDist = dist; }
  }
  if (!best) return null;
  const ad = new Date(best.date + 'T12:00:00').getTime();
  const days = Math.round((d - ad) / (24 * 60 * 60 * 1000));
  const absD = Math.abs(days);
  const label = days === 0
    ? `Anchor: Same day as ${best.name}`
    : days > 0
    ? `Anchor: ${absD} days after ${best.name}`
    : `Anchor: ${absD} days before ${best.name}`;
  return { anchor: best, days, label };
}

function act(
  title: string, type: ActionType, day: DayLabel, system: ActionSystem,
  intent: ActionIntent, status: ActionStatus = 'planned',
  featuredArtist?: string, notes?: string,
): CampaignAction {
  return { id: uid(), title, type, day, status, system, intent, featuredArtist, notes };
}

function makeSeedData(): CampaignPlan {
  // Demo: K Trap — Album Campaign. Start date is set dynamically so
  // "today" always falls in week 9 (the active week with mixed done/planned).
  // Campaign start is the real anchor for this artist's campaign window.
  // Defaults to 2026-03-22 for the K-Trap demo; users can override it in the
  // campaign header. All live drop gating + rollups flow from this date.
  const startDate = '2026-03-22';
  const base = new Date(startDate + 'T12:00:00');
  const fmt = (d: Date) => `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;
  const weekDate = (w: number, day: number) => {
    const d = new Date(base); d.setDate(d.getDate() + (w - 1) * 7 + day);
    return d.toISOString().split('T')[0];
  };

  let _id = 0;
  const aid = () => `demo-${++_id}`;

  const makeAction = (
    title: string, type: ActionType, day: DayLabel, status: ActionStatus,
    system: ActionSystem, intent: ActionIntent, opts?: Partial<CampaignAction>,
  ): CampaignAction => ({
    id: aid(), title, type, day, status, system, intent,
    momentRole: opts?.momentRole, featuredArtist: opts?.featuredArtist,
    date: opts?.date, notes: opts?.notes, metrics: opts?.metrics,
  });

  const weeks: CampaignWeek[] = [];
  for (let i = 0; i < 24; i++) {
    const ws = new Date(base); ws.setDate(ws.getDate() + i * 7);
    const we = new Date(ws); we.setDate(we.getDate() + 6);
    weeks.push({ week: i + 1, dateRange: `${fmt(ws)} – ${fmt(we)}`, actions: [], feedback: {} });
  }

  // ── REAWAKEN (W1-3): Shorts + posts to warm the channel ──
  weeks[0].actions = [
    makeAction('Return Short — "I\'m back"', 'short', 'MON', 'done', 1, 'engage', { date: weekDate(1, 0), metrics: { views: 12400, comments: 340, signal: 'strong' } }),
    makeAction('Studio Clip — new era', 'short', 'WED', 'done', 1, 'tease', { date: weekDate(1, 2), metrics: { views: 8700, comments: 180, signal: 'strong' } }),
    makeAction('Community Post — what you want to hear', 'post', 'FRI', 'done', 1, 'engage', { date: weekDate(1, 4) }),
  ];
  weeks[0].feedback = { subsGained: 320, views: 21100, comments: 520, engagementNote: 'Strong return — algorithm picked up both shorts' };

  weeks[1].actions = [
    makeAction('Snippet Teaser #1', 'short', 'MON', 'done', 1, 'tease', { date: weekDate(2, 0), metrics: { views: 15600, comments: 420, signal: 'strong' } }),
    makeAction('Freestyle Clip', 'short', 'THU', 'done', 1, 'engage', { date: weekDate(2, 3), metrics: { views: 22300, comments: 610, signal: 'strong' } }),
    makeAction('Poll — album title vote', 'post', 'SAT', 'done', 1, 'engage', { date: weekDate(2, 5) }),
  ];
  weeks[1].feedback = { subsGained: 580, views: 37900, comments: 1030, engagementNote: 'Freestyle clip went semi-viral — 22K views' };

  weeks[2].actions = [
    makeAction('Behind the Scenes — studio', 'short', 'TUE', 'done', 1, 'tease', { date: weekDate(3, 1), metrics: { views: 9800, comments: 210, signal: 'neutral' } }),
    makeAction('Snippet Teaser #2', 'short', 'FRI', 'done', 1, 'tease', { date: weekDate(3, 4), metrics: { views: 18200, comments: 490, signal: 'strong' } }),
    makeAction('Community — single announcement', 'post', 'SUN', 'done', 1, 'convert', { date: weekDate(3, 6) }),
  ];
  weeks[2].feedback = { subsGained: 410, views: 28000, comments: 700, engagementNote: 'Good build — single announcement post got strong saves' };

  // ── BUILD THE WORLD (W4-8): First drops + collabs ──
  weeks[3].actions = [
    makeAction('"No Sleep" Official Video', 'video', 'FRI', 'done', 2, 'convert', { date: weekDate(4, 4), momentRole: 'hero', metrics: { views: 145000, comments: 3200, subsGained: 1800, signal: 'strong' } }),
    makeAction('Teaser Short — No Sleep hook', 'short', 'WED', 'done', 1, 'tease', { date: weekDate(4, 2), metrics: { views: 31000, comments: 870, signal: 'strong' } }),
    makeAction('Reaction Clip', 'short', 'SAT', 'done', 1, 'engage', { date: weekDate(4, 5) }),
  ];
  weeks[3].feedback = { subsGained: 1800, views: 176000, comments: 4070, engagementNote: '"No Sleep" video landed hard — 145K first week' };

  weeks[4].actions = [
    makeAction('Lyric Video — No Sleep', 'video', 'MON', 'done', 2, 'distribute', { date: weekDate(5, 0), momentRole: 'support', metrics: { views: 42000, comments: 680, signal: 'neutral' } }),
    makeAction('Fan Reaction Short', 'short', 'WED', 'done', 1, 'engage', { date: weekDate(5, 2), metrics: { views: 19400, comments: 510, signal: 'strong' } }),
    makeAction('Remix Teaser', 'short', 'FRI', 'done', 1, 'tease', { date: weekDate(5, 4) }),
    makeAction('Community Post — BTS video shoot', 'post', 'SAT', 'done', 1, 'engage', { date: weekDate(5, 5) }),
  ];
  weeks[4].feedback = { subsGained: 920, views: 61400, comments: 1190, engagementNote: 'Lyric video extended the moment — fan reaction short drove saves' };

  weeks[5].actions = [
    makeAction('"Dungeons" ft. Unknown T', 'video', 'FRI', 'done', 2, 'convert', { date: weekDate(6, 4), momentRole: 'hero', featuredArtist: 'Unknown T', metrics: { views: 210000, comments: 5100, subsGained: 2400, signal: 'strong' } }),
    makeAction('Collab Announcement Short', 'short', 'TUE', 'done', 1, 'tease', { date: weekDate(6, 1), metrics: { views: 44000, comments: 1200, signal: 'strong' } }),
    makeAction('Unknown T Clip', 'short', 'SAT', 'done', 1, 'engage', { date: weekDate(6, 5), featuredArtist: 'Unknown T' }),
  ];
  weeks[5].feedback = { subsGained: 2400, views: 254000, comments: 6300, engagementNote: 'Collab smashed — Unknown T crossover brought new audience' };

  weeks[6].actions = [
    makeAction('BTS — Dungeons Shoot', 'short', 'MON', 'done', 1, 'engage', { date: weekDate(7, 0), metrics: { views: 16700, comments: 380, signal: 'neutral' } }),
    makeAction('Performance Clip — Dungeons', 'short', 'THU', 'done', 1, 'engage', { date: weekDate(7, 3) }),
    makeAction('Community Post — album tracklist tease', 'post', 'FRI', 'done', 1, 'tease', { date: weekDate(7, 4) }),
  ];
  weeks[6].feedback = { subsGained: 650, views: 16700, comments: 380, engagementNote: 'Sustaining post-collab — tracklist tease drove speculation' };

  weeks[7].actions = [
    makeAction('Album Announcement Video', 'video', 'WED', 'done', 2, 'convert', { date: weekDate(8, 2), momentRole: 'hero', metrics: { views: 89000, comments: 2800, subsGained: 1100, signal: 'strong' } }),
    makeAction('Countdown Short #1', 'short', 'MON', 'done', 1, 'tease', { date: weekDate(8, 0) }),
    makeAction('Pre-save Push', 'post', 'THU', 'done', 1, 'convert', { date: weekDate(8, 3) }),
  ];
  weeks[7].feedback = { subsGained: 1100, views: 89000, comments: 2800, engagementNote: 'Album announcement landed — strong pre-save conversion' };

  // ── SCALE THE STORY (W9-13): Current phase — expand reach ──
  // Week 9 = current week — mix of done (early in week) and planned (later this week)
  weeks[8].actions = [
    makeAction('"Dungeons" Remix Visualiser', 'video', 'MON', 'done', 2, 'distribute', { date: weekDate(9, 0), momentRole: 'repackage', metrics: { views: 34000, comments: 720, signal: 'neutral' } }),
    makeAction('Snippet — Track 5 Preview', 'short', 'TUE', 'done', 1, 'tease', { date: weekDate(9, 1), metrics: { views: 11200, comments: 290, signal: 'neutral' } }),
    makeAction('Studio Vibes Short', 'short', 'WED', 'done', 1, 'engage', { date: weekDate(9, 2), metrics: { views: 8400, comments: 180, signal: 'neutral' } }),
    makeAction('Community Post — vinyl pre-order', 'post', 'WED', 'done', 1, 'convert', { date: weekDate(9, 2) }),
    makeAction('Third Single Teaser', 'short', 'FRI', 'planned', 1, 'tease', { date: weekDate(9, 4) }),
    makeAction('Album Tracklist Reaction', 'short', 'SAT', 'planned', 1, 'engage', { date: weekDate(9, 5) }),
  ];
  weeks[8].feedback = { subsGained: 380, views: 53600, comments: 1190, engagementNote: 'Remix visualiser landed — snippets driving anticipation' };

  // W10-13: Planned future content
  weeks[9].actions = [
    makeAction('"Third Single" Official Video', 'video', 'FRI', 'planned', 2, 'convert', { date: weekDate(10, 4), momentRole: 'hero' }),
    makeAction('Teaser Short — Third Single', 'short', 'WED', 'planned', 1, 'tease', { date: weekDate(10, 2) }),
    makeAction('Countdown Short #2', 'short', 'MON', 'planned', 1, 'tease', { date: weekDate(10, 0) }),
  ];

  weeks[10].actions = [
    makeAction('Lyric Video — Third Single', 'video', 'MON', 'planned', 2, 'distribute', { date: weekDate(11, 0), momentRole: 'support' }),
    makeAction('Fan Challenge Short', 'short', 'WED', 'planned', 1, 'engage', { date: weekDate(11, 2) }),
    makeAction('Live Q&A — Album Preview', 'live', 'SAT', 'planned', 1, 'engage', { date: weekDate(11, 5) }),
  ];

  weeks[11].actions = [
    makeAction('Collab Short — Central Cee', 'short', 'TUE', 'planned', 1, 'engage', { date: weekDate(12, 1), featuredArtist: 'Central Cee' }),
    makeAction('Final Pre-save Push', 'post', 'THU', 'planned', 1, 'convert', { date: weekDate(12, 3) }),
    makeAction('Album Trailer', 'video', 'FRI', 'planned', 2, 'tease', { date: weekDate(12, 4), momentRole: 'hero' }),
  ];

  weeks[12].actions = [
    makeAction('Final Countdown Short', 'short', 'MON', 'planned', 1, 'tease', { date: weekDate(13, 0) }),
    makeAction('Tracklist Reveal Post', 'post', 'WED', 'planned', 1, 'convert', { date: weekDate(13, 2) }),
    makeAction('Album Listening Party Announcement', 'post', 'FRI', 'planned', 1, 'engage', { date: weekDate(13, 4) }),
  ];

  // ── CULTURAL MOMENT (W14-22): Album release window ──
  weeks[13].actions = [
    makeAction('ALBUM DROP — Full Album Out', 'video', 'FRI', 'planned', 2, 'convert', { date: weekDate(14, 4), momentRole: 'hero' }),
    makeAction('Drop Day Recap Short', 'short', 'FRI', 'planned', 1, 'engage', { date: weekDate(14, 4) }),
    makeAction('Listening Party Live', 'live', 'FRI', 'planned', 1, 'engage', { date: weekDate(14, 4) }),
  ];

  weeks[14].actions = [
    makeAction('Track-by-Track Breakdown', 'video', 'MON', 'planned', 2, 'distribute', { date: weekDate(15, 0), momentRole: 'support' }),
    makeAction('Fan Reactions Compilation', 'short', 'WED', 'planned', 1, 'engage', { date: weekDate(15, 2) }),
    makeAction('Highlight Clip — best bars', 'short', 'FRI', 'planned', 1, 'engage', { date: weekDate(15, 4) }),
  ];

  weeks[15].actions = [
    makeAction('Music Video — Album Focus Track', 'video', 'FRI', 'planned', 2, 'convert', { date: weekDate(16, 4), momentRole: 'hero' }),
    makeAction('Performance Short', 'short', 'WED', 'planned', 1, 'engage', { date: weekDate(16, 2) }),
  ];

  // ── EXTEND (W23-24): Keep the conversation going ──
  weeks[22].actions = [
    makeAction('Deluxe Teaser', 'short', 'MON', 'planned', 1, 'tease', { date: weekDate(23, 0) }),
    makeAction('Tour Announcement', 'post', 'FRI', 'planned', 1, 'convert', { date: weekDate(23, 4) }),
  ];

  weeks[23].actions = [
    makeAction('Tour Dates Video', 'video', 'WED', 'planned', 2, 'convert', { date: weekDate(24, 2), momentRole: 'hero' }),
    makeAction('Thank You Post', 'post', 'FRI', 'planned', 1, 'engage', { date: weekDate(24, 4) }),
  ];

  return {
    artist: 'K Trap',
    campaignName: 'Album - Trapo 2',
    subscriberCount: 285000,
    startDate,
    weeks,
    targets: {
      subsTarget: 500000,
      viewsTarget: 5000000,
      shortsPerWeek: 3,
      videosPerWeek: 1,
      postsPerWeek: 2,
      communityPerWeek: 2,
    },
    manualOverrides: {
      currentSubs: 294200,
      totalViews: 718100,
    },
    moments: [
      { weekNum: 4, date: weekDate(4, 4), name: '"No Sleep" — Lead Single', type: 'single', isAnchor: true, why: 'First signal of the campaign — re-establish K Trap as active', prepNote: 'Teaser shorts W3, BTS content ready' },
      { weekNum: 6, date: weekDate(6, 4), name: '"Dungeons" ft. Unknown T', type: 'collab', isAnchor: true, why: 'Crossover moment — tap Unknown T audience', prepNote: 'Collab announcement short, joint content planned' },
      { weekNum: 8, date: weekDate(8, 2), name: 'Album Announcement', type: 'announcement', isAnchor: true, why: 'Lock in pre-saves, build anticipation', prepNote: 'Countdown shorts, pre-save push ready' },
      { weekNum: 10, date: weekDate(10, 4), name: 'Third Single', type: 'single', isAnchor: true, why: 'Final single before album — maintain trajectory', prepNote: 'Teaser + countdown content' },
      { weekNum: 14, date: weekDate(14, 4), name: 'Album Drop — Trapo 2', type: 'album', isAnchor: true, why: 'The main event — maximise first 48 hours', prepNote: 'All content assets lined up, listening party confirmed' },
    ],
    isExample: true,
  };
}

// ──── EMPTY CAMPAIGN ─────────────────────────────────────────────────────────
// Blank starting state for user-created campaigns. Same 24-week skeleton
// as the seed, but with no artist, no actions, and no reference moments.
function makeEmptyPlan(): CampaignPlan {
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  const startDate = base.toISOString().split('T')[0];
  const fmt = (d: Date) => `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;

  const weeks: CampaignWeek[] = [];
  for (let i = 0; i < 24; i++) {
    const ws = new Date(base); ws.setDate(ws.getDate() + i * 7);
    const we = new Date(ws); we.setDate(we.getDate() + 6);
    weeks.push({ week: i + 1, dateRange: `${fmt(ws)} – ${fmt(we)}`, actions: [], feedback: {} });
  }

  // Enrich with baseline content — no moments yet, so all weeks get
  // catalogue-mode content (studio sessions, Q&A, lifestyle etc.)
  return enrichPlanWeeks({
    artist: '',
    campaignName: '',
    subscriberCount: 0,
    startDate,
    weeks,
    targets: {
      subsTarget: 0,
      viewsTarget: 0,
      shortsPerWeek: 3,
      videosPerWeek: 1,
      postsPerWeek: 2,
      communityPerWeek: 2,
    },
    isExample: false,
  });
}


/** Recalculate week dateRange values from a new start date, preserving actions & feedback */
function recalcWeekDates(weeks: CampaignWeek[], startIso: string): CampaignWeek[] {
  const base = new Date(startIso + 'T12:00:00');
  const fmt = (d: Date) => `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;
  return weeks.map((w, i) => {
    const weekStart = new Date(base);
    weekStart.setDate(weekStart.getDate() + i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return { ...w, dateRange: `${fmt(weekStart)} – ${fmt(weekEnd)}` };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIMELINE AUTO-IMPORT — paste a release timeline, get a full YouTube plan
// ═══════════════════════════════════════════════════════════════════════════════

type TimelineKind =
  | 'singleRelease'
  | 'albumRelease'
  | 'albumAnnounce'
  | 'documentaryTease'
  | 'documentaryRelease'
  | 'podcast'
  | 'snippet'
  | 'tourAnnounce'
  | 'tourDate'
  | 'festival'
  | 'liveShow'
  | 'promoTrip'
  | 'other';

type ParsedTimelineEvent = {
  dateISO: string;
  title: string;
  kind: TimelineKind;
  featuredArtist?: string;
};

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};

/**
 * Parse a single timeline line into a dated event.
 *
 * Handles real-world formats:
 *  - "25 March – title"           → exact day
 *  - "17th May – title"           → exact day (ordinals)
 *  - "1 or 3 July – title"       → first day
 *  - "w/c 18 May – title"        → week-commencing day
 *  - "12–22 Mar – title"         → first day of range
 *  - "4–6 Jul – title"           → first day of range
 *  - "31 Jul – 2 Aug – title"    → first day of range
 *  - "Apr – title"               → month only → 15th
 *  - "September – title"         → month only → 15th
 *  - "September/October – title" → first month → 15th
 *  - "Jun–Aug 2027 – title"      → first month → 15th, year detected
 *  - "Jan 2027 – title"          → month + explicit year
 *  - "19 Nov–11 Dec – title"     → first day
 */
function parseTimelineLine(raw: string, fallbackYear: number): ParsedTimelineEvent | null {
  const line = raw.trim().replace(/^[-•*\u2022]\s*/, '');
  if (!line) return null;

  let day: number | null = null;
  let month: number | undefined;
  let year = fallbackYear;
  let consumed = 0; // characters consumed from the line for the date portion

  // Helper: look for an explicit 4-digit year anywhere on the line
  const yearMatch = line.match(/\b(20\d{2})\b/);
  if (yearMatch) year = parseInt(yearMatch[1], 10);

  // ── Pattern 1: "DD Mon – DD Mon" cross-month range (e.g. "31 Jul – 2 Aug", "19 Nov–11 Dec") ──
  const crossMonthRe = /^(?:w\/c\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s*[-–—]\s*\d{1,2}(?:st|nd|rd|th)?\s+([A-Za-z]+)/;
  const mc = line.match(crossMonthRe);
  if (mc) {
    const d = parseInt(mc[1], 10);
    const mo = MONTH_MAP[mc[2].toLowerCase()];
    if (mo != null && d >= 1 && d <= 31) {
      day = d;
      month = mo;
      consumed = mc[0].length;
    }
  }

  // ── Pattern 2: "DD Month" / "DDth Month" / "DD–DD Month" / "w/c DD Month" ──
  if (month == null) {
    const dayFirstRe = /^(?:w\/c\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:\s*(?:[-–—]|or)\s*\d{1,2}(?:st|nd|rd|th)?)?\s+([A-Za-z]+)/;
    const m1 = line.match(dayFirstRe);
    if (m1) {
      const d = parseInt(m1[1], 10);
      const mo = MONTH_MAP[m1[2].toLowerCase()];
      if (mo != null && d >= 1 && d <= 31) {
        day = d;
        month = mo;
        consumed = m1[0].length;
      }
    }
  }

  // ── Pattern 3: "Mon–Mon YYYY" season ranges like "Jun–Aug 2027" ──
  if (month == null) {
    const seasonRe = /^([A-Za-z]+)\s*[-–—]\s*([A-Za-z]+)(?:\s+(20\d{2}))?/;
    const m3 = line.match(seasonRe);
    if (m3) {
      const mo1 = MONTH_MAP[m3[1].toLowerCase()];
      const mo2 = MONTH_MAP[m3[2].toLowerCase()];
      if (mo1 != null && mo2 != null) {
        // Both parts are months — this is a season range
        month = mo1;
        day = 15;
        if (m3[3]) year = parseInt(m3[3], 10);
        consumed = m3[0].length;
      }
    }
  }

  // ── Pattern 4: "Month – title" / "Month YYYY – title" / "Month/Month – title" ──
  if (month == null) {
    const monthFirstRe = /^([A-Za-z]+)(?:\s*\/\s*[A-Za-z]+)?(?:\s+(20\d{2}))?/;
    const m2 = line.match(monthFirstRe);
    if (m2) {
      const mo = MONTH_MAP[m2[1].toLowerCase()];
      if (mo != null) {
        month = mo;
        day = 15; // mid-month fallback for month-only dates
        if (m2[2]) year = parseInt(m2[2], 10);
        consumed = m2[0].length;
      }
    }
  }

  if (month == null || day == null) return null;

  const dt = new Date(Date.UTC(year, month, day, 12, 0, 0));
  const dateISO = dt.toISOString().split('T')[0];

  // ── Extract title: everything after the date portion + separator ──
  // Strip the consumed date prefix, then remove the first dash/en-dash separator
  let rest = line.slice(consumed);
  // Remove any trailing date bits (e.g. extra year, time like "@ 7.30pm")
  rest = rest.replace(/^\s*(?:20\d{2})?\s*/, '');
  // Remove the separator between date and title
  rest = rest.replace(/^\s*[-–—]+\s*/, '').trim();
  // If rest still looks like it starts with a separator after time info
  rest = rest.replace(/^[@\d.:apm\s]*[-–—]+\s*/i, '').trim();
  const title = rest || line;

  // Skip lines that are just dates with no meaningful title
  if (!title || title.length < 3) return null;

  const kind = classifyTimelineEvent(title);
  const featuredArtist = extractFeature(title);
  return { dateISO, title, kind, featuredArtist };
}

function extractFeature(title: string): string | undefined {
  const m = title.match(/\b(?:with|ft\.?|feat\.?|featuring)\s+([A-Z][A-Za-z0-9 '\-]+?)(?:\s+(?:\+|and|$)|$|\s*[.,])/);
  return m ? m[1].trim() : undefined;
}

function classifyTimelineEvent(title: string): TimelineKind {
  const t = title.toLowerCase();
  if (/\bpodcast|interview\b/.test(t)) return 'podcast';
  if (/\bsnippet|sound\b/.test(t)) return 'snippet';
  if (/\btour\b/.test(t) && /\b(announce|tickets?|on\s*sale|pre-?\s*sale|pre-?\s*order)\b/.test(t)) return 'tourAnnounce';
  if (/\bfestival\b/.test(t)) return 'festival';
  if (/\bfest\b/.test(t) && !/\bfestiv/.test(t)) return 'festival'; // "Kendal Calling" won't match but explicit "fest" will
  if (/\b(trnsmt|glastonbury|reading|leeds|latitude|parklife|wireless|primavera|coachella|bonnaroo|lollapalooza|shaky\s*knees|kendal\s*calling|y\s*not|rockin'?\s*on|sonic)\b/.test(t)) return 'festival';
  if (/\btour\b/.test(t) && /\b(start|leg|date|kick\s*off|night|show|gig)\b/.test(t)) return 'tourDate';
  if (/\btour\b/.test(t) && !/\b(announce|tickets?|on\s*sale|release)\b/.test(t)) return 'tourDate';
  if (/\b(support\s*shows?|headline\s*shows?|live\s*show|gig|concert|instore|outstore|signing|fanzone|activation|performances?)\b/.test(t)) return 'liveShow';
  if (/\b(promo\s*trip|press\s*trip|radio\s*promo|promo\s*(run|dates?|visit))\b/.test(t)) return 'promoTrip';
  // "flies to [destination]" — only if going somewhere notable (not just flying home)
  if (/\bflies?\s*to\b/.test(t) && /\b(usa|us|america|japan|europe|australia|nyc|la|berlin|paris|tokyo)\b/i.test(t)) return 'promoTrip';
  if (/\bdocumentary\b.*\b(tease|teaser|trailer)\b/.test(t) || (/\bdocumentary\b/.test(t) && /\btease\b/.test(t))) return 'documentaryTease';
  if (/\bdocumentary\b.*\brelease|release\b.*\bdocumentary|documentary.*youtube/.test(t) || /\bdocumentary\b/.test(t)) return 'documentaryRelease';
  if (/\bdeluxe\b.*\b(album|release)\b/.test(t)) return 'albumRelease';
  if (/\balbum\b.*\b(announc|reveal)\b/.test(t) || /\b(announc|reveal)\b.*\balbum\b/.test(t)) return 'albumAnnounce';
  if (/\balbum\b.*\b(release|out|drop)\b|\b(release|drop)\b.*\balbum\b/.test(t)) return 'albumRelease';
  if (/\bsingle\b.*\b(release|out|drop)\b|\b(release|drop)\b.*\bsingle\b|\bsingle\s*#?\d\b/.test(t)) return 'singleRelease';
  if (/\b(official\s*music\s*video|official\s*video|visualis|visualiz)\b/.test(t)) return 'singleRelease';
  if (/\brelease\b/.test(t)) return 'singleRelease';
  if (/\bannounce\b/.test(t)) return 'snippet'; // bare announce without album/single context = tease moment
  if (/\b(outdoor|headline)\b.*\bshow/.test(t)) return 'liveShow';
  if (/\b(uk|eu|europe|usa|us|japan|australia)\b.*\b(dates?|shows?|run)\b/.test(t)) return 'tourDate';
  if (/\b(promo|dates)\b/.test(t)) return 'other';
  return 'other';
}

function parseTimelineText(text: string, fallbackYear: number): ParsedTimelineEvent[] {
  const lines = text.split(/\r?\n/);
  const events: ParsedTimelineEvent[] = [];

  // First pass: parse all lines. Lines with explicit years (e.g. "Jan 2027")
  // are handled by parseTimelineLine. For lines without explicit years, we
  // track the last-seen month so we can detect year-wrap (e.g. after Dec
  // the next Jan is the following year).
  let lastMonth = -1;
  let currentYear = fallbackYear;

  for (const line of lines) {
    // Check if this line explicitly mentions a year
    const explicitYear = line.match(/\b(20\d{2})\b/);
    if (explicitYear) {
      currentYear = parseInt(explicitYear[1], 10);
    }

    const ev = parseTimelineLine(line, currentYear);
    if (!ev) continue;

    // Detect year-wrap: if month decreased without an explicit year, bump year
    const evMonth = new Date(ev.dateISO + 'T12:00:00').getUTCMonth();
    if (!explicitYear && lastMonth >= 9 && evMonth <= 2 && lastMonth > evMonth) {
      currentYear++;
      // Re-parse with corrected year
      const corrected = parseTimelineLine(line, currentYear);
      if (corrected) {
        events.push(corrected);
        lastMonth = new Date(corrected.dateISO + 'T12:00:00').getUTCMonth();
        continue;
      }
    }

    lastMonth = evMonth;
    events.push(ev);
  }

  return events.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
}

/** Convert a date offset to a (weekIndex, dayLabel) pair relative to plan start. */
function dateToWeekDay(startIso: string, targetIso: string): { weekIdx: number; day: DayLabel } | null {
  const start = new Date(startIso + 'T12:00:00').getTime();
  const target = new Date(targetIso + 'T12:00:00').getTime();
  const diffDays = Math.round((target - start) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return null;
  const weekIdx = Math.floor(diffDays / 7);
  const dayOfWeek = new Date(targetIso + 'T12:00:00').getUTCDay(); // 0=Sun..6=Sat
  const DAYS: DayLabel[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return { weekIdx, day: DAYS[dayOfWeek] };
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function titleCore(title: string): string {
  // Extract a short reference like "'Change'" or first quoted phrase or first noun group.
  const q = title.match(/['\u2018\u2019"\u201c\u201d]([^'\u2018\u2019"\u201c\u201d]+)['\u2018\u2019"\u201c\u201d]/);
  if (q) return `'${q[1]}'`;
  const m = title.replace(/^\s*(Single \d+|Single|Album)\s*[-:–]\s*/i, '').split(/[-–—,]/)[0].trim();
  return m || title;
}

/** Build a set of CampaignActions for one parsed event. */
function actionsForEvent(ev: ParsedTimelineEvent, startIso: string): Array<{ dateISO: string; action: CampaignAction }> {
  const out: Array<{ dateISO: string; action: CampaignAction }> = [];
  const ref = titleCore(ev.title);
  const addA = (offset: number, title: string, type: ActionType, intent: ActionIntent, system: ActionSystem = 1, momentRole?: MomentRole) => {
    const dateISO = addDaysIso(ev.dateISO, offset);
    const wd = dateToWeekDay(startIso, dateISO);
    if (!wd) return;
    const a = act(title, type, wd.day, system, intent, 'planned', ev.featuredArtist);
    a.date = dateISO;
    if (momentRole) a.momentRole = momentRole;
    out.push({ dateISO, action: a });
  };

  switch (ev.kind) {
    case 'singleRelease':
      addA(-3, `Teaser Short — ${ref}`, 'short', 'tease');
      addA(-1, `Snippet Short — ${ref}`, 'short', 'tease');
      addA(0, `${ref} — Official Music Video`, 'video', 'convert', 2, 'hero');
      addA(0, `Community Post — ${ref} out now`, 'post', 'convert');
      addA(+1, `BTS Short — making of ${ref}`, 'short', 'engage');
      addA(+3, `Reaction Short — fan responses to ${ref}`, 'short', 'engage');
      addA(+5, `Performance Short — ${ref} live`, 'short', 'engage');
      addA(+7, `${ref} — Lyric Video`, 'video', 'distribute', 2, 'support');
      break;
    case 'albumAnnounce':
      addA(-2, `Teaser Short — album incoming`, 'short', 'tease');
      addA(0, `Album Announcement Video`, 'video', 'tease', 2, 'hero');
      addA(0, `Community Post — album announce + pre-save`, 'post', 'convert');
      addA(+3, `Tracklist Tease Short`, 'short', 'tease');
      break;
    case 'albumRelease':
      addA(-5, `Album Trailer`, 'video', 'tease', 2, 'hero');
      addA(-3, `BTS Short — making of the album`, 'short', 'tease');
      addA(-1, `Final Countdown Short`, 'short', 'tease');
      addA(0, `ALBUM DROP — Full Album Out`, 'video', 'convert', 2, 'hero');
      addA(0, `Community Post — album out now + link`, 'post', 'convert');
      addA(+1, `Drop Day Recap Short`, 'short', 'engage');
      addA(+2, `Track-by-Track Breakdown`, 'video', 'distribute', 2, 'support');
      addA(+4, `Fan Reactions Short`, 'short', 'engage');
      addA(+5, `Lyric Video — lead single`, 'video', 'distribute', 2, 'support');
      addA(+7, `Highlight Bars Short`, 'short', 'engage');
      addA(+10, `Live Performance Short — album track`, 'short', 'engage');
      break;
    case 'documentaryTease':
      addA(0, `Documentary Teaser Short`, 'short', 'tease');
      addA(0, `Community Post — documentary coming`, 'post', 'tease');
      break;
    case 'documentaryRelease':
      addA(-1, `Documentary Trailer Short`, 'short', 'tease');
      addA(0, `Documentary — Full Release`, 'video', 'convert', 2, 'hero');
      addA(0, `Community Post — documentary out now`, 'post', 'convert');
      addA(+2, `Documentary Clip Short #1`, 'short', 'engage');
      addA(+5, `Documentary Clip Short #2`, 'short', 'engage');
      break;
    case 'podcast':
      addA(0, `Community Post — ${ref} podcast live`, 'post', 'engage');
      addA(+1, `Podcast Clip Short #1`, 'short', 'engage');
      addA(+2, `Podcast Clip Short #2`, 'short', 'engage');
      break;
    case 'snippet':
      addA(0, `Snippet Short — ${ref}`, 'short', 'tease');
      addA(0, `Community Post — new snippet`, 'post', 'tease');
      break;
    case 'tourAnnounce':
      addA(0, `Tour Announcement Video`, 'video', 'convert', 2, 'hero');
      addA(0, `Community Post — tour dates`, 'post', 'convert');
      addA(+1, `Tour Hype Short`, 'short', 'engage');
      break;
    case 'tourDate':
      addA(-1, `Tour Diary Short — getting ready for ${ref}`, 'short', 'engage');
      addA(0, `Community Post — ${ref} tonight`, 'post', 'engage');
      addA(+1, `Tour Recap Short — ${ref}`, 'short', 'engage');
      addA(+2, `Tour Diary Short — on the road`, 'short', 'engage');
      addA(+5, `Weekly Tour Recap — highlights`, 'video', 'engage', 2, 'support');
      break;
    case 'festival':
      addA(-2, `Festival Hype Short — ${ref} countdown`, 'short', 'tease');
      addA(-1, `Community Post — ${ref} set times + what to expect`, 'post', 'tease');
      addA(0, `Performance Clip Short — ${ref}`, 'short', 'engage');
      addA(+1, `Crowd Reaction Short — ${ref}`, 'short', 'engage');
      addA(+2, `Festival Recap Short — ${ref} highlights`, 'short', 'engage');
      addA(+4, `Festival Recap Video — ${ref}`, 'video', 'engage', 2, 'support');
      break;
    case 'liveShow':
      addA(0, `Community Post — ${ref}`, 'post', 'engage');
      addA(+1, `Live Show Recap Short — ${ref}`, 'short', 'engage');
      addA(+2, `Live Performance Clip Short — ${ref}`, 'short', 'engage');
      break;
    case 'promoTrip':
      addA(0, `Community Post — ${ref}`, 'post', 'engage');
      addA(+1, `Promo Vlog Short — ${ref}`, 'short', 'engage');
      addA(+2, `Cultural Moments Short — ${ref}`, 'short', 'engage');
      addA(+3, `Short-form Highlights — ${ref}`, 'short', 'engage');
      addA(+5, `Promo Trip Vlog — ${ref}`, 'video', 'engage', 2, 'support');
      break;
    default:
      addA(0, ev.title, 'post', 'engage');
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED PLAN ENRICHMENT — works on ANY CampaignPlan, not just timeline imports
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// YOUTUBE MOMENT GENERATOR — converts timeline events into planner cards
// ═══════════════════════════════════════════════════════════════════════════════

/** Support stack templates per moment type — concrete items, not commentary. */
const MOMENT_SUPPORT: Record<YouTubeMomentType, string[]> = {
  official_video:  ['Shorts ×3', 'Community Post', 'Lyric Video or Artwork Video', 'Follow-up Longform', 'Premiere setup'],
  lyric_video:     ['Shorts ×2–3', 'Community Post', 'Artwork Video if no visualiser', 'Follow-up clip'],
  visualizer:      ['Shorts ×2–3', 'Community Post', 'Live/performance cut if available'],
  album_announce:  ['Announcement trailer', 'Shorts ×3', 'Community Post', 'Pre-order / tour CTA content'],
  album_release:   ['Focus track video or trailer', 'Shorts ×3–5', 'Community Post', 'Follow-up longform', 'Listening / reaction / BTS asset'],
  deluxe_release:  ['Announcement Short', 'Shorts ×2', 'Community Post', 'New track focus video', 'Behind-the-scenes clip'],
  tour:            ['Travel Short', 'Backstage Short', 'Performance Short', 'Recap video', 'Community Post'],
  tour_announce:   ['Announcement video', 'Shorts ×2', 'Community Post', 'Tour CTA / ticket link'],
  festival:        ['Travel Short', 'Backstage Short', 'Performance clip', 'Crowd reaction Short', 'Recap video', 'Community Post'],
  promo_trip:      ['Vlog / travel clip', 'BTS Short', 'City / culture clip', 'Community Post', 'Promo trip recap'],
  activation:      ['Short-form teaser', 'Event-day clip', 'Recap clip', 'Community Post'],
  live_show:       ['Performance Short', 'Backstage Short', 'Community Post', 'Recap clip'],
  catalogue:       ['Catalogue Short', 'Community Post', 'Fan moment clip'],
};

/** Map a TimelineKind + title to a YouTubeMomentType, or null if it should be skipped. */
function classifyAsMomentType(kind: TimelineKind, title: string): { type: YouTubeMomentType; priority: 'high' | 'medium' | 'low' } | null {
  const t = title.toLowerCase();
  switch (kind) {
    case 'singleRelease': {
      if (/\blyric\b/.test(t)) return { type: 'lyric_video', priority: 'high' };
      if (/\bvisualis|visualiz/.test(t)) return { type: 'visualizer', priority: 'high' };
      return { type: 'official_video', priority: 'high' };
    }
    case 'albumRelease': {
      if (/\bdeluxe\b/.test(t)) return { type: 'deluxe_release', priority: 'high' };
      return { type: 'album_release', priority: 'high' };
    }
    case 'albumAnnounce':       return { type: 'album_announce', priority: 'high' };
    case 'tourAnnounce':        return { type: 'tour_announce', priority: 'high' };
    case 'tourDate':            return { type: 'tour', priority: 'medium' };
    case 'festival':            return { type: 'festival', priority: 'high' };
    case 'liveShow':            return { type: 'live_show', priority: 'medium' };
    case 'promoTrip':           return { type: 'promo_trip', priority: 'high' };
    case 'documentaryRelease':  return { type: 'official_video', priority: 'high' };
    case 'documentaryTease':    return { type: 'catalogue', priority: 'medium' };
    case 'podcast':             return { type: 'catalogue', priority: 'low' };
    case 'snippet':             return { type: 'catalogue', priority: 'low' };
    case 'other': {
      // Check if it has content potential
      if (/\b(usa|japan|australia|europe)\b/.test(t) && /\b(flies?\s*to|trip|dates?|promo)\b/.test(t)) return { type: 'promo_trip', priority: 'medium' };
      if (/\b(fanzone|activation|fan\s*event)\b/.test(t)) return { type: 'activation', priority: 'medium' };
      if (/\b(feature|bbc|itv|radio|tv)\b/.test(t)) return { type: 'catalogue', priority: 'low' };
      if (/\b(headline|outdoor)\b.*\bshow/.test(t)) return { type: 'live_show', priority: 'medium' };
      // Skip admin-only or vague items
      if (/\b(pre-?\s*order|7"\s*single|socials|rx)\b/i.test(t)) return null;
      return null;
    }
    default: return null;
  }
}

/** Build a headline explaining why a moment matters on YouTube. */
function momentHeadline(type: YouTubeMomentType, title: string): string {
  switch (type) {
    case 'official_video':  return 'Main release moment — needs core support to land properly';
    case 'lyric_video':     return 'Visual support asset — extends the release and catches search traffic';
    case 'visualizer':      return 'Visual alternative — catches mood-based listeners and playlist adds';
    case 'album_announce':  return 'Campaign anchor — establishes the release timeline and builds anticipation';
    case 'album_release':   return 'Peak release moment — maximum support, all formats, first 48hrs critical';
    case 'deluxe_release':  return 'Second-wave release — re-engages the audience with fresh album content';
    case 'tour':            return 'Live content window — daily shorts from the road build audience connection';
    case 'tour_announce':   return 'Tour launch — drives ticket sales and builds excitement for the live run';
    case 'festival':        return 'High-visibility moment — festival content reaches beyond core audience';
    case 'promo_trip':      return 'Travel and market-entry moment — vlog-style content adds human context';
    case 'activation':      return 'Cultural crossover moment — unique content opportunity';
    case 'live_show':       return 'Live performance window — capture energy for short-form content';
    case 'catalogue':       return 'Catalogue / filler moment — keeps the channel active between peaks';
  }
}

/** Build the "reason" string — why this specific item exists in the planner. */
function momentReason(type: YouTubeMomentType, title: string): string {
  switch (type) {
    case 'official_video':  return `"${title}" is a release marker and should anchor the YouTube campaign`;
    case 'lyric_video':     return `Lyric/visual version extends the release window and captures long-tail views`;
    case 'visualizer':      return `Visualiser provides an alternative entry point for the track`;
    case 'album_announce':  return `Album announcement sets the campaign timeline — everything builds from here`;
    case 'album_release':   return `Album release is the campaign peak — all content funnels toward this moment`;
    case 'deluxe_release':  return `Deluxe release re-activates the campaign cycle with new material`;
    case 'tour':            return `Live dates create daily content opportunities — tour diary, backstage, recaps`;
    case 'tour_announce':   return `Tour announcement drives ticket conversion and builds live-event anticipation`;
    case 'festival':        return `Festival slot reaches new audiences and generates high-energy short-form content`;
    case 'promo_trip':      return `Travel content adds personality and supports expansion into new markets`;
    case 'activation':      return `Activation creates unique content that stands out from regular release content`;
    case 'live_show':       return `Live show generates performance clips and fan-facing content`;
    case 'catalogue':       return `Keeps the channel active and maintains algorithm momentum between peaks`;
  }
}

let _ytMomentId = 0;

/**
 * Convert parsed timeline events into concrete YouTube planner moments.
 * Every important event gets a card. Low-value admin items are skipped.
 */
function buildYouTubeMoments(
  events: ParsedTimelineEvent[],
  startIso: string,
  weekCount: number,
  phases: PhaseSlot[],
): YouTubeMoment[] {
  const moments: YouTubeMoment[] = [];

  for (const ev of events) {
    const classification = classifyAsMomentType(ev.kind, ev.title);
    if (!classification) continue; // skip admin / no-content-value items

    const wd = dateToWeekDay(startIso, ev.dateISO);
    if (!wd || wd.weekIdx >= weekCount) continue;

    const weekNum = wd.weekIdx + 1;

    // Determine phase from week number
    const phaseSlot = phases.find((p) => weekNum >= p.weekStart && weekNum <= p.weekEnd);
    const phaseName: PhaseName = phaseSlot?.name ?? 'EXTEND';

    const support = [...MOMENT_SUPPORT[classification.type]];

    moments.push({
      id: `ytm-${++_ytMomentId}`,
      title: ev.title,
      date: ev.dateISO,
      phase: phaseName,
      momentType: classification.type,
      headline: momentHeadline(classification.type, ev.title),
      expectedSupport: support,
      status: 'planned', // all start as planned — live data will update this
      reason: momentReason(classification.type, ev.title),
      weekNum,
      priority: classification.priority,
    });
  }

  return moments.sort((a, b) => a.date.localeCompare(b.date));
}

type WeekContext = 'tour' | 'festival' | 'pre-release' | 'post-release' | 'catalogue';

// Content pools for each context — rotated through to avoid repetition
const CONTENT_POOLS: Record<WeekContext, string[][]> = {
  'tour': [
    ['Tour Diary Short — prep / travel', 'Tour Diary Short — soundcheck / crowd'],
    ['Tour Diary Short — backstage / band', 'Tour Diary Short — city life / explore'],
    ['Tour Recap Short — highlights', 'Community Post — on the road'],
    ['Tour Diary Short — fan moments', 'Tour Diary Short — merch / venue'],
  ],
  'festival': [
    ['Festival Prep Short — packing / setlist', 'Festival Hype Short — countdown'],
    ['Festival Diary Short — behind the scenes', 'Festival Short — crowd energy'],
    ['Festival Recap Short — highlights', 'Community Post — festival season'],
  ],
  'pre-release': [
    ['Teaser Short — studio session', 'Community Post — something coming'],
    ['Snippet Short — new music preview', 'Behind the Scenes Short — making of'],
    ['Countdown Short — release incoming', 'Community Post — pre-save reminder'],
  ],
  'post-release': [
    ['Reaction Short — fan responses', 'Community Post — thank you / milestones'],
    ['Behind the Scenes Short — how it was made', 'Acoustic/Alt Version Short'],
    ['Fan Cover Reaction Short', 'Community Post — streaming milestone'],
  ],
  'catalogue': [
    ['Catalogue Short — throwback clip', 'Community Post — Q&A / fan question'],
    ['Studio Session Short — works in progress', 'Community Post — playlist / recommendation'],
    ['Acoustic / Stripped Back Short', 'Community Post — behind the music'],
    ['Freestyle / Off-the-cuff Short', 'Community Post — story time / update'],
    ['Collab Tease Short — who should we work with?', 'Community Post — fan poll'],
    ['Lifestyle Short — day in the life', 'Community Post — what are you listening to?'],
  ],
};

/**
 * Infer WeekContext from a CampaignMoment. Works on any plan — not just
 * timeline imports — by reading moment type, name, and action titles.
 */
function inferMomentContext(m: CampaignMoment): WeekContext {
  const n = m.name.toLowerCase();
  if (/\btour\b/.test(n)) return 'tour';
  if (/\bfestival|fest\b/.test(n) || /\btrnsmt|glastonbury|reading|primavera|coachella|shaky\s*knees|kendal|lollapalooza\b/.test(n)) return 'festival';
  if (m.type === 'single' || m.type === 'album' || m.type === 'collab') return 'pre-release';
  if (m.type === 'announcement') return 'pre-release';
  if (/\b(live|show|gig|concert|headline|support|instore|signing)\b/.test(n)) return 'tour';
  return 'catalogue';
}

/**
 * Determine what kind of content an empty week should get, based on
 * proximity to moments. Works on any CampaignPlan.
 */
function inferWeekContext(weekIdx: number, moments: CampaignMoment[]): WeekContext {
  // Check proximity to moments (within 2 weeks)
  for (const m of moments) {
    const dist = weekIdx - (m.weekNum - 1);
    if (Math.abs(dist) <= 2) {
      const mctx = inferMomentContext(m);
      if (mctx === 'pre-release' && dist > 0) return 'post-release';
      return mctx;
    }
  }
  // Check if between tour/festival moments (within 6 weeks of each other)
  const liveEvents = moments.filter((m) => {
    const c = inferMomentContext(m);
    return c === 'tour' || c === 'festival';
  });
  for (let i = 0; i < liveEvents.length - 1; i++) {
    const a = liveEvents[i].weekNum - 1;
    const b = liveEvents[i + 1].weekNum - 1;
    if (weekIdx > a && weekIdx < b && b - a <= 6) return 'tour';
  }
  return 'catalogue';
}

type PhaseSlot = { name: PhaseName; weekStart: number; weekEnd: number; label: string };

/**
 * Event-driven phase assignment — 4 phases: BUILD / RELEASE / SCALE / EXTEND.
 *
 * BUILD  = everything before the first release (warming the channel)
 * RELEASE = around release moments (singles, album, collabs, announcements)
 * SCALE  = tours, festivals, promo trips, live expansion
 * EXTEND = post-campaign lifecycle (after last major event)
 *
 * If no moments exist, falls back to proportional split.
 */
function assignDynamicPhases(weekCount: number, moments: CampaignMoment[]): PhaseSlot[] {
  if (moments.length === 0 || weekCount === 0) {
    // No moments — proportional fallback
    const s = (pct: number) => Math.max(1, Math.round(weekCount * pct));
    const buildEnd = s(0.15);
    const releaseEnd = buildEnd + s(0.25);
    const scaleEnd = releaseEnd + s(0.40);
    return [
      { name: 'BUILD',   weekStart: 1,              weekEnd: buildEnd,    label: 'Pre-release momentum' },
      { name: 'RELEASE', weekStart: buildEnd + 1,    weekEnd: releaseEnd,  label: 'Launch window' },
      { name: 'SCALE',   weekStart: releaseEnd + 1,  weekEnd: scaleEnd,    label: 'Tour + festivals + expansion' },
      { name: 'EXTEND',  weekStart: scaleEnd + 1,    weekEnd: weekCount,   label: 'Post-campaign lifecycle' },
    ];
  }

  // Classify moments
  const RELEASE_TYPES = new Set(['single', 'album', 'collab', 'announcement', 'anchor']);
  const SCALE_TYPES = new Set(['milestone']); // tours, festivals, live shows
  const releases = moments.filter((m) => RELEASE_TYPES.has(m.type)).sort((a, b) => a.weekNum - b.weekNum);
  const scaleMoments = moments.filter((m) => SCALE_TYPES.has(m.type)).sort((a, b) => a.weekNum - b.weekNum);

  const firstRelease = releases[0]?.weekNum ?? Math.ceil(weekCount * 0.2);
  const lastRelease = releases[releases.length - 1]?.weekNum ?? firstRelease;
  const lastMajorEvent = Math.max(lastRelease, scaleMoments[scaleMoments.length - 1]?.weekNum ?? 0);

  // BUILD: everything before the first release (min 1 week)
  const buildEnd = Math.max(1, firstRelease - 1);

  // RELEASE: from first release through last release + 2 weeks buffer
  const releaseEnd = Math.min(weekCount, lastRelease + 2);

  // SCALE: from after release through last major event + 2 weeks
  const scaleStart = releaseEnd + 1;
  const scaleEnd = Math.min(weekCount, Math.max(scaleStart, lastMajorEvent + 2));

  // EXTEND: everything after SCALE
  const phases: PhaseSlot[] = [];
  if (buildEnd >= 1) {
    phases.push({ name: 'BUILD', weekStart: 1, weekEnd: buildEnd, label: 'Pre-release momentum' });
  }
  if (releaseEnd >= (buildEnd + 1)) {
    phases.push({ name: 'RELEASE', weekStart: buildEnd + 1, weekEnd: releaseEnd, label: 'Launch window' });
  }
  if (scaleEnd >= scaleStart && scaleStart <= weekCount) {
    phases.push({ name: 'SCALE', weekStart: scaleStart, weekEnd: scaleEnd, label: 'Tour + festivals + expansion' });
  }
  if (scaleEnd < weekCount) {
    phases.push({ name: 'EXTEND', weekStart: scaleEnd + 1, weekEnd: weekCount, label: 'Post-campaign lifecycle' });
  }

  // Ensure full coverage — fill gaps if any exist
  if (phases.length === 0) {
    return [{ name: 'BUILD', weekStart: 1, weekEnd: weekCount, label: 'Campaign' }];
  }
  // Make sure week 1 is covered
  if (phases[0].weekStart > 1) phases[0].weekStart = 1;
  // Make sure last week is covered
  if (phases[phases.length - 1].weekEnd < weekCount) phases[phases.length - 1].weekEnd = weekCount;

  return phases;
}

/**
 * Enrich any CampaignPlan with:
 *  1. Dynamic phase labels on every week
 *  2. Placeholder moments for empty phases
 *  3. Context-aware content suggestions for empty weeks
 *
 * Works on timeline-imported, manually-built, or seed plans.
 * Does NOT touch weeks that already have actions (user content is preserved).
 */
function enrichPlanWeeks(plan: CampaignPlan): CampaignPlan {
  const weeks = plan.weeks.map((w) => ({ ...w, actions: [...w.actions] }));
  const moments = [...(plan.moments ?? [])];
  const weekCount = weeks.length;
  if (weekCount === 0) return plan;

  const start = new Date((plan.startDate || weeks[0].dateRange.split('–')[0].trim()) + 'T12:00:00');

  // 1. Assign phases
  const phases = assignDynamicPhases(weekCount, moments);
  for (const ph of phases) {
    for (let w = ph.weekStart; w <= Math.min(ph.weekEnd, weekCount); w++) {
      weeks[w - 1].label = ph.name;
    }
  }

  // Phase-fill moments removed: phases without releases don't need
  // synthetic moments. The weekly cadence fills those weeks instead.
  moments.sort((a, b) => a.weekNum - b.weekNum);

  // 3. Fill empty weeks with context-aware content
  const contextCounters: Record<WeekContext, number> = {
    'tour': 0, 'festival': 0, 'pre-release': 0, 'post-release': 0, 'catalogue': 0,
  };

  for (const w of weeks) {
    if (w.actions.length > 0) continue;
    const ctx = inferWeekContext(w.week - 1, moments);
    const pool = CONTENT_POOLS[ctx];
    const idx = contextCounters[ctx] % pool.length;
    contextCounters[ctx]++;
    const [shortTitle, postTitle] = pool[idx];

    const base = new Date(start); base.setDate(base.getDate() + (w.week - 1) * 7);
    const monISO = addDaysIso(base.toISOString().split('T')[0], 1);
    const thuISO = addDaysIso(base.toISOString().split('T')[0], 4);

    const mon = act(shortTitle, 'short', 'MON', 1, 'engage', 'planned');
    mon.date = monISO;
    const thu = act(postTitle, postTitle.startsWith('Community') ? 'post' : 'short', 'THU', 1, 'engage', 'planned');
    thu.date = thuISO;
    w.actions.push(mon, thu);

    if (ctx === 'tour' || ctx === 'festival') {
      const wedISO = addDaysIso(base.toISOString().split('T')[0], 3);
      const wed = act(`${ctx === 'tour' ? 'Tour' : 'Festival'} Update Short`, 'short', 'WED', 1, 'engage', 'planned');
      wed.date = wedISO;
      w.actions.push(wed);
    }
  }

  return { ...plan, weeks, moments };
}

/**
 * Second-pass enrichment for timeline-imported plans only.
 * Uses ParsedTimelineEvent[] for finer-grained context (e.g. tourDate vs
 * liveShow) than moments alone can provide. Replaces generic gap content
 * with timeline-specific content where the timeline events give us better
 * context than the moment type alone.
 */
function enrichWithTimelineContext(
  weeks: CampaignWeek[],
  events: ParsedTimelineEvent[],
  startIso: string,
): void {
  if (events.length === 0) return;

  const eventWeeks = events.map((ev) => {
    const wd = dateToWeekDay(startIso, ev.dateISO);
    return { weekIdx: wd ? wd.weekIdx : -1, kind: ev.kind, title: ev.title };
  }).filter((e) => e.weekIdx >= 0);

  function timelineContext(weekIdx: number): WeekContext | null {
    for (const ev of eventWeeks) {
      const dist = weekIdx - ev.weekIdx;
      if (Math.abs(dist) <= 2) {
        if (ev.kind === 'tourDate' || ev.kind === 'tourAnnounce') return 'tour';
        if (ev.kind === 'festival') return 'festival';
        if (ev.kind === 'promoTrip') return 'tour'; // promo trips use tour-context content
        if (ev.kind === 'singleRelease' || ev.kind === 'albumRelease') {
          return dist < 0 ? 'pre-release' : 'post-release';
        }
        if (ev.kind === 'albumAnnounce') return 'pre-release';
      }
    }
    const tourEvents = eventWeeks.filter((e) => e.kind === 'tourDate' || e.kind === 'festival');
    for (let i = 0; i < tourEvents.length - 1; i++) {
      if (weekIdx > tourEvents[i].weekIdx && weekIdx < tourEvents[i + 1].weekIdx &&
          tourEvents[i + 1].weekIdx - tourEvents[i].weekIdx <= 6) {
        return 'tour';
      }
    }
    return null; // no override — keep the moment-based context
  }

  // Only override weeks where the timeline gives us a DIFFERENT context
  // than what enrichPlanWeeks already assigned (which used moment inference)
  const start = new Date(startIso + 'T12:00:00');
  const counters: Record<WeekContext, number> = {
    'tour': 0, 'festival': 0, 'pre-release': 0, 'post-release': 0, 'catalogue': 0,
  };

  for (const w of weeks) {
    // Only touch weeks that got generic auto-fill (2 actions, both planned)
    const isAutoFilled = w.actions.length <= 3 &&
      w.actions.every((a) => a.status === 'planned') &&
      w.actions.some((a) => a.title.startsWith('Catalogue') || a.title.startsWith('Community Post —') ||
        a.title.startsWith('Studio Session') || a.title.startsWith('Freestyle') ||
        a.title.startsWith('Collab Tease') || a.title.startsWith('Lifestyle') ||
        a.title.startsWith('Acoustic'));
    if (!isAutoFilled) continue;

    const tlCtx = timelineContext(w.week - 1);
    if (!tlCtx || tlCtx === 'catalogue') continue;

    // Replace the auto-filled content with timeline-context content
    w.actions = [];
    const pool = CONTENT_POOLS[tlCtx];
    const idx = counters[tlCtx] % pool.length;
    counters[tlCtx]++;
    const [shortTitle, postTitle] = pool[idx];

    const base = new Date(start); base.setDate(base.getDate() + (w.week - 1) * 7);
    const monISO = addDaysIso(base.toISOString().split('T')[0], 1);
    const thuISO = addDaysIso(base.toISOString().split('T')[0], 4);

    const mon = act(shortTitle, 'short', 'MON', 1, 'engage', 'planned');
    mon.date = monISO;
    const thu = act(postTitle, postTitle.startsWith('Community') ? 'post' : 'short', 'THU', 1, 'engage', 'planned');
    thu.date = thuISO;
    w.actions.push(mon, thu);

    if (tlCtx === 'tour' || tlCtx === 'festival') {
      const wedISO = addDaysIso(base.toISOString().split('T')[0], 3);
      const wed = act(`${tlCtx === 'tour' ? 'Tour' : 'Festival'} Update Short`, 'short', 'WED', 1, 'engage', 'planned');
      wed.date = wedISO;
      w.actions.push(wed);
    }
  }
}

/** Build a CampaignPlan from parsed timeline events. */
function buildPlanFromTimeline(events: ParsedTimelineEvent[], artist?: string, campaignName?: string): CampaignPlan | null {
  if (events.length === 0) return null;
  const first = events[0].dateISO;
  const last = events[events.length - 1].dateISO;
  // Start one week before the first event.
  const startIso = addDaysIso(first, -7);
  // End ~3 weeks after last event, minimum 24 weeks.
  const endIso = addDaysIso(last, 21);
  const start = new Date(startIso + 'T12:00:00');
  const end = new Date(endIso + 'T12:00:00');
  const totalDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  const weekCount = Math.max(24, Math.ceil(totalDays / 7));

  const fmt = (d: Date) => `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;
  const weeks: CampaignWeek[] = [];
  for (let i = 0; i < weekCount; i++) {
    const ws = new Date(start); ws.setDate(ws.getDate() + i * 7);
    const we = new Date(ws); we.setDate(we.getDate() + 6);
    weeks.push({ week: i + 1, dateRange: `${fmt(ws)} – ${fmt(we)}`, actions: [], feedback: {} });
  }

  const moments: CampaignMoment[] = [];

  for (const ev of events) {
    const placed = actionsForEvent(ev, startIso);
    for (const { action } of placed) {
      const d = action.date;
      if (!d) continue;
      const wd = dateToWeekDay(startIso, d);
      if (!wd || wd.weekIdx >= weeks.length) continue;
      weeks[wd.weekIdx].actions.push(action);
    }
    // Build a moment for major events.
    const wd = dateToWeekDay(startIso, ev.dateISO);
    if (wd) {
      const momentType: CampaignMoment['type'] | null =
        ev.kind === 'singleRelease' ? 'single' :
        ev.kind === 'albumRelease' ? 'album' :
        ev.kind === 'albumAnnounce' ? 'announcement' :
        ev.kind === 'documentaryRelease' ? 'milestone' :
        ev.kind === 'tourAnnounce' ? 'milestone' :
        ev.kind === 'tourDate' ? 'milestone' :
        ev.kind === 'festival' ? 'milestone' :
        ev.kind === 'liveShow' ? 'milestone' :
        null;
      if (momentType) {
        moments.push({
          weekNum: wd.weekIdx + 1,
          date: ev.dateISO,
          name: ev.title,
          type: momentType,
          isAnchor: momentType === 'album' || momentType === 'single',
          why: `Auto-imported from timeline (${ev.kind}).`,
          prepNote: 'Teaser + day-of community post + follow-up short auto-added.',
        });
      }
    }
  }

  // ── Use shared enrichment for phase assignment + gap filling ──────────
  const preEnrich: CampaignPlan = {
    artist: artist || '', campaignName: campaignName || 'Imported Campaign',
    subscriberCount: 0, startDate: startIso, weeks, moments,
    targets: { subsTarget: 0, viewsTarget: 0, shortsPerWeek: 3, videosPerWeek: 1, postsPerWeek: 2, communityPerWeek: 2 },
    isExample: false,
  };
  const enriched = enrichPlanWeeks(preEnrich);
  // Pull the enriched weeks and moments back into our local refs
  for (let i = 0; i < weeks.length; i++) weeks[i] = enriched.weeks[i];
  moments.length = 0;
  moments.push(...(enriched.moments ?? []));

  // Second pass: timeline-specific context (tour proximity, festival runs, etc.)
  // uses the parsed events for finer-grained context than moments alone can provide
  enrichWithTimelineContext(weeks, events, startIso);

  // ── Build concrete YouTube planner moments ──────────────────────────
  // Every important real-world event becomes an actionable planner card
  // with support stack, status, and phase assignment.
  const phases = assignDynamicPhases(weekCount, moments);
  const youtubeMoments = buildYouTubeMoments(events, startIso, weekCount, phases);

  return {
    artist: artist || '',
    campaignName: campaignName || 'Imported Campaign',
    subscriberCount: 0,
    startDate: startIso,
    weeks,
    targets: {
      subsTarget: 0,
      viewsTarget: 0,
      shortsPerWeek: 3,
      videosPerWeek: 1,
      postsPerWeek: 2,
      communityPerWeek: 2,
    },
    moments,
    youtubeMoments,
    isExample: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW SUB-COMPONENTS — CLEAN, BOLD, UNDERSTANDABLE IN 3 SECONDS
// ═══════════════════════════════════════════════════════════════════════════════

// ──── CAMPAIGN STATUS LINE ───────────────────────────────────────────────────
// Single line that summarizes campaign health in one glance
// ──── CAMPAIGN TIMELINE ──────────────────────────────────────────────────────
// Unified header + status + phase timeline — feels like a journey

const PHASE_MICRO: Record<PhaseName, { short: string; desc: string; focus: string; nudge: string; cadence: string }> = {
  'BUILD':   { short: 'BUILD',   desc: 'Pre-release momentum — warm the channel',       focus: '→ 3 Shorts/week + Community Posts to warm the algorithm',          nudge: 'Warm up the channel',      cadence: '3 Shorts/week + 1 Community Post' },
  'RELEASE': { short: 'RELEASE', desc: 'Launch moment — land the drop',                  focus: '→ Hero video + multi-format support — maximise first 48hrs',       nudge: 'Land the release',         cadence: '3 Shorts/week + 1 longform every 10–14 days' },
  'SCALE':   { short: 'SCALE',   desc: 'Tour, festivals + expansion — grow reach',       focus: '→ Daily Shorts from the road + weekly recap longform',             nudge: 'Keep scaling reach',       cadence: '5 Shorts/week + 1 recap longform/week' },
  'EXTEND':  { short: 'EXTEND',  desc: 'Post-campaign — keep the catalogue alive',       focus: '→ Catalogue content, fan moments, and long-tail engagement',       nudge: 'Keep the story alive',     cadence: '2 Shorts/week + 1 Community Post' },
};

// ── ACTUAL PHASE DETECTION ──────────────────────────────────────────────────
// Infers where the campaign really is based on execution, not the calendar.
// Returns the actual operational phase based on output consistency.
function detectActualPhase(plan: CampaignPlan): PhaseName {
  const targets = autoTargets(plan);

  // Look at the last 3 weeks of activity
  const recentWeeks = plan.weeks
    .filter((w) => w.actions.some((a) => a.status === 'done' || a.status === 'missed'))
    .slice(-3);

  if (recentWeeks.length === 0) return 'BUILD';

  // Count averages over recent weeks
  const avgCount = (type: string) => {
    const total = recentWeeks.reduce((sum, w) => sum + w.actions.filter((a) => a.type === type && a.status === 'done').length, 0);
    return total / recentWeeks.length;
  };

  const avgShorts = avgCount('short');
  const avgPosts = avgCount('post');
  const avgVideos = avgCount('video');
  const avgCollabs = avgCount('collab');
  const avgLive = avgCount('live');
  const avgCommunity = avgPosts + avgLive + avgCollabs;

  // Consistency: are shorts hitting target?
  const shortsConsistent = avgShorts >= (targets.shortsPerWeek || 3) * 0.7;
  // Longform active: videos landing?
  const longformActive = avgVideos >= 0.5;
  // Multi-type output: multiple content types landing?
  const multiType = (avgShorts > 0 ? 1 : 0) + (avgVideos > 0 ? 1 : 0) + (avgPosts > 0 ? 1 : 0) + (avgCollabs > 0 || avgLive > 0 ? 1 : 0);

  // SCALE: consistent shorts + longform + multiple types
  if (shortsConsistent && longformActive && multiType >= 3) return 'SCALE';
  // RELEASE: consistent shorts + some longform/community starting
  if (shortsConsistent && (longformActive || avgCommunity >= 1)) return 'RELEASE';
  // Still in BUILD
  return 'BUILD';
}

function CampaignStartControl({ startDate, onChange }: { startDate: string; onChange: (d: string) => void }) {
  const watcher = useWatcherChannel();
  const firstUpload = useMemo(() => {
    const vids = watcher.state?.latestVideos;
    if (!vids || vids.length === 0) return null;
    const times = vids.map((v) => new Date(v.publishedAt).getTime()).filter((t) => !Number.isNaN(t));
    if (times.length === 0) return null;
    return new Date(Math.min(...times)).toISOString().slice(0, 10);
  }, [watcher.state]);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-ink/40">
        Campaign Start
      </span>
      <input
        type="date"
        className="text-[11px] font-bold text-ink/70 bg-transparent border-b border-dashed border-ink/12 focus:border-ink/50 outline-none"
        value={startDate}
        onChange={(e) => onChange(e.target.value)}
        title="Uploads before this date are ignored in Drop View + rollups"
      />
      {firstUpload && firstUpload !== startDate && (
        <button
          onClick={() => onChange(firstUpload)}
          className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink/55 hover:text-ink px-2 py-0.5 rounded border border-ink/10 hover:border-ink/30 transition-colors"
          title={`First upload on channel: ${firstUpload}`}
        >
          ⚓ Anchor to first upload
        </button>
      )}
      <span className="text-[10px] font-semibold text-ink/35">
        Uploads before this date are ignored
      </span>
    </div>
  );
}

function CampaignBaselineControl({
  baselineSubs, baselineViews, onChange,
}: {
  baselineSubs?: number;
  baselineViews?: number;
  onChange: (updates: { baselineSubs?: number; baselineViews?: number }) => void;
}) {
  const parseNum = (s: string): number | undefined => {
    const t = s.trim().toUpperCase().replace(/,/g, '');
    if (!t) return undefined;
    const m = t.match(/^(-?\d*\.?\d+)\s*([KM]?)$/);
    if (!m) return undefined;
    const n = parseFloat(m[1]);
    const mul = m[2] === 'M' ? 1_000_000 : m[2] === 'K' ? 1_000 : 1;
    return Math.round(n * mul);
  };
  const fmt = (n?: number) => {
    if (n == null) return '';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + 'K';
    return String(n);
  };
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-ink/40">
        Baseline
      </span>
      <input
        className="text-[11px] font-bold text-ink/70 bg-transparent border-b border-dashed border-ink/12 focus:border-ink/50 outline-none w-16"
        defaultValue={fmt(baselineSubs)}
        placeholder="subs"
        onBlur={(e) => onChange({ baselineSubs: parseNum(e.target.value) })}
        title="Subscribers at campaign start (e.g. 142K)"
      />
      <span className="text-[10px] text-ink/35">subs</span>
      <input
        className="text-[11px] font-bold text-ink/70 bg-transparent border-b border-dashed border-ink/12 focus:border-ink/50 outline-none w-20"
        defaultValue={fmt(baselineViews)}
        placeholder="views"
        onBlur={(e) => onChange({ baselineViews: parseNum(e.target.value) })}
        title="Total views at campaign start (e.g. 112.3M)"
      />
      <span className="text-[10px] text-ink/35">views · overrides tracked baseline</span>
    </div>
  );
}

function TimelineImportModal({ open, onClose, onApply }: {
  open: boolean;
  onClose: () => void;
  onApply: (plan: CampaignPlan) => void;
}) {
  const resolved = useContext(ResolvedArtistCtx);
  const ctxSlug = useContext(ArtistSlugCtx);
  const [text, setText] = useState('');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [artist, setArtist] = useState(resolved?.name ?? '');
  const [campaignName, setCampaignName] = useState('');

  // Update artist name when resolved data arrives (async fetch completes after mount).
  useEffect(() => {
    if (resolved?.name && !artist) setArtist(resolved.name);
  }, [resolved?.name]); // eslint-disable-line react-hooks/exhaustive-deps
  const events = useMemo(() => parseTimelineText(text, year), [text, year]);
  if (!open) return null;
  const preview = buildPlanFromTimeline(events, artist, campaignName || undefined);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(14,14,14,0.55)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
        style={{ background: '#FAF7F2' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-ink/10">
          <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/45">Build campaign from timeline</div>
          <div className="font-black text-lg text-ink mt-0.5">Build your campaign from a timeline</div>
          <div className="text-[11px] text-ink/55 mt-1">Paste once — get weekly cadence, per-drop support, and the next actions.</div>
        </div>
        <div className="px-5 py-4 space-y-3 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-ink/45">Artist</div>
              <input className="mt-1 w-full text-sm font-semibold text-ink bg-white rounded-lg px-3 py-2 border border-ink/10 outline-none focus:border-ink/40"
                value={artist} placeholder="Artist name" onChange={(e) => setArtist(e.target.value)} />
            </label>
            <label className="block">
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-ink/45">Campaign</div>
              <input className="mt-1 w-full text-sm font-semibold text-ink bg-white rounded-lg px-3 py-2 border border-ink/10 outline-none focus:border-ink/40"
                value={campaignName} placeholder="e.g. Trapo 2 Album" onChange={(e) => setCampaignName(e.target.value)} />
            </label>
          </div>
          <label className="block">
            <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-ink/45">Year <span className="text-ink/30 normal-case tracking-normal">— used when dates omit it</span></div>
            <input type="number" className="mt-1 w-28 text-sm font-semibold text-ink bg-white rounded-lg px-3 py-2 border border-ink/10 outline-none focus:border-ink/40"
              value={year} onChange={(e) => setYear(parseInt(e.target.value, 10) || year)} />
          </label>
          <label className="block">
            <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-ink/45">Your release timeline</div>
            <textarea
              className="mt-1 w-full h-48 text-sm font-mono text-ink bg-white rounded-lg px-3 py-2 border border-ink/10 outline-none focus:border-ink/40"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"25 March - Mo Gilligan Podcast goes live\n2 April - Single 1 Release - 'Change' with G Herbo + Official Music Video\n21 Aug - Album Release + Tour Announce"}
            />
          </label>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-ink/45 mb-1.5">Parsed drops ({events.length})</div>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {events.length === 0 && <div className="text-[11px] text-ink/40">Drops will appear here as we parse your plan.</div>}
              {events.map((ev, i) => (
                <div key={i} className="flex items-center justify-between text-[11px] bg-white rounded-md px-2 py-1.5 border border-ink/5">
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-ink">{ev.dateISO}</span>
                    <span className="text-ink/70 ml-2 truncate">{ev.title}</span>
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink/50 shrink-0 ml-2">{ev.kind}</span>
                </div>
              ))}
            </div>
          </div>
          {preview && (
            <div className="text-[10px] text-ink/55">
              Plan start <span className="font-bold text-ink">{preview.startDate}</span> · {preview.weeks.length} weeks · {preview.weeks.reduce((s, w) => s + w.actions.length, 0)} actions · {preview.moments?.length || 0} moments
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-ink/10 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-[0.12em] text-ink/60 hover:bg-ink/5">Cancel</button>
          <button
            disabled={!preview}
            onClick={() => {
              if (preview) {
                // Lock the plan to this artist's slug + channel so it can't drift.
                const locked: CampaignPlan = {
                  ...preview,
                  slug: ctxSlug || undefined,
                  channelHandle: resolved?.channelHandle || undefined,
                };
                onApply(locked);
                onClose();
              }
            }}
            className="px-4 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-[0.12em] text-paper"
            style={{ background: preview ? '#0E0E0E' : 'rgba(14,14,14,0.25)' }}
          >
            Build campaign
          </button>
        </div>
      </div>
    </div>
  );
}

function CampaignHeader({ plan, onUpdatePlan, onOpenSettings, onOpenAdd, onNewCampaign, onOpenTimeline }: {
  plan: CampaignPlan;
  onUpdatePlan: (updates: Partial<CampaignPlan>) => void;
  onOpenSettings?: () => void;
  onOpenAdd?: () => void;
  onNewCampaign?: () => void;
  onOpenTimeline?: () => void;
}) {
  const resolved = useContext(ResolvedArtistCtx);
  const ctxSlug = useContext(ArtistSlugCtx);
  let activeIdx = -1;
  for (let i = plan.weeks.length - 1; i >= 0; i--) {
    if (plan.weeks[i].actions.some((a) => a.status === 'done' || a.status === 'missed')) {
      activeIdx = i;
      break;
    }
  }
  const totalWeeks = plan.weeks.length;
  const weekNum = activeIdx >= 0 ? plan.weeks[activeIdx].week : 0;
  const channelHandle = plan.channelHandle ?? resolved?.channelHandle;

  return (
    <div className="mb-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {plan.isExample && (
            <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/35 mb-1">
              Example Campaign
            </div>
          )}
          {/* Watcher link + channel handle */}
          {ctxSlug && (
            <div className="flex items-center gap-2 mb-1">
              <a
                href={`/watcher/${ctxSlug}`}
                className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/45 hover:text-ink underline decoration-ink/20 underline-offset-2"
              >
                ← Watcher
              </a>
              {channelHandle && (
                <>
                  <span className="text-ink/20">·</span>
                  <a
                    href={`https://www.youtube.com/${channelHandle.startsWith('@') ? channelHandle : 'channel/' + channelHandle}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[9px] font-mono text-ink/40 hover:text-ink/70"
                  >
                    {channelHandle}
                  </a>
                </>
              )}
              {resolved?.phase && (
                <>
                  <span className="text-ink/20">·</span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/35">{resolved.phase}</span>
                </>
              )}
            </div>
          )}
          <h1 className="flex items-baseline gap-1 font-black text-2xl text-ink">
            <span>YouTube Campaign —</span>
            <input
              className="font-black text-2xl text-ink bg-transparent border-b border-dashed border-ink/12 focus:border-ink/50 outline-none min-w-[120px]"
              value={plan.artist}
              placeholder="Enter Artist Name"
              onChange={(e) => onUpdatePlan({ artist: e.target.value })}
            />
          </h1>
          <input
            className="text-sm font-semibold text-ink/50 mt-0.5 bg-transparent border-b border-dashed border-ink/12 focus:border-ink/50 outline-none w-full"
            value={plan.campaignName}
            placeholder="Enter Campaign Name"
            onChange={(e) => onUpdatePlan({ campaignName: e.target.value })}
          />
          <p className="text-[12px] text-ink/55 mt-2 max-w-[52ch]">
            Paste your release dates. Get the cadence, support, and next move for every drop.
          </p>
          <div className="mt-3">
            <ConversionChip />
          </div>
        </div>
        {onOpenTimeline && (
          <div className="shrink-0 ml-3 flex flex-col items-end gap-1">
            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/45">
              Start here →
            </span>
            <button
              onClick={onOpenTimeline}
              className="px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-[0.14em] text-paper shadow-sm"
              style={{ background: '#0E0E0E' }}
              title="Paste a release timeline and auto-build a YouTube plan"
            >
              Build campaign from timeline
            </button>
          </div>
        )}
        {/* Settings cog retired — campaign targets now auto-derive from channel size + planned drops */}
      </div>
      {weekNum > 0 && (
        <div className="mt-2 text-right text-[10px] font-semibold text-ink/30">
          Week {weekNum} of {totalWeeks}
        </div>
      )}
    </div>
  );
}

function CampaignTimeline({ plan, onPhaseClick }: {
  plan: CampaignPlan;
  onPhaseClick: (name: PhaseName) => void;
}) {
  // Find active week
  let activeIdx = -1;
  for (let i = plan.weeks.length - 1; i >= 0; i--) {
    if (plan.weeks[i].actions.some((a) => a.status === 'done' || a.status === 'missed')) {
      activeIdx = i;
      break;
    }
  }

  // Planned phase = where the calendar says we should be
  const plannedPhase = activeIdx >= 0 ? getPhaseForWeek(plan.weeks[activeIdx]?.week) : null;
  // Actual phase = where execution says we really are
  const actualPhaseName = detectActualPhase(plan);
  const actualPhase = getPlanPhases(plan).find((p) => p.name === actualPhaseName) || null;
  // Use planned for timeline highlight, but flag drift
  const currentPhase = plannedPhase;
  const phaseDrift = plannedPhase && actualPhase && plannedPhase.name !== actualPhase.name;
  const totalWeeks = plan.weeks.length;
  const weekNum = activeIdx >= 0 ? plan.weeks[activeIdx].week : 0;

  return (
    <div className="mb-8">
      <div className="mt-2">
        <div className="mb-1.5 flex items-baseline gap-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/40">
            Campaign Plan
          </span>
          <span className="text-[10px] font-semibold text-ink/35">
            This is your planned campaign structure — used for pitching and tracking progress.
          </span>
        </div>
        <div
          className="w-full flex gap-1 rounded-xl overflow-hidden p-1"
          style={{ background: '#FAF7F2', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
        >
          {getPlanPhases(plan).map((phase) => {
            const weekCount = phase.weekEnd - phase.weekStart + 1;
            const isCurrent = currentPhase?.name === phase.name;
            const isPast = activeIdx >= 0 && plan.weeks[activeIdx].week > phase.weekEnd;
            const micro = PHASE_MICRO[phase.name];

            // Real drop count for this phase (from planned or live tracks).
            const phaseWeeks = plan.weeks.filter((w) => w.week >= phase.weekStart && w.week <= phase.weekEnd);
            const phaseActions = phaseWeeks.flatMap((w) => w.actions);
            const phaseDrops = phaseActions.filter((a) => a.type === 'video' || a.type === 'collab').length;
            const phaseDone = phaseActions.filter((a) => a.status === 'done').length;
            const phaseTotal = phaseActions.length;

            // Status logic — observable, not aspirational.
            // Behind = phase is current/past, has drops, and support is missing.
            const missedInPhase = phaseActions.filter((a) => a.status === 'missed').length;
            let status: 'Complete' | 'In Progress' | 'Behind' | 'Upcoming';
            if (isPast && phaseTotal > 0 && phaseDone >= phaseTotal) status = 'Complete';
            else if ((isCurrent || isPast) && missedInPhase > 0) status = 'Behind';
            else if (isCurrent || (isPast && phaseDone < phaseTotal)) status = 'In Progress';
            else status = 'Upcoming';

            const statusColor =
              status === 'Complete'   ? '#1FBE7A' :
              status === 'Behind'     ? '#FF4A1C' :
              status === 'In Progress' ? phase.color :
                                         'rgba(14,14,14,0.25)';

            return (
              <button
                key={phase.name}
                onClick={() => onPhaseClick(phase.name)}
                className="relative flex flex-col items-start justify-center rounded-lg transition-all text-left"
                style={{
                  flex: weekCount,
                  minWidth: 0,
                  minHeight: 52,
                  background: isCurrent ? `${phase.color}14` : 'transparent',
                  border: isCurrent ? `1px solid ${phase.color}55` : '1px solid rgba(14,14,14,0.04)',
                  color: 'rgba(14,14,14,0.72)',
                  padding: '6px 8px',
                  cursor: 'pointer',
                }}
              >
                <div className="flex items-center gap-1.5 w-full">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: statusColor }}
                    aria-hidden="true"
                  />
                  <span className="font-black text-[10px] tracking-[0.08em] leading-none truncate">
                    {micro.short}
                  </span>
                  {phaseDrops > 0 && (
                    <span className="ml-auto text-[9px] font-bold text-ink/45 shrink-0">
                      {phaseDrops} {phaseDrops === 1 ? 'drop' : 'drops'}
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-semibold text-ink/50 leading-snug mt-1 line-clamp-2">
                  {micro.desc}
                </span>
                <span
                  className="text-[8px] font-bold uppercase tracking-[0.12em] mt-1"
                  style={{ color: statusColor }}
                >
                  {status}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ──── CAMPAIGN ANCHOR STRIP ──────────────────────────────────────────────────
// Compact horizontal strip showing key anchor moments across the campaign

function CampaignAnchorStrip({ plan }: { plan: CampaignPlan }) {
  const anchors = getAnchors();
  if (anchors.length === 0) return null;

  // Determine which anchors are past vs future
  let activeIdx = -1;
  for (let i = plan.weeks.length - 1; i >= 0; i--) {
    if (plan.weeks[i].actions.some((a) => a.status === 'done' || a.status === 'missed')) { activeIdx = i; break; }
  }
  const currentWeek = activeIdx >= 0 ? plan.weeks[activeIdx].week : 0;

  return (
    <div className="mb-6 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
      {anchors.map((anchor) => {
        const isPast = anchor.weekNum <= currentWeek;
        const isCurrent = anchor.weekNum === currentWeek || (anchor.weekNum === currentWeek + 1);
        const phase = getPhaseForWeek(anchor.weekNum);
        const phaseColor = phase?.color || '#71717a';

        return (
          <div
            key={anchor.date}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all"
            style={{
              background: isCurrent ? phaseColor : isPast ? `${phaseColor}15` : `${phaseColor}08`,
              border: isCurrent ? `2px solid ${phaseColor}` : `1.5px solid ${phaseColor}25`,
              minWidth: 0,
            }}>
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                background: isCurrent ? '#ffffff' : isPast ? phaseColor : `${phaseColor}50`,
              }}
            />
            <div className="min-w-0">
              <span
                className="text-[11px] font-black block truncate leading-tight"
                style={{ color: isCurrent ? '#ffffff' : isPast ? phaseColor : `${phaseColor}90` }}>
                {anchor.name}
              </span>
              <span
                className="text-[9px] font-semibold block leading-tight"
                style={{ color: isCurrent ? 'rgba(255,255,255,0.8)' : isPast ? `${phaseColor}80` : `${phaseColor}50` }}>
                {fmtDate(anchor.date)} · {fmtDay(anchor.date)}
              </span>
            </div>
            {isPast && !isCurrent && (
              <span className="text-[9px] font-bold ml-1" style={{ color: `${phaseColor}60` }}>✓</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ──── CHANNEL SIGNAL + THIS WEEK'S CALL ──────────────────────────────────────
// Fast read: is the channel in BUILD / PUSH / HOLD / FIX mode?
// What is this week's single clearest action?

type ChannelSignal = 'PUSH' | 'SCALE' | 'HOLD' | 'TEST';

// ── System 1 + System 2 decision detail — content-native (no spend/channel).
//    System 1: why + todo
//    System 2 (collapsible): aiRead + watch + ifConfirmed
type DecisionDetail = {
  why: string;
  todo: string;
  aiRead: string;
  watch: string;
  ifConfirmed: string;
};

function buildDecisionDetail(signal: ChannelSignal): DecisionDetail {
  switch (signal) {
    case 'SCALE':
      return {
        why: 'Cadence is holding and the channel is in a momentum window — reach is the lever now, not more posting volume.',
        todo: 'Concentrate on the hero formats pulling returning viewers — double down, stop testing sideways.',
        aiRead:
          'Shorts cadence has cleared as a limiting variable, and long-form is starting to compound the audience Shorts are sending — the channel is moving from reach to retention.',
        watch: 'Shorts-to-subscriber conversion and whether returning viewers lift week over week.',
        ifConfirmed: 'Move from scaling formats to scaling storylines — build multi-week arcs around the working hooks.',
      };
    case 'PUSH':
      return {
        why: "Short-form is pulling early reach, but long-form isn't compounding yet — the channel is attracting attention, not yet holding it.",
        todo: 'Pair every Shorts hit with a long-form piece on the same hook — convert reach into returning viewers.',
        aiRead:
          'Reach is widening but repeat behaviour is flat — the channel is picking up new viewers faster than it is keeping them.',
        watch: 'Repeat-return rate rising alongside Shorts views over the next two weeks.',
        ifConfirmed: 'Shift from testing cadence to scaling long-form around the next drop — commit to the working hook.',
      };
    case 'TEST':
      return {
        why: "Posting rhythm is inconsistent — performance signals can't be trusted until cadence clears as the limiting variable.",
        todo: 'Hold a steady two-week rhythm on one format — treat everything else as noise until cadence is proven.',
        aiRead:
          'Format spread is too wide for the current output — performance signals are tangled, not weak; the fix is discipline before breadth.',
        watch: 'Two full weeks of consistent cadence with one format showing clear engagement separation.',
        ifConfirmed: 'Move from test to push — commit to the format the rhythm validated and let it compound before adding more.',
      };
    case 'HOLD':
    default:
      return {
        why: 'Core audience is engaged, but there is no evidence of widening reach — nothing to scale into yet.',
        todo: 'Keep cadence tight and watch for one format to separate — no format expansion this week.',
        aiRead:
          'Return behaviour is stable and reach is flat — the channel is held by the existing audience, not pulled by a new one.',
        watch: 'Repeat return behaviour rising, or subscriber growth climbing alongside Shorts views.',
        ifConfirmed: 'Move to a contained test on the format starting to separate — push cadence before expanding formats.',
      };
  }
}

// Intelligence panel — collapsible System 2 layer for the channel decision.
function YTIntelligencePanel({
  aiRead,
  watch,
  ifConfirmed,
  compact = false,
}: {
  aiRead: string;
  watch: string;
  ifConfirmed: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerBase = compact
    ? 'relative inline-flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors'
    : 'w-full flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 transition-colors';
  const label = compact
    ? (open ? 'Hide' : 'Why this call')
    : (open ? 'Hide intelligence' : 'Open intelligence');

  return (
    <div
      className={compact ? 'relative' : 'mt-4 pt-4'}
      style={compact ? {} : { borderTop: '1px solid rgba(250,247,242,0.10)' }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={triggerBase}
        style={{
          background: 'rgba(250,247,242,0.06)',
          border: '1px solid rgba(250,247,242,0.12)',
        }}
      >
        <span className="flex items-center gap-2">
          <span className="relative inline-flex items-center justify-center">
            <span
              className="absolute inset-0 rounded-full animate-pulse"
              style={{ background: 'rgba(250,247,242,0.30)' }}
            />
            <span
              className="relative inline-flex items-center justify-center rounded-full text-[9px] font-mono tracking-[0.1em]"
              style={{
                width: compact ? 16 : 18,
                height: compact ? 16 : 18,
                background: '#FAF7F2',
                color: '#0E0E0E',
              }}
            >
              AI
            </span>
          </span>
          <span
            className={`${compact ? 'text-[10.5px]' : 'text-[11.5px]'} font-mono uppercase tracking-[0.14em]`}
            style={{ color: 'rgba(250,247,242,0.70)' }}
          >
            {label}
          </span>
        </span>
        {!compact && (
          <span
            className="text-[11px] font-mono transition-transform"
            style={{
              color: 'rgba(250,247,242,0.45)',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            ▾
          </span>
        )}
      </button>
      {open && (
        <div
          className={`${compact ? 'absolute right-0 mt-2 w-[320px] z-20' : 'mt-3'} rounded-xl p-4 space-y-3.5`}
          style={{
            background: compact ? '#0E0E0E' : 'rgba(250,247,242,0.04)',
            border: '1px solid rgba(250,247,242,0.12)',
            boxShadow: compact ? '0 12px 30px rgba(0,0,0,0.4)' : 'none',
          }}
        >
          {([
            ['AI Read', aiRead],
            ['Watch', watch],
            ['If confirmed', ifConfirmed],
          ] as const).map(([labelText, body]) => (
            <div key={labelText}>
              <div
                className="text-[10px] font-mono uppercase tracking-[0.14em] mb-1"
                style={{ color: 'rgba(250,247,242,0.45)' }}
              >
                {labelText}
              </div>
              <p
                className="text-[13.5px] leading-snug"
                style={{ color: 'rgba(250,247,242,0.90)' }}
              >
                {body}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Decision colors — shared system across all products.
//   PUSH → #1FBE7A   HOLD → #F5B73D   TEST → #2C6BFF
// SCALE inherits PUSH green (it's an intensification of PUSH, not a separate hue).
const CHANNEL_SIGNAL_META: Record<ChannelSignal, { color: string; bg: string; label: string; desc: string }> = {
  PUSH:  { color: '#1FBE7A', bg: 'rgba(31,190,122,0.12)', label: 'PUSH',  desc: 'Momentum is live. Back it with cadence.' },
  SCALE: { color: '#1FBE7A', bg: 'rgba(31,190,122,0.18)', label: 'SCALE', desc: 'Cadence holding. Increase reach and build momentum.' },
  HOLD:  { color: '#F5B73D', bg: 'rgba(245,183,61,0.14)', label: 'HOLD',  desc: 'Sustain what\u2019s working. Don\u2019t over-invest yet.' },
  TEST:  { color: '#2C6BFF', bg: 'rgba(44,107,255,0.12)', label: 'TEST',  desc: 'Validate the foundation before scaling.' },
};

type CadenceCounts = {
  shortsDone: number;
  shortsTarget: number;
  postsDone: number;
  postsTarget: number;
  longformDone: number;
  longformTarget: number;
};

function getCurrentWeek(plan: CampaignPlan): CampaignWeek | undefined {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const start = new Date(plan.startDate + 'T12:00:00');
  const daysSinceStart = Math.floor((today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  const weekNum = Math.max(1, Math.min(plan.weeks.length, Math.floor(daysSinceStart / 7) + 1));
  return plan.weeks.find((w) => w.week === weekNum);
}

function getCadenceCounts(plan: CampaignPlan): CadenceCounts {
  const targets = autoTargets(plan);
  const currentWeek = getCurrentWeek(plan);
  const actions = currentWeek?.actions || [];
  const count = (type: ActionType) => actions.filter((a) => a.type === type && a.status === 'done').length;
  return {
    shortsDone: count('short'),
    shortsTarget: targets.shortsPerWeek || 0,
    postsDone: count('post') + count('live') + count('collab'),
    postsTarget: (targets.postsPerWeek || 0) + (targets.communityPerWeek || 0),
    longformDone: count('video'),
    longformTarget: targets.videosPerWeek || 0,
  };
}

type CadenceStatus = 'Healthy' | 'At Risk' | 'Broken';

function getCadenceStatus(c: CadenceCounts): CadenceStatus {
  const row = (done: number, target: number): 'hit' | 'at_risk' | 'behind' => {
    if (target === 0) return 'hit';
    if (done >= target) return 'hit';
    if (done === 0) return 'behind';
    return 'at_risk';
  };
  const rows = [
    row(c.shortsDone, c.shortsTarget),
    row(c.postsDone, c.postsTarget),
    row(c.longformDone, c.longformTarget),
  ];
  const behind = rows.filter((r) => r === 'behind').length;
  const hit = rows.filter((r) => r === 'hit').length;
  if (behind >= 2) return 'Broken';
  if (hit >= 3) return 'Healthy';
  return 'At Risk';
}

const CADENCE_STATUS_META: Record<CadenceStatus, { color: string; bg: string }> = {
  Healthy:   { color: '#1FBE7A', bg: 'rgba(31,190,122,0.08)' },
  'At Risk': { color: '#FFD24C', bg: 'rgba(255,210,76,0.10)' },
  Broken:    { color: '#FF4A1C', bg: 'rgba(255,74,28,0.08)' },
};

function computeChannelSignal(plan: CampaignPlan): ChannelSignal {
  const cadence = getCadenceCounts(plan);
  const cadenceStatus = getCadenceStatus(cadence);
  // Broken cadence = can't trust the channel yet — validate before investing more.
  if (cadenceStatus === 'Broken') return 'TEST';

  const currentPhase = detectActualPhase(plan);
  const drop = getNextDrop(plan);
  const nearDrop = drop !== null && drop.daysAway >= 0 && drop.daysAway <= 7;

  // BUILD = still proving the channel is live.
  if (currentPhase === 'BUILD') return 'TEST';

  // SCALE phase — momentum window, so SCALE when healthy, PUSH otherwise.
  if (currentPhase === 'SCALE') {
    return cadenceStatus === 'Healthy' ? 'SCALE' : 'PUSH';
  }

  // Drop inside a week — back it.
  if (nearDrop) return 'PUSH';

  // RELEASE phase — actively launching, push if cadence isn't healthy.
  if (currentPhase === 'RELEASE') return cadenceStatus === 'Healthy' ? 'SCALE' : 'PUSH';

  return 'HOLD';
}

function buildThisWeeksCall(plan: CampaignPlan, signal: ChannelSignal): string {
  const c = getCadenceCounts(plan);
  const shortsGap = Math.max(0, c.shortsTarget - c.shortsDone);
  const postsGap = Math.max(0, c.postsTarget - c.postsDone);
  const longGap = Math.max(0, c.longformTarget - c.longformDone);

  // Human list: "1 short", "3 updates", "1 video"
  const parts: string[] = [];
  if (longGap > 0) parts.push(`${longGap} video${longGap > 1 ? 's' : ''}`);
  if (shortsGap > 0) parts.push(`${shortsGap} short${shortsGap > 1 ? 's' : ''}`);
  if (postsGap > 0) parts.push(`${postsGap} update${postsGap > 1 ? 's' : ''}`);
  const joinHuman = (arr: string[]) => arr.length <= 1 ? arr.join('') : arr.length === 2 ? arr.join(' and ') : `${arr.slice(0, -1).join(', ')}, and ${arr[arr.length - 1]}`;

  if (signal === 'PUSH') {
    const drop = getNextDrop(plan);
    if (drop && drop.daysAway >= 0 && drop.daysAway <= 7) {
      if (parts.length === 0) return `Support "${drop.action.title}" — post something today`;
      return `Support "${drop.action.title}" — post ${joinHuman(parts)} this week`;
    }
  }

  if (parts.length === 0) {
    if (signal === 'TEST') return 'Post something this week — nothing has shipped yet';
    if (signal === 'SCALE') return 'Cadence is holding — keep posting, push reach';
    return "You're on track — keep posting";
  }
  return `Post ${joinHuman(parts)} this week`;
}

type WatcherInsight = {
  headline: string;
  detail: string;
  flags: string[];
  decisionHint: ChannelSignal;
};

type WatcherVideoType = 'official' | 'lyric' | 'visualizer' | 'audio' | 'live' | 'unknown';
type WatcherTopVideo = {
  videoId: string;
  title: string;
  views: number;
  publishedAt: string;
  videoType: WatcherVideoType;
};
type WatcherState = {
  channelId: string;
  subscriberCount: number;
  subscriberDelta: number | null;
  viewCount: number;
  viewDelta: number | null;
  videoCount: number;
  lastUploadDate: string | null;
  uploadsLast7Days: number;
  uploadsLast14Days: number;
  shortsLast14Days: number;
  videosLast14Days: number;
  daysSinceLastUpload: number | null;
  checkedAt: string;
  topVideoLast14d?: WatcherTopVideo | null;
  latestVideos?: WatcherVideo[];
};

type WatcherVideo = {
  videoId: string;
  title: string;
  publishedAt: string;
  durationSeconds: number | null;
  thumbnail: string | null;
  kind: 'short' | 'video';
  views?: number;
  likes?: number;
  comments?: number;
  videoType?: WatcherVideoType;
  isLive?: boolean;
  isPremiere?: boolean;
  isCollab?: boolean;
};

type WatcherChannel = {
  insight: WatcherInsight | null;
  state: WatcherState | null;
  events: WatcherEventLike[];
};

function useWatcherChannel(explicitSlug?: string): WatcherChannel {
  const ctxSlug = useContext(ArtistSlugCtx);
  const artistSlug = explicitSlug || ctxSlug;
  const [data, setData] = useState<WatcherChannel>({ insight: null, state: null, events: [] });
  useEffect(() => {
    if (!artistSlug) return;
    let alive = true;
    fetch(`/api/artist-live?slug=${encodeURIComponent(artistSlug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((json) => {
        if (!alive || !json?.state) return;
        setData({
          insight: null,
          state: json.state as WatcherState,
          events: [],
        });
      });
    return () => { alive = false; };
  }, [artistSlug]);
  return data;
}

// ─── CAMPAIGN BASELINE ─────────────────────────────────────────────────────
// Tracks subs/views at the campaign start so the hero can show growth since
// start. Prefers the watcher's historical snapshot (authoritative) and falls
// back to a first-sight value persisted in localStorage.
type CampaignBaseline = {
  subscriberCount: number;
  viewCount: number;
  capturedAt: string;
  source: 'watcher' | 'first-sight';
} | null;

function useCampaignBaseline(
  channelId: string | undefined,
  campaignStart: string | undefined,
  liveState: { subscriberCount: number; viewCount: number } | null,
): CampaignBaseline {
  const [baseline, setBaseline] = useState<CampaignBaseline>(null);
  const storageKey =
    channelId && campaignStart ? `coach.baseline.v2.${channelId}.${campaignStart}` : null;

  // 1. Try watcher /snapshot?on=<campaignStart>
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_WATCHER_URL;
    if (!base || !channelId || !campaignStart || !storageKey) return;
    let alive = true;
    const root = base.replace(/\/$/, '');
    fetch(`${root}/channels/${channelId}/snapshot?on=${campaignStart}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((snap: { subscriberCount?: number; viewCount?: number; capturedAt?: string } | null) => {
        if (!alive || !snap || typeof snap.subscriberCount !== 'number') return;
        const b: CampaignBaseline = {
          subscriberCount: snap.subscriberCount,
          viewCount: snap.viewCount ?? 0,
          capturedAt: snap.capturedAt ?? campaignStart,
          source: 'watcher',
        };
        setBaseline(b);
        try { localStorage.setItem(storageKey, JSON.stringify(b)); } catch {/*noop*/}
      })
      .catch(() => {/*noop*/});
    return () => { alive = false; };
  }, [channelId, campaignStart, storageKey]);

  // 2. Hydrate from localStorage; if missing and we have a live state, first-sight.
  useEffect(() => {
    if (!storageKey) return;
    if (baseline) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        setBaseline(JSON.parse(raw) as CampaignBaseline);
        return;
      }
    } catch {/*noop*/}
    if (liveState) {
      const today = new Date().toISOString().slice(0, 10);
      if (!campaignStart || today >= campaignStart) {
        const b: CampaignBaseline = {
          subscriberCount: liveState.subscriberCount,
          viewCount: liveState.viewCount,
          capturedAt: new Date().toISOString(),
          source: 'first-sight',
        };
        setBaseline(b);
        try { localStorage.setItem(storageKey, JSON.stringify(b)); } catch {/*noop*/}
      }
    }
  }, [storageKey, liveState, baseline, campaignStart]);

  return baseline;
}

// Map the campaign's PhaseName → coach engine PhaseName (internal vocab).
function toCoachPhase(name: PhaseName | undefined): CoachPhaseName {
  switch (name) {
    case 'BUILD':   return 'REAWAKEN';
    case 'RELEASE': return 'BUILD';
    case 'SCALE':   return 'SCALE';
    case 'EXTEND':  return 'EXTEND';
    default:        return 'REAWAKEN';
  }
}

function useWatcherInsight() {
  return useWatcherChannel().insight;
}

// ── System-1 helpers ─────────────────────────────────────────────────────────
function formatBig(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + 'K';
  return n.toLocaleString();
}
function formatDelta(n: number | null | undefined): { text: string; dir: 'up' | 'flat' | 'down' } {
  if (n == null || n === 0) return { text: 'flat', dir: 'flat' };
  const abs = Math.abs(n);
  return { text: (n > 0 ? '+' : '−') + formatBig(abs), dir: n > 0 ? 'up' : 'down' };
}
// Behaviour → Problem → Implication copy. Combines subs/views trend with output.
function subsViewsSignal(
  subDelta: number | null,
  viewDelta: number | null,
  uploads14: number,
): string {
  const s = subDelta ?? 0;
  const v = viewDelta ?? 0;
  if (uploads14 === 0) return "You're not posting — the channel is cooling off and the algorithm is letting go";
  if (uploads14 >= 6 && s <= 0) return "You're posting a lot but not converting — content isn't sticking";
  if (s > 0 && v > 0) return "Views and subs are both moving — the channel is working right now";
  if (s <= 0 && v > 0) return "Reach is growing but subs are flat — viewers aren't staying";
  if (s > 0 && v <= 0) return "Subs are ticking up but views aren't — the new audience is small";
  if (s < 0 && v < 0) return "Views and subs are both down — the channel is slipping";
  return "The channel is flat — nothing is moving yet";
}

function recencyLabel(days: number | null | undefined): string {
  if (days == null) return '—';
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}
function recencyColor(days: number | null | undefined): string {
  if (days == null || days >= 10) return '#FF4A1C';
  if (days >= 5) return '#F5B73D';
  return '#1FBE7A';
}
const VIDEO_TYPE_LABEL: Record<WatcherVideoType, string> = {
  official: 'Official Video',
  lyric: 'Lyric Video',
  visualizer: 'Visualizer',
  audio: 'Audio',
  live: 'Live / Performance',
  unknown: 'Video',
};
function cadenceSummaryLine(cmp: CadenceCompare | null): { headline: string; detail: string; color: string } {
  if (!cmp) return { headline: 'Cadence: —', detail: '', color: 'rgba(250,247,242,0.55)' };
  const labelFor = (s: string): string => s === 'exceeding' ? 'exceeding' : s === 'on_track' ? 'on track' : s === 'slightly_behind' ? 'slightly behind' : 'behind';
  const parts = cmp.rows.map((r) => {
    if (r.actual < 0) return `${r.format} planned`;
    return `${r.format} ${labelFor(r.status)}`;
  });
  const color = cmp.overall === 'Strong cadence' ? '#1FBE7A' : cmp.overall === 'Behind cadence' ? '#FF4A1C' : '#F5B73D';
  const headline = cmp.overall === 'Strong cadence' ? 'Cadence: Strong' : cmp.overall === 'On track' ? 'Cadence: On track' : 'Cadence: Behind';
  return { headline, detail: parts.join(' · '), color };
}
type CadenceCompare = ReturnType<typeof cadenceComparison>;

function TopSignalCard({ plan, onUpdatePlan }: { plan: CampaignPlan; onOpenAdd?: (kind: MissingActionKind) => void; onUpdatePlan?: (updates: Partial<CampaignPlan>) => void }) {
  const watcher = useWatcherChannel();
  // Keep the watcher-baseline hook mounted (side-effects: first-sight capture).
  useCampaignBaseline(
    watcher.state?.channelId,
    plan.startDate,
    watcher.state ? { subscriberCount: watcher.state.subscriberCount, viewCount: watcher.state.viewCount } : null,
  );
  // Baseline: use plan-stored baselines if the user set them, else derive from
  // the live channel data (via artist-live API), else fall back to plan.subscriberCount.
  const effectiveBaselineSubs  = plan.baselineSubs ?? plan.subscriberCount ?? 0;
  const effectiveBaselineViews = plan.baselineViews ?? 0;
  const baseline: CampaignBaseline = {
    subscriberCount: effectiveBaselineSubs,
    viewCount: effectiveBaselineViews,
    capturedAt: (plan.startDate || new Date().toISOString().slice(0, 10)) + 'T00:00:00.000Z',
    source: 'watcher',
  };

  // ── DECISION ENGINE (deterministic, phase-aware) ────────────────────────────
  const currentWeek = getCurrentWeek(plan);
  const phaseObj = currentWeek ? getPhaseForWeek(currentWeek.week) : undefined;
  const coachPhase = toCoachPhase(phaseObj?.name);
  const targets = autoTargets(plan);
  const planned = {
    shortsPerWeek: targets.shortsPerWeek || 0,
    postsPerWeek: targets.postsPerWeek || 0,
    videosPerWeek: targets.videosPerWeek || 0,
  };
  const nextDropRaw = getNextDrop(plan);
  const nextDrop = nextDropRaw
    ? { date: nextDropRaw.dateObj.toISOString(), name: nextDropRaw.action.title }
    : null;

  const topVideoForEngine = watcher.state?.topVideoLast14d
    ? { title: watcher.state.topVideoLast14d.title, views: watcher.state.topVideoLast14d.views }
    : null;
  const decision = watcher.state
    ? aiDecisionLayer({ phase: coachPhase, plan: planned, state: watcher.state, events: watcher.events, nextDrop, topVideo: topVideoForEngine })
    : null;
  const cadenceCmp = watcher.state ? cadenceComparison(planned, watcher.state) : null;
  const recent = watcher.state ? recentSignal(watcher.state, watcher.events, topVideoForEngine) : null;

  // Fallback (no watcher data yet): legacy plan-only signal.
  const legacySignal = computeChannelSignal(plan);
  const legacyMeta = CHANNEL_SIGNAL_META[legacySignal];
  const stateMeta = decision ? DECISION_STATE_META[decision.state] : null;

  const headerLabel = decision ? decision.state : legacyMeta.label;
  const headerColor = decision ? stateMeta!.color : legacyMeta.color;
  const headerSubtitle = decision
    ? stateMeta!.subtitle
    : (watcher.insight ? watcher.insight.headline : buildThisWeeksCall(plan, legacySignal));

  const cadenceRowMeta: Record<string, { color: string; bg: string; label: string }> = {
    on_track:        { color: '#1FBE7A', bg: 'rgba(31,190,122,0.14)', label: 'On track' },
    exceeding:       { color: '#1FBE7A', bg: 'rgba(31,190,122,0.20)', label: 'Exceeding' },
    slightly_behind: { color: '#F5B73D', bg: 'rgba(245,183,61,0.16)', label: 'Slightly behind' },
    behind:          { color: '#FF4A1C', bg: 'rgba(255,74,28,0.16)', label: 'Behind' },
  };

  // ── SYSTEM 1 derived values ────────────────────────────────────────────────
  const subDelta = watcher.state?.subscriberDelta ?? null;
  const viewDelta = watcher.state?.viewDelta ?? null;
  const subDeltaFmt = formatDelta(subDelta);
  const viewDeltaFmt = formatDelta(viewDelta);
  const dirColor = (d: 'up' | 'flat' | 'down') => d === 'up' ? '#1FBE7A' : d === 'down' ? '#FF4A1C' : 'rgba(250,247,242,0.45)';
  const dirGlyph = (d: 'up' | 'flat' | 'down') => d === 'up' ? '▲' : d === 'down' ? '▼' : '–';
  const signalLine = watcher.state
    ? subsViewsSignal(subDelta, viewDelta, watcher.state.uploadsLast14Days)
    : (watcher.insight?.headline ?? buildThisWeeksCall(plan, legacySignal));
  const daysSince = watcher.state?.daysSinceLastUpload ?? null;
  const cadenceSummary = cadenceSummaryLine(cadenceCmp);
  const primaryAction = decision ? decision.action : buildThisWeeksCall(plan, legacySignal);

  return (
    <div
      className="mb-6 rounded-2xl p-7"
      style={{
        background: '#0E0E0E',
        color: '#FAF7F2',
        boxShadow: '0 6px 20px rgba(14,14,14,0.18), 0 1px 3px rgba(14,14,14,0.1)',
      }}
    >
      {/* ─── SYSTEM 1 ─────────────────────────────────────────────────────── */}

      {/* 1. DECISION */}
      <div className="mb-7">
        <div
          className="font-black uppercase tracking-[0.04em] leading-none"
          style={{ color: headerColor, fontSize: '34px' }}
        >
          {headerLabel}
        </div>
        <div
          className="mt-2 text-[14px] leading-snug"
          style={{ color: 'rgba(250,247,242,0.70)' }}
        >
          {decision ? stateMeta!.subtitle : headerSubtitle}
        </div>
      </div>

      {/* 2. CHANNEL HEALTH — prominent stat blocks, microsite-style */}
      {watcher.state && (
        <div
          className="mb-7 pb-6"
          style={{ borderBottom: '1px solid rgba(250,247,242,0.08)' }}
        >
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div
                className="text-[10px] font-mono uppercase tracking-[0.18em] mb-2"
                style={{ color: 'rgba(250,247,242,0.45)' }}
              >
                Subscribers
              </div>
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <span className="font-black leading-none" style={{ fontSize: '36px', color: '#FAF7F2' }}>
                  {formatBig(watcher.state.subscriberCount)}
                </span>
                <span className="text-[12px] font-semibold inline-flex items-center gap-1" style={{ color: dirColor(subDeltaFmt.dir) }}>
                  <span>{dirGlyph(subDeltaFmt.dir)}</span>
                  <span>{subDeltaFmt.text} 7d</span>
                </span>
              </div>
            </div>
            <div>
              <div
                className="text-[10px] font-mono uppercase tracking-[0.18em] mb-2"
                style={{ color: 'rgba(250,247,242,0.45)' }}
              >
                Total Views
              </div>
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <span className="font-black leading-none" style={{ fontSize: '36px', color: '#FAF7F2' }}>
                  {formatBig(watcher.state.viewCount)}
                </span>
                <span className="text-[12px] font-semibold inline-flex items-center gap-1" style={{ color: dirColor(viewDeltaFmt.dir) }}>
                  <span>{dirGlyph(viewDeltaFmt.dir)}</span>
                  <span>{viewDeltaFmt.text} 7d</span>
                </span>
              </div>
            </div>
          </div>
          {baseline && watcher.state && (() => {
            // Label: if the baseline snapshot was captured within ~3d of campaign start,
            // call it "since start". Otherwise be honest and show the actual capture date.
            const startMs = plan.startDate ? new Date(plan.startDate + 'T00:00:00').getTime() : null;
            const capMs = new Date(baseline.capturedAt).getTime();
            const usedManualOverride = !!(plan.baselineSubs && plan.baselineViews);
            const nearStart = usedManualOverride || (startMs !== null && Math.abs(capMs - startMs) < 3 * 86400_000);
            const capLabel = new Date(baseline.capturedAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
            const sourceLabel = usedManualOverride
              ? 'since start'
              : nearStart
                ? 'since start'
                : `since ${capLabel}`;
            // Guard: if baseline values look obviously stale (e.g. viewCount=0 from the
            // pre-migration default) skip rendering for that stat rather than showing
            // a nonsense delta.
            const subsValid = baseline.subscriberCount > 0;
            const subsSince = subsValid ? watcher.state.subscriberCount - baseline.subscriberCount : null;
            // Views-since-start from channel-total delta is suppressed (needs a clean
            // historical baseline). Instead we show earned views from content uploaded
            // during the campaign — sum of views on every video/short published on or
            // after campaign start. That's API-accurate and directly attributable.
            const startT = plan.startDate ? new Date(plan.startDate + 'T00:00:00').getTime() : null;
            const campaignVideos = (watcher.state.latestVideos ?? []).filter((v) => {
              if (!startT) return false;
              const t = new Date(v.publishedAt).getTime();
              return !Number.isNaN(t) && t >= startT;
            });
            const earnedViews = campaignVideos.reduce((s, v) => s + (v.views || 0), 0);
            const campaignViewsValid = campaignVideos.length > 0;
            if (subsSince === null && !campaignViewsValid) return null;
            const render = (n: number | null, label: string) => {
              if (n === null) return null;
              const f = formatDelta(n);
              return (
                <span className="inline-flex items-center gap-1">
                  <span style={{ color: dirColor(f.dir) }}>
                    {f.dir !== 'flat' && <span className="mr-0.5">{dirGlyph(f.dir)}</span>}
                    {f.dir === 'flat' ? 'Flat' : f.text}
                  </span>
                  <span style={{ color: 'rgba(250,247,242,0.45)' }}> · {label}</span>
                </span>
              );
            };
            return (
              <div className="mt-3 grid grid-cols-2 gap-6">
                <div className="text-[11px] font-mono uppercase tracking-[0.14em]" style={{ color: 'rgba(250,247,242,0.55)' }}>
                  {subsSince !== null
                    ? render(subsSince, sourceLabel)
                    : <span style={{ color: 'rgba(250,247,242,0.35)' }}>—</span>}
                </div>
                <div className="text-[11px] font-mono uppercase tracking-[0.14em]" style={{ color: 'rgba(250,247,242,0.55)' }}>
                  {campaignViewsValid
                    ? render(earnedViews, `on campaign uploads (${campaignVideos.length})`)
                    : <span style={{ color: 'rgba(250,247,242,0.35)' }}>—</span>}
                </div>
              </div>
            );
          })()}
          <div className="mt-4 flex items-baseline gap-3 flex-wrap">
            <span className="text-[10px] font-mono uppercase tracking-[0.18em]" style={{ color: 'rgba(250,247,242,0.45)' }}>
              Last upload
            </span>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: recencyColor(daysSince) }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: recencyColor(daysSince) }} />
              {recencyLabel(daysSince)}
            </span>
          </div>
        </div>
      )}

      {/* 3. SIGNAL — one line (Behaviour → Problem → Implication) */}
      <div className="mb-5">
        <div
          className="text-[10px] font-mono uppercase tracking-[0.18em] mb-1.5"
          style={{ color: 'rgba(250,247,242,0.45)' }}
        >
          Signal
        </div>
        <p className="text-[15px] leading-snug" style={{ color: '#FAF7F2' }}>
          {signalLine}
        </p>
      </div>

      {/* 4. PRIMARY ACTION — plain, microsite style */}
      <div className="mb-5">
        <div
          className="text-[10px] font-mono uppercase tracking-[0.18em] mb-2"
          style={{ color: 'rgba(250,247,242,0.45)' }}
        >
          Action
        </div>
        <p className="text-[13.5px] font-semibold leading-snug" style={{ color: '#FAF7F2' }}>
          → {primaryAction}
        </p>
        <a
          href="https://studio.youtube.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-semibold transition-opacity hover:opacity-80"
          style={{ color: '#A8B5FF' }}
        >
          Open in YouTube Studio <span aria-hidden>→</span>
        </a>
      </div>

      {/* 5. CADENCE — mono label + status word + detail (microsite style) */}
      {cadenceCmp && (
        <div className="mb-5 flex items-baseline gap-3 flex-wrap">
          <span className="text-[10px] font-mono uppercase tracking-[0.18em]" style={{ color: 'rgba(250,247,242,0.45)' }}>
            Cadence
          </span>
          <span className="text-[14px] font-black uppercase tracking-wider" style={{ color: cadenceSummary.color }}>
            {cadenceSummary.headline.replace(/^Cadence:\s*/, '')}
          </span>
          <span className="text-[12px]" style={{ color: 'rgba(250,247,242,0.55)' }}>
            {cadenceSummary.detail}
          </span>
        </div>
      )}

      {/* "Why this call" dropdown removed — state → signal → action already explains it. */}
    </div>
  );
}

// ──── NEXT DROP ANCHOR ───────────────────────────────────────────────────────
// Primary visual anchor — the next key drop + its role in the narrative

function getDropRole(weekNum: number, type: ActionType): string {
  const phase = getPhaseForWeek(weekNum);
  if (!phase) return 'This is your next upload — build around it';
  if (phase.name === 'BUILD') return 'Warm the channel before your next big drop';
  if (phase.name === 'RELEASE') return 'This is the launch moment — all attention goes here';
  if (phase.name === 'SCALE') return 'Tour + festivals — build reach with every show';
  if (phase.name === 'EXTEND') return "Keep the story going — don't let it fade";
  if (type === 'collab') return 'Crossover drop — brings a new audience in';
  return 'This is your next major upload — build around it';
}

// ── Drop support logic — brutally clear.
// Every drop needs: Shorts + Post + Video support. Count what's planned/done
// in the drop week itself (and ±1 week either side for the support window).
type DropSupportStrength = 'Strong' | 'Partial' | 'Weak';
function computeDropSupport(plan: CampaignPlan, dropWeek: number): {
  strength: DropSupportStrength;
  color: string;
  missing: string[];
  have: { shorts: number; posts: number; videoSupport: number };
} {
  const window = plan.weeks.filter((w) => Math.abs(w.week - dropWeek) <= 1);
  const actions = window.flatMap((w) => w.actions).filter((a) => a.status !== 'missed');
  const shorts = actions.filter((a) => a.type === 'short').length;
  const posts = actions.filter((a) => a.type === 'post' || a.type === 'live' || a.type === 'collab').length;
  // The drop itself is counted as one video; support = any additional videos in window.
  const videoSupport = Math.max(0, actions.filter((a) => a.type === 'video').length - 1);
  const missing: string[] = [];
  if (shorts < 2) missing.push(shorts === 0 ? 'Shorts' : 'More Shorts');
  if (posts < 1) missing.push('Post');
  if (videoSupport < 1) missing.push('Follow-up video');
  let strength: DropSupportStrength = 'Weak';
  let color = '#FF4A1C';
  if (missing.length === 0) { strength = 'Strong'; color = '#1FBE7A'; }
  else if (missing.length === 1) { strength = 'Partial'; color = '#F5B73D'; }
  return { strength, color, missing, have: { shorts, posts, videoSupport } };
}
function dropImplication(strength: DropSupportStrength): string {
  if (strength === 'Strong') return "This release is set up to land — keep cadence through drop week";
  if (strength === 'Partial') return "You're almost supporting this release — don't let it slip";
  return "You're not supporting this release properly — it won't land";
}
function dropAction(
  missing: string[],
  daysAway: number,
  topVideo?: WatcherTopVideo | null,
): string {
  if (missing.length === 0) return 'Hold cadence. No corrective action needed.';
  const window = daysAway >= 0 && daysAway <= 7 ? 'within 48h' : daysAway <= 14 ? 'this week' : 'before drop week';
  const needShorts = missing.find((m) => m.toLowerCase().includes('short'));
  const needPost = missing.includes('Post');
  const needVideo = missing.includes('Follow-up video');
  const clipRef = topVideo
    ? `cut from your top video "${topVideo.title}"`
    : 'cut from your best-performing recent clip';
  const parts: string[] = [];
  if (needShorts) parts.push(needShorts.toLowerCase().includes('more') ? `Post 1 Short ${clipRef}` : `Post 2 Shorts ${clipRef}`);
  if (needPost) parts.push('1 Post linking to the drop');
  if (needVideo) parts.push('1 follow-up Video around the drop');
  return `${parts.join(' + ')} ${window}.`;
}

// System 1 rollup: scans recent/active drops against live uploads and surfaces
// the top 1–2 missing multi-format assets. Renders nothing when the gap is
// trivial — keeps the main view quiet by default.
function CampaignAssetRollup({ plan }: { plan: CampaignPlan }) {
  const watcher = useWatcherChannel();
  const liveVideos = watcher.state?.latestVideos ?? [];
  // Prefer real channel drops (gated to the campaign window) when available.
  const liveTracks = useMemo(() => deriveLiveTracks(watcher.state, plan.startDate), [watcher.state, plan.startDate]);
  const planTracks = useMemo(() => deriveAutoTracks(plan), [plan]);
  const autoTracks = useMemo(
    () => (liveTracks.length > 0 ? liveTracks : planTracks),
    [liveTracks, planTracks],
  );

  const rollup = useMemo(() => {
    if (!watcher.state || liveVideos.length === 0) return null;
    const now = Date.now();
    const campaignStartT = plan.startDate ? new Date(plan.startDate + 'T00:00:00').getTime() : -Infinity;
    // Only drops inside the campaign window and whose release window has opened.
    const eligible = autoTracks.filter((t) => {
      const dt = new Date(t.date).getTime();
      if (Number.isNaN(dt)) return false;
      return dt >= campaignStartT && dt <= now + 3 * 86400_000;
    });
    if (eligible.length === 0) return null;

    const counters = { lyricVideo: 0, artworkVideo: 0, followupLongform: 0 };
    for (const t of eligible) {
      const live = matchLiveToDrop(t.date, liveVideos);
      const sup = getDropSupport(t, live);
      for (const slot of sup.slots) {
        if (slot.hit) continue;
        if (slot.key === 'lyricVideo') counters.lyricVideo++;
        else if (slot.key === 'artworkVideo') counters.artworkVideo++;
        else if (slot.key === 'followupLongform') counters.followupLongform++;
      }
    }

    const items: { label: string; count: number }[] = [];
    if (counters.lyricVideo > 0) items.push({ label: counters.lyricVideo === 1 ? 'Lyric Video' : 'Lyric Videos', count: counters.lyricVideo });
    if (counters.artworkVideo > 0) items.push({ label: counters.artworkVideo === 1 ? 'Visualizer' : 'Visualizers', count: counters.artworkVideo });
    if (counters.followupLongform > 0) items.push({ label: counters.followupLongform === 1 ? 'Follow-up Video' : 'Follow-up Videos', count: counters.followupLongform });
    items.sort((a, b) => b.count - a.count);
    const total = items.reduce((s, i) => s + i.count, 0);
    if (total <= 1) return null;
    return items.slice(0, 2);
  }, [autoTracks, watcher.state, liveVideos, plan.startDate]);

  if (!rollup) return null;

  return (
    <div
      className="mt-3 rounded-xl px-4 py-2.5 flex items-center gap-3"
      style={{ background: '#FAF7F2', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
    >
      <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink/45 shrink-0">
        Across Recent Drops
      </span>
      <span className="text-[12px] font-semibold truncate" style={{ color: '#FF4A1C' }}>
        {rollup.map((r) => `${r.count} ${r.label} missing`).join(' · ')}
      </span>
    </div>
  );
}

function NextDropAnchor({ plan }: { plan: CampaignPlan }) {
  const watcher = useWatcherChannel();
  const drop = getNextDrop(plan);
  if (!drop) return null;

  const iso = drop.action.date || drop.dateObj.toISOString().slice(0, 10);
  const dateStr = fmtDate(iso);
  const dayStr = fmtDay(iso);
  const daysAway = drop.daysAway;
  const timeLabel = daysAway < 0
    ? `${Math.abs(daysAway)}d overdue`
    : daysAway === 0
    ? 'Today'
    : daysAway === 1
    ? 'Tomorrow'
    : `${daysAway}d away`;
  const urgencyColor = daysAway < 0 ? '#FF4A1C' : daysAway <= 6 ? '#FF4A1C' : daysAway <= 14 ? '#FFD24C' : '#1FBE7A';
  const phase = getPhaseForWeek(drop.weekNum);
  const support = computeDropSupport(plan, drop.weekNum);
  const rule = 'This moment needs: 2 Shorts + 1 Post + 1 follow-up Video';
  const implication = dropImplication(support.strength);
  const action = dropAction(support.missing, daysAway, watcher.state?.topVideoLast14d ?? null);

  return (
    <div
      className="mb-6 rounded-2xl p-5 relative overflow-hidden"
      style={{ background: '#0E0E0E', color: '#FAF7F2', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}
    >
      <div
        className="absolute top-0 left-0 h-full w-1.5"
        style={{ background: phase?.color || urgencyColor }}
      />
      <div className="pl-3">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: 'rgba(250,247,242,0.5)' }}>
            Next Drop
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold" style={{ color: urgencyColor }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: urgencyColor }} />
            <span>{timeLabel}</span>
          </div>
        </div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h3 className="text-xl font-black tracking-tight leading-tight">{drop.action.title}</h3>
          <span className="text-xs font-semibold" style={{ color: 'rgba(250,247,242,0.55)' }}>
            {dateStr} · {dayStr}
          </span>
        </div>
        {drop.action.featuredArtist && (
          <div className="text-[11px] font-semibold mt-0.5" style={{ color: 'rgba(250,247,242,0.6)' }}>
            ft. {drop.action.featuredArtist}
          </div>
        )}

        {/* Support strength — Strong / Partial / Weak */}
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(250,247,242,0.12)' }}>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-[10px] font-mono uppercase tracking-[0.18em]" style={{ color: 'rgba(250,247,242,0.45)' }}>
              Support
            </span>
            <span className="text-[18px] font-black uppercase tracking-wider" style={{ color: support.color }}>
              {support.strength}
            </span>
          </div>

          {/* Missing list — simple */}
          {support.missing.length > 0 && (
            <div className="mt-2.5">
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] mb-1" style={{ color: 'rgba(250,247,242,0.45)' }}>
                Missing
              </div>
              <div className="flex flex-wrap gap-1.5">
                {support.missing.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[11.5px] font-semibold"
                    style={{ background: 'rgba(255,74,28,0.12)', color: '#FF4A1C' }}
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Rule · Implication · Action — the three human lines */}
          <div className="mt-3.5 space-y-1.5">
            <p className="text-[12.5px]" style={{ color: 'rgba(250,247,242,0.60)' }}>
              {rule}
            </p>
            <p className="text-[13px] leading-snug" style={{ color: support.color }}>
              {implication}
            </p>
            <p className="text-[13.5px] font-semibold leading-snug" style={{ color: '#FAF7F2' }}>
              → {action}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──── CAMPAIGN ACTIVITY CARD ─────────────────────────────────────────────────
// Instant read: how much has shipped this week vs target + any boosts used.

function isCollabAction(a: CampaignAction): boolean {
  return a.type === 'collab' || a.distribution?.collab === true;
}

function getCollabsThisWeek(plan: CampaignPlan): number {
  const wk = getCurrentWeek(plan);
  if (!wk) return 0;
  return wk.actions.filter((a) => a.status === 'done' && isCollabAction(a)).length;
}

// ──── PULSE STRIP ───────────────────────────────────────────────────────────
// One compact, three-row pulse check: LIVE ACTIVITY · THIS WEEK · COVERAGE.
// Replaces CampaignActivityCard + CampaignAssetRollup + DropView's internal
// output/coverage blocks. Keeps the real YouTube API activity visible but
// framed as proof-of-activity, not a dashboard.
function PulseStrip({ plan }: { plan: CampaignPlan }) {
  const watcher = useWatcherChannel();
  const liveVideos = watcher.state?.latestVideos ?? [];
  const startT = plan.startDate ? new Date(plan.startDate + 'T00:00:00').getTime() : -Infinity;
  const liveVideosInWindow = liveVideos.filter((v) => new Date(v.publishedAt).getTime() >= startT);
  const liveTracks = useMemo(() => deriveLiveTracks(watcher.state, plan.startDate), [watcher.state, plan.startDate]);
  const planTracks = useMemo(() => deriveAutoTracks(plan), [plan]);
  const autoTracks = useMemo(
    () => (liveTracks.length > 0 ? liveTracks : planTracks),
    [liveTracks, planTracks],
  );
  const liveByTrackId = useMemo(() => {
    const map: Record<string, LiveMatch> = {};
    for (const t of autoTracks) map[t.id] = matchLiveToDrop(t.date, liveVideos);
    return map;
  }, [autoTracks, liveVideos]);
  const isLiveMode = liveTracks.length > 0;

  // Row 1 — LIVE ACTIVITY (real API numbers; proof of activity)
  const liveShorts = liveVideosInWindow.filter((v) => v.kind === 'short').length;
  const liveLongform = liveVideosInWindow.filter((v) => v.kind === 'video').length;
  const liveSupport = liveShorts + Math.max(0, liveLongform - autoTracks.length);
  const totalDrops = autoTracks.length;

  // Row 2 — THIS WEEK cadence (merge plan-done + live uploads from API)
  const counts = getCadenceCounts(plan);
  // Count live uploads published within this ISO week (Mon→Sun).
  const now = new Date();
  const dow = now.getDay(); // 0=Sun..6=Sat
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() + mondayOffset);
  const weekStartMs = weekStart.getTime();
  const liveThisWeek = liveVideos.filter((v) => {
    const t = new Date(v.publishedAt).getTime();
    return !Number.isNaN(t) && t >= weekStartMs;
  });
  const liveShortsWeek    = liveThisWeek.filter((v) => v.kind === 'short').length;
  const liveLongformWeek  = liveThisWeek.filter((v) => v.kind === 'video').length;
  // Merge: max of plan-done vs live counts so live activity can cover the week.
  const mergedShortsDone   = Math.max(counts.shortsDone,   liveShortsWeek);
  const mergedLongformDone = Math.max(counts.longformDone, liveLongformWeek);
  const rows = [
    { key: 'shorts', label: 'Shorts', done: mergedShortsDone,   target: counts.shortsTarget,   live: liveShortsWeek },
    { key: 'posts',  label: 'Posts',  done: counts.postsDone,    target: counts.postsTarget,   live: 0 },
    { key: 'videos', label: 'Videos', done: mergedLongformDone, target: counts.longformTarget, live: liveLongformWeek },
  ];
  const totalDone   = mergedShortsDone + counts.postsDone + mergedLongformDone;
  const totalTarget = counts.shortsTarget + counts.postsTarget + counts.longformTarget;
  const allMet = rows.every((r) => r.target === 0 || r.done >= r.target);
  const weekStatus = totalDone === 0
    ? { label: 'Ready to start',      color: '#0E0E0E' }
    : (allMet || (totalTarget > 0 && totalDone >= totalTarget))
    ? { label: 'On track',            color: '#1FBE7A' }
    : { label: 'Building momentum',   color: '#C58F12' };
  const rowColor = (done: number, target: number) =>
    target === 0 || done >= target ? '#1FBE7A' : 'rgba(14,14,14,0.55)';

  // Row 3 — COVERAGE + missing + fix (respects community-post taps)
  const communityPostDone = plan.manualOverrides?.communityPostDone || {};
  const intel = totalDrops > 0 ? getCampaignIntelligence(autoTracks, liveByTrackId, communityPostDone) : null;
  const tierColor = intel ? COVERAGE_COLOR[intel.tier] : '#0E0E0E';

  const divider = { borderTop: '1px solid rgba(14,14,14,0.08)' };

  return (
    <div className="mb-5 rounded-2xl overflow-hidden" style={{ background: '#FAF7F2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      {/* Row 1 — LIVE ACTIVITY */}
      {watcher.state && (
        <div className="flex items-center justify-between gap-3 px-5 py-2.5">
          <div className="flex items-center gap-4 min-w-0 text-[12px] font-semibold text-ink/75">
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink/45 shrink-0">Live Activity</span>
            <span><span className="font-black text-ink">{liveShorts}</span> <span className="text-ink/55">Shorts</span></span>
            <span className="text-ink/25">·</span>
            <span><span className="font-black text-ink">{totalDrops}</span> <span className="text-ink/55">{totalDrops === 1 ? 'Drop' : 'Drops'}</span></span>
            <span className="text-ink/25">·</span>
            <span><span className="font-black text-ink">{isLiveMode ? liveSupport : 0}</span> <span className="text-ink/55">Support</span></span>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-ink/35 shrink-0">YouTube API</span>
        </div>
      )}
      {/* Row 2 — THIS WEEK */}
      <div className="flex items-center justify-between gap-3 px-5 py-2.5" style={watcher.state ? divider : undefined}>
        <div className="flex items-center gap-4 min-w-0 text-[12px] font-semibold text-ink/75">
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink/45 shrink-0">This Week</span>
          {rows.map((r) => (
            <span key={r.key} className="flex items-baseline gap-1">
              <span className="font-black tabular-nums" style={{ color: rowColor(r.done, r.target) }}>{r.done}</span>
              <span className="text-ink/30">/{r.target}</span>
              <span className="text-ink/55 ml-0.5">{r.label}</span>
              {r.live > 0 && (
                <span
                  className="ml-1 text-[9px] font-bold uppercase tracking-[0.12em]"
                  style={{ color: '#1FBE7A' }}
                  title={`${r.live} live from YouTube this week`}
                >
                  · {r.live} live
                </span>
              )}
            </span>
          ))}
        </div>
        <span className="text-[11px] font-black uppercase tracking-[0.14em] shrink-0" style={{ color: weekStatus.color }}>
          {weekStatus.label}
        </span>
      </div>
      {/* Row 3 — COVERAGE */}
      {intel && (
        <div className="flex items-center justify-between gap-3 px-5 py-2.5" style={divider}>
          <div className="flex items-center gap-3 min-w-0 text-[12px] font-semibold text-ink/75">
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink/45 shrink-0">Coverage</span>
            <span className="text-[13px] font-black uppercase tracking-wider" style={{ color: tierColor }}>{intel.tier}</span>
            <span className="text-ink/25">·</span>
            <span className="text-ink/70 truncate">{intel.summary}</span>
            {intel.missingLabels.length > 0 && (
              <>
                <span className="text-ink/25">·</span>
                <span className="truncate" style={{ color: '#FF4A1C' }}>
                  Missing: {intel.missingLabels.join(' · ')}
                </span>
              </>
            )}
          </div>
          <span className="text-[11px] font-bold shrink-0 text-ink/80">→ {intel.fix}</span>
        </div>
      )}
    </div>
  );
}

function CampaignActivityCard({ plan }: { plan: CampaignPlan }) {
  const counts = getCadenceCounts(plan);
  const collabs = getCollabsThisWeek(plan);

  const rows = [
    { key: 'shorts', label: 'Shorts', done: counts.shortsDone,   target: counts.shortsTarget },
    { key: 'posts',  label: 'Posts',  done: counts.postsDone,    target: counts.postsTarget },
    { key: 'videos', label: 'Videos', done: counts.longformDone, target: counts.longformTarget },
  ];

  // Forward-looking status: Ready → Building → On track. No "Behind".
  const totalDone   = counts.shortsDone + counts.postsDone + counts.longformDone;
  const totalTarget = counts.shortsTarget + counts.postsTarget + counts.longformTarget;
  const allMet = rows.every((r) => r.target === 0 || r.done >= r.target);

  let statusLabel: string;
  let statusColor: string;
  if (totalDone === 0) {
    statusLabel = 'Ready to start';
    statusColor = '#0E0E0E';
  } else if (allMet || (totalTarget > 0 && totalDone >= totalTarget)) {
    statusLabel = 'On track';
    statusColor = '#1FBE7A';
  } else {
    statusLabel = 'Building momentum';
    statusColor = '#FFD24C';
  }

  // Numbers stay calm — completed rows go green, everything else is neutral ink.
  const rowStatusColor = (done: number, target: number): string => {
    if (target === 0) return '#1FBE7A';
    if (done >= target) return '#1FBE7A';
    return 'rgba(14,14,14,0.55)';
  };

  // One-line weekly cadence summary — compact, scannable.
  return (
    <div className="mb-4 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl" style={{ background: '#F6F1E7' }}>
      <div className="flex items-center gap-4 min-w-0 text-[12px] font-bold text-ink/70">
        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink/45">This week</span>
        {rows.map((r) => (
          <span key={r.key} className="flex items-baseline gap-1">
            <span className="font-black tabular-nums" style={{ color: rowStatusColor(r.done, r.target) }}>{r.done}</span>
            <span className="text-ink/30">/{r.target}</span>
            <span className="text-ink/55 ml-0.5">{r.label}</span>
          </span>
        ))}
        {collabs > 0 && (
          <span className="text-ink/55">· Collab ×{collabs}</span>
        )}
      </div>
      <span
        className="text-[11px] font-black uppercase tracking-[0.14em] shrink-0"
        style={{ color: statusColor }}
      >
        {statusLabel}
      </span>
    </div>
  );
}

// ──── METRIC CARDS ───────────────────────────────────────────────────────────
// 4 large full-width cards in 2x2 grid for immediate understanding
// Priority order for auto-detecting next drop
const DROP_PRIORITY: Record<ActionType, number> = {
  video: 1, live: 2, collab: 3, short: 4, afterparty: 5, post: 6, playlist: 7,
};

// Key drop types — only these appear in the Next Drop card
const KEY_DROP_TYPES = new Set<ActionType>(['video', 'collab', 'live', 'afterparty']);

// ── REUSABLE: getNextDrop ────────────────────────────────────────────────────
// Returns the earliest future (or today/overdue) key drop from campaign data.
// Excludes shorts, posts, community, support clips, playlists.
function getNextDrop(plan: CampaignPlan): { action: CampaignAction; weekNum: number; dateObj: Date; daysAway: number } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const candidates: { action: CampaignAction; weekNum: number; dateObj: Date }[] = [];
  for (const w of plan.weeks) {
    for (const a of w.actions) {
      if (a.status === 'done') continue;
      if (!KEY_DROP_TYPES.has(a.type)) continue;
      const actionDate = a.date
        ? new Date(a.date + 'T12:00:00')
        : new Date(new Date(plan.startDate + 'T12:00:00').getTime() + (w.week - 1) * 7 * 24 * 60 * 60 * 1000);
      candidates.push({ action: a, weekNum: w.week, dateObj: actionDate });
    }
  }

  // Sort by date ascending (earliest first)
  candidates.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  // Pick earliest future/today item; if none, pick most recent overdue
  const futureOrToday = candidates.filter((c) => c.dateObj >= today);
  const pick = futureOrToday.length > 0 ? futureOrToday[0] : (candidates.length > 0 ? candidates[candidates.length - 1] : null);
  if (!pick) return null;

  const daysAway = Math.round((pick.dateObj.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  return { ...pick, daysAway };
}

function MetricCards({ plan, editingMetric, metricDraft, onEditStart, onEditChange, onEditSave, onEditCancel }: {
  plan: CampaignPlan;
  editingMetric: string | null;
  metricDraft: string;
  onEditStart: (metric: string, value: string) => void;
  onEditChange: (value: string) => void;
  onEditSave: (metric: string, value: string) => void;
  onEditCancel: () => void;
}) {
  const targets = autoTargets(plan);
  const startingSubs = plan.subscriberCount;
  const overrides = plan.manualOverrides || {};
  const subsGained = plan.weeks.reduce((sum, w) => sum + (w.feedback?.subsGained || 0), 0);
  const watcher = useWatcherChannel();
  // System 1 hero owns the live numbers — hide this card when watcher is feeding TopSignalCard.
  if (watcher.state) return null;
  const currentSubs = overrides.currentSubs ?? (startingSubs + subsGained);
  const subsProgress = targets.subsTarget > startingSubs ? Math.min(100, Math.round(((currentSubs - startingSubs) / (targets.subsTarget - startingSubs)) * 100)) : 0;

  const totalViews = overrides.totalViews ?? plan.weeks.reduce((sum, w) => sum + (w.feedback?.views || 0), 0);
  const viewsProgress = targets.viewsTarget > 0 ? Math.min(100, Math.round((totalViews / targets.viewsTarget) * 100)) : 0;

  let activeWeekCount = 0;
  for (const w of plan.weeks) {
    if (w.actions.some((a) => a.status === 'done' || a.status === 'missed')) activeWeekCount++;
  }
  const totalWeeks = plan.weeks.length;
  const viewsExpectedByNow = activeWeekCount > 0 && totalWeeks > 0
    ? Math.round((targets.viewsTarget / totalWeeks) * activeWeekCount) : 0;
  const viewsAhead = totalViews >= viewsExpectedByNow;

  const doneActions = plan.weeks.flatMap((w) => w.actions.filter((a) => a.status === 'done'));
  const shortsCount = doneActions.filter((a) => a.type === 'short').length;
  const videosCount = doneActions.filter((a) => a.type === 'video').length;
  const expectedShorts = targets.shortsPerWeek * activeWeekCount;
  const expectedVideos = targets.videosPerWeek * activeWeekCount;
  const shortsOnTrack = shortsCount >= expectedShorts * 0.8;
  const videosOnTrack = videosCount >= expectedVideos * 0.8;

  const EditableNum = ({ metricKey, displayValue, rawValue }: { metricKey: string; displayValue: string; rawValue: number }) => {
    if (editingMetric === metricKey) {
      return (
        <input type="number" autoFocus value={metricDraft}
          onChange={(e) => onEditChange(e.target.value)}
          onBlur={() => onEditSave(metricKey, metricDraft)}
          onKeyDown={(e) => { if (e.key === 'Enter') onEditSave(metricKey, metricDraft); if (e.key === 'Escape') onEditCancel(); }}
          className="text-lg font-black bg-paper border border-ink/12 rounded px-2 py-1 w-32 outline-none focus:border-ink/50" />
      );
    }
    return (
      <button onClick={() => onEditStart(metricKey, rawValue.toString())}
        className="text-lg font-black text-ink hover:text-ink/60 transition-colors cursor-pointer">
        {displayValue}
      </button>
    );
  };

  const ProgressBar = ({ pct, color }: { pct: number; color: string }) => (
    <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.05)' }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(2, pct)}%`, background: color }} />
    </div>
  );

  // Subs growth indicator (used to colour the progress bar only — no status copy)
  const subsOnPace = subsProgress >= Math.round((activeWeekCount / Math.max(1, totalWeeks)) * 100);

  const fmtViewsTarget = targets.viewsTarget >= 1000000
    ? `${(targets.viewsTarget / 1000000).toFixed(targets.viewsTarget % 1000000 === 0 ? 0 : 1)}M`
    : targets.viewsTarget.toLocaleString();

  return (
    <div className="mb-4">
      {/* Subs + Views — calm context panels, no "tracking below plan" commentary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl px-4 py-3" style={{ background: '#F6F1E7' }}>
          <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/30 mb-1">Subscribers</div>
          <div className="flex items-baseline gap-2">
            <EditableNum metricKey="currentSubs" displayValue={formatSubs(currentSubs)} rawValue={currentSubs} />
            <span className="text-[10px] font-semibold text-ink/40">/ {formatSubs(targets.subsTarget)}</span>
          </div>
          <div className="mt-1.5"><ProgressBar pct={subsProgress} color={subsOnPace ? '#1FBE7A' : '#FFD24C'} /></div>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ background: '#F6F1E7' }}>
          <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/30 mb-1">Views</div>
          <div className="flex items-baseline gap-2">
            <EditableNum metricKey="views" displayValue={totalViews.toLocaleString()} rawValue={totalViews} />
            <span className="text-[10px] font-semibold text-ink/40">/ {fmtViewsTarget}</span>
          </div>
          <div className="mt-1.5"><ProgressBar pct={viewsProgress} color={viewsAhead ? '#1FBE7A' : '#FFD24C'} /></div>
        </div>
      </div>
    </div>
  );
}


// ──── METRICS MODAL ─────────────────────────────────────────────────────────
// Retired — targets are now auto-derived by autoTargets(plan) based on the
// channel's starting subs and the planned drop count. No manual input needed.
// The function below is kept as a no-op for any stale references; the render
// path below is unreachable and intentionally unused.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _UnusedLegacyMetricsModal({ plan, onSave, onClose }: {
  plan: CampaignPlan;
  onSave: (updates: Partial<CampaignPlan>) => void;
  onClose: () => void;
}) {
  const t = autoTargets(plan);
  const [startingSubs, setStartingSubs] = useState(plan.subscriberCount.toString());
  const [startDate, setStartDate] = useState(plan.startDate);
  const [subsTarget, setSubsTarget] = useState(t.subsTarget.toString());
  const [viewsTarget, setViewsTarget] = useState(t.viewsTarget.toString());
  const [shortsPerWeek, setShortsPerWeek] = useState(t.shortsPerWeek.toString());
  const [videosPerWeek, setVideosPerWeek] = useState(t.videosPerWeek.toString());

  const handleSave = () => {
    onSave({
      subscriberCount: Math.max(0, parseInt(startingSubs, 10) || 0),
      startDate,
      targets: {
        subsTarget: Math.max(0, parseInt(subsTarget, 10) || 0),
        viewsTarget: Math.max(0, parseInt(viewsTarget, 10) || 0),
        shortsPerWeek: Math.max(0, parseInt(shortsPerWeek, 10) || 0),
        videosPerWeek: Math.max(0, parseInt(videosPerWeek, 10) || 0),
        postsPerWeek: t.postsPerWeek || 3,
        communityPerWeek: t.communityPerWeek || 2,
      },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/25" />
      <div className="relative w-full max-w-md mx-4 rounded-2xl overflow-hidden" style={{ background: '#F6F1E7', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <h3 className="text-base font-black text-ink">Campaign Targets</h3>
          <button onClick={onClose} className="text-ink/40 hover:text-ink/70 transition-colors text-lg">×</button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
          <div className="text-[10px] font-bold uppercase tracking-widest text-ink/40 mb-1">Baseline</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-ink/40 mb-1">Starting Subs</label>
              <input type="text" value={startingSubs} onChange={(e) => setStartingSubs(e.target.value)}
                className="w-full text-sm font-semibold text-ink bg-paper border border-ink/8 rounded-lg px-3 py-2 outline-none focus:border-ink/40 transition-colors" />
              <p className="text-[10px] text-ink/40 mt-1">Subscriber count at campaign start</p>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-ink/40 mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-sm font-semibold text-ink bg-paper border border-ink/8 rounded-lg px-3 py-2 outline-none focus:border-ink/40 transition-colors" />
              <p className="text-[10px] text-ink/40 mt-1">Week 1 starts from this date</p>
            </div>
          </div>

          <div className="h-px" style={{ background: 'rgba(0,0,0,0.06)' }} />

          <div className="text-[10px] font-bold uppercase tracking-widest text-ink/40 mb-1">Growth Targets</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-ink/40 mb-1">Sub Target</label>
              <input type="text" value={subsTarget} onChange={(e) => setSubsTarget(e.target.value)}
                className="w-full text-sm font-semibold text-ink bg-paper border border-ink/8 rounded-lg px-3 py-2 outline-none focus:border-ink/40 transition-colors" />
              <p className="text-[10px] text-ink/40 mt-1">Goal subscriber count</p>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-ink/40 mb-1">Views Target</label>
              <input type="text" value={viewsTarget} onChange={(e) => setViewsTarget(e.target.value)}
                className="w-full text-sm font-semibold text-ink bg-paper border border-ink/8 rounded-lg px-3 py-2 outline-none focus:border-ink/40 transition-colors" />
              <p className="text-[10px] text-ink/40 mt-1">Total campaign views goal</p>
            </div>
          </div>

          <div className="h-px" style={{ background: 'rgba(0,0,0,0.06)' }} />

          <div className="text-[10px] font-bold uppercase tracking-widest text-ink/40 mb-1">Output Targets</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-ink/40 mb-1">Shorts / Week</label>
              <input type="text" value={shortsPerWeek} onChange={(e) => setShortsPerWeek(e.target.value)}
                className="w-full text-sm font-semibold text-ink bg-paper border border-ink/8 rounded-lg px-3 py-2 outline-none focus:border-ink/40 transition-colors" />
              <p className="text-[10px] text-ink/40 mt-1">Target shorts per week</p>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-ink/40 mb-1">Videos / Week</label>
              <input type="text" value={videosPerWeek} onChange={(e) => setVideosPerWeek(e.target.value)}
                className="w-full text-sm font-semibold text-ink bg-paper border border-ink/8 rounded-lg px-3 py-2 outline-none focus:border-ink/40 transition-colors" />
              <p className="text-[10px] text-ink/40 mt-1">Target videos per week</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 flex justify-end gap-3" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <button onClick={onClose} className="text-xs font-semibold px-4 py-2 rounded-lg text-ink/60 hover:bg-cream transition-colors">Cancel</button>
          <button onClick={handleSave} className="text-xs font-bold px-4 py-2 rounded-lg bg-ink text-white hover:bg-ink/80 transition-colors">Save</button>
        </div>
      </div>
    </div>
  );
}


// ──── ACTIVITY CONTEXT LINE ──────────────────────────────────────────────────
// Lightweight, factual activity summary — no causal claims, two-line layout
function ActivityContextLine({ plan }: { plan: CampaignPlan }) {
  const [copied, setCopied] = useState(false);
  const targets = autoTargets(plan);

  // Current week by calendar
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const campaignStart = new Date(plan.startDate + 'T12:00:00');
  const daysSinceStart = Math.floor((today.getTime() - campaignStart.getTime()) / (24 * 60 * 60 * 1000));
  const weekNum = Math.max(1, Math.min(plan.weeks.length, Math.floor(daysSinceStart / 7) + 1));
  const currentWeek = plan.weeks.find((w) => w.week === weekNum);

  // This week counts
  const thisWeek = { shorts: 0, videos: 0, collabs: 0, posts: 0, lives: 0 };
  if (currentWeek) {
    for (const a of currentWeek.actions) {
      if (a.status !== 'done') continue;
      switch (a.type) {
        case 'short': thisWeek.shorts++; break;
        case 'video': thisWeek.videos++; break;
        case 'collab': thisWeek.collabs++; break;
        case 'live': thisWeek.lives++; break;
        case 'post': case 'afterparty': thisWeek.posts++; break;
      }
    }
  }

  // Campaign totals
  const totals = { shorts: 0, videos: 0, collabs: 0, posts: 0, lives: 0 };
  for (const week of plan.weeks) {
    for (const a of week.actions) {
      if (a.status !== 'done') continue;
      switch (a.type) {
        case 'short': totals.shorts++; break;
        case 'video': totals.videos++; break;
        case 'collab': totals.collabs++; break;
        case 'live': totals.lives++; break;
        case 'post': case 'afterparty': totals.posts++; break;
      }
    }
  }

  const totalDone = totals.shorts + totals.videos + totals.collabs + totals.posts + totals.lives;

  // Rule-based status signals — observable only, max 3
  const signals: string[] = [];
  if (currentWeek) {
    const weekShortsDone = currentWeek.actions.filter((a) => a.type === 'short' && a.status === 'done').length;
    const weekVideosDone = currentWeek.actions.filter((a) => a.type === 'video' && a.status === 'done').length;
    const weekPostsDone = currentWeek.actions.filter((a) => (a.type === 'post' || a.type === 'afterparty') && a.status === 'done').length;
    if (weekShortsDone < targets.shortsPerWeek) signals.push('Shorts behind');
    if (targets.videosPerWeek > 0 && weekVideosDone === 0) signals.push('Longform missing');
    if (weekPostsDone === 0 && (targets.postsPerWeek || 0) > 0) signals.push('No posts');
  }

  // Action line — what needs doing
  const actionParts: string[] = [];
  if (currentWeek) {
    const shortGap = Math.max(0, targets.shortsPerWeek - thisWeek.shorts);
    const videoGap = Math.max(0, targets.videosPerWeek - thisWeek.videos);
    const postGap = Math.max(0, (targets.postsPerWeek || 3) - thisWeek.posts);
    if (shortGap > 0) actionParts.push(`drop ${shortGap} short${shortGap > 1 ? 's' : ''}`);
    if (postGap > 0) actionParts.push(`post + engage ${postGap}x`);
    if (videoGap > 0) actionParts.push(`upload ${videoGap} longform`);
  }
  if (actionParts.length > 0) actionParts[0] = actionParts[0].charAt(0).toUpperCase() + actionParts[0].slice(1);
  const actionLine = actionParts.join(' + ');

  // Build display parts
  const fmtParts = (o: typeof thisWeek) => [
    o.shorts > 0 ? `${o.shorts} Shorts` : null,
    o.videos > 0 ? `${o.videos} Video${o.videos > 1 ? 's' : ''}` : null,
    o.collabs > 0 ? `${o.collabs} Collab${o.collabs > 1 ? 's' : ''}` : null,
    o.posts > 0 ? `${o.posts} Post${o.posts > 1 ? 's' : ''}` : null,
    o.lives > 0 ? `${o.lives} Live${o.lives > 1 ? 's' : ''}` : null,
  ].filter(Boolean) as string[];

  const thisWeekLabel = fmtParts(thisWeek);
  const totalLabel = fmtParts(totals);

  // Copy summary
  const handleCopy = () => {
    const phaseName = getPhaseForWeek(weekNum)?.name || 'BUILD';
    const campaignLabel = [plan.artist, plan.campaignName].filter(Boolean).join(' — ') || 'Campaign';
    const totalSubsGained = plan.weeks.reduce((sum, w) => sum + (w.feedback?.subsGained || 0), 0);
    const overrides = plan.manualOverrides || {};
    const totalViews = overrides.totalViews ?? plan.weeks.reduce((sum, w) => sum + (w.feedback?.views || 0), 0);

    const lines = [
      `${campaignLabel} — Week ${weekNum}`,
      `Phase: ${phaseName}`,
      '',
      `This week: ${thisWeekLabel.length > 0 ? thisWeekLabel.join(' · ') : 'No activity'}`,
      `Total: ${totalLabel.length > 0 ? totalLabel.join(' · ') : 'No content yet'}`,
      '',
      `Growth: +${totalSubsGained.toLocaleString()} subs · ${totalViews.toLocaleString()} views`,
      signals.length > 0 ? `Status: ${signals.join(' · ')}` : '',
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Don't render if there are no issues to surface
  if (signals.length === 0) {
    return (
      <div className="mb-4 px-1">
        <div className="flex items-start justify-between gap-4">
          <div className="text-[11px] leading-relaxed text-ink/40 min-w-0">
            <span className="font-semibold text-ink/50">Campaign total:</span>{' '}
            {totalDone > 0 ? totalLabel.join(' · ') : 'No content yet'}
          </div>
          <button
            onClick={handleCopy}
            className="text-[10px] font-semibold px-2.5 py-1 rounded-md border border-ink/8 text-ink/40 hover:bg-paper hover:text-ink/60 transition-all whitespace-nowrap shrink-0 mt-0.5"
          >
            {copied ? '✓ Copied' : 'Copy Update'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 px-1">
      <div className="flex items-start justify-between gap-4">
        <div className="text-[11px] leading-relaxed min-w-0">
          {/* Issues → Action (rhythm card owns this-week data) */}
          <div>
            <span className="font-semibold" style={{ color: '#d97706' }}>
              {signals.join(' · ')}
            </span>
            {actionLine && (
              <>
                <span className="text-ink/30 ml-2">→</span>
                <span className="ml-1.5 text-ink/40">{actionLine}</span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={handleCopy}
          className="text-[10px] font-semibold px-2.5 py-1 rounded-md border border-ink/8 text-ink/40 hover:bg-paper hover:text-ink/60 transition-all whitespace-nowrap shrink-0 mt-0.5"
        >
          {copied ? '✓ Copied' : 'Copy Update'}
        </button>
      </div>
    </div>
  );
}


// ──── NEXT DROP MODAL ─────────────────────────────────────────────────────────
// Edit the next upcoming campaign drop: title, date, type, goal, checklist
function NextDropModal({ moment, dropEdit, onSave, onClose }: {
  moment: CampaignMoment;
  dropEdit?: NextDropEdit;
  onSave: (weekNum: number, edit: NextDropEdit) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(dropEdit?.name || moment.name);
  const [type, setType] = useState<CampaignMoment['type']>(dropEdit?.type || moment.type);
  const [goal, setGoal] = useState(dropEdit?.goal || moment.why);
  const [checklist, setChecklist] = useState<string[]>(dropEdit?.checklist || [moment.prepNote]);
  const [newItem, setNewItem] = useState('');

  const handleSave = () => {
    onSave(moment.weekNum, { name, weekNum: moment.weekNum, type, goal, checklist: checklist.filter(Boolean) });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/25" />
      <div className="relative w-full max-w-md mx-4 rounded-2xl overflow-hidden" style={{ background: '#F6F1E7', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <h3 className="text-base font-black text-ink">Edit Next Drop</h3>
          <button onClick={onClose} className="text-ink/40 hover:text-ink/70 transition-colors text-lg">×</button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink/40 mb-1">Title</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full text-sm font-semibold text-ink bg-paper border border-ink/8 rounded-lg px-3 py-2 outline-none focus:border-ink/40" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-ink/40 mb-1">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as CampaignMoment['type'])}
                className="w-full text-sm font-semibold text-ink bg-paper border border-ink/8 rounded-lg px-3 py-2 outline-none focus:border-ink/40">
                {MOMENT_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-ink/40 mb-1">Week</label>
              <div className="text-sm font-semibold text-ink/60 bg-paper border border-ink/8 rounded-lg px-3 py-2">Week {moment.weekNum}</div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink/40 mb-1">Goal</label>
            <textarea value={goal} onChange={(e) => setGoal(e.target.value)}
              className="w-full text-sm text-ink bg-paper border border-ink/8 rounded-lg px-3 py-2 outline-none focus:border-ink/40 h-16 resize-none" />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink/40 mb-2">Prep Checklist</label>
            <div className="space-y-2">
              {checklist.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-ink/40">{i + 1}.</span>
                  <input type="text" value={item}
                    onChange={(e) => { const next = [...checklist]; next[i] = e.target.value; setChecklist(next); }}
                    className="flex-1 text-sm text-ink bg-paper border border-ink/8 rounded-lg px-3 py-1.5 outline-none focus:border-ink/40" />
                  <button onClick={() => setChecklist(checklist.filter((_, j) => j !== i))}
                    className="text-ink/40 hover:text-red-500 text-xs">×</button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input type="text" value={newItem} placeholder="Add item..."
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && newItem.trim()) { setChecklist([...checklist, newItem.trim()]); setNewItem(''); } }}
                  className="flex-1 text-sm text-ink/50 bg-paper border border-dashed border-ink/12 rounded-lg px-3 py-1.5 outline-none focus:border-ink/40" />
                <button onClick={() => { if (newItem.trim()) { setChecklist([...checklist, newItem.trim()]); setNewItem(''); } }}
                  className="text-xs font-bold text-ink/50 hover:text-ink/70 px-2 py-1">+</button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 flex justify-end gap-3" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <button onClick={onClose} className="text-xs font-semibold px-4 py-2 rounded-lg text-ink/60 hover:bg-cream transition-colors">Cancel</button>
          <button onClick={handleSave} className="text-xs font-bold px-4 py-2 rounded-lg bg-ink text-white hover:bg-ink/80 transition-colors">Save</button>
        </div>
      </div>
    </div>
  );
}

// ──── CHANNEL HEALTH BLOCK ──────────────────────────────────────────────────
// Campaign-level health diagnostics
function ChannelHealthInline({ plan }: { plan: CampaignPlan }) {
  const [open, setOpen] = useState(false);
  const tier = getTier(plan.subscriberCount);
  const statuses = getWeekStatuses(plan.weeks, tier);

  let activeIdx = -1;
  for (let i = plan.weeks.length - 1; i >= 0; i--) {
    if (plan.weeks[i].actions.some((a) => a.status === 'done' || a.status === 'missed')) { activeIdx = i; break; }
  }
  if (activeIdx < 0) return null;

  const currentStatus = statuses[activeIdx];
  const recentWeeks = plan.weeks.slice(Math.max(0, activeIdx - 3), activeIdx + 1);

  const recentDone = recentWeeks.map((w) => w.actions.filter((a) => a.status === 'done').length);
  const avgDone = recentDone.length > 0 ? recentDone.reduce((a, b) => a + b, 0) / recentDone.length : 0;
  const consistency = avgDone >= 3 ? 'High' : avgDone >= 2 ? 'Medium' : 'Low';
  const consistencyColor = consistency === 'High' ? '#16a34a' : consistency === 'Medium' ? '#d97706' : '#dc2626';

  const recentComments = recentWeeks.reduce((s, w) => s + (w.feedback?.comments || 0), 0);
  const engagementStr = recentComments > 500 ? 'Strong' : recentComments > 100 ? 'Growing' : recentComments > 0 ? 'Weak' : 'None';
  const engagementColor = engagementStr === 'Strong' ? '#16a34a' : engagementStr === 'Growing' ? '#d97706' : '#dc2626';

  const recentSubs = recentWeeks.map((w) => w.feedback?.subsGained || 0);
  const totalRecentSubs = recentSubs.reduce((a, b) => a + b, 0);
  const growthLabel = totalRecentSubs > 500 ? 'Accelerating' : totalRecentSubs > 100 ? 'Steady' : totalRecentSubs > 0 ? 'Slow' : 'Flat';
  const growthColor = growthLabel === 'Accelerating' ? '#16a34a' : growthLabel === 'Steady' ? '#d97706' : '#dc2626';

  const statusLabel = currentStatus === 'hot' ? 'Hot' : currentStatus === 'warm' ? 'Warm' : currentStatus === 'cooling' ? 'Cooling' : 'Cold';
  const statusColor = TEMP[currentStatus].text;
  const needsWarning = currentStatus === 'cooling' || currentStatus === 'cold';

  const totalDoneLast4 = recentDone.reduce((a, b) => a + b, 0);

  let diagnosis = '';
  if (currentStatus === 'hot' && consistency === 'High') diagnosis = 'Maintain cadence and prepare for next drop.';
  else if (currentStatus === 'hot') diagnosis = 'Hot but inconsistent — one missed week could break it.';
  else if (currentStatus === 'warm' && engagementStr === 'Strong') diagnosis = 'Push harder to reach hot zone.';
  else if (currentStatus === 'warm') diagnosis = 'Add more Shorts and engage in comments.';
  else if (currentStatus === 'cooling') diagnosis = 'Resume daily posting to recover.';
  else diagnosis = 'Post multiple Shorts this week.';

  return (
    <div className="mb-6">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:bg-paper"
        style={{ background: open ? '#ffffff' : 'transparent' }}>
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink/40">Channel</span>
        {needsWarning && <span style={{ color: statusColor, fontSize: '12px' }}>&#9888;</span>}
        <span className="text-xs font-black" style={{ color: statusColor }}>{statusLabel}</span>
        <span className="text-[10px] text-ink/30">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-2 rounded-xl p-4 grid grid-cols-4 gap-4 text-xs" style={{ background: '#F6F1E7', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-ink/40 mb-1">Last 4 Weeks</div>
            <div className="font-black text-ink">{totalDoneLast4} uploads</div>
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-ink/40 mb-1">Consistency</div>
            <div className="font-black" style={{ color: consistencyColor }}>{consistency}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-ink/40 mb-1">Engagement</div>
            <div className="font-black" style={{ color: engagementColor }}>{engagementStr}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-ink/40 mb-1">Growth</div>
            <div className="font-black" style={{ color: growthColor }}>{growthLabel}</div>
          </div>
          <div className="col-span-4 pt-2 border-t border-ink/5">
            <span className="text-ink/50">{diagnosis}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ──── WHAT'S HAPPENING NOW ──────────────────────────────────────────────────
// Connects metrics + timeline + next drop into one summary with suggested action
// ──── INLINE WARNING ─────────────────────────────────────────────────────────
// Single-line contextual warning below metrics — only shows when something is off
function InlineWarning({ plan }: { plan: CampaignPlan }) {
  const tier = getTier(plan.subscriberCount);
  const targets = autoTargets(plan);

  let activeIdx = -1;
  for (let i = plan.weeks.length - 1; i >= 0; i--) {
    if (plan.weeks[i].actions.some((a) => a.status === 'done' || a.status === 'missed')) { activeIdx = i; break; }
  }
  if (activeIdx < 0) return null;

  const week = plan.weeks[activeIdx];
  const statuses = getWeekStatuses(plan.weeks, tier);
  const status = statuses[activeIdx];

  let activeWeekCount = 0;
  for (const w of plan.weeks) {
    if (w.actions.some((a) => a.status === 'done' || a.status === 'missed')) activeWeekCount++;
  }

  const doneActions = plan.weeks.flatMap((w) => w.actions.filter((a) => a.status === 'done'));
  const videosCount = doneActions.filter((a) => a.type === 'video').length;
  const shortsCount = doneActions.filter((a) => a.type === 'short').length;
  const expectedVideos = targets.videosPerWeek * activeWeekCount;
  const expectedShorts = targets.shortsPerWeek * activeWeekCount;

  const nextMoment = CAMPAIGN_MOMENTS.find((m) => m.weekNum > week.week);
  const weeksToNext = nextMoment ? nextMoment.weekNum - week.week : null;
  const missed = week.actions.filter((a) => a.status === 'missed').length;

  // Pick the most urgent single warning
  let warning = '';
  let color = '#d97706';

  if (weeksToNext !== null && weeksToNext <= 2 && status !== 'hot') {
    warning = `Channel not hot — ${nextMoment!.name} in ${weeksToNext} week${weeksToNext !== 1 ? 's' : ''}`;
    color = '#dc2626';
  } else if (videosCount < expectedVideos * 0.7 && weeksToNext !== null && weeksToNext <= 4) {
    warning = `Missing video output before next drop`;
    color = '#dc2626';
  } else if (missed >= 2) {
    warning = `${missed} missed actions this week — recover now`;
    color = '#dc2626';
  } else if (status === 'cooling') {
    warning = `Momentum slipping — resume uploads`;
    color = '#d97706';
  } else if (shortsCount < expectedShorts * 0.7) {
    warning = `Shorts behind target (${shortsCount}/${expectedShorts})`;
    color = '#d97706';
  } else if (videosCount < expectedVideos * 0.8) {
    warning = `Videos behind target (${videosCount}/${expectedVideos})`;
    color = '#d97706';
  }

  if (!warning) return null;

  return (
    <div className="mb-6 px-4 py-2.5 rounded-xl flex items-center gap-2" style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
      <span style={{ color, fontSize: '13px' }}>&#9888;</span>
      <span className="text-xs font-semibold" style={{ color }}>{warning}</span>
    </div>
  );
}

// ──── ADD MOMENT INLINE FORM ────────────────────────────────────────────────
// Per-week inline form for adding moments with type, title, day, optional metrics
// ──── TILE SHAPE SVGs ───────────────────────────────────────────────────────
// Bold geometric shapes — playful, tactile, not standard icons

function TileShapeVideo() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <polygon points="8,4 32,18 8,32" fill="rgba(255,255,255,0.85)" />
    </svg>
  );
}
function TileShapeShorts() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <rect x="4" y="4" width="12" height="28" rx="3" fill="rgba(255,255,255,0.85)" />
      <rect x="20" y="8" width="12" height="20" rx="3" fill="rgba(255,255,255,0.55)" />
    </svg>
  );
}
function TileShapeCollab() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <circle cx="14" cy="18" r="10" fill="rgba(255,255,255,0.7)" />
      <circle cx="22" cy="18" r="10" fill="rgba(255,255,255,0.5)" />
    </svg>
  );
}
function TileShapeLive() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <rect x="14" y="2" width="8" height="32" rx="4" fill="rgba(255,255,255,0.85)" />
      <rect x="6" y="8" width="8" height="20" rx="4" fill="rgba(255,255,255,0.5)" />
      <rect x="22" y="8" width="8" height="20" rx="4" fill="rgba(255,255,255,0.5)" />
    </svg>
  );
}
function TileShapeAfterparty() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <polygon points="18,2 22,13 34,13 24,21 28,32 18,25 8,32 12,21 2,13 14,13" fill="rgba(255,255,255,0.85)" />
    </svg>
  );
}

const TILE_SHAPES: Record<TileKind, () => JSX.Element> = {
  video: TileShapeVideo,
  shorts: TileShapeShorts,
  collab: TileShapeCollab,
  live: TileShapeLive,
  afterparty: TileShapeAfterparty,
};

// ──── ACTION TILE GRID ──────────────────────────────────────────────────────
// Replaces form-based "Add Moment" — instant creation on click

function ActionTileGrid({ weekNum, startDate, onAdd, weekActions }: {
  weekNum: number;
  startDate: string;
  onAdd: (weekNum: number, action: CampaignAction) => void;
  weekActions?: CampaignAction[];
}) {
  const handleTileClick = useCallback((kind: TileKind) => {
    const meta = TILE_META[kind];
    const actionDate = weekToDate(weekNum, startDate, 0);
    onAdd(weekNum, {
      id: uid(),
      title: meta.defaultTitle,
      type: meta.actionType,
      day: fmtDay(actionDate),
      date: actionDate,
      status: 'planned',
      system: meta.system,
      intent: meta.intent,
      momentRole: meta.role,
    });
  }, [weekNum, startDate, onAdd]);

  // Count existing actions by type this week
  const typeCounts: Record<string, number> = {};
  for (const a of (weekActions || [])) {
    typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
  }

  return (
    <div className="mt-4">
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {TILE_KINDS.map((kind) => {
          const meta = TILE_META[kind];
          const Shape = TILE_SHAPES[kind];
          const count = typeCounts[meta.actionType] || 0;
          const hasExisting = count > 0;
          return (
            <button
              key={kind}
              onClick={() => handleTileClick(kind)}
              className="group relative flex flex-col items-center justify-center rounded-2xl transition-all"
              style={{
                background: meta.bg,
                minHeight: '120px',
                boxShadow: hasExisting ? '0 4px 16px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.06)',
                cursor: 'pointer',
                opacity: hasExisting ? 1 : 0.55,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1.04)';
                (e.currentTarget as HTMLElement).style.opacity = '1';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                (e.currentTarget as HTMLElement).style.opacity = hasExisting ? '1' : '0.55';
                (e.currentTarget as HTMLElement).style.boxShadow = hasExisting ? '0 4px 16px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.06)';
              }}
            >
              <div className="mb-2 opacity-90">
                <Shape />
              </div>
              <span className="text-white font-black text-xs tracking-widest">{meta.label}</span>
              {hasExisting && (
                <div className="absolute top-2 right-2 min-w-[18px] h-[18px] rounded-full bg-paper flex items-center justify-center"
                  style={{ opacity: 0.9 }}>
                  <span className="text-[10px] font-black" style={{ color: meta.bg }}>{count}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ──── MOMENT METRICS DISPLAY ────────────────────────────────────────────────
// Compact inline metrics for individual actions
function MomentMetricsDisplay({ metrics }: { metrics?: MomentMetrics }) {
  if (!metrics) return null;
  const hasData = metrics.views || metrics.comments || metrics.subsGained || metrics.signal;
  if (!hasData) return null;

  return (
    <div className="flex items-center gap-2 mt-1 flex-wrap">
      {metrics.views != null && metrics.views > 0 && (
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: '#52525b', background: 'rgba(0,0,0,0.04)' }}>
          {metrics.views >= 1000 ? `${(metrics.views / 1000).toFixed(metrics.views >= 10000 ? 0 : 1)}K` : metrics.views} views
        </span>
      )}
      {metrics.comments != null && metrics.comments > 0 && (
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: '#52525b', background: 'rgba(0,0,0,0.04)' }}>
          {metrics.comments} comments
        </span>
      )}
      {metrics.subsGained != null && metrics.subsGained > 0 && (
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: '#16a34a', background: 'rgba(22,163,74,0.06)' }}>
          +{metrics.subsGained} subs
        </span>
      )}
      {metrics.signal && (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ color: SIGNAL_META[metrics.signal].color, background: `${SIGNAL_META[metrics.signal].color}10` }}>
          {SIGNAL_META[metrics.signal].icon} {SIGNAL_META[metrics.signal].label}
        </span>
      )}
    </div>
  );
}

// ──── UNDO TOAST ─────────────────────────────────────────────────────────────
type UndoItem = { action: CampaignAction; weekNum: number; timerId: ReturnType<typeof setTimeout> };

function UndoToast({ name, onUndo, onDismiss }: { name: string; onUndo: () => void; onDismiss: () => void }) {
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl"
      style={{ background: '#0E0E0E', minWidth: 260 }}>
      <span className="text-sm text-white font-medium truncate" style={{ maxWidth: 200 }}>
        Removed <strong>{name}</strong>
      </span>
      <button
        onClick={onUndo}
        className="text-sm font-black px-3 py-1 rounded-lg transition-colors"
        style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.12)' }}>
        Undo
      </button>
      <button
        onClick={onDismiss}
        className="text-white/40 hover:text-white/70 text-xs ml-1 transition-colors">
        ✕
      </button>
    </div>
  );
}

// ──── ACTION ITEM (compact, draggable) ────────────────────────────────────────
function ActionItem({ action, weekNum, onToggleStatus, onEdit, onDelete, draggedId, dragOverId, onDragStart, onDragOver, onDrop, isDeleting }: {
  action: CampaignAction;
  weekNum: number;
  onToggleStatus: (id: string) => void;
  onEdit: (action: CampaignAction, weekNum: number) => void;
  onDelete: (weekNum: number, action: CampaignAction) => void;
  draggedId: string | null;
  dragOverId: string | null;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDrop: () => void;
  isDeleting?: boolean;
}) {
  const pill = ACTION_PILL[action.type];
  const isDone = action.status === 'done';
  const isMissed = action.status === 'missed';

  return (
    <>
    <div
      draggable
      onDragStart={() => onDragStart(action.id)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(action.id); }}
      onDrop={onDrop}
      className="group relative flex items-center gap-2 px-3.5 py-2.5 rounded-2xl cursor-move"
      style={{
        background: isDone ? 'rgba(0,0,0,0.02)' : isMissed ? 'rgba(225,29,72,0.04)' : '#ffffff',
        opacity: isDeleting ? 0 : draggedId === action.id ? 0.5 : 1,
        maxHeight: isDeleting ? 0 : 200,
        paddingTop: isDeleting ? 0 : undefined,
        paddingBottom: isDeleting ? 0 : undefined,
        marginBottom: isDeleting ? 0 : undefined,
        overflow: 'hidden',
        transition: 'opacity 0.25s ease, max-height 0.3s ease 0.1s, padding 0.3s ease 0.1s, margin 0.3s ease 0.1s',
        borderTop: dragOverId === action.id ? '2px solid #2563eb' : 'none',
        borderLeft: `3px solid ${pill.color}`,
      }}>
      <button
        onClick={() => onToggleStatus(action.id)}
        className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] cursor-pointer transition-all"
        style={{
          background: isDone ? `${pill.color}18` : isMissed ? '#e11d4814' : 'rgba(0,0,0,0.04)',
          color: isDone ? pill.color : isMissed ? '#e11d48' : '#a1a1aa',
        }}
        title={`Status: ${action.status}`}>
        {isDone ? '✓' : isMissed ? '!' : pill.icon}
      </button>

      {/* Type tag — always visible */}
      <span className="flex-shrink-0 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
        style={{ color: pill.color, background: `${pill.color}12` }}>
        {ACTION_LABELS[action.type]}
      </span>

      <span
        className="flex-1 text-sm font-medium truncate cursor-pointer hover:opacity-70"
        style={{
          color: isDone ? '#27272a' : isMissed ? '#e11d48' : '#52525b',
          textDecoration: isMissed ? 'line-through' : 'none',
        }}
        onClick={() => onEdit(action, weekNum)}>
        {action.title}
      </span>

      {action.featuredArtist && (
        <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: '#9333ea', background: 'rgba(147,51,234,0.08)' }}>
          ft. {action.featuredArtist}
        </span>
      )}

      {action.system === 2 && !action.momentRole && (
        <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: '#d97706', background: 'rgba(217,119,6,0.08)' }}>
          S2
        </span>
      )}

      {action.momentRole && (
        <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ color: MOMENT_ROLE_META[action.momentRole].color, background: `${MOMENT_ROLE_META[action.momentRole].color}10` }}>
          {MOMENT_ROLE_META[action.momentRole].icon} {MOMENT_ROLE_META[action.momentRole].label}
        </span>
      )}

      {action.date && (
        <span className="flex-shrink-0 text-[9px] font-semibold text-ink/50">{fmtDate(action.date)}</span>
      )}
      <span className="flex-shrink-0 text-[9px] text-ink/40">{action.day}</span>

      {/* Hover actions: edit + delete */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
        <button
          onClick={() => onEdit(action, weekNum)}
          className="w-6 h-6 flex items-center justify-center text-ink/40 hover:text-ink/70 hover:bg-black/5 rounded-lg transition-colors"
          style={{ fontSize: '10px' }}
          title="Edit">
          ✎
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(weekNum, action); }}
          className="w-6 h-6 flex items-center justify-center text-ink/30 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
          style={{ fontSize: '11px' }}
          title="Remove">
          ✕
        </button>
      </div>
    </div>
    {action.metrics && !isDeleting && <div className="pl-10 pb-1"><MomentMetricsDisplay metrics={action.metrics} /></div>}
    </>
  );
}

// ──── HERO MOMENT CARD ───────────────────────────────────────────────────────
// Large card for the anchor System 2 action
function HeroMoment({ action, weekNum, onToggleStatus, onEdit, onDelete, draggedId, dragOverId, onDragStart, onDragOver, onDrop, isDeleting }: {
  action: CampaignAction;
  weekNum: number;
  onToggleStatus: (id: string) => void;
  onEdit: (action: CampaignAction, weekNum: number) => void;
  onDelete: (weekNum: number, action: CampaignAction) => void;
  draggedId: string | null;
  dragOverId: string | null;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDrop: () => void;
  isDeleting?: boolean;
}) {
  const pill = ACTION_PILL[action.type];
  const isDone = action.status === 'done';

  return (
    <div
      draggable
      onDragStart={() => onDragStart(action.id)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(action.id); }}
      onDrop={onDrop}
      className="group p-4 rounded-2xl cursor-move relative"
      style={{
        background: '#F6F1E7',
        boxShadow: `0 1px 3px rgba(0,0,0,0.04), 0 0 15px ${pill.color}20`,
        borderLeft: `4px solid ${pill.color}`,
        opacity: isDeleting ? 0 : draggedId === action.id ? 0.5 : 1,
        maxHeight: isDeleting ? 0 : 400,
        paddingTop: isDeleting ? 0 : undefined,
        paddingBottom: isDeleting ? 0 : undefined,
        marginBottom: isDeleting ? 0 : undefined,
        overflow: 'hidden',
        transition: 'opacity 0.25s ease, max-height 0.3s ease 0.1s, padding 0.3s ease 0.1s, margin 0.3s ease 0.1s',
        borderTop: dragOverId === action.id ? '2px solid #2563eb' : 'none',
      }}>
      {/* Delete button — top right, hover-revealed */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(weekNum, action); }}
        className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center text-ink/30 hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
        style={{ fontSize: '13px' }}
        title="Remove">
        ✕
      </button>

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg" style={{ color: pill.color }}>
              {pill.icon}
            </span>
            <h4 className="font-black text-base text-ink leading-tight cursor-pointer hover:opacity-70" onClick={() => onEdit(action, weekNum)}>
              {action.title}
            </h4>
          </div>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span style={{ color: pill.color, fontWeight: 600 }}>
              {ACTION_LABELS[action.type]}
            </span>
            {action.date && (
              <>
                <span style={{ color: '#a1a1aa' }}>•</span>
                <span style={{ color: '#52525b', fontWeight: 600 }}>{fmtDate(action.date)}</span>
              </>
            )}
            <span style={{ color: '#a1a1aa' }}>•</span>
            <span style={{ color: '#52525b' }}>{action.day}</span>
            {action.system === 2 && (
              <>
                <span style={{ color: '#a1a1aa' }}>•</span>
                <span style={{ color: '#d97706', fontWeight: 700 }}>S2</span>
              </>
            )}
            {action.featuredArtist && (
              <>
                <span style={{ color: '#a1a1aa' }}>•</span>
                <span style={{ color: '#9333ea', fontWeight: 700 }}>ft. {action.featuredArtist}</span>
              </>
            )}
          </div>
          {action.intent && (
            <div className="mt-2 flex items-center gap-2">
              <span
                className="text-[9px] font-bold px-2 py-1 rounded-full"
                style={{ color: INTENT_META[action.intent].color, background: `${INTENT_META[action.intent].color}15` }}>
                {INTENT_META[action.intent].label}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => onToggleStatus(action.id)}
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all"
          style={{
            background: isDone ? `${pill.color}18` : 'rgba(0,0,0,0.04)',
            color: isDone ? pill.color : '#a1a1aa',
          }}
          title={`Status: ${action.status}`}>
          {isDone ? '✓' : action.status === 'missed' ? '!' : pill.icon}
        </button>
      </div>
      {action.metrics && !isDeleting && <div className="mt-2"><MomentMetricsDisplay metrics={action.metrics} /></div>}
    </div>
  );
}

// ──── SHORTS CLUSTER ─────────────────────────────────────────────────────────
// Group of shorts shown compactly
function ShortCluster({ shorts, weekNum, onToggleStatus, onEdit, onDelete, draggedId, dragOverId, onDragStart, onDragOver, onDrop, deletingIds }: {
  shorts: CampaignAction[];
  weekNum: number;
  onToggleStatus: (id: string) => void;
  onEdit: (action: CampaignAction, weekNum: number) => void;
  onDelete: (weekNum: number, action: CampaignAction) => void;
  draggedId: string | null;
  dragOverId: string | null;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDrop: () => void;
  deletingIds: Set<string>;
}) {
  if (shorts.length === 0) return null;

  return (
    <div className="space-y-2">
      {shorts.map((s) => (
        <ActionItem
          key={s.id}
          action={s}
          weekNum={weekNum}
          onToggleStatus={onToggleStatus}
          onEdit={onEdit}
          onDelete={onDelete}
          draggedId={draggedId}
          dragOverId={dragOverId}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
          isDeleting={deletingIds.has(s.id)}
        />
      ))}
    </div>
  );
}

// ──── SUPPORT STACK ──────────────────────────────────────────────────────────
// Collapsed by default: posts, playlists, etc.
function SupportStack({ supports, weekNum, onToggleStatus, onEdit, onDelete, draggedId, dragOverId, onDragStart, onDragOver, onDrop, showCollapsedSupport, onToggleSupport, deletingIds }: {
  supports: CampaignAction[];
  weekNum: number;
  onToggleStatus: (id: string) => void;
  onEdit: (action: CampaignAction, weekNum: number) => void;
  onDelete: (weekNum: number, action: CampaignAction) => void;
  draggedId: string | null;
  dragOverId: string | null;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDrop: () => void;
  showCollapsedSupport: Set<string>;
  onToggleSupport: (weekKey: string) => void;
  deletingIds: Set<string>;
}) {
  if (supports.length === 0) return null;

  const weekKey = `w${weekNum}`;
  const isExpanded = showCollapsedSupport.has(weekKey);

  return (
    <div>
      <button
        onClick={() => onToggleSupport(weekKey)}
        className="text-xs font-bold text-ink/50 hover:text-ink/70 transition-colors"
        style={{ textDecoration: 'underline' }}>
        {isExpanded ? `Hide ${supports.length} support action${supports.length > 1 ? 's' : ''}` : `Show ${supports.length} support action${supports.length > 1 ? 's' : ''}`}
      </button>
      {isExpanded && (
        <div className="mt-2 space-y-2 pl-3 border-l-2 border-ink/8">
          {supports.map((s) => (
            <ActionItem
              key={s.id}
              action={s}
              weekNum={weekNum}
              onToggleStatus={onToggleStatus}
              onEdit={onEdit}
              onDelete={onDelete}
              draggedId={draggedId}
              dragOverId={dragOverId}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              isDeleting={deletingIds.has(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ──── ACTION MODAL ───────────────────────────────────────────────────────────
// System 2 detail depth for editing
function ActionModal({ action, weekNum, onSave, onClose }: {
  action: CampaignAction;
  weekNum: number;
  onSave: (weekNum: number, updated: CampaignAction) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(action.title);
  const [type, setType] = useState<ActionType>(action.type);
  const [day, setDay] = useState<DayLabel>(action.day);
  const [system, setSystem] = useState<ActionSystem>(action.system);
  const [intent, setIntent] = useState<ActionIntent>(action.intent);
  const [featured, setFeatured] = useState(action.featuredArtist || '');
  const [notes, setNotes] = useState(action.notes || '');
  const [status, setStatus] = useState<ActionStatus>(action.status);
  const [mViews, setMViews] = useState((action.metrics?.views || '').toString());
  const [mComments, setMComments] = useState((action.metrics?.comments || '').toString());
  const [mSubs, setMSubs] = useState((action.metrics?.subsGained || '').toString());
  const [mSignal, setMSignal] = useState<MomentSignal | ''>(action.metrics?.signal || '');
  const [momentRole, setMomentRole] = useState<MomentRole | ''>(action.momentRole || '');
  const [dateVal, setDateVal] = useState(action.date || '');

  const handleSave = () => {
    const metrics: MomentMetrics = {};
    const pViews = parseInt(mViews, 10);
    const pComments = parseInt(mComments, 10);
    const pSubs = parseInt(mSubs, 10);
    if (pViews > 0) metrics.views = pViews;
    if (pComments > 0) metrics.comments = pComments;
    if (pSubs > 0) metrics.subsGained = pSubs;
    if (mSignal) metrics.signal = mSignal;
    const hasMetrics = Object.keys(metrics).length > 0;

    const finalDay = dateVal ? fmtDay(dateVal) : day;
    onSave(weekNum, {
      ...action,
      title: title.trim(),
      type,
      day: finalDay,
      date: dateVal || undefined,
      system,
      intent,
      status,
      ...(featured && { featuredArtist: featured }),
      ...(notes && { notes }),
      ...(hasMetrics && { metrics }),
      ...(!hasMetrics && { metrics: undefined }),
      ...(momentRole ? { momentRole } : { momentRole: undefined }),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div
        className="bg-paper rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-black text-ink mb-3">Edit Action</h3>

        <div className="space-y-3 mb-4">
          <div>
            <label className="text-xs font-bold text-ink/60 block mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-lg border border-ink/8 outline-none focus:border-blue-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-ink/60 block mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ActionType)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-ink/8 outline-none focus:border-blue-400">
                {ACTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ACTION_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-ink/60 block mb-1">Day</label>
              <select
                value={dateVal ? fmtDay(dateVal) : day}
                onChange={(e) => { if (!dateVal) setDay(e.target.value as DayLabel); }}
                disabled={!!dateVal}
                className="w-full text-sm px-3 py-2 rounded-lg border border-ink/8 outline-none focus:border-blue-400 disabled:opacity-50">
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              {dateVal && <span className="text-[9px] text-ink/40 mt-0.5 block">Auto from date</span>}
            </div>
          </div>

          {/* Date field */}
          <div>
            <label className="text-xs font-bold text-ink/60 block mb-1">Date</label>
            <input
              type="date"
              value={dateVal}
              onChange={(e) => setDateVal(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-lg border border-ink/8 outline-none focus:border-blue-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-ink/60 block mb-1">System</label>
              <select
                value={system}
                onChange={(e) => setSystem(Number(e.target.value) as ActionSystem)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-ink/8 outline-none focus:border-blue-400">
                {SYSTEMS.map((s) => (
                  <option key={s} value={s}>
                    {SYSTEM_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-ink/60 block mb-1">Intent</label>
              <select
                value={intent}
                onChange={(e) => setIntent(e.target.value as ActionIntent)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-ink/8 outline-none focus:border-blue-400">
                {INTENTS.map((i) => (
                  <option key={i} value={i}>
                    {INTENT_META[i].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-ink/60 block mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ActionStatus)}
              className="w-full text-sm px-3 py-2 rounded-lg border border-ink/8 outline-none focus:border-blue-400">
              {STATUS_CYCLE.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Moment Role */}
          <div>
            <label className="text-xs font-bold text-ink/60 block mb-1">Moment Role</label>
            <div className="flex gap-1.5">
              <button onClick={() => setMomentRole('')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{ background: !momentRole ? '#27272a' : 'rgba(0,0,0,0.04)', color: !momentRole ? '#fff' : '#71717a' }}>
                None
              </button>
              {MOMENT_ROLES.map((r) => {
                const m = MOMENT_ROLE_META[r];
                const sel = momentRole === r;
                return (
                  <button key={r} onClick={() => setMomentRole(r)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={{ background: sel ? `${m.color}15` : 'rgba(0,0,0,0.04)', color: sel ? m.color : '#71717a', border: sel ? `1.5px solid ${m.color}40` : '1.5px solid transparent' }}>
                    {m.icon} {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-ink/60 block mb-1">Featured Artist (optional)</label>
            <input
              type="text"
              value={featured}
              onChange={(e) => setFeatured(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-lg border border-ink/8 outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-ink/60 block mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-lg border border-ink/8 outline-none focus:border-blue-400 h-14 resize-none"
            />
          </div>

          {/* Moment-level metrics */}
          <div className="pt-2 border-t border-ink/5">
            <label className="text-xs font-bold text-ink/60 block mb-1">Moment Metrics (optional)</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-ink/40 block mb-1">Views</label>
                <input type="number" value={mViews} onChange={(e) => setMViews(e.target.value)} placeholder="0"
                  className="w-full text-sm px-3 py-1.5 rounded-lg border border-ink/8 outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-[10px] text-ink/40 block mb-1">Comments</label>
                <input type="number" value={mComments} onChange={(e) => setMComments(e.target.value)} placeholder="0"
                  className="w-full text-sm px-3 py-1.5 rounded-lg border border-ink/8 outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-[10px] text-ink/40 block mb-1">Subs Gained</label>
                <input type="number" value={mSubs} onChange={(e) => setMSubs(e.target.value)} placeholder="0"
                  className="w-full text-sm px-3 py-1.5 rounded-lg border border-ink/8 outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-[10px] text-ink/40 block mb-1">Signal</label>
                <select value={mSignal} onChange={(e) => setMSignal(e.target.value as MomentSignal | '')}
                  className="w-full text-sm px-3 py-1.5 rounded-lg border border-ink/8 outline-none focus:border-blue-400">
                  <option value="">None</option>
                  {SIGNALS.map((s) => <option key={s} value={s}>{SIGNAL_META[s].label}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-ink/60 hover:bg-cream rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-bold text-white bg-ink hover:bg-ink/80 rounded-lg transition-colors">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ──── TRACK CONTENT PLAN CARD ────────────────────────────────────────────────
// Shows content plan for a single track — checkbox items with completion status
function TrackPlanCard({ track, onToggleItem, onAddItem, onRemoveItem }: {
  track: TrackContentPlan;
  onToggleItem: (trackId: string, itemId: string) => void;
  onAddItem: (trackId: string) => void;
  onRemoveItem: (trackId: string, itemId: string) => void;
}) {
  const status = getContentStatus(track.items);
  const meta = CONTENT_STATUS_META[status];
  const doneCount = track.items.filter((i) => i.done).length;

  return (
    <div className="rounded-2xl p-5" style={{ background: '#F6F1E7', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-black text-sm text-ink truncate flex-1">{track.trackName}</h4>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-bold" style={{ color: meta.color }}>{meta.label}</span>
          <span className="text-[10px] text-ink/40">{doneCount}/{track.items.length}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full mb-3" style={{ background: 'rgba(0,0,0,0.05)' }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${track.items.length > 0 ? Math.max(2, (doneCount / track.items.length) * 100) : 2}%`, background: meta.color }} />
      </div>

      {/* Items by role */}
      <div className="space-y-1.5">
        {track.items.map((item) => {
          const roleMeta = MOMENT_ROLE_META[item.role];
          return (
            <div key={item.id} className="group flex items-center gap-2 py-1">
              <button
                onClick={() => onToggleItem(track.trackId, item.id)}
                className="flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all"
                style={{
                  borderColor: item.done ? roleMeta.color : '#d4d4d8',
                  background: item.done ? `${roleMeta.color}15` : 'transparent',
                }}>
                {item.done && <span style={{ color: roleMeta.color, fontSize: '9px', fontWeight: 800 }}>✓</span>}
              </button>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: roleMeta.color, background: `${roleMeta.color}10` }}>
                {roleMeta.icon}
              </span>
              <span className="flex-1 text-xs text-ink/70" style={{ textDecoration: item.done ? 'line-through' : 'none', opacity: item.done ? 0.6 : 1 }}>
                {item.label}
              </span>
              <button onClick={() => onRemoveItem(track.trackId, item.id)}
                className="text-ink/30 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
            </div>
          );
        })}
      </div>

      <button onClick={() => onAddItem(track.trackId)}
        className="mt-2 text-[10px] font-bold text-ink/40 hover:text-ink/60 transition-colors">
        + Add content item
      </button>
    </div>
  );
}

// ──── DROP WINDOW ────────────────────────────────────────────────────────────
// Grouped actions within a drop window, shown in PhaseBlock
function DropWindowBlock({ dw, actions, phaseColor, onToggleStatus, onEdit }: {
  dw: DropWindow;
  actions: CampaignAction[];
  phaseColor: string;
  onToggleStatus: (id: string) => void;
  onEdit: (action: CampaignAction, weekNum: number) => void;
}) {
  const windowActions = actions.filter((a) => a.dropWindowId === dw.id);
  if (windowActions.length === 0) return null;

  const doneCount = windowActions.filter((a) => a.status === 'done').length;

  return (
    <div className="mb-3 p-3 rounded-xl" style={{ background: `${phaseColor}08`, border: `1px solid ${phaseColor}20` }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: phaseColor }}>{dw.label}</span>
        <span className="text-[10px] text-ink/40">{doneCount}/{windowActions.length} done</span>
      </div>
      <div className="space-y-1">
        {windowActions.map((a) => {
          const pill = ACTION_PILL[a.type];
          const roleMeta = a.momentRole ? MOMENT_ROLE_META[a.momentRole] : null;
          return (
            <div key={a.id} className="flex items-center gap-2 py-1">
              <button onClick={() => onToggleStatus(a.id)}
                className="w-4 h-4 rounded-full flex items-center justify-center text-[8px]"
                style={{
                  background: a.status === 'done' ? `${pill.color}18` : a.status === 'missed' ? '#e11d4814' : 'rgba(0,0,0,0.04)',
                  color: a.status === 'done' ? pill.color : a.status === 'missed' ? '#e11d48' : '#a1a1aa',
                }}>
                {a.status === 'done' ? '✓' : a.status === 'missed' ? '!' : pill.icon}
              </button>
              {roleMeta && (
                <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ color: roleMeta.color, background: `${roleMeta.color}10` }}>
                  {roleMeta.label}
                </span>
              )}
              <span className="flex-1 text-xs text-ink/70 truncate cursor-pointer hover:opacity-70"
                onClick={() => onEdit(a, dw.weekNum)}
                style={{ textDecoration: a.status === 'missed' ? 'line-through' : 'none' }}>
                {a.title}
              </span>
              <span className="text-[9px] text-ink/40">{a.day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──── AUTO-GENERATED TRACK SYSTEM ───────────────────────────────────────────
// Tracks are derived automatically from hero/video/collab actions in the campaign.
// No manual setup required — add a video or collab and it becomes a track.

type AutoTrack = {
  id: string;
  name: string;                // Track/moment name
  weekNum: number;
  date: string;
  anchorAction: CampaignAction | null;  // The hero/video action
  supportActions: CampaignAction[];      // Related shorts, posts, lives around it
  supportPlan: SupportPlan | null;        // Structured support content plan
  moment: CampaignMoment | null;         // Linked campaign moment
  status: 'upcoming' | 'active' | 'complete';
  phase: CampaignPhase | undefined;
};

function deriveAutoTracks(plan: CampaignPlan): AutoTrack[] {
  const tracks: AutoTrack[] = [];
  const planPhases = getPlanPhases(plan);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Create a track for each RELEASE moment only. Tour dates, festivals,
  // live shows, and phase-filler milestones are NOT drops — they don't need
  // lyric videos or artwork. They inform the weekly cadence instead.
  const RELEASE_TYPES = new Set(['single', 'album', 'collab', 'announcement', 'anchor']);
  const moments = (plan.moments && plan.moments.length > 0) ? plan.moments : CAMPAIGN_MOMENTS;
  for (const moment of moments) {
    // Skip non-release moments — tours, festivals, etc. just set context
    if (!RELEASE_TYPES.has(moment.type)) continue;

    const week = plan.weeks.find((w) => w.week === moment.weekNum);
    if (!week) continue;

    // Find the hero/anchor action in this week
    const heroAction = week.actions.find((a) =>
      (a.type === 'video' || a.type === 'collab') && a.system === 2
    ) || week.actions.find((a) =>
      a.type === 'video' || a.type === 'collab'
    ) || null;

    // Find support actions in nearby weeks (±2 weeks)
    const supportActions: CampaignAction[] = [];
    for (const w of plan.weeks) {
      if (Math.abs(w.week - moment.weekNum) <= 2 && w.week !== moment.weekNum) {
        for (const a of w.actions) {
          if (a.type === 'short' || a.type === 'post' || a.type === 'live') {
            supportActions.push(a);
          }
        }
      }
    }
    // Also include S1 actions in the same week
    for (const a of week.actions) {
      if (a.system === 1 || a.type === 'short' || a.type === 'post') {
        if (a !== heroAction) supportActions.push(a);
      }
    }

    // Determine status
    const momentDate = new Date(moment.date + 'T12:00:00');
    const allActions = heroAction ? [heroAction, ...supportActions] : supportActions;
    const doneCount = allActions.filter((a) => a.status === 'done').length;
    let status: AutoTrack['status'] = 'upcoming';
    if (momentDate < today) {
      status = doneCount === allActions.length && allActions.length > 0 ? 'complete' : 'active';
    } else if (doneCount > 0) {
      status = 'active';
    }

    const supportPlan = (plan.supportPlans || []).find((sp) => sp.momentWeek === moment.weekNum) || null;
    const phase = planPhases.find((p) => moment.weekNum >= p.weekStart && moment.weekNum <= p.weekEnd);

    // Use the moment name (carries the timeline event title) as the track name.
    // Fall back to hero action title, then a descriptive label.
    const trackName = moment.name || (heroAction
      ? `${heroAction.title}${heroAction.featuredArtist ? ` ft. ${heroAction.featuredArtist}` : ''}`
      : `${moment.type === 'album' ? 'Album' : moment.type === 'single' ? 'Single' : 'Release'} — Week ${moment.weekNum}`);

    tracks.push({
      id: `autotrack-${moment.weekNum}`,
      name: trackName,
      weekNum: moment.weekNum,
      date: moment.date,
      anchorAction: heroAction,
      supportActions,
      supportPlan,
      moment,
      status,
      phase,
    });
  }

  // 2. Also create tracks for standalone video/collab actions NOT linked to a moment
  for (const week of plan.weeks) {
    const momentWeeks = moments.map((m) => m.weekNum);
    if (momentWeeks.includes(week.week)) continue;

    const heroActions = week.actions.filter((a) =>
      (a.type === 'video' || a.type === 'collab') && a.momentRole === 'hero'
    );
    for (const hero of heroActions) {
      const supports = week.actions.filter((a) => a.id !== hero.id && (a.type === 'short' || a.type === 'post'));
      const weekDate = weekToDate(week.week, plan.startDate, 0);
      const momentDate = new Date(weekDate + 'T12:00:00');
      const allActions = [hero, ...supports];
      const doneCount = allActions.filter((a) => a.status === 'done').length;
      let status: AutoTrack['status'] = 'upcoming';
      if (momentDate < today) {
        status = doneCount === allActions.length ? 'complete' : 'active';
      } else if (doneCount > 0) {
        status = 'active';
      }

      tracks.push({
        id: `autotrack-adhoc-${hero.id}`,
        name: hero.title,
        weekNum: week.week,
        date: hero.date || weekDate,
        anchorAction: hero,
        supportActions: supports,
        supportPlan: null,
        moment: null,
        status,
        phase: planPhases.find((p) => week.week >= p.weekStart && week.week <= p.weekEnd),
      });
    }
  }

  // Phase-fill removed: phases without explicit releases don't need
  // empty drop cards. The weekly cadence (shorts, posts) already fills
  // those weeks with context-aware content via enrichPlanWeeks.

  return tracks.sort((a, b) => a.weekNum - b.weekNum);
}

// ──── LIVE TRACKS (from YouTube API) ────────────────────────────────────────
// Derive AutoTracks directly from longform uploads on the channel. Each
// longform video becomes a drop, classified by videoType. No manual campaign
// plan required — this is the "real" view driven entirely by live data.

function liveDropTypeFromVideo(v: WatcherVideo): DropType {
  switch (v.videoType) {
    case 'official':   return 'official';
    case 'live':       return 'performance';
    case 'lyric':      return 'official'; // treat lyric as part of an official-style drop
    case 'visualizer': return 'official';
    case 'audio':      return 'official';
    default:           return 'vlog';
  }
}

function dayLabelFromIso(iso: string): DayLabel {
  const d = new Date(iso).getDay();
  return (['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as DayLabel[])[d];
}

function deriveLiveTracks(state: WatcherState | null, startDate?: string): AutoTrack[] {
  if (!state || !state.latestVideos) return [];
  const startT = startDate ? new Date(startDate + 'T00:00:00').getTime() : -Infinity;
  // Only major releases become "drops" with support checklists.
  // Vlogs, performances, random videos should NOT appear here —
  // they're supporting content, not drops that need support around them.
  const MAJOR_TYPES = new Set(['official', 'lyric', 'visualizer', 'audio']);
  const longform = state.latestVideos.filter(
    (v) => v.kind === 'video' &&
      new Date(v.publishedAt).getTime() >= startT &&
      MAJOR_TYPES.has(v.videoType ?? 'unknown')
  );
  if (longform.length === 0) return [];
  const now = Date.now();
  return longform
    .map<AutoTrack>((v) => {
      const dropType = liveDropTypeFromVideo(v);
      const publishedT = new Date(v.publishedAt).getTime();
      const anchor: CampaignAction = {
        id: `live-${v.videoId}`,
        title: v.title,
        type: 'video',
        day: dayLabelFromIso(v.publishedAt),
        date: v.publishedAt.slice(0, 10),
        status: 'done',
        system: 1,
        intent: 'convert',
        dropType,
      };
      const ageDays = (now - publishedT) / 86400_000;
      const status: AutoTrack['status'] = ageDays > 14 ? 'complete' : 'active';
      return {
        id: `live-track-${v.videoId}`,
        name: v.title,
        weekNum: 0,
        date: v.publishedAt.slice(0, 10),
        anchorAction: anchor,
        supportActions: [],
        supportPlan: null,
        moment: null,
        status,
        phase: undefined,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ──── DROP SUPPORT MODEL ────────────────────────────────────────────────────
// Each drop has a Drop Type. The type defines a tailored recommended plan —
// a set of support slots with targets, a system recommendation sentence, and
// timing guidance. Coverage is scored only across the slots that are actually
// relevant for that type (no one-size-fits-all checklist).

type CoverageTier = 'Low' | 'Medium' | 'Strong';

type SupportSlotKey =
  | 'shorts'
  | 'lyricVideo'
  | 'artworkVideo'
  | 'communityPost'
  | 'followupLongform';

type SupportSlotSpec = {
  key: SupportSlotKey;
  label: string;
  target: number;      // minimum count to mark the slot "hit"
  targetText: string;  // human-friendly target (e.g. "3–5" or "Yes")
};

type DropTypeConfig = {
  label: string;
  slots: SupportSlotSpec[];
  recommendation: string;
  timing: { day0: string; day1to3: string; day5plus: string };
};

const DROP_TYPE_CONFIG: Record<DropType, DropTypeConfig> = {
  official: {
    label: 'Official Video',
    slots: [
      { key: 'shorts',            label: 'Shorts',             target: 3, targetText: '3–5' },
      { key: 'lyricVideo',        label: 'Lyric Video',        target: 1, targetText: 'Yes' },
      { key: 'artworkVideo',      label: 'Artwork Video',      target: 1, targetText: 'Yes' },
      { key: 'communityPost',     label: 'Community Post',     target: 1, targetText: 'Yes' },
      { key: 'followupLongform',  label: 'Follow-up Longform', target: 1, targetText: 'Yes' },
    ],
    recommendation: 'Full launch stack — lyric + artwork + shorts drive discovery and re-entry.',
    timing: {
      day0:    'Premiere + community post',
      day1to3: '2–3 shorts + cross-post clips',
      day5plus: 'Lyric / artwork follow-up',
    },
  },
  albumTrailer: {
    label: 'Album Trailer',
    slots: [
      { key: 'shorts',        label: 'Shorts',         target: 1, targetText: '1–2' },
      { key: 'communityPost', label: 'Community Post', target: 1, targetText: 'Yes' },
    ],
    recommendation: 'Tease-first drop — keep it short, hint at the story, save assets for the main launch.',
    timing: {
      day0:    'Upload + pinned community post',
      day1to3: '1 short teaser',
      day5plus: 'Optional: sneak peek or recap',
    },
  },
  vlog: {
    label: 'Vlog / BTS',
    slots: [
      { key: 'shorts',        label: 'Shorts',         target: 2, targetText: '2–4' },
      { key: 'communityPost', label: 'Community Post', target: 1, targetText: 'Yes' },
    ],
    recommendation: 'Fan-building drop — personality first. Pull shorts from the clips, keep the feed warm.',
    timing: {
      day0:    'Upload + community post',
      day1to3: '2–3 shorts from vlog moments',
      day5plus: 'Reply to comments in pinned post',
    },
  },
  performance: {
    label: 'Performance Video',
    slots: [
      { key: 'shorts',        label: 'Shorts',         target: 2, targetText: '2–3' },
      { key: 'communityPost', label: 'Community Post', target: 1, targetText: 'Yes' },
    ],
    recommendation: 'Showcase drop — clip the best moments, tag the venue / collaborators, let the energy travel.',
    timing: {
      day0:    'Upload + community post',
      day1to3: '2–3 performance shorts',
      day5plus: 'Optional: audio-only or reaction follow-up',
    },
  },
  tour: {
    label: 'Tour Video',
    slots: [
      { key: 'shorts',            label: 'Shorts',             target: 3, targetText: '3–5' },
      { key: 'communityPost',     label: 'Community Post',     target: 1, targetText: 'Yes' },
      { key: 'followupLongform',  label: 'Follow-up Longform', target: 1, targetText: 'Yes' },
    ],
    recommendation: 'Story drop — document legs of the tour, post between cities, close with a recap.',
    timing: {
      day0:    'Upload + community post',
      day1to3: '3+ tour shorts between stops',
      day5plus: 'Recap / highlight longform',
    },
  },
  announcement: {
    label: 'Announcement',
    slots: [
      { key: 'shorts',        label: 'Shorts',         target: 1, targetText: '1' },
      { key: 'communityPost', label: 'Community Post', target: 1, targetText: 'Yes' },
    ],
    recommendation: 'Signal drop — one strong pinned post + one clip. Let fans carry the news.',
    timing: {
      day0:    'Upload + pinned community post',
      day1to3: '1 short recap',
      day5plus: '—',
    },
  },
};

const DROP_TYPE_ORDER: DropType[] = ['official', 'albumTrailer', 'vlog', 'performance', 'tour', 'announcement'];

// Infer a DropType from legacy videoSubtype so existing data renders gracefully.
function inferDropType(action: CampaignAction | null): DropType {
  if (!action) return 'official';
  if (action.dropType) return action.dropType;
  if (action.videoSubtype === 'live') return 'performance';
  return 'official';
}

type SlotResult = {
  key: SupportSlotKey;
  label: string;
  targetText: string;
  done: number;
  target: number;
  hit: boolean;
  showsCount: boolean; // whether to render "x/y" vs a pure yes/no
};

type DropSupport = {
  dropType: DropType;
  dropTypeLabel: string;
  coreLabel: string;
  corePresent: boolean;
  coreDone: boolean;
  slots: SlotResult[];
  coverageScore: number;
  coverageMax: number;
  coverageTier: CoverageTier;
  signal: string;
  recommendation: string;
  timing: { day0: string; day1to3: string; day5plus: string };
};

// Live-data match: given a drop date and the channel's recent uploads, attribute
// uploads to this drop when they land inside the release window and classify
// them into support-slot buckets by kind + videoType. Returns zeros if no
// latestVideos are supplied.
type LiveMatch = {
  shorts: number;
  lyricVideo: number;
  artworkVideo: number;     // visualizer / artwork
  followupLongform: number; // any longform that isn't official/lyric/visualizer/audio
  officialPresent: boolean; // did we see an official video in the window (for core credit)
};

const DROP_WINDOW_BEFORE_DAYS = 3;
const DROP_WINDOW_AFTER_DAYS = 14;

function matchLiveToDrop(dropDateIso: string, videos: WatcherVideo[] | undefined | null): LiveMatch {
  const zero: LiveMatch = { shorts: 0, lyricVideo: 0, artworkVideo: 0, followupLongform: 0, officialPresent: false };
  if (!videos || videos.length === 0) return zero;
  const dropT = new Date(dropDateIso).getTime();
  if (Number.isNaN(dropT)) return zero;
  const start = dropT - DROP_WINDOW_BEFORE_DAYS * 86400_000;
  const end = dropT + DROP_WINDOW_AFTER_DAYS * 86400_000;
  const m: LiveMatch = { ...zero };
  for (const v of videos) {
    const t = new Date(v.publishedAt).getTime();
    if (Number.isNaN(t) || t < start || t > end) continue;
    if (v.kind === 'short') { m.shorts++; continue; }
    switch (v.videoType) {
      case 'official':   m.officialPresent = true; break;
      case 'lyric':      m.lyricVideo++; break;
      case 'visualizer': m.artworkVideo++; break;
      case 'audio':      m.followupLongform++; break;
      default:           m.followupLongform++;
    }
  }
  return m;
}

function getDropSupport(track: AutoTrack, live?: LiveMatch, communityPostOverride?: boolean): DropSupport {
  const hero = track.anchorAction;
  const dropType = inferDropType(hero);
  const config = DROP_TYPE_CONFIG[dropType];

  const coreLabel = hero && hero.type === 'collab' ? 'Collab Video' : config.label;
  const corePresent = !!hero;
  // Live-derived tracks synthesize an anchor with status='done' — the mere
  // existence of the upload is proof the core exists. For planned tracks, we
  // still only credit from liveMatch when the videoType is 'official'.
  const isLiveDerived = !!hero && hero.id.startsWith('live-');
  const liveCore = !!live && live.officialPresent && dropType === 'official';
  const coreDone = (!!hero && hero.status === 'done') || liveCore || isLiveDerived;

  // Raw counts from support actions
  const supportActions = track.supportActions;
  const shortsDone = supportActions.filter((a) => a.type === 'short' && a.status === 'done').length;
  const postsDone  = supportActions.filter((a) => a.type === 'post'  && a.status === 'done').length;
  const sidekickVideos = supportActions.filter(
    (a) => (a.type === 'video' || a.type === 'collab') && a.id !== hero?.id
  );
  const doneSidekicks = sidekickVideos.filter((a) => a.status === 'done');
  const lyricVideoDone   = doneSidekicks.filter((a) => a.videoSubtype === 'lyric').length;
  const artworkVideoDone = doneSidekicks.filter((a) => a.videoSubtype === 'visualiser').length;
  const followupLongformDone = doneSidekicks.filter(
    (a) => a.videoSubtype !== 'lyric' && a.videoSubtype !== 'visualiser'
  ).length;

  // Fold in live uploads detected from YouTube API inside the release window.
  // These augment the manually-tracked plan so an artist doesn't need to mark
  // "done" once the asset is actually live on the channel.
  const liveM = live ?? { shorts: 0, lyricVideo: 0, artworkVideo: 0, followupLongform: 0, officialPresent: false };
  const rawCount: Record<SupportSlotKey, number> = {
    shorts: shortsDone + liveM.shorts,
    lyricVideo: lyricVideoDone + liveM.lyricVideo,
    artworkVideo: artworkVideoDone + liveM.artworkVideo,
    // Community Posts aren't in the public API — artist marks manually.
    communityPost: Math.max(postsDone, communityPostOverride ? 1 : 0),
    followupLongform: followupLongformDone + liveM.followupLongform,
  };

  const slots: SlotResult[] = config.slots.map((spec) => {
    const done = rawCount[spec.key];
    const hit = done >= spec.target;
    // Shorts + community post show counts; yes/no slots (target === 1 text "Yes") show a tick only
    const showsCount = spec.key === 'shorts' || spec.key === 'communityPost';
    return {
      key: spec.key,
      label: spec.label,
      targetText: spec.targetText,
      done,
      target: spec.target,
      hit,
      showsCount,
    };
  });

  const coverageMax = slots.length;
  const coverageScore = slots.filter((s) => s.hit).length;
  const ratio = coverageMax > 0 ? coverageScore / coverageMax : 1;
  const coverageTier: CoverageTier = ratio >= 0.8 ? 'Strong' : ratio >= 0.4 ? 'Medium' : 'Low';

  const signal =
    coverageTier === 'Strong'
      ? 'Well supported — higher momentum potential'
      : coverageTier === 'Low'
      ? 'Weak support — risk of low discovery'
      : 'Partial support — add more pieces to lift';

  return {
    dropType,
    dropTypeLabel: config.label,
    coreLabel,
    corePresent,
    coreDone,
    slots,
    coverageScore,
    coverageMax,
    coverageTier,
    signal,
    recommendation: config.recommendation,
    timing: config.timing,
  };
}

const COVERAGE_COLOR: Record<CoverageTier, string> = {
  Low:    '#FF4A1C',
  Medium: '#FFD24C',
  Strong: '#1FBE7A',
};

// Campaign-wide output totals for the summary bar.
function getCampaignSupportOutput(plan: CampaignPlan, tracks: AutoTrack[]) {
  const allActions = plan.weeks.flatMap((w) => w.actions);
  const done = allActions.filter((a) => a.status === 'done');
  const totalShorts = done.filter((a) => a.type === 'short').length;
  const totalVideos = done.filter((a) => a.type === 'video' || a.type === 'collab').length;
  const totalPosts  = done.filter((a) => a.type === 'post').length;
  // Support pieces = everything that isn't a core drop (shorts + posts + sidekick videos)
  const totalSupport = totalShorts + totalPosts + Math.max(0, totalVideos - tracks.length);
  const fullySupported = tracks.filter((t) => getDropSupport(t).coverageTier === 'Strong').length;
  return {
    totalShorts,
    totalVideos,
    totalPosts,
    totalSupport,
    fullySupported,
    totalDrops: tracks.length,
  };
}

// ──── CAMPAIGN INTELLIGENCE ────────────────────────────────────────────────
// Aggregates per-drop gaps into a single headline-style summary. Everything
// is short, punchy, and instantly scannable — no paragraphs, no explanations.

type CampaignIntelligence = {
  fullySupported: number;
  totalDrops: number;
  tier: CoverageTier;
  summary: string;         // non-numeric headline (≤ 6 words)
  missingLabels: string[]; // short inline labels
  fix: string;             // 1 short action line
};

function getCampaignIntelligence(
  tracks: AutoTrack[],
  liveByTrackId?: Record<string, LiveMatch>,
  communityPostDone?: Record<string, boolean>,
): CampaignIntelligence {
  const supports = tracks.map((t) => getDropSupport(t, liveByTrackId?.[t.id], communityPostDone?.[t.id]));
  const totalDrops = supports.length;
  const fullySupported = supports.filter((s) => s.coverageTier === 'Strong').length;
  const strongRatio = totalDrops > 0 ? fullySupported / totalDrops : 1;
  const tier: CoverageTier = strongRatio >= 0.7 ? 'Strong' : strongRatio >= 0.35 ? 'Medium' : 'Low';

  // Count drops missing each slot (only counts drops whose type actually asks for that slot)
  const countMissing = (key: SupportSlotKey) =>
    supports.filter((s) => s.slots.some((sl) => sl.key === key && !sl.hit)).length;

  const missingShorts    = countMissing('shorts');
  const missingPosts     = countMissing('communityPost');
  const missingFollowup  = countMissing('followupLongform');
  const missingLyric     = countMissing('lyricVideo');
  const missingArtwork   = countMissing('artworkVideo');
  const missingCore      = supports.filter((s) => !s.coreDone).length;

  // Weighted short labels — top 3 only, inline display
  type Gap = { label: string; weight: number };
  const gaps: Gap[] = [];
  if (missingCore > 0)     gaps.push({ label: 'Core',      weight: missingCore * 5 });
  if (missingShorts > 0)   gaps.push({ label: 'Shorts',    weight: missingShorts * 3 });
  if (missingPosts > 0)    gaps.push({ label: 'Community', weight: missingPosts * 2 });
  if (missingFollowup > 0) gaps.push({ label: 'Follow-up', weight: missingFollowup * 2 });
  if (missingLyric > 0)    gaps.push({ label: 'Lyric',     weight: missingLyric });
  if (missingArtwork > 0)  gaps.push({ label: 'Artwork',   weight: missingArtwork });
  gaps.sort((a, b) => b.weight - a.weight);
  const missingLabels = gaps.slice(0, 3).map((g) => g.label);

  // Non-numeric headline summary — no "X / Y" noise, just judgement.
  let summary: string;
  if (totalDrops === 0) {
    summary = 'No drops tracked yet';
  } else if (fullySupported === totalDrops) {
    summary = 'Every drop fully supported';
  } else if (fullySupported === 0) {
    summary = 'No drops fully supported';
  } else if (strongRatio >= 0.7) {
    summary = 'Most drops supported';
  } else if (strongRatio >= 0.35) {
    summary = 'Support is inconsistent';
  } else {
    summary = 'Most drops under-supported';
  }

  // Short fix line — driven by heaviest gap
  let fix: string;
  if (totalDrops === 0) {
    fix = 'Add a drop to start';
  } else if (tier === 'Strong' && gaps.length === 0) {
    fix = 'Hold pace';
  } else if (missingCore > 0) {
    fix = 'Ship core assets first';
  } else if (missingShorts >= 2) {
    fix = 'Clip shorts within 72h';
  } else if (missingPosts >= 2) {
    fix = 'Post to community same day';
  } else if (missingFollowup > 0) {
    fix = 'Schedule follow-up longforms';
  } else if (missingLyric > 0 || missingArtwork > 0) {
    fix = 'Finish lyric / artwork videos';
  } else {
    fix = 'Close remaining gaps';
  }

  return { fullySupported, totalDrops, tier, summary, missingLabels, fix };
}

function DropCard({ track, live, communityPostDone, onToggleCommunityPost }: {
  track: AutoTrack;
  live?: LiveMatch;
  communityPostDone?: boolean;
  onToggleCommunityPost?: (trackId: string) => void;
}) {
  const support = getDropSupport(track, live, communityPostDone);
  const coverageColor = COVERAGE_COLOR[support.coverageTier];
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <div className="rounded-2xl p-4" style={{ background: '#F6F1E7', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      {/* Name + drop type + coverage tier */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <h4 className="font-black text-sm text-ink truncate">{track.name}</h4>
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink/45 mt-0.5">
            {support.dropTypeLabel}
          </div>
        </div>
        <span
          className="text-[10px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-full shrink-0"
          style={{ color: coverageColor, background: `${coverageColor}15` }}
        >
          {support.coverageTier}
        </span>
      </div>

      {/* CORE DROP */}
      <div className="mb-2 pb-2 border-b border-ink/5">
        <div className="flex items-center gap-2">
          <span
            className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
            style={{
              background: support.coreDone ? '#1FBE7A' : 'rgba(14,14,14,0.06)',
              color: support.coreDone ? '#ffffff' : 'rgba(14,14,14,0.35)',
            }}
          >
            {support.coreDone ? '✓' : '·'}
          </span>
          <span className="text-[12px] font-black text-ink truncate">{support.coreLabel}</span>
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink/35 ml-auto">Core</span>
        </div>
      </div>

      {/* SUPPORT CHECKLIST — per slot, just execution vs expectation */}
      <div className="mb-3">
        {support.slots.map((slot) => {
          const missing = !slot.hit;
          const isClickable = slot.key === 'communityPost' && !!onToggleCommunityPost;
          const handleClick = isClickable ? () => onToggleCommunityPost!(track.id) : undefined;
          return (
            <div
              key={slot.key}
              onClick={handleClick}
              role={isClickable ? 'button' : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onKeyDown={
                isClickable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleClick?.();
                      }
                    }
                  : undefined
              }
              className={`flex items-center justify-between py-1.5 px-2 -mx-2 rounded-md border-b border-ink/5 last:border-b-0 ${
                isClickable ? 'cursor-pointer hover:brightness-95 transition' : ''
              }`}
              style={
                missing
                  ? { background: 'rgba(255,74,28,0.08)', borderBottomColor: 'rgba(255,74,28,0.12)' }
                  : undefined
              }
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                  style={{
                    background: slot.hit ? '#1FBE7A' : '#FF4A1C',
                    color: '#ffffff',
                  }}
                >
                  {slot.hit ? '✓' : '!'}
                </span>
                <span
                  className="text-[12px] truncate"
                  style={{
                    color: missing ? '#FF4A1C' : 'rgba(14,14,14,0.8)',
                    fontWeight: missing ? 800 : 600,
                  }}
                >
                  {slot.label}
                  {missing && <span className="ml-1.5 text-[9px] font-black uppercase tracking-[0.14em]">Missing</span>}
                  {isClickable && missing && (
                    <span className="ml-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-ink/45">
                      Tap to mark done
                    </span>
                  )}
                  {isClickable && !missing && (
                    <span className="ml-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-ink/35">
                      Tap to undo
                    </span>
                  )}
                </span>
              </div>
              <span
                className="text-[11px] font-bold shrink-0 ml-2"
                style={{ color: missing ? '#FF4A1C' : 'rgba(14,14,14,0.5)' }}
              >
                {slot.showsCount ? `${slot.done}/${slot.target}` : slot.hit ? '✓' : slot.targetText}
              </span>
            </div>
          );
        })}
      </div>

      {/* SUPPORT PILL — number only, no repeated prose */}
      <div
        className="rounded-xl px-3 py-2 flex items-center justify-between gap-3"
        style={{ background: `${coverageColor}10` }}
      >
        <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-ink/40">Support</span>
        <span className="text-[13px] font-black" style={{ color: coverageColor }}>
          {support.coverageScore}/{support.coverageMax}
        </span>
      </div>

      {/* FULLY SUPPORTED — microsite-style: mono label + bold status + rationale */}
      {support.coverageTier === 'Strong' && support.coreDone && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(14,14,14,0.08)' }}>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink/45">
              Status
            </span>
            <span className="text-[14px] font-black uppercase tracking-wider" style={{ color: '#1FBE7A' }}>
              Fully supported
            </span>
          </div>
          <p className="mt-2 text-[12px] font-semibold text-ink/65 leading-snug">
            → Support stack complete. Strong early signals — ready to land.
          </p>
        </div>
      )}

      {/* Optional deeper guidance — hidden by default */}
      <button
        onClick={() => setDetailOpen((d) => !d)}
        className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-ink/35 hover:text-ink/60 transition-colors"
      >
        {detailOpen ? '▲ Hide detail' : '▼ Show detail'}
      </button>

      {detailOpen && (
        <div className="mt-2 pt-2 border-t border-ink/5 space-y-2">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink/35 mb-0.5">
              How to support this drop
            </div>
            <div className="text-[11px] font-semibold text-ink/70 leading-snug">
              {support.recommendation}
            </div>
          </div>
          <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(14,14,14,0.035)' }}>
            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink/35 mb-1">
              Timing
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-baseline gap-2">
                <span className="text-[9px] font-black uppercase tracking-[0.14em] text-ink/45 shrink-0 w-12">
                  Day 0
                </span>
                <span className="text-[11px] font-semibold text-ink/70 truncate">
                  {support.timing.day0}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[9px] font-black uppercase tracking-[0.14em] text-ink/45 shrink-0 w-12">
                  Day 1–3
                </span>
                <span className="text-[11px] font-semibold text-ink/70 truncate">
                  {support.timing.day1to3}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[9px] font-black uppercase tracking-[0.14em] text-ink/45 shrink-0 w-12">
                  Day 5+
                </span>
                <span className="text-[11px] font-semibold text-ink/70 truncate">
                  {support.timing.day5plus}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CAMPAIGN TOOLS CARD ────────────────────────────────────────────────────
// Surfaces YouTube-native tools active in the campaign window (collabs /
// premieres / lives detected from the API) plus two manual reminders for
// Merch Shelf + Bandsintown (not exposed by the public API).
function CampaignToolsCard({
  plan,
  onToggleMerch,
  onToggleBands,
}: {
  plan: CampaignPlan;
  onToggleMerch: () => void;
  onToggleBands: () => void;
}) {
  const merchActive = !!plan.manualOverrides?.merchShelfActive;
  const bandsActive = !!plan.manualOverrides?.bandsintownActive;

  return (
    <div
      className="mb-4 rounded-2xl p-4"
      style={{ background: '#FAF7F2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink/45">
          Channel Setup
        </span>
        <span className="text-[9px] font-semibold text-ink/35">One-time activations</span>
      </div>

      {/* Manual reminders — features not exposed by the public API */}
      <div className="flex flex-col gap-1.5">
        <ToolReminder
          label="Merch Shelf"
          hint="Activate under YouTube Studio → Monetization → Shopping"
          active={merchActive}
          onToggle={onToggleMerch}
        />
        <ToolReminder
          label="Bandsintown on Artist Channel"
          hint="Link in YouTube Studio → Customization → Basic info"
          active={bandsActive}
          onToggle={onToggleBands}
        />
      </div>
    </div>
  );
}

function ToolReminder({
  label,
  hint,
  active,
  onToggle,
}: {
  label: string;
  hint: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full text-left rounded-md px-2 py-1.5 hover:brightness-95 transition"
      style={
        active
          ? { background: 'rgba(31,190,122,0.10)' }
          : { background: 'rgba(255,210,76,0.14)' }
      }
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
          style={{
            background: active ? '#1FBE7A' : '#FFA23A',
            color: '#ffffff',
          }}
        >
          {active ? '✓' : '!'}
        </span>
        <span className="flex items-baseline gap-1.5 min-w-0">
          <span
            className="text-[12px] font-black truncate"
            style={{ color: active ? '#1FBE7A' : '#B05700' }}
          >
            {label}
          </span>
          <span className="text-[10px] font-semibold text-ink/45 truncate">{hint}</span>
        </span>
      </div>
      <span className="text-[9px] font-bold uppercase tracking-[0.14em] shrink-0 ml-2 text-ink/40">
        {active ? 'Tap to undo' : 'Tap to confirm'}
      </span>
    </button>
  );
}

function DropView({ plan, onToggleCommunityPost }: { plan: CampaignPlan; onToggleCommunityPost?: (trackId: string) => void }) {
  const communityPostDone = plan.manualOverrides?.communityPostDone || {};
  const planTracks = useMemo(() => deriveAutoTracks(plan), [plan]);
  const watcher = useWatcherChannel();
  const liveVideos = watcher.state?.latestVideos ?? [];
  // Prefer real uploads as the source of drop cards when the channel has any
  // longform. Fall back to the manual campaign plan only when no live data.
  const liveTracks = useMemo(() => deriveLiveTracks(watcher.state, plan.startDate), [watcher.state, plan.startDate]);
  // DropView focuses on live drops (real uploads) so the user can concentrate
  // on completing support for what's actually shipped. Planned future drops
  // still appear in the Campaign Plan phase dropdown.
  const autoTracks = useMemo(
    () => (liveTracks.length > 0 ? liveTracks : planTracks),
    [liveTracks, planTracks],
  );
  const liveByTrackId = useMemo(() => {
    const map: Record<string, LiveMatch> = {};
    for (const t of autoTracks) map[t.id] = matchLiveToDrop(t.date, liveVideos);
    return map;
  }, [autoTracks, liveVideos]);

  if (autoTracks.length === 0) {
    return (
      <div className="text-center py-14">
        <div className="text-2xl mb-3 text-ink/30">◆</div>
        <p className="text-base font-black text-ink">No drops yet</p>
        <p className="mt-2 text-[13px] font-semibold text-ink/55 leading-snug max-w-sm mx-auto">
          Plan and track support around your key releases.
          <br />
          Add a video or collab in Campaign View to create your first drop.
        </p>
      </div>
    );
  }

  // Summary/coverage numbers are rendered in the PulseStrip above the tracks.
  // Sort worst-coverage first so gaps surface immediately.
  const sortedTracks = [...autoTracks].sort((a, b) => {
    const sa = getDropSupport(a, liveByTrackId[a.id], communityPostDone[a.id]).coverageScore;
    const sb = getDropSupport(b, liveByTrackId[b.id], communityPostDone[b.id]).coverageScore;
    return sa - sb;
  });

  return (
    <div>
      {/* ── DROP CARDS — worst coverage first (summary/coverage moved to PulseStrip) ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {sortedTracks.map((track) => (
          <DropCard
            key={track.id}
            track={track}
            live={liveByTrackId[track.id]}
            communityPostDone={!!communityPostDone[track.id]}
            onToggleCommunityPost={onToggleCommunityPost}
          />
        ))}
      </div>
    </div>
  );
}

// ──── VIEW MODE TOGGLE ──────────────────────────────────────────────────────
function ViewModeToggle({ mode, onChange }: { mode: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div className="mb-6 flex rounded-xl p-1" style={{ background: '#F6F1E7', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      {(['campaign', 'drop'] as ViewMode[]).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className="flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all"
          style={{
            background: mode === m ? '#0E0E0E' : 'transparent',
            color: mode === m ? '#FAF7F2' : 'rgba(14,14,14,0.4)',
          }}>
          {m === 'campaign' ? 'Campaign View' : 'Drop View'}
        </button>
      ))}
    </div>
  );
}

// ──── PHASE BLOCK ────────────────────────────────────────────────────────────
// Single expandable phase section
function PhaseBlock({ phase, plan, expanded, onToggleExpand, onToggleActionStatus, onEditAction, onDeleteAction, onOpenAdd, draggedId, dragOverId, onDragStart, onDragOver, onDrop, showCollapsedSupport, onToggleSupport, deletingIds, onCycleSupportStatus, onAddSupportItem, onRemoveSupportItem }: {
  phase: CampaignPhase;
  plan: CampaignPlan;
  expanded: boolean;
  onToggleExpand: (name: PhaseName) => void;
  onToggleActionStatus: (id: string) => void;
  onEditAction: (action: CampaignAction, weekNum: number) => void;
  onDeleteAction: (weekNum: number, action: CampaignAction) => void;
  onOpenAdd: (weekNum: number, kind?: MissingActionKind) => void;
  draggedId: string | null;
  dragOverId: string | null;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDrop: () => void;
  showCollapsedSupport: Set<string>;
  onToggleSupport: (weekKey: string) => void;
  deletingIds: Set<string>;
  onCycleSupportStatus: (planId: string, itemId: string) => void;
  onAddSupportItem: (planId: string, phase: SupportPhase) => void;
  onRemoveSupportItem: (planId: string, itemId: string) => void;
}) {
  // Silence unused-prop warnings — keeping the signature intact for the
  // existing render call site while this section is redesigned for planning.
  void onToggleActionStatus; void onEditAction; void onDeleteAction;
  void draggedId; void dragOverId; void onDragStart; void onDragOver; void onDrop;
  void showCollapsedSupport; void onToggleSupport; void deletingIds;
  void onCycleSupportStatus; void onAddSupportItem; void onRemoveSupportItem;

  const watcher = useWatcherChannel();
  const communityPostDone = plan.manualOverrides?.communityPostDone || {};

  // Merge: live drops supersede planned for same week; planned fills the future.
  const liveTracks = deriveLiveTracks(watcher.state, plan.startDate);
  const planTracks = deriveAutoTracks(plan);
  const liveWeeks = new Set(liveTracks.map((t) => t.weekNum));
  const liveDates = new Set(liveTracks.map((t) => t.date));
  // Fuzzy title match — if a planned drop looks like a live drop (same core
  // title words), suppress the planned copy so we don't duplicate real
  // releases like "Change (Official Video)" vs "'Change' — Official Music Video".
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const liveTitleTokens = liveTracks.map((t) => new Set(norm(t.name).split(' ').filter((w) => w.length > 2)));
  const matchesLiveTitle = (planTitle: string) => {
    const tokens = norm(planTitle).split(' ').filter((w) => w.length > 2);
    if (tokens.length === 0) return false;
    return liveTitleTokens.some((lt) => {
      const overlap = tokens.filter((t) => lt.has(t)).length;
      return overlap >= 2 && overlap / tokens.length >= 0.4;
    });
  };
  const autoTracks = [
    ...liveTracks,
    ...planTracks.filter((t) => {
      return !liveWeeks.has(t.weekNum) && !liveDates.has(t.date) && !matchesLiveTitle(t.name);
    }),
  ].sort((a, b) => a.weekNum - b.weekNum);

  // Phase date range from campaign start + weekStart/weekEnd.
  const startMs = new Date(plan.startDate + 'T12:00:00').getTime();
  const DAY = 86400000;
  const phaseStartMs = startMs + (phase.weekStart - 1) * 7 * DAY;
  const phaseEndMs   = startMs + phase.weekEnd * 7 * DAY;

  const tracksInPhase = autoTracks.filter((t) => {
    const d = new Date(t.date).getTime();
    return d >= phaseStartMs && d < phaseEndMs;
  });

  const liveVideos = watcher.state?.latestVideos ?? [];
  const trackSupports = tracksInPhase.map((t) => {
    const live = matchLiveToDrop(t.date, liveVideos);
    const support = getDropSupport(t, live, communityPostDone[t.id]);
    return { track: t, support };
  });

  const dropCount = tracksInPhase.length;
  const plannedCount = trackSupports.filter((ts) => ts.track.status === 'upcoming').length;
  // Only live/past drops count toward "missing support" — future-planned drops are flagged as Planned, not behind.
  const missingSupport = trackSupports.filter(
    (ts) => ts.track.status !== 'upcoming' && (!ts.support.coreDone || ts.support.coverageTier !== 'Strong')
  ).length;

  // Status from observable state.
  const currentWeekNum = getCurrentWeekNum(plan);
  const isPast    = currentWeekNum > phase.weekEnd;
  const isCurrent = currentWeekNum >= phase.weekStart && currentWeekNum <= phase.weekEnd;
  let status: 'Complete' | 'In Progress' | 'Upcoming' | 'Behind';
  if (isPast && dropCount > 0 && missingSupport === 0) status = 'Complete';
  else if ((isPast || isCurrent) && missingSupport > 0) status = 'Behind';
  else if (isCurrent) status = 'In Progress';
  else status = 'Upcoming';

  const statusColor =
    status === 'Complete'   ? '#1FBE7A' :
    status === 'Behind'     ? '#FF4A1C' :
    status === 'In Progress' ? phase.color :
                               'rgba(14,14,14,0.35)';

  const micro = PHASE_MICRO[phase.name];
  // Key moments in this phase from the plan's moments array
  const phaseMoments = (plan.moments ?? []).filter(
    (m) => m.weekNum >= phase.weekStart && m.weekNum <= phase.weekEnd
  );
  // YouTube planner cards for this phase
  const ytMoments = (plan.youtubeMoments ?? []).filter(
    (m) => m.phase === phase.name
  );

  const PhaseSummary = () => (
    <div className="w-full">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: statusColor }} />
          <span className="font-black text-sm text-ink">{phase.name}</span>
          <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: statusColor }}>
            {status}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-[11px] font-bold text-ink/60">
          {ytMoments.length > 0 ? (
            <>
              <span>{ytMoments.length} {ytMoments.length === 1 ? 'moment' : 'moments'}</span>
              {ytMoments.filter((m) => m.priority === 'high').length > 0 && (
                <span style={{ color: '#FF4A1C' }}>· {ytMoments.filter((m) => m.priority === 'high').length} high priority</span>
              )}
            </>
          ) : (
            <>
              <span>{dropCount} {dropCount === 1 ? 'drop' : 'drops'}</span>
              {missingSupport > 0 && (
                <span style={{ color: '#FF4A1C' }}>· {missingSupport} missing support</span>
              )}
              {missingSupport === 0 && plannedCount > 0 && (
                <span style={{ color: '#5B7CFA' }}>· {plannedCount} planned</span>
              )}
            </>
          )}
        </div>
      </div>
      <div className="mt-1 text-[11px] text-ink/50">{micro.desc}</div>
      <div className="mt-0.5 text-[10px] font-bold text-ink/40 uppercase tracking-wide">Cadence: {micro.cadence}</div>
      {phaseMoments.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {phaseMoments.slice(0, 5).map((m, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(14,14,14,0.06)', color: 'rgba(14,14,14,0.55)' }}>
              {m.name}
            </span>
          ))}
          {phaseMoments.length > 5 && (
            <span className="text-[10px] text-ink/40">+{phaseMoments.length - 5} more</span>
          )}
        </div>
      )}
    </div>
  );

  if (!expanded) {
    return (
      <button
        onClick={() => onToggleExpand(phase.name)}
        className="w-full mb-2 px-4 py-3 rounded-xl text-left transition hover:shadow-sm"
        style={{ background: '#F6F1E7', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0"><PhaseSummary /></div>
          <span className="text-ink/30 text-sm">▼</span>
        </div>
      </button>
    );
  }

  return (
    <div className="mb-3 rounded-2xl overflow-hidden" style={{ background: '#F6F1E7', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <button
        onClick={() => onToggleExpand(phase.name)}
        className="w-full px-4 py-3 text-left border-b border-ink/5"
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0"><PhaseSummary /></div>
          <span className="text-ink/30 text-sm">▲</span>
        </div>
      </button>

      <div className="p-4">
        {/* ── YouTube Moment Planner Cards ────────────────────────────── */}
        {ytMoments.length > 0 ? (
          <>
            {ytMoments.map((m) => {
              const dateLabel = new Date(m.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: m.date.startsWith('2027') ? 'numeric' : undefined });
              const statusColor =
                m.status === 'complete' ? '#1FBE7A' :
                m.status === 'partial' ? '#FFD24C' :
                m.status === 'core_missing' ? '#FF4A1C' :
                '#5B7CFA'; // planned
              const statusLabel =
                m.status === 'complete' ? 'COMPLETE' :
                m.status === 'partial' ? 'PARTIAL' :
                m.status === 'core_missing' ? 'CORE MISSING' :
                'PLANNED';
              const priorityBg =
                m.priority === 'high' ? 'rgba(255,74,28,0.08)' :
                m.priority === 'medium' ? 'rgba(255,210,76,0.08)' :
                'rgba(14,14,14,0.03)';
              const typeBadge = m.momentType.replace(/_/g, ' ').toUpperCase();

              return (
                <div
                  key={m.id}
                  className="mb-3 last:mb-0 rounded-lg p-3"
                  style={{ background: priorityBg, border: '1px solid rgba(14,14,14,0.06)' }}
                >
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-[13px] text-ink leading-tight">{m.title}</span>
                        <span className="text-[10px] font-semibold text-ink/45 shrink-0">{dateLabel}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] font-black uppercase tracking-[0.14em] px-1.5 py-0.5 rounded" style={{ background: phase.color, color: '#FAF7F2' }}>
                          {typeBadge}
                        </span>
                        {m.priority === 'high' && (
                          <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[#FF4A1C]">HIGH PRIORITY</span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.12em] shrink-0" style={{ color: statusColor }}>
                      {statusLabel}
                    </span>
                  </div>

                  {/* Headline — why this matters */}
                  <div className="text-[11px] text-ink/65 font-semibold mt-1.5 leading-snug">
                    {m.headline}
                  </div>

                  {/* Expected support stack */}
                  <div className="mt-2">
                    <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink/40 mb-0.5">
                      YouTube support needed
                    </div>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {m.expectedSupport.map((s, i) => (
                        <span key={i} className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(14,14,14,0.06)', color: 'rgba(14,14,14,0.6)' }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Reason — why this is in the planner */}
                  <div className="mt-2 text-[10px] text-ink/40 italic leading-snug">
                    {m.reason}
                  </div>
                </div>
              );
            })}
          </>
        ) : dropCount === 0 ? (
          <div className="text-[12px] text-ink/50 italic">No moments scheduled in this phase.</div>
        ) : null}

        {/* ── Legacy drop support cards (for live data / non-timeline plans) ── */}
        {ytMoments.length === 0 && trackSupports.map(({ track, support }) => {
          const missingSlots = support.slots.filter((s) => !s.hit);
          const isUpcoming = track.status === 'upcoming';
          const tierColor = isUpcoming ? '#5B7CFA' : COVERAGE_COLOR[support.coverageTier];
          const supportLabel = isUpcoming
            ? 'Planned'
            : !support.coreDone ? 'Core missing'
            : support.coverageTier === 'Strong' ? 'Supported'
            : support.coverageTier === 'Medium' ? 'Partial'
            : 'Missing support';
          const expectedLine = support.slots
            .map((s) => `${s.label}${s.target > 1 ? ` ×${s.target}` : ''}`)
            .join(' · ');

          const trackDate = new Date(track.date);
          const dateLabel = trackDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

          return (
            <div
              key={track.id}
              className="mb-3 last:mb-0 rounded-lg p-3"
              style={{ background: 'rgba(255,255,255,0.55)' }}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="font-black text-[13px] text-ink truncate">
                    {track.name || track.anchorAction?.title || 'Drop'}
                  </span>
                  <span className="text-[10px] font-semibold text-ink/45 shrink-0">{dateLabel}</span>
                </div>
                <span
                  className="text-[10px] font-black uppercase tracking-[0.12em] shrink-0"
                  style={{ color: tierColor }}
                >
                  {supportLabel}
                </span>
              </div>

              <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink/40 mb-0.5">
                Expected
              </div>
              <div className="text-[11px] font-semibold text-ink/65 mb-2 leading-snug">
                {expectedLine}
              </div>

              {missingSlots.length > 0 ? (
                <>
                  <div
                    className="text-[9px] font-bold uppercase tracking-[0.14em] mb-0.5"
                    style={{ color: isUpcoming ? '#5B7CFA' : '#FF4A1C' }}
                  >
                    {isUpcoming ? 'Planned to ship' : 'Gaps'}
                  </div>
                  <div
                    className="text-[11px] font-bold leading-snug"
                    style={{ color: isUpcoming ? '#5B7CFA' : '#FF4A1C' }}
                  >
                    {missingSlots.map((s) => s.label).join(' · ')}
                  </div>
                </>
              ) : (
                <div className="text-[11px] font-bold" style={{ color: '#1FBE7A' }}>
                  ✓ Multiformat strategy supported
                </div>
              )}
            </div>
          );
        })}

        {/* Phase insight — gaps, opportunities, cadence notes */}
        {ytMoments.length > 0 && (
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(14,14,14,0.08)' }}>
            {(() => {
              const highPriority = ytMoments.filter((m) => m.priority === 'high');
              const medPriority = ytMoments.filter((m) => m.priority === 'medium');
              const coreMissing = ytMoments.filter((m) => m.status === 'core_missing');
              return (
                <div className="space-y-1.5">
                  {highPriority.length > 0 && (
                    <div className="text-[11px] text-ink/65 leading-snug">
                      <span className="font-black text-ink/80">Strongest opportunities:</span>{' '}
                      {highPriority.slice(0, 3).map((m) => m.title).join(', ')}
                      {highPriority.length > 3 && ` + ${highPriority.length - 3} more`}
                    </div>
                  )}
                  {coreMissing.length > 0 && (
                    <div className="text-[11px] leading-snug" style={{ color: '#FF4A1C' }}>
                      <span className="font-black">Missing core support:</span>{' '}
                      {coreMissing.map((m) => m.title).join(', ')}
                    </div>
                  )}
                  {medPriority.length > 0 && highPriority.length === 0 && (
                    <div className="text-[11px] text-ink/50 leading-snug">
                      {medPriority.length} medium-priority {medPriority.length === 1 ? 'moment' : 'moments'} — cadence content around live dates
                    </div>
                  )}
                  <div className="text-[10px] font-bold text-ink/40 mt-1">
                    Recommended cadence: {micro.cadence}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Add to this phase — microsite-style action buttons */}
        <div className="mt-3 pt-3 flex flex-wrap gap-2" style={{ borderTop: '1px solid rgba(14,14,14,0.08)' }}>
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink/45 w-full mb-1">
            Add to {phase.name}
          </span>
          {([
            { kind: 'video'      as const, label: '+ Video' },
            { kind: 'short'      as const, label: '+ Short' },
            { kind: 'post'       as const, label: '+ Post' },
            { kind: 'collab'     as const, label: '+ Collab' },
            { kind: 'live'       as const, label: '+ Live' },
            { kind: 'afterparty' as const, label: '+ Afterparty' },
          ]).map((b) => (
            <button
              key={b.kind}
              onClick={() => onOpenAdd(phase.weekStart, b.kind)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-[0.12em] transition-all hover:-translate-y-0.5"
              style={{ background: '#0E0E0E', color: '#FAF7F2' }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ──── WEEK ROW — control panel, not report ──────────────────────────────────
// Current week: expanded with Signal label, Action label, missing action buttons.
// Previous weeks: single summary line. No paragraphs, no narrative.

const WEEK_SIGNAL_META: Record<WeekStatus, { label: string; color: string }> = {
  hot:     { label: 'Strong',  color: '#1FBE7A' },
  warm:    { label: 'Warming', color: '#FFD24C' },
  cooling: { label: 'Cooling', color: '#FF4A1C' },
  cold:    { label: 'Cold',    color: '#71717a' },
};

const WEEK_ACTION_META: Record<WeekStatus, { label: string; color: string }> = {
  hot:     { label: 'Maintain', color: '#1FBE7A' },
  warm:    { label: 'Push',     color: '#FFD24C' },
  cooling: { label: 'Recover',  color: '#FF4A1C' },
  cold:    { label: 'Start',    color: '#2C25FF' },
};

type MissingActionKind = 'video' | 'short' | 'post' | 'collab' | 'afterparty' | 'live';

const MISSING_ACTION_META: Record<MissingActionKind, {
  label: string;
  type: ActionType;
  system: ActionSystem;
  intent: ActionIntent;
  role: MomentRole;
  bg: string;
  defaultTitle: string;
}> = {
  video:      { label: 'Video',      type: 'video',      system: 2, intent: 'convert', role: 'hero',    bg: '#FF4A1C', defaultTitle: 'New Video' },
  short:      { label: 'Short',      type: 'short',      system: 1, intent: 'engage',  role: 'push',    bg: '#FFD24C', defaultTitle: 'New Short' },
  post:       { label: 'Post',       type: 'post',       system: 1, intent: 'engage',  role: 'support', bg: '#2C25FF', defaultTitle: 'New Update' },
  collab:     { label: 'Collab',     type: 'collab',     system: 2, intent: 'convert', role: 'hero',    bg: '#A8B5FF', defaultTitle: 'New Collab' },
  afterparty: { label: 'Afterparty', type: 'afterparty', system: 2, intent: 'convert', role: 'support', bg: '#FFD24C', defaultTitle: 'Premiere Afterparty' },
  live:       { label: 'Live',       type: 'live',       system: 2, intent: 'convert', role: 'hero',    bg: '#FF4A1C', defaultTitle: 'Live Stream' },
};

const VIDEO_SUBTYPE_LABELS: Record<VideoSubtype, string> = {
  official:   'Official Video',
  lyric:      'Lyric Video',
  visualiser: 'Artwork / Visualiser',
  live:       'Live / Performance',
  collab:     'Collab Video',
};

function getCurrentWeekNum(plan: CampaignPlan): number {
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const start = new Date(plan.startDate + 'T12:00:00');
  const daysSinceStart = Math.floor((today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(1, Math.min(plan.weeks.length, Math.floor(daysSinceStart / 7) + 1));
}

function WeekRow({
  week, phase, plan, tier, allStatuses, isCurrent,
  onToggleActionStatus, onEditAction, onDeleteAction, onOpenAdd,
  draggedId, dragOverId, onDragStart, onDragOver, onDrop,
  showCollapsedSupport, onToggleSupport, deletingIds,
}: {
  week: CampaignWeek;
  phase: CampaignPhase;
  plan: CampaignPlan;
  tier: ChannelTier;
  allStatuses: WeekStatus[];
  isCurrent: boolean;
  onToggleActionStatus: (id: string) => void;
  onEditAction: (action: CampaignAction, weekNum: number) => void;
  onDeleteAction: (weekNum: number, action: CampaignAction) => void;
  onOpenAdd: (weekNum: number, kind?: MissingActionKind) => void;
  draggedId: string | null;
  dragOverId: string | null;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDrop: () => void;
  showCollapsedSupport: Set<string>;
  onToggleSupport: (weekKey: string) => void;
  deletingIds: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const phaseShort = PHASE_MICRO[phase.name].short;
  const weekActions = week.actions;
  const weekIdx = plan.weeks.findIndex((w) => w.week === week.week);
  const weekStatus = allStatuses[weekIdx] ?? 'cold';

  const signalMeta = WEEK_SIGNAL_META[weekStatus];
  const actionMeta = WEEK_ACTION_META[weekStatus];

  // Compute missing action buttons from cadence targets
  const targets = autoTargets(plan);
  const doneCount = (type: ActionType) => weekActions.filter((a) => a.type === type && a.status === 'done').length;
  const missingKinds: MissingActionKind[] = [];
  if (doneCount('video') < (targets.videosPerWeek || 0)) missingKinds.push('video');
  if (doneCount('short') < (targets.shortsPerWeek || 0)) missingKinds.push('short');
  if (doneCount('post') < (targets.postsPerWeek || 0)) missingKinds.push('post');

  // Also surface planned-but-missed items from the current week as extra missing buttons
  const missedActions = weekActions.filter((a) => a.status === 'missed');

  // Single optional context line (max 1)
  const shippedCount = weekActions.filter((a) => a.status === 'done').length;
  let contextLine: string | null = null;
  if (missedActions.length > 0) contextLine = `${missedActions.length} missed`;
  else if (shippedCount > 0) contextLine = `${shippedCount} shipped`;

  // Piece breakdown: "3 pieces: 2 Shorts, 1 Post (1 Collab)"
  const doneActions = weekActions.filter((a) => a.status === 'done');
  const shortsDone = doneActions.filter((a) => a.type === 'short').length;
  const postsDone  = doneActions.filter((a) => a.type === 'post').length;
  const videosDone = doneActions.filter((a) => a.type === 'video').length;
  const collabsDone = doneActions.filter(isCollabAction).length;
  const totalPieces = shortsDone + postsDone + videosDone;
  const hasCollab = collabsDone > 0;
  const breakdownParts: string[] = [];
  if (shortsDone > 0) breakdownParts.push(`${shortsDone} Short${shortsDone > 1 ? 's' : ''}`);
  if (postsDone  > 0) breakdownParts.push(`${postsDone} Post${postsDone > 1 ? 's' : ''}`);
  if (videosDone > 0) breakdownParts.push(`${videosDone} Video${videosDone > 1 ? 's' : ''}`);
  const breakdownLine = totalPieces > 0
    ? `${totalPieces} piece${totalPieces > 1 ? 's' : ''}: ${breakdownParts.join(', ')}${hasCollab ? ` (${collabsDone} Collab)` : ''}`
    : null;

  const heroAction = weekActions.find((a) => a.system === 2 && !a.dropWindowId);
  const shorts = weekActions.filter((a) => a.type === 'short' && !a.dropWindowId);
  const supports = weekActions.filter((a) => a.type !== 'short' && a.system === 1 && !a.dropWindowId);
  const weekDropWindows = (plan.dropWindows || []).filter((dw) => dw.weekNum === week.week);

  // Open the AddContentModal pre-seeded with this kind. We never create an
  // empty action straight in the timeline — every item must enter through the
  // modal so the user always supplies a real title before anything is added.
  const handleAddMissing = useCallback((kind: MissingActionKind) => {
    onOpenAdd(week.week, kind);
  }, [week.week, onOpenAdd]);

  // ── Collapsed one-line summary for non-current weeks ──────────────────────
  if (!isCurrent && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left rounded-xl px-3 py-2 flex items-center gap-3 transition-colors hover:bg-ink/[0.04]"
        style={{ border: '1px solid rgba(14,14,14,0.06)' }}
      >
        <span className="text-[11px] font-black text-ink/70 shrink-0">W{week.week}</span>
        <span className="text-[9px] font-bold uppercase tracking-[0.12em] shrink-0" style={{ color: phase.color }}>{phaseShort}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: signalMeta.color }} />
          <span className="text-[11px] font-bold" style={{ color: signalMeta.color }}>{signalMeta.label}</span>
        </div>
        <span className="text-ink/20">·</span>
        <span className="text-[11px] font-semibold text-ink/50 truncate">{actionMeta.label}</span>
        {breakdownLine ? (
          <>
            <span className="text-ink/20">·</span>
            <span className="text-[10px] font-semibold text-ink/50 truncate">{breakdownLine}</span>
            {hasCollab && (
              <span
                className="text-[9px] font-black uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full shrink-0"
                style={{ background: '#3A86FF15', color: '#3A86FF' }}
                title={`${collabsDone} collab boost${collabsDone > 1 ? 's' : ''} this week`}
              >
                ★ Collab
              </span>
            )}
          </>
        ) : contextLine ? (
          <>
            <span className="text-ink/20">·</span>
            <span className="text-[10px] font-semibold text-ink/40 truncate">{contextLine}</span>
          </>
        ) : null}
        <span className="ml-auto text-[10px] text-ink/30">▸</span>
      </button>
    );
  }

  // ── Expanded control panel (current week or user-expanded past week) ─────
  return (
    <div className="rounded-xl" style={{ background: isCurrent ? '#F6F1E7' : 'rgba(14,14,14,0.02)', border: `1.5px solid ${isCurrent ? phase.color + '30' : 'rgba(14,14,14,0.06)'}` }}>
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h4 className="font-black text-sm text-ink shrink-0">Week {week.week}</h4>
          <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: phase.color }}>— {phaseShort}</span>
          {isCurrent && (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full tracking-wide shrink-0"
              style={{ color: '#ffffff', background: phase.color }}>NOW</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-semibold text-ink/30">{week.dateRange}</span>
          <button
            onClick={() => onOpenAdd(week.week)}
            className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-[0.12em] text-white hover:shadow transition-all"
            style={{ background: '#0E0E0E' }}
            title={`Add content to Week ${week.week}`}
          >
            + Add content
          </button>
          {!isCurrent && (
            <button onClick={() => setOpen(false)} className="text-ink/30 hover:text-ink/60 text-[10px]">▴</button>
          )}
        </div>
      </div>

      {/* Signal + Action — big, label-only, no paragraph */}
      <div className="px-4 pb-3 flex items-center gap-6 flex-wrap">
        <div className="flex items-baseline gap-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/40">Signal</span>
          <span className="text-base font-black leading-none" style={{ color: signalMeta.color }}>{signalMeta.label}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/40">Action</span>
          <span className="text-base font-black leading-none" style={{ color: actionMeta.color }}>{actionMeta.label}</span>
        </div>
        {breakdownLine && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-ink/50">{breakdownLine}</span>
            {hasCollab && (
              <span
                className="text-[9px] font-black uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full"
                style={{ background: '#3A86FF15', color: '#3A86FF' }}
                title={`${collabsDone} collab boost${collabsDone > 1 ? 's' : ''} this week`}
              >
                ★ Collab
              </span>
            )}
          </div>
        )}
        {!breakdownLine && contextLine && (
          <span className="text-[10px] font-semibold text-ink/40">{contextLine}</span>
        )}
      </div>

      {/* Missing action buttons — only for current week, only items with gaps */}
      {isCurrent && missingKinds.length > 0 && (
        <div className="px-4 pb-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/55 mb-2">Missing:</div>
          <div className="flex flex-wrap gap-2">
            {missingKinds.map((kind) => {
              const meta = MISSING_ACTION_META[kind];
              return (
                <button
                  key={kind}
                  onClick={() => handleAddMissing(kind)}
                  title={`Add missing ${meta.label.toLowerCase()}`}
                  className="group flex items-center gap-2 rounded-xl px-4 py-2.5 transition-all"
                  style={{
                    background: meta.bg,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
                  }}
                >
                  <span className="text-white font-black text-[11px] tracking-widest uppercase">+ {meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Minimal "Show details" toggle — only when there's rich content to show */}
      {(heroAction || shorts.length > 0 || supports.length > 0 || weekDropWindows.length > 0) && (
        <div className="px-4 pb-3">
          <button
            onClick={() => setShowDetails((s) => !s)}
            className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink/40 hover:text-ink/70 transition-colors"
          >
            {showDetails ? '▲ Hide content' : '▼ View content'}
          </button>
        </div>
      )}

      {/* Detail block — raw actions list, same handlers as before */}
      {showDetails && (
        <div className="px-4 pb-4 pt-1 border-t border-ink/5">
          {weekDropWindows.map((dw) => (
            <DropWindowBlock
              key={dw.id}
              dw={dw}
              actions={weekActions}
              phaseColor={phase.color}
              onToggleStatus={onToggleActionStatus}
              onEdit={onEditAction}
            />
          ))}

          {heroAction && (
            <div className="mb-3 mt-3">
              <HeroMoment
                action={heroAction}
                weekNum={week.week}
                onToggleStatus={onToggleActionStatus}
                onEdit={onEditAction}
                onDelete={onDeleteAction}
                draggedId={draggedId}
                dragOverId={dragOverId}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
                isDeleting={deletingIds.has(heroAction.id)}
              />
            </div>
          )}

          {shorts.length > 0 && (
            <div className="mb-3">
              <ShortCluster
                shorts={shorts}
                weekNum={week.week}
                onToggleStatus={onToggleActionStatus}
                onEdit={onEditAction}
                onDelete={onDeleteAction}
                draggedId={draggedId}
                dragOverId={dragOverId}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
                deletingIds={deletingIds}
              />
            </div>
          )}

          {supports.length > 0 && (
            <SupportStack
              supports={supports}
              weekNum={week.week}
              onToggleStatus={onToggleActionStatus}
              onEdit={onEditAction}
              onDelete={onDeleteAction}
              draggedId={draggedId}
              dragOverId={dragOverId}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              showCollapsedSupport={showCollapsedSupport}
              onToggleSupport={onToggleSupport}
              deletingIds={deletingIds}
            />
          )}
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// ADD CONTENT MODAL — 3-step: type → title/date → add
// ═══════════════════════════════════════════════════════════════════════════════

const ADD_MODAL_KINDS: MissingActionKind[] = ['short', 'post', 'video', 'collab', 'live', 'afterparty'];

function AddContentModal({ plan, initialWeek, initialKind, onAdd, onClose }: {
  plan: CampaignPlan;
  initialWeek?: number;
  initialKind?: MissingActionKind;
  onAdd: (weekNum: number, action: CampaignAction) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(initialKind ? 2 : 1);
  const [kind, setKind] = useState<MissingActionKind | null>(initialKind ?? null);
  const [title, setTitle] = useState<string>(initialKind ? MISSING_ACTION_META[initialKind].defaultTitle : '');
  const startWeek = initialWeek ?? getCurrentWeekNum(plan);
  const [date, setDate] = useState<string>(() => weekToDate(startWeek, plan.startDate, 0));
  const [videoSubtype, setVideoSubtype] = useState<VideoSubtype>('official');
  const [dropType, setDropType] = useState<DropType>('official');
  const [distCollab, setDistCollab] = useState(false);
  const [distPaidPush, setDistPaidPush] = useState(false);
  const [distCrossPost, setDistCrossPost] = useState(false);

  const suggestedWeek = Math.max(1, Math.min(plan.weeks.length, dateToWeek(date, plan.startDate)));

  const selectKind = (k: MissingActionKind) => {
    setKind(k);
    if (!title.trim()) setTitle(MISSING_ACTION_META[k].defaultTitle);
    setStep(2);
  };

  const handleSubmit = () => {
    if (!kind) return;
    const meta = MISSING_ACTION_META[kind];
    // Distribution flags only apply to videos
    const dist: Distribution = {};
    if (kind === 'video') {
      if (distCollab) dist.collab = true;
      if (distPaidPush) dist.paidPush = true;
      if (distCrossPost) dist.crossPost = true;
    }
    const hasDist = kind === 'video' && (distCollab || distPaidPush || distCrossPost);
    onAdd(suggestedWeek, {
      id: uid(),
      title: title.trim() || meta.defaultTitle,
      type: meta.type,
      day: fmtDay(date),
      date,
      status: 'planned',
      system: meta.system,
      intent: meta.intent,
      momentRole: meta.role,
      ...(kind === 'video' ? { videoSubtype, dropType } : {}),
      ...(hasDist ? { distribution: dist } : {}),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(14,14,14,0.55)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: '#FAF7F2' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-ink">Add content</h3>
            <span className="text-[10px] font-bold text-ink/40">{step}/2</span>
          </div>
          <button
            onClick={onClose}
            className="text-ink/40 hover:text-ink text-xl leading-none"
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 pb-4 flex gap-1.5">
          <div className="h-0.5 flex-1 rounded-full" style={{ background: '#0E0E0E' }} />
          <div className="h-0.5 flex-1 rounded-full" style={{ background: step === 2 ? '#0E0E0E' : 'rgba(14,14,14,0.12)' }} />
        </div>

        {/* Step 1: select type */}
        {step === 1 && (
          <div className="px-6 pb-6">
            <div className="text-[11px] font-semibold text-ink/60 mb-3">What are you adding?</div>
            <div className="grid grid-cols-2 gap-2">
              {ADD_MODAL_KINDS.map((k) => {
                const meta = MISSING_ACTION_META[k];
                return (
                  <button
                    key={k}
                    onClick={() => selectKind(k)}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all hover:shadow-md"
                    style={{ background: meta.bg }}
                  >
                    <span className="text-white font-black text-xs uppercase tracking-wider">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: title / date / auto week */}
        {step === 2 && kind && (
          <div className="px-6 pb-6">
            <div className="mb-4 flex items-center gap-2">
              <span
                className="text-[10px] font-black uppercase tracking-wider text-white px-2 py-1 rounded-full"
                style={{ background: MISSING_ACTION_META[kind].bg }}
              >
                {MISSING_ACTION_META[kind].label}
              </span>
              <button
                onClick={() => setStep(1)}
                className="text-[10px] font-semibold text-ink/40 hover:text-ink/70"
              >
                Change
              </button>
            </div>

            <label className="block mb-4">
              <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-ink/40 mb-1">Title</span>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={MISSING_ACTION_META[kind].defaultTitle}
                className="w-full bg-transparent border-b border-ink/20 focus:border-ink outline-none text-base font-semibold text-ink pb-1"
              />
            </label>

            <label className="block mb-4">
              <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-ink/40 mb-1">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-transparent border-b border-ink/20 focus:border-ink outline-none text-base font-semibold text-ink pb-1"
              />
            </label>

            {/* Video format — only for videos */}
            {kind === 'video' && (
              <label className="block mb-4">
                <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-ink/40 mb-1">Format</span>
                <select
                  value={videoSubtype}
                  onChange={(e) => setVideoSubtype(e.target.value as VideoSubtype)}
                  className="w-full bg-transparent border-b border-ink/20 focus:border-ink outline-none text-base font-semibold text-ink pb-1"
                >
                  {(Object.keys(VIDEO_SUBTYPE_LABELS) as VideoSubtype[]).map((vs) => (
                    <option key={vs} value={vs}>{VIDEO_SUBTYPE_LABELS[vs]}</option>
                  ))}
                </select>
              </label>
            )}

            {/* Drop type — only for videos, drives the support plan */}
            {kind === 'video' && (
              <label className="block mb-4">
                <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-ink/40 mb-1">Drop type</span>
                <select
                  value={dropType}
                  onChange={(e) => setDropType(e.target.value as DropType)}
                  className="w-full bg-transparent border-b border-ink/20 focus:border-ink outline-none text-base font-semibold text-ink pb-1"
                >
                  {DROP_TYPE_ORDER.map((dt) => (
                    <option key={dt} value={dt}>{DROP_TYPE_CONFIG[dt].label}</option>
                  ))}
                </select>
              </label>
            )}

            {/* Distribution flags — videos only (collab / paid push / cross-post) */}
            {kind === 'video' && (
              <div className="mb-5">
                <div className="block text-[10px] font-bold uppercase tracking-[0.12em] text-ink/40 mb-2">Distribution</div>
                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-2 cursor-pointer text-[12px] font-semibold text-ink/80">
                    <input
                      type="checkbox"
                      checked={distCollab}
                      onChange={(e) => setDistCollab(e.target.checked)}
                      className="accent-ink"
                    />
                    <span>Collab <span className="text-ink/40 font-normal">(YouTube collab feature)</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[12px] font-semibold text-ink/80">
                    <input
                      type="checkbox"
                      checked={distPaidPush}
                      onChange={(e) => setDistPaidPush(e.target.checked)}
                      className="accent-ink"
                    />
                    <span>Paid push</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[12px] font-semibold text-ink/80">
                    <input
                      type="checkbox"
                      checked={distCrossPost}
                      onChange={(e) => setDistCrossPost(e.target.checked)}
                      className="accent-ink"
                    />
                    <span>Cross-post</span>
                  </label>
                </div>
              </div>
            )}

            <div className="mb-5 text-[11px] text-ink/50">
              <span className="font-semibold text-ink/40 uppercase tracking-[0.12em] text-[9px] mr-2">Week</span>
              <span className="font-bold text-ink">W{suggestedWeek}</span>
              <span className="text-ink/30"> · auto from date</span>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!title.trim()}
              className="w-full rounded-xl py-3 font-black text-xs uppercase tracking-[0.18em] text-white transition-all disabled:opacity-40"
              style={{ background: '#0E0E0E' }}
            >
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function loadPlan(key: string = LS_KEY): CampaignPlan {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw) as CampaignPlan;
        // Only restore a saved plan if it contains real content.
        // Otherwise, fall through to the demo so a new/empty visitor
        // always lands on the pre-loaded K Trap campaign.
        const hasContent =
          !!saved &&
          Array.isArray(saved.weeks) &&
          (
            (saved.artist && saved.artist.trim().length > 0) ||
            (saved.campaignName && saved.campaignName.trim().length > 0) ||
            saved.weeks.some((w) => Array.isArray(w.actions) && w.actions.length > 0)
          );
        if (hasContent) {
          const plan = { ...saved, isExample: saved.isExample ?? true };
          // Enrich empty weeks with context-aware content if the plan
          // has moments — this ensures ALL campaigns benefit from smart
          // gap-filling, not just timeline imports.
          const hasEmptyWeeks = plan.weeks.some((w) => !w.actions || w.actions.length === 0);
          if (hasEmptyWeeks && plan.moments && plan.moments.length > 0) {
            return enrichPlanWeeks(plan);
          }
          return plan;
        }
      }
    } catch { /* ignore */ }
  }
  return makeSeedData();
}

export default function YouTubeCampaignCoach() {
  const searchParams = useSearchParams();
  const artistSlug = searchParams?.get('artist') || '';
  const wantsTimeline = searchParams?.get('openTimeline') === '1';
  const storageKey = artistSlug ? `${LS_KEY}:${artistSlug}` : LS_KEY;

  const [plan, setPlan] = useState<CampaignPlan>(() => loadPlan(storageKey));
  const [expandedPhases, setExpandedPhases] = useState<Set<PhaseName>>(new Set());
  const [editingMetric, setEditingMetric] = useState<string | null>(null);
  const [metricDraft, setMetricDraft] = useState('');
  const [modalAction, setModalAction] = useState<{ action: CampaignAction; weekNum: number } | null>(null);
  const [showNextDropModal, setShowNextDropModal] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [showCollapsedSupport, setShowCollapsedSupport] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('drop');
  const [planOpen, setPlanOpen] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [undoItem, setUndoItem] = useState<UndoItem | null>(null);
  const [addModal, setAddModal] = useState<{ open: boolean; initialWeek?: number; initialKind?: MissingActionKind }>({ open: false });
  const [timelineModalOpen, setTimelineModalOpen] = useState(false);

  // Resolve the artist slug to a full record (name, channelHandle, phase)
  // so the Coach can auto-fill fields and lock the plan to the right channel.
  const [resolvedArtist, setResolvedArtist] = useState<ResolvedArtist>(null);
  useEffect(() => {
    if (!artistSlug) return;
    let alive = true;
    fetch(`/api/artist-live?slug=${encodeURIComponent(artistSlug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((json) => {
        if (!alive || !json?.artist) return;
        setResolvedArtist(json.artist as ResolvedArtist);
        // If the plan doesn't have an artist name yet, seed it from the resolved data.
        setPlan((prev) => {
          if (prev.artist && prev.artist.trim().length > 0 && !prev.isExample) return prev;
          return {
            ...prev,
            artist: json.artist.name ?? prev.artist,
            slug: json.artist.slug,
            channelHandle: json.artist.channelHandle,
          };
        });
      });
    return () => { alive = false; };
  }, [artistSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(plan));
    } catch { /* ignore */ }
  }, [plan, storageKey]);

  // Auto-open timeline modal when arriving from cockpit with ?openTimeline=1,
  // or when arriving with ?artist=slug and no plan yet exists for them.
  useEffect(() => {
    if (wantsTimeline) {
      setTimelineModalOpen(true);
      return;
    }
    if (artistSlug && typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) setTimelineModalOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ──────────────────────────────────────────────────────────────────────────

  const toggleActionStatus = useCallback((id: string) => {
    setPlan((p) => ({
      ...p,
      weeks: p.weeks.map((w) => ({
        ...w,
        actions: w.actions.map((a) =>
          a.id !== id ? a : { ...a, status: STATUS_CYCLE[(STATUS_CYCLE.indexOf(a.status) + 1) % 3] }
        ),
      })),
    }));
  }, []);

  const editAction = useCallback((weekNum: number, updated: CampaignAction) => {
    setPlan((p) => ({
      ...p,
      weeks: p.weeks.map((w) =>
        w.week === weekNum
          ? { ...w, actions: w.actions.map((a) => (a.id === updated.id ? updated : a)) }
          : w
      ),
    }));
  }, []);

  // Soft-delete with animation → undo toast → hard delete after 5s
  const softDeleteAction = useCallback((weekNum: number, action: CampaignAction) => {
    // Cancel any previous undo timer and commit that delete
    setUndoItem((prev) => {
      if (prev) {
        clearTimeout(prev.timerId);
        setPlan((p) => ({
          ...p,
          weeks: p.weeks.map((w) =>
            w.week === prev.weekNum ? { ...w, actions: w.actions.filter((a) => a.id !== prev.action.id) } : w
          ),
        }));
      }
      return null;
    });

    // Start fade-out animation
    setDeletingIds((s) => { const n = new Set(s); n.add(action.id); return n; });

    // After animation completes, remove from DOM and show undo toast
    setTimeout(() => {
      setDeletingIds((s) => { const n = new Set(s); n.delete(action.id); return n; });
      // Hide from render but keep in state for undo
      setPlan((p) => ({
        ...p,
        weeks: p.weeks.map((w) =>
          w.week === weekNum ? { ...w, actions: w.actions.filter((a) => a.id !== action.id) } : w
        ),
      }));

      // Set up undo toast with 5s auto-dismiss
      const timerId = setTimeout(() => {
        setUndoItem(null);
      }, 5000);
      setUndoItem({ action, weekNum, timerId });
    }, 300);
  }, []);

  const handleUndo = useCallback(() => {
    if (!undoItem) return;
    clearTimeout(undoItem.timerId);
    // Re-insert the action
    setPlan((p) => ({
      ...p,
      weeks: p.weeks.map((w) =>
        w.week === undoItem.weekNum ? { ...w, actions: [...w.actions, undoItem.action] } : w
      ),
    }));
    setUndoItem(null);
  }, [undoItem]);

  const dismissUndo = useCallback(() => {
    if (!undoItem) return;
    clearTimeout(undoItem.timerId);
    setUndoItem(null);
  }, [undoItem]);

  const addAction = useCallback((weekNum: number, action: CampaignAction) => {
    setPlan((p) => ({
      ...p,
      weeks: p.weeks.map((w) => (w.week === weekNum ? { ...w, actions: [...w.actions, action] } : w)),
    }));
  }, []);

  const reorderActions = useCallback((weekNum: number, draggedId: string, dropId: string) => {
    setPlan((p) => ({
      ...p,
      weeks: p.weeks.map((w) => {
        if (w.week !== weekNum) return w;
        const actions = [...w.actions];
        const dragIdx = actions.findIndex((a) => a.id === draggedId);
        const dropIdx = actions.findIndex((a) => a.id === dropId);
        if (dragIdx >= 0 && dropIdx >= 0) {
          [actions[dragIdx], actions[dropIdx]] = [actions[dropIdx], actions[dragIdx]];
        }
        return { ...w, actions };
      }),
    }));
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // TRACK CONTENT PLAN HANDLERS
  // ──────────────────────────────────────────────────────────────────────────

  const toggleTrackItem = useCallback((trackId: string, itemId: string) => {
    setPlan((p) => ({
      ...p,
      tracks: (p.tracks || []).map((t) =>
        t.trackId !== trackId ? t : { ...t, items: t.items.map((i) => i.id === itemId ? { ...i, done: !i.done } : i) }
      ),
    }));
  }, []);

  const addTrackItem = useCallback((trackId: string) => {
    setPlan((p) => ({
      ...p,
      tracks: (p.tracks || []).map((t) =>
        t.trackId !== trackId ? t : {
          ...t,
          items: [...t.items, { id: `tc-${Date.now()}`, label: 'New content item', role: 'push' as MomentRole, contentType: 'short' as ActionType, done: false }],
        }
      ),
    }));
  }, []);

  const removeTrackItem = useCallback((trackId: string, itemId: string) => {
    setPlan((p) => ({
      ...p,
      tracks: (p.tracks || []).map((t) =>
        t.trackId !== trackId ? t : { ...t, items: t.items.filter((i) => i.id !== itemId) }
      ),
    }));
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // SUPPORT CONTENT HANDLERS
  // ──────────────────────────────────────────────────────────────────────────

  const cycleSupportStatus = useCallback((planId: string, itemId: string) => {
    setPlan((p) => ({
      ...p,
      supportPlans: (p.supportPlans || []).map((sp) =>
        sp.planId !== planId ? sp : {
          ...sp,
          items: sp.items.map((item) => {
            if (item.id !== itemId) return item;
            const idx = SUPPORT_STATUS_CYCLE.indexOf(item.status);
            const next = SUPPORT_STATUS_CYCLE[(idx + 1) % SUPPORT_STATUS_CYCLE.length];
            return { ...item, status: next };
          }),
        }
      ),
    }));
  }, []);

  const addSupportItem = useCallback((planId: string, phase: SupportPhase) => {
    setPlan((p) => ({
      ...p,
      supportPlans: (p.supportPlans || []).map((sp) => {
        if (sp.planId !== planId) return sp;
        const newItem: SupportItem = {
          id: `sp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          label: 'New Clip',
          contentType: 'short',
          phase,
          status: 'not_recorded',
        };
        return { ...sp, items: [...sp.items, newItem] };
      }),
    }));
  }, []);

  const removeSupportItem = useCallback((planId: string, itemId: string) => {
    setPlan((p) => ({
      ...p,
      supportPlans: (p.supportPlans || []).map((sp) =>
        sp.planId !== planId ? sp : { ...sp, items: sp.items.filter((i) => i.id !== itemId) }
      ),
    }));
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <ArtistSlugCtx.Provider value={artistSlug}>
    <ResolvedArtistCtx.Provider value={resolvedArtist}>
    <div style={{ background: '#FAF7F2' }} className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* CAMPAIGN HEADER — artist + campaign name + start date + quick actions */}
        <CampaignHeader
          plan={plan}
          onUpdatePlan={(updates) => setPlan((p) => ({ ...p, ...updates }))}
          onOpenAdd={() => setAddModal({ open: true })}
          onOpenTimeline={() => setTimelineModalOpen(true)}
          onNewCampaign={() => {
            if (!plan.isExample && !window.confirm('Start a new campaign?')) return;
            setPlan(makeEmptyPlan());
            setExpandedPhases(new Set());
            setShowCollapsedSupport(new Set());
            setAddModal({ open: false });
            setEditingMetric(null);
          }}
        />

        {/* ── TOP: 3-second answer (What's happening / What should I do / What's next) ── */}

        {/* 1. DECISION CARD — primary focus */}
        <TopSignalCard
          plan={plan}
          onOpenAdd={(kind) => setAddModal({ open: true, initialKind: kind })}
          onUpdatePlan={(updates) => setPlan((p) => ({ ...p, ...updates }))}
        />

        {/* 2. NEXT DROP — primary anchor with role */}
        <NextDropAnchor plan={plan} />

        {/* 3. PULSE STRIP — one compact pulse-check (Live Activity · This Week · Coverage) */}
        <PulseStrip plan={plan} />

        {/* Drop View — the action layer, always visible */}
        <DropView
          plan={plan}
          onToggleCommunityPost={(trackId) => {
            setPlan((p) => {
              const prev = p.manualOverrides?.communityPostDone || {};
              const next = { ...prev, [trackId]: !prev[trackId] };
              return { ...p, manualOverrides: { ...p.manualOverrides, communityPostDone: next } };
            });
          }}
        />

        {/* Subs + Views — calm context */}
        <MetricCards
          plan={plan}
          editingMetric={editingMetric}
          metricDraft={metricDraft}
          onEditStart={(metric, value) => {
            setEditingMetric(metric);
            setMetricDraft(value);
          }}
          onEditChange={setMetricDraft}
          onEditSave={(metric, value) => {
            const numVal = Number(value) || 0;
            if (metric === 'currentSubs') {
              setPlan((p) => ({
                ...p,
                manualOverrides: { ...p.manualOverrides, currentSubs: Math.max(0, numVal) },
              }));
            } else if (metric === 'views') {
              setPlan((p) => ({
                ...p,
                manualOverrides: { ...p.manualOverrides, totalViews: Math.max(0, numVal) },
              }));
            }
            setEditingMetric(null);
          }}
          onEditCancel={() => setEditingMetric(null)}
        />

        {/* Inline secondary entry — invites users to swap the example for their real plan */}
        <div className="mt-5 flex items-center justify-between">
          <button
            onClick={() => setTimelineModalOpen(true)}
            className="text-[12px] font-semibold text-ink/60 hover:text-ink transition-colors"
          >
            <span className="underline decoration-ink/20 underline-offset-2">Start with your own release plan →</span>
          </button>
        </div>

        {/* ── CAMPAIGN PLAN — collapsed by default, hosts phase bar + phase blocks + view toggle ── */}
        <div className="mt-6">
          <button
            onClick={() => setPlanOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-[11px] font-mono uppercase tracking-[0.18em] text-ink/55 hover:text-ink/80 transition-colors"
            style={{ background: '#F6F1E7' }}
          >
            <span>Campaign Plan — what&apos;s scheduled, supported, and missing</span>
            <span className="text-ink/40">{planOpen ? '▲' : '▼'}</span>
          </button>
        </div>

        {planOpen && (
          <div className="mt-3">
            {getPlanPhases(plan).map((phase) => (
          <PhaseBlock
            key={phase.name}
            phase={phase}
            plan={plan}
            expanded={expandedPhases.has(phase.name)}
            onToggleExpand={(name) => {
              setExpandedPhases((s) => {
                const next = new Set(s);
                if (next.has(name)) next.delete(name);
                else next.add(name);
                return next;
              });
            }}
            onToggleActionStatus={toggleActionStatus}
            onEditAction={(action, weekNum) => setModalAction({ action, weekNum })}
            onDeleteAction={softDeleteAction}
            onOpenAdd={(weekNum, kind) => setAddModal({ open: true, initialWeek: weekNum, initialKind: kind })}
            deletingIds={deletingIds}
            draggedId={draggedId}
            dragOverId={dragOverId}
            onDragStart={setDraggedId}
            onDragOver={setDragOverId}
            onDrop={() => {
              if (draggedId && dragOverId && draggedId !== dragOverId) {
                // Find which week contains both
                for (const week of plan.weeks) {
                  if (week.actions.some((a) => a.id === draggedId) && week.actions.some((a) => a.id === dragOverId)) {
                    reorderActions(week.week, draggedId, dragOverId);
                    break;
                  }
                }
              }
              setDraggedId(null);
              setDragOverId(null);
            }}
            showCollapsedSupport={showCollapsedSupport}
            onToggleSupport={(weekKey) => {
              setShowCollapsedSupport((s) => {
                const next = new Set(s);
                if (next.has(weekKey)) next.delete(weekKey);
                else next.add(weekKey);
                return next;
              });
            }}
            onCycleSupportStatus={cycleSupportStatus}
            onAddSupportItem={addSupportItem}
            onRemoveSupportItem={removeSupportItem}
          />
        ))}
            <CampaignToolsCard
              plan={plan}
              onToggleMerch={() => setPlan((p) => ({
                ...p,
                manualOverrides: {
                  ...p.manualOverrides,
                  merchShelfActive: !p.manualOverrides?.merchShelfActive,
                },
              }))}
              onToggleBands={() => setPlan((p) => ({
                ...p,
                manualOverrides: {
                  ...p.manualOverrides,
                  bandsintownActive: !p.manualOverrides?.bandsintownActive,
                },
              }))}
            />
          </div>
        )}
      </div>

      {/* Action Modal */}
      {modalAction && (
        <ActionModal
          action={modalAction.action}
          weekNum={modalAction.weekNum}
          onSave={(weekNum, updated) => {
            editAction(weekNum, updated);
            setModalAction(null);
          }}
          onClose={() => setModalAction(null)}
        />
      )}

      {/* Metrics Modal retired — targets are auto-derived by autoTargets(plan) */}

      {/* Next Drop Modal */}
      {showNextDropModal && (() => {
        let activeIdx = -1;
        for (let i = plan.weeks.length - 1; i >= 0; i--) {
          if (plan.weeks[i].actions.some((a) => a.status === 'done' || a.status === 'missed')) { activeIdx = i; break; }
        }
        const nextMoment = CAMPAIGN_MOMENTS.find((m) => m.weekNum > (activeIdx >= 0 ? plan.weeks[activeIdx].week : 0));
        if (!nextMoment) return null;
        return (
          <NextDropModal
            moment={nextMoment}
            dropEdit={plan.nextDropEdits?.[nextMoment.weekNum]}
            onSave={(weekNum, edit) => {
              setPlan((p) => ({
                ...p,
                nextDropEdits: { ...p.nextDropEdits, [weekNum]: edit },
              }));
            }}
            onClose={() => setShowNextDropModal(false)}
          />
        );
      })()}

      {/* Add Content Modal */}
      {addModal.open && (
        <AddContentModal
          plan={plan}
          initialWeek={addModal.initialWeek}
          initialKind={addModal.initialKind}
          onAdd={addAction}
          onClose={() => setAddModal({ open: false })}
        />
      )}

      {/* Timeline Import Modal */}
      <TimelineImportModal
        open={timelineModalOpen}
        onClose={() => setTimelineModalOpen(false)}
        onApply={(newPlan) => {
          setPlan(newPlan);
          setExpandedPhases(new Set());
          setShowCollapsedSupport(new Set());
          setAddModal({ open: false });
          setEditingMetric(null);
        }}
      />

      {/* Undo Toast */}
      {undoItem && (
        <UndoToast
          name={undoItem.action.title}
          onUndo={handleUndo}
          onDismiss={dismissUndo}
        />
      )}
    </div>
    </ResolvedArtistCtx.Provider>
    </ArtistSlugCtx.Provider>
  );
}
