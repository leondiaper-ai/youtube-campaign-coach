/* ═══════════════════════════════════════════════════════════════════════
   THE CONNECTION LAYER

   What changed and why. The previous version required a destination to
   have published the same artist within 18 months before it would say
   anything. That is a history check wearing a recommendation's clothes: it
   can only ever point at places the artist has already been, so it is
   useless for the question actually being asked — where might this song go
   that it has not been?

   A previous appearance is now EVIDENCE, scored as the strongest kind,
   but not a gate. Three routes qualify a pairing:

     A  same_artist        the destination has published this artist.
                           Exact credit match. Observed fact.
     B  comparable_track   different artists, overlapping description.
                           Inferred — and only as strong as the axes that
                           overlapped, which is why the axes are printed.
     C  treatment_pattern  the destination repeatedly uses a treatment
                           this song does not have. Observed on the
                           destination side, says nothing about the song.

   Route A is kept apart from B and C in the output. Collapsing "this
   destination published this artist" into "this destination publishes
   similar music" would hide the difference between a fact and a guess.

   FIT IS NOT RESULTS. Retrieval runs on editorial relevance alone. Only
   then is performance attached, and it is attached as a distribution —
   median, lower quartile, the weakest example — because a destination's
   one breakout upload is not what a new placement should expect. Nothing
   here is a prediction and nothing here is scored.
   ═══════════════════════════════════════════════════════════════════════ */

import { getAllArtists } from '@/lib/marketScope';
import { readLiveSnapByHandle, readAllLiveSnaps } from '@/lib/kvCache';
import type { Artist } from '@/lib/artists';
import { readAll, readArtistCatalogue, type MwChannelData, type MwVideo } from './collect';
import { MW_REGISTRY } from './channels';
import {
  buildSongs, norm, treatmentsOf, isShort, splitCredit,
  type Song, type RawUpload,
} from './songs';
import {
  profileDestination, readStated, readStatedMany, mergeStated, overlap, missingAxes,
  languagesFromTitles, EMPTY,
  type Description, type DestinationProfile, type DestExample, type Overlap,
} from './descriptors';

/** Reported per axis. Never summed — a total would hide which axis is weak. */
export type Assessment = 'strong' | 'moderate' | 'weak' | 'none';

export type Route = 'same_artist' | 'comparable_track' | 'treatment_pattern';
export const ROUTE_LABEL: Record<Route, string> = {
  same_artist: 'Same artist already published here',
  comparable_track: 'Comparable tracks by other artists',
  treatment_pattern: 'Treatment pattern on this destination',
};
export const ROUTE_KIND: Record<Route, 'exact' | 'inferred' | 'observed'> = {
  same_artist: 'exact', comparable_track: 'inferred', treatment_pattern: 'observed',
};

/* ── Performance context, §5 ─────────────────────────────────────────── */
export interface PerformanceContext {
  n: number;
  median: number | null;
  lowerQuartile: number | null;
  upperQuartile: number | null;
  weakest: DestExample | null;
  strongest: DestExample | null;
  typical: DestExample | null;
  /** Reads the distribution out loud, including when it is too skewed to use. */
  caveat: string;
}

