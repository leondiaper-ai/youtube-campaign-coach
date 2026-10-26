/** Production requires its own access key; previews retain Vercel protection. */
export function ownedChannelsConfigured() {
  return (process.env.OWNED_CHANNELS_SECRET ?? '').length >= 20;
}
export function ownedChannelsEnabled() {
  return process.env.VERCEL_ENV === 'preview' ||
    (process.env.NODE_ENV === 'development' && process.env.VERCEL_ENV !== 'production') ||
    ownedChannelsConfigured();
}
