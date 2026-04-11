import { Suspense } from 'react';
import Link from 'next/link';
import YouTubeCampaignCoach from '@/components/YouTubeCampaignCoach';

const SITE_URL = 'https://music-decision-site.vercel.app/';

export const metadata = {
  title: 'YouTube Campaign Coach — App',
  description: 'Plan and track your YouTube rollout around release moments.',
  openGraph: {
    title: 'YouTube Campaign Coach',
    description: 'Plan and track your YouTube rollout around release moments.',
    type: 'website',
    siteName: 'Decision System',
  },
};

export default function ToolAppPage() {
  return (
    <main className="bg-paper min-h-screen">
      {/* Subtle top bar — site mark + tool overview + main site escape */}
      <div className="mx-auto max-w-[1440px] px-6 md:px-10 pt-6 pb-2 flex items-center justify-between gap-4">
        <a
          href={`${SITE_URL}#tools`}
          className="flex items-center gap-2 text-[0.7rem] tracking-[0.18em] uppercase font-semibold text-ink/60 hover:text-ink transition-colors"
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-signal" />
          decision/system_
        </a>
        <div className="flex items-center gap-5">
          <Link
            href="/"
            className="text-[0.7rem] tracking-[0.18em] uppercase font-semibold text-ink/50 hover:text-signal transition-colors"
          >
            ← Overview
          </Link>
          <a
            href={`${SITE_URL}#tools`}
            className="text-[0.7rem] tracking-[0.18em] uppercase font-semibold text-ink/50 hover:text-signal transition-colors"
          >
            All tools ↗
          </a>
        </div>
      </div>

      {/* Actual tool */}
      <Suspense
        fallback={
          <div className="min-h-[60vh] flex items-center justify-center">
            <p className="text-sm text-ink/50">Loading Campaign Coach…</p>
          </div>
        }
      >
        <YouTubeCampaignCoach />
      </Suspense>
    </main>
  );
}
