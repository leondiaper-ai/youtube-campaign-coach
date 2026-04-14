import { Suspense } from 'react';
import YouTubeCampaignCoach from '@/components/YouTubeCampaignCoach';

export const metadata = {
  title: 'YouTube Campaign Coach',
  description: 'Plan and track your YouTube rollout around release moments.',
};

export default function ToolAppPage() {
  return (
    <main className="bg-paper min-h-screen">
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
