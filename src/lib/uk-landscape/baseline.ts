/* ═══════════════════════════════════════════════════════════════════
   UK LANDSCAPE — BASELINE CONSUMPTION PERIOD

   The 26-week VMG UK YouTube consumption period, exactly as approved in
   Virgin_UK_YouTube_Top_Artists.xlsx. This is a SEED, not the source of
   truth: once weekly files are ingested, periods live in KV and this
   file is only the first one.

   It is period-level, not daily, because the approved workbook is an
   aggregate and the daily grain behind it is not reconstructable from
   it. The ingestion layer takes daily rows and keys on date+ISRC — see
   store.ts. We do not invent granularity we do not have.

   Ranks and totals are as VMG reports them. Collaborations stay whole.
   ═══════════════════════════════════════════════════════════════════ */

import type { ConsumptionPeriod } from './types';

export const BASELINE_PERIOD: ConsumptionPeriod = {
  periodId: "2026-W12-W38",
  "periodLabel": "23 March – 20 September 2026",
  "dateFrom": "2026-03-23",
  "dateTo": "2026-09-20",
  "source": "VMG United Kingdom Daily Trend, YouTube tab",
  "totalConsumption": 51023414,
  "artists": [
    {
      "artist": "Underworld",
      "rank": 1,
      "consumption": 4714347,
      "isCollab": false,
      "watcherSlug": "underworldlivetv",
      "tracks": [
        {
          "track": "Born Slippy (Nuxx)",
          "isrc": "GBCGL9800026",
          "consumption": 1245414
        },
        {
          "track": "Born Slippy (Nuxx)",
          "isrc": "GBCGL9800022",
          "consumption": 1215639
        },
        {
          "track": "Born Slippy",
          "isrc": "UK7EF1500034",
          "consumption": 1209437
        }
      ]
    },
    {
      "artist": "D-Block Europe",
      "rank": 2,
      "consumption": 3624175,
      "isCollab": false,
      "watcherSlug": "dblockeuropetv",
      "tracks": [
        {
          "track": "Overseas",
          "isrc": "GB2DY2100828",
          "consumption": 1821717
        },
        {
          "track": "Man In The Mirror",
          "isrc": "GB2DY2200739",
          "consumption": 413050
        },
        {
          "track": "Ferrari Horses",
          "isrc": "GB2DY2000583",
          "consumption": 402273
        }
      ]
    },
    {
      "artist": "XXXTENTACION",
      "rank": 3,
      "consumption": 2632388,
      "isCollab": false,
      "watcherSlug": "xxxtentacion",
      "tracks": [
        {
          "track": "Hope",
          "isrc": "USUG11800447",
          "consumption": 872236
        },
        {
          "track": "Moonlight",
          "isrc": "USUG11800209",
          "consumption": 692685
        },
        {
          "track": "SAD!",
          "isrc": "USUG11800208",
          "consumption": 573295
        }
      ]
    },
    {
      "artist": "Childish Gambino",
      "rank": 4,
      "consumption": 2514829,
      "isCollab": false,
      "watcherSlug": "childishgambino",
      "tracks": [
        {
          "track": "Les",
          "isrc": "USYAH1100353",
          "consumption": 902472
        },
        {
          "track": "Redbone",
          "isrc": "USYAH1600107",
          "consumption": 528513
        },
        {
          "track": "Heartbeat",
          "isrc": "USYAH1100351",
          "consumption": 367832
        }
      ]
    },
    {
      "artist": "Marnz Malone",
      "rank": 5,
      "consumption": 1922538,
      "isCollab": false,
      "watcherSlug": "marnzmalone",
      "tracks": [
        {
          "track": "Cold Hearted World",
          "isrc": "QZRP42371517",
          "consumption": 1623452
        },
        {
          "track": "I Dream Whilst I'm Awake (Free Marni)",
          "isrc": "USZXT2557828",
          "consumption": 299086
        }
      ]
    },
    {
      "artist": "The Long Faces",
      "rank": 6,
      "consumption": 1453251,
      "isCollab": false,
      "watcherSlug": "the-long-faces-topic",
      "tracks": [
        {
          "track": "Jane!",
          "isrc": "QZDA51891902",
          "consumption": 1453251
        }
      ]
    },
    {
      "artist": "French The Kid",
      "rank": 7,
      "consumption": 1277551,
      "isCollab": false,
      "watcherSlug": "frenchthekid",
      "tracks": [
        {
          "track": "Notice Me",
          "isrc": "USZXT2350935",
          "consumption": 263561
        },
        {
          "track": "Ghosts",
          "isrc": "USZXT2659421",
          "consumption": 263301
        },
        {
          "track": "Therapy",
          "isrc": "USZXT2659441",
          "consumption": 207051
        }
      ]
    },
    {
      "artist": "Dave, Central Cee",
      "rank": 8,
      "consumption": 1260147,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Sprinter",
          "isrc": "GBUM72305159",
          "consumption": 783704
        },
        {
          "track": "Trojan Horse",
          "isrc": "GBUM72305707",
          "consumption": 296014
        },
        {
          "track": "Trojan Horse",
          "isrc": "GBUM72305754",
          "consumption": 180429
        }
      ]
    },
    {
      "artist": "Dave",
      "rank": 9,
      "consumption": 1257602,
      "isCollab": false,
      "watcherSlug": "santandave",
      "tracks": [
        {
          "track": "Screwface Capital",
          "isrc": "GBUM71900580",
          "consumption": 348422
        },
        {
          "track": "Verdansk",
          "isrc": "GBUM72104336",
          "consumption": 301790
        },
        {
          "track": "Starlight",
          "isrc": "GBUM72201160",
          "consumption": 301140
        }
      ]
    },
    {
      "artist": "Pop Smoke",
      "rank": 10,
      "consumption": 1188536,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Invincible",
          "isrc": "USUM72002003",
          "consumption": 407477
        },
        {
          "track": "What You Know Bout Love",
          "isrc": "USUM72013339",
          "consumption": 379402
        },
        {
          "track": "Dior",
          "isrc": "USUM71914275",
          "consumption": 306489
        }
      ]
    },
    {
      "artist": "Lord Huron",
      "rank": 11,
      "consumption": 960652,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "The Night We Met",
          "isrc": "US53Q1200103",
          "consumption": 960652
        }
      ]
    },
    {
      "artist": "Jamie Webster",
      "rank": 12,
      "consumption": 957050,
      "isCollab": false,
      "watcherSlug": "jamiewebster",
      "tracks": [
        {
          "track": "Weekend In Paradise",
          "isrc": "GBER71901876",
          "consumption": 947683
        },
        {
          "track": "This Place",
          "isrc": "UKWX82000136",
          "consumption": 9367
        }
      ]
    },
    {
      "artist": "UB40",
      "rank": 13,
      "consumption": 906043,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Red Red Wine",
          "isrc": "QM43A2201062",
          "consumption": 697383
        },
        {
          "track": "Cherry Oh Baby",
          "isrc": "QM43A2301193",
          "consumption": 208660
        }
      ]
    },
    {
      "artist": "Bad Omens",
      "rank": 14,
      "consumption": 853555,
      "isCollab": false,
      "watcherSlug": "bad-omens",
      "tracks": [
        {
          "track": "Just Pretend",
          "isrc": "USYFZ2264208",
          "consumption": 369074
        },
        {
          "track": "THE DEATH OF PEACE OF MIND",
          "isrc": "USYFZ2264204",
          "consumption": 262858
        },
        {
          "track": "Like A Villain",
          "isrc": "USYFZ2264206",
          "consumption": 105177
        }
      ]
    },
    {
      "artist": "David Kushner",
      "rank": 15,
      "consumption": 789342,
      "isCollab": false,
      "watcherSlug": "davidkushner",
      "tracks": [
        {
          "track": "Daylight",
          "isrc": "QZXDB2300005",
          "consumption": 789342
        }
      ]
    },
    {
      "artist": "Cigarettes After Sex",
      "rank": 16,
      "consumption": 784743,
      "isCollab": false,
      "watcherSlug": "cigarettesaftersex",
      "tracks": [
        {
          "track": "Apocalypse",
          "isrc": "USBQU1700034",
          "consumption": 318729
        },
        {
          "track": "Cry",
          "isrc": "USBQU1900121",
          "consumption": 275045
        },
        {
          "track": "Nothing's Gonna Hurt You Baby",
          "isrc": "TCACJ1593857",
          "consumption": 177915
        }
      ]
    },
    {
      "artist": "Dave, Burna Boy",
      "rank": 17,
      "consumption": 710537,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Location",
          "isrc": "GBUM71900578",
          "consumption": 710537
        }
      ]
    },
    {
      "artist": "Mark Ambor",
      "rank": 18,
      "consumption": 680521,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Belong Together",
          "isrc": "QM24S2400638",
          "consumption": 680521
        }
      ]
    },
    {
      "artist": "Village People",
      "rank": 19,
      "consumption": 647986,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "In The Navy",
          "isrc": "FR22F7900010",
          "consumption": 332105
        },
        {
          "track": "YMCA",
          "isrc": "FR22F8000900",
          "consumption": 315881
        }
      ]
    },
    {
      "artist": "D'Angello & Francis",
      "rank": 20,
      "consumption": 630320,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Blade",
          "isrc": "BEKO62400005",
          "consumption": 630320
        }
      ]
    },
    {
      "artist": "KayMuni",
      "rank": 21,
      "consumption": 630229,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "7AM",
          "isrc": "USZXT2660076",
          "consumption": 525835
        },
        {
          "track": "2000 Days",
          "isrc": "USZXT2658733",
          "consumption": 104394
        }
      ]
    },
    {
      "artist": "Julie Andrews",
      "rank": 22,
      "consumption": 620441,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Do-Re-Mi",
          "isrc": "USRC16406215",
          "consumption": 378334
        },
        {
          "track": "The Lonely Goatherd",
          "isrc": "USRC16406217",
          "consumption": 242107
        }
      ]
    },
    {
      "artist": "beabadoobee",
      "rank": 23,
      "consumption": 601927,
      "isCollab": false,
      "watcherSlug": "beabadoobee",
      "tracks": [
        {
          "track": "the perfect pair",
          "isrc": "GBK3W2202093",
          "consumption": 315464
        },
        {
          "track": "Real Man",
          "isrc": "GBK3W2402964",
          "consumption": 286463
        }
      ]
    },
    {
      "artist": "Fontaines D.C.",
      "rank": 24,
      "consumption": 582121,
      "isCollab": false,
      "watcherSlug": "fontainesdc",
      "tracks": [
        {
          "track": "I Love You",
          "isrc": "USBQU2100093",
          "consumption": 343884
        },
        {
          "track": "Roman Holiday",
          "isrc": "USBQU2100090",
          "consumption": 196602
        },
        {
          "track": "Jackie Down The Line",
          "isrc": "USBQU2100088",
          "consumption": 41635
        }
      ]
    },
    {
      "artist": "Zoe Wees",
      "rank": 25,
      "consumption": 574167,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Control",
          "isrc": "GB2DY2000093",
          "consumption": 574167
        }
      ]
    },
    {
      "artist": "Dave, Fredo",
      "rank": 26,
      "consumption": 561453,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Funky Friday",
          "isrc": "GBUM71806264",
          "consumption": 561453
        }
      ]
    },
    {
      "artist": "Van Morrison",
      "rank": 27,
      "consumption": 542792,
      "isCollab": false,
      "watcherSlug": "vanmorrisonofficial",
      "tracks": [
        {
          "track": "Brown Eyed Girl",
          "isrc": "USSM16700357",
          "consumption": 542792
        }
      ]
    },
    {
      "artist": "Lauv",
      "rank": 28,
      "consumption": 510071,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "I Like Me Better",
          "isrc": "GBWWP1702907",
          "consumption": 510071
        }
      ]
    },
    {
      "artist": "Morgan Wallen",
      "rank": 29,
      "consumption": 493318,
      "isCollab": false,
      "watcherSlug": "morganwallen",
      "tracks": [
        {
          "track": "Last Night",
          "isrc": "USUG12300802",
          "consumption": 412066
        },
        {
          "track": "Thinkin’ Bout Me",
          "isrc": "USUG12300821",
          "consumption": 81252
        }
      ]
    },
    {
      "artist": "Bo Burnham",
      "rank": 30,
      "consumption": 483520,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "1985",
          "isrc": "USA2P2225075",
          "consumption": 405556
        },
        {
          "track": "Welcome to The Internet",
          "isrc": "USA2P2122073",
          "consumption": 77964
        }
      ]
    },
    {
      "artist": "Joan Jett & the Blackhearts",
      "rank": 31,
      "consumption": 459720,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "I Love Rock 'N Roll",
          "isrc": "USBH18100118",
          "consumption": 416501
        }
      ]
    },
    {
      "artist": "Whiskey Myers",
      "rank": 32,
      "consumption": 436583,
      "isCollab": false,
      "watcherSlug": "whiskeymyers",
      "tracks": [
        {
          "track": "Broken Window Serenade",
          "isrc": "US2761001053",
          "consumption": 436583
        }
      ]
    },
    {
      "artist": "Chris Isaak",
      "rank": 33,
      "consumption": 432723,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Wicked Game",
          "isrc": "USRE19900989",
          "consumption": 308603
        },
        {
          "track": "Wicked Game",
          "isrc": "USRE10601455",
          "consumption": 124120
        }
      ]
    },
    {
      "artist": "Kenzo Str8Drop",
      "rank": 34,
      "consumption": 424264,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Trap Flow",
          "isrc": "USZXT2250119",
          "consumption": 355326
        },
        {
          "track": "Roads",
          "isrc": "USZXT2250250",
          "consumption": 68938
        }
      ]
    },
    {
      "artist": "Pop Smoke feat. Lil Tjay",
      "rank": 35,
      "consumption": 418470,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Mood Swings",
          "isrc": "USUM72013632",
          "consumption": 418470
        }
      ]
    },
    {
      "artist": "Michel Teló",
      "rank": 36,
      "consumption": 407706,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Ai Se Eu Te Pego",
          "isrc": "BRIMT1100076",
          "consumption": 407706
        }
      ]
    },
    {
      "artist": "Lex Amarni, 2muchmotion",
      "rank": 37,
      "consumption": 396396,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "the kill 2",
          "isrc": "QT6FE2517504",
          "consumption": 396396
        }
      ]
    },
    {
      "artist": "Ceechynaa",
      "rank": 38,
      "consumption": 392833,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Peggy",
          "isrc": "USZXT2456099",
          "consumption": 392833
        }
      ]
    },
    {
      "artist": "Andronicus",
      "rank": 39,
      "consumption": 352378,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Make You Whole",
          "isrc": "USA2P2619036",
          "consumption": 344202
        },
        {
          "track": "Make U Whole",
          "isrc": "UK2ME1300207",
          "consumption": 8176
        }
      ]
    },
    {
      "artist": "bbno$, Rich Brian",
      "rank": 40,
      "consumption": 352181,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "edamame",
          "isrc": "QMUY42100151",
          "consumption": 352181
        }
      ]
    },
    {
      "artist": "Mindless Self Indulgence",
      "rank": 41,
      "consumption": 351937,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Shut Me Up",
          "isrc": "US68L0500001",
          "consumption": 351937
        }
      ]
    },
    {
      "artist": "Fredo",
      "rank": 42,
      "consumption": 329497,
      "isCollab": false,
      "watcherSlug": "fredopg",
      "tracks": [
        {
          "track": "Scoreboard",
          "isrc": "USZXT2351626",
          "consumption": 329497
        }
      ]
    },
    {
      "artist": "Vybz Kartel",
      "rank": 43,
      "consumption": 323144,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Summer Time",
          "isrc": "USQY51113743",
          "consumption": 323144
        }
      ]
    },
    {
      "artist": "Pop Smoke feat. Lil Baby, DaBaby",
      "rank": 44,
      "consumption": 320109,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "For The Night",
          "isrc": "USUM72013355",
          "consumption": 320109
        }
      ]
    },
    {
      "artist": "KETTAMA",
      "rank": 45,
      "consumption": 316826,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "It Gets Better",
          "isrc": "USZXT2556641",
          "consumption": 316826
        }
      ]
    },
    {
      "artist": "CG5 feat. Chi-chi, Kathy-Chan, Cami-Cat",
      "rank": 46,
      "consumption": 314499,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Sleep Well",
          "isrc": "USA2P2406901",
          "consumption": 314499
        }
      ]
    },
    {
      "artist": "Original Koffee",
      "rank": 47,
      "consumption": 309552,
      "isCollab": false,
      "watcherSlug": "originalkoffee",
      "tracks": [
        {
          "track": "Toast",
          "isrc": "GBARL1801611",
          "consumption": 309552
        }
      ]
    },
    {
      "artist": "Twin S",
      "rank": 48,
      "consumption": 297015,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Mad About Beckton",
          "isrc": "NL8RL2586483",
          "consumption": 297015
        }
      ]
    },
    {
      "artist": "50 Cent",
      "rank": 49,
      "consumption": 289182,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "I'm The Man",
          "isrc": "USV6R1600001",
          "consumption": 289182
        }
      ]
    },
    {
      "artist": "Xavier Rudd",
      "rank": 50,
      "consumption": 283193,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Follow The Sun",
          "isrc": "AUUM71200073",
          "consumption": 258234
        },
        {
          "track": "Follow The Sun",
          "isrc": "AUUV71200016",
          "consumption": 24959
        }
      ]
    },
    {
      "artist": "Saint Levant, Marwan Moussa",
      "rank": 51,
      "consumption": 274944,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "KALAMANTINA /  كلمنتينا",
          "isrc": "USA2P2504697",
          "consumption": 274944
        }
      ]
    },
    {
      "artist": "Potter Payper",
      "rank": 52,
      "consumption": 272318,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Slumdog Millionaire",
          "isrc": "GB2GX2000094",
          "consumption": 272318
        }
      ]
    },
    {
      "artist": "The 1975",
      "rank": 53,
      "consumption": 266633,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "About You",
          "isrc": "GBK3W2202321",
          "consumption": 266633
        }
      ]
    },
    {
      "artist": "L.P. Rhythm",
      "rank": 54,
      "consumption": 261458,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Versatile",
          "isrc": "USA2P2532235",
          "consumption": 186763
        },
        {
          "track": "Versatile",
          "isrc": "QZDA42614253",
          "consumption": 74695
        }
      ]
    },
    {
      "artist": "SUICIDAL-IDOL",
      "rank": 55,
      "consumption": 259443,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "ecstacy",
          "isrc": "QZK6F2330686",
          "consumption": 259443
        }
      ]
    },
    {
      "artist": "Dave, Stormzy",
      "rank": 56,
      "consumption": 257134,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Clash",
          "isrc": "GBUM72103840",
          "consumption": 257134
        }
      ]
    },
    {
      "artist": "Ethan Walsh",
      "rank": 57,
      "consumption": 253844,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Too In Love With You",
          "isrc": "USA2P2532106",
          "consumption": 253844
        }
      ]
    },
    {
      "artist": "League of Legends Music, Against The Current",
      "rank": 58,
      "consumption": 244181,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Legends Never Die",
          "isrc": "QMAF31500062",
          "consumption": 244181
        }
      ]
    },
    {
      "artist": "aespa",
      "rank": 59,
      "consumption": 228561,
      "isCollab": false,
      "watcherSlug": "aespa",
      "tracks": [
        {
          "track": "Whiplash",
          "isrc": "KRA302400341",
          "consumption": 228561
        }
      ]
    },
    {
      "artist": "Nelle feat. Lizzy Beats",
      "rank": 60,
      "consumption": 223813,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "What's Going On",
          "isrc": "QZDA72326470",
          "consumption": 223813
        }
      ]
    },
    {
      "artist": "The Strumbellas",
      "rank": 61,
      "consumption": 219522,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Spirits",
          "isrc": "CA6MD1500001",
          "consumption": 219522
        }
      ]
    },
    {
      "artist": "Kurupt FM, Young Franco feat. Cassius",
      "rank": 62,
      "consumption": 209051,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Feelings",
          "isrc": "USA2P2627658",
          "consumption": 209051
        }
      ]
    },
    {
      "artist": "Dan Hill",
      "rank": 63,
      "consumption": 208785,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Sometimes When We Touch",
          "isrc": "CAOA82100080",
          "consumption": 208785
        }
      ]
    },
    {
      "artist": "Midas the Jagaban",
      "rank": 64,
      "consumption": 198448,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Party With A Jagaban",
          "isrc": "GB2DY2000549",
          "consumption": 198448
        }
      ]
    },
    {
      "artist": "Charmian Carr",
      "rank": 65,
      "consumption": 180647,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "So Long, Farewell",
          "isrc": "USRC16406218",
          "consumption": 180647
        }
      ]
    },
    {
      "artist": "Big Papa313, Morad, D-Block Europe",
      "rank": 66,
      "consumption": 179094,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "SEPA",
          "isrc": "USA2P2649087",
          "consumption": 179094
        }
      ]
    },
    {
      "artist": "Lucky Socks",
      "rank": 67,
      "consumption": 170884,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Belong Together",
          "isrc": "USA2P2417138",
          "consumption": 170884
        }
      ]
    },
    {
      "artist": "Tre Reynolds",
      "rank": 68,
      "consumption": 166793,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Don’t Go (Don’t Leave)",
          "isrc": "USA2P2609464",
          "consumption": 166793
        }
      ]
    },
    {
      "artist": "Cristian Marchi, Reverend Haus",
      "rank": 69,
      "consumption": 166395,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Fast Cars & Superstars",
          "isrc": "DEPI82324838",
          "consumption": 166395
        }
      ]
    },
    {
      "artist": "Digga",
      "rank": 70,
      "consumption": 163642,
      "isCollab": false,
      "watcherSlug": "diggadtv",
      "tracks": [
        {
          "track": "Let Them Know",
          "isrc": "USZXT2658998",
          "consumption": 57551
        },
        {
          "track": "Long Live",
          "isrc": "USZXT2558498",
          "consumption": 57430
        },
        {
          "track": "Badder Than Dem",
          "isrc": "USZXT2661638",
          "consumption": 48661
        }
      ]
    },
    {
      "artist": "KMFDM",
      "rank": 71,
      "consumption": 154358,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Bait & Switch",
          "isrc": "US57M0858002",
          "consumption": 154358
        }
      ]
    },
    {
      "artist": "Paul Anka",
      "rank": 72,
      "consumption": 152285,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Put Your Head On My Shoulder",
          "isrc": "US73K0500013",
          "consumption": 152285
        }
      ]
    },
    {
      "artist": "Mumford & Sons",
      "rank": 73,
      "consumption": 142840,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Little Lion Man",
          "isrc": "GBUM70909097",
          "consumption": 142840
        }
      ]
    },
    {
      "artist": "Yuna",
      "rank": 74,
      "consumption": 136540,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Someone Out Of Town",
          "isrc": "US4HB1000036",
          "consumption": 136540
        }
      ]
    },
    {
      "artist": "G Herbo",
      "rank": 75,
      "consumption": 134451,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Went Legit",
          "isrc": "USA2P2516245",
          "consumption": 134451
        }
      ]
    },
    {
      "artist": "John Summit",
      "rank": 76,
      "consumption": 134085,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "light years",
          "isrc": "USUG12404422",
          "consumption": 134085
        }
      ]
    },
    {
      "artist": "ACRAZE feat. Cherish",
      "rank": 77,
      "consumption": 131478,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Do It To It",
          "isrc": "QZFPL2100100",
          "consumption": 131478
        }
      ]
    },
    {
      "artist": "CG5",
      "rank": 78,
      "consumption": 126091,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Wrong Side Out",
          "isrc": "USA2P2604203",
          "consumption": 126091
        },
        {
          "track": "Masquerade Party",
          "isrc": "USA2P2646623",
          "consumption": 0
        }
      ]
    },
    {
      "artist": "MEOVV",
      "rank": 79,
      "consumption": 121820,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Hit 'Em",
          "isrc": "KSA002651340",
          "consumption": 121820
        }
      ]
    },
    {
      "artist": "Bandokay",
      "rank": 80,
      "consumption": 119597,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Next Up - S2-E14",
          "isrc": "GB2GX1900074",
          "consumption": 59802
        },
        {
          "track": "Next Up - S2-E14",
          "isrc": "GB2GX1900075",
          "consumption": 59795
        }
      ]
    },
    {
      "artist": "Azteck, DJ Koko, Kurt D",
      "rank": 81,
      "consumption": 119551,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Everything's Alright",
          "isrc": "USA2P2644570",
          "consumption": 119551
        }
      ]
    },
    {
      "artist": "D-Block Europe, French Montana",
      "rank": 82,
      "consumption": 114729,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Bad Bitch In London",
          "isrc": "USA2P2657649",
          "consumption": 38268
        },
        {
          "track": "Million Dollar Sign",
          "isrc": "USA2P2657646",
          "consumption": 28998
        },
        {
          "track": "Rips & fr33",
          "isrc": "USA2P2657643",
          "consumption": 23922
        }
      ]
    },
    {
      "artist": "Jelly Roll",
      "rank": 83,
      "consumption": 112872,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Save Me",
          "isrc": "USZHR2000088",
          "consumption": 112872
        }
      ]
    },
    {
      "artist": "Stromae, Pomme",
      "rank": 84,
      "consumption": 103553,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Ma Meilleure Ennemie",
          "isrc": "USA2P2459602",
          "consumption": 103553
        }
      ]
    },
    {
      "artist": "James Major",
      "rank": 85,
      "consumption": 100620,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "I Ain't Worried",
          "isrc": "ZAC012201057",
          "consumption": 100620
        }
      ]
    },
    {
      "artist": "Dave, Ruelle",
      "rank": 86,
      "consumption": 96570,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Lesley",
          "isrc": "GBUM71900583",
          "consumption": 96570
        }
      ]
    },
    {
      "artist": "GENER8ION, Yung Lean",
      "rank": 87,
      "consumption": 94494,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "STORM II",
          "isrc": "FRDWM2600170",
          "consumption": 94494
        }
      ]
    },
    {
      "artist": "Rudimental",
      "rank": 88,
      "consumption": 89960,
      "isCollab": false,
      "watcherSlug": "rudimentaluk",
      "tracks": [
        {
          "track": "Love You More",
          "isrc": "USA2P2565345",
          "consumption": 89960
        }
      ]
    },
    {
      "artist": "Dave, James Blake",
      "rank": 89,
      "consumption": 88269,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Both Sides Of A Smile",
          "isrc": "GBUM72104342",
          "consumption": 88269
        }
      ]
    },
    {
      "artist": "James Blake, Dave",
      "rank": 90,
      "consumption": 85719,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Doesn't Just Happen",
          "isrc": "USA2P2565570",
          "consumption": 85719
        }
      ]
    },
    {
      "artist": "REESE",
      "rank": 91,
      "consumption": 81008,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Where Have You Been",
          "isrc": "GBSXS2500005",
          "consumption": 81008
        }
      ]
    },
    {
      "artist": "Luka Malossi",
      "rank": 92,
      "consumption": 80599,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Talking Body",
          "isrc": "BAA052653788",
          "consumption": 80599
        }
      ]
    },
    {
      "artist": "duskydemise",
      "rank": 93,
      "consumption": 79252,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "bedrott",
          "isrc": "QT3FB2592943",
          "consumption": 79252
        }
      ]
    },
    {
      "artist": "mazie",
      "rank": 94,
      "consumption": 79092,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "dumb dumb",
          "isrc": "QZRYT2100001",
          "consumption": 79092
        }
      ]
    },
    {
      "artist": "Corinne Bailey Rae",
      "rank": 95,
      "consumption": 68466,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Put Your Records On",
          "isrc": "US9SH1000020",
          "consumption": 68466
        }
      ]
    },
    {
      "artist": "WARNIN UK",
      "rank": 96,
      "consumption": 66783,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Don't Panic",
          "isrc": "USA2P2614946",
          "consumption": 66783
        }
      ]
    },
    {
      "artist": "Bisken, Olympis",
      "rank": 97,
      "consumption": 62753,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Better Off Alone",
          "isrc": "USA2P2513643",
          "consumption": 62753
        }
      ]
    },
    {
      "artist": "K-Trap, W1ZZY",
      "rank": 98,
      "consumption": 61185,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "TRAP TALK",
          "isrc": "USA2P2637125",
          "consumption": 61185
        }
      ]
    },
    {
      "artist": "Ashnikko, Arcane, League of Legends",
      "rank": 99,
      "consumption": 59633,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Paint The Town Blue",
          "isrc": "USA2P2451928",
          "consumption": 59633
        }
      ]
    },
    {
      "artist": "Black Box",
      "rank": 100,
      "consumption": 58995,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Ride on Time",
          "isrc": "GBCMX0509001",
          "consumption": 58995
        }
      ]
    },
    {
      "artist": "D-Block Europe, French Montana feat. Max B",
      "rank": 101,
      "consumption": 54892,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Rich Low Life",
          "isrc": "USA2P2657647",
          "consumption": 54892
        }
      ]
    },
    {
      "artist": "Umaedo",
      "rank": 102,
      "consumption": 47196,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Body Moving",
          "isrc": "USA2P2618025",
          "consumption": 47196
        }
      ]
    },
    {
      "artist": "Hot'n'Juicy, Mousse T.",
      "rank": 103,
      "consumption": 46746,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Horny",
          "isrc": "DEP081900009",
          "consumption": 46746
        }
      ]
    },
    {
      "artist": "Richard O'Brien, Patricia Quinn, Nell Campbell, The Rocky Horror Picture Show",
      "rank": 104,
      "consumption": 46481,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "The Time Warp",
          "isrc": "USA371435763",
          "consumption": 46481
        }
      ]
    },
    {
      "artist": "Joan Jett & The Blackhearts",
      "rank": 105,
      "consumption": 45035,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Bad Reputation",
          "isrc": "USBH18000101",
          "consumption": 97721
        }
      ]
    },
    {
      "artist": "Montell Fish",
      "rank": 106,
      "consumption": 44517,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Bathroom",
          "isrc": "QZVBE2200015",
          "consumption": 44517
        }
      ]
    },
    {
      "artist": "Adventures Of Stevie V",
      "rank": 107,
      "consumption": 42376,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Dirty Cash (Money Talks) (Dime & Dollar Mix (7\" Edit))",
          "isrc": "GBDGN0900050",
          "consumption": 42376
        }
      ]
    },
    {
      "artist": "Frenna",
      "rank": 108,
      "consumption": 40878,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "COCA BODY",
          "isrc": "NLG662600314",
          "consumption": 40878
        }
      ]
    },
    {
      "artist": "CZARFACE, Frankie Pulitzer, Method Man",
      "rank": 109,
      "consumption": 35606,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Mad Technology",
          "isrc": "USA2P2628112",
          "consumption": 35606
        }
      ]
    },
    {
      "artist": "K-Trap",
      "rank": 110,
      "consumption": 34033,
      "isCollab": false,
      "watcherSlug": "k-trap",
      "tracks": [
        {
          "track": "SHOOTERS BE",
          "isrc": "USA2P2637121",
          "consumption": 17378
        },
        {
          "track": "GREEDY GUY",
          "isrc": "USA2P2637124",
          "consumption": 16655
        },
        {
          "track": "CAN'T RELATE",
          "isrc": "USA2P2637122",
          "consumption": 0
        }
      ]
    },
    {
      "artist": "J.I the Prince of N.Y",
      "rank": 111,
      "consumption": 29951,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Need Me",
          "isrc": "QZHN31903261",
          "consumption": 29951
        }
      ]
    },
    {
      "artist": "Daya",
      "rank": 112,
      "consumption": 28982,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Hide Away",
          "isrc": "QM4ZV1500057",
          "consumption": 28982
        }
      ]
    },
    {
      "artist": "CG5, Horror Skunx",
      "rank": 113,
      "consumption": 28184,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "your verity",
          "isrc": "USA2P2667185",
          "consumption": 28184
        }
      ]
    },
    {
      "artist": "Gareth",
      "rank": 114,
      "consumption": 26911,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Wherever You Will Go",
          "isrc": "QZVQW2400007",
          "consumption": 26911
        }
      ]
    },
    {
      "artist": "Chris Brown",
      "rank": 115,
      "consumption": 26401,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "With You",
          "isrc": "USJI10700711",
          "consumption": 26401
        }
      ]
    },
    {
      "artist": "DREAMDNVR",
      "rank": 116,
      "consumption": 26302,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Waves",
          "isrc": "SE59E2100163",
          "consumption": 26302
        }
      ]
    },
    {
      "artist": "Delerium",
      "rank": 117,
      "consumption": 25590,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Silence",
          "isrc": "BE5KW2500717",
          "consumption": 25590
        }
      ]
    },
    {
      "artist": "Harsh Nussi",
      "rank": 118,
      "consumption": 24150,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Sadi Sun",
          "isrc": "QM6N22638043",
          "consumption": 24150
        }
      ]
    },
    {
      "artist": "The Royston Club",
      "rank": 119,
      "consumption": 24111,
      "isCollab": false,
      "watcherSlug": "the-royston-club-topic",
      "tracks": [
        {
          "track": "Cariad",
          "isrc": "USZXT2556781",
          "consumption": 24111
        }
      ]
    },
    {
      "artist": "Ashe",
      "rank": 120,
      "consumption": 23107,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Moral of the Story",
          "isrc": "USQE91500884",
          "consumption": 23107
        }
      ]
    },
    {
      "artist": "ZULAN",
      "rank": 121,
      "consumption": 18485,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Forever",
          "isrc": "USA2P2516737",
          "consumption": 18485
        }
      ]
    },
    {
      "artist": "K-Trap, Young Adz",
      "rank": 122,
      "consumption": 18423,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "CAN'T SAY NO",
          "isrc": "USA2P2628675",
          "consumption": 18423
        }
      ]
    },
    {
      "artist": "Olivia Newton-John feat. John Travolta",
      "rank": 123,
      "consumption": 17954,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "You're The One That I Want",
          "isrc": "QZUDB2200118",
          "consumption": 17954
        }
      ]
    },
    {
      "artist": "Qura, pipenpodol",
      "rank": 124,
      "consumption": 17596,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Jane!",
          "isrc": "USA2P2657468",
          "consumption": 17596
        }
      ]
    },
    {
      "artist": "Twenty One Pilots, Arcane, League of Legends",
      "rank": 125,
      "consumption": 17238,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "The Line",
          "isrc": "USA2P2459604",
          "consumption": 17238
        }
      ]
    },
    {
      "artist": "jigitz",
      "rank": 126,
      "consumption": 16347,
      "isCollab": false,
      "watcherSlug": "jigitz",
      "tracks": [
        {
          "track": "tell you straight",
          "isrc": "USA2P2503037",
          "consumption": 16347
        }
      ]
    },
    {
      "artist": "beabadoobee feat. The Marías",
      "rank": 127,
      "consumption": 15781,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "All I Did Was Dream of You (feat. The Marías)",
          "isrc": "USA2P2532105",
          "consumption": 15781
        }
      ]
    },
    {
      "artist": "Kavinsky",
      "rank": 128,
      "consumption": 15111,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Nightcall",
          "isrc": "FRS710900410",
          "consumption": 15111
        }
      ]
    },
    {
      "artist": "Jengi",
      "rank": 129,
      "consumption": 14653,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Things We Do",
          "isrc": "BE5KW2400538",
          "consumption": 14653
        }
      ]
    },
    {
      "artist": "Otto Knows",
      "rank": 130,
      "consumption": 14640,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Lover",
          "isrc": "BE5KW2200075",
          "consumption": 14640
        }
      ]
    },
    {
      "artist": "Olivia Newton-John",
      "rank": 131,
      "consumption": 14211,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Hopelessly Devoted To You",
          "isrc": "QZUDB2200115",
          "consumption": 14211
        }
      ]
    },
    {
      "artist": "Clavish",
      "rank": 132,
      "consumption": 13867,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Greatest Rapper Alive",
          "isrc": "USZXT2659325",
          "consumption": 13867
        }
      ]
    },
    {
      "artist": "DJ Frass",
      "rank": 133,
      "consumption": 12295,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Good Comfort",
          "isrc": "GB2DY2000268",
          "consumption": 12295
        }
      ]
    },
    {
      "artist": "Tim Curry, The Rocky Horror Picture Show",
      "rank": 134,
      "consumption": 11013,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Sweet Transvestite",
          "isrc": "USA560853993",
          "consumption": 11013
        }
      ]
    },
    {
      "artist": "Joan Jett",
      "rank": 135,
      "consumption": 9467,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": []
    },
    {
      "artist": "VALORANT Music, Grabbitz, Oli Sykes, Courtney LaPlante",
      "rank": 136,
      "consumption": 9106,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "If The Sun Burns Out Tonight",
          "isrc": "QZH6S1901240",
          "consumption": 9106
        }
      ]
    },
    {
      "artist": "Poppy, Amy Lee, Courtney LaPlante",
      "rank": 137,
      "consumption": 8974,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "End of You",
          "isrc": "USYFZ2560801",
          "consumption": 8974
        }
      ]
    },
    {
      "artist": "Katrina",
      "rank": 138,
      "consumption": 8014,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Walking On Sunshine",
          "isrc": "GBSJM1100517",
          "consumption": 8014
        }
      ]
    },
    {
      "artist": "Pinegrove",
      "rank": 139,
      "consumption": 7878,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Need 2",
          "isrc": "TCACJ1513588",
          "consumption": 7878
        }
      ]
    },
    {
      "artist": "Saad Lamjarred, Shreya Ghoshal, Rajat Nagpal",
      "rank": 140,
      "consumption": 7837,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Guli Mata",
          "isrc": "USA2P2331239",
          "consumption": 7837
        }
      ]
    },
    {
      "artist": "Meekz",
      "rank": 141,
      "consumption": 7782,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "Sweeping Up",
          "isrc": "GB2GX2000016",
          "consumption": 7782
        }
      ]
    },
    {
      "artist": "Big Dog Yogo",
      "rank": 142,
      "consumption": 7695,
      "isCollab": false,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "On Smoke",
          "isrc": "QZDA52143840",
          "consumption": 7695
        }
      ]
    },
    {
      "artist": "K-Trap, Headie One",
      "rank": 143,
      "consumption": 0,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "MYSTERY BOX",
          "isrc": "USA2P2612857",
          "consumption": 0
        }
      ]
    },
    {
      "artist": "John Summit, Absolutely",
      "rank": 144,
      "consumption": 0,
      "isCollab": true,
      "watcherSlug": null,
      "tracks": [
        {
          "track": "DON'T BELIEVE IT",
          "isrc": "USA2P2605967",
          "consumption": 0
        }
      ]
    },
    {
      "artist": "Nickelback",
      "rank": 145,
      "consumption": 0,
      "isCollab": false,
      "watcherSlug": "nickelback",
      "tracks": [
        {
          "track": "Leave Me Behind",
          "isrc": "USA2P2638446",
          "consumption": 0
        }
      ]
    }
  ]
};
