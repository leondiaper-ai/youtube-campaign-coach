import { Suspense } from 'react';
import YouTubeCampaignCoach from '@/components/YouTubeCampaignCoach';

export default function Home() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#faf8f6' }}>
          <p style={{ fontSize: 14, color: '#999' }}>Loading Campaign Coach...</p>
        </div>
      }
    >
      <YouTubeCampaignCoach />
    </Suspense>
  );
}
