'use client';

/* One workspace navigation controls every board view. View URLs are
   shareable, preserve the team's key and follow browser back/forward. */

import {
  createContext, useContext, useState, useEffect, type ReactNode,
} from 'react';
import dynamic from 'next/dynamic';
import { AppHeader } from '@/components/ui/AppHeader';
import { regionalWorkspaceNav, readTeamBoardView, type TeamBoardView } from '@/lib/workspaceNavigation';

const CampaignBehaviour = dynamic(() => import('./CampaignBehaviour'), {
  ssr: false,
  loading: () => (
    <div className="px-6 py-16 text-[12px] text-ink/35 text-center">
      Loading channel behaviour…
    </div>
  ),
});

const PAPER = '#FAF7F2';
const INK = '#0E0E0E';

/** One pinned artist, as the behaviour rail needs them. */
export type BehaviourRailArtist = {
  slug: string;
  name: string;
  thumbnail?: string;
  status: string;
};

/* Null when no shell is present, so a card can fall back rather than
   throw if it is ever rendered somewhere else. */
const OpenBehaviourContext = createContext<((slug: string) => void) | null>(null);

export function useOpenBehaviour() {
  return useContext(OpenBehaviourContext);
}

type Tab = TeamBoardView;

const TAB_BLURB: Record<Tab, string> = {
  all:       'Every channel this team is watching',
  priority:  'Pinned artists — the ones this team is working right now',
  behaviour: 'What a pinned channel has actually been publishing, and what moved after it',
  tools:     'Things this board can build for you, and what each one is for',
};

const STATUS_DOT: Record<string, string> = {
  HEALTHY: '#1FBE7A',
  'WEAK CONVERSION': '#F08A3C',
  BUILDING: '#2C25FF',
  'AT RISK': '#FF4A1C',
  COLD: '#8A847A',
};

