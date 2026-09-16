/* ═══════════════════════════════════════════════════════════════════
   THE LIVE CAMPAIGN HOME — shared behaviour
   ═══════════════════════════════════════════════════════════════════

   One fetch of /api/campaign-cover becomes three things: the campaign
   home that opens the deck, the playbook, and the reference board. Every
   value on all three comes out of that response; nothing below decides
   what is true, only how it reads.

   THE POINT OF THE FILE. This layer was written for CHVRCHES and worked.
   The question Kings of Leon asks is whether it was a product or one
   elaborate artist page, and the answer has to be demonstrated rather
   than asserted — so it moved here unchanged, and the second artist is a
   config object and two script tags. What is artist-specific lives in the
   rollout plan and the Deep Dive, server-side, where it belongs. What is
   campaign-specific arrives from the API. What is left is this, and this
   has no artist in it.

   Two campaigns at opposite ends of the same model prove it: one walking
   towards a first hero and asking how to make it an event, one four days
   past a hero and asking what lands next. Same composition, same code,
   different page, because the DATA is different rather than the template.

   WHAT THE HOST MUST PROVIDE — window.LIVE_DECK = {
     slug,           the artist slug the API knows
     api,            the campaign-cover endpoint
     fallbackImage,  a video id to fall back to when a campaign has
                     published nothing of its own yet
     host: { resetSlides, observeAll, updateProgress }
   }
   The three host callbacks exist because the deck owns its own scroll
   observers and progress counter, and this layer changes how many slides
   there are. They may be no-ops.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

const CFG = window.LIVE_DECK || {};
const HOST = Object.assign(
  { resetSlides(){}, observeAll(){}, updateProgress(){} },
  CFG.host || {},
);

/* Self-contained, so a host deck needs no particular helpers of its own. */
const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => n == null ? '—'
  : n >= 1e9 ? (n / 1e9).toFixed(2) + 'BN'
  : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M'
  : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n);
const yt = id => `https://www.youtube.com/watch?v=${id}`;
/* The deck's full-bleed background image. Defined here rather than borrowed
   from the host, because borrowing it is how this module shipped depending
   on a helper that happened to exist in one deck and not the other. */
const bleedImg = (id, cls = '') =>
  `<div class="bleed${cls ? ' ' + cls : ''}"><img src="${ytThumb(id)}" alt=""`
  + ` onerror="${ytFallback(id)}"></div>`;

/* ═══════════════════════════════════════════════════════════════════
   THE LIVE CAMPAIGN COVER

   Watcher knows this artist has a strategic baseline and when it was
   captured. Everything after that date is new. This block asks the
   campaign-cover endpoint what has happened since, and if the campaign
   has started it puts a new first slide in front of the deck.

   ── WHY IT RENDERS AFTER THE DECK, NOT BEFORE ──────────────────────
   The deck must never depend on a network call to exist. It renders
   completely and synchronously first; the cover is prepended when and
   if the data arrives. A slow API, an outage or a stale deploy all
   produce the deck exactly as it has always been, which is the correct
   degradation for a document people present from.

   ── THE ONE CLAIM IT WILL NOT MAKE ─────────────────────────────────
   The endpoint distinguishes CAMPAIGN_LIVE from NEW_ACTIVITY, and so
   does the copy here. Uploads appearing is observation. A campaign
   having started is something a person confirmed.
   ═══════════════════════════════════════════════════════════════════ */

const COVER_API = CFG.api || 'https://youtube-campaign-coach.vercel.app/api/campaign-cover';
let LIVE = null;

const nf = n => n == null ? '—' : n.toLocaleString('en-GB');
/* Big numbers want a shape, not nine digits: +3.05M reads instantly. */
const compact = n => {
  if (n == null) return '—';
  const a = Math.abs(n), s = n < 0 ? '-' : '+';
  if (a >= 1e6) return `${s}${(a/1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}${Math.round(a/1e3)}K`;
  return `${s}${a}`;
};

/* ── THE CAMPAIGN CREATIVE ────────────────────────────────────────────
   Shape follows the OBSERVED aspect; the LABEL follows editorial role.
   A vertical asset a human has renamed TRAILER is still vertical, and
   framing it 16:9 would put YouTube's baked-in pillarbox straight back
   into the picture — but it is still a trailer, and the page says so. */
