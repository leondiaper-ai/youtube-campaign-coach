import { Suspense } from 'react';
import YouTubeCampaignCoach from '@/components/YouTubeCampaignCoach';
import ToolIntro from '@/components/shared/ToolIntro';

export default function Home() {
  return (
    <main className="bg-[#FAF7F2] min-h-screen">
      {/* Editorial intro — bridges landing page → tool */}
      <ToolIntro
        number="03"
        accent="mint"
        name="YouTube Campaign Coach"
        purpose="Structure YouTube planning and campaign execution around release moments — shorts, premieres, uploads, and priority queue."
        inputs={["Release window", "Channel context", "Asset inventory"]}
        outputs={["Posting plan", "Moment mapping", "Priority queue"]}
        ctaLabel="Start planning"
        ctaHref="#tool"
      />

      {/* Existing tool — unchanged core logic */}
      <div id="tool" className="scroll-mt-16">
        <Suspense
          fallback={
            <div className="min-h-[60vh] flex items-center justify-center">
              <p className="text-sm text-black/50">Loading Campaign Coach...</p>
            </div>
          }
        >
          <YouTubeCampaignCoach />
        </Suspense>
      </div>
    </main>
  );
}