function performance(items: (MwVideo | RawUpload)[], label: string): PerformanceContext {
  const withViews = items.filter(v => v.views != null) as RawUpload[];
  const sorted = [...withViews].sort((a, b) => (a.views ?? 0) - (b.views ?? 0));
  const at = (p: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : null;
  const toEx = (v: RawUpload | null): DestExample | null => v
    ? { id: v.id, title: v.title, url: `https://www.youtube.com/watch?v=${v.id}`, publishedAt: v.publishedAt, views: v.views ?? null }
    : null;
  const med = at(0.5), lq = at(0.25), uq = at(0.75);

  let caveat: string;
  if (!sorted.length) caveat = `No view counts available for ${label}, so there is no performance context at all.`;
  else if (sorted.length < 5) caveat = `Only ${sorted.length} reading(s) for ${label} — too few for a distribution. Treat the numbers as anecdotes.`;
  else {
    const spread = (uq?.views ?? 0) / Math.max(1, lq?.views ?? 1);
    caveat = `${sorted.length} uploads for ${label}. Lifetime views, so older uploads are favoured and none of this is first-week performance. `
      + (spread >= 10
        ? `The spread is wide — upper quartile is ${Math.round(spread)}× the lower — so the median is a weak guide and the top example is not a reasonable expectation.`
        : `Upper quartile is ${spread.toFixed(1)}× the lower.`);
  }

  return {
    n: sorted.length, median: med?.views ?? null,
    lowerQuartile: lq?.views ?? null, upperQuartile: uq?.views ?? null,
    weakest: toEx(sorted[0] ?? null), strongest: toEx(sorted[sorted.length - 1] ?? null),
    typical: toEx(med), caveat,
  };
}

/* ── Why test now, §5 ────────────────────────────────────────────────── */
export interface WhyNow { strength: 'supported' | 'weak' | 'absent'; points: string[]; gaps: string[] }

function whyNow(a: Artist, song: Song): WhyNow {
  const points: string[] = [], gaps: string[] = [];
  const days = (iso?: string | null) => iso ? Math.floor((Date.now() - Date.parse(iso)) / 864e5) : null;

  const latest = days(song.latestSeen);
  if (latest != null && latest <= 60) points.push(`Most recent asset for this song is ${latest} day(s) old, so the record is still live on the channel.`);
  else if (latest != null) points.push(`Most recent asset is ${latest} day(s) old — this is catalogue rather than a current release.`);

  if (a.phase) {
    if (['RELEASE', 'PUSH', 'PEAK'].includes(a.phase)) points.push(`Watcher has ${a.name} in ${a.phase} phase, so there is live campaign activity to attach a placement to.`);
    else points.push(`Watcher has ${a.name} in ${a.phase} phase — no active push recorded, which weakens timing rather than fit.`);
  } else gaps.push('No campaign phase recorded in Watcher.');

  if (a.nextMomentDate) {
    const d = days(a.nextMomentDate);
    if (d != null && d < 0) points.push(`A campaign moment${a.nextMomentLabel ? ` (${a.nextMomentLabel})` : ''} is ${Math.abs(d)} day(s) away.`);
  } else gaps.push('No upcoming campaign moment recorded, so there is no date this would be timed against.');

  if (song.shorts.length) points.push(`${song.shorts.length} Short(s) already attached to this song, so short-form material exists to adapt.`);
  else gaps.push('No Shorts attached to this song, so a short-form placement would need new material.');

  if (!song.recordings.length) gaps.push('No confirmed recording for this song, only supporting uploads.');

  const strength = gaps.length === 0 ? 'supported' : points.length ? 'weak' : 'absent';
  return { strength, points, gaps };
}

/* ── A shortlist candidate, §6 ───────────────────────────────────────── */
export interface Candidate {
  id: string;
  route: Route; routeKind: 'exact' | 'inferred' | 'observed';

  slug: string; artistName: string; songKey: string; song: string;
  destinationKey: string; destination: string;
  destinationRole: string; destinationRelationship: string;

  suggestedTreatment: string | null;
  treatmentRationale: string;

  /** The axes that actually agreed, and the ones that could not be checked. */
  similarities: Overlap['shared'];
  uncomparable: string[];
  /** Specific uploads on the destination that support the pairing. */
  supporting: DestExample[];
  supportingNote: string;

  performance: PerformanceContext;
  whyNow: WhyNow;

  uncertainty: string[];
  counterEvidence: string[];

  /** Never inferred from monitoring or ownership. */
  permission: 'unknown';
  ownership: string;

  /* Four separate axes. Only editorialFit can veto — see the note where
     these are computed. */
  editorialFit: Assessment;
  performanceSupport: Assessment;
  timing: Assessment;
  execution: Assessment;

  readiness: 'investigate' | 'propose';
  readinessReason: string;
  nextAction: string;
}

/* ── Building descriptions for a song ────────────────────────────────── */
export function describeSong(song: Song, stated?: Partial<Description> | null): Description {
  const titles = [...song.recordings, ...song.shorts].map(u => u.title);
  const base: Description = {
    ...EMPTY,
    treatments: { value: song.treatments, from: 'parsed',
      note: 'Read from the titles of this song\'s own uploads. A treatment absent from a title may still exist.' },
    language: languagesFromTitles(titles),
  };
  return mergeStated(base, stated ?? undefined);
}

const toRaw = (v: MwVideo): RawUpload => v;

/* ── Shared candidate construction ───────────────────────────────────── */
function build(
  route: Route, a: Artist, song: Song, songDesc: Description,
  prof: DestinationProfile, ch: MwChannelData,
  support: { items: RawUpload[]; note: string; identified: boolean },
  sims: Overlap,
  treatment: { name: string; rationale: string } | null,
): Candidate {
  /* Performance is measured on the uploads that support the pairing, not on
     the channel as a whole — a channel median mixes in repertoire nothing
     here is comparable to. */
  const perf = performance(support.items, treatment
    ? `${prof.name} uploads using "${treatment.name}"`
    : `${prof.name} supporting uploads`);
  if (!support.identified) {
    perf.caveat = `No individual upload on ${prof.name} could be identified as comparable to this song, so these figures describe the channel's whole output (${perf.n} uploads) and are NOT performance context for this pairing. Treat performance support as absent.`;
  }
  const wn = whyNow(a, song);
  const missing = missingAxes(songDesc);

  /* ── WHICH SIDE IS ACTUALLY MISSING ───────────────────────────────────
     A real hole found while testing this: tagging the SONG changes nothing
     if the destination carries no stated genre or mood, because the axis is
     still uncomparable and the pairing silently stays at "investigate". The
     tool has to name the side that is blocking it, or the obvious next
     action — tag the song — is the wrong one. */
  const destMissing = missingAxes(prof.description);
  const bothMissing = missing.filter(m => destMissing.includes(m));
  const songOnly = missing.filter(m => !destMissing.includes(m));
  const destOnly = destMissing.filter(m => !missing.includes(m));

  const uncertainty: string[] = [];
  if (bothMissing.length) uncertainty.push(`Neither "${song.name}" nor ${prof.name} has ${bothMissing.join(', ')} recorded, so those axes were not compared. Both sides need tagging — tagging only the song will not change this result.`);
  if (songOnly.length) uncertainty.push(`${prof.name} has ${songOnly.join(', ')} recorded but this song does not, so the comparison could not run. Tagging the song would change this result.`);
  if (destOnly.length) uncertainty.push(`This song has ${destOnly.join(', ')} recorded but ${prof.name} does not. Tagging the destination would change this result.`);
  if (route === 'comparable_track' && !sims.anyHardEvidence) uncertainty.push('Every axis that matched is parsed or inferred — no stated or counted attribute agreed. This is a lead, not a finding.');
  if (prof.suspect) uncertainty.push('This destination resolved to a channel that looks like a handle collision (near-zero subscribers or no uploads). Verify the channel before acting.');
  if (!song.recordings.length) uncertainty.push('Song identity rests on supporting uploads only — no confirmed recording.');
  if (song.uncertain.length) uncertainty.push(`${song.uncertain.length} upload(s) are attached to this song by title text alone and may belong elsewhere.`);

  const counter: string[] = [];
  counter.push(ch.relationship === 'external_reference'
    ? `${prof.name} is independently operated. A placement is a commercial conversation, not an internal decision.`
    : 'The network relationship comes from public reporting, not from a contract held here.');
  counter.push('Nothing in this data shows that any treatment caused any outcome. Lifetime views of other uploads cannot establish that.');
  if (perf.n >= 5 && perf.lowerQuartile != null && perf.median != null && perf.lowerQuartile * 4 < perf.median)
    counter.push(`A quarter of these uploads sit at or below ${perf.lowerQuartile.toLocaleString()} views — the ordinary outcome here is well short of the median.`);
  if (route === 'same_artist' && support.items.length < 2)
    counter.push('Only one prior upload by this artist on this destination, so the precedent is a single data point.');
  if (prof.windowDays < 180)
    counter.push(`Only ${prof.windowDays} days of this destination's uploads are collected, so its pattern may not be representative.`);

  /* ── FOUR AXES, NOT ONE GATE ──────────────────────────────────────────
     The previous version ANDed editorial fit, performance evidence and
     campaign timing into a single "ready to propose" flag. That was wrong
     in a way that mattered: a catalogue track with excellent editorial fit
     failed on timing and came back looking identical to a track with no
     editorial case at all. Five comparable uploads and a live campaign are
     useful signals, not requirements.

     So the four are reported separately, and only EDITORIAL FIT can veto.
     A strong fit with thin performance data and no campaign is a real
     opportunity that needs a cheap test; a weak fit with perfect timing is
     not an opportunity at all. */
  const hasHard = ROUTE_KIND[route] === 'exact' || sims.anyHardEvidence;

  /* ── NOT ALL AXES ARE FIT ─────────────────────────────────────────────
     The first real pilot run graded K-Trap's UK rap record a STRONG fit for
     Chill Nation on `language=english`, `context=driving` and an energy
     value one apart. Three "researched attributes agreed" and the grader
     counted them equally, so a downtempo channel and an Afroswing record
     looked like a match. They are not.

     Genre and subgenre are the only axes that carry musical fit. Mood and
     listening context support a genre match but cannot establish one.
     Language and energy are near worthless as fit evidence — almost
     everything here is in English, and energy is a 1–5 integer so any two
     records agree within one about half the time. They are recorded, and
     they are not counted. */
  const stated = sims.shared.filter(s => s.from === 'stated');
  const genreAgreed = stated.some(s => s.axis === 'genre' || s.axis === 'subgenre');
  const supporting = stated.filter(s => s.axis === 'mood' || s.axis === 'context').length;

  const editorialFit: Assessment =
    ROUTE_KIND[route] === 'exact' ? 'strong'
    : genreAgreed && supporting >= 1 ? 'strong'
    : genreAgreed ? 'moderate'
    /* Mood or context agreeing with no genre agreement is a hint worth
       looking at, never a fit. */
    : supporting >= 1 ? 'weak'
    : sims.shared.length ? 'weak'
    : 'none';

  /* ── PERFORMANCE MUST BE MEASURED ON COMPARABLES, NOT THE CHANNEL ────
     Caught in the second pilot run: K-Trap -> Rap Nation reported
     "performance support strong (n=858)". 858 is Rap Nation's ENTIRE
     collected output, because when no individual upload can be matched the
     support set falls back to the whole channel. A channel median is not
     performance context for a pairing — it mixes in every record this one
     is not comparable to, which is the fit/results conflation this design
     is supposed to prevent.

     So an unidentified support set scores 'none' regardless of how many
     uploads it contains. A big number that means nothing is worse than an
     honest zero. */
  const performanceSupport: Assessment = !support.identified ? 'none'
    : perf.n >= 8 ? 'strong' : perf.n >= 5 ? 'moderate' : perf.n >= 2 ? 'weak' : 'none';

  const timing: Assessment =
    wn.strength === 'supported' ? 'strong' : wn.strength === 'weak' ? 'moderate' : 'none';

  /* Execution readiness is about whether the thing could actually be done,
     and it is the axis nobody can improve by collecting more data. */
  const execution: Assessment = prof.suspect ? 'none'
    : ch.relationship === 'network_member' ? 'moderate' : 'weak';

  /* Editorial fit alone decides whether this is worth putting in front of
     anyone. "Weak" fit backed only by a parsed treatment is the generic-tag
     match the brief warns against, so it does not reach propose however
     good the other three look. */
  const readiness: Candidate['readiness'] =
    (editorialFit === 'strong' || editorialFit === 'moderate') && !prof.suspect ? 'propose' : 'investigate';

  const readinessReason = readiness === 'propose'
    ? `Editorial fit is ${editorialFit}${ROUTE_KIND[route] === 'exact' ? ' (observed — this destination has published this artist)' : ` (genre agrees: ${stated.filter(s => s.axis === 'genre' || s.axis === 'subgenre').map(s => s.values.join('/')).join(', ')}${supporting ? `; supported by ${stated.filter(s => s.axis === 'mood' || s.axis === 'context').map(s => s.axis).join(' and ')}` : ''})`}. Performance support ${performanceSupport}, timing ${timing} — neither blocks a test, they size it.`
    : editorialFit === 'none'
      ? 'No editorial case at all. The pairing exists only because the destination uses a treatment this song lacks, which says nothing about whether the song belongs there.'
      : prof.suspect
        ? 'Destination identity is unverified — the handle resolved to something implausible. Nothing else matters until that is settled.'
        : `Editorial fit is weak: GENRE DOES NOT AGREE. The only agreement is on ${sims.shared.map(s => s.axis).join(', ')}. Language, energy proximity and a shared treatment are not musical fit — almost everything collected here is in English, and energy is a 1-5 integer that agrees within one about half the time by chance.`;

  return {
    id: `${a.slug}::${song.key}::${prof.key}::${route}`,
    route, routeKind: ROUTE_KIND[route],
    slug: a.slug, artistName: a.name, songKey: song.key, song: song.name,
    destinationKey: prof.key, destination: prof.name,
    destinationRole: prof.role, destinationRelationship: prof.relationship,
    suggestedTreatment: treatment?.name ?? null,
    treatmentRationale: treatment?.rationale ?? 'No treatment gap identified — this pairing is about placement, not a new asset.',
    similarities: sims.shared, uncomparable: sims.uncomparable,
    supporting: support.items.slice(0, 4).map(v => ({
      id: v.id, title: v.title, url: `https://www.youtube.com/watch?v=${v.id}`,
      publishedAt: v.publishedAt, views: v.views ?? null,
    })),
    supportingNote: support.note,
    performance: perf, whyNow: wn,
    uncertainty, counterEvidence: counter,
    permission: 'unknown', ownership: a.ownership ?? 'observed',
    editorialFit, performanceSupport, timing, execution,
    readiness, readinessReason,
    nextAction: readiness === 'propose'
      ? `Confirm who controls the recording of "${song.name}" and whether a ${treatment?.name ?? 'placement'} may be created and licensed. If yes, approach ${prof.name} with the ${perf.n} comparable uploads above as the basis, and agree in advance what result would count as nothing happening.`
      /* Names the ONE thing that would move this forward, and names the
         right side of the comparison — see the destMissing note above. */
      : `Before anything else: ${
          !hasHard
            ? bothMissing.length
              ? `tag ${bothMissing.join(', ')} on BOTH "${song.name}" and ${prof.name} — tagging one side alone leaves the axis uncomparable`
              : songOnly.length
                ? `tag ${songOnly.join(', ')} on "${song.name}"; ${prof.name} already has those recorded`
                : destOnly.length
                  ? `tag ${destOnly.join(', ')} on ${prof.name}; this song already has those recorded`
                  : `review the matched axes — they are parsed from titles rather than stated, so confirm or correct them`
            : performanceSupport === 'none' ? `collect more of ${prof.name}'s uploads — there is no performance context at all yet`
            : prof.suspect ? `verify ${prof.name}'s real channel — the handle resolved to something implausible`
            : `establish a timing reason from campaign activity; the editorial case already stands`}.`,
  };
}

/** Which treatment to propose: common on the destination, absent on the song. */
function treatmentGap(prof: DestinationProfile, song: Song): { name: string; rationale: string } | null {
  const have = new Set(song.treatments.map(t => t.toLowerCase()));
  const gap = prof.treatments.find(t => !have.has(t.name.toLowerCase()) && t.n >= 3);
  if (!gap) return null;
  return {
    name: gap.name,
    rationale: `${prof.name} uses "${gap.name}" on ${gap.n} of ${prof.uploads} collected uploads (${Math.round(gap.share * 100)}%). No ${gap.name} asset for "${song.name}" appears in our coverage — which may mean it does not exist, or only that no title says so.`,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   TRACK-FIRST: where might this song fit?
   ═══════════════════════════════════════════════════════════════════════ */
export async function candidatesForSong(slug: string, songKey: string): Promise<{ candidates: Candidate[]; notes: string[] }> {
  const artists = await getAllArtists();
  const a = artists.find((x: Artist) => x.slug === slug);
  if (!a?.channelHandle) return { candidates: [], notes: ['Artist not found, or has no channel handle recorded.'] };

  const songs = await songsForArtist(slug);
  const song = songs.find(s => s.key === songKey);
  if (!song) return { candidates: [], notes: [`No canonical song "${songKey}" for this artist. Only confidently identified recordings create songs — a promotional caption will not.`] };

  const market = (await readAll()).filter(ch => ch.items.length);
  if (!market.length) return { candidates: [], notes: ['No destination channels collected yet.'] };

  const songDesc = describeSong(song, await readStated('track', `${slug}:${songKey}`));
  const statedDest = await readStatedMany('dest', market.map(c => c.key));

  const notes: string[] = [];
  const out: Candidate[] = [];
  const artistN = norm(a.name);

  for (const ch of market) {
    const reg = MW_REGISTRY.find(r => r.key === ch.key);
    const prof = profileDestination({ ...ch, suspect: reg?.suspect, items: ch.items.map(toRaw) }, statedDest.get(ch.key));
    const gap = treatmentGap(prof, song);
    const sims = overlap(songDesc, prof.description);

    /* ROUTE A — exact. The artist has been published here. */
    const same = ch.items.filter(v => splitCredit(v.title)?.credits.includes(artistN));
    if (same.length) {
      out.push(build('same_artist', a, song, songDesc, prof, ch, {
        items: same.map(toRaw), identified: true,
        note: `${same.length} upload(s) on ${prof.name} credit ${a.name} by name. Exact credit match, not a substring.`,
      }, sims, gap));
      continue; /* Route A supersedes B and C for this destination. */
    }

    /* ROUTE B — inferred. Other artists, overlapping description. Requires a
       real overlap on a comparable axis; an empty description yields nothing
       here, which is correct rather than unhelpful. */
    if (sims.shared.length) {
      const axes = new Set(sims.shared.flatMap(s => s.values.map(v => v.toLowerCase())));
      const comparable = ch.items.filter(v =>
        treatmentsOf(v.title).some(t => axes.has(t.toLowerCase())));
      const items = (comparable.length ? comparable : ch.items).map(toRaw);
      out.push(build('comparable_track', a, song, songDesc, prof, ch, {
        items, identified: comparable.length > 0,
        note: comparable.length
          ? `${comparable.length} upload(s) on ${prof.name} share ${sims.shared.map(s => s.axis).join(' and ')} with this song. Different artists — the comparison is on the description, not on repertoire.`
          : `No upload on ${prof.name} could be matched individually; the overlap is with the channel's aggregate profile only, which is weaker.`,
      }, sims, gap));
      continue;
    }

    /* ROUTE C — observed on the destination side only. A treatment it leans
       on hard that this song lacks. Says nothing about whether the song
       suits the channel, and the output says so. */
    if (gap && gap.name && prof.treatments[0] && prof.treatments[0].share >= 0.25) {
      const top = prof.treatments.find(t => t.name === gap.name)!;
      out.push(build('treatment_pattern', a, song, songDesc, prof, ch, {
        items: ch.items.filter(v => treatmentsOf(v.title).includes(gap.name)).map(toRaw),
        identified: true,
        note: `${prof.name} uses "${gap.name}" on ${top.n} uploads. This is a pattern on the destination — it is not evidence that this particular song belongs there.`,
      }, { shared: [], uncomparable: sims.uncomparable, anyHardEvidence: false }, gap));
    }
  }

  if (!out.length) notes.push(
    `No destination qualified on any of the three routes. ${missingAxes(songDesc).length
      ? `The most likely reason is that "${song.name}" has no ${missingAxes(songDesc).join(', ')} recorded, so route B had nothing to compare. Supply tags and re-run.`
      : 'Collected destinations share no description axis with this song and show no treatment gap.'}`);

  /* Order: exact first, then by how much real evidence there is. Never by a
     score, because there isn't one. */
  const rank = (c: Candidate) =>
    (c.routeKind === 'exact' ? 0 : c.routeKind === 'inferred' ? 1 : 2) * 1000
    - c.similarities.length * 10 - (c.readiness === 'propose' ? 100 : 0);
  return { candidates: out.sort((x, y) => rank(x) - rank(y)).slice(0, 8), notes };
}

