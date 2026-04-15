export type OpportunityImpact = 'HIGH' | 'MEDIUM' | 'LOW';
export type OpportunityType =
  | 'Missing support'
  | 'Underused asset'
  | 'Cold channel'
  | 'Format gap';

export type Opportunity = {
  id: string;
  artistSlug: string;
  artistName: string;
  type: OpportunityType;
  subtype: string;
  signal: string;
  impact: OpportunityImpact;
  impactRange: string;
  action: string;
};

export const IMPACT_RANK: Record<OpportunityImpact, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

export const OPPORTUNITIES: Opportunity[] = [
  {
    id: 'jb-lyric-video',
    artistSlug: 'james-blake',
    artistName: 'James Blake',
    type: 'Missing support',
    subtype: 'No lyric video on single',
    signal:
      'Single trending on TikTok — 14K creations in 7d — but no official lyric video on the channel.',
    impact: 'HIGH',
    impactRange: '+200–400K views / 30d',
    action: 'Ship a lyric video within 72h. Typography over static art is enough.',
  },
  {
    id: 'ktrap-shorts-gap',
    artistSlug: 'k-trap',
    artistName: 'K-Trap',
    type: 'Format gap',
    subtype: 'No Shorts around active push',
    signal:
      '7 uploads in 30d but 0 Shorts. Change is at 1.2M views and climbing — Shorts are where the audience is finding it.',
    impact: 'HIGH',
    impactRange: '+500K–1M Shorts views',
    action: 'Cut 3 Shorts from the Change video this week — hook, best line, reaction.',
  },
  {
    id: 'ezra-cold-pre-album',
    artistSlug: 'ezra-collective',
    artistName: 'Ezra Collective',
    type: 'Cold channel',
    subtype: 'Pre-album silence',
    signal:
      'Zero uploads in 38d. Album cycle announcing in ~6 weeks. Trailer on channel is from the last campaign.',
    impact: 'HIGH',
    impactRange: 'Foundation for full cycle',
    action: 'Pin a fresh trailer or studio short this week. Warm the channel before announce.',
  },
  {
    id: 'tom-tour-footage',
    artistSlug: 'tom-odell',
    artistName: 'Tom Odell',
    type: 'Underused asset',
    subtype: 'Tour footage not posted',
    signal:
      'Tour announce in 13d. Previous tour has 40+ hours of uncut footage sitting unused. No teaser up yet.',
    impact: 'HIGH',
    impactRange: '+150K views, +pre-save lift',
    action: 'Cut a 60s announce teaser from tour footage. Schedule for 7d before announce.',
  },
  {
    id: 'bo-festival-shorts',
    artistSlug: 'bad-omens',
    artistName: 'Bad Omens',
    type: 'Format gap',
    subtype: 'Festival Shorts lagging',
    signal:
      'Coachella recap in 5d but only 1 Short up from the run. Watch-time flat for 7d.',
    impact: 'MEDIUM',
    impactRange: '+80–150K views',
    action: 'Cut 3 festival Shorts within 24h. Crowd shot, riff, walk-off.',
  },
  {
    id: 'jb-live-session',
    artistSlug: 'james-blake',
    artistName: 'James Blake',
    type: 'Underused asset',
    subtype: 'Live session premiere window',
    signal:
      'Premieres converting at 32% — well above average. No premiere scheduled for the next 14d.',
    impact: 'MEDIUM',
    impactRange: '+50–120K premiere views',
    action: 'Lock a premiere slot. Re-cut an existing live take if nothing new is ready.',
  },
  {
    id: 'ktrap-catalogue',
    artistSlug: 'k-trap',
    artistName: 'K-Trap',
    type: 'Underused asset',
    subtype: 'Back catalogue not in playlists',
    signal:
      'Top 5 older tracks pull 10K+ views/month each but aren\'t grouped into a discovery playlist.',
    impact: 'MEDIUM',
    impactRange: '+session duration, +subs',
    action: 'Build an "Essentials" playlist. Pin to channel homepage.',
  },
  {
    id: 'ezra-community',
    artistSlug: 'ezra-collective',
    artistName: 'Ezra Collective',
    type: 'Missing support',
    subtype: 'Community tab dormant',
    signal:
      'Community tab last used 4 months ago. No poll, no image post, no audience warm-up before cycle.',
    impact: 'MEDIUM',
    impactRange: 'Lifts announce-day CTR',
    action: 'Post a studio image or poll this week. Repeat weekly through announce.',
  },
  {
    id: 'tom-playlists',
    artistSlug: 'tom-odell',
    artistName: 'Tom Odell',
    type: 'Underused asset',
    subtype: 'No tour-themed playlist',
    signal:
      'Tour announce incoming. No playlist grouping the tracks fans will hear on the road.',
    impact: 'LOW',
    impactRange: '+playlist adds',
    action: 'Build a "Live 2026" playlist before announce.',
  },
  {
    id: 'bo-pinned-comment',
    artistSlug: 'bad-omens',
    artistName: 'Bad Omens',
    type: 'Missing support',
    subtype: 'No pinned comment on recap',
    signal:
      'Last 3 uploads have no pinned comment. Easy lift for tour / merch / next-drop callout.',
    impact: 'LOW',
    impactRange: '+CTR to links',
    action: 'Pin a comment on the recap at publish with tour link.',
  },
];

export const IMPACT_COLOR: Record<OpportunityImpact, { bg: string; fg: string; dot: string }> = {
  HIGH: { bg: '#FFE2D8', fg: '#8A1F0C', dot: '#FF4A1C' },
  MEDIUM: { bg: '#FFEAD6', fg: '#8A4A1A', dot: '#F08A3C' },
  LOW: { bg: '#FFF5D6', fg: '#7A5A00', dot: '#FFD24C' },
};
