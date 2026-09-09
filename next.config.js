/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // The Amyl signing deck is a self-contained static file in /public.
      // This rewrite gives it a clean shareable URL (/amyl) instead of /amyl/index.html.
      { source: '/amyl', destination: '/amyl/index.html' },
      { source: '/kol',  destination: '/kol/index.html' },
      { source: '/chvrches', destination: '/chvrches/index.html' },
      { source: '/ktrap', destination: '/ktrap/index.html' },
      { source: '/palaye', destination: '/palaye/index.html' },
      { source: '/idles', destination: '/idles/index.html' },
      // Living Deep Dive experiment. A DUPLICATE of the Amyl deck — /amyl
      // is already shared with management and must stay byte-identical.
      { source: '/amyl-live', destination: '/amyl-live/index.html' },
      // Subtraction pass on the workspace. Kept alongside /amyl-live
      // rather than replacing it, so the two can be compared directly.
      { source: '/ws', destination: '/ws/index.html' },
      // The living deep dive: the decks' visual language, kept current by
      // Watcher and Grok. Sits alongside /ws and /amyl-live for comparison.
      { source: '/deck', destination: '/deck/index.html' },
      // The synthesis: live cockpit above, the existing K-Trap deep dive
      // below (embedded verbatim from /ktrap, not rebuilt).
      { source: '/ktrap-live', destination: '/ktrap-live/index.html' },
    ];
  },
};
module.exports = nextConfig;
