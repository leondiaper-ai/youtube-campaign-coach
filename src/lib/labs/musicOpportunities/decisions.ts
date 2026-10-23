/* ═══════════════════════════════════════════════════════════════════════
   DECISIONS — THE LEARNING HISTORY

   A decision freezes what was known: the signal, the match and the
   owned-upload figures at that moment. Later refreshes append a new
   reading of the same uploads so the two can be compared at similar
   ages. The record never says the action caused the change; it shows
   the two readings and the days between them.
   ═══════════════════════════════════════════════════════════════════════ */

import { OWNED_CHANNELS } from '@/lib/ownedChannels/channels';
import { readOwnedHistory } from '@/lib/ownedChannels/store';
import { readDecisions, writeDecisions } from './store';
import { ownedEvidence } from './opportunities';
import type { Decision, Opportunity, Stage } from './types';

export type DecisionInput = {
  opportunity: Opportunity; stage: Stage; actualAction?: string | null; notes?: string | null;
  test?: Decision['test'];
};

export function makeDecision(input: DecisionInput, now = new Date().toISOString()): Decision {
  const o = input.opportunity;
  return {
    id: `${now}|${o.id}`.replace(/[^A-Za-z0-9:|#_.-]/g, '-'),
    opportunityId: o.id, recordedAt: now, stage: input.stage,
    suggestedAction: o.action, actualAction: input.actualAction?.trim() || null, notes: input.notes?.trim() || null,
    signal: o.signal,
    matches: o.matches.map(m => ({ kind: m.kind, trackId: m.track.id, title: m.track.title, artist: m.track.artist, videoId: m.track.videoId, channelName: m.track.channelName })),
    ownedUploads: o.ownedUploads,
    test: input.stage === 'consider-paid-test' && input.test ? input.test : null,
    followUps: [],
  };
}

export async function recordDecision(input: DecisionInput): Promise<Decision> {
  const decision = makeDecision(input);
  const list = await readDecisions();
  list.push(decision);
  await writeDecisions(list);
  return decision;
}

/** Append today's owned reading for every upload a decision referenced. Idempotent per day. */
export async function appendFollowUps(): Promise<number> {
  const list = await readDecisions();
  if (!list.length) return 0;
  const channelIds = new Set<string>();
  for (const d of list) for (const u of d.ownedUploads) {
    const def = OWNED_CHANNELS.find(c => c.slug === u.channelSlug);
    if (def) channelIds.add(def.id);
  }
  const histories = new Map<string, Awaited<ReturnType<typeof readOwnedHistory>>>();
  for (const id of Array.from(channelIds)) histories.set(id, await readOwnedHistory(id).catch(() => []));
  let added = 0;
  for (const d of list) for (const u of d.ownedUploads) {
    const def = OWNED_CHANNELS.find(c => c.slug === u.channelSlug);
    const evidence = def ? ownedEvidence(u.videoId, histories.get(def.id) ?? []) : null;
    if (!evidence?.readingAt || evidence.readingAt <= d.recordedAt) continue;
    const day = evidence.readingAt.slice(0, 10);
    if (d.followUps.some(f => f.videoId === u.videoId && f.at.slice(0, 10) === day)) continue;
    d.followUps.push({ at: evidence.readingAt, videoId: u.videoId, views: evidence.views });
    added++;
  }
  if (added) await writeDecisions(list);
  return added;
}
