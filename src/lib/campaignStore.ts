// ─────────────────────────────────────────────────────────────────────────────
// Active Campaigns store (KV-backed). Pin/unpin artists into a focused
// campaign workspace. Supports lightweight notes per campaign.
// No-ops gracefully when KV env vars are missing.
// ─────────────────────────────────────────────────────────────────────────────

const PINNED_KEY = 'campaigns:pinned';

export type PinnedCampaign = {
  slug: string;
  pinnedAt: string; // ISO timestamp
  priority?: 'high' | 'normal';
};

export type CampaignNote = {
  id: string;
  text: string;
  tag?: string;
  createdAt: string; // ISO timestamp
};

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

// ── Pinned campaigns ─────────────────────────────────────────────────────

export async function listPinned(): Promise<PinnedCampaign[]> {
  const store = await kv();
  if (!store) return [];
  return ((await store.get(PINNED_KEY)) as PinnedCampaign[] | null) ?? [];
}

export async function pinCampaign(
  slug: string,
  priority: 'high' | 'normal' = 'normal',
): Promise<PinnedCampaign[]> {
  const store = await kv();
  const entry: PinnedCampaign = {
    slug,
    pinnedAt: new Date().toISOString(),
    priority,
  };
  if (!store) return [entry];
  const list = ((await store.get(PINNED_KEY)) as PinnedCampaign[] | null) ?? [];
  // De-dupe
  const next = [...list.filter((p) => p.slug !== slug), entry];
  await store.set(PINNED_KEY, next);
  return next;
}

export async function unpinCampaign(slug: string): Promise<PinnedCampaign[]> {
  const store = await kv();
  if (!store) return [];
  const list = ((await store.get(PINNED_KEY)) as PinnedCampaign[] | null) ?? [];
  const next = list.filter((p) => p.slug !== slug);
  await store.set(PINNED_KEY, next);
  return next;
}

export async function isPinned(slug: string): Promise<boolean> {
  const list = await listPinned();
  return list.some((p) => p.slug === slug);
}

// ── Baseline snapshots ──────────────────────────────────────────────────

export type CampaignBaseline = {
  capturedAt: string;    // ISO timestamp
  subs: number;
  views: number;
  uploads30d: number;
  channelState: string;  // ChannelState at capture time
};

function baselineKey(slug: string) {
  return `campaigns:baseline:${slug}`;
}

export async function saveBaseline(
  slug: string,
  baseline: CampaignBaseline,
): Promise<void> {
  const store = await kv();
  if (!store) return;
  await store.set(baselineKey(slug), baseline);
}

export async function getBaseline(
  slug: string,
): Promise<CampaignBaseline | null> {
  const store = await kv();
  if (!store) return null;
  return ((await store.get(baselineKey(slug))) as CampaignBaseline | null) ?? null;
}

// ── Notes ────────────────────────────────────────────────────────────────

function notesKey(slug: string) {
  return `campaigns:notes:${slug}`;
}

const MAX_NOTES = 50;

export async function listNotes(slug: string): Promise<CampaignNote[]> {
  const store = await kv();
  if (!store) return [];
  return ((await store.get(notesKey(slug))) as CampaignNote[] | null) ?? [];
}

export async function addNote(
  slug: string,
  text: string,
  tag?: string,
): Promise<CampaignNote[]> {
  const store = await kv();
  const note: CampaignNote = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text,
    tag,
    createdAt: new Date().toISOString(),
  };
  if (!store) return [note];
  const list = ((await store.get(notesKey(slug))) as CampaignNote[] | null) ?? [];
  // Newest first, cap at MAX_NOTES
  const next = [note, ...list].slice(0, MAX_NOTES);
  await store.set(notesKey(slug), next);
  return next;
}

export async function deleteNote(
  slug: string,
  noteId: string,
): Promise<CampaignNote[]> {
  const store = await kv();
  if (!store) return [];
  const list = ((await store.get(notesKey(slug))) as CampaignNote[] | null) ?? [];
  const next = list.filter((n) => n.id !== noteId);
  await store.set(notesKey(slug), next);
  return next;
}
