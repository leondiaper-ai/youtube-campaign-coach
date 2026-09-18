/* ═══════════════════════════════════════════════════════════════════
   A SECOND PUBLISHING SURFACE — shared by every page that shows a
   campaign-cover payload
   ═══════════════════════════════════════════════════════════════════

   Some campaigns do not run entirely on the artist's own channel.
   Palaye Royale is the case that forced this: the official videos for
   Feel Something, Great. and Sad Generation are on Sumerian Records, so
   anything reading only the artist channel is missing the hero. A
   campaign is the sum of its assets, wherever they were published.

   ── WHY IT IS ITS OWN FILE ─────────────────────────────────────────
   It started inside the live deck's own renderer, which meant the deck
   read 37,849 views across 2 assets while the Intelligence Hub — same
   campaign, same endpoint, one click away — read 23,022 across 1. Two
   true numbers for one thing is indistinguishable from a broken one.
   The merge is a fact about the campaign, not about one page's
   rendering, so it lives where every surface can apply the same one.

   The right long-term home is /api/campaign-cover itself, so that no
   surface has to remember to call this. That is a larger change to a
   route CHVRCHES and Kings of Leon depend on, and it is not made
   casually — this file is the correct shape for it when it moves.

   ── WHAT IT WILL NOT DO ────────────────────────────────────────────
   It never brings the second channel's OWN performance across. Sumerian
   has 3,664 uploads and almost none are Palaye; pulling a label's
   channel totals into an artist's campaign would be the most misleading
   thing this layer could do. Only uploads label-watch has confidently
   tied to the artist — the artist's name in the video TITLE — are
   merged. The `flagged` list, which exists so a human can confirm the
   uncertain ones, is not read here and never reaches a page.

   ── AND WHY IT IS NOT A HEADLINE ───────────────────────────────────
   Once merged, an asset is just a campaign asset. Each names where it
   was published, in the metadata line it already had. There is no
   per-channel statistic, no comparison and no panel: which channel a
   video sits on is a fact about the campaign, not the subject.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

/* Keyed by the slug /api/campaign-cover knows. An artist absent from
   here is untouched by every line below — CHVRCHES and Kings of Leon
   execute none of it. */
const SURFACES = {
  palayeroyale: {
    label: '@sumerianrecords',
    artist: 'Palaye Royale',
    sourceName: 'Sumerian Records',
  },
};

const API = 'https://youtube-campaign-coach.vercel.app/api/label-watch';

/* How many supporting stills the gallery shows beside the hero. */
const MAX_GALLERY = 9;

/* Small counts read better as words in a sentence than as digits. */
const WORD = ['no','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten'];
const count = n => WORD[n] || String(n);

/* "2 October". Full month, because this one appears inside a sentence
   rather than in a metadata line, and "2 OCT" mid-prose reads as a
   field rather than as a date. UTC throughout, like every other date
   here. */
const longDate = iso => {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return `${d.getUTCDate()} ${d.toLocaleDateString('en-GB',
    { month: 'long', timeZone: 'UTC' })}`;
};

const shortDate = iso => {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return `${d.getUTCDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })
    .slice(0, 3).toUpperCase()}`;
};

/* A matched label upload, in the shape the cover's renderers already
   speak. Aspect is derived from duration: a vertical asset framed 16:9
   puts YouTube's baked-in pillarbox back into the picture. */
function labelAsset(m, sourceName) {
  const short = typeof m.durationSec === 'number' && m.durationSec > 0 && m.durationSec <= 62;
  return {
    videoId: m.videoId,
    title: m.title || '',
    publishedAt: m.publishedAt,
    dateLabel: shortDate(m.publishedAt),
    formatLabel: String(m.formatLabel || (short ? 'Short' : 'Video')).toUpperCase(),
    views: typeof m.views === 'number' ? m.views : null,
    aspect: short ? 'portrait' : 'landscape',
    sourceAspect: short ? 'portrait' : 'landscape',
    kind: short ? 'short' : 'video',
    thumb: `https://i.ytimg.com/vi/${m.videoId}/maxresdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${m.videoId}`,
    source: sourceName,
    role: 'supporting',
  };
}

/* ── A DATE THE LABEL PUBLISHED ITSELF ────────────────────────────────
   Release dates reach a page one of two ways: from the campaign plan,
   which is what a person entered, or from the campaign's own posts,
   which is what the world has been told. The second is evidence —
   Sumerian's announcement carries "out Oct. 2nd!" in its title, a
   published date where the plan holds none.

   Read only out of a CONFIDENTLY matched post, labelled with the
   channel that said it, and absent entirely if the pattern is not
   there. No date is ever inferred from a description or a guess at a
   release cycle. */
