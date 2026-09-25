/**
 * GET /api/chartmetric/uk-batch?slugs=a,b,c[&budgetMs=40000]
 *
 * The UK Landscape batch. One UK row per Watcher artist, joined to that
 * artist's channel-scale figures, stored durably so the analysis can be
 * rebuilt without spending Chartmetric requests again.
 *
 * WHY IT IS TIME-BUDGETED RATHER THAN A SIMPLE LOOP
 *
 * The Chartmetric client serialises every request behind a 600ms floor
 * because the upstream window is sliding, so 30 artists is roughly 36
 * seconds of deliberate waiting — and this project is on a Vercel plan
 * whose function ceiling is 60s. A single loop over the full list would
 * time out and lose the work it had already paid for.
 *
 * So: process until the budget is spent, persist each row as it lands,
 * return what is done and what is left. The caller calls again with the
 * remainder. Anything already in KV returns instantly and costs nothing,
 * which makes a re-run after a timeout free rather than expensive.
 *
 * Storage: cm:uk:{channelId}, no expiry. These are dated snapshots — the
 * reading date travels with the row — so they are a record rather than a
 * cache, and overwriting them on a schedule is a later decision.
 * &refresh=1 forces a re-fetch of the named slugs.
 *
 * FOUR LAYERS, NEVER MERGED. This route returns Chartmetric UK (layer 2)
 * and channel scale (layer 3). It does not touch consumption (layer 1),
 * and it emits nothing at all about Virgin relationship (layer 4) beyond
 * repeating Watcher's own ownership flag as evidence.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ARTISTS, mergeArtistLists } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { readLiveSnapByHandle } from '@/lib/kvCache';
import { readHistory, deltaOver } from '@/lib/snapshots';
import { chartmetricConfigured } from '@/lib/chartmetric/auth';
import { fetchTerritories, ukRow, type UkRow } from '@/lib/chartmetric/territories';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DEFAULT_BUDGET_MS = 40_000;

type StoredRow = {
  slug: string;
  artistName: string;
  channelId: string;
  channelTitle: string | null;
  handle: string | null;
  /** YouTube auto-generated Topic channel — channel metrics mean something else. */
  isTopicChannel: boolean;
  watcherOwnership: string | null;
  campaignPhase: string | null;

  // LAYER 3 — channel scale. Global, not UK.
  subscribers: number | null;
  lifetimeViews: number | null;
  views7d: number | null;
  uploads30d: number | null;

  // LAYER 2 — Chartmetric UK.
  cmArtistId: number | null;
  cmArtistName: string | null;
  uk: UkRow | null;
  artistMedianChangePct: number | null;
  readingDate: string | null;
  previousDate: string | null;
  windowDays: number | null;
  territoriesReturned: number | null;

  capturedAt: string;
  error?: string;
};

async function kv() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    const { Redis } = await import('@upstash/redis');
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  if (!chartmetricConfigured()) {
    return NextResponse.json({ ok: false, reason: 'not-configured' }, { status: 200 });
  }

  const url = new URL(req.url);
  const slugs = (url.searchParams.get('slugs') ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (slugs.length === 0) {
    return NextResponse.json({ ok: false, reason: 'no-slugs' }, { status: 200 });
  }
  const budgetMs = Math.min(Number(url.searchParams.get('budgetMs')) || DEFAULT_BUDGET_MS, 50_000);
  const refresh = url.searchParams.get('refresh') === '1';

  const started = Date.now();
  const store = await kv();
  const all = mergeArtistLists(ARTISTS, await listCustomArtists());

  const done: StoredRow[] = [];
  const remaining: string[] = [];
  let fetched = 0;
  let served = 0;

  for (const slug of slugs) {
    // Out of time — hand the rest back rather than dying mid-flight.
    if (Date.now() - started > budgetMs) {
      remaining.push(slug);
      continue;
    }

    const artist = all.find((a) => a.slug === slug);
    if (!artist) {
      done.push({
        slug,
        artistName: slug,
        channelId: '',
        channelTitle: null,
        handle: null,
        isTopicChannel: false,
        watcherOwnership: null,
        campaignPhase: null,
        subscribers: null,
        lifetimeViews: null,
        views7d: null,
        uploads30d: null,
        cmArtistId: null,
        cmArtistName: null,
        uk: null,
        artistMedianChangePct: null,
        readingDate: null,
        previousDate: null,
        windowDays: null,
        territoriesReturned: null,
        capturedAt: new Date().toISOString(),
        error: 'unknown-artist',
      });
      continue;
    }

    const snap = artist.channelHandle ? await readLiveSnapByHandle(artist.channelHandle) : null;
    const channelId = snap?.channelId ?? null;
    if (!channelId) {
      done.push({
        slug,
        artistName: artist.name,
        channelId: '',
        channelTitle: snap?.title ?? null,
        handle: artist.channelHandle ?? null,
        isTopicChannel: false,
        watcherOwnership: artist.ownership ?? null,
        campaignPhase: artist.phase ?? null,
        subscribers: snap?.subs ?? null,
        lifetimeViews: snap?.views ?? null,
        views7d: null,
        uploads30d: snap?.uploads30d ?? null,
        cmArtistId: null,
        cmArtistName: null,
        uk: null,
        artistMedianChangePct: null,
        readingDate: null,
        previousDate: null,
        windowDays: null,
        territoriesReturned: null,
        capturedAt: new Date().toISOString(),
        error: 'no-channel-id',
      });
      continue;
    }

    const key = `cm:uk:${channelId}`;
    if (store && !refresh) {
      const hit = (await store.get(key)) as StoredRow | null;
      if (hit) {
        done.push(hit);
        served++;
        continue;
      }
    }

    // Channel scale, from Watcher only. No YouTube API call.
    const history = await readHistory(channelId);
    const v7 = deltaOver(history, 7, 'views');

    const t = await fetchTerritories({ slug: artist.slug, name: artist.name }, channelId);
    fetched++;

    const title = snap?.title ?? null;
    const row: StoredRow = {
      slug: artist.slug,
      artistName: artist.name,
      channelId,
      channelTitle: title,
      handle: artist.channelHandle ?? null,
      isTopicChannel: !!title && / - Topic$/i.test(title),
      watcherOwnership: artist.ownership ?? null,
      campaignPhase: artist.phase ?? null,
      subscribers: snap?.subs ?? null,
      lifetimeViews: snap?.views ?? null,
      views7d: v7 && typeof v7.delta === 'number' ? v7.delta : null,
      uploads30d: snap?.uploads30d ?? null,
      cmArtistId: t.ok ? t.chartmetric.artistId : null,
      cmArtistName: t.ok ? t.chartmetric.artistName : null,
      uk: t.ok ? ukRow(t) : null,
      artistMedianChangePct: t.ok ? t.medianChangePct : null,
      readingDate: t.ok ? t.reportingDate : null,
      previousDate: t.ok ? t.previousDate : null,
      windowDays: t.ok ? t.windowDays : null,
      territoriesReturned: t.ok ? t.countries.length : null,
      capturedAt: new Date().toISOString(),
      ...(t.ok ? {} : { error: t.reason }),
    };

    // Persist only real readings. A transient failure should be retried.
    if (store && t.ok) await store.set(key, row);
    done.push(row);
  }

  return NextResponse.json(
    {
      ok: true,
      asked: slugs.length,
      completed: done.length,
      remaining,
      fetchedFromChartmetric: fetched,
      servedFromStore: served,
      elapsedMs: Date.now() - started,
      rows: done,
    },
    { status: 200 },
  );
}
