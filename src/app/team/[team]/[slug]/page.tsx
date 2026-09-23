import TeamArtistDetail, { buildMetadata } from '@/components/TeamArtistDetail';
import { getTeam, tokenMatches } from '@/lib/teams';
import { notFound } from 'next/navigation';

/* One artist, inside a regional board. Gated by the same key as the board
   itself — otherwise the board is behind a link and the rows are not,
   which is the kind of half-door that makes the whole thing pointless. */
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default async function Page({ params, searchParams }: {
  params: Promise<{ team: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { team: teamSlug, slug } = await params;
  const sp = await searchParams;

  const team = getTeam(teamSlug);
  if (!team) notFound();

  const k = Array.isArray(sp.k) ? sp.k[0] : sp.k;
  if (!tokenMatches(team, k)) notFound();

  return (
    <TeamArtistDetail
      slug={slug}
      team={team.slug}
      backHref={`/team/${team.slug}?k=${team.token}`}
    />
  );
}
