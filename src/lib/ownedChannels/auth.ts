import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';
import { ownedChannelsConfigured } from './gate';

const COOKIE = 'owned_session';
function signature(expiry: number) {
  return createHmac('sha256', process.env.OWNED_CHANNELS_SECRET ?? '').update(`owned-v1:${expiry}`).digest('hex');
}
function equal(a: string, b: string) {
  const digest = (s: string) => createHmac('sha256', 'owned-compare').update(s).digest();
  return timingSafeEqual(digest(a), digest(b));
}
export function verifyOwnedSecret(value: unknown) {
  return ownedChannelsConfigured() && typeof value === 'string' && equal(value, process.env.OWNED_CHANNELS_SECRET!);
}
export function validOwnedSession(value: string, now = Date.now()) {
  if (!ownedChannelsConfigured()) return false;
  const [expiryRaw, mac] = value.split('.');
  const expiry = Number(expiryRaw);
  return Number.isSafeInteger(expiry) && expiry > now && expiry <= now + 12 * 3600000 && equal(mac ?? '', signature(expiry));
}
export function ownedSessionCookie() {
  const expiry = Date.now() + 12 * 3600000;
  return { name: COOKIE, value: `${expiry}.${signature(expiry)}`, httpOnly: true,
    secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 12 * 3600 };
}
export async function ownedAuthorised() {
  if (process.env.VERCEL_ENV === 'preview' || (process.env.NODE_ENV === 'development' && process.env.VERCEL_ENV !== 'production')) return true;
  return validOwnedSession(cookies().get(COOKIE)?.value ?? '');
}