function heroAsset(a){
  const wide = (a.aspect ? a.aspect === 'landscape' : a.kind !== 'short') ? ' wide' : '';
  /* The frame and the pixels can disagree — a trailer shot vertically and
     shown landscape. When they do, the crop rule has to know. */
  const src  = a.sourceAspect === 'portrait' ? ' src-portrait' : '';
  return `<a class="ha${wide}${src}" href="${a.url}" target="_blank" rel="noopener">
    <div class="ha-img">
      <img src="${a.thumb}" alt="${esc(a.title)}" loading="lazy"
           onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${a.videoId}/hqdefault.jpg'">
    </div>
    <div class="ha-cap">
      <div class="ha-t">${esc(a.title)}</div>
      <div class="ha-m">${a.dateLabel} · ${a.formatLabel}${
        a.views != null ? ` · <b>${nf(a.views)}</b> views` : ''}</div>
    </div>
  </a>`;
}

/* ── NEXT ─────────────────────────────────────────────────────────────
   Three lines of campaign time. The Coach holds the whole schedule —
   five dated releases through to January — and this surfaces only the
   dates that explain where the campaign is: the next moment, the window
   our own strategy asks for after it, and the album it all lands on.

   The recommended window is drawn in cyan and says so. A recommendation
   set in the same type as a confirmed date is how a page ends up telling
   a label the artist team agreed to something they have never seen.   */
function buildNext(tl){
  if(!tl || !tl.moments) return '';
  const rows = [];

  /* Server order, not a fixed NEXT / WINDOW / ANCHOR sequence.

     This used to pick the three rows out by kind, which quietly imposed a
     derivation order on a list headed "What's next": for a campaign four
     days past its hero, that printed 2 OCT above the 17-24 SEP window. The
     API now sorts its forward moments chronologically, and this renders
     them in the order it was given. */
  const FORWARD = { NEXT:1, WINDOW:1, ANCHOR:1 };
  for(const m of tl.moments){
    if(!FORWARD[m.kind]) continue;

    /* Anything not confirmed says so, in the same small italic on every
       row. A recommendation and a tentative date are different claims from
       a booking, and they are only honest if they are labelled. */
    const soft = m.provenance === 'RECOMMENDED' || m.provenance === 'TENTATIVE'
      ? ` · <em>${esc(m.provenance.toLowerCase())}</em>` : '';

    if(m.kind === 'WINDOW'){
      /* Date and window name on one line, the formats it is asking for on
         the next. A reader should not have to open Ideas to see what could
         go in the fortnight. */
      rows.push(['rec', `${m.dateLabel} · ${(m.stage || 'Follow-up window').toUpperCase()}`,
        esc(m.title) + soft]);
    } else if(m.kind === 'ANCHOR'){
      rows.push(['dim', `${m.dateLabel} · ALBUM`,
        esc(m.title) + (tl.betweenNote ? ` · ${esc(tl.betweenNote)}` : '') + soft]);
    } else {
      rows.push(['', `${m.dateLabel} · ${m.title.toUpperCase()}`,
        esc(m.detail || m.stage || '') + soft]);
    }
  }

  if(!rows.length) return '';
  return `<div class="next stagger">
    <div class="label" style="margin-bottom:.6rem">What's next</div>
    ${rows.map(([c,d,t])=>`<div class="nx ${c}">
      <div class="nx-d">${esc(d)}</div><div class="nx-t">${t}</div></div>`).join('')}
  </div>`;
}

/* ── THE CAMPAIGN'S PERMANENT IDENTITY ────────────────────────────────
   Three lines that do three different jobs, and only one of them is a
   headline.

     CHVRCHES × YOUTUBE   who and where. The deck's existing identifier.
     ALL THE KING'S MEN   the campaign this page is the home of.
     THE YOUTUBE CAMPAIGN what this environment is, for someone opening
                          the URL cold who has never heard of Watcher.

   The album name comes from the Coach plan, so it is the campaign the
   team is actually running rather than a string typed into a deck. When
   there is no album in the plan the middle line simply is not there and
   the page carries the artist identifier alone — which is correct, not a
   degraded state.

   This stays put as the campaign moves. Everything below it changes. */
function campaignIdentity(d, small){
  const c = d && d.campaign;
  const artist = (d && d.artist && d.artist.name) || 'CHVRCHES';

  /* On the Ideas slides the identity is a signature, not a title page —
     those slides have to carry four ideas with their evidence, and three
     stacked lines of masthead was eating the room the content needed.
     Same words, one line. */
  if (small) {
    return `<div class="ident-line reveal">${esc(artist)}
      <span style="color:var(--signal)">× YouTube</span>${
        c && c.name ? ` &nbsp;·&nbsp; <b>${esc(c.name)}</b>` : ''}</div>`;
  }

  return `<div class="ident reveal">
    <div class="ident-a" style="font-size:clamp(1.25rem,3.1vw,2.3rem)">${esc(artist)}
      <span style="color:var(--signal)">× YouTube</span></div>
    ${c && c.name ? `<div class="ident-c"
      style="font-size:clamp(2rem,5.8vw,4.25rem)">${esc(c.name)}</div>` : ''}
    <div class="ident-k">The YouTube campaign</div>
  </div>`;
}

