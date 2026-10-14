/* Channel registry for Market Watch.
 *
 * `relationship` describes the company link; `role` describes what the channel
 * is for. They are independent — a channel can be worth watching without
 * knowing who owns it.
 *
 * Only The Nations group, Lowly and Flighthouse are recorded as Create-owned:
 * Create acquired a majority interest in The Nations, including Lowly, in April
 * 2022 (Music Business Worldwide), and Flighthouse separately. Monstercat,
 * mau5trap, Nettwerk, !K7, Strut and Enhanced appear in the same presentation
 * and are independently operated companies — being named in a deck is evidence
 * of being mentioned, not of being owned.
 *
 * `channelId` is null until resolved through the API by handle. Handles are
 * unique on YouTube, so a single hit is the identity; anything that falls
 * through to search is left unresolved rather than guessed.
 */

export type Relationship = 'network_member' | 'external_reference' | 'unverified';
export type Role = 'genre_discovery' | 'context_curation' | 'label_catalogue' | 'culture_editorial';

export interface MwChannelDef {
  key: string;
  name: string;
  handle: string;
  /** Resolved at collection time; null means never confirmed. */
  channelId?: string | null;
  relationship: Relationship;
  company: string | null;
  role: Role;
  /** One line on what the channel is for. Factual, from observable positioning. */
  purpose: string;
  /** Resolution returned something implausible — a near-zero subscriber count
      or an empty channel. Shown as unverified rather than as findings. */
  suspect?: boolean;
}

export const MW_REGISTRY: MwChannelDef[] = [
  // ── The Nations — Create Music Group majority interest, Apr 2022 ──────
  { key:'trap-nation', name:'Trap Nation', handle:'@TrapNation', channelId:'UCa10nxShhzNrCE1o2ZOPztg',
    relationship:'network_member', company:'The Nations', role:'genre_discovery',
    purpose:'Trap and bass discovery. The founding Nations channel, 2012.' },
  { key:'chill-nation', name:'Chill Nation', handle:'@ChillNation', channelId:'UCM9KEEuzacwVlkt9JfJad7g',
    relationship:'network_member', company:'The Nations', role:'context_curation',
    purpose:'Downtempo and chill electronic, positioned by mood rather than genre.' },
  { key:'rap-nation', name:'Rap Nation', handle:'@allrapnation', channelId:'UC8QfB1wbfrNwNFHQxfyNJsw',
    relationship:'network_member', company:'The Nations', role:'genre_discovery',
    purpose:'Rap and hip-hop discovery.' },
  { key:'bass-nation', name:'Bass Nation', handle:'@BassNation',
    relationship:'network_member', company:'The Nations', role:'genre_discovery',
    purpose:'Bass music discovery.' },
  /* Resolution returned a 3,930-subscriber channel with no uploads — a handle
     collision, not The Nations' House Nation. Left unresolved rather than
     presented as data. */
  { key:'house-nation', name:'House Nation', handle:'@HouseNation', suspect:true,
    relationship:'network_member', company:'The Nations', role:'genre_discovery',
    purpose:'House and dance discovery.' },
  { key:'indie-nation', name:'Indie Nation', handle:'@IndieNation',
    relationship:'network_member', company:'The Nations', role:'genre_discovery',
    purpose:'Indie and alternative discovery.' },
  /* Resolution returned a channel with ONE subscriber. Plainly not it. */
  { key:'rnb-nation', name:'R&B Nation', handle:'@RnBNation', suspect:true,
    relationship:'network_member', company:'The Nations', role:'genre_discovery',
    purpose:'R&B discovery.' },
  { key:'latin-nation', name:'Latin Nation', handle:'@LatinNation',
    relationship:'network_member', company:'The Nations', role:'genre_discovery',
    purpose:'Latin discovery.' },
  { key:'lowly', name:'Lowly', handle:'@lowlypalace',
    relationship:'network_member', company:'Lowly', role:'label_catalogue',
    purpose:'Label channel acquired in the same transaction as The Nations.' },
  { key:'flighthouse', name:'Flighthouse', handle:'@Flighthouse',
    relationship:'network_member', company:'Flighthouse Media', role:'culture_editorial',
    purpose:'Short-form native culture brand; YouTube is not its primary surface.' },

  // ── External references — independently operated, no ownership link ───
  { key:'7clouds', name:'7clouds', handle:'@7clouds', channelId:'UCNqFDjYTexJDET3rPDrmJKg',
    relationship:'external_reference', company:null, role:'genre_discovery',
    purpose:'Independent discovery channel. Included to observe where repertoire travels outside a network.' },
  { key:'aureal', name:'Aureal', handle:'@Aureal',
    relationship:'external_reference', company:null, role:'genre_discovery',
    purpose:'Independent discovery channel.' },
  /* Resolution returned a two-subscriber channel. Not Monstercat's. */
  { key:'monstercat-uncaged', name:'Monstercat Uncaged', handle:'@MonstercatUncaged', suspect:true,
    relationship:'external_reference', company:'Monstercat', role:'label_catalogue',
    purpose:'Monstercat’s harder electronic imprint. Independent company.' },
  { key:'monstercat-instinct', name:'Monstercat Instinct', handle:'@MonstercatInstinct',
    relationship:'external_reference', company:'Monstercat', role:'label_catalogue',
    purpose:'Monstercat’s melodic imprint — a second destination from one company.' },
  { key:'monstercat-silk', name:'Monstercat Silk', handle:'@MonstercatSilk',
    relationship:'external_reference', company:'Monstercat', role:'context_curation',
    purpose:'Progressive and chill imprint, positioned by listening context.' },
  { key:'mau5trap', name:'mau5trap', handle:'@mau5trap',
    relationship:'external_reference', company:'mau5trap', role:'label_catalogue',
    purpose:'Artist-founded techno label.' },
  { key:'nettwerk', name:'Nettwerk Music', handle:'@NettwerkMusic',
    relationship:'external_reference', company:'Nettwerk Music Group', role:'label_catalogue',
    purpose:'Independent label catalogue channel.' },
  { key:'nettwerk-backstage', name:'Nettwerk Backstage', handle:'@nettwerkbackstage',
    relationship:'external_reference', company:'Nettwerk Music Group', role:'culture_editorial',
    purpose:'Editorial companion to Nettwerk Music — one company, two destinations.' },
  { key:'k7', name:'!K7 Records', handle:'@K7Records',
    relationship:'external_reference', company:'!K7 Music', role:'label_catalogue',
    purpose:'Independent electronic label catalogue.' },
  { key:'strut', name:'Strut Records', handle:'@StrutRecords',
    relationship:'external_reference', company:'Strut Records', role:'label_catalogue',
    purpose:'Reissue-led catalogue label — the clearest case for catalogue resurfacing.' },
  { key:'enhanced', name:'Enhanced Music', handle:'@EnhancedMusic',
    relationship:'external_reference', company:'Enhanced Music', role:'label_catalogue',
    purpose:'Trance and progressive label catalogue.' },
];

export const REL_LABEL: Record<Relationship, string> = {
  network_member: 'Network member',
  external_reference: 'External reference',
  unverified: 'Unverified',
};
export const ROLE_LABEL: Record<Role, string> = {
  genre_discovery: 'Genre discovery',
  context_curation: 'Context curation',
  label_catalogue: 'Label catalogue',
  culture_editorial: 'Culture / editorial',
};
