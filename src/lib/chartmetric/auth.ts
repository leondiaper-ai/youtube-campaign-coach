/* ═══════════════════════════════════════════════════════════════════
   CHARTMETRIC — ACCESS TOKEN

   The only file in the codebase that reads CHARTMETRIC_REFRESH_TOKEN.
   Nothing here is ever returned to a caller: the refresh token stays in
   this module, and the access token it mints goes out through
   client.ts as an Authorization header and nowhere else. Errors are
   logged by status code, never by body, because a 400 from /api/token
   is the one response most likely to quote what you sent it.

   Two tokens, per Chartmetric's documented model:

     refresh token   long-lived, environment only
     access token    1 hour, minted from the refresh token

   Their docs are explicit — "Reuse the same access token until it
   expires. Do not call /api/token per request." So this caches at
   module level with an absolute expiry and refreshes 60s early.

   The in-flight promise matters more than it looks. A cold serverless
   instance serving three concurrent artist pages would otherwise mint
   three tokens in the same second, which is both wasteful and three
   requests against a 2/sec sliding window before any real work starts.
   ═══════════════════════════════════════════════════════════════════ */

export const CHARTMETRIC_HOST = 'https://api.chartmetric.com';

/** Refresh this many ms before the stated expiry. */
const EXPIRY_BUFFER_MS = 60_000;

let cachedToken: string | null = null;
let cachedExpiresAt = 0;
let inFlight: Promise<string> | null = null;

/** Is Chartmetric configured at all? Absence is a no-op, not an error. */
export function chartmetricConfigured(): boolean {
  return !!process.env.CHARTMETRIC_REFRESH_TOKEN;
}

export class ChartmetricAuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ChartmetricAuthError';
  }
}

async function mint(): Promise<string> {
  const refresh = process.env.CHARTMETRIC_REFRESH_TOKEN;
  if (!refresh) {
    throw new ChartmetricAuthError(0, 'CHARTMETRIC_REFRESH_TOKEN is not set');
  }

  const res = await fetch(`${CHARTMETRIC_HOST}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshtoken: refresh }),
    cache: 'no-store',
  });

  if (!res.ok) {
    // Status only. The body of a token failure can echo the credential.
    throw new ChartmetricAuthError(
      res.status,
      `Chartmetric token exchange failed with ${res.status}`,
    );
  }

  const body = (await res.json()) as { token?: string; expires_in?: number };
  if (!body?.token) {
    throw new ChartmetricAuthError(res.status, 'Chartmetric token response had no token');
  }

  cachedToken = body.token;
  // expires_in is documented as 3600. Trust it, but survive its absence.
  const ttl = Number.isFinite(body.expires_in) ? Number(body.expires_in) * 1000 : 3_600_000;
  cachedExpiresAt = Date.now() + ttl;
  return cachedToken;
}

/**
 * The cached access token, minting one if needed.
 * `force` discards the cache — used once, after a 401, by client.ts.
 */
export async function accessToken(force = false): Promise<string> {
  if (!force && cachedToken && Date.now() < cachedExpiresAt - EXPIRY_BUFFER_MS) {
    return cachedToken;
  }
  if (force) {
    cachedToken = null;
    cachedExpiresAt = 0;
  }
  if (inFlight) return inFlight;

  inFlight = mint().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Diagnostics for the inspection route. Never includes token material. */
export function tokenState() {
  return {
    configured: chartmetricConfigured(),
    haveCachedToken: !!cachedToken,
    expiresInSeconds: cachedToken ? Math.round((cachedExpiresAt - Date.now()) / 1000) : null,
  };
}