/* ═══════════════════════════════════════════════════════════════════════
   DESTINATION-FIRST: which of our songs suit this environment?

   The brief calls this essential for eventually programming VMG's own
   channels, and it is the direction the previous design could not express
   at all.
   ═══════════════════════════════════════════════════════════════════════ */
export async function candidatesForDestination(
  destKey: string, opts: { limit?: number; slugs?: string[] } = {},
): Promise<{ profile: DestinationProfile | null; candidates: Candidate[]; notes: string[] }> {
  const market = await readAll();
  const ch = market.find(c => c.key === destKey);
  if (!ch) return { profile: null, candidates: [], notes: [`Destination "${destKey}" has not been collected.`] };

  const reg = MW_REGISTRY.find(r => r.key === destKey);
  const prof = profileDestination(
    { ...ch, suspect: reg?.suspect, items: ch.items.map(toRaw) },
    await readStated('dest', destKey) ?? undefined,
  );

  const artists = await getAllArtists();
  const pool = opts.slugs?.length
    ? artists.filter((a: Artist) => opts.slugs!.includes(a.slug))
    : artists.filter((a: Artist) => (a.ownership ?? 'observed') === 'virgin');

  const notes: string[] = [];
  const out: Candidate[] = [];
  const destArtists = new Set(prof.artists.map(x => x.name));

  /* Capped, and the cap is reported. Each artist costs a KV read for the
     catalogue plus one per song for stated tags; unbounded, this endpoint
     times out, which is the failure mode that already cost a day here. */
  const CAP = 40;
  const scan = pool.slice(0, CAP);
  if (pool.length > CAP) notes.push(`Scanned the first ${CAP} of ${pool.length} eligible artists. This is a shortlist tool, not a full sweep — narrow with specific artists for a complete answer.`);

  for (const a of scan) {
    if (!a.channelHandle) continue;
    const songs = await songsForArtist(a.slug);
    if (!songs.length) continue;
    /* Newest three canonical songs per artist — this is a shortlist tool,
       not a catalogue dump. */
    for (const song of songs.slice(0, 3)) {
      const songDesc = describeSong(song, await readStated('track', `${a.slug}:${song.key}`));
      const sims = overlap(songDesc, prof.description);
      const gap = treatmentGap(prof, song);
      const artistN = norm(a.name);

      if (destArtists.has(artistN)) {
        const same = ch.items.filter(v => splitCredit(v.title)?.credits.includes(artistN));
        if (same.length) {
          out.push(build('same_artist', a, song, songDesc, prof, ch, {
            items: same.map(toRaw), identified: true,
            note: `${same.length} upload(s) on ${prof.name} credit ${a.name} by name.`,
          }, sims, gap));
          continue;
        }
      }
      if (sims.shared.length) {
        const axes = new Set(sims.shared.flatMap(s => s.values.map(v => v.toLowerCase())));
        const comparable = ch.items.filter(v => treatmentsOf(v.title).some(t => axes.has(t.toLowerCase())));
        out.push(build('comparable_track', a, song, songDesc, prof, ch, {
          items: (comparable.length ? comparable : ch.items).map(toRaw),
          identified: comparable.length > 0,
          note: comparable.length
            ? `${comparable.length} upload(s) share ${sims.shared.map(s => s.axis).join(' and ')} with this song.`
            : 'Overlap is with the channel profile in aggregate, not with identifiable uploads.',
        }, sims, gap));
      }
    }
  }

  if (!out.length) notes.push(
    `Nothing from the watched repertoire qualified for ${prof.name}. Most likely the songs have no stated genre, mood or context, leaving only treatments to compare on. Supply tags for a handful of songs and re-run.`);

  const rank = (c: Candidate) =>
    (c.routeKind === 'exact' ? 0 : 1) * 1000 - c.similarities.length * 10 - (c.readiness === 'propose' ? 100 : 0);
  return { profile: prof, candidates: out.sort((x, y) => rank(x) - rank(y)).slice(0, opts.limit ?? 12), notes };
}

