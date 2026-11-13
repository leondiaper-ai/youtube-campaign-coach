import { Redis } from '@upstash/redis';
const KEY = 'youtube-uk:partner-additions';
export async function addPartnerArtist(slug: string): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('Shared roster storage unavailable');
  const redis = new Redis({ url, token });
  await redis.sadd(KEY, slug);
}
export async function listPartnerSlugs(): Promise<string[]> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('Shared roster storage unavailable');
  const redis = new Redis({ url, token });
  return await redis.smembers(KEY);
}

const HIDDEN_KEY = 'youtube-uk:partner-hidden';
export async function listHiddenPartnerSlugs(): Promise<string[]> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('Shared roster storage unavailable');
  return new Redis({ url, token }).smembers(HIDDEN_KEY);
}
export async function hidePartnerArtist(slug: string): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('Shared roster storage unavailable');
  await new Redis({ url, token }).sadd(HIDDEN_KEY, slug);
}
