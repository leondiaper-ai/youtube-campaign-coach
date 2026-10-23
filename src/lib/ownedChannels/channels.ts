/** User-supplied roster. Names/handles verified on public YouTube pages on 23 Oct 2026.
 * Roles describe channel positioning, not rights ownership or an effectiveness rating.
 * Keep invalid input visible; never guess a replacement channel ID.
 */
export const OWNED_CHANNELS = [
  {
    "id": "UCCRF5F6VXxGog9ears8WCfg",
    "name": "EDM Society",
    "handle": "@TheEDMSociety",
    "role": "Genre",
    "purpose": "EDM and dance discovery",
    "identityVerified": true
  },
  {
    "id": "UC2_BNEOjEi2plnmHUppPLzQ",
    "name": "Folk and Nature",
    "handle": "@FolkandNature",
    "role": "Genre",
    "purpose": "Folk, acoustic and Americana",
    "identityVerified": true
  },
  {
    "id": "UCMO6YRfAG4npIHsSKcDXANA",
    "name": "Electronic Color Streams",
    "handle": "@ElectronicColorStreams",
    "role": "Mood",
    "purpose": "Electronic music and abstract visuals",
    "identityVerified": true
  },
  {
    "id": "UC10pqmuYFkyqWc4O51T2KIA",
    "name": "Venue Floor",
    "handle": "@VenueFloor",
    "role": "Genre",
    "purpose": "Hard rock and classic rock",
    "identityVerified": true
  },
  {
    "id": "UCKF7C3b-iqea_-qn_fFchMw",
    "name": "Kinetic Pulse Music",
    "handle": "@KineticPulsemusic",
    "role": "Activity",
    "purpose": "High-energy electronic listening",
    "identityVerified": true
  },
  {
    "id": "UCC-hsDZsRa_Qc3YdgDs3KZA",
    "name": "Halloween Divinations",
    "handle": "@HalloweenDivinations",
    "role": "Seasonal",
    "purpose": "Halloween music",
    "identityVerified": true
  },
  {
    "id": "UC0EUZKrkdhSiGwA61GyqJdA",
    "name": "El Patio",
    "handle": "@MusicaElPatio",
    "role": "Genre",
    "purpose": "Latin music and social listening",
    "identityVerified": true
  },
  {
    "id": "UChVWfn28jaZSxBqwwP0VnL",
    "name": "Unresolved channel",
    "handle": null,
    "role": "Unconfirmed",
    "purpose": "Channel ID needs checking",
    "identityVerified": false
  },
  {
    "id": "UCY4yaAaAEs66vlwAkKhmzkA",
    "name": "Study Room",
    "handle": "@study-room-fm",
    "role": "Mood",
    "purpose": "Channel purpose to confirm",
    "identityVerified": true
  },
  {
    "id": "UC0tfvGUDEmYh169ZBlMH0gw",
    "name": "Game Day Radio",
    "handle": "@GameDayRadio",
    "role": "Activity",
    "purpose": "Music around sport and game day",
    "identityVerified": true
  }
] as const;
export type OwnedChannel = typeof OWNED_CHANNELS[number];
export const validChannelId = (id: string) => /^UC[A-Za-z0-9_-]{22}$/.test(id);
