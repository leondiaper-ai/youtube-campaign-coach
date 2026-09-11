/**
 * WHAT AN ARTIST ACTUALLY NEEDS
 *
 * Two sources, deliberately kept apart and both labelled.
 *
 *   deep_dive  what a person concluded after looking properly. HUMAN.
 *   watcher    what the stored data says right now. DERIVED.
 *
 * They disagree sometimes, and that is useful. A Deep Dive from August
 * saying "the channel is dormant" next to a Watcher signal saying it
 * uploaded last week is exactly the sort of thing a person should see. So
 * needs are merged but never collapsed: each carries where it came from and
 * what it rests on, and a tag claimed by both is returned once with both
 * bases attached.
 *
 * ── WHY THIS IS CHEAP ON PURPOSE ──────────────────────────────────────
 * Derived needs are computed from the cached live snapshot and, when one
 * already exists, a cached catalogue reconstruction. Nothing here fetches.
 * The matcher is called speculatively — by a model exploring, by the world
 * builder, potentially per artist across a roster — and a matcher that
 * costs 4 quota units a call is a matcher nobody can afford to explore with.
 * If no recon is cached, the architecture-shaped needs simply do not appear,
 * and `derivedCoverage` says so rather than implying the artist has none.
 */

import { ARTISTS, mergeArtistLists, type Artist } from '../artists';
import { listCustomArtists } from '../artistStore';
import { readLiveSnapByHandle } from '../kvCache';
import { readRecon } from '../researcher/store';
import { getDeepDive } from './deepDiveStore';
import { DEEP_DIVE_BY_NAME, normaliseName } from './deepDives';
import { listHumanContext } from './humanContext';
import type { ArtistNeeds, NeedTag, DeepDiveContext } from './types';

export interface ResolvedArtist {
  slug: string;
  name: string;
  artist: Artist | null;
  /** How we got here. `name_match` means the slug did not resolve directly. */
  resolvedBy: 'slug' | 'name_match' | 'deep_dive_only' | 'unresolved';
  /** True when the slug exists in a Deep Dive but not on the live roster. */
  rosterMissing: boolean;
}

async function roster(): Promise<Artist[]> {
  return mergeArtistLists(ARTISTS, await listCustomArtists());
}

/**
 * Slug first, then name. The Deep Dive slugs come from hand-built decks and
 * the roster comes from Redis; the two were never reconciled, and silently
 * returning nothing for `kingsofleon` because the roster calls them
 * `kings-of-leon` is the kind of failure that looks like an empty database.
 */
export async function resolveArtist(input: string): Promise<ResolvedArtist> {
  const list = await roster();
  const direct = list.find(a => a.slug === input);
  if (direct) return { slug: direct.slug, name: direct.name, artist: direct, resolvedBy: 'slug', rosterMissing: false };

  const norm = normaliseName(input);
  const byName = list.find(a => normaliseName(a.name) === norm || normaliseName(a.slug) === norm);
  if (byName) return { slug: byName.slug, name: byName.name, artist: byName, resolvedBy: 'name_match', rosterMissing: false };

  /* Not on the roster. If a Deep Dive knows this artist we still have real
     analysis to serve — we just have no live channel data to go with it. */
  const diveSlug = DEEP_DIVE_BY_NAME[norm] ?? input;
  const { dive } = await getDeepDive(diveSlug);
  if (dive) return { slug: dive.artistSlug, name: dive.artistName, artist: null, resolvedBy: 'deep_dive_only', rosterMissing: true };

  return { slug: input, name: input, artist: null, resolvedBy: 'unresolved', rosterMissing: true };
}

/** The Deep Dive for an artist, tolerating a slug that only the deck uses. */
export async function deepDiveFor(input: string): Promise<{ dive: DeepDiveContext | null; source: string | null }> {
  const direct = await getDeepDive(input);
  if (direct.dive) return direct;
  const byName = DEEP_DIVE_BY_NAME[normaliseName(input)];
  if (byName) return getDeepDive(byName);
  return { dive: null, source: null };
}

/* ══ Derived needs ═══════════════════════════════════════════════════ */

const DAY = 86_400_000;

interface DerivedNeed { tag: NeedTag; basis: string }

/**
 * Every threshold here is a judgement and is written where it can be argued
 * with. None of them is a finding: "no upload for 90 days" is a fact about
 * the upload log, and calling it `channel_reactivation` is a label for a
 * situation, not a claim that anything is wrong.
 */