const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

function momentFromPost(m, sourceName) {
  const dm = (m.title || '').match(/\bout\s+([A-Z][a-z]{2,8})\.?\s+(\d{1,2})(?:st|nd|rd|th)?/);
  if (!dm) return null;
  const mi = MONTHS.indexOf(dm[1].slice(0, 3).toLowerCase());
  if (mi < 0) return null;
  /* Built in UTC, deliberately. `new Date('Oct 2, 2026')` is LOCAL
     midnight and every date label here is read in UTC, so east of
     Greenwich the two disagree and a 2 October release prints as 1
     October. A date the label published is worth getting right. */
  const when = new Date(Date.UTC(
    new Date(m.publishedAt).getUTCFullYear(), mi, Number(dm[2])));
  if (isNaN(when)) return null;
  /* A date already gone is history, not what's next. */
  if (when.getTime() < Date.now() - 864e5) return null;
  const q = (m.title || '')
    .match(/['"‘’“”]([^'"‘’“”]{2,60})['"‘’“”]/);
  return {
    kind: 'NEXT',
    provenance: 'CONFIRMED',
    date: when.toISOString().slice(0, 10),
    dateLabel: shortDate(when.toISOString()),
    title: q ? q[1] : 'Single',
    detail: `Single · date stated by ${sourceName}`,
    stage: null,
    asset: null,
  };
}

/**
 * Merge an artist's second publishing surface into a campaign-cover
 * payload, IN PLACE. Resolves to the payload either way, so a caller
 * can await it unconditionally.
 *
 * Artists with no configured second surface return untouched, which is
 * every artist but one.
 */
