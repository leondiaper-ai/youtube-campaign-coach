import {
  ARTISTS,
  mergeArtistLists,
} from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import PlanBuilder from '@/components/PlanBuilder';

export const metadata = {
  title: 'Build Content Plan — YouTube Campaign System',
  description: 'Paste a campaign timeline. Get a structured YouTube rollout.',
};

export default async function PlanPage() {
  const custom = await listCustomArtists();
  const allArtists = mergeArtistLists(ARTISTS, custom);

  const artistOptions = allArtists.map((a) => ({
    slug: a.slug,
    name: a.name,
    channelHandle: a.channelHandle ?? undefined,
  }));

  return <PlanBuilder artistOptions={artistOptions} />;
}
