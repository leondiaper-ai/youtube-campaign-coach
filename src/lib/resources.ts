/**
 * The resource index.
 *
 * This is a hand-maintained list rather than a directory scan. A scan would pick
 * up every superseded draft on disk (V7 through V11 of the same deck) and bury
 * the current version among them — the point of this page is to answer "where is
 * the latest X", which a raw file listing actively works against.
 *
 * Adding something new: drop the file in /public/resources and add a row here.
 * `kind` drives the badge; `href` may be an internal route, a hosted deck, or a
 * file path under /resources.
 */

export type ResourceKind = 'Deck' | 'Report' | 'Data' | 'Page';

export interface Resource {
  title: string;
  /** One line on what it actually contains — not a restatement of the title. */
  blurb: string;
  href: string;
  kind: ResourceKind;
  /** Shown as-is. Month precision is enough and ages more gracefully. */
  updated: string;
  /** Downloads rather than navigates. Set for anything under /resources. */
  download?: boolean;
  /** Safe to send outside Virgin. Everything else is internal by default. */
  external?: boolean;
  /**
   * Lives on another host. Needs a plain anchor with target/rel — next/link
   * would attempt a client-side route transition and fail on an absolute URL.
   */
  offsite?: boolean;
}

export interface ResourceGroup {
  heading: string;
  note?: string;
  items: Resource[];
}

export const RESOURCE_GROUPS: ResourceGroup[] = [
  {
    heading: 'Artist decks',
    note: 'Built from public YouTube API data. Each one opens in the browser.',
    items: [
      {
        title: 'Kings of Leon',
        blurb:
          'The Mustang campaign reconstructed — what the last album cycle did, and the benchmarks for the next one.',
        href: '/kol',
        kind: 'Deck',
        updated: 'August 2026',
      },
      {
        title: 'CHVRCHES',
        blurb:
          'Screen Violence reviewed and a programming approach for the next album, including the Station idea.',
        href: '/chvrches',
        kind: 'Deck',
        updated: 'August 2026',
      },
      {
        title: 'Amyl and the Sniffers',
        blurb:
          'Channel analysis built for the signing conversation — format mix, cadence and catalogue coverage.',
        href: '/amyl',
        kind: 'Deck',
        updated: 'August 2026',
      },
    ],
  },
  {
    heading: 'Shared with YouTube',
    note: 'Public link. No login, so treat anything added here as visible to anyone holding the URL.',
    items: [
      {
        title: 'Virgin Music × YouTube — one-pager',
        blurb:
          'How the monitoring system works and what it is for. This is the link that gets pasted into email.',
        href: '/system',
        kind: 'Page',
        updated: 'August 2026',
        external: true,
      },
    ],
  },
  {
    heading: 'Market analysis',
    note: 'The Virgin-wide work behind the benchmarks the artist decks quote.',
    items: [
      {
        title: 'YouTube Campaign Observatory',
        blurb:
          'How successful YouTube campaigns are built — 138 channels, 3,554 videos, eight campaigns worth studying. Opens as a live page.',
        href: 'https://youtube-insights-pi.vercel.app/preview.html',
        kind: 'Page',
        updated: 'July 2026',
        offsite: true,
      },
      {
        title: 'YouTube Market Intelligence — V11',
        blurb:
          'The same work as slides, for presenting offline. Supersedes V7 to V10.',
        href: '/resources/V11_YouTube_Market_Intelligence.pptx',
        kind: 'Deck',
        updated: 'July 2026',
        download: true,
      },
      {
        title: 'Campaign Intelligence report',
        blurb:
          'Written analysis behind the deck — findings with the evidence and confidence level for each.',
        href: '/resources/YouTube_Campaign_Intelligence.docx',
        kind: 'Report',
        updated: 'June 2026',
        download: true,
      },
      {
        title: 'Final Benchmark Library',
        blurb:
          'Every benchmark in one place, with the campaigns each was derived from.',
        href: '/resources/Final_Benchmark_Library.docx',
        kind: 'Report',
        updated: 'June 2026',
        download: true,
      },
      {
        title: 'Channel Behaviour Analysis',
        blurb:
          'How channels move between health states, and what activity precedes a change.',
        href: '/resources/YouTube_Channel_Behaviour_Analysis.docx',
        kind: 'Report',
        updated: 'June 2026',
        download: true,
      },
      {
        title: 'Behaviour Change Analysis',
        blurb:
          'The follow-up window work — what happens in the days after a release lands.',
        href: '/resources/Behaviour_Change_Analysis.docx',
        kind: 'Report',
        updated: 'June 2026',
        download: true,
      },
    ],
  },
  {
    heading: 'Method and source data',
    note: 'Read these before quoting a number in a meeting where someone will push back.',
    items: [
      {
        title: 'Insights Methodology',
        blurb:
          'How campaigns are bounded, how formats are classified, and what each metric does and does not mean.',
        href: '/resources/YouTube_Insights_Methodology.docx',
        kind: 'Report',
        updated: 'June 2026',
        download: true,
      },
      {
        title: 'Insights Audit Pack',
        blurb:
          'The underlying figures as a spreadsheet, so any headline number can be traced back to its source.',
        href: '/resources/YouTube_Insights_Audit_Pack.xlsx',
        kind: 'Data',
        updated: 'June 2026',
        download: true,
      },
      {
        title: 'API Tools Reference',
        blurb:
          'What each endpoint in this system returns, and the limits of public API data versus Studio.',
        href: '/resources/YouTube_API_Tools_Reference.docx',
        kind: 'Report',
        updated: 'July 2026',
        download: true,
      },
    ],
  },
];