/* ── Canonical songs for one watched artist ──────────────────────────── */
const songCache = new Map<string, Song[]>();
export async function songsForArtist(slug: string): Promise<Song[]> {
  if (songCache.has(slug)) return songCache.get(slug)!;
  const artists = await getAllArtists();
  const a = artists.find((x: Artist) => x.slug === slug);
  if (!a?.channelHandle) return [];

  const cat = await readArtistCatalogue(slug).catch(() => null);
  let ups: RawUpload[];
  if (cat && cat.items.length) {
    ups = cat.items.map(v => ({
      id: v.id, title: v.title, publishedAt: v.publishedAt,
      durationSec: v.durationSec ?? null, live: (v.live as string) ?? 'none',
      views: v.views ?? null, likes: v.likes ?? null, comments: v.comments ?? null, thumb: v.thumb ?? null,
    }));
  } else {
    const snap = await readLiveSnapByHandle(a.channelHandle).catch(() => null);
    ups = (snap?.recentUploads ?? []).map((v: any) => ({
      id: v.id, title: v.title, publishedAt: v.publishedAt,
      durationSec: v.durationSec ?? null, live: v.live ?? 'none',
      views: v.viewCount ?? null, likes: v.likeCount ?? null, comments: v.commentCount ?? null, thumb: v.thumb ?? null,
    }));
  }
  const songs = buildSongs(ups);
  songCache.set(slug, songs);
  return songs;
}

/** Everything collected, profiled — for the destination picker. */
export async function allDestinationProfiles(): Promise<DestinationProfile[]> {
  const market = await readAll();
  const stated = await readStatedMany('dest', market.map(c => c.key));
  return market
    .filter(c => c.items.length)
    .map(c => profileDestination(
      { ...c, suspect: MW_REGISTRY.find(r => r.key === c.key)?.suspect, items: c.items.map(toRaw) },
      stated.get(c.key),
    ))
    .sort((a, b) => b.uploads - a.uploads);
}
