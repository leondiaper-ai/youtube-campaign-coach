import Link from 'next/link';
import { LABELS } from '@/lib/labels';
import { AppHeader, PageTitle } from '@/components/ui/AppHeader';
import { MARKETS } from '@/lib/market';

export const metadata = { title: 'Label Workspaces — VMG YouTube' };

export default async function LabelsPage({ searchParams }: { searchParams: Promise<{ market?: string }> }) {
  const query = await searchParams;
  const market = query.market && MARKETS[query.market] ? query.market : 'uk';
  const suffix = `?market=${encodeURIComponent(market)}`;
  const labels = Object.values(LABELS).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <main className="min-h-screen bg-paper text-ink">
      <AppHeader workspace={MARKETS[market].orgName} nav={[
        { href: `/growth${suffix}`, label: 'Channel Health' },
        { href: `/campaigns${suffix}`, label: 'Active Campaigns' },
        { href: `/coach${suffix}`, label: 'Coach' },
        { href: `/labels${suffix}`, label: 'Labels' },
        { href: `/resources${suffix}`, label: 'Resources' },
      ]} />
      <div className="max-w-[1180px] mx-auto px-6 pb-16">
        <PageTitle title="Labels" lede="Dedicated YouTube workspaces for label partners. Choose a label to view its roster, campaigns, plans and deep dives." />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {labels.map(label => (
            <Link key={label.slug} href={`/labels/${label.slug}`} className="flex items-center gap-5 rounded-lg border border-line bg-surface p-6 text-ink no-underline hover:border-ink/40 transition-colors">
              <img src={label.logo} alt="" width={60} height={60} className="h-14 w-14 object-contain shrink-0" />
              <div className="min-w-0">
                <h2 className="font-bold text-xl">{label.name}</h2>
                <p className="text-sm text-muted mt-1">Open YouTube workspace →</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
