import { cookies } from 'next/headers';
import { MARKET_COOKIE, MARKET_PARAM, resolveMarket, type MarketDef } from './market';

/**
 * Resolve the market for a server component.
 *
 * Priority: explicit URL param, then the cookie the switcher writes, then UK.
 *
 * The URL deliberately beats the cookie. A Priority Campaigns link sent to
 * someone must show them what the sender saw — if the cookie won, the
 * Australian team sharing their page with a UK colleague would show that
 * colleague the UK page, and neither of them would notice.
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
  if (fromUrl) return resolveMarket(fromUrl);

  try {
    const jar = await cookies();
    return resolveMarket(jar.get(MARKET_COOKIE)?.value ?? null);
  } catch {
    // cookies() throws in a static render. UK is the right fallback.
    return resolveMarket(null);
  }
}
