import { getMarket } from './market';
import { getTeam, teamUrl } from './teams';

export type TeamBoardView = 'all' | 'priority' | 'behaviour' | 'tools';

export function readTeamBoardView(params: URLSearchParams): TeamBoardView {
  if (params.get('behaviour')) return 'behaviour';
  const view = params.get('view');
  return view === 'priority' || view === 'behaviour' || view === 'tools' ? view : 'all';
}

/** One set of destinations for a region, on the board and on other pages. */
export function regionalWorkspaceNav(marketId: string) {
  const market = getMarket(marketId);
  const team = market?.teamSlug ? getTeam(market.teamSlug) : null;
  if (!market || !team) return null;
  const board = teamUrl(team);
  const suffix = `?market=${market.id}`;
  return [
    { href: board, label: 'Artists', view: 'all' as TeamBoardView },
    { href: `${board}&view=priority`, label: 'Priority', view: 'priority' as TeamBoardView },
    { href: `${board}&view=behaviour`, label: 'Activity', view: 'behaviour' as TeamBoardView },
    { href: `/coach${suffix}`, label: 'Coach' },
    { href: `${board}&view=tools`, label: 'Tools', view: 'tools' as TeamBoardView },
    { href: `/teams${suffix}`, label: 'Workspaces' },
    { href: `/labels${suffix}`, label: 'Labels' },
    { href: `/resources${suffix}`, label: 'Resources' },
  ];
}
