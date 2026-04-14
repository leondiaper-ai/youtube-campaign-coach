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
        purpose="Decide what to do on YouTube this week. Reads channel activity, places it on the narrative, and tells you the next move."
        inputs={["Channel activity", "Cadence targets", "Release calendar"]}
        outputs={["Channel signal", "This week's call", "Execution gaps"]}
        ctaLabel="Read the signal"
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
