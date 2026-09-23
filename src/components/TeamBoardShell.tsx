'use client';

/* ═══════════════════════════════════════════════════════════════════
   THE TEAM BOARD'S TWO TABS, AND THE BEHAVIOUR VIEW BEHIND THEM
   ═══════════════════════════════════════════════════════════════════

   Two changes, and they are the same change.

   PRIORITY IS A TAB, NOT A FOOTER. Pinned artists used to be a section
   below the full roster, which put the thing a team actually decided
   was urgent underneath everything they had not. A pin is a statement
   of priority, so it earns a tab — the same pill toggle the Watcher's
   own board uses, so nobody has to learn a second control.

   BEHAVIOUR IS A VIEW, NOT AN ACCORDION. It used to expand inside the
   card, which meant a full-width chart squeezed into a column with a
   note box under it. Our own board has done this properly for months:
   the chart takes the page, and a sidebar of the other campaigns sits
   beside it so you can move between them without going back. That is
   what a team gets now, with their own pinned artists in the rail.

   ── HOW THE PIECES REACH EACH OTHER ────────────────────────────────
   The tabs hold server-rendered children, so their props were fixed
   before this component existed and a callback cannot be passed down
   to them. The behaviour view has to live up here — it replaces the
   whole page, header included — so the card's button reaches it
   through context instead. Children passed into a client component
   still render inside its tree, so the provider wraps them.

   ?behaviour=<slug> opens the view directly. That is how the artist
   detail page links to it, exactly as our own detail page links to
   /campaigns?behaviour=<slug>.
   ═══════════════════════════════════════════════════════════════════ */

import {
  createContext, useContext, useState, useEffect, type ReactNode,
} from 'react';
import Link from 'next/link';
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

const STATUS_DOT: Record<string, string> = {
  HEALTHY: '#1FBE7A',
  'WEAK CONVERSION': '#F08A3C',
  BUILDING: '#2C25FF',
  'AT RISK': '#FF4A1C',
  COLD: '#8A847A',
};

export default function TeamBoardShell({
  header, allTab, priorityTab, allCount, priorityCount, rail, backHref, emptyPriority,
}: {
  /** The board's title block. Inside the shell because the behaviour
      view replaces the whole page, header included — the same as our
      own campaigns board does. */
  header: ReactNode;
  allTab: ReactNode;
  priorityTab: ReactNode;
  allCount: number;
  priorityCount: number;
  /** The pinned artists, for the rail beside the chart. */
  rail: BehaviourRailArtist[];
  /** Where "← Board" goes when the behaviour view is closed by link. */
  backHref: string;
  /** Shown in the Priority tab when nothing is pinned yet. */
  emptyPriority: ReactNode;
}) {
  const [tab, setTab] = useState<'all' | 'priority'>('all');
  const [behaviourSlug, setBehaviourSlug] = useState<string | null>(null);

  /* Read on mount rather than from useSearchParams, which would force
     this subtree into a Suspense boundary for a value that never
     changes after load. */
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('behaviour');
    if (s) {
      setBehaviourSlug(s);
      setTab('priority');
    }
  }, []);

  const open = (slug: string) => {
    setBehaviourSlug(slug);
    /* So a reload, or a link the reader copies, lands back here. */
    const u = new URL(window.location.href);
    u.searchParams.set('behaviour', slug);
    window.history.replaceState(null, '', u.toString());
  };

  const close = () => {
    setBehaviourSlug(null);
    const u = new URL(window.location.href);
    u.searchParams.delete('behaviour');
    window.history.replaceState(null, '', u.toString());
  };

  const current = behaviourSlug ? rail.find(a => a.slug === behaviourSlug) : null;

  /* ─── THE BEHAVIOUR VIEW ────────────────────────────────────────
     Full width by being the page, not by escaping a column. The
     campaigns board has to do the 100vw trick because its board sits
     inside a centred wrapper it does not own; this shell owns the page
     from the header down, so it simply does not draw that wrapper. */
  if (behaviourSlug && current) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', minHeight: '100vh',
        width: '100%', position: 'relative',
        background: PAPER, color: INK,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 20px', background: PAPER }}>
          <button
            onClick={close}
            className="text-[11px] uppercase tracking-[0.18em] text-ink/55 hover:text-ink"
            style={{ background: 'none', border: 'none', cursor: 'pointer',
                     padding: 0, marginRight: 8 }}
          >
            &larr; Board
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/youtube-logo.svg" alt="YouTube" style={{ height: 16, opacity: 0.7 }} />
        </div>

        <div style={{ display: 'flex', flex: 1 }}>
          {/* The other pinned artists, one click away. */}
          <div style={{
            width: 72, minWidth: 72, background: '#1A1A1A', display: 'flex',
            flexDirection: 'column', alignItems: 'center', paddingTop: 16,
            paddingBottom: 16, gap: 6, overflowY: 'auto', position: 'sticky',
            top: 0, height: 'calc(100vh - 52px)',
            borderRight: '1px solid rgba(255,255,255,0.06)',
          }}>
            <button
              onClick={close}
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
              const isActive = a.slug === behaviourSlug;
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
              slug={behaviourSlug}
              artistName={current.name}
              onClose={close}
              noBreakout
            />
          </div>
        </div>
      </div>
    );
  }

  /* An artist pinned, then unpinned in another tab, can leave a
     ?behaviour= that no longer matches anybody. Say so rather than
     showing an empty board with a stale URL. */
  if (behaviourSlug && !current) {
    return (
      <div className="py-20 text-center min-h-screen" style={{ background: PAPER, color: INK }}>
        <p className="text-[13px] text-ink/45 mb-3">
          That artist is no longer pinned on this board.
        </p>
        <Link href={backHref}
              className="text-[11px] uppercase tracking-[0.18em] text-ink/55 hover:text-ink">
          &larr; Back to the board
        </Link>
      </div>
    );
  }

  /* ─── THE BOARD ─────────────────────────────────────────────────── */
  return (
    <main className="min-h-screen" style={{ background: PAPER, color: INK }}>
    <div className="max-w-[1080px] mx-auto px-6 py-10">
    <OpenBehaviourContext.Provider value={open}>
      {header}

      <div className="flex items-center gap-1 rounded-lg p-1 mb-2" style={{ background: SOFT }}>
        {(['all', 'priority'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 rounded-md text-[12px] font-black uppercase tracking-[0.1em] transition-all"
            style={{
              background: tab === t ? '#FFFFFF' : 'transparent',
              color: tab === t ? INK : 'rgba(14,14,14,0.4)',
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {t === 'all' ? `All Artists (${allCount})` : `Priority (${priorityCount})`}
          </button>
        ))}
      </div>
      <div className="text-[10px] text-ink/35 mb-5 pl-1">
        {tab === 'all'
          ? 'Every channel this team is watching'
          : 'Pinned artists — the ones this team is working right now'}
      </div>

      {/* Both stay mounted. Switching tabs should not re-run the table's
          sort and search, or lose a half-typed note on a card. */}
      <div hidden={tab !== 'all'}>{allTab}</div>
      <div hidden={tab !== 'priority'}>
        {priorityCount > 0 ? priorityTab : emptyPriority}
      </div>
    </OpenBehaviourContext.Provider>
    </div>
    </main>
  );
}
