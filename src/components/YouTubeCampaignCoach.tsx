'use client';
// PIH Campaign Coach v2.2 — Weekly Rhythm widget
import { useState, useMemo, useCallback, useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type PhaseName = 'REAWAKEN' | 'BUILD THE WORLD' | 'SCALE THE STORY' | 'CULTURAL MOMENT' | 'EXTEND';
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

type ManualOverrides = {
  currentSubs?: number;
  totalViews?: number;
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
  subscriberCount: number;     // starting subs (baseline)
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

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const CAMPAIGN_PHASES: CampaignPhase[] = [
  { name: 'REAWAKEN',        weekStart: 1,  weekEnd: 3,  color: '#2C25FF' },
  { name: 'BUILD THE WORLD', weekStart: 4,  weekEnd: 8,  color: '#1FBE7A' },
  { name: 'SCALE THE STORY', weekStart: 9,  weekEnd: 13, color: '#FFD24C' },
  { name: 'CULTURAL MOMENT', weekStart: 14, weekEnd: 22, color: '#FF4A1C' },
  { name: 'EXTEND',          weekStart: 23, weekEnd: 24, color: '#FFD3C9' },
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
  'REAWAKEN':        { goal: 'Break the silence — remind YouTube you exist', role: 'YouTube re-activates channel signals, algorithm starts testing your content again', summary: 'Return from absence. Shorts and posts re-establish presence and warm the algorithm.' },
  'BUILD THE WORLD': { goal: 'Prove the campaign is real — land the first major moment', role: 'YouTube starts recommending to new audiences through collab crossover', summary: 'First singles and collabs create the world of Campaign. Each drop expands the audience.' },
  'SCALE THE STORY': { goal: 'Expand reach — turn singles into a narrative', role: 'YouTube algorithm scales distribution as watch time and engagement compound', summary: 'More collabs, more content, more reach. Build the story arc that leads to the album.' },
  'CULTURAL MOMENT':  { goal: 'Execute the album rollout — this is the window', role: 'YouTube becomes the primary discovery and conversion platform for the release', summary: 'Album announcement, final singles, countdown content, and the release itself. Peak activity.' },
  'EXTEND':          { goal: 'Sustain the conversation — don\'t let it die after release', role: 'YouTube long-tail keeps streams and discovery alive weeks after drop', summary: 'Post-release content, fan reactions, deluxe hints. Keep the album in the conversation.' },
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
  if (phase?.name === 'CULTURAL MOMENT' && status === 'cold') {
    return { risk: 'Channel is cold during the most important phase. Album release will not land.', urgency: 'critical' };
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

function getPhaseForWeek(weekNum: number): CampaignPhase | undefined {
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
    if (phaseName === 'CULTURAL MOMENT') return { headline: 'DROP WINDOW OPEN', summary: 'Channel is hot during cultural moment. Execute the release.', color: '#fb7185' };
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
    if (shortsDone >= 3 && videosDone === 0 && phaseName !== 'REAWAKEN') {
      weekTips.push({ week: w.week, message: 'Balance with a video — Shorts warm up, videos convert', priority: 'medium' });
    }

    // Phase-specific
    if (phaseName === 'REAWAKEN' && planned > 0 && done === 0 && missed === 0) {
      weekTips.push({ week: w.week, message: 'Post something today — break the silence', priority: 'high' });
    }
    if (phaseName === 'BUILD THE WORLD' && videos.length === 0 && w.week > 5) {
      weekTips.push({ week: w.week, message: 'Plan a video — Build phase needs visuals', priority: 'medium' });
    }
    if (phaseName === 'SCALE THE STORY' && (status === 'cold' || status === 'cooling')) {
      weekTips.push({ week: w.week, message: 'Increase posting frequency', priority: 'high' });
    }
    if (phaseName === 'SCALE THE STORY' && s2Actions.length === 0) {
      weekTips.push({ week: w.week, message: 'Add an anchor moment (S2 action)', priority: 'medium' });
    }
    if (phaseName === 'CULTURAL MOMENT') {
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
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const base = new Date(now);
  base.setDate(base.getDate() - 8 * 7); // 8 full weeks ago → we're in week 9
  const startDate = base.toISOString().split('T')[0];
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

  return {
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
  };
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
// NEW SUB-COMPONENTS — CLEAN, BOLD, UNDERSTANDABLE IN 3 SECONDS
// ═══════════════════════════════════════════════════════════════════════════════

// ──── CAMPAIGN STATUS LINE ───────────────────────────────────────────────────
// Single line that summarizes campaign health in one glance
// ──── CAMPAIGN TIMELINE ──────────────────────────────────────────────────────
// Unified header + status + phase timeline — feels like a journey

const PHASE_MICRO: Record<PhaseName, { short: string; desc: string; focus: string; nudge: string }> = {
  'REAWAKEN':        { short: 'REAWAKEN',  desc: 'Get active',    focus: '→ Post Shorts + Community to warm the algorithm', nudge: 'Warm up the channel' },
  'BUILD THE WORLD': { short: 'BUILD',     desc: 'Drop + collabs', focus: '→ Land first drops and build crossover audience', nudge: 'Build consistency this week' },
  'SCALE THE STORY': { short: 'SCALE',     desc: 'Push content',  focus: '→ Push content volume and expand reach',          nudge: 'Keep pushing content' },
  'CULTURAL MOMENT': { short: 'CULTURAL',  desc: 'Peak moment',   focus: '→ Execute album rollout — maximise first 48hrs',  nudge: 'Land the big moment' },
  'EXTEND':          { short: 'EXTEND',    desc: 'Sustain',       focus: '→ Keep the conversation alive post-release',      nudge: 'Keep the story alive' },
};

// ── ACTUAL PHASE DETECTION ──────────────────────────────────────────────────
// Infers where the campaign really is based on execution, not the calendar.
// Returns the actual operational phase based on output consistency.
function detectActualPhase(plan: CampaignPlan): PhaseName {
  const targets = plan.targets || { subsTarget: 0, viewsTarget: 0, shortsPerWeek: 3, videosPerWeek: 1, postsPerWeek: 3, communityPerWeek: 2 };

  // Look at the last 3 weeks of activity
  const recentWeeks = plan.weeks
    .filter((w) => w.actions.some((a) => a.status === 'done' || a.status === 'missed'))
    .slice(-3);

  if (recentWeeks.length === 0) return 'REAWAKEN';

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
  if (shortsConsistent && longformActive && multiType >= 3) return 'SCALE THE STORY';
  // BUILD: consistent shorts + some longform/community starting
  if (shortsConsistent && (longformActive || avgCommunity >= 1)) return 'BUILD THE WORLD';
  // Still in REAWAKEN
  return 'REAWAKEN';
}

function CampaignTimeline({ plan, onPhaseClick, onUpdatePlan, onOpenSettings, onOpenAdd, onNewCampaign }: {
  plan: CampaignPlan;
  onPhaseClick: (name: PhaseName) => void;
  onUpdatePlan: (updates: Partial<CampaignPlan>) => void;
  onOpenSettings?: () => void;
  onOpenAdd?: () => void;
  onNewCampaign?: () => void;
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
  const actualPhase = CAMPAIGN_PHASES.find((p) => p.name === actualPhaseName) || null;
  // Use planned for timeline highlight, but flag drift
  const currentPhase = plannedPhase;
  const phaseDrift = plannedPhase && actualPhase && plannedPhase.name !== actualPhase.name;
  const totalWeeks = plan.weeks.length;
  const weekNum = activeIdx >= 0 ? plan.weeks[activeIdx].week : 0;

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {plan.isExample && (
              <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/35 mb-1">
                Example Campaign
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
          </div>
          {onNewCampaign && (
            <button
              onClick={onNewCampaign}
              className="ml-3 mt-1 px-3 py-2 rounded-lg bg-paper border border-ink/10 text-ink/70 font-bold text-[11px] uppercase tracking-[0.12em] shadow-sm hover:shadow hover:text-ink transition-all"
              title="Start a new campaign"
            >
              + New Campaign
            </button>
          )}
          {onOpenAdd && (
            <div className="ml-2 mt-1 flex flex-col items-end">
              <button
                onClick={onOpenAdd}
                className="px-3 py-2 rounded-lg text-white font-black text-[11px] uppercase tracking-[0.12em] shadow-sm hover:shadow transition-all"
                style={{ background: '#0E0E0E' }}
                title="Add content"
              >
                + Add
              </button>
              <span className="text-[9px] font-semibold text-ink/40 mt-1">Start building this week&apos;s momentum</span>
            </div>
          )}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="ml-2 mt-1 p-2 rounded-lg bg-paper border border-ink/8 shadow-sm hover:bg-paper hover:shadow transition-all text-ink/50 hover:text-ink/70"
              title="Campaign Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Phase position — plain labels showing planned vs actual */}
      {currentPhase && (
        <div className="mb-2 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-ink/50">
              You should be here → <span className="font-black" style={{ color: currentPhase.color }}>{PHASE_MICRO[currentPhase.name].short}</span>
            </span>
            {phaseDrift && actualPhase && (
              <span className="text-[10px] text-ink/50">
                You're currently here → <span className="font-black" style={{ color: actualPhase.color }}>{PHASE_MICRO[actualPhase.name].short}</span>
              </span>
            )}
            <span className="text-[10px] font-semibold text-ink/55 mt-0.5">
              {PHASE_MICRO[(phaseDrift && actualPhase ? actualPhase.name : currentPhase.name)].nudge}
            </span>
          </div>
          <span className="text-[10px] font-semibold text-ink/30">Week {weekNum} of {totalWeeks}</span>
        </div>
      )}

      {/* Phase timeline */}
      <div className="w-full flex gap-1 rounded-2xl overflow-hidden p-1.5" style={{ background: '#F6F1E7', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        {CAMPAIGN_PHASES.map((phase) => {
          const weekCount = phase.weekEnd - phase.weekStart + 1;
          const isCurrent = currentPhase?.name === phase.name;
          const isPast = activeIdx >= 0 && plan.weeks[activeIdx].week > phase.weekEnd;
          const isFuture = !isCurrent && !isPast;
          const micro = PHASE_MICRO[phase.name];

          // Compute phase completion
          const phaseWeeks = plan.weeks.filter((w) => w.week >= phase.weekStart && w.week <= phase.weekEnd);
          const phaseActions = phaseWeeks.flatMap((w) => w.actions);
          const phaseDone = phaseActions.filter((a) => a.status === 'done').length;
          const phaseTotal = phaseActions.length;

          return (
            <button
              key={phase.name}
              onClick={() => onPhaseClick(phase.name)}
              className="relative flex flex-col items-center justify-center rounded-xl transition-all"
              style={{
                flex: weekCount,
                minWidth: 0,
                minHeight: isCurrent ? 72 : 64,
                background: isCurrent
                  ? phase.color
                  : isPast
                  ? `${phase.color}25`
                  : `${phase.color}10`,
                color: isCurrent
                  ? '#ffffff'
                  : isPast
                  ? phase.color
                  : `${phase.color}90`,
                padding: '8px 4px',
                cursor: 'pointer',
                transform: isCurrent ? 'scale(1.02)' : 'scale(1)',
                boxShadow: isCurrent ? `0 4px 16px ${phase.color}40` : 'none',
                zIndex: isCurrent ? 2 : 1,
              }}>
              <span className="font-black text-[11px] tracking-wider leading-none">{micro.short}</span>
              <span className="text-[9px] font-semibold mt-1 opacity-80 leading-none">{micro.desc}</span>
              {isPast && phaseTotal > 0 && (
                <span className="text-[8px] font-bold mt-1 opacity-60">{phaseDone}/{phaseTotal}</span>
              )}
              {isCurrent && (
                <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-paper" />
              )}
            </button>
          );
        })}
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

const CHANNEL_SIGNAL_META: Record<ChannelSignal, { color: string; bg: string; label: string; desc: string }> = {
  PUSH:  { color: '#FF4A1C', bg: 'rgba(255,74,28,0.10)',  label: 'PUSH',  desc: 'Momentum is live. Back it with cadence.' },
  SCALE: { color: '#1FBE7A', bg: 'rgba(31,190,122,0.10)', label: 'SCALE', desc: 'Cadence holding. Increase reach and build momentum.' },
  TEST:  { color: '#2C25FF', bg: 'rgba(44,37,255,0.10)',  label: 'TEST',  desc: 'Validate the foundation before scaling.' },
  HOLD:  { color: '#FFD24C', bg: 'rgba(255,210,76,0.10)', label: 'HOLD',  desc: 'Sustain what\u2019s working. Don\u2019t over-invest yet.' },
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
  const targets = plan.targets || { subsTarget: 0, viewsTarget: 0, shortsPerWeek: 3, videosPerWeek: 1, postsPerWeek: 3, communityPerWeek: 2 };
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

  // Reawaken = still proving the channel is live.
  if (currentPhase === 'REAWAKEN') return 'TEST';

  // Cultural / Scale phases — momentum window, so SCALE when healthy, PUSH otherwise.
  if (currentPhase === 'CULTURAL MOMENT' || currentPhase === 'SCALE THE STORY') {
    return cadenceStatus === 'Healthy' ? 'SCALE' : 'PUSH';
  }

  // Drop inside a week — back it.
  if (nearDrop) return 'PUSH';

  // Build phase — foundation work, still validating.
  if (currentPhase === 'BUILD THE WORLD') return cadenceStatus === 'Healthy' ? 'TEST' : 'PUSH';

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

function TopSignalCard({ plan, onOpenAdd }: { plan: CampaignPlan; onOpenAdd?: (kind: MissingActionKind) => void }) {
  const cadence = getCadenceCounts(plan);

  // Missing kinds for highlighting the strip
  const missingSet = new Set<MissingActionKind>();
  if (cadence.shortsDone < cadence.shortsTarget) missingSet.add('short');
  if (cadence.postsDone < cadence.postsTarget) missingSet.add('post');
  if (cadence.longformDone < cadence.longformTarget) missingSet.add('video');

  const strip: { kind: MissingActionKind; label: string }[] = [
    { kind: 'short', label: '+ Add Short' },
    { kind: 'post',  label: '+ Add Post' },
    { kind: 'video', label: '+ Add Video' },
  ];

  // System decision — one brain, same language as the rest of the product
  const signal = computeChannelSignal(plan);
  const decisionMeta = CHANNEL_SIGNAL_META[signal];
  const thisWeek = buildThisWeeksCall(plan, signal);

  if (!onOpenAdd) return null;

  return (
    <div
      className="mb-6 rounded-2xl p-5"
      style={{
        background: '#0E0E0E',
        color: '#FAF7F2',
        boxShadow: '0 6px 20px rgba(14,14,14,0.18), 0 1px 3px rgba(14,14,14,0.1)',
      }}
    >
      {/* Decision layer — system output */}
      <div className="mb-4">
        <div
          className="text-[10px] font-bold uppercase tracking-[0.16em] mb-2"
          style={{ color: 'rgba(250,247,242,0.55)' }}
        >
          → Decision
        </div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <span
            className="font-black uppercase tracking-wider text-[22px] leading-none"
            style={{ color: decisionMeta.color }}
          >
            {decisionMeta.label}
          </span>
          <span className="text-[13px] leading-snug" style={{ color: 'rgba(250,247,242,0.85)' }}>
            {decisionMeta.desc}
          </span>
        </div>
        <div
          className="mt-2 text-[12.5px] leading-snug"
          style={{ color: 'rgba(250,247,242,0.60)' }}
        >
          {thisWeek}.
        </div>
      </div>

      {/* Divider */}
      <div className="border-t mb-4" style={{ borderColor: 'rgba(250,247,242,0.10)' }} />

      {/* Actions driven by the decision */}
      <div
        className="text-[10px] font-bold uppercase tracking-[0.16em] mb-3"
        style={{ color: 'rgba(250,247,242,0.55)' }}
      >
        What to do next
      </div>
      <div className="flex flex-wrap gap-2.5">
        {strip.map((s) => {
          const stripMeta = MISSING_ACTION_META[s.kind];
          const isMissing = missingSet.has(s.kind);
          return (
            <button
              key={s.kind}
              onClick={() => onOpenAdd(s.kind)}
              className="flex items-center rounded-xl px-5 py-3 transition-all hover:-translate-y-0.5"
              style={{
                background: stripMeta.bg,
                boxShadow: isMissing
                  ? `0 0 0 3px ${stripMeta.bg}33, 0 8px 22px rgba(0,0,0,0.28)`
                  : '0 4px 14px rgba(0,0,0,0.22)',
                opacity: isMissing ? 1 : 0.75,
                transform: isMissing ? 'scale(1.03)' : 'scale(1)',
              }}
            >
              <span className="text-white font-black text-[12px] tracking-widest uppercase">{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ──── NEXT DROP ANCHOR ───────────────────────────────────────────────────────
// Primary visual anchor — the next key drop + its role in the narrative

function getDropRole(weekNum: number, type: ActionType): string {
  const phase = getPhaseForWeek(weekNum);
  if (!phase) return 'This is your next upload — build around it';
  if (phase.name === 'REAWAKEN') return 'Warm the channel before your next big drop';
  if (phase.name === 'BUILD THE WORLD') return 'This is your next major upload — build around it';
  if (phase.name === 'SCALE THE STORY') return 'This is your next major upload — build around it';
  if (phase.name === 'CULTURAL MOMENT') return 'This is your cultural peak — all attention goes here';
  if (phase.name === 'EXTEND') return "Keep the story going — don't let it fade";
  if (type === 'collab') return 'Crossover drop — brings a new audience in';
  return 'This is your next major upload — build around it';
}

function NextDropAnchor({ plan }: { plan: CampaignPlan }) {
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
  const role = getDropRole(drop.weekNum, drop.action.type);
  const phase = getPhaseForWeek(drop.weekNum);

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
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(250,247,242,0.12)' }}>
          <div className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: 'rgba(250,247,242,0.45)' }}>
            Role
          </div>
          <div className="mt-1 text-sm font-semibold leading-snug" style={{ color: 'rgba(250,247,242,0.92)' }}>
            {role}
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

  return (
    <div className="mb-4 rounded-2xl p-4" style={{ background: '#F6F1E7', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      {/* Header — state label + status pill on the right */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink/45">
          This week
        </span>
        <span
          className="text-[10px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-full"
          style={{ color: statusColor, background: `${statusColor}15` }}
        >
          {statusLabel}
        </span>
      </div>

      {/* Rows — numbers first, labels second */}
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-3">
            <div className="flex items-baseline gap-0.5 min-w-[52px]">
              <span className="text-lg font-black tabular-nums leading-none" style={{ color: rowStatusColor(r.done, r.target) }}>{r.done}</span>
              <span className="text-xs font-bold text-ink/30">/ {r.target}</span>
            </div>
            <span className="text-sm font-bold text-ink/70">{r.label}</span>
          </div>
        ))}
      </div>

      {/* Boosts used — only if any */}
      {collabs > 0 && (
        <div className="mt-3 pt-2.5 border-t border-ink/5 flex items-baseline justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink/40">Boosts used</span>
          <span className="text-sm font-black text-ink">Collab ×{collabs}</span>
        </div>
      )}
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

function MetricCards({ plan, editingMetric, metricDraft, onEditStart, onEditChange, onEditSave, onEditCancel, onOpenTargets }: {
  plan: CampaignPlan;
  editingMetric: string | null;
  metricDraft: string;
  onEditStart: (metric: string, value: string) => void;
  onEditChange: (value: string) => void;
  onEditSave: (metric: string, value: string) => void;
  onEditCancel: () => void;
  onOpenTargets: () => void;
}) {
  const targets = plan.targets || { subsTarget: 0, viewsTarget: 0, shortsPerWeek: 3, videosPerWeek: 1, postsPerWeek: 3, communityPerWeek: 2 };
  const startingSubs = plan.subscriberCount;
  const overrides = plan.manualOverrides || {};
  const subsGained = plan.weeks.reduce((sum, w) => sum + (w.feedback?.subsGained || 0), 0);
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
// System 2 depth for campaign targets and baseline editing
function MetricsModal({ plan, onSave, onClose }: {
  plan: CampaignPlan;
  onSave: (updates: Partial<CampaignPlan>) => void;
  onClose: () => void;
}) {
  const t = plan.targets || { subsTarget: 0, viewsTarget: 0, shortsPerWeek: 3, videosPerWeek: 1, postsPerWeek: 3, communityPerWeek: 2 };
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
  const targets = plan.targets || { subsTarget: 0, viewsTarget: 0, shortsPerWeek: 3, videosPerWeek: 1, postsPerWeek: 3, communityPerWeek: 2 };

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
    const phaseName = getPhaseForWeek(weekNum)?.name || 'REAWAKEN';
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
  const targets = plan.targets || { subsTarget: 0, viewsTarget: 0, shortsPerWeek: 3, videosPerWeek: 1, postsPerWeek: 3, communityPerWeek: 2 };

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
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Create a track for each campaign moment
  for (const moment of CAMPAIGN_MOMENTS) {
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
    const phase = CAMPAIGN_PHASES.find((p) => moment.weekNum >= p.weekStart && moment.weekNum <= p.weekEnd);

    // Derive track name from the actual hero action, not the hardcoded moment name
    const trackName = heroAction
      ? `${heroAction.title}${heroAction.featuredArtist ? ` ft. ${heroAction.featuredArtist}` : ''}`
      : `Week ${moment.weekNum} drop`;

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
    const momentWeeks = CAMPAIGN_MOMENTS.map((m) => m.weekNum);
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
        phase: CAMPAIGN_PHASES.find((p) => week.week >= p.weekStart && week.week <= p.weekEnd),
      });
    }
  }

  return tracks.sort((a, b) => a.weekNum - b.weekNum);
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

function getDropSupport(track: AutoTrack): DropSupport {
  const hero = track.anchorAction;
  const dropType = inferDropType(hero);
  const config = DROP_TYPE_CONFIG[dropType];

  const coreLabel = hero && hero.type === 'collab' ? 'Collab Video' : config.label;
  const corePresent = !!hero;
  const coreDone = !!hero && hero.status === 'done';

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

  const rawCount: Record<SupportSlotKey, number> = {
    shorts: shortsDone,
    lyricVideo: lyricVideoDone,
    artworkVideo: artworkVideoDone,
    communityPost: postsDone,
    followupLongform: followupLongformDone,
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

function getCampaignIntelligence(tracks: AutoTrack[]): CampaignIntelligence {
  const supports = tracks.map((t) => getDropSupport(t));
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

function DropCard({ track }: { track: AutoTrack }) {
  const support = getDropSupport(track);
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
        {support.slots.map((slot) => (
          <div
            key={slot.key}
            className="flex items-center justify-between py-1.5 border-b border-ink/5 last:border-b-0"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                style={{
                  background: slot.hit ? '#1FBE7A' : 'rgba(14,14,14,0.06)',
                  color: slot.hit ? '#ffffff' : 'rgba(14,14,14,0.35)',
                }}
              >
                {slot.hit ? '✓' : '·'}
              </span>
              <span className="text-[12px] font-semibold text-ink/80 truncate">{slot.label}</span>
            </div>
            <span className="text-[11px] font-bold text-ink/50 shrink-0 ml-2">
              {slot.showsCount ? `${slot.done}/${slot.target}` : slot.hit ? '✓' : slot.targetText}
            </span>
          </div>
        ))}
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

function DropView({ plan }: { plan: CampaignPlan }) {
  const autoTracks = useMemo(() => deriveAutoTracks(plan), [plan]);

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

  const intel = getCampaignIntelligence(autoTracks);
  const output = getCampaignSupportOutput(plan, autoTracks);
  const tierColor = COVERAGE_COLOR[intel.tier];

  // Sort worst-coverage first so gaps surface immediately.
  const sortedTracks = [...autoTracks].sort((a, b) => {
    const sa = getDropSupport(a).coverageScore;
    const sb = getDropSupport(b).coverageScore;
    return sa - sb;
  });

  const outputStats: { label: string; value: number }[] = [
    { label: 'Shorts',         value: output.totalShorts },
    { label: 'Videos',         value: output.totalVideos },
    { label: 'Posts',          value: output.totalPosts },
    { label: 'Support Pieces', value: output.totalSupport },
  ];

  return (
    <div>
      {/* ── CAMPAIGN OUTPUT — quick activity row ──────────────────── */}
      <div
        className="mb-4 rounded-2xl px-5 py-4 grid grid-cols-4 gap-2"
        style={{ background: '#FAF7F2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
      >
        {outputStats.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center text-center">
            <span className="text-xl font-black leading-none text-ink">{stat.value}</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink/40 mt-1">
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {/* ── CAMPAIGN SUPPORT — judgement, not numbers ─────────────── */}
      <div
        className="mb-6 rounded-2xl p-5"
        style={{ background: '#F6F1E7', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
      >
        {/* 1 · Title */}
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/40 mb-2">
          Campaign Support
        </div>

        {/* 2 · Non-numeric summary (headline) */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-base leading-none"
            style={{ color: tierColor }}
            aria-hidden="true"
          >
            {intel.tier === 'Strong' ? '✓' : intel.tier === 'Medium' ? '⚠' : '✕'}
          </span>
          <span className="text-lg font-black leading-none" style={{ color: tierColor }}>
            {intel.summary}
          </span>
        </div>

        {/* 3 · Missing (inline) */}
        {intel.missingLabels.length > 0 && (
          <div className="text-[12px] font-semibold text-ink/60 mb-1">
            <span className="text-ink/40">Missing:</span>{' '}
            {intel.missingLabels.join(' · ')}
          </div>
        )}

        {/* 4 · Fix */}
        <div className="text-[12px] font-bold" style={{ color: tierColor }}>
          <span className="text-ink/40 font-semibold">Fix:</span> {intel.fix}
        </div>
      </div>

      {/* ── DROP CARDS — worst coverage first ──────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {sortedTracks.map((track) => (
          <DropCard key={track.id} track={track} />
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
  const phaseWeeks = plan.weeks.filter((w) => w.week >= phase.weekStart && w.week <= phase.weekEnd);
  const tier = getTier(plan.subscriberCount);
  const statuses = getWeekStatuses(plan.weeks, tier);
  const currentWeekNum = getCurrentWeekNum(plan);

  const allActions = phaseWeeks.flatMap((w) => w.actions);
  const doneCount = allActions.filter((a) => a.status === 'done').length;
  const missedCount = allActions.filter((a) => a.status === 'missed').length;
  const allSubs = phaseWeeks.reduce((s, w) => s + (w.feedback?.subsGained || 0), 0);

  const shortStatus = missedCount > 0 ? 'Missed' : doneCount === allActions.length && allActions.length > 0 ? 'Complete' : doneCount > 0 ? 'In Progress' : 'Upcoming';

  const narrative = PHASE_NARRATIVE[phase.name].summary;

  if (!expanded) {
    return (
      <button
        onClick={() => onToggleExpand(phase.name)}
        className="w-full mb-3 p-4 rounded-2xl text-left transition-all hover:shadow-md"
        style={{ background: '#F6F1E7', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ background: phase.color }}
            />
            <div className="min-w-0">
              <h3 className="font-black text-sm text-ink">{phase.name}</h3>
              <p className="text-xs text-ink/50 truncate">{narrative}</p>
            </div>
          </div>
          <div className="flex-shrink-0 flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ color: phase.color, background: `${phase.color}15` }}>
              {shortStatus}
            </span>
            <span className="text-ink/40">▼</span>
          </div>
        </div>
      </button>
    );
  }

  // Expanded view
  return (
    <div className="mb-6 p-6 rounded-2xl" style={{ background: '#F6F1E7', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b-2" style={{ borderColor: `${phase.color}20` }}>
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="font-black text-lg" style={{ color: phase.color }}>
              {phase.name}
            </h2>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ color: phase.color, background: `${phase.color}15` }}>
              {shortStatus}
            </span>
          </div>
          <p className="text-xs text-ink/60">{narrative}</p>
        </div>
        <button
          onClick={() => onToggleExpand(phase.name)}
          className="flex-shrink-0 text-ink/40 hover:text-ink/60 transition-colors"
          style={{ fontSize: '20px' }}>
          ▲
        </button>
      </div>

      {/* Weeks within phase — simplified decision steps, detail hidden behind expand */}
      <div className="space-y-3">
        {phaseWeeks.map((week) => (
          <WeekRow
            key={week.week}
            week={week}
            phase={phase}
            plan={plan}
            tier={tier}
            allStatuses={statuses}
            isCurrent={week.week === currentWeekNum}
            onToggleActionStatus={onToggleActionStatus}
            onEditAction={onEditAction}
            onDeleteAction={onDeleteAction}
            onOpenAdd={onOpenAdd}
            draggedId={draggedId}
            dragOverId={dragOverId}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            showCollapsedSupport={showCollapsedSupport}
            onToggleSupport={onToggleSupport}
            deletingIds={deletingIds}
          />
        ))}
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

type MissingActionKind = 'video' | 'short' | 'post';

const MISSING_ACTION_META: Record<MissingActionKind, {
  label: string;
  type: ActionType;
  system: ActionSystem;
  intent: ActionIntent;
  role: MomentRole;
  bg: string;
  defaultTitle: string;
}> = {
  video:  { label: 'Video',  type: 'video',  system: 2, intent: 'convert',    role: 'hero',    bg: '#FF4A1C', defaultTitle: 'New Video' },
  short:  { label: 'Short',  type: 'short',  system: 1, intent: 'engage',     role: 'push',    bg: '#FFD24C', defaultTitle: 'New Short' },
  post:   { label: 'Post',   type: 'post',   system: 1, intent: 'engage',     role: 'support', bg: '#2C25FF', defaultTitle: 'New Update' },
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
  const targets = plan.targets || { subsTarget: 0, viewsTarget: 0, shortsPerWeek: 3, videosPerWeek: 1, postsPerWeek: 3, communityPerWeek: 2 };
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

const ADD_MODAL_KINDS: MissingActionKind[] = ['short', 'post', 'video'];

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

function loadPlan(): CampaignPlan {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
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
          // User-created plans keep their flag; legacy saves default to example.
          return { ...saved, isExample: saved.isExample ?? true };
        }
      }
    } catch { /* ignore */ }
  }
  return makeSeedData();
}

export default function YouTubeCampaignCoach() {
  const [plan, setPlan] = useState<CampaignPlan>(() => loadPlan());
  const [expandedPhases, setExpandedPhases] = useState<Set<PhaseName>>(new Set());
  const [editingMetric, setEditingMetric] = useState<string | null>(null);
  const [metricDraft, setMetricDraft] = useState('');
  const [modalAction, setModalAction] = useState<{ action: CampaignAction; weekNum: number } | null>(null);
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [showNextDropModal, setShowNextDropModal] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [showCollapsedSupport, setShowCollapsedSupport] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('campaign');
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [undoItem, setUndoItem] = useState<UndoItem | null>(null);
  const [addModal, setAddModal] = useState<{ open: boolean; initialWeek?: number; initialKind?: MissingActionKind }>({ open: false });

  useEffect(() => {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(plan));
    } catch { /* ignore */ }
  }, [plan]);

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
    <div style={{ background: '#FAF7F2' }} className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Top orientation line — sets intent for the whole tool */}
        <div className="mb-3 text-[11px] font-semibold text-ink/45">
          Add content each week to stay on track and build momentum
        </div>

        {/* Campaign Timeline — header + system connection line + narrative phase + phase rail */}
        <CampaignTimeline
          plan={plan}
          onPhaseClick={(phase) => {
            setExpandedPhases((s) => {
              const next = new Set(s);
              if (next.has(phase)) next.delete(phase);
              else next.add(phase);
              return next;
            });
          }}
          onUpdatePlan={(updates) => setPlan((p) => ({ ...p, ...updates }))}
          onOpenSettings={() => setShowMetricsModal(true)}
          onOpenAdd={() => setAddModal({ open: true })}
          onNewCampaign={() => {
            // Soft confirm only if the user already has non-example work in progress
            if (!plan.isExample && !window.confirm('Start a new campaign?')) return;
            setPlan(makeEmptyPlan());
            setExpandedPhases(new Set());
            setShowCollapsedSupport(new Set());
            setAddModal({ open: false });
            setEditingMetric(null);
          }}
        />

        {/* CAMPAIGN ACTIVITY — Shorts/Posts/Videos counts + cadence + boosts */}
        <CampaignActivityCard plan={plan} />

        {/* TOP SECTION — This week's call + Status + Primary Action Strip */}
        <TopSignalCard
          plan={plan}
          onOpenAdd={(kind) => setAddModal({ open: true, initialKind: kind })}
        />

        {/* Subs + Views — calm context */}
        <MetricCards
          plan={plan}
          editingMetric={editingMetric}
          metricDraft={metricDraft}
          onOpenTargets={() => setShowMetricsModal(true)}
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

        {/* NEXT DROP — primary anchor with role */}
        <NextDropAnchor plan={plan} />

        {/* View Mode Toggle */}
        <ViewModeToggle mode={viewMode} onChange={setViewMode} />

        {/* Track View — auto-generated from campaign actions */}
        {viewMode === 'drop' && (
          <DropView plan={plan} />
        )}

        {/* Phase Blocks (Campaign View) */}
        {viewMode === 'campaign' && CAMPAIGN_PHASES.map((phase) => (
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

      {/* Metrics Modal */}
      {showMetricsModal && (
        <MetricsModal
          plan={plan}
          onSave={(updates) => {
            setPlan((p) => {
              const next = { ...p, ...updates };
              if (updates.startDate && updates.startDate !== p.startDate) {
                next.weeks = recalcWeekDates(next.weeks, updates.startDate);
              }
              return next;
            });
          }}
          onClose={() => setShowMetricsModal(false)}
        />
      )}

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

      {/* Undo Toast */}
      {undoItem && (
        <UndoToast
          name={undoItem.action.title}
          onUndo={handleUndo}
          onDismiss={dismissUndo}
        />
      )}
    </div>
  );
}
