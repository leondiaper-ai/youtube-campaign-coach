import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppHeader } from '@/components/ui/AppHeader';
import CampaignBehaviour from '@/components/CampaignBehaviour';
import { getLabelWorkspace } from '@/lib/labels';
import { getArtistsForMarket } from '@/lib/marketScope';

export const revalidate = 600;
export const metadata = { title: 'Channel Behaviour — Label Watcher', robots: { index: false, follow: false } };

export default async function LabelBehaviourPage({ params }: { params: { label: string; slug: string } }) {
  const label = getLabelWorkspace(params.label);
  if (!label || label.slug !== params.label) notFound();
  const artists = await getArtistsForMarket(label.workspaceId);
  const artist = artists.find(a => a.slug === params.slug);
  if (!artist) notFound();
  const mq = '?market=' + label.workspaceId;
  return <div className="min-h-screen bg-paper text-ink">
    <AppHeader workspace={label.name} nav={[
      { href: '/growth' + mq, label: 'Channel Health' },
      { href: '/campaigns' + mq, label: 'Active Campaigns' },
      { href: '/coach' + mq, label: 'Coach' },
    ]} />
    <div className="max-w-[1180px] mx-auto px-6 pt-5">
      <Link href={'/labels/' + label.slug} className="text-sm underline">Back to Channel Health</Link>
    </div>
    <CampaignBehaviour slug={artist.slug} artistName={artist.name} noBreakout />
  </div>;
}
