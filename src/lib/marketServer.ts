import { MARKET_PARAM, resolveMarket, type MarketDef } from './market';

/**
 * Resolve the market for a server component.
 *
 * The URL is the only source. There was a cookie, written by a market
 * dropdown; the dropdown is gone, so the cookie is now unreachable — and a
 * preference nobody can see or change is worse than none at all. A stale one
 * would silently pin someone to a market with no way out.
 *
 * URL-only also makes every page honest when shared: a link shows the
 * recipient exactly what the sender saw, which a cookie would have overridden
 * without either of them noticing.
 *
 * Markets are reached by their own URLs — /weekly-pulse/au/campaign-briefing,
 * or ?market=au on the shared routes.
 */
export async function getMarketFromRequest(
  /**
   * Next 14 hands pages a plain object; Next 15 hands them a promise.
   * Accepting both means this helper does not have to be revisited on the
   * next major, and `await` on a non-promise is a no-op.
   */
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>,
): Promise<MarketDef> {
  const resolved = await searchParams;
  const raw = resolved?.[MARKET_PARAM];
  const fromUrl = Array.isArray(raw) ? raw[0] : raw;
  return resolveMarket(fromUrl ?? null);
}
