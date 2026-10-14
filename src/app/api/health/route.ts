import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 *
 * Reports whether the data layer (Upstash/KV Redis) is reachable, and if
 * not, WHY — the one thing the Next.js "server-side exception" page hides.
 * Every page that reads channel data goes through the same client, so if
 * this is red, the Watcher and Campaigns are down with it.
 *
 * Never echoes the URL or token; only which env vars are set, and the
 * error class + message the Redis client threw.
 */
export async function GET() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

  const env = {
    UPSTASH_REDIS_REST_URL: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    UPSTASH_REDIS_REST_TOKEN: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
    KV_REST_API_URL: Boolean(process.env.KV_REST_API_URL),
    KV_REST_API_TOKEN: Boolean(process.env.KV_REST_API_TOKEN),
    YOUTUBE_API_KEY: Boolean(process.env.YOUTUBE_API_KEY),
    // Host only, so a wrong/stale endpoint is visible without leaking the id.
    redisHost: url ? safeHost(url) : null,
  };

  if (!url || !token) {
    return NextResponse.json(
      { ok: false, kv: 'unconfigured', env, checkedAt: new Date().toISOString() },
      { status: 503 },
    );
  }

  const started = Date.now();
  try {
    const { Redis } = await import('@upstash/redis');
    const store = new Redis({ url, token });
    const pong = await store.ping();
    const syncMeta = (await store.get('sync:meta')) as { lastSyncAt?: string; status?: string } | null;
    return NextResponse.json({
      ok: true,
      kv: 'reachable',
      ping: pong,
      latencyMs: Date.now() - started,
      lastSyncAt: syncMeta?.lastSyncAt ?? null,
      lastSyncStatus: syncMeta?.status ?? null,
      env,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    const e = err as { name?: string; message?: string; status?: number };
    return NextResponse.json(
      {
        ok: false,
        kv: 'error',
        error: { name: e?.name ?? 'Error', message: e?.message ?? String(err), status: e?.status ?? null },
        latencyMs: Date.now() - started,
        env,
        checkedAt: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}

function safeHost(u: string): string | null {
  try {
    return new URL(u).host;
  } catch {
    return 'invalid-url';
  }
}
