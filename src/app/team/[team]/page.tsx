import TeamBoard from '@/components/TeamBoard';
import { getTeam, tokenMatches } from '@/lib/teams';

/* ═══════════════════════════════════════════════════════════════════
   A REGIONAL TEAM'S BOARD

   /team/australia?k=<token>

   The Watcher, minus the parts that are ours rather than theirs: no
   Coach, no Resources, no Intelligence Hub navigation. What is left is
   the thing a campaign manager actually wants — add the artists you are
   working, and watch how their channels move.

   The board starts empty on purpose. It is theirs to build.

   ── WHAT THE LINK IS AND IS NOT ──────────────────────────────────────
   The token makes the URL unguessable. It is not a login: anyone holding
   the link is in, and so is anyone they forward it to. That is the right
   trade for a board of public YouTube figures shared with a colleague,
   and it is written down here so nobody later mistakes it for auth. To
   revoke every link ever sent, change the token in lib/teams.ts.

   A wrong or missing key gets a flat "not found" rather than "wrong
   password" — there is no reason to confirm to a stranger that the board
   exists at all.
   ═══════════════════════════════════════════════════════════════════ */

export const dynamic = 'force-dynamic';

/* Search engines should not be indexing a link meant for one team. */
export const metadata = {
  robots: { index: false, follow: false },
};

const PAPER = '#FAF7F2';
const INK = '#0E0E0E';

function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center"
          style={{ background: PAPER, color: INK }}>
      <div className="text-center max-w-[420px] px-6">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] opacity-40">
          YouTube Campaign System
        </div>
        <h1 className="font-black text-[26px] leading-tight mt-2">Not found</h1>
        <p className="text-[13px] opacity-45 mt-2">
          This board needs the full link, including the key at the end of it.
          Ask whoever shared it to send the whole URL.
        </p>
      </div>
    </main>
  );
}

export default async function TeamPage({
  params, searchParams,
}: {
  params: Promise<{ team: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { team: slug } = await params;
  const sp = await searchParams;

  const team = getTeam(slug);
  if (!team) return <NotFound />;

  const k = Array.isArray(sp.k) ? sp.k[0] : sp.k;
  if (!tokenMatches(team, k)) return <NotFound />;

  /* The key travels with every row link, so following one does not drop
     the reader back out to the front door. */
  return <TeamBoard team={team} linkPrefix={`/team/${team.slug}`} linkSuffix={`?k=${team.token}`} />;
}