function derivedNeedsFrom(
  snap: { lastUploadAt?: string | null; uploads30d?: number | null; shorts30d?: number | null } | null,
  recon: { moments?: any[] } | null,
): { needs: DerivedNeed[]; coverage: string[] } {
  const needs: DerivedNeed[] = [];
  const coverage: string[] = [];

  if (!snap) {
    coverage.push('No cached channel snapshot — no channel-state needs could be derived.');
  } else {
    const days = snap.lastUploadAt
      ? Math.round((Date.now() - new Date(snap.lastUploadAt).getTime()) / DAY)
      : null;
    if (days == null) {
      coverage.push('Snapshot has no last-upload date — dormancy could not be assessed.');
    } else if (days >= 90) {
      needs.push({ tag: 'channel_reactivation', basis: `${days} days since the last upload (${snap.lastUploadAt}).` });
      needs.push({ tag: 'catalogue_activation', basis: `Nothing new published for ${days} days, so all current viewing is catalogue.` });
    }

    const up = snap.uploads30d ?? 0;
    const sh = snap.shorts30d ?? 0;
    if (up > 0 && sh === up) {
      needs.push({ tag: 'shorts_programme', basis: `All ${up} uploads in the last 30 days were Shorts — no long-form destination was published.` });
    }
  }

  const moments: any[] = Array.isArray(recon?.moments) ? recon!.moments! : [];
  if (!moments.length) {
    coverage.push('No cached catalogue reconstruction — architecture needs (follow-up window, hero continuity) could not be derived. Call reconstruct_catalogue to populate one.');
  } else {
    const recent = moments.slice(-8);
    const withFollowUp = recent.filter(m => m.followUp7to14 === true).length;
    if (recent.length >= 3 && withFollowUp === 0) {
      needs.push({ tag: 'follow_up_7_14', basis: `None of the last ${recent.length} release moments had a long-form asset in the 7-14 day window.` });
    }
    const gaps = recent.map(m => m.daysToNextHero).filter((g: any) => typeof g === 'number') as number[];
    if (gaps.length >= 3) {
      const sorted = [...gaps].sort((a, b) => a - b);
      const med = sorted[Math.floor(sorted.length / 2)];
      if (med >= 45) {
        needs.push({ tag: 'hero_continuity', basis: `Median gap between the last ${gaps.length} heroes is ${med} days.` });
      }
    }
  }

  return { needs, coverage };
}

/* ══ The merged view ═════════════════════════════════════════════════ */

export interface ArtistNeedsDetail extends ArtistNeeds {
  artistName: string;
  resolvedBy: ResolvedArtist['resolvedBy'];
  rosterMissing: boolean;
  /** Plain statements about what could NOT be derived. Never hidden. */
  derivedCoverage: string[];
}

export async function getArtistNeeds(input: string): Promise<ArtistNeedsDetail> {
  const who = await resolveArtist(input);
  const { dive } = await deepDiveFor(who.slug);

  const needs: ArtistNeedsDetail['needs'] = [];
  const seen = new Map<NeedTag, number>();

  const push = (tag: NeedTag, from: string, basis: string, source: 'deep_dive' | 'watcher') => {
    const at = seen.get(tag);
    if (at != null) {
      /* Same situation, second witness. Append rather than overwrite — the
         second basis is often the more current one. */
      needs[at].basis += ` ALSO: ${basis}`;
      return;
    }
    seen.set(tag, needs.length);
    needs.push({ tag, from, basis, source });
  };

  if (dive) {
    for (const p of dive.channelGaps) for (const t of p.needTags) push(t, `Deep Dive gap: ${p.point}`, p.basis, 'deep_dive');
    for (const p of dive.strategicOpportunities) for (const t of p.needTags) push(t, `Deep Dive opportunity: ${p.point}`, p.basis, 'deep_dive');
    for (const p of dive.recommendedCampaignArchitecture) for (const t of p.needTags) push(t, `Deep Dive architecture: ${p.point}`, p.basis, 'deep_dive');
    for (const p of dive.recommendedContentDirections) for (const t of p.needTags) push(t, `Deep Dive direction: ${p.point}`, p.basis, 'deep_dive');
  }

  /* Human context can create a need directly — "the band cannot shoot until
     March" is a constraint that changes which examples are useful. */
  const human = await listHumanContext(who.slug).catch(() => []);
  for (const item of human) {
    if (item.supersededBy) continue;
    for (const t of item.needTags) push(t, `${item.kind}: ${item.text}`, `Stated by ${item.statedBy} on ${item.statedAt}.`, 'deep_dive');
  }

  const snap = who.artist?.channelHandle ? await readLiveSnapByHandle(who.artist.channelHandle).catch(() => null) : null;
  const recon = await readRecon(who.slug).catch(() => null);
  const { needs: derived, coverage } = derivedNeedsFrom(snap as any, recon as any);
  for (const d of derived) push(d.tag, 'Watcher signal', d.basis, 'watcher');

  return {
    artistSlug: who.slug,
    artistName: who.name,
    needs,
    deepDiveMissing: !dive,
    resolvedBy: who.resolvedBy,
    rosterMissing: who.rosterMissing,
    derivedCoverage: coverage,
  };
}
