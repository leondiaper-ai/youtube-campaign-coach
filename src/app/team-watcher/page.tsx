import TeamBoard from '@/components/TeamBoard';
import { TEAMS } from '@/lib/teams';

/* The Nordics board's original URL. It predates the team registry and
   people have it bookmarked, so it stays exactly where it was and simply
   renders the shared board for its own team. No token: this one has
   always been an internal link and making it need a key today would
   break it for the people already using it. */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Nordics Team Campaign Board — YouTube Campaign System',
  description: 'Shared team view — monitor channel health and campaign progress.',
};

export default function NordicsPage() {
  return <TeamBoard team={TEAMS.nordics} linkPrefix="/team-watcher" />;
}
