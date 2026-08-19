/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // The Amyl signing deck is a self-contained static file in /public.
      // This rewrite gives it a clean shareable URL (/amyl) instead of /amyl/index.html.
      { source: '/amyl', destination: '/amyl/index.html' },
    ];
  },
};
module.exports = nextConfig;
