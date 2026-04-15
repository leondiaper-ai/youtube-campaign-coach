import CampaignCockpit from '@/components/CampaignCockpit';

export const metadata = {
  title: 'Campaign Readiness Cockpit',
  description: 'Selected artists, live checks, and next actions.',
};

export default function CockpitPage() {
  return (
    <main className="bg-paper min-h-screen">
      <CampaignCockpit />
    </main>
  );
}
