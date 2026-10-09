import Link from 'next/link';
import { TEAMS, TEAM_SLUGS, teamUrl } from '@/lib/teams';
import { MARKETS } from '@/lib/market';
import { listEntries } from '@/lib/teamWatcherStore';
import { listPinned } from '@/lib/campaignStore';
import { getArtistsForMarket } from '@/lib/marketScope';
import { AppHeader, PageTitle } from '@/components/ui/AppHeader';
import { SectionHead, Eyebrow } from '@/components/ui';

/* ═══════════════════════════════════════════════════════════════════════
   WORKSPACES

   Every regional board in one place, because the links were living in
   whatever message they were last sent in. This is the index: who has a
   board, how much is on it, and the three destinations each team uses.

   ── WHY THIS PAGE IS SENSITIVE ──────────────────────────────────────
   Each board is protected by an unguessable link rather than a login,
   and this page prints every one of those links together. That makes it
   the single most valuable URL in the product: whoever opens it can open
   every team's board.

   The app has no auth to put in front of it, so the mitigations are:
   noindex (below), and not linking it from anything public. If real
   access control ever arrives, this is the first page that needs it —
   and this comment is here so nobody later assumes it already has it.
   ═══════════════════════════════════════════════════════════════════════ */

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Workspaces — YouTube Campaign System',
  description: 'Every regional board, and what is on it.',
  robots: { index: false, follow: false },
};

export default async function TeamsPage() {
  /* The UK is not a team board — it has no entries store and no token. It
     is the default market, which is why an untagged artist lands there and
     why this view sees everything. Shown first and shown differently,
     because presenting it as a fourth region would misdescribe it. */
  const ukRoster = await getArtistsForMarket('uk');
  const ukPinned = await listPinned('uk');

  const teams = await Promise.all(
    TEAM_SLUGS.map(async (slug) => {
      const team = TEAMS[slug];
      const market = Object.values(MARKETS).find((m) => m.teamSlug === slug) ?? null;
      const entries = await listEntries(slug);
      const pinned = market ? await listPinned(market.id) : [];
      const lastTouched = entries.reduce<string | null>(
        (latest, e) => (!latest || e.updatedAt > latest ? e.updatedAt : latest),
        null,
      );
      return { team, market, count: entries.length, pinned: pinned.length, lastTouched };
    }),
  );

  return (
    <main className="min-h-screen bg-paper text-ink">
      <AppHeader
        nav={[
          { href: '/growth', label: 'Channel Health' },
          { href: '/campaigns', label: 'Active Campaigns' },
          { href: '/coach', label: 'Coach' },
          { href: '/teams', label: 'Workspaces' },
          { href: '/resources', label: 'Resources' },
        ]}
        workspace="Virgin Music UK"
      />

      <div className="max-w-[1180px] mx-auto px-6">
        <PageTitle
          title="Workspaces"
          lede="Each region works its own roster on its own board. Everything any team adds joins the shared pool, so it is monitored that night and appears tagged on this view."
        />

        {/* ── The central view ──────────────────────────────────────── */}
        <div className="mb-10">
          <SectionHead title="Central view" meta="Every channel in the system" />
          <Link
            href="/growth"
            className="group block no-underline bg-surface border border-line rounded-card p-5 transition-colors hover:border-line-strong"
          >
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="min-w-0">
                <Eyebrow>Virgin Music UK</Eyebrow>
                <h3 className="text-h3 font-extrabold mt-1.5 text-ink">United Kingdom</h3>
                <p className="text-body text-secondary mt-1.5 max-w-[56ch]">
                  The default workspace. An artist with no market set belongs
                  here, which is why this view sees the whole roster rather
                  than a region of it.
                </p>
              </div>
              <div className="flex gap-8 shrink-0">
                <div>
                  <div className="text-kpi font-black tabular-nums">{ukRoster.length}</div>
                  <div className="text-[11px] font-bold uppercase tracking-label text-secondary mt-1.5">
                    Channels
                  </div>
                </div>
                <div>
                  <div className="text-kpi font-black tabular-nums">{ukPinned.length}</div>
                  <div className="text-[11px] font-bold uppercase tracking-label text-secondary mt-1.5">
                    Pinned
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-5 pt-4 border-t border-line text-[11px] font-bold uppercase tracking-label text-signal">
              Open Channel Health
              <span className="transition-transform group-hover:translate-x-0.5" aria-hidden>→</span>
            </div>
          </Link>
        </div>

        {/* ── Regional boards ───────────────────────────────────────── */}
        <div className="mb-10">
          <SectionHead
            title="Regional boards"
            meta={`${teams.length} ${teams.length === 1 ? 'team' : 'teams'}`}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {teams.map(({ team, market, count, pinned, lastTouched }) => (
              /* The whole tile is the link. Three buttons in a row made the
                 card look like a menu of equal choices, when the board is
                 the destination and the other two are reachable from it. */
              <a
                key={team.slug}
                href={teamUrl(team)}
                className="group no-underline bg-surface border border-line rounded-card p-5 flex flex-col transition-colors hover:border-line-strong"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Eyebrow>{market ? market.orgName : team.regionTag}</Eyebrow>
                    <h3 className="text-h3 font-extrabold mt-1.5 truncate text-ink">
                      {team.name.replace(/ — Campaign Board$/, '')}
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-label px-2 py-1 rounded bg-raised text-secondary shrink-0">
                    {team.regionTag}
                  </span>
                </div>

                <div className="flex gap-8 mt-4">
                  <div>
                    <div className="text-kpi font-black tabular-nums">
                      {count || <span className="text-faint">0</span>}
                    </div>
                    <div className="text-[11px] font-bold uppercase tracking-label text-secondary mt-1.5">
                      Channels
                    </div>
                  </div>
                  <div>
                    <div className="text-kpi font-black tabular-nums">
                      {pinned || <span className="text-faint">0</span>}
                    </div>
                    <div className="text-[11px] font-bold uppercase tracking-label text-secondary mt-1.5">
                      Pinned
                    </div>
                  </div>
                </div>

                <div className="text-micro text-muted mt-3">
                  {count === 0
                    ? 'Board is empty — the team builds it themselves.'
                    : lastTouched
                      ? `Last updated ${new Date(lastTouched).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}`
                      : 'No update recorded yet.'}
                </div>

                {!market && (
                  /* A board with no market falls back to the UK pages, which
                     is the bug that sent Nordics to another region's
                     campaigns. Surfaced rather than left to be noticed. */
                  <div className="text-micro text-warn mt-3">
                    No market configured — the planner and briefing links fall
                    back to the UK.
                  </div>
                )}

                {/* The link carries the team's key, so opening it from here
                    is the same as being sent the URL. */}
                <div className="flex items-center gap-1.5 mt-auto pt-4 mt-4 border-t border-line text-[11px] font-bold uppercase tracking-label text-signal">
                  Open board
                  <span className="transition-transform group-hover:translate-x-0.5" aria-hidden>→</span>
                </div>
              </a>
            ))}
          </div>
        </div>

        <div className="pb-14 text-micro text-muted max-w-[72ch] leading-relaxed">
          <strong className="text-secondary">On the board links.</strong> Each one
          carries an unguessable key rather than a login. Anyone holding the URL
          can open that board, and so can anyone they forward it to — which is
          the right trade for public YouTube figures, but worth knowing before
          this page is shared. Rotating a key in <code>lib/teams.ts</code> revokes
          every link ever sent for that board.
        </div>
      </div>
    </main>
  );
}