/* ── THE CAMPAIGN'S WORLD ─────────────────────────────────────────────
   The two heroes are the argument. These are the evidence that a channel
   is being run — sixteen countdown Shorts in thirty-three days is not
   sixteen things to read, it is a shape, and the shape only arrives if
   you can see them all at once.

   So: stills, no captions, no view counts. Every caption added here made
   it a second asset list competing with the one above it. The date lives
   in the tooltip for anyone who wants it, and the strip itself says the
   thing that matters — this campaign has been working. */
function assetStrip(rest, total, shownAbove){
  if(!rest || !rest.length) return '';
  const hidden = Math.max(0, (total || 0) - shownAbove - rest.length);
  return `<div class="strip stagger">
    ${rest.map(a => `<a class="sti${a.sourceAspect === 'portrait' ? ' sti-p' : ''}"
      href="${a.url}" target="_blank" rel="noopener"
      title="${esc(a.dateLabel)} · ${esc(a.formatLabel)} · ${esc(a.title)}">
      <img src="${a.thumb}" alt="" loading="lazy"
           onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${a.videoId}/hqdefault.jpg'">
    </a>`).join('')}
    ${hidden ? `<span class="sti sti-more">+${hidden}</span>` : ''}
  </div>`;
}

/* ── FAN RESPONSE ─────────────────────────────────────────────────────
   Three lines under the campaign read: a label, the fans' own words (or a
   themed headline when no comment safely qualifies), and one short
   interpretation. Subordinate to the read above it by design — this is a
   pulse of audience colour, not a second argument.

   It renders ONLY when the server says display:true. Every judgement about
   whether the evidence is strong enough, positive enough, fresh enough and
   safe enough has already happened server-side; this function's entire
   contract is "print it or print nothing".

   There is deliberately no negative, neutral, warning or empty state. When
   the evidence does not support an encouraging read the block is absent —
   omission, not reinterpretation. The real classification stays in the
   payload for Watcher and the Coach. */
function buildFanResponse(fr){
  if (!fr || !fr.display || !fr.headline || !fr.line) return '';
  const count = typeof fr.commentCount === 'number' && fr.commentCount > 0
    ? ` · ${fr.commentCount.toLocaleString()} comments` : '';
  return `<div class="fanresp reveal">
    <div class="fr-k">Fan response${count}</div>
    <div class="fr-h">${esc(fr.headline)}</div>
    <div class="fr-l">${esc(fr.line)}</div>
  </div>`;
}

