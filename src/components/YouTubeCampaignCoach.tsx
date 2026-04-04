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
  { name: 'REAWAKEN',        weekStart: 1,  weekEnd: 3,  color: '#818cf8' },
  { name: 'BUILD THE WORLD', weekStart: 4,  weekEnd: 8,  color: '#c084fc' },
  { name: 'SCALE THE STORY', weekStart: 9,  weekEnd: 13, color: '#fbbf24' },
  { name: 'CULTURAL MOMENT', weekStart: 14, weekEnd: 22, color: '#fb7185' },
  { name: 'EXTEND',          weekStart: 23, weekEnd: 24, color: '#2dd4bf' },
];

const ACTION_LABELS: Record<ActionType, string> = {
  short: 'Shorts', video: 'Video', post: 'Post', live: 'Live', playlist: 'Playlist', collab: 'Collab', afterparty: 'Afterparty',
};

const ACTION_PILL: Record<ActionType, { icon: string; color: string }> = {
  short:      { icon: '▶', color: '#c084fc' },
  video:      { icon: '◆', color: '#fb7185' },
  post:       { icon: '◎', color: '#818cf8' },
  live:       { icon: '●', color: '#f97316' },
  playlist:   { icon: '≡', color: '#2dd4bf' },
  collab:     { icon: '◉', color: '#22c55e' },
  afterparty: { icon: '★', color: '#a855f7' },
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
  video:      { label: 'VIDEO',      bg: '#ef4444', actionType: 'video',      system: 2, intent: 'convert',    role: 'hero',    defaultTitle: 'New Video' },
  shorts:     { label: 'SHORTS',     bg: '#eab308', actionType: 'short',      system: 1, intent: 'engage',     role: 'push',    defaultTitle: 'New Short' },
  collab:     { label: 'COLLAB',     bg: '#22c55e', actionType: 'collab',     system: 2, intent: 'convert',    role: 'hero',    defaultTitle: 'New Collab' },
  live:       { label: 'LIVE',       bg: '#3b82f6', actionType: 'live',       system: 1, intent: 'engage',     role: 'support', defaultTitle: 'New Live' },
  afterparty: { label: 'AFTERPARTY', bg: '#a855f7', actionType: 'afterparty', system: 1, intent: 'distribute', role: 'push',    defaultTitle: 'Afterparty' },
};

const TILE_KINDS: TileKind[] = ['video', 'shorts', 'collab', 'live', 'afterparty'];

const STATUS_STYLE: Record<ActionStatus, { bg: string; text: string; border: string }> = {
  done:    { bg: 'rgba(0,0,0,0.03)', text: '#27272a', border: 'transparent' },
  missed:  { bg: 'rgba(251,113,133,0.08)', text: '#e11d48', border: 'transparent' },
  planned: { bg: 'transparent', text: '#a1a1aa', border: 'transparent' },
};

const TEMP: Record<WeekStatus, { text: string; dot: string }> = {
  cold:    { text: '#6366f1', dot: '#818cf8' },
  warm:    { text: '#d97706', dot: '#f59e0b' },
  hot:     { text: '#e11d48', dot: '#fb7185' },
  cooling: { text: '#71717a', dot: '#a1a1aa' },
};

const INTENT_META: Record<ActionIntent, { label: string; color: string }> = {
  engage:     { label: 'Engage',     color: '#38bdf8' },
  tease:      { label: 'Tease',      color: '#a78bfa' },
  convert:    { label: 'Convert',    color: '#fbbf24' },
  distribute: { label: 'Distribute', color: '#34d399' },
};

const SYSTEM_LABEL: Record<ActionSystem, string> = { 1: 'S1', 2: 'S2' };

