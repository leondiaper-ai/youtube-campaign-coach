import { NextRequest, NextResponse } from 'next/server';
import { writeChannelMapping, writeLiveSnap, readLiveSnap } from '@/lib/kvCache';
import { fetchChannelSnapLite } from '@/lib/youtube';
import { safeMergeSnap } from '@/lib/youtube/normalizeChannelData';
import { loadPlan, savePlan } from '@/lib/planStore';
import { deriveFromLive } from '@/lib/artists';
import type { ChannelContext } from '@/lib/planEngine';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/fix-channel
 *
 * Surgical fix for a channel mapping that points to the wrong YouTube channel.
 *
 * Body:
 *   handle    — the artist's YouTube handle (e.g. "@OriginalKoffee")
 *   channelId — correct YouTube channel ID (e.g. "UCUUNMri9GAoH2PiXCQJ6aWw")
 *   planSlug? — optional: also refresh the saved plan's channelCtx
 *   refresh?  — if true (default), fetch fresh data from YouTube for the channel
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { handle, channelId, planSlug, refresh = true } = body as {
      handle: string;
      channelId: string;
      planSlug?: string;
      refresh?: boolean;
    };

    if (!handle || !channelId) {
      return NextResponse.json(
        { error: 'handle and channelId are required' },
        { status: 400 },
      );
    }

    const results: Record<string, unknown> = {};

    // 1. Fix the channel mapping
    await writeChannelMapping(handle, channelId);
    results.mapping = { handle, channelId, status: 'written' };

    // 2. Optionally fetch fresh data from YouTube
    if (refresh) {
      try {
        const snap = await fetchChannelSnapLite(channelId);
        if (snap && !snap.error) {
          const existing = await readLiveSnap(channelId);
          const merged = safeMergeSnap(existing, snap);
          await writeLiveSnap(channelId, merged);
          results.liveSnap = {
            status: 'refreshed',
            subs: snap.subs,
            title: snap.title,
            recentUploads: snap.recentUploads?.length ?? 0,
            lastUploadTitle: snap.recentUploads?.[0]?.title,
          };

          // 3. Optionally update the plan's channelCtx
          if (planSlug && snap) {
            try {
              const saved = await loadPlan(planSlug);
              if (saved) {
                const uploads30d = snap.recentUploads?.filter((u) => {
                  const d = new Date(u.publishedAt);
                  return Date.now() - d.getTime() < 30 * 86400000;
                }).length ?? 0;
                const shorts30d = snap.recentUploads?.filter((u) => {
                  const d = new Date(u.publishedAt);
                  return Date.now() - d.getTime() < 30 * 86400000 && u.durationSec <= 60;
                }).length ?? 0;
                const lastUploadDaysAgo = snap.recentUploads?.[0]
                  ? Math.floor(
                      (Date.now() - new Date(snap.recentUploads[0].publishedAt).getTime()) / 86400000,
                    )
                  : undefined;

                // Derive channel state from the live snap
                const derived = deriveFromLive(snap);
                const state = derived?.status ?? 'BUILDING';

                const channelCtx: ChannelContext = {
                  state,
                  uploads30d,
                  shorts30d,
                  subs: snap.subs ?? undefined,
                  lastUploadDaysAgo,
                };

                await savePlan(
                  saved.slug,
                  saved.artist,
                  saved.plan,
                  channelCtx,
                  saved.timelineText,
                );
                results.planCtx = {
                  slug: planSlug,
                  status: 'updated',
                  uploads30d,
                  shorts30d,
                  lastUploadDaysAgo,
                  state,
                };
              } else {
                results.planCtx = { slug: planSlug, status: 'plan not found' };
              }
            } catch (err) {
              results.planCtx = { slug: planSlug, status: 'error', error: String(err) };
            }
          }
        } else {
          results.liveSnap = { status: 'error', error: snap?.error ?? 'no data' };
        }
      } catch (err) {
        results.liveSnap = { status: 'error', error: String(err) };
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error('POST /api/admin/fix-channel error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