function buildLiveCover(d){
  const live = d.state === 'CAMPAIGN_LIVE';
  const m = d.metrics || {};
  const heroes = (d.assets && d.assets.heroes) || [];
  const tl = d.timeline || null;

  /* Two figures, each stating the period it covers, on itself.
     A delta with no window is not a measurement — and these two windows
     are NOT the same length, because subscriber readings in the snapshot
     series are coarser than view readings. One line underneath saying
     "since the Deep Dive" was quietly wrong about at least one of them.

     The dormancy figure has left this row. 340 days of silence is the
     thing that just changed, not a metric, so it now reads as commentary
     directly above the headline it explains. And no "2 new uploads" stat:
     both uploads are on the page to the left with their view counts on
     them, and counting them again is the report habit this page is
     trying not to have. */
  const win = w => w ? `last ${w.days} day${w.days === 1 ? '' : 's'}` : 'period unknown';

  /* ── THREE QUESTIONS, IN ORDER ─────────────────────────────────────
     How big is it?      campaign views
     How active is it?   campaign assets, and the day it is on
     Is it still moving? last 7 days — not here yet, and not faked

     Everything on this row is campaign-only. The channel view delta has
     left it: Kings of Leon earns roughly 700,000 views a day from a
     catalogue where one 2008 single holds 36.6% of 2.46 billion lifetime
     views, so +13.5M sat beside 974K and won, and the number that won was
     not the campaign's. It stays in the payload for the analysis
     surfaces; it is no longer the first thing a label reads.

     LAST 7 DAYS is deliberately absent rather than approximated. Answering
     it honestly needs per-video history, which began collecting on 14 Sep,
     so the slot fills itself about a week later. Until then the page says
     two true things instead of three things one of which is a guess. */
  const startedLabel = m.campaignStart && m.campaignStart.at
    ? `since ${shortDate(m.campaignStart.at)}` : 'since the campaign started';

  /* Day and mix ride together under the asset count, set small. The age is
     what makes the two figures above it mean anything — 1.08M on day 33 is
     a different campaign from 1.08M on day 3 — but it is context, not a
     third headline. */
  const mix = [
    m.campaignDay ? `day ${m.campaignDay}` : null,
    m.campaignShorts ? `${m.campaignShorts} short${m.campaignShorts === 1 ? '' : 's'}` : null,
    m.campaignLongForm ? `${m.campaignLongForm} long-form` : null,
  ].filter(Boolean).join(' · ');

  const stats = [
    m.campaignViews != null
      ? [nf(m.campaignViews), 'campaign views', startedLabel]
      : null,
    m.campaignAssets
      ? [String(m.campaignAssets), `campaign asset${m.campaignAssets === 1 ? '' : 's'}`, mix]
      : null,
    /* Real movement only. "+0 SUBSCRIBERS" in the same type as the figures
       beside it reads as a campaign that failed rather than as a counter
       that has not moved, and YouTube rounds subscribers to three
       significant figures, so a genuine gain can land on zero. */
    m.subsDelta ? [compact(m.subsDelta), 'subscribers', win(m.subsWindow)] : null,
  ].filter(Boolean);

  /* Background is the newest campaign asset where one exists, so the
     cover image changes as the campaign does. Falls back to the deck's
     own opening image, which keeps the composition intact on a cold
     cache rather than leaving a black rectangle. */
  const bgId = heroes.length ? heroes[0].videoId : CFG.fallbackImage;

  return `<section class="slide cover" data-t="Campaign live">
  ${bleedImg(bgId,'strong')}
  <div class="inner">
    <div class="livehead">
      <div class="livestate"><span class="livedot"></span>${
        live ? 'Live campaign update' : 'New activity observed'} · ${fmtDate(d.generatedAt)}</div>
      ${d.deepDive && d.deepDive.capturedAt
        ? `<div class="livesince">Deep Dive captured ${fmtDate(d.deepDive.capturedAt)}</div>` : ''}
    </div>

    ${campaignIdentity(d)}

    <div class="covergrid">
      <div>
        ${heroes.length ? `<div class="label">Now</div>
        <div class="heroassets stagger" style="margin-top:.9rem">${
          heroes.map(heroAsset).join('')}</div>
        ${assetStrip((d.assets && d.assets.supporting) || [],
                     (d.assets && d.assets.total) || 0, heroes.length)}` : ''}
      </div>

      <div>
        ${stats.length ? `<div class="livestats stagger">
          ${stats.map(([n,c,w])=>`<div class="ls"><div class="n">${n}</div>
            <div class="c">${c}</div><div class="w">${esc(w)}</div></div>`).join('')}
        </div>` : ''}

        ${d.read ? `<div class="readline reveal">
          ${d.read.kicker ? `<div class="rk">${esc(d.read.kicker)}</div>` : ''}
          <div class="rh">${esc(d.read.headline)}</div>
          <div class="rl">${esc(d.read.line)}</div>
        </div>` : ''}

        ${buildFanResponse(d.fanResponse)}

        ${buildNext(tl)}
      </div>
    </div>

    ${/* The coverage list stays in the payload and off the page.

          It is the record of how each figure was derived — which rule
          picked the campaign start, why there is no follow-up window —
          and it earns its place in the API response, where anybody
          auditing a number can read it. Printed under the cover it
          became two paragraphs of methodology below a page whose whole
          argument is that a campaign should be legible in five seconds.
          Reasoning belongs in the record; the page states the finding. */''}
  </div>
</section>`;
}

/* "12 AUG". The campaign's first day, small, under the figure it explains. */
function shortDate(iso){
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const mon = d.toLocaleDateString('en-GB',{month:'short'}).slice(0,3).toUpperCase();
  return `${d.getUTCDate()} ${mon}`;
}

function fmtDate(iso){
  const dt = new Date(/^\d{4}-\d{2}$/.test(iso) ? iso+'-01' : iso);
  return isNaN(dt) ? iso : dt.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
}

/* A divider, so the original analysis is visibly a different thing from
   the live state rather than the second half of it. */
function buildBaselineMarker(d){
  return `<section class="slide light" data-t="Channel Deep Dive" style="min-height:52vh">
  <div class="inner">
    <div class="label">The strategy underneath</div>
    <h2 class="display big" style="max-width:18ch">Channel Deep Dive</h2>
    <p class="sub">Strategy captured ${d.deepDive && d.deepDive.capturedAt ? fmtDate(d.deepDive.capturedAt) : ''}.</p>
  </div>
</section>`;
}

