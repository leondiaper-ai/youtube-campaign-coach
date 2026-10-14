/* THE PILOT, §7 — five songs, three destinations, one page of output.
 *
 * Selection is done here rather than by hand so the result cannot be
 * flattered by picking the five songs that happen to work. The rules:
 *
 *   Songs        Virgin-owned artists only. Must have at least one
 *                CONFIRMED RECORDING — a song whose identity rests on a
 *                caption cannot be part of a test of identity. Deliberately
 *                mixed: some artists the destinations have published before,
 *                some they have never touched, because the brief asks for
 *                artists with no previous appearance and those are the only
 *                ones that test whether this discovers anything.
 *
 *   Destinations Collected, not flagged suspect, and enough uploads for a
 *                distribution. Picked by volume, which is the only
 *                non-arbitrary ordering available.
 *
 * The response reports what it selected and why, so the selection itself is
 * inspectable.
 */
import { authorised, notFound } from '@/lib/marketWatch/gate';
import { getAllArtists } from '@/lib/marketScope';
import type { Artist } from '@/lib/artists';
import { readAll } from '@/lib/marketWatch/collect';
import { MW_REGISTRY } from '@/lib/marketWatch/channels';
import {
  songsForArtist, candidatesForSong, describeSong, type Candidate,
} from '@/lib/marketWatch/connect';
import { readStated, profileDestination } from '@/lib/marketWatch/descriptors';
import { norm, splitCredit } from '@/lib/marketWatch/songs';
import { readFeedback, tally } from '@/lib/marketWatch/feedback';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!(await authorised())) return notFound();
  const q = new URL(req.url).searchParams;
  const wantSongs = Math.min(8, Math.max(1, Number(q.get('songs')) || 5));
  const wantDests = Math.min(6, Math.max(1, Number(q.get('destinations')) || 3));

  const market = (await readAll()).filter(c => c.items.length >= 20);
  const verified = market
    .filter(c => !MW_REGISTRY.find(r => r.key === c.key)?.suspect)
    .sort((a, b) => b.items.length - a.items.length)
    .slice(0, wantDests);

  if (!verified.length) {
    return Response.json({
      error: 'No verified destination has enough collected uploads. Collect channels first.',
    }, { status: 200, headers: { 'cache-control': 'no-store' } });
  }
  const destKeys = new Set(verified.map(c => c.key));

  /* Which artists these destinations have already published, so the
     selection can deliberately include artists they have not. */
  const published = new Set<string>();
  for (const c of verified) {
    for (const v of c.items) {
      for (const n of splitCredit(v.title)?.credits ?? []) published.add(n);
    }
  }

  const artists = (await getAllArtists()).filter((a: Artist) =>
    (a.ownership ?? 'observed') === 'virgin' && !!a.channelHandle);

  type Pick = { a: Artist; songKey: string; songName: string; priorAppearance: boolean; recordings: number };
  const withPrior: Pick[] = [], withoutPrior: Pick[] = [];

  for (const a of artists) {
    const songs = await songsForArtist(a.slug).catch(() => []);
    /* Confirmed identity only. This is the gate that the old grouping
       lacked, and it is why "50 ballerinas. tonight" cannot be selected. */
    const solid = songs.filter(s => s.recordings.length >= 1);
    if (!solid.length) continue;
    const s = solid[0];
    const prior = published.has(norm(a.name));
    const pick: Pick = { a, songKey: s.key, songName: s.name, priorAppearance: prior, recordings: s.recordings.length };
    (prior ? withPrior : withoutPrior).push(pick);
  }

  /* Interleave so the sample is not all one kind. Two with prior history,
     three without — the harder direction gets the larger share. */
  const picks: Pick[] = [];
  const nPrior = Math.min(withPrior.length, Math.floor(wantSongs * 0.4));
  picks.push(...withPrior.slice(0, nPrior));
  picks.push(...withoutPrior.slice(0, wantSongs - picks.length));
  if (picks.length < wantSongs) picks.push(...withPrior.slice(nPrior, nPrior + (wantSongs - picks.length)));

  const results: {
    artist: string; slug: string; song: string; songKey: string;
    priorAppearance: boolean; recordings: number;
    statedTags: boolean; missingAxes: string[];
    candidates: Candidate[]; notes: string[];
  }[] = [];

  for (const p of picks) {
    const { candidates, notes } = await candidatesForSong(p.a.slug, p.songKey);
    const songs = await songsForArtist(p.a.slug);
    const song = songs.find(s => s.key === p.songKey)!;
    const stated = await readStated('track', `${p.a.slug}:${p.songKey}`);
    const desc = describeSong(song, stated);
    results.push({
      artist: p.a.name, slug: p.a.slug, song: p.songName, songKey: p.songKey,
      priorAppearance: p.priorAppearance, recordings: p.recordings,
      statedTags: !!stated,
      missingAxes: (await import('@/lib/marketWatch/descriptors')).missingAxes(desc),
      /* Only the three pilot destinations. */
      candidates: candidates.filter(c => destKeys.has(c.destinationKey)),
      notes,
    });
  }

  const all = results.flatMap(r => r.candidates);
  const fb = await readFeedback();

  return Response.json({
    selection: {
      destinations: verified.map(c => {
        const prof = profileDestination({ ...c, items: c.items }, undefined);
        return {
          key: c.key, name: c.name, uploads: c.items.length,
          role: c.role, relationship: c.relationship,
          windowDays: prof.windowDays, uploadsPerWeek: prof.uploadsPerWeek,
          medianViews: prof.medianViews, lowerQuartileViews: prof.lowerQuartileViews,
          topTreatments: prof.treatments.slice(0, 5).map(t => `${t.name} ${t.n}`),
        };
      }),
      songRule: 'Virgin-owned artist, at least one confirmed recording. Promotional captions cannot be selected.',
      destinationRule: 'Collected, at least 20 uploads, not flagged as a handle collision, ranked by volume.',
      priorSplit: { withPriorAppearance: picks.filter(p => p.priorAppearance).length, without: picks.filter(p => !p.priorAppearance).length },
      candidatePool: { virginArtists: artists.length, selectable: withPrior.length + withoutPrior.length },
    },
    summary: {
      songs: results.length,
      candidates: all.length,
      byRoute: {
        same_artist: all.filter(c => c.route === 'same_artist').length,
        comparable_track: all.filter(c => c.route === 'comparable_track').length,
        treatment_pattern: all.filter(c => c.route === 'treatment_pattern').length,
      },
      readyToPropose: all.filter(c => c.readiness === 'propose').length,
      worthInvestigating: all.filter(c => c.readiness === 'investigate').length,
      songsWithNoCandidate: results.filter(r => !r.candidates.length).map(r => `${r.artist} — ${r.song}`),
      songsNeedingTags: results.filter(r => r.missingAxes.length).length,
    },
    results,
    feedback: { entries: fb, tally: tally(fb) },
  }, { headers: { 'cache-control': 'no-store' } });
}
