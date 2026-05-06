import {
  ARTISTS,
  mergeArtistLists,
} from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import CoachPage from '@/components/CoachPage';

export const metadata = {
  title: 'YouTube Campaign Coach',
  description: 'Channel-aware campaign planning and live guidance.',
};

export default async function CoachRoute() {
  const custom = await listCustomArtists();
  const allArtists = mergeArtistLists(ARTISTS, custom);

  const artistOptions = allArtists.map((a) => ({
    slug: a.slug,
    name: a.name,
    channelHandle: a.channelHandle ?? undefined,
  }));

  return <CoachPage artistOptions={artistOptions} />;
}
