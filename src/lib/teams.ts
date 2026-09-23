// ─────────────────────────────────────────────────────────────────────────────
// TEAMS
//
// The Watcher was one board for one roster. It is now several: the Nordics
// team has had their own since the summer, Australia is joining, and the
// third region should cost a config line rather than another copy of a page.
//
// A team is four facts: who they are, what to tag the artists they add, and
// a token that makes the URL unguessable.
//
// ── WHAT A TEAM SHARES AND WHAT IT DOES NOT ─────────────────────────────────
// SHARED: the artist pool. Every artist anyone adds — from any board — lands
// in `artists:custom`, and the sync walks ARTISTS + custom. That is why a
// team can add a channel nobody here has ever heard of and it starts being
// monitored the same night, with no extra wiring. It is also why Leon can
// see what they are tracking without asking.
//
// NOT SHARED: the board. `team-watcher:{slug}:entries` holds the campaign
// names, states, pins and notes for one team only. Australia's working notes
// are not Nordics' business and vice versa.
//
// ── ON THE TOKEN ────────────────────────────────────────────────────────────
// This is an unguessable link, not authentication. Anybody holding the URL
// is in, and anybody they forward it to is in. It stops the board being
// found by typing /team/australia, and it can be revoked by changing the
// string here. For a board of public YouTube figures shared with a
// colleague, that is the right amount of security; if this ever carries
// anything genuinely confidential it needs real auth, and this comment is
// the place that should stop somebody assuming it already has it.
// ─────────────────────────────────────────────────────────────────────────────

export type Team = {
  slug: string;
  /** Shown as the board's title. */
  name: string;
  /** Short line under the title. */
  blurb: string;
  /** Pre-filled as the region on every artist this team adds. */
  regionTag: string;
  /**
   * The ?k= value that opens the board. Rotate to revoke every link that
   * has ever been sent out.
   */
  token: string;
};

export const TEAMS: Record<string, Team> = {
  australia: {
    slug: 'australia',
    name: 'Australia — Campaign Board',
    blurb: 'Add the artists you are working, and watch how their channels move.',
    regionTag: 'AU',
    token: 'au-7k2m9x4qvb31',
  },
  nordics: {
    slug: 'nordics',
    name: 'Nordics — Campaign Board',
    blurb: 'Shared team view — channel health and campaign progress.',
    regionTag: 'Nordics',
    token: 'nd-5p8w3t6hjc92',
  },
};

export const TEAM_SLUGS = Object.keys(TEAMS);

export function getTeam(slug: string | undefined | null): Team | null {
  if (!slug) return null;
  return TEAMS[slug.toLowerCase()] ?? null;
}

/**
 * Constant-time-ish comparison. The token is not a password and the board
 * holds public figures, but a plain `===` on a secret is the kind of thing
 * that gets copied into somewhere it matters, so it is written correctly
 * here rather than correctly later.
 */
export function tokenMatches(team: Team, given: string | undefined | null): boolean {
  if (!given || given.length !== team.token.length) return false;
  let diff = 0;
  for (let i = 0; i < team.token.length; i++) {
    diff |= team.token.charCodeAt(i) ^ given.charCodeAt(i);
  }
  return diff === 0;
}

/** The link to send someone. */
export const teamUrl = (team: Team, origin = '') =>
  `${origin}/team/${team.slug}?k=${team.token}`;

/** Every region tag a team has claimed, for tagging rows elsewhere. */
export const TEAM_REGION_TAGS = new Set(Object.values(TEAMS).map(t => t.regionTag));
