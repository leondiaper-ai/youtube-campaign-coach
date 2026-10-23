import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AppHeader, PageTitle } from '@/components/ui/AppHeader';
import { labsEnabled } from '@/lib/labs/musicOpportunities/gate';
import { labsStore, readAllObservations, readDecisions, readHumanLabels } from '@/lib/labs/musicOpportunities/store';
import { loadCatalogue } from '@/lib/labs/musicOpportunities/catalogue';
import { buildBank, latestRows, persistence } from '@/lib/labs/musicOpportunities/bank';
import { findPatterns, labelCoverage } from '@/lib/labs/musicOpportunities/patterns';
import { buildOpportunities, unmatchedCount } from '@/lib/labs/musicOpportunities/opportunities';
import { contextualMatches } from '@/lib/labs/musicOpportunities/connections';
import { buildFindings } from '@/lib/labs/musicOpportunities/findings';
import { mergeObservations, seedObservations, coverageSummary } from '@/lib/labs/musicOpportunities/sources/youtubeCharts';
import ResearchBoard, { type SongView } from './ResearchBoard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Music Opportunities — Labs', robots: { index: false, follow: false } };

export default async function MusicOpportunitiesPage() {
  if (!labsEnabled()) notFound();
  let readFailed = false;
  const human = await readHumanLabels().catch(() => { readFailed = true; return []; });
  const [stored, catalogue, decisions] = await Promise.all([
    readAllObservations().catch(() => { readFailed = true; return []; }),
    loadCatalogue(human).catch(() => { readFailed = true; return null; }),
    readDecisions().catch(() => []),
  ]);
  const observations = mergeObservations(seedObservations(), stored);
  const bank = buildBank(observations, human);
  const patterns = findPatterns(bank);
  const opportunities = catalogue ? buildOpportunities(observations, catalogue) : [];
  const counts = catalogue ? unmatchedCount(observations, catalogue) : { total: 0, unmatched: 0 };
  const contextual = catalogue ? contextualMatches(patterns, catalogue) : [];
  const findings = buildFindings(bank, patterns, opportunities, contextual);
  const coverage = labelCoverage(bank);
  const series = coverageSummary(observations);

  /* Song records, as the board needs them: latest rows plus persistence, so the reader can inspect the entries behind a finding. */
  const songs: SongView[] = Array.from(bank.songs.values()).map(s => ({
    key: s.key, title: s.title, artists: s.artists, releaseDate: s.releaseDate, labels: s.labels, linkedVideoIds: s.linkedVideoIds,
    persistence: persistence(s.appearances, bank.seriesPeriods),
    appearances: s.appearances.map(a => ({ measure: a.measure, territory: a.territory, period: a.period, rank: a.rank, previousRank: a.previousRank, measureValue: a.measureValue, periodsOnChart: a.periodsOnChart })),
  }));
  const videos = Array.from(bank.videos.values()).map(v => ({ videoId: v.videoId, title: v.title, artists: v.artists, releaseDate: v.releaseDate, labels: v.labels, songKey: v.songKey,
    appearances: v.appearances.map(a => ({ measure: a.measure, territory: a.territory, period: a.period, rank: a.rank, previousRank: a.previousRank, measureValue: a.measureValue, periodsOnChart: a.periodsOnChart })) }));
  const rows = latestRows(bank).length;

  return (
    <main className="min-h-screen bg-paper text-ink">
      <AppHeader workspace="VMG · Labs" meta={<span className="text-warn font-semibold">Research sandbox · protected preview · not in production</span>}
        nav={[
          { href: '/growth', label: 'Channel Health', match: '/labs/music-opportunities' },
          { href: '/campaigns', label: 'Active Campaigns' },
          { href: '/coach', label: 'Coach' },
          { href: '/teams', label: 'Workspaces' },
          { href: '/resources', label: 'Resources' },
        ]} />
      <div className="max-w-[1180px] mx-auto px-6 pb-12">
        <PageTitle title="Music Opportunities" lede="A research bank of YouTube demand evidence, connected to the music that feeds the owned channels and to what those channels achieve. Three questions: what demand are we seeing, which of our music fits, what should we investigate." />
        <Link href="/growth/owned" className="inline-block text-meta font-semibold text-secondary mb-3">← Owned Channels</Link>
        <p className="text-meta text-muted mb-7">Reads the Owned Channels store; writes only to its own namespace. Nothing here publishes, edits YouTube metadata or spends.</p>
        <ResearchBoard
          findings={findings} patterns={patterns} opportunities={opportunities} contextual={contextual} counts={counts}
          observations={observations.map(o => ({ id: o.id, source: o.source, measure: o.measure, territory: o.territory, period: o.period, periodLabel: o.periodLabel, collectedAt: o.collectedAt, rows: o.entries.length, sourceUrl: o.sourceUrl, note: o.note }))}
          series={series} songs={songs} videos={videos} latestRowCount={rows} labelCoverage={coverage}
          coverage={catalogue?.coverage ?? []} sourceCatalogue={catalogue?.source ?? { present: false, rows: 0, importedAt: null, note: null }}
          decisions={decisions} humanLabelCount={human.length}
          env={{ storage: !!labsStore(), dataApi: !!process.env.YOUTUBE_API_KEY, readFailed }} />
        <footer className="mt-10 pt-5 border-t border-line text-meta text-muted flex flex-wrap justify-between gap-3">
          <span>A chart is selected successes. Record what was known, compare like with like, and let repeated readings strengthen or overturn a finding.</span>
          <a href="https://support.google.com/youtubemusic/answer/9014376" target="_blank" rel="noopener noreferrer" className="text-secondary font-semibold">How YouTube Charts are defined ↗</a>
        </footer>
      </div>
    </main>
  );
}
