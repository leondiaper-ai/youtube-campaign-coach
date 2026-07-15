import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://youtube-campaign-coach.vercel.app'),
  title: {
    default: 'YouTube Campaign Coach — Decision System',
    template: '%s — Decision System',
  },
  description:
    'Plan your YouTube rollout around release moments. Turn weekly activity into a clear next move.',
  openGraph: {
    title: 'YouTube Campaign Coach',
    description:
      'Plan your YouTube rollout around release moments. Turn weekly activity into a clear next move.',
    type: 'website',
    siteName: 'Decision System',
    url: 'https://youtube-campaign-coach.vercel.app',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'YouTube Campaign Coach',
    description:
      'Plan your YouTube rollout around release moments. Turn weekly activity into a clear next move.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper text-ink">{children}</body>
    </html>
  );
}