const STATUS_CYCLE: ActionStatus[] = ['planned', 'done', 'missed'];
const ACTION_TYPES: ActionType[] = ['short', 'video', 'post', 'live', 'playlist', 'collab', 'afterparty'];
const SYSTEMS: ActionSystem[] = [1, 2];
const INTENTS: ActionIntent[] = ['engage', 'tease', 'convert', 'distribute'];
const DAYS: DayLabel[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const SIGNALS: MomentSignal[] = ['strong', 'neutral', 'weak'];
const SIGNAL_META: Record<MomentSignal, { label: string; color: string; icon: string }> = {
  strong:  { label: 'Strong', color: '#16a34a', icon: '▲' },
  neutral: { label: 'Neutral', color: '#71717a', icon: '—' },
  weak:    { label: 'Weak', color: '#dc2626', icon: '▼' },
};
const MOMENT_TYPES: CampaignMoment['type'][] = ['single', 'collab', 'album', 'announcement', 'milestone', 'anchor'];

const MOMENT_ROLES: MomentRole[] = ['hero', 'support', 'repackage', 'push'];
const MOMENT_ROLE_META: Record<MomentRole, { label: string; color: string; icon: string; desc: string }> = {
  hero:      { label: 'Hero',      color: '#fb7185', icon: '◆', desc: 'Official video / anchor content' },
  support:   { label: 'Support',   color: '#818cf8', icon: '◇', desc: 'Lyric video, BTS, live session' },
  repackage: { label: 'Repackage', color: '#fbbf24', icon: '↻', desc: 'Remix, visualiser, reaction edit' },
  push:      { label: 'Push',      color: '#2dd4bf', icon: '▶', desc: 'Shorts, community, playlists' },
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
  not_recorded: { label: 'Not Recorded', short: 'NR',  color: '#a1a1aa', bg: 'rgba(0,0,0,0.04)',    icon: '○' },
  recorded:     { label: 'Recorded',     short: 'REC', color: '#d97706', bg: 'rgba(217,119,6,0.08)', icon: '◑' },
  posted:       { label: 'Posted',       short: 'UP',  color: '#16a34a', bg: 'rgba(22,163,74,0.08)', icon: '●' },
};

const SUPPORT_PHASE_META: Record<SupportPhase, { label: string; color: string }> = {
  pre:  { label: 'PRE DROP',  color: '#818cf8' },
  drop: { label: 'DROP DAY',  color: '#fb7185' },
  post: { label: 'POST DROP', color: '#2dd4bf' },
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
  underbuilt: { label: 'Underbuilt', color: '#dc2626' },
  building:   { label: 'Building',   color: '#d97706' },
  ready:      { label: 'Ready',      color: '#16a34a' },
};

const LS_KEY = 'pih-campaign-coach-v2';

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
  const today = new Date();
  const startDate = today.toISOString().split('T')[0];
  const weeks: CampaignWeek[] = [];
  for (let i = 0; i < 24; i++) {
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() + i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const fmt = (d: Date) => `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;
    weeks.push({
      week: i + 1,
      dateRange: `${fmt(weekStart)} – ${fmt(weekEnd)}`,
      actions: [],
      feedback: {},
    });
  }
  return {
    artist: '',
    campaignName: '',
    subscriberCount: 0,
    startDate,
    weeks,
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

const PHASE_MICRO: Record<PhaseName, { short: string; desc: string; focus: string }> = {
  'REAWAKEN':        { short: 'REAWAKEN',  desc: 'Get active',    focus: 'Focus: Shorts + Posts' },
  'BUILD THE WORLD': { short: 'BUILD',     desc: 'Drop + collabs', focus: 'Focus: Drops + Shorts' },
  'SCALE THE STORY': { short: 'SCALE',     desc: 'Push content',  focus: 'Focus: Longform + Collabs' },
  'CULTURAL MOMENT': { short: 'CULTURAL',  desc: 'Peak moment',   focus: 'Focus: All channels' },
  'EXTEND':          { short: 'EXTEND',    desc: 'Sustain',       focus: 'Focus: Community' },
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

function CampaignTimeline({ plan, onPhaseClick, onUpdatePlan, onOpenSettings }: {
  plan: CampaignPlan;
  onPhaseClick: (name: PhaseName) => void;
  onUpdatePlan: (updates: Partial<CampaignPlan>) => void;
  onOpenSettings?: () => void;
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
            <h1 className="flex items-baseline gap-1 font-black text-2xl text-gray-900">
              <span>YouTube Campaign —</span>
              <input
                className="font-black text-2xl text-gray-900 bg-transparent border-b border-dashed border-gray-300 focus:border-gray-500 outline-none min-w-[120px]"
                value={plan.artist}
                placeholder="Enter Artist Name"
                onChange={(e) => onUpdatePlan({ artist: e.target.value })}
              />
            </h1>
            <input
              className="text-sm font-semibold text-gray-500 mt-0.5 bg-transparent border-b border-dashed border-gray-300 focus:border-gray-500 outline-none w-full"
              value={plan.campaignName}
              placeholder="Enter Campaign Name"
              onChange={(e) => onUpdatePlan({ campaignName: e.target.value })}
            />
          </div>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="ml-3 mt-1 p-2 rounded-lg bg-white border border-gray-200 shadow-sm hover:bg-gray-50 hover:shadow transition-all text-gray-500 hover:text-gray-700"
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

      {/* Week indicator + phase focus + drift warning */}
      <div className="mb-2 flex justify-between items-baseline">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-bold text-gray-500 tracking-wide">CAMPAIGN TIMELINE</span>
          {currentPhase && (
            <span className="text-[10px] font-bold tracking-wide" style={{ color: currentPhase.color }}>
              {PHASE_MICRO[currentPhase.name].short} — {PHASE_MICRO[currentPhase.name].focus}
            </span>
          )}
          {phaseDrift && actualPhase && (
            <span className="text-[10px] font-bold tracking-wide" style={{ color: actualPhase.color }}>
              · Reality: {PHASE_MICRO[actualPhase.name].short}
            </span>
          )}
        </div>
        <span className="text-xs font-semibold text-gray-400">Week {weekNum} of {totalWeeks}</span>
      </div>

      {/* Phase timeline */}
      <div className="w-full flex gap-1 rounded-2xl overflow-hidden p-1.5" style={{ background: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
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
                <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white" />
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

// ──── WEEKLY RHYTHM CARD ─────────────────────────────────────────────────────
// System 1 widget: instant read, decision + action in under 2 seconds
// "Are we on track? Where are we behind? What do we do right now?"

function WeeklyRhythmCard({ plan }: { plan: CampaignPlan }) {
  const targets = plan.targets || { subsTarget: 0, viewsTarget: 0, shortsPerWeek: 3, videosPerWeek: 1, postsPerWeek: 3, communityPerWeek: 2 };
  const totalWeeks = plan.weeks.length;

  // Current campaign week
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const campaignStart = new Date(plan.startDate + 'T12:00:00');
  const daysSinceStart = Math.floor((today.getTime() - campaignStart.getTime()) / (24 * 60 * 60 * 1000));
  const currentWeekNum = Math.max(1, Math.min(totalWeeks, Math.floor(daysSinceStart / 7) + 1));
  const currentWeekData = plan.weeks.find((w) => w.week === currentWeekNum);
  const prevWeekData = plan.weeks.find((w) => w.week === currentWeekNum - 1);

  // Day context
  const dayOfWeek = ((daysSinceStart % 7) + 7) % 7;
  const daysLeft = Math.max(0, 6 - dayOfWeek);

  // Count done actions for this week
  const thisWeekActions = currentWeekData?.actions || [];
  const count = (type: string) => thisWeekActions.filter((a) => a.type === type && a.status === 'done').length;

  // 3 tracked categories — clear, no overlap
  const postsAndCommunityDone = count('post') + count('live') + count('collab');
  const postsAndCommunityTarget = (targets.postsPerWeek || 3) + (targets.communityPerWeek || 2);
  const categories = [
    { key: 'shorts',    label: 'Shorts',            done: count('short'), target: targets.shortsPerWeek || 3 },
    { key: 'community', label: 'Posts / Community',  done: postsAndCommunityDone, target: postsAndCommunityTarget },
    { key: 'longform',  label: 'Longform',           done: count('video'), target: targets.videosPerWeek || 1 },
  ];

  // Row status: hit (done >= target), at_risk (some progress), behind (zero or end of week)
  type RowStatus = 'hit' | 'at_risk' | 'behind';
  const getRowStatus = (done: number, target: number): RowStatus => {
    if (target === 0) return 'hit';
    if (done >= target) return 'hit';
    if (done === 0) return 'behind';
    if (daysLeft === 0) return 'behind';
    return 'at_risk';
  };

  const statusColor: Record<RowStatus, string> = { hit: '#16a34a', at_risk: '#ea580c', behind: '#dc2626' };

  const rows = categories.map((c) => ({ ...c, status: getRowStatus(c.done, c.target) }));

  // Overall status
  const behindCount = rows.filter((r) => r.status === 'behind').length;
  const atRiskCount = rows.filter((r) => r.status === 'at_risk').length;
  type OverallStatus = 'on_track' | 'at_risk' | 'behind';
  const overall: OverallStatus = behindCount >= 2 ? 'behind' : (behindCount >= 1 || atRiskCount >= 2) ? 'at_risk' : atRiskCount >= 1 ? 'at_risk' : 'on_track';

  const overallMeta: Record<OverallStatus, { label: string; color: string; bg: string }> = {
    on_track: { label: 'On Track',  color: '#16a34a', bg: 'rgba(22,163,74,0.08)'  },
    at_risk:  { label: 'At Risk',   color: '#ea580c', bg: 'rgba(234,88,12,0.08)'  },
    behind:   { label: 'Behind',    color: '#dc2626', bg: 'rgba(220,38,38,0.08)'  },
  };

  // Generate imperative action command — short, direct, tells you exactly what to do
  const generateAction = (): string => {
    if (overall === 'on_track') return 'All done — maintain momentum';
    const gaps = rows.filter((r) => r.status !== 'hit').map((r) => ({ ...r, need: r.target - r.done }));
    if (gaps.length === 0) return 'On pace';

    // Build short imperative parts
    const parts: string[] = [];
    for (const g of gaps) {
      if (g.key === 'shorts') parts.push(`drop ${g.need} short${g.need > 1 ? 's' : ''}`);
      else if (g.key === 'community') parts.push(`post + engage ${g.need}x`);
      else if (g.key === 'longform') parts.push(`upload ${g.need} longform`);
    }
    // Capitalize first part, join with +
    if (parts.length > 0) parts[0] = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    return parts.join(' + ');
  };

  // Micro urgency hint
  const generateUrgencyHint = (): string | null => {
    if (overall === 'on_track') return null;
    const totalGap = rows.reduce((sum, r) => sum + Math.max(0, r.target - r.done), 0);
    if (totalGap <= 2) return '(Quick win — do it now)';
    if (totalGap <= 4) return '(10–15 mins to fix)';
    return '(Needs a focused session)';
  };

  const om = overallMeta[overall];

  return (
    <div className="rounded-2xl p-4 h-full flex flex-col" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      {/* Title with inline status */}
      <div className="flex items-baseline gap-2 mb-3">
        <div className="text-sm font-black uppercase tracking-wide text-gray-500">This Week's Rhythm</div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ background: om.color }} />
          <span className="text-xs font-black" style={{ color: om.color }}>{om.label}</span>
        </div>
      </div>

      {/* Rows — numbers first, labels second */}
      <div className="space-y-2.5 mb-3">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-3">
            <div className="flex items-baseline gap-0.5 min-w-[48px]">
              <span className="text-xl font-black tabular-nums leading-none" style={{ color: statusColor[r.status] }}>{r.done}</span>
              <span className="text-xs font-bold text-gray-300">/{r.target}</span>
            </div>
            <span className="text-sm font-bold text-gray-500">{r.label}</span>
          </div>
        ))}
      </div>

      {/* Action command — pushed to bottom */}
      <div className="border-t border-gray-100 pt-2.5 mt-auto">
        <div className="text-sm font-black leading-tight" style={{ color: om.color }}>
          {generateAction()}
        </div>
        {generateUrgencyHint() && (
          <div className="mt-1 text-[10px] font-semibold text-gray-400">{generateUrgencyHint()}</div>
        )}
      </div>
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
          className="text-3xl font-black bg-gray-50 border border-gray-300 rounded px-2 py-1 w-32 outline-none focus:border-gray-500" />
      );
    }
    return (
      <button onClick={() => onEditStart(metricKey, rawValue.toString())}
        className="text-3xl font-black text-gray-900 hover:text-gray-600 transition-colors cursor-pointer">
        {displayValue}
      </button>
    );
  };

  const ProgressBar = ({ pct, color }: { pct: number; color: string }) => (
    <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.05)' }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(2, pct)}%`, background: color }} />
    </div>
  );

  // ── NEXT DROP (key drops only) ───────────────────────────────────────────
  const nextDrop = getNextDrop(plan);
  const daysAway = nextDrop?.daysAway ?? 0;
  let dropDateStr = '';
  let dropDayStr = '';
  if (nextDrop) {
    const iso = nextDrop.action.date || nextDrop.dateObj.toISOString().slice(0, 10);
    dropDateStr = fmtDate(iso);
    dropDayStr = fmtDay(iso);
  }
  const dropPill = nextDrop ? ACTION_PILL[nextDrop.action.type] : null;

  // Urgency: 30+ neutral, 7-30 mild, 0-6 urgent, <0 overdue
  const dropUrgencyColor = !nextDrop ? '#71717a'
    : daysAway < 0 ? '#dc2626'
    : daysAway <= 6 ? '#d97706'
    : daysAway <= 30 ? '#a16207'
    : '#71717a';
  const dropUrgencyLabel = !nextDrop ? ''
    : daysAway < 0 ? `${Math.abs(daysAway)}d overdue`
    : daysAway === 0 ? 'Today'
    : daysAway === 1 ? 'Tomorrow'
    : `${daysAway}d away`;

  // Subs growth indicator
  const subsOnPace = subsProgress >= Math.round((activeWeekCount / Math.max(1, totalWeeks)) * 100);

  return (
    <div className="mb-8">
      {/* Left: This Week (dominant) | Right: Views + Subs stacked compact */}
      <div className="grid gap-3" style={{ gridTemplateColumns: '1.3fr 1fr' }}>

        {/* THIS WEEK — left, fills full height */}
        <div className="flex">
          <div className="flex-1"><WeeklyRhythmCard plan={plan} /></div>
        </div>

        {/* Right column — two compact cards stacked */}
        <div className="flex flex-col gap-3">

          {/* SUBSCRIBER GROWTH — campaign-focused */}
          {(() => {
            return (
              <div className="rounded-2xl px-4 py-3 flex-1 flex flex-col justify-center" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div className="flex items-baseline justify-between mb-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Subscribers</div>
                  <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: subsOnPace ? '#16a34a' : '#d97706' }}>
                    {subsOnPace ? 'Ahead of target' : 'Behind target'}
                  </span>
                </div>
                <div className="mb-0.5">
                  <EditableNum metricKey="currentSubs" displayValue={formatSubs(currentSubs)} rawValue={currentSubs} />
                </div>
                <div className="text-[10px] font-bold text-gray-400 mb-1.5">
                  +{subsGained.toLocaleString()} this campaign · <button onClick={onOpenTargets} className="underline decoration-dotted hover:text-gray-600 transition-colors cursor-pointer" style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit' }}>Target: {formatSubs(targets.subsTarget)}</button>
                </div>
                <ProgressBar pct={subsProgress} color={subsOnPace ? '#16a34a' : '#d97706'} />
              </div>
            );
          })()}

          {/* VIEWS — campaign-focused */}
          {(() => {
            const fmtViewsTarget = targets.viewsTarget >= 1000000
              ? `${(targets.viewsTarget / 1000000).toFixed(targets.viewsTarget % 1000000 === 0 ? 0 : 1)}M`
              : targets.viewsTarget.toLocaleString();
            return (
              <div className="rounded-2xl px-4 py-3 flex-1 flex flex-col justify-center" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div className="flex items-baseline justify-between mb-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Views</div>
                  <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: viewsAhead ? '#16a34a' : '#d97706' }}>
                    {viewsAhead ? 'Ahead of target' : 'Behind target'}
                  </span>
                </div>
                <div className="mb-0.5">
                  <EditableNum metricKey="views" displayValue={totalViews.toLocaleString()} rawValue={totalViews} />
                </div>
                <div className="text-[10px] font-bold text-gray-400 mb-1.5">
                  <button onClick={onOpenTargets} className="underline decoration-dotted hover:text-gray-600 transition-colors cursor-pointer" style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit' }}>Target: {fmtViewsTarget}</button>
                </div>
                <ProgressBar pct={viewsProgress} color={viewsAhead ? '#16a34a' : '#d97706'} />
              </div>
            );
          })()}

        </div>

      </div>

      {/* Row 2: Next Drop — full width, quiet/neutral */}
      <div className="mt-3 rounded-2xl p-4" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-xs font-bold uppercase tracking-widest text-gray-400">Next Drop</div>
            {nextDrop ? (
              <>
                <span className="text-sm font-black text-gray-900">{nextDrop.action.title}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: dropPill!.color, background: `${dropPill!.color}12` }}>
                  {dropPill!.icon} {ACTION_LABELS[nextDrop.action.type]}
                </span>
                <span className="text-xs text-gray-500">{dropDayStr} · {dropDateStr}</span>
              </>
            ) : (
              <span className="text-sm text-gray-400">No upcoming key drop</span>
            )}
          </div>
          {nextDrop && (
            <div className="text-sm font-bold" style={{ color: dropUrgencyColor }}>
              {dropUrgencyLabel}
            </div>
          )}
        </div>
        {nextDrop && daysAway > 14 && (
          <div className="mt-1.5 text-[10px] font-semibold text-gray-400">
            Prep starts in ~{Math.max(1, Math.floor((daysAway - 7) / 7))}–{Math.max(2, Math.floor((daysAway - 3) / 7))} weeks
          </div>
        )}
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
      <div className="relative w-full max-w-md mx-4 rounded-2xl overflow-hidden" style={{ background: '#ffffff', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <h3 className="text-base font-black text-gray-900">Campaign Targets</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors text-lg">×</button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Baseline</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Starting Subs</label>
              <input type="text" value={startingSubs} onChange={(e) => setStartingSubs(e.target.value)}
                className="w-full text-sm font-semibold text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400 transition-colors" />
              <p className="text-[10px] text-gray-400 mt-1">Subscriber count at campaign start</p>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-sm font-semibold text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400 transition-colors" />
              <p className="text-[10px] text-gray-400 mt-1">Week 1 starts from this date</p>
            </div>
          </div>

          <div className="h-px" style={{ background: 'rgba(0,0,0,0.06)' }} />

          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Growth Targets</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Sub Target</label>
              <input type="text" value={subsTarget} onChange={(e) => setSubsTarget(e.target.value)}
                className="w-full text-sm font-semibold text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400 transition-colors" />
              <p className="text-[10px] text-gray-400 mt-1">Goal subscriber count</p>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Views Target</label>
              <input type="text" value={viewsTarget} onChange={(e) => setViewsTarget(e.target.value)}
                className="w-full text-sm font-semibold text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400 transition-colors" />
              <p className="text-[10px] text-gray-400 mt-1">Total campaign views goal</p>
            </div>
          </div>

          <div className="h-px" style={{ background: 'rgba(0,0,0,0.06)' }} />

          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Output Targets</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Shorts / Week</label>
              <input type="text" value={shortsPerWeek} onChange={(e) => setShortsPerWeek(e.target.value)}
                className="w-full text-sm font-semibold text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400 transition-colors" />
              <p className="text-[10px] text-gray-400 mt-1">Target shorts per week</p>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Videos / Week</label>
              <input type="text" value={videosPerWeek} onChange={(e) => setVideosPerWeek(e.target.value)}
                className="w-full text-sm font-semibold text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400 transition-colors" />
              <p className="text-[10px] text-gray-400 mt-1">Target videos per week</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 flex justify-end gap-3" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <button onClick={onClose} className="text-xs font-semibold px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
          <button onClick={handleSave} className="text-xs font-bold px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors">Save</button>
        </div>
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
      <div className="relative w-full max-w-md mx-4 rounded-2xl overflow-hidden" style={{ background: '#ffffff', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <h3 className="text-base font-black text-gray-900">Edit Next Drop</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors text-lg">×</button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Title</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full text-sm font-semibold text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as CampaignMoment['type'])}
                className="w-full text-sm font-semibold text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400">
                {MOMENT_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Week</label>
              <div className="text-sm font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">Week {moment.weekNum}</div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Goal</label>
            <textarea value={goal} onChange={(e) => setGoal(e.target.value)}
              className="w-full text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400 h-16 resize-none" />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Prep Checklist</label>
            <div className="space-y-2">
              {checklist.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{i + 1}.</span>
                  <input type="text" value={item}
                    onChange={(e) => { const next = [...checklist]; next[i] = e.target.value; setChecklist(next); }}
                    className="flex-1 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-gray-400" />
                  <button onClick={() => setChecklist(checklist.filter((_, j) => j !== i))}
                    className="text-gray-400 hover:text-red-500 text-xs">×</button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input type="text" value={newItem} placeholder="Add item..."
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && newItem.trim()) { setChecklist([...checklist, newItem.trim()]); setNewItem(''); } }}
                  className="flex-1 text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:border-gray-400" />
                <button onClick={() => { if (newItem.trim()) { setChecklist([...checklist, newItem.trim()]); setNewItem(''); } }}
                  className="text-xs font-bold text-gray-500 hover:text-gray-700 px-2 py-1">+</button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 flex justify-end gap-3" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <button onClick={onClose} className="text-xs font-semibold px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
          <button onClick={handleSave} className="text-xs font-bold px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors">Save</button>
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
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:bg-white"
        style={{ background: open ? '#ffffff' : 'transparent' }}>
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Channel</span>
        {needsWarning && <span style={{ color: statusColor, fontSize: '12px' }}>&#9888;</span>}
        <span className="text-xs font-black" style={{ color: statusColor }}>{statusLabel}</span>
        <span className="text-[10px] text-gray-300">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-2 rounded-xl p-4 grid grid-cols-4 gap-4 text-xs" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Last 4 Weeks</div>
            <div className="font-black text-gray-900">{totalDoneLast4} uploads</div>
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Consistency</div>
            <div className="font-black" style={{ color: consistencyColor }}>{consistency}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Engagement</div>
            <div className="font-black" style={{ color: engagementColor }}>{engagementStr}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Growth</div>
            <div className="font-black" style={{ color: growthColor }}>{growthLabel}</div>
          </div>
          <div className="col-span-4 pt-2 border-t border-gray-100">
            <span className="text-gray-500">{diagnosis}</span>
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
                <div className="absolute top-2 right-2 min-w-[18px] h-[18px] rounded-full bg-white flex items-center justify-center"
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
      style={{ background: '#18181b', minWidth: 260 }}>
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
        <span className="flex-shrink-0 text-[9px] font-semibold text-gray-500">{fmtDate(action.date)}</span>
      )}
      <span className="flex-shrink-0 text-[9px] text-gray-400">{action.day}</span>

      {/* Hover actions: edit + delete */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
        <button
          onClick={() => onEdit(action, weekNum)}
          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-black/5 rounded-lg transition-colors"
          style={{ fontSize: '10px' }}
          title="Edit">
          ✎
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(weekNum, action); }}
          className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
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
        background: '#ffffff',
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
        className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
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
            <h4 className="font-black text-base text-gray-900 leading-tight cursor-pointer hover:opacity-70" onClick={() => onEdit(action, weekNum)}>
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
        className="text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors"
        style={{ textDecoration: 'underline' }}>
        {isExpanded ? `Hide ${supports.length} support action${supports.length > 1 ? 's' : ''}` : `Show ${supports.length} support action${supports.length > 1 ? 's' : ''}`}
      </button>
      {isExpanded && (
        <div className="mt-2 space-y-2 pl-3 border-l-2 border-gray-200">
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
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-black text-gray-900 mb-3">Edit Action</h3>

        <div className="space-y-3 mb-4">
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-blue-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ActionType)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-blue-400">
                {ACTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ACTION_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Day</label>
              <select
                value={dateVal ? fmtDay(dateVal) : day}
                onChange={(e) => { if (!dateVal) setDay(e.target.value as DayLabel); }}
                disabled={!!dateVal}
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-blue-400 disabled:opacity-50">
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              {dateVal && <span className="text-[9px] text-gray-400 mt-0.5 block">Auto from date</span>}
            </div>
          </div>

          {/* Date field */}
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Date</label>
            <input
              type="date"
              value={dateVal}
              onChange={(e) => setDateVal(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-blue-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">System</label>
              <select
                value={system}
                onChange={(e) => setSystem(Number(e.target.value) as ActionSystem)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-blue-400">
                {SYSTEMS.map((s) => (
                  <option key={s} value={s}>
                    {SYSTEM_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Intent</label>
              <select
                value={intent}
                onChange={(e) => setIntent(e.target.value as ActionIntent)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-blue-400">
                {INTENTS.map((i) => (
                  <option key={i} value={i}>
                    {INTENT_META[i].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ActionStatus)}
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-blue-400">
              {STATUS_CYCLE.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Moment Role */}
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Moment Role</label>
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
            <label className="text-xs font-bold text-gray-600 block mb-1">Featured Artist (optional)</label>
            <input
              type="text"
              value={featured}
              onChange={(e) => setFeatured(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-blue-400 h-14 resize-none"
            />
          </div>

          {/* Moment-level metrics */}
          <div className="pt-2 border-t border-gray-100">
            <label className="text-xs font-bold text-gray-600 block mb-1">Moment Metrics (optional)</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Views</label>
                <input type="number" value={mViews} onChange={(e) => setMViews(e.target.value)} placeholder="0"
                  className="w-full text-sm px-3 py-1.5 rounded-lg border border-gray-200 outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Comments</label>
                <input type="number" value={mComments} onChange={(e) => setMComments(e.target.value)} placeholder="0"
                  className="w-full text-sm px-3 py-1.5 rounded-lg border border-gray-200 outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Subs Gained</label>
                <input type="number" value={mSubs} onChange={(e) => setMSubs(e.target.value)} placeholder="0"
                  className="w-full text-sm px-3 py-1.5 rounded-lg border border-gray-200 outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Signal</label>
                <select value={mSignal} onChange={(e) => setMSignal(e.target.value as MomentSignal | '')}
                  className="w-full text-sm px-3 py-1.5 rounded-lg border border-gray-200 outline-none focus:border-blue-400">
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
            className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors">
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
    <div className="rounded-2xl p-5" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-black text-sm text-gray-900 truncate flex-1">{track.trackName}</h4>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-bold" style={{ color: meta.color }}>{meta.label}</span>
          <span className="text-[10px] text-gray-400">{doneCount}/{track.items.length}</span>
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
              <span className="flex-1 text-xs text-gray-700" style={{ textDecoration: item.done ? 'line-through' : 'none', opacity: item.done ? 0.6 : 1 }}>
                {item.label}
              </span>
              <button onClick={() => onRemoveItem(track.trackId, item.id)}
                className="text-gray-300 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
            </div>
          );
        })}
      </div>

      <button onClick={() => onAddItem(track.trackId)}
        className="mt-2 text-[10px] font-bold text-gray-400 hover:text-gray-600 transition-colors">
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
        <span className="text-[10px] text-gray-400">{doneCount}/{windowActions.length} done</span>
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
              <span className="flex-1 text-xs text-gray-700 truncate cursor-pointer hover:opacity-70"
                onClick={() => onEdit(a, dw.weekNum)}
                style={{ textDecoration: a.status === 'missed' ? 'line-through' : 'none' }}>
                {a.title}
              </span>
              <span className="text-[9px] text-gray-400">{a.day}</span>
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

const DROP_STATUS_META: Record<AutoTrack['status'], { label: string; color: string }> = {
  upcoming: { label: 'Upcoming', color: '#a1a1aa' },
  active:   { label: 'Active',   color: '#d97706' },
  complete: { label: 'Complete', color: '#16a34a' },
};

// ──── DROP PLAYBOOK ─────────────────────────────────────────────────────────
// Defines expected support per drop type — all values derived from real actions
type PlaybookExpectation = { label: string; type: ActionType; expected: number };

// Default playbook: what a well-supported video drop should have
const VIDEO_PLAYBOOK: PlaybookExpectation[] = [
  { label: 'Video',           type: 'video',    expected: 1 },
  { label: 'Shorts',          type: 'short',    expected: 3 },
  { label: 'Community Posts',  type: 'post',     expected: 1 },
  { label: 'Playlist',        type: 'playlist',  expected: 1 },
];

// Collab drops expect the same but with the collab type
const COLLAB_PLAYBOOK: PlaybookExpectation[] = [
  { label: 'Collab',          type: 'collab',   expected: 1 },
  { label: 'Shorts',          type: 'short',    expected: 3 },
  { label: 'Community Posts',  type: 'post',     expected: 1 },
  { label: 'Playlist',        type: 'playlist',  expected: 1 },
];

type PlaybookResult = {
  label: string;
  type: ActionType;
  expected: number;
  actual: number;
  done: number;
  status: 'complete' | 'partial' | 'missing';
};

function getDropPlaybook(track: AutoTrack): PlaybookResult[] {
  // Choose playbook based on anchor action type
  const anchorType = track.anchorAction?.type;
  const base = anchorType === 'collab' ? COLLAB_PLAYBOOK : VIDEO_PLAYBOOK;

  // Gather all real actions: the hero + all support actions in the same week and nearby weeks
  const allActions = [
    ...(track.anchorAction ? [track.anchorAction] : []),
    ...track.supportActions,
  ];
  // Also count support plan items (the filming checklist)
  const spItems = track.supportPlan?.items || [];

  return base.map((expectation) => {
    // Count actions of this type
    const actionsOfType = allActions.filter((a) => a.type === expectation.type);
    const doneOfType = actionsOfType.filter((a) => a.status === 'done').length;

    // Also count posted support plan items of this content type
    const spOfType = spItems.filter((s) => s.contentType === expectation.type);
    const spPosted = spOfType.filter((s) => s.status === 'posted').length;

    const actual = actionsOfType.length + spOfType.length;
    const done = doneOfType + spPosted;

    let status: PlaybookResult['status'] = 'missing';
    if (done >= expectation.expected) {
      status = 'complete';
    } else if (actual > 0) {
      status = 'partial';
    }

    return {
      label: expectation.label,
      type: expectation.type,
      expected: expectation.expected,
      actual,
      done,
      status,
    };
  });
}

function DropCard({ track }: { track: AutoTrack }) {
  const statusMeta = DROP_STATUS_META[track.status];
  const phaseColor = track.phase?.color || '#71717a';
  const playbook = getDropPlaybook(track);

  // Execution: sum done / sum expected across all playbook rows
  const totalExpected = playbook.reduce((s, p) => s + p.expected, 0);
  const totalDone = playbook.reduce((s, p) => s + Math.min(p.done, p.expected), 0);
  const executionPct = totalExpected > 0 ? Math.round((totalDone / totalExpected) * 100) : 0;

  // Missing items: categories where done < expected
  const missingItems = playbook.filter((p) => p.done < p.expected);

  // Main drop status (first row of the playbook is always the primary content)
  const mainDrop = track.anchorAction;
  const mainDropStatus = !mainDrop ? 'missing' : mainDrop.status === 'done' ? 'live' : mainDrop.status === 'missed' ? 'missed' : 'planned';
  const mainDropColor = mainDropStatus === 'live' ? '#16a34a' : mainDropStatus === 'missed' ? '#dc2626' : mainDropStatus === 'planned' ? '#d97706' : '#dc2626';

  return (
    <div className="rounded-2xl p-5" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      {/* Header: name + status */}
      <div className="flex items-center justify-between mb-1.5">
        <h4 className="font-black text-sm text-gray-900 truncate flex-1">{track.name}</h4>
        <span className="text-[10px] font-bold flex-shrink-0 px-2 py-0.5 rounded-full"
          style={{ color: statusMeta.color, background: `${statusMeta.color}15` }}>
          {statusMeta.label}
        </span>
      </div>

      {/* Date + week */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[10px] font-semibold" style={{ color: phaseColor }}>
          Week {track.weekNum} · {fmtDate(track.date)}
        </span>
      </div>

      {/* Main Drop */}
      <div className="mb-3 p-3 rounded-xl" style={{ background: mainDropStatus === 'missing' ? '#fef2f2' : mainDropStatus === 'live' ? '#f0fdf4' : '#fffbeb' }}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Main Drop</span>
          <span className="text-[10px] font-bold" style={{ color: mainDropColor }}>
            {mainDropStatus === 'live' ? 'Live' : mainDropStatus === 'missed' ? 'Missed' : mainDropStatus === 'planned' ? 'Planned' : 'Missing'}
          </span>
        </div>
        {mainDrop ? (
          <div className="flex items-center gap-2 mt-1.5">
            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: ACTION_PILL[mainDrop.type].color }} />
            <span className="text-xs font-bold text-gray-800 truncate">{mainDrop.title}</span>
            {mainDrop.featuredArtist && (
              <span className="text-[10px] text-gray-400 flex-shrink-0">ft. {mainDrop.featuredArtist}</span>
            )}
          </div>
        ) : (
          <div className="mt-1.5 text-xs text-red-400 font-semibold">No video or collab added yet</div>
        )}
      </div>

      {/* Support — actual vs expected per category */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Support</span>
          <span className="text-[10px] font-bold tabular-nums" style={{ color: totalDone >= totalExpected ? '#16a34a' : '#71717a' }}>
            {totalDone}/{totalExpected}
          </span>
        </div>
        <div className="space-y-1.5">
          {playbook.map((row, i) => {
            const color = row.status === 'complete' ? '#16a34a' : row.status === 'partial' ? '#d97706' : '#d4d4d8';
            const icon = row.status === 'complete' ? '✓' : row.status === 'partial' ? '◑' : '○';
            const countColor = row.done >= row.expected ? '#16a34a' : row.done > 0 ? '#d97706' : '#a1a1aa';
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] w-3 text-center flex-shrink-0" style={{ color }}>{icon}</span>
                <span className="text-[10px] flex-1 font-semibold" style={{ color: row.status === 'complete' ? '#71717a' : '#374151' }}>
                  {row.label}
                </span>
                <span className="text-[10px] font-bold tabular-nums flex-shrink-0" style={{ color: countColor }}>
                  {Math.min(row.done, row.expected)}/{row.expected}
                </span>
                <span className="text-[9px] font-bold px-1 rounded flex-shrink-0"
                  style={{ color: ACTION_PILL[row.type].color, background: `${ACTION_PILL[row.type].color}10` }}>
                  {ACTION_PILL[row.type].icon}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Execution Score */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold text-gray-500">Execution</span>
          <span className="text-xs font-black" style={{ color: executionPct === 100 ? '#16a34a' : executionPct >= 50 ? '#d97706' : '#dc2626' }}>
            {executionPct}%
          </span>
        </div>
        <div className="w-full h-2 rounded-full" style={{ background: 'rgba(0,0,0,0.05)' }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.max(2, executionPct)}%`, background: executionPct === 100 ? '#16a34a' : executionPct >= 50 ? '#d97706' : '#dc2626' }} />
        </div>
      </div>

      {/* Missing Items */}
      {missingItems.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <span className="text-[10px] font-bold text-red-500">
            Missing: {missingItems.map((m) => {
              const gap = m.expected - m.done;
              return gap === m.expected ? m.label : `${m.label} (${gap} more)`;
            }).join(', ')}
          </span>
        </div>
      )}
    </div>
  );
}

function DropView({ plan }: { plan: CampaignPlan }) {
  const autoTracks = useMemo(() => deriveAutoTracks(plan), [plan]);

  if (autoTracks.length === 0) {
    return (
      <div className="text-center py-12" style={{ color: '#a1a1aa' }}>
        <div className="text-2xl mb-2">◆</div>
        <p className="text-sm font-semibold text-gray-500">No drops planned yet</p>
        <p className="text-xs mt-1">Add a video or collab in Campaign View and it will appear here as a drop.</p>
      </div>
    );
  }

  // Overall execution stats
  const totalDrops = autoTracks.length;
  const completeCount = autoTracks.filter((t) => t.status === 'complete').length;
  const activeCount = autoTracks.filter((t) => t.status === 'active').length;
  const upcomingCount = totalDrops - completeCount - activeCount;

  // Calculate overall execution %
  const allPlaybooks = autoTracks.map((t) => getDropPlaybook(t));
  const totalExpected = allPlaybooks.reduce((s, pb) => s + pb.reduce((a, p) => a + p.expected, 0), 0);
  const totalDone = allPlaybooks.reduce((s, pb) => s + pb.reduce((a, p) => a + p.done, 0), 0);
  const overallPct = totalExpected > 0 ? Math.round((totalDone / totalExpected) * 100) : 0;

  // Drops with missing items (for quick scan)
  const dropsWithGaps = autoTracks.filter((t) => {
    const pb = getDropPlaybook(t);
    return pb.some((p) => p.status === 'missing') && t.status !== 'complete';
  });

  return (
    <div>
      {/* Summary card */}
      <div className="mb-6 rounded-2xl p-5" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Drops</span>
            <div className="mt-1 text-lg font-black text-gray-900">{totalDrops} drops</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-sm font-black" style={{ color: '#16a34a' }}>{completeCount}</div>
              <div className="text-[9px] text-gray-400">Done</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-black" style={{ color: '#d97706' }}>{activeCount}</div>
              <div className="text-[9px] text-gray-400">Active</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-black text-gray-400">{upcomingCount}</div>
              <div className="text-[9px] text-gray-400">Upcoming</div>
            </div>
          </div>
        </div>
        {/* Overall execution bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-gray-500">Overall execution</span>
            <span className="text-xs font-black" style={{ color: overallPct === 100 ? '#16a34a' : overallPct >= 50 ? '#d97706' : '#dc2626' }}>
              {overallPct}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full" style={{ background: 'rgba(0,0,0,0.05)' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(2, overallPct)}%`, background: overallPct === 100 ? '#16a34a' : overallPct >= 50 ? '#d97706' : '#dc2626' }} />
          </div>
        </div>
        {/* Quick gap scan */}
        {dropsWithGaps.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <span className="text-[10px] font-bold text-red-500">
              {dropsWithGaps.length} drop{dropsWithGaps.length > 1 ? 's' : ''} with gaps
            </span>
          </div>
        )}
      </div>

      {/* Drop cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {autoTracks.map((track) => (
          <DropCard key={track.id} track={track} />
        ))}
      </div>
    </div>
  );
}

// ──── VIEW MODE TOGGLE ──────────────────────────────────────────────────────
function ViewModeToggle({ mode, onChange }: { mode: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div className="mb-6 flex rounded-xl p-1" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      {(['campaign', 'drop'] as ViewMode[]).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className="flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all"
          style={{
            background: mode === m ? '#27272a' : 'transparent',
            color: mode === m ? '#ffffff' : '#71717a',
          }}>
          {m === 'campaign' ? 'Campaign View' : 'Drop View'}
        </button>
      ))}
    </div>
  );
}

// ──── PHASE BLOCK ────────────────────────────────────────────────────────────
// Single expandable phase section
function PhaseBlock({ phase, plan, expanded, onToggleExpand, onToggleActionStatus, onEditAction, onDeleteAction, onAddAction, draggedId, dragOverId, onDragStart, onDragOver, onDrop, showCollapsedSupport, onToggleSupport, deletingIds, onCycleSupportStatus, onAddSupportItem, onRemoveSupportItem }: {
  phase: CampaignPhase;
  plan: CampaignPlan;
  expanded: boolean;
  onToggleExpand: (name: PhaseName) => void;
  onToggleActionStatus: (id: string) => void;
  onEditAction: (action: CampaignAction, weekNum: number) => void;
  onDeleteAction: (weekNum: number, action: CampaignAction) => void;
  onAddAction: (weekNum: number, action: CampaignAction) => void;
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
        style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ background: phase.color }}
            />
            <div className="min-w-0">
              <h3 className="font-black text-sm text-gray-900">{phase.name}</h3>
              <p className="text-xs text-gray-500 truncate">{narrative}</p>
            </div>
          </div>
          <div className="flex-shrink-0 flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ color: phase.color, background: `${phase.color}15` }}>
              {shortStatus}
            </span>
            <span className="text-gray-400">▼</span>
          </div>
        </div>
      </button>
    );
  }

  // Expanded view
  return (
    <div className="mb-6 p-6 rounded-2xl" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
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
          <p className="text-xs text-gray-600">{narrative}</p>
        </div>
        <button
          onClick={() => onToggleExpand(phase.name)}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          style={{ fontSize: '20px' }}>
          ▲
        </button>
      </div>

      {/* Weeks within phase */}
      <div className="space-y-6">
        {phaseWeeks.map((week) => {
          const weekActions = week.actions;
          const heroAction = weekActions.find((a) => a.system === 2 && !a.dropWindowId);
          const shorts = weekActions.filter((a) => a.type === 'short' && !a.dropWindowId);
          const supports = weekActions.filter((a) => a.type !== 'short' && a.system === 1 && !a.dropWindowId);
          const weekDropWindows = (plan.dropWindows || []).filter((dw) => dw.weekNum === week.week);
          const windowedActions = weekActions.filter((a) => a.dropWindowId);

          return (
            <div key={week.week} className="pb-4 border-b border-gray-100 last:border-b-0 last:pb-0">
              {/* Week header — generic by default, data-driven details only if actions exist */}
              {(() => {
                // Derive key drop from the week's own actions (video, collab, live, album, afterparty with system 2)
                const keyDropAction = weekActions.find((a) => KEY_DROP_TYPES.has(a.type) && a.system === 2);
                const hasKeyDrop = !!keyDropAction;
                return (
                  <div className="mb-3">
                    {/* Primary: date range + week number — always shown */}
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-sm text-gray-900">{week.dateRange} · Week {week.week}</h4>
                      {hasKeyDrop && (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full tracking-wide"
                          style={{ color: '#ffffff', background: phase.color }}>
                          KEY DROP
                        </span>
                      )}
                    </div>
                    {/* Optional user label — only if set */}
                    {week.label && (
                      <div className="mt-0.5 text-xs font-semibold text-gray-500">{week.label}</div>
                    )}
                    {/* Drop details — only if a key drop action exists and has release notes */}
                    {hasKeyDrop && keyDropAction.notes && (
                      <div className="mt-1 text-[10px] font-bold" style={{ color: phase.color }}>
                        {keyDropAction.notes}
                      </div>
                    )}
                    {/* Featured artist — only if the key drop is a collab */}
                    {hasKeyDrop && keyDropAction.featuredArtist && (
                      <div className="mt-0.5 text-[10px] font-semibold text-gray-400">
                        ft. {keyDropAction.featuredArtist}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Drop Windows */}
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

              {/* Hero moment */}
              {heroAction && (
                <div className="mb-3">
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

              {/* Shorts cluster */}
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

              {/* Support stack */}
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

              {/* Action tiles — instant creation, active types highlighted */}
              <ActionTileGrid weekNum={week.week} startDate={plan.startDate} onAdd={onAddAction} weekActions={weekActions} />
            </div>
          );
        })}
      </div>
    </div>
  );
}


function loadPlan(): CampaignPlan {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw) as CampaignPlan;
    } catch { /* ignore */ }
  }
  return makeSeedData();
}

export default function YouTubeCampaignCoach() {
  const [plan, setPlan] = useState<CampaignPlan>(() => loadPlan());
  const [expandedPhases, setExpandedPhases] = useState<Set<PhaseName>>(() => {
    const seed = makeSeedData();
    const activeIdx = Math.max(0, getActiveWeekIdx(seed.weeks));
    const phase = getPhaseForWeek(seed.weeks[activeIdx]?.week ?? 1);
    const s = new Set<PhaseName>();
    CAMPAIGN_PHASES.forEach(p => s.add(p.name));
    return s;
  });
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
    <div style={{ background: '#faf8f6' }} className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Campaign Timeline — header + status + phase rail */}
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
        />

        {/* Metric Cards */}
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
            onAddAction={addAction}
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
