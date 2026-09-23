'use client';

/* ═══════════════════════════════════════════════════════════════════
   THE TEAM BOARD'S THREE TABS
   ═══════════════════════════════════════════════════════════════════

   ALL ARTISTS — everything the team is watching.

   PRIORITY — the pinned ones. This was a section below the full
   roster, which put what a team had decided was urgent underneath
   everything they had not. A pin is a statement of priority, so it
   earns a tab. The pill toggle is the Watcher's own, so there is no
   second control to learn.

   CHANNEL BEHAVIOUR — what a pinned channel has actually been
   publishing. This used to expand inside a campaign card: a
   full-width chart folded into a card column above a note box. It has
   the tab to itself now, with a rail of the team's other pinned
   artists so you can move between them without going back.

   ── HOW THE PIECES REACH EACH OTHER ────────────────────────────────
   The first two tabs hold server-rendered children, so their props
   were fixed before this component existed and a callback cannot be
   passed down to them. A campaign card's Behaviour button reaches the
   third tab through context instead. Children passed into a client
   component still render inside its tree, so the provider wraps them.

   ?behaviour=<slug> opens the tab directly on one artist. That is how
   the artist page links here, the same way our own artist page links
   to /campaigns?behaviour=<slug>.

   Only the behaviour tab unmounts when you leave it. The chart is the
   heavy part of this page, and there is no reason to hold it — or the
   request behind it — for a reader who never opened the tab.
   ═══════════════════════════════════════════════════════════════════ */

import {
  createContext, useContext, useState, useEffect, type ReactNode,
} from 'react';
import dynamic from 'next/dynamic';

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
const SOFT = '#F6F1E7';
const MUTED = '#E9E2D3';

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

type Tab = 'all' | 'priority' | 'behaviour';
const TABS: Tab[] = ['all', 'priority', 'behaviour'];

const TAB_LABEL: Record<Tab, (n: { all: number; priority: number }) => string> = {
  all:       (n) => `All Artists (${n.all})`,
  priority:  (n) => `Priority (${n.priority})`,
  behaviour: () => 'Channel Behaviour',
};

const TAB_BLURB: Record<Tab, string> = {
  all:       'Every channel this team is watching',
  priority:  'Pinned artists — the ones this team is working right now',
  behaviour: 'What a pinned channel has actually been publishing, and what moved after it',
};

const STATUS_DOT: Record<string, string> = {
  HEALTHY: '#1FBE7A',
  'WEAK CONVERSION': '#F08A3C',
  BUILDING: '#2C25FF',
  'AT RISK': '#FF4A1C',
  COLD: '#8A847A',
};

export default function TeamBoardShell({
  header, allTab, priorityTab, allCount, priorityCount, rail, emptyPriority,
}: {
  /** The board's title block. */
  header: ReactNode;
  allTab: ReactNode;
  priorityTab: ReactNode;
  allCount: number;
  priorityCount: number;
  /** The pinned artists, for the rail beside the chart. */
  rail: BehaviourRailArtist[];
  /** Shown in the Priority tab when nothing is pinned yet. */
  emptyPriority: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>('all');
  const [behaviourSlug, setBehaviourSlug] = useState<string | null>(null);

  /* Read on mount rather than from useSearchParams, which would force
     this subtree into a Suspense boundary for a value that never
     changes after load. */
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('behaviour');
    if (s) {
      setBehaviourSlug(s);
      setTab('behaviour');
    }
  }, []);

  const open = (slug: string) => {
    setBehaviourSlug(slug);
    setTab('behaviour');
    /* So a reload, or a link the reader copies, lands back here. */
    const u = new URL(window.location.href);
    u.searchParams.set('behaviour', slug);
    window.history.replaceState(null, '', u.toString());
  };

  /* Leaving the behaviour tab clears the parameter, so a reload does
     not drop the reader straight back into a chart they navigated away
     from. */
  const leaveBehaviour = (next: Tab) => {
    setTab(next);
    const u = new URL(window.location.href);
    u.searchParams.delete('behaviour');
    window.history.replaceState(null, '', u.toString());
  };

  /* Default to the first pinned artist, so opening the tab shows
     something rather than asking the reader to pick before they know
     what is in there. */
  const current = rail.find(a => a.slug === behaviourSlug) ?? rail[0] ?? null;

  /* ─── THE BOARD ─────────────────────────────────────────────────── */
  return (
    <main className="min-h-screen" style={{ background: PAPER, color: INK }}>
    <div className="max-w-[1080px] mx-auto px-6 py-10">
    <OpenBehaviourContext.Provider value={open}>
      {header}

      <div className="flex items-center gap-1 rounded-lg p-1 mb-2" style={{ background: SOFT }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => (t === 'behaviour' ? setTab(t) : leaveBehaviour(t))}
            className="px-4 py-2 rounded-md text-[12px] font-black uppercase tracking-[0.1em] transition-all"
            style={{
              background: tab === t ? '#FFFFFF' : 'transparent',
              color: tab === t ? INK : 'rgba(14,14,14,0.4)',
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {TAB_LABEL[t]({ all: allCount, priority: priorityCount })}
          </button>
        ))}
      </div>
      <div className="text-[10px] text-ink/35 mb-5 pl-1">
        {TAB_BLURB[tab]}
      </div>

      {/* The first two stay mounted. Switching tabs should not re-run the
          table's sort and search, or lose a half-typed note on a card. */}
      <div hidden={tab !== 'all'}>{allTab}</div>
      <div hidden={tab !== 'priority'}>
        {priorityCount > 0 ? priorityTab : emptyPriority}
      </div>

      {/* ── CHANNEL BEHAVIOUR ──────────────────────────────────────
          Not kept mounted like the other two: the chart is the heavy
          part of this page and there is no reason to hold it, or the
          request behind it, for a reader who never opens the tab. */}
      {tab === 'behaviour' && (
        current ? (
          <div className="flex rounded-2xl overflow-hidden"
               style={{ border: `1px solid ${MUTED}`, background: '#FFFFFF' }}>
            {/* The other pinned artists, one click away. */}
            {rail.length > 1 && (
              <div style={{
                width: 64, minWidth: 64, background: '#1A1A1A', display: 'flex',
                flexDirection: 'column', alignItems: 'center', gap: 6,
                paddingTop: 14, paddingBottom: 14,
              }}>
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
                        width: 40, height: 40, borderRadius: '50%',
                        border: isActive ? '2.5px solid #FAF7F2' : '2.5px solid transparent',
                        background: a.thumbnail ? 'transparent'
                          : (isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'),
                        color: isActive ? '#FAF7F2' : 'rgba(250,247,242,0.5)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 10, fontWeight: 700,
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
                        position: 'absolute', bottom: 0, right: 0, width: 9, height: 9,
                        borderRadius: '50%', background: STATUS_DOT[a.status] ?? '#8A847A',
                        border: '2px solid #1A1A1A',
                      }} />
                    </button>
                  );
                })}
              </div>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <CampaignBehaviour
                key={current.slug}
                slug={current.slug}
                artistName={current.name}
                noBreakout
              />
            </div>
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-[13px] text-ink/45 max-w-[420px] mx-auto">
              Behaviour follows the pins. Pin an artist and their upload
              timeline, formats and follow-up window appear here.
            </p>
          </div>
        )
      )}
    </OpenBehaviourContext.Provider>
    </div>
    </main>
  );
}
