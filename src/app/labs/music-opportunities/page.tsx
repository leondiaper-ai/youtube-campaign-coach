import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AppHeader, PageTitle } from '@/components/ui/AppHeader';
import { labsEnabled } from '@/lib/labs/musicOpportunities/gate';
import { labsStore, readAllObservations, readDecisions, readObservationIndex } from '@/lib/labs/musicOpportunities/store';
import { loadCatalogue } from '@/lib/labs/musicOpportunities/catalogue';
import { buildOpportunities, ownedEvidence, unmatchedCount } from '@/lib/labs/musicOpportunities/opportunities';
import { demoOpportunity, DEMO_VIDEO_ID } from '@/lib/labs/musicOpportunities/demo';
import { dataApiConfigured, DEFAULT_REGIONS } from '@/lib/labs/musicOpportunities/sources/dataApi';
import { chartmetricConfigured } from '@/lib/chartmetric/auth';
import { OWNED_CHANNELS } from '@/lib/ownedChannels/channels';
import MusicOpportunitiesBoard from './MusicOpportunitiesBoard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Music Opportunities — Labs', robots: { index: false, follow: false } };

export default async function MusicOpportunitiesPage() {
  if (!labsEnabled()) notFound();
  let readFailed = false;
  const [observations, index, catalogue, decisions] = await Promise.all([
    readAllObservations().catch(() => { readFailed = true; return []; }),
    readObservationIndex().catch(() => []),
    loadCatalogue().catch(() => { readFailed = true; return null; }),
    readDecisions().catch(() => []),
  ]);
  const opportunities = catalogue ? buildOpportunities(observations, catalogue) : [];
  const counts = catalogue ? unmatchedCount(observations, catalogue) : { total: 0, unmatched: 0 };
  const demo = catalogue ? demoOpportunity(catalogue) : null;
  const folk = OWNED_CHANNELS.find(c => c.slug === 'folk-and-nature');
  const demoReading = catalogue && folk ? ownedEvidence(DEMO_VIDEO_ID, catalogue.ownedHistory[folk.id] ?? []) : null;
  const env = {
    storage: !!labsStore(), dataApi: dataApiConfigured(), chartmetric: chartmetricConfigured(), readFailed,
    defaultRegions: [...DEFAULT_REGIONS],
  };
  return (
    <main className="min-h-screen bg-paper text-ink">
      <AppHeader workspace="VMG · Labs" meta={<span className="text-warn font-semibold">Sandbox · protected preview · not in production</span>}
        nav={[
          { href: '/growth', label: 'Channel Health', match: '/labs/music-opportunities' },
          { href: '/campaigns', label: 'Active Campaigns' },
          { href: '/coach', label: 'Coach' },
          { href: '/teams', label: 'Workspaces' },
          { href: '/resources', label: 'Resources' },
        ]} />
      <div className="max-w-[1180px] mx-auto px-6 pb-12">
        <PageTitle title="Music Opportunities" lede="YouTube demand signals, matched to the music that feeds the owned channels. Each line shows the signal, the connection, what we hold, one action and what is still unknown." />
        <Link href="/growth/owned" className="inline-block text-meta font-semibold text-secondary mb-3">← Owned Channels</Link>
        <p className="text-meta text-muted mb-7">Reads the Owned Channels store; writes only to its own namespace. Nothing here publishes, edits YouTube metadata or spends.</p>
        <MusicOpportunitiesBoard
          opportunities={opportunities} counts={counts} index={index} observations={observations.map(o => ({ id: o.id, source: o.source, measure: o.measure, territory: o.territory, period: o.period, periodLabel: o.periodLabel, collectedAt: o.collectedAt, rows: o.entries.length, sourceUrl: o.sourceUrl, note: o.note }))}
          coverage={catalogue?.coverage ?? []} sourceCatalogue={catalogue?.source ?? { present: false, rows: 0, importedAt: null, note: null }}
          decisions={decisions} demo={demo} demoReading={demoReading} env={env} />
        <footer className="mt-10 pt-5 border-t border-line text-meta text-muted flex flex-wrap justify-between gap-3">
          <span>A chart entry alone never justifies spend. Record what was known, then compare like with like.</span>
          <a href="https://support.google.com/youtubemusic/answer/9014376" target="_blank" rel="noopener noreferrer" className="text-secondary font-semibold">How YouTube Charts are defined ↗</a>
        </footer>
      </div>
    </main>
  );
}
