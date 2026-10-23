/** A draft feature: production is always excluded, even if the branch is merged. */
export function ownedChannelsEnabled() {
  return process.env.VERCEL_ENV === 'preview' ||
    (process.env.NODE_ENV === 'development' && process.env.VERCEL_ENV !== 'production');
}
