import { Suspense } from 'react';
import Link from 'next/link';
import YouTubeCampaignCoach from '@/components/YouTubeCampaignCoach';

export const metadata = {
  title: 'YouTube Campaign Coach — App',
  description: 'Plan and track your YouTube rollout around release moments.',
};

export default function ToolAppPage() {
  return (
    <main className="bg-paper min-h-screen">
      {/* Subtle top bar — back link only, no editorial framing */}
      <div className="mx-auto max-w-[1440px] px-6 md:px-10 pt-6 pb-2">
        <Link
          href="/"
          className="text-[0.72rem] tracking-[0.18em] uppercase font-semibold text-ink/50 hover:text-signal transition-colors"
        >
          ← Back to overview
        </Link>
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
