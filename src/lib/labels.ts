/** Label workspaces share observations, but keep their own roster and working records.
 * They deliberately do not appear in MARKET_IDS or regional workspace lists.
 */
export type LabelWorkspace = {
  slug: string; workspaceId: string; name: string; logo: string;
  website: string; rosterSource: string; rosterCheckedAt: string; roster: string[];
};
export const LABELS: Record<string, LabelWorkspace> = {
  partisan: {
    slug: 'partisan', workspaceId: 'label-partisan', name: 'Partisan Records',
    logo: '/labels/partisan/logo.svg', website: 'https://partisanrecords.com/',
    rosterSource: 'https://partisanrecords.com/artists/', rosterCheckedAt: '2026-10-27',
    roster: ['Beth Orton', 'Blondshell', 'Cameron Winter', 'Cigarettes After Sex',
      'Cymande', 'DJ Rashad', 'Ezra Collective', 'Fela Kuti', 'Femi Kuti', 'Geese',
      'Grian Chatten', 'IDLES', 'Interpol', 'Julia Cumming', 'Just Mustard', 'kaeto',
      'Laura Marling', 'Lip Critic', 'Maple Glider', 'Morphine', 'NoSo', 'Paul Banks',
      'PJ Harvey', 'Sun’s Signature', 'TTSSFU', 'Westerman', 'Witch Post'],
  },
  futureclassic: {
    slug: 'futureclassic', workspaceId: 'label-futureclassic', name: 'Future Classic',
    logo: '/labels/futureclassic/logo.svg', website: 'https://www.futureclassic.com/',
    rosterSource: 'https://www.futureclassic.com/', rosterCheckedAt: '2026-11-11',
    /* Opened blank on purpose, so the roster is confirmed with the label rather
       than inferred from their public site. An empty roster does NOT mean the
       label has no artists — futureclassic.com listed 33 clients on 11 Nov 2026,
       mixing label, management and publishing. Channels join through `markets`,
       which is what "Add artist" writes, so this workspace fills up without the
       list below changing and nobody later reads it as a check that found none. */
    roster: [],
  },
  communion: {
    slug: 'communion', workspaceId: 'label-communion', name: 'Communion Music',
    logo: '/labels/communion/logo.svg', website: 'https://www.communionmusic.co.uk/',
    rosterSource: 'https://www.communionmusic.co.uk/', rosterCheckedAt: '2026-11-11',
    /* Opened blank on purpose, same as Future Classic: the roster gets
       confirmed with the label rather than inferred. communionmusic.co.uk sat
       behind a bot check on 11 Nov 2026, so nothing was read from it at all —
       an empty roster here is "not asked yet", never "none found". Channels
       join through `markets`, which is what "Add artist" writes, so the
       workspace fills up without this list changing.
       The logo is a PLACEHOLDER wordmark, not Communion's mark; swap in
       their own SVG at public/labels/communion/logo.svg. */
    roster: [],
  },
};
export function getLabelWorkspace(value: string | null | undefined): LabelWorkspace | null {
  return Object.values(LABELS).find(l => l.slug === value || l.workspaceId === value || l.name === value) ?? null;
}
export function normaliseLabelArtist(value: string) {
  return value.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}
export function isLabelArtist(label: LabelWorkspace, artist: { name: string; markets?: string[] }) {
  return artist.markets?.includes(label.workspaceId) === true || label.roster.some(name => normaliseLabelArtist(name) === normaliseLabelArtist(artist.name));
}

/** Existing channel metadata survives joining a label; new channels don't join UK implicitly. */
export function joinLabelRoster<T extends { markets?: string[] }>(label: LabelWorkspace, incoming: T, existing?: T): T {
  const record = existing ?? incoming;
  return { ...record, markets: Array.from(new Set([...(existing ? existing.markets ?? ['uk'] : []), label.workspaceId])) };
}

export function labelRecordKey(label: LabelWorkspace | null, slug: string) {
  return label ? `${label.workspaceId}:${slug}` : slug;
}
export function labelPlanSlug(label: LabelWorkspace | null, slug: string) {
  const suffix = label ? `--${label.workspaceId}` : '';
  return suffix && !slug.endsWith(suffix) ? `${slug}${suffix}` : slug;
}