export default function TeamBoardShell({
  header, allTab, priorityTab, allCount, priorityCount, rail, emptyPriority, toolsTab, teamName, marketId,
}: {
  /** The board's title block. */
  header: ReactNode;
  teamName: string;
  marketId: string;
  allTab: ReactNode;
  priorityTab: ReactNode;
  allCount: number;
  priorityCount: number;
  /** The pinned artists, for the rail beside the chart. */
  rail: BehaviourRailArtist[];
  /** Shown in the Priority tab when nothing is pinned yet. */
  emptyPriority: ReactNode;
  /** The Tools tab: what this board can build, each with a line saying why. */
  toolsTab: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>('all');
  const [behaviourSlug, setBehaviourSlug] = useState<string | null>(null);

  useEffect(() => {
    const syncView = () => {
      const params = new URLSearchParams(window.location.search);
      setTab(readTeamBoardView(params));
      setBehaviourSlug(params.get('behaviour'));
    };
    syncView();
    window.addEventListener('popstate', syncView);
    return () => window.removeEventListener('popstate', syncView);
  }, []);

  const navigate = (next: Tab, slug?: string) => {
    const url = new URL(window.location.href);
    url.searchParams.delete('behaviour');
    url.searchParams.delete('view');
    if (next !== 'all') url.searchParams.set('view', next);
    if (next === 'behaviour' && slug) url.searchParams.set('behaviour', slug);
    if (url.href !== window.location.href) window.history.pushState(null, '', url.href);
    setBehaviourSlug(next === 'behaviour' ? slug ?? null : null);
    setTab(next);
  };
  const open = (slug: string) => navigate('behaviour', slug);
  const leaveBehaviour = (next: Tab) => navigate(next);

  const navigation = (regionalWorkspaceNav(marketId) ?? []).map(item => ({
    ...item,
    ...(item.view ? {
      active: tab === item.view,
      label: item.view === 'all' ? `Artists (${allCount})`
        : item.view === 'priority' ? `Priority (${priorityCount})` : item.label,
      onNavigate: () => navigate(item.view!),
    } : {}),
  }));
  const appHeader = <AppHeader
    workspace={marketId === 'au' ? 'Virgin Music Australia' : teamName.replace(/ — Campaign Board$/, '')}
    nav={navigation}
  />;

  /* Default to the first pinned artist, so opening the tab shows
     something rather than asking the reader to pick before they know
     what is in there. */
  const current = rail.find(a => a.slug === behaviourSlug) ?? rail[0] ?? null;

  /* Activity keeps the workspace navigation above the full-width chart. */
  if (tab === 'behaviour' && current) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', minHeight: '100vh',
        background: PAPER, color: INK,
      }}>
        {appHeader}

        <div style={{ display: 'flex', flex: 1 }}>
          <div style={{
            width: 72, minWidth: 72, background: '#1A1A1A', display: 'flex',
            flexDirection: 'column', alignItems: 'center', paddingTop: 16,
            paddingBottom: 16, gap: 6, overflowY: 'auto', position: 'sticky',
            top: 0, height: 'calc(100dvh - 104px)',
            borderRight: '1px solid rgba(255,255,255,0.06)',
          }}>
            <button
              onClick={() => leaveBehaviour('priority')}
              title="Back to board"
              style={{
                width: 42, height: 42, borderRadius: '50%', border: 'none',
                background: 'rgba(255,255,255,0.06)', color: 'rgba(250,247,242,0.7)',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 18, marginBottom: 10, flexShrink: 0,
              }}
            >
              &#x2190;
            </button>

            {rail.map((a) => {
              const isActive = a.slug === current.slug;
              const initials = a.name.split(/\s+/).map(w => w[0]).join('')
                .substring(0, 2).toUpperCase();
              return (
                <button
                  key={a.slug}
                  onClick={() => open(a.slug)}
                  title={a.name}
                  style={{
                    width: 42, height: 42, borderRadius: '50%',
                    border: isActive ? '2.5px solid #FAF7F2' : '2.5px solid transparent',
                    background: a.thumbnail ? 'transparent'
                      : (isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'),
                    color: isActive ? '#FAF7F2' : 'rgba(250,247,242,0.5)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 11, fontWeight: 700,
                    position: 'relative', flexShrink: 0, padding: 0,
                    overflow: 'hidden', opacity: isActive ? 1 : 0.7,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {a.thumbnail ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={a.thumbnail} alt={a.name}
                         style={{ width: '100%', height: '100%', objectFit: 'cover',
                                  borderRadius: '50%' }} />
                  ) : initials}
                  <span style={{
                    position: 'absolute', bottom: 0, right: 0, width: 10, height: 10,
                    borderRadius: '50%', background: STATUS_DOT[a.status] ?? '#8A847A',
                    border: '2px solid #1A1A1A',
                  }} />
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <CampaignBehaviour
              key={current.slug}
              slug={current.slug}
              artistName={current.name}
              onClose={() => leaveBehaviour('priority')}
              noBreakout
            />
          </div>
        </div>
      </div>
    );
  }

  /* Behaviour with nothing pinned: say so on the board rather than
     opening an empty room. */
  if (tab === 'behaviour' && !current) {
    return (
      <main className="min-h-screen" style={{ background: PAPER, color: INK }}>
        {appHeader}
        <div className="max-w-[1080px] mx-auto px-6 py-10 text-center">
          <p className="text-[13px] text-ink/45 max-w-[420px] mx-auto mb-4 mt-16">
            Behaviour follows the pins. Pin an artist and their upload
            timeline, formats and follow-up window appear here.
          </p>
          <button
            onClick={() => leaveBehaviour('all')}
            className="text-[11px] uppercase tracking-[0.18em] text-ink/55 hover:text-ink"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            &larr; Board
          </button>
        </div>
      </main>
    );
  }

  /* ─── THE BOARD ─────────────────────────────────────────────────── */
  return (
    <main className="min-h-screen bg-paper text-ink">
    {appHeader}
    <div className="max-w-[1180px] mx-auto px-6 py-8">
    <OpenBehaviourContext.Provider value={open}>
      {header}
      <div className="text-sm text-muted mb-5">
        {TAB_BLURB[tab]}
      </div>

      {/* The first two stay mounted. Switching tabs should not re-run the
          table's sort and search, or lose a half-typed note on a card. */}
      <div hidden={tab !== 'all'}>{allTab}</div>
      <div hidden={tab !== 'priority'}>
        {priorityCount > 0 ? priorityTab : emptyPriority}
      </div>
      {/* Rendered only when open. Unlike the two boards above it holds no
          typed-in state to lose, and nothing in it needs to be warm. */}
      {tab === 'tools' && toolsTab}

    </OpenBehaviourContext.Provider>
    </div>
    </main>
  );
}
