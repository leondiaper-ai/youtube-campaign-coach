// ─────────────────────────────────────────────────────────────────────────────
// Team Watcher Store (KV-backed)
//
// Stores team-facing campaign metadata ONLY — no YouTube data here.
// YouTube stats come from the shared KV cache (readLiveSnap) at read time.
//
// Primary key: channelId (dedupes across the whole app).
// Each entry also carries an artistSlug for routing/display.
// ─────────────────────────────────────────────────────────────────────────────

/* ── ONE BOARD PER TEAM ───────────────────────────────────────────────
   This was a single global key holding the Nordics board. Australia
   joining made that a bug waiting to happen: a second team would have
   written its campaign names and pins straight over the first team's.

   Keys are now scoped per team. The Nordics board keeps the ORIGINAL
   unscoped key, because it already has live data in it and a rename here
   would silently empty a board somebody is using. New teams get a scoped
   key. The mapping is one function so nothing else has to know. */
const LEGACY_KEY = 'team-watcher:entries';
const DEFAULT_TEAM = 'nordics';

function entriesKey(team: string = DEFAULT_TEAM): string {
  return team === DEFAULT_TEAM ? LEGACY_KEY : `team-watcher:${team}:entries`;
}

// ── Types ────────────────────────────────────────────────────────────────────

export type CampaignState =
  | 'Active'
  | 'Launch Week'
  | 'Building'
  | 'Monitoring'
  | 'Needs Attention'
  | 'Dormant';

export const CAMPAIGN_STATES: CampaignState[] = [
  'Active',
  'Launch Week',
  'Building',
  'Monitoring',
  'Needs Attention',
  'Dormant',
];

export const CAMPAIGN_STATE_STYLE: Record<CampaignState, { bg: string; fg: string }> = {
  'Active':          { bg: '#E6F8EE', fg: '#0C6A3F' },
  'Launch Week':     { bg: '#E0E7FF', fg: '#3730A3' },
  'Building':        { bg: '#FFF5D6', fg: '#7A5A00' },
  'Monitoring':      { bg: '#F3F4F6', fg: '#4B5563' },
  'Needs Attention': { bg: '#FFEAD6', fg: '#8A4A1A' },
  'Dormant':         { bg: '#FFE2D8', fg: '#8A1F0C' },
};

export type TeamNote = {
  id: string;
  text: string;
  createdAt: string; // ISO timestamp
};

export type TeamWatcherEntry = {
  channelId: string;       // primary key — dedupe across the app
  artistSlug: string;      // for routing to /watcher/[slug]
  displayName: string;
  campaignName: string;
  campaignStartDate: string; // ISO date (yyyy-mm-dd) or empty
  campaignState: CampaignState;
  regionTag: string;       // e.g. "UK", "US", "Global"
  teamNotes: TeamNote[];
  pinnedAt: string | null; // ISO timestamp if pinned, null otherwise
  createdAt: string;       // ISO timestamp
  updatedAt: string;       // ISO timestamp
};

// ── KV client ────────────────────────────────────────────────────────────────

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

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function listEntries(team: string = DEFAULT_TEAM): Promise<TeamWatcherEntry[]> {
  const store = await kv();
  if (!store) return [];
  return ((await store.get(entriesKey(team))) as TeamWatcherEntry[] | null) ?? [];
}

async function writeEntries(entries: TeamWatcherEntry[], team: string = DEFAULT_TEAM): Promise<void> {
  const store = await kv();
  if (!store) return;
  await store.set(entriesKey(team), entries);
}

/**
 * Add or update a team watcher entry. Dedupes by channelId.
 * If the channelId already exists, merges fields (new values win).
 */
export async function upsertEntry(
  entry: Omit<TeamWatcherEntry, 'createdAt' | 'updatedAt'>,
  team: string = DEFAULT_TEAM,
): Promise<TeamWatcherEntry[]> {
  const entries = await listEntries(team);
  const now = new Date().toISOString();
  const idx = entries.findIndex((e) => e.channelId === entry.channelId);

  if (idx >= 0) {
    // Merge: new fields win, preserve createdAt
    entries[idx] = {
      ...entries[idx],
      ...entry,
      createdAt: entries[idx].createdAt,
      updatedAt: now,
    };
  } else {
    entries.push({
      ...entry,
      createdAt: now,
      updatedAt: now,
    });
  }

  await writeEntries(entries, team);
  return entries;
}

/**
 * Update specific fields on an existing entry (by channelId).
 */
export async function patchEntry(
  channelId: string,
  patch: Partial<Pick<
    TeamWatcherEntry,
    'campaignName' | 'campaignStartDate' | 'campaignState' | 'regionTag' | 'pinnedAt' | 'displayName'
  >>,
  team: string = DEFAULT_TEAM,
): Promise<TeamWatcherEntry[]> {
  const entries = await listEntries(team);
  const idx = entries.findIndex((e) => e.channelId === channelId);
  if (idx < 0) return entries; // not found — no-op

  entries[idx] = {
    ...entries[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await writeEntries(entries, team);
  return entries;
}

/**
 * Add a note to an entry.
 */
export async function addEntryNote(
  channelId: string,
  text: string,
  team: string = DEFAULT_TEAM,
): Promise<TeamWatcherEntry[]> {
  const entries = await listEntries(team);
  const idx = entries.findIndex((e) => e.channelId === channelId);
  if (idx < 0) return entries;

  const note: TeamNote = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text,
    createdAt: new Date().toISOString(),
  };
  entries[idx].teamNotes = [note, ...entries[idx].teamNotes].slice(0, 30);
  entries[idx].updatedAt = new Date().toISOString();
  await writeEntries(entries, team);
  return entries;
}

/**
 * Delete a note from an entry.
 */
export async function deleteEntryNote(
  channelId: string,
  noteId: string,
  team: string = DEFAULT_TEAM,
): Promise<TeamWatcherEntry[]> {
  const entries = await listEntries(team);
  const idx = entries.findIndex((e) => e.channelId === channelId);
  if (idx < 0) return entries;

  entries[idx].teamNotes = entries[idx].teamNotes.filter((n) => n.id !== noteId);
  entries[idx].updatedAt = new Date().toISOString();
  await writeEntries(entries, team);
  return entries;
}

/**
 * Remove an entry entirely by channelId.
 */
export async function removeEntry(
  channelId: string,
  team: string = DEFAULT_TEAM,
): Promise<TeamWatcherEntry[]> {
  const entries = await listEntries(team);
  const next = entries.filter((e) => e.channelId !== channelId);
  await writeEntries(next, team);
  return next;
}

/**
 * Every team's entries at once, each tagged with the team it came from.
 * Used by the main Watcher to show what the regional boards are tracking
 * without anybody having to open them.
 */
export async function listAllTeamEntries(
  teamSlugs: string[],
): Promise<Array<TeamWatcherEntry & { team: string }>> {
  const lists = await Promise.all(
    teamSlugs.map(async t => (await listEntries(t)).map(e => ({ ...e, team: t }))),
  );
  /* Deduped on channelId: two teams can legitimately watch the same
     channel, and the main Watcher should show it once. First team wins,
     which is stable because the slug order is stable. */
  const seen = new Set<string>();
  return lists.flat().filter(e => {
    if (seen.has(e.channelId)) return false;
    seen.add(e.channelId);
    return true;
  });
}
