import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLabelWorkspace } from '@/lib/labels';
import { getArtistsForMarket } from '@/lib/marketScope';
import { AppHeader, PageTitle } from '@/components/ui/AppHeader';

export const revalidate = 600;

export default async function LabelBehaviourIndex({ params }: { params: { label: string } }) {
  const label = getLabelWorkspace(params.label);
  if (!label || label.slug !== params.label) notFound();
  const artists = await getArtistsForMarket(label.workspaceId);
  return (
    <main className="min-h-screen bg-paper text-ink">
      <AppHeader workspace={label.name} nav={[]} />
      <div className="max-w-[1180px] mx-auto px-6">
        <PageTitle title="Channel Behaviour" lede="Explore channel activity and campaign behaviour across your label roster." />
        <div className="bg-surface border border-line rounded-card divide-y divide-line-faint mb-12">
          {artists.length === 0 && <p className="p-5 text-muted">No artists are connected to this label yet.</p>}
          {artists.slice().sort((a, b) => a.name.localeCompare(b.name)).map(artist => (
            <Link key={artist.slug} href={`/labels/${label.slug}/behaviour/${encodeURIComponent(artist.slug)}`}
              className="block px-5 py-3 font-semibold text-ink hover:bg-raised no-underline">
              {artist.name}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
