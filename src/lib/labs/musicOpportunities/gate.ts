/* Labs are preview-only, exactly like the Owned Channels draft: production
   returns 404 for every page and API route even after a merge, and the
   preview relies on the project's existing Vercel Deployment Protection.
   A separate function rather than a re-export so the two sandboxes can be
   gated independently later without touching each other. */
export function labsEnabled() {
  return process.env.VERCEL_ENV === 'preview' ||
    (process.env.NODE_ENV === 'development' && process.env.VERCEL_ENV !== 'production');
}

/** Browser writes must come from the same origin. Never accepts a cross-site POST. */
export function sameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  return !!origin && origin === new URL(req.url).origin;
}