async function merge(d) {
  const cfg = d && d.artist && SURFACES[d.artist.slug];
  if (!cfg) return d;

  const start = d.metrics && d.metrics.campaignStart && d.metrics.campaignStart.at;
  const url = `${API}?label=${encodeURIComponent(cfg.label)}`
    + `&artist=${encodeURIComponent(cfg.artist)}`
    + (start ? `&since=${encodeURIComponent(start)}` : '');

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  let w;
  try {
    const r = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    if (!r.ok) return d;
    w = await r.json();
  } catch {
    /* An unreachable second surface is a gap in what we can see, not a
       finding. The page shows the artist channel's campaign, which is
       true, just not complete — and says nothing it cannot support. */
    return d;
  } finally { clearTimeout(t); }
  if (!w || !w.available) return d;

  const sourceName = cfg.sourceName || w.labelTitle || cfg.label;
  const artistName = (d.artist && d.artist.name) || cfg.artist;

  /* Every asset now names its channel, including the artist's own.
     Labelling only the imported ones would read as though the label
     uploads were the exception rather than half the campaign. */
  const a = d.assets || (d.assets = { heroes: [], supporting: [], total: 0 });
  const own = [].concat(a.heroes || [], a.supporting || [])
    .map(x => Object.assign({}, x, { source: x.source || artistName }));

  const imported = (w.matched || []).map(m => labelAsset(m, sourceName));
  if (!imported.length && !own.length) return d;

  /* What the server's campaignViews already covers. Anything with one of
     these ids is not new money, however many times it arrives. */
  const ownIds = new Set(own.map(x => x.videoId));

  /* ── ONE VIDEO, ONE PLACE ──────────────────────────────────────────
     Deduplicated on YouTube video id, which is the only identifier that
     cannot drift: a title can be edited, a thumbnail can be replaced,
     and the same upload reaches this function from two lists (the
     cover's heroes and its supporting set overlap, and a label match can
     restate an asset the artist channel already published). Two cards
     for one video reads as two pieces of campaign activity, which
     inflates what the page appears to show.

     Genuinely separate uploads from the two channels are NOT duplicates
     and both stay — they have different ids, and each names its own
     source in its metadata. */
  const seen = new Set();
  const unique = xs => xs.filter(x => {
    if (!x || !x.videoId || seen.has(x.videoId)) return false;
    seen.add(x.videoId);
    return true;
  });

  /* Newest first BY DAY, and within a day the asset that travelled
     furthest leads. Palaye's two assets went out on 15 September seven
     minutes apart, and to-the-minute sorting handed the lead slot to
     whichever published second. Seven minutes should not decide a
     campaign's lead asset; the view count is the better answer and it
     is observed rather than chosen. */
  const day = x => {
    const t2 = Date.parse(x.publishedAt || x.date || 0);
    return isNaN(t2) ? 0 : Math.floor(t2 / 864e5);
  };
  const all = unique(own.concat(imported))
    .sort((x, y) => day(y) - day(x) || (y.views || 0) - (x.views || 0));

  /* ONE hero, as everywhere else. The lead asset is the campaign's
     picture; the rest are the evidence it has been working. */
  a.heroes = all.slice(0, 1).map(x => Object.assign(x, { role: 'hero' }));

  /* The gallery is a SELECTION, not an inventory. A campaign that ends
     up posting every other day would otherwise turn this strip into a
     scroll of near-identical Shorts, and the argument it is making —
     this channel is being run — stops landing somewhere around the
     twelfth thumbnail. The strip already prints "+N" for what it is not
     showing, from `total`, so nothing is hidden: the count stays whole
     while the picture stays readable.

     Totals are unaffected. Campaign views and campaign assets are
     computed from `all` below, every verified asset included. */
  a.supporting = all.slice(1, 1 + MAX_GALLERY)
    .map(x => Object.assign(x, { role: 'supporting' }));
  a.total = all.length;

  if (!imported.length) return d;

  const m = d.metrics || (d.metrics = {});
  /* Summed off the DEDUPED list, not off the raw matches. Summing the
     matches counted a video twice when the same upload arrived from both
     channels' lists — 52,676 views from two cards showing one video. */
  const addViews = all
    .filter(x => !ownIds.has(x.videoId))
    .reduce((t2, x) => t2 + (x.views || 0), 0);
  if (typeof m.campaignViews === 'number') m.campaignViews += addViews;
  else if (addViews) m.campaignViews = addViews;
  m.campaignAssets = all.length;
  m.campaignShorts = all.filter(x => x.aspect === 'portrait' || x.kind === 'short').length;
  m.campaignLongForm = all.length - m.campaignShorts;
  m.newUploads = all.length;

  /* A date the label has published, if it published one. */
  const tl = d.timeline;
  let stated = null;
  if (tl && Array.isArray(tl.moments)) {
    const known = new Set(tl.moments.map(x => x.date));
    for (const post of (w.matched || [])) {
      const mo = momentFromPost(post, sourceName);
      if (!mo || known.has(mo.date)) continue;
      known.add(mo.date);
      tl.moments.push(mo);
      if (!stated) stated = mo;
    }
    /* Forward moments render in the order given, so re-sort. */
    tl.moments.sort((x, y) => Date.parse(x.date || 0) - Date.parse(y.date || 0));
  }

  /* ── THE CAMPAIGN READ ─────────────────────────────────────────────
     The server writes this line knowing only the artist channel, and it
     writes it defensively — "nobody has confirmed whether this is the
     campaign starting" — which is the right posture when all you can see
     is uploads appearing on one channel with nothing dated ahead of
     them. Once the label's own post supplies a release date, that is no
     longer the situation: there IS something to lead into, and hedging
     against it reads as a system that has not noticed.

     Still assembled from observation rather than typed: the count, the
     formats, the single's name and its date all come from the merged
     payload, so the sentence moves as the campaign does and disappears
     rather than going stale if the evidence for it does. */
  if (d.read && stated) {
    const shorts = all.filter(x => x.aspect === 'portrait' || x.kind === 'short').length;
    const what = shorts === all.length
      ? `Short${all.length === 1 ? '' : 's'}`
      : `asset${all.length === 1 ? '' : 's'}`;
    d.read.line = `${count(all.length)} new ${what} have appeared ahead of `
      + `${stated.title} on ${longDate(stated.date)}. `
      + `We're tracking activity from here.`;
  } else if (d.read && typeof d.read.line === 'string') {
    /* No published date to lead into, so the server's careful wording
       stands; only the upload count it could not know is corrected. */
    d.read.line = d.read.line.replace(/^\d+ uploads?\b/,
      `${all.length} upload${all.length === 1 ? '' : 's'}`);
  }

  /* One line, for wherever the assets are shown. */
  d.assetNote = `Campaign activity includes ${artistName}'s artist channel and `
    + `${artistName}-related uploads published via ${sourceName}.`;

  return d;
}

window.CampaignSecondSurface = { merge, surfaces: SURFACES };

})();
