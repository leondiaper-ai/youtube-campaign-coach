import TeamArtistDetail, { buildMetadata } from '@/components/TeamArtistDetail';

/* The Nordics detail route, unchanged for anyone holding a link to it. */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return buildMetadata(slug, 'nordics');
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <TeamArtistDetail slug={slug} team="nordics" backHref="/team-watcher" />;
}
