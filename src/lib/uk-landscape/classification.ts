/* ═══════════════════════════════════════════════════════════════════
   UK LANDSCAPE — VIRGIN CLASSIFICATION SEED

   Who belongs in the public UK Landscape rankings, and who does not.

   INCLUDE  evidence beyond the Watcher ownership flag: on the
            established Virgin UK artist list, present in VMG's own UK
            consumption reporting, an active Virgin campaign in
            Watcher, or a Virgin campaign deep-dive built here.
   CHECK    the Watcher `virgin` flag is the ONLY evidence. Held out of
            the rankings on purpose — a stale flag is not a
            relationship. Backstage until a human confirms.
   EXCLUDE  market-watch channels with no Virgin evidence at all.

   This is a SEED. The live map lives in KV and is edited through
   setClassification(), so moving an artist between buckets never
   requires a code change.

   SEED-ROSTER ARTISTS. tom-odell, k-trap and bad-omens live in the
   hardcoded ARTISTS array rather than the KV custom store. The first
   universe build read the custom store alone and lost all three —
   Bad Omens silently, despite 853,555 UK consumption at rank 14. They
   are listed explicitly here, and build.ts now defaults an unknown
   slug to CHECK rather than to nothing, so a future omission surfaces
   backstage instead of vanishing.
   ═══════════════════════════════════════════════════════════════════ */

export const CLASSIFICATION_SEED: { include: string[]; check: string[]; exclude: string[] } = {
  "include": [
    "aespa",
    "aifricccc",
    "antonyszmierek",
    "arkaylaband",
    "ascomullionz",
    "bad-omens",
    "beabadoobee",
    "bethmccarthy",
    "bigbemz1",
    "blueearthsound",
    "bonniekemplaymusic",
    "catchuphomie",
    "childishgambino",
    "chvrches",
    "cigarettesaftersex",
    "cowboyhunters",
    "davidkushner",
    "dblockeuropetv",
    "declanmckenna",
    "diggadtv",
    "everythingbutthegirlofficial",
    "ezra-collective",
    "fontainesdc",
    "freakslug",
    "fredopg",
    "frenchthekid",
    "gener8ionworld",
    "gunshipmusic",
    "idlesband",
    "itspetergabriel",
    "itsrory",
    "james-blake",
    "jamiewebster",
    "jigitz",
    "jjerome87",
    "jofromschool",
    "jutesmusic",
    "k-trap",
    "kingsofleon",
    "kislashki",
    "konnykon1",
    "kuruptfm",
    "lazaro",
    "leighanneofficial",
    "lilylyons2413",
    "lipcritic",
    "luvcatland",
    "mallgrab8273",
    "manwomanchainsaw",
    "marnzmalone",
    "mary-inthejunkyard",
    "melaniec",
    "mgnacrrrta",
    "morganwallen",
    "moriahmensah",
    "mysteryjetss",
    "nickelback",
    "originalkoffee",
    "oscarfarrellmusic",
    "palayeroyale",
    "porij",
    "preciouspepala",
    "rudimentaluk",
    "saintclairband",
    "saintlevantofficial",
    "santandave",
    "saskiaamusic",
    "stevenwilsonhq",
    "summerssons",
    "tenoffcl",
    "the-long-faces-topic",
    "the-royston-club-topic",
    "thebigmoon",
    "theblessedmadonna",
    "theitchmusic",
    "thesnuts",
    "thisisblocparty",
    "tom-odell",
    "tomasmithmusic",
    "tovelomusic",
    "underworldlivetv",
    "vanmorrisonofficial",
    "venusgrrrls",
    "wearearchitects",
    "whiskeymyers",
    "whoisnewport",
    "xxxtentacion"
  ],
  "check": [
    "adaytoremember",
    "bleachers",
    "bts",
    "coffin844",
    "czarfaceeso",
    "davidguetta",
    "ear-music-2005",
    "ericprydz",
    "grupofirmeoficial",
    "hermanosespinozaoficial",
    "imminenceswe",
    "joji",
    "kda-topic",
    "keepvibesnear",
    "kinggizzardandthelizardwizard",
    "leagueoflegends",
    "lianaflores",
    "lukasgraham",
    "lykkeli",
    "modestmouse",
    "nctsmtown",
    "oneruel",
    "planboficial",
    "plaqueboymax",
    "poppy",
    "riconasty",
    "sofianepamart",
    "straykids",
    "tobiahs",
    "tomorrowland",
    "underscores",
    "vghnofficial"
  ],
  "exclude": [
    "edsheeran",
    "fluxidentity",
    "headieone",
    "massiveattack"
  ]
};
