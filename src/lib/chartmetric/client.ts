/* ═══════════════════════════════════════════════════════════════════
   CHARTMETRIC — THE CLIENT

   One function, cmFetch(path). Everything that talks to Chartmetric
   goes through it, for the same reason everything that talks to
   YouTube goes through youtube.ts: so the pacing, the retry and the
   failure cooldown exist once.

   Why a serial queue rather than a concurrency pool. Chartmetric meters
   on a SLIDING window — it starts at the first request and slides
   request-by-request, so three calls inside one second breach a 2/sec
   cap even though a clock-aligned view would see them as fine. Their
   own docs say spacing beats batching. A pool paced by count would
   still burst; a queue paced by time cannot.

   MIN_GAP_MS is the floor between any two requests. It is raised
   automatically if a response tells us the plan is tighter than we
   assumed — we read X-RateLimit-Limit rather than trusting the 2/sec
   we were told, because the header is the only thing that actually
   knows.
   ═══════════════════════════════════════════════════════════════════ */

import { CHARTMETRIC_HOST, accessToken, chartmetricConfigured } from './auth';

/** Assumed trial ceiling: 2 req/sec. 600ms leaves headroom inside it. */
let minGapMs = 600;
let lastRequestAt = 0;
let chain: Promise<unknown> = Promise.resolve();

/** After this many consecutive failures, stop trying for a while. */
const FAILURE_LIMIT = 3;
const COOLDOWN_MS = 5 * 60 * 1000;
let consecutiveFailures = 0;
let coolingUntil = 0;

export type RateLimitState = {
  limit: number | null;
  remaining: number | null;
  reset: number | null;
};

let lastRateLimit: RateLimitState = { limit: null, remaining: null, reset: null };

export type CmResult<T> =
  | { ok: true; data: T; status: number; rateLimit: RateLimitState }
  | { ok: false; status: number; reason: string; rateLimit: RateLimitState };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function num(raw: string | null): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function readRateLimit(res: Response): RateLimitState {
  const state: RateLimitState = {
    limit: num(res.headers.get('X-RateLimit-Limit')),
    remaining: num(res.headers.get('X-RateLimit-Remaining')),
    reset: num(res.headers.get('X-RateLimit-Reset')),
  };
  lastRateLimit = state;

  // Believe the header over our assumption. A 1/sec plan needs a 1s gap.
  if (state.limit && state.limit > 0) {
    const required = Math.ceil(1000 / state.limit) + 100;
    if (required > minGapMs) minGapMs = required;
  }
  return state;
}

/** Wait out the minimum gap since the previous request. */
async function pace() {
  const wait = lastRequestAt + minGapMs - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

async function once(path: string, token: string): Promise<Response> {
  await pace();
  return fetch(`${CHARTMETRIC_HOST}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
}

async function run<T>(path: string): Promise<CmResult<T>> {
  if (!chartmetricConfigured()) {
    return { ok: false, status: 0, reason: 'not-configured', rateLimit: lastRateLimit };
  }
  if (Date.now() < coolingUntil) {
    return { ok: false, status: 0, reason: 'cooling-down', rateLimit: lastRateLimit };
  }

  try {
    let token = await accessToken();
    let res = await once(path, token);

    // 401 — the documented expiry path. Re-mint and retry exactly once.
    if (res.status === 401) {
      token = await accessToken(true);
      res = await once(path, token);
    }

    // 429 — sleep to the reset they give us, then one retry.
    if (res.status === 429) {
      const state = readRateLimit(res);
      const waitMs = state.reset
        ? Math.max(state.reset * 1000 - Date.now(), 1000) + 250
        : 1500;
      // Never hold a request hostage for longer than a page load tolerates.
      if (waitMs <= 10_000) {
        await sleep(waitMs);
        res = await once(path, token);
      }
    }

    const rateLimit = readRateLimit(res);

    if (!res.ok) {
      consecutiveFailures++;
      if (consecutiveFailures >= FAILURE_LIMIT) coolingUntil = Date.now() + COOLDOWN_MS;
      return { ok: false, status: res.status, reason: `http-${res.status}`, rateLimit };
    }

    consecutiveFailures = 0;
    const data = (await res.json()) as T;
    return { ok: true, data, status: res.status, rateLimit };
  } catch (e) {
    consecutiveFailures++;
    if (consecutiveFailures >= FAILURE_LIMIT) coolingUntil = Date.now() + COOLDOWN_MS;
    return {
      ok: false,
      status: 0,
      reason: e instanceof Error ? e.name : 'fetch-failed',
      rateLimit: lastRateLimit,
    };
  }
}

/**
 * GET a Chartmetric path. Never throws — every failure is a value, so a
 * caller cannot accidentally take a page down by forgetting a try/catch.
 * Calls are serialised through a promise chain, so the pacing above holds
 * even when three components ask at once.
 */
export function cmFetch<T>(path: string): Promise<CmResult<T>> {
  const next = chain.then(() => run<T>(path));
  chain = next.catch(() => undefined);
  return next;
}

/** Diagnostics for the inspection route. */
export function clientState() {
  return {
    minGapMs,
    consecutiveFailures,
    coolingDown: Date.now() < coolingUntil,
    lastRateLimit,
  };
}
