import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

/* Both tailwind.config.ts and globals.css have named Inter since the
   beginning and nothing ever fetched it, so every screen has been
   rendering in the system fallback. Loading it properly is the single
   largest visual change in this pass and costs no layout work.
   `display: swap` keeps first paint immediate; the variable font keeps
   the weight range the interface uses (400–900) in one file. */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

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
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
