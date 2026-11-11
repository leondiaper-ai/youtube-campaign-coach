import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppHeader, PageTitle } from '@/components/ui/AppHeader';
import { getLabelWorkspace } from '@/lib/labels';
import { getArtistsForMarket } from '@/lib/marketScope';
import { deepDiveFor } from '@/lib/deepDiveLink';

export const revalidate = 600;

export default async function LabelDeepDivesPage({
  params,
}: {
  params: { label: string };
}) {
  const { label: slug } = params;
  const label = getLabelWorkspace(slug);
  if (!label) notFound();

  const artists = await getArtistsForMarket(label.workspaceId);
  const reports = artists
    .map(artist => ({ artist, report: deepDiveFor(artist.name) }))
    .filter((entry): entry is typeof entry & { report: NonNullable<typeof entry.report> } => entry.report !== null)
    .sort((a, b) => a.artist.name.localeCompare(b.artist.name));

  const mq = `?market=${label.workspaceId}`;
  return (
    <main className="min-h-screen bg-paper text-ink">
      <AppHeader workspace={label.name} nav={[
        { href: `/growth${mq}`, label: 'Channel Health' },
        { href: `/campaigns${mq}`, label: 'Active Campaigns' },
        { href: `/coach${mq}`, label: 'Coach' },
      ]} />
      <div className="max-w-[1180px] mx-auto px-6 pb-16">
        <PageTitle title="Deep Dives" lede="Completed YouTube channel and campaign analysis for artists on this label's roster." />
        <div className="text-sm text-muted mb-5">{reports.length} completed {reports.length === 1 ? 'report' : 'reports'} · {artists.length} tracked artists</div>
        {reports.length === 0 ? (
          <div className="border border-line rounded-lg p-8 text-muted">No completed deep dives are linked to this roster yet. Reports appear here when added to the shared Deep Dive registry.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reports.map(({ artist, report }) => (
              <Link key={artist.slug} href={report.href} className="block rounded-lg border border-line bg-surface p-6 no-underline text-ink hover:border-ink/40 transition-colors">
                <div className="text-xs uppercase tracking-wider text-muted mb-3">YouTube Deep Dive</div>
                <h2 className="text-xl font-bold mb-2">{artist.name}</h2>
                <p className="text-sm text-secondary mb-4">{report.title}</p>
                <div className="flex justify-between text-sm font-semibold">
                  <span>{report.updated ? `Updated ${report.updated}` : 'Completed report'}</span>
                  <span className="text-signal">View deep dive →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
