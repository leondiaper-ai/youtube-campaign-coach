import ArtistCoach from '@/components/ArtistCoach';

export const dynamic = 'force-dynamic';

export default function Page({ params }: { params: { slug: string } }) {
  return <ArtistCoach slug={params.slug} />;
}