/* ── IDEAS ────────────────────────────────────────────────────────────
   Two slides. The playbook, and what we are looking at.

   The rollout knows eight items with their state, evidence, provenance and
   research signals. These slides show four ideas and a reference wall.
   That is the selection rule working, not information thrown away: an item
   earns a picture when a person wrote it a pitch, and a pitch only gets
   written for something you would want to talk about in a room.

   Each idea carries one figure from the Deep Dive, one line of why, one
   line of what we would do. The figure is what makes it a strategy rather
   than a suggestion — "give every hero a second destination" is an
   opinion; "0 of 4 heroes had one last time" is an argument.

   Nothing about verification, provenance, recommendation ids or model
   confidence appears here. All of it decides what appears.             */

const ytThumb = id => `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;

/* YouTube publishes three auto-generated stills per video alongside the
   thumbnail — maxres1/2/3.jpg, real frames from roughly 25/50/75% through.
   Checked against both new CHVRCHES assets: four distinct 1280x720 images
   per video, different bytes, all public. It is how one campaign asset
   supplies a visual world instead of the same picture four times. */
const ytFrame = (id, n) =>
  n ? `https://i.ytimg.com/vi/${id}/maxres${n}.jpg` : ytThumb(id);

/* A missing thumbnail comes back as a 120x90 grey placeholder with a 200,
   not a 404, so onerror never fires. Anything that small is the
   placeholder: try the smaller size, then give up and let type carry it. */
const ytFallback = id =>
  `this.onerror=null;this.src='https://i.ytimg.com/vi/${id}/hqdefault.jpg'`;
function thumbGuard(img, id){
  if (img.naturalWidth > 121) return;
  if (img.dataset.tried) { const c = img.closest('.idea, .ref'); if (c) c.classList.add('noimg'); return; }
  img.dataset.tried = '1';
  img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/* ── THE CAMPAIGN'S OWN PICTURES ──────────────────────────────────────
   Every image on these two slides now comes from the assets THIS campaign
   has published. Nothing from the last album, and nothing invented.

   Why it changed: the cards were illustrated with Screen Violence videos —
   real, on-channel, correctly credited, and three years out of date. A
   page describing the next album that looks like the last one is arguing
   against itself.

   What is actually available, checked rather than assumed. YouTube
   publishes maxres1/2/3.jpg beside maxresdefault.jpg — three storyboard
   stills per upload, all public, all distinct (verified by byte size and
   by eye on both assets). So two uploads give eight frames.

   The catch is shape. A LANDSCAPE upload's stills are true 16:9 frames. A
   PORTRAIT upload's stills are the same 1280x720 file with the vertical
   strip pillarboxed into the middle and a blurred smear either side, so
   they are unusable at card size. For those, oardefault/oar2.jpg sometimes
   carries the original aspect — on the 10 Sep Short it is a real
   1080x1920 — and where it does not, the asset simply contributes no
   frames rather than a bad one.

   THE LIMITATION, STATED: this is all there is. Eight landscape-safe
   frames plus one true-vertical. There is no route to more imagery from
   the public objects, and none of it is retouched, restaged or generated. */
/* Assets whose storyboard stills carry pillarbox, and how much of the
   frame is real picture. Measured by sampling the columns of every
   published still, not inferred from the asset's aspect — see the .debar
   rule in the CSS for what the number does. An asset missing from here is
   rendered untouched, which is the safe direction to be wrong in. */
const BARS = { KCm7pn_lza8: 0.75 };

function campaignFrames(d){
  const heroes = (d.assets && d.assets.heroes) || [];
  const land = heroes.filter(h => h.aspect !== 'portrait');
  const port = heroes.filter(h => h.aspect === 'portrait');
  const out = [];
  /* 1,3,2 then the thumbnail: the storyboard stills are moments from the
     film and the thumbnail is the packshot, so the film leads. */
  for (const h of land) for (const n of [1,3,2,0])
    out.push({ src: ytFrame(h.videoId, n), id: h.videoId, debar: BARS[h.videoId] === 0.75 });
  for (const h of port)
    out.push({ src: `https://i.ytimg.com/vi/${h.videoId}/oar2.jpg`, id: h.videoId, debar: false, tall: true });
  return out;
}

/* Deal from the pool, wrapping if the campaign has fewer frames than the
   page has slots. Wrapping repeats a picture; it never borrows one. */
function frameAt(pool, i, fallbackId){
  return pool.length ? pool[i % pool.length] : { src: ytThumb(fallbackId), id: fallbackId, debar: false, tall: false };
}

/* ── THE SOURCE LINK ──────────────────────────────────────────────────
   Each card opens the Channel Deep Dive slide that argued for it. Slides
   are found by their `data-t`, not their index, so reordering the deck
   cannot silently point a card at the wrong argument — a missing slide
   leaves the reader where they are rather than scrolling somewhere
   arbitrary. */
function goDeep(slide){
  const el = Array.prototype.slice.call(document.querySelectorAll('#deck .slide'))
    .filter(function(x){ return x.getAttribute('data-t') === slide; })[0];
  if (!el) return;
  switchTab('campaign');
  setTimeout(function(){ el.scrollIntoView({behavior:'smooth', block:'start'}); }, 30);
}

/* ── THE CHANNEL DEEP DIVE BUTTON ─────────────────────────────────────
   The research is already in the deck — the scale, the era, the last
   album, the story — sitting behind the live campaign that now opens it.
   Before this there was no way to reach it except scrolling past the
   campaign, which is fine the first time and tedious every time after.

   It aims at the divider the live layer already inserts, by its data-t.
   If the API failed there is no divider, so it falls back to the first
   slide after the cover, which is where the captured deck begins anyway.
   A button that does nothing is worse than a button that does the
   approximately right thing. */
function goChannel(){
  const marker = Array.prototype.slice.call(document.querySelectorAll('#deck .slide'))
    .filter(function(x){ return x.getAttribute('data-t') === 'Channel Deep Dive'; })[0];
  if (marker) return goDeep('Channel Deep Dive');

  switchTab('campaign');
  const slides = document.querySelectorAll('#deck .slide');
  const target = slides[1] || slides[0];
  if (target) setTimeout(function(){
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 30);
}

/* The feature is whichever idea the campaign is walking into. It follows
   the spine rather than a flag, so it moves on its own. */
function pickFeature(ideas, items){
  const nextTitle = (items.find(i => i.spineStatus === 'NEXT') || {}).title;
  return ideas.find(i => i.title === nextTitle) || ideas[0];
}

function ideaFigure(it, cls, f, n){
  const p = it.pitch;
  return `<div class="idea ${cls}">
    <div class="idea-img${f.debar ? ' debar' : ''}">
      <img src="${f.src}" alt="" loading="lazy"
           onload="thumbGuard(this,'${p.imageId}')" onerror="${ytFallback(p.imageId)}">
    </div>
    <div class="idea-cap">
      <div class="idea-no">${n}</div>
      <div class="idea-move">${esc(p.move || p.headline)}</div>
      ${p.when ? `<div class="idea-when">${esc(p.when)}</div>` : ''}
      <div class="idea-apply">${esc(p.apply || p.doThis)}</div>
      <div class="idea-proof">${esc(p.proof || p.evidence)}</div>
    </div>
  </div>`;
}

/* One reference. The mechanic is the headline, the proof is one line, and
   the application is the only sentence — because the point of a reference
   board is that somebody in the room says "oh, like that", not that they
   read a case study standing up. */
function refCard(r, cls){
  return `<a class="rf ${cls}" href="${r.url}" target="_blank" rel="noopener">
    <div class="rf-img">
      <img src="${ytThumb(r.imageId)}" alt="" loading="lazy"
           onload="thumbGuard(this,'${r.imageId}')" onerror="${ytFallback(r.imageId)}">
    </div>
    <div class="rf-b">
      <div class="rf-a">${r.horizon ? `<i>${esc(r.horizon)}</i>` : ''}${esc(r.artist)}</div>
      <div class="rf-m">${esc(r.mechanic)}</div>
      <div class="rf-s"><span>What they did</span>${esc(r.did)}</div>
      ${r.proof ? `<div class="rf-p">${esc(r.proof)}</div>` : ''}
      <div class="rf-x"><span>CHVRCHES &rarr;</span>${esc(r.application)}</div>
      ${r.chain ? `<div class="rf-c">${esc(r.chain)}</div>` : ''}
    </div>
  </a>`;
}

/* ── INSPIRATION, OFF ────────────────────────────────────────────────
   The reference board does not ship. Leon's call and the right one: three
   good references and a real strategic question are not yet a slide that
   earns its place beside the playbook, and a half-convincing one is worse
   than none in front of a label.

   OFF, not deleted. Everything underneath it stays — the verified
   references and the objects they cite, the caveats, the question that
   derives itself from campaign state, the rule that nothing unverified
   reaches a page. That work is good and it is the expensive part; what is
   not good enough yet is the presentation of it. Deleting the renderer
   would mean rebuilding it later to rediscover the same thing.

   So it is one boolean, and it is one boolean back. */
const SHOW_INSPIRATION = false;

function buildIdeas(d){
  const ro = (d && d.rollout) || null;
  const items = (ro && ro.items) || [];
  const heroes = (d.assets && d.assets.heroes) || [];

  const ideas = items.filter(i => i.pitch && i.status !== 'COMPLETE').slice(0, 4);
  /* Platform conversations. Named and described, and sitting under the
     playbook rather than beside it — these are things to explore with
     YouTube, not things this campaign has decided to do. */
  const opps = items.filter(i => i.opportunity);
  const feature = ideas.length ? pickFeature(ideas, items) : null;
  const rest = ideas.filter(i => i !== feature);

  /* One pool, dealt in order, so no two objects on the page share a frame
     until the pool runs out. Feature first, then the supports, then the
     two backgrounds. */
  const pool = campaignFrames(d);
  const fallbackId = heroes.length ? heroes[0].videoId : CFG.fallbackImage;
  let slot = 0;
  const nextFrame = () => frameAt(pool, slot++, fallbackId);
  const featureSrc = feature ? nextFrame() : null;
  const restSrc = rest.map(() => nextFrame());
  const worldA = nextFrame();
  const worldB = nextFrame();

  const seen = {};
  const refs = [];
  for (const it of items) {
    for (const x of (it.grokResearch && it.grokResearch.examples) || []) {
      if (seen[x.id]) continue;
      seen[x.id] = 1;
      refs.push(x);
    }
  }
  const q = ro && ro.currentQuestion;

  /* ── The board, for the question that is actually open ──────────────
     References belong to a rollout item, not to the artist, so what shows
     here is whatever answers the CURRENT question. The moment somebody
     records that first hero is live, the question becomes the next item's
     and this board empties until that question has been researched — which
     is the honest behaviour, and the reason the empty state below is kept
     rather than deleted. */
  const owner = q ? items.find(i => i.title === q.becauseOf) : null;
  const board = (owner && owner.references) || [];
  /* The count under the empty state belongs to THIS question. Summing the
     whole rollout put twenty candidates under a headline about one of them,
     which flatters the library by counting work aimed at other questions. */
  const waiting = (owner && owner.grokResearch && owner.grokResearch.awaitingVerification) || 0;
  const lead = board.find(r => r.weight === 'lead') || board[0] || null;
  const support = board.filter(r => r !== lead).slice(0, 2);

  return `<section class="slide ${CFG.eraClass || ''}" data-t="Our playbook">
  <div class="bleed strong${worldA.debar ? ' debar' : ''}${worldA.tall ? ' emblem' : ''}"><img src="${worldA.src}" alt=""
    onerror="this.onerror=null;this.src='${ytThumb(fallbackId)}'"></div>
  <div class="inner">
    ${campaignIdentity(d, true)}
    <div class="label" style="margin-top:1.1rem">Our playbook</div>
    <h2 class="display" style="max-width:22ch;margin:.1rem 0 0;
      font-size:clamp(1.25rem,2.4vw,1.75rem);line-height:1.02">${
        ideas.length} move${ideas.length === 1 ? '' : 's'} for this campaign</h2>

    ${feature ? `<div class="ideagrid stagger">
      ${ideaFigure(feature,'feature',featureSrc,'01')}
      <div class="ideacol">${rest.map((i,n)=>ideaFigure(i,'sub',restSrc[n],String(n+2).padStart(2,'0'))).join('')}</div>
    </div>` : ''}

    ${opps.length ? `<div class="opps stagger">
      <div class="opps-h">With YouTube</div>
      <div class="opps-row">${opps.map(o=>`<div class="opp">
        <div class="opp-n">${esc(o.opportunity.name)}</div>
        ${o.opportunity.move ? `<div class="opp-m">${esc(o.opportunity.move)}</div>` : ''}
        <div class="opp-l">${esc(o.opportunity.line)}</div>
        ${o.opportunity.example ? `<a class="opp-x" href="${o.opportunity.example.url}"
          target="_blank" rel="noopener">${esc(o.opportunity.example.label)}
          <i>&middot; ${esc(o.opportunity.example.observed)}</i> &nearr;</a>` : ''}
      </div>`).join('')}</div>
    </div>` : ''}
  </div>
</section>

${SHOW_INSPIRATION ? `
<section class="slide ${CFG.eraClass || ''}" data-t="Inspiration">
  <div class="bleed strong${worldB.debar ? ' debar' : ''}${worldB.tall ? ' emblem' : ''}"><img src="${worldB.src}" alt=""
    onerror="this.onerror=null;this.src='${ytThumb(fallbackId)}'"></div>
  <div class="inner">
    <div class="label" style="color:var(--cyan)">Inspiration</div>
    ${lead ? `
      <h2 class="display" style="max-width:19ch;margin:.1rem 0 0;
        font-size:clamp(1.4rem,3vw,2.3rem);line-height:1.04">${esc(q.question)}</h2>
      <div class="rfgrid stagger">
        ${refCard(lead, 'lead')}
        <div class="rfcol">${support.map(r => refCard(r, 'sup')).join('')}</div>
      </div>`
    : refs.length ? `
      <h2 class="display" style="max-width:20ch;margin:.1rem 0 0;
        font-size:clamp(1.5rem,3.3vw,2.5rem);line-height:1.02">${
          q ? esc(q.question) : 'Things we\'d like to steal.'}</h2>
      <div class="refs stagger">
        ${refs.slice(0,4).map(x=>`<a class="ref"${
          x.source ? ` href="${x.source}" target="_blank" rel="noopener"` : ''}>
          <div class="ref-img">${x.relevantRef ? `<img src="${ytThumb(x.relevantRef)}" alt=""
             loading="lazy" onload="thumbGuard(this,'${x.relevantRef}')"
             onerror="${ytFallback(x.relevantRef)}">` : ''}</div>
          <div class="ref-a">${esc(x.artist)}</div>
          <div class="ref-i">${esc(x.observedBehaviour)}</div>
          <div class="ref-app"><span>CHVRCHES</span>${esc(x.whyItMattersHere)}</div>
        </a>`).join('')}
      </div>`
    : `
      <h2 class="display" style="max-width:16ch;margin:.1rem 0 0;
        font-size:clamp(1.5rem,3.3vw,2.5rem);line-height:1.02">Nothing
        <span style="color:var(--cyan)">verified yet.</span></h2>
      ${q ? `<div class="refq">${esc(q.question)}</div>` : ''}
      <p class="sub" style="max-width:44ch">${waiting} candidate${waiting === 1 ? '' : 's'} in the library.
        None reaches this page until somebody has checked it against the channel.</p>`}

  </div>
</section>` : ''}
`;
}

/* ── Tabs ─────────────────────────────────────────────────────────── */
function switchTab(name){
  const deck = document.getElementById('deck');
  const ideas = document.getElementById('ideas');
  const isIdeas = name === 'ideas';
  deck.style.display  = isIdeas ? 'none' : '';
  ideas.style.display = isIdeas ? '' : 'none';
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on', t.dataset.tab === name));
  HOST.resetSlides();
  window.scrollTo(0,0);
  HOST.observeAll();
  HOST.updateProgress();
}

/* ── Fetch and mount ──────────────────────────────────────────────── */
async function loadLiveCampaign(){
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), 8000);
  const r = await fetch(`${COVER_API}?slug=${CFG.slug}`, {cache:'no-store', signal:ctrl.signal});
  clearTimeout(t);
  if(!r.ok) throw new Error('status '+r.status);
  const d = await r.json();
  LIVE = d;

  /* BASELINE, NO_DEEP_DIVE and UNAVAILABLE all leave the deck exactly as
     it was. Only real post-baseline activity changes the opening. */
  if(d.state !== 'CAMPAIGN_LIVE' && d.state !== 'NEW_ACTIVITY') return;

  /* Into the reserved slot, replacing it, so the page does not grow at the
     top and nothing the reader is looking at moves. */
  const slot = document.getElementById('coverslot');
  const html = buildLiveCover(d) + buildBaselineMarker(d);
  if (slot) slot.outerHTML = html;
  else document.getElementById('deck').insertAdjacentHTML('afterbegin', html);

  const ideas = document.getElementById('ideas');
  if(ideas) ideas.innerHTML = buildIdeas(d);

  document.querySelector('.tabs').style.display = 'flex';

  /* The deck grew at the top, so re-measure and return the reader to it. */
  HOST.resetSlides();
  window.scrollTo(0,0);
  HOST.observeAll();
  HOST.updateProgress();
}


/* ── Boot ──────────────────────────────────────────────────────────
   The campaign home's space is reserved before anything else renders, so
   the deck's own cover is never the first screen and the live cover
   arrives INTO the page rather than on top of it. Whatever happens —
   mounted, wrong state, failed — the reserved space does not outlive the
   attempt. */
const deckEl = document.getElementById('deck');
if (deckEl) deckEl.insertAdjacentHTML('afterbegin', '<div class="coverslot" id="coverslot"></div>');

window.switchTab = switchTab;
window.goDeep = goDeep;
window.goChannel = goChannel;
window.thumbGuard = thumbGuard;

loadLiveCampaign()
  .catch(e => console.warn('[live] campaign home unavailable —', e && e.message))
  .finally(() => {
    const slot = document.getElementById('coverslot');
    if (slot) {
      slot.remove();
      HOST.resetSlides();
      HOST.observeAll();
      HOST.updateProgress();
    }
  });

})();
