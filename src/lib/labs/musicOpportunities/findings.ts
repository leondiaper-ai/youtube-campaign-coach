/* ═══════════════════════════════════════════════════════════════════════
   FINDINGS — A FEW SPECIFIC SENTENCES, EACH WITH ITS NUMBERS

   Computed from the bank, the patterns and the direct matches. Each
   finding names what was observed, the figures behind it, and what it
   does not show. "Not enough evidence yet" is a finding. Nothing here
   is written as advice; the actions live on the opportunities.
   ═══════════════════════════════════════════════════════════════════════ */

import { crossMeasureSongs, persistence, type Bank } from './bank';
import { measureName } from './connections';
import type { ContextualMatch, Opportunity, Pattern, SongRecord } from './types';

export type Finding = {
  id: string;
  question: 'demand' | 'fit' | 'next';
  headline: string;
  detail: string;
  numbers: { label: string; value: string }[];
  /** Keys a reader can click through to: song keys, pattern ids, opportunity ids. */
  refs: { kind: 'song' | 'pattern' | 'opportunity' | 'contextual'; id: string; label: string }[];
  limits: string[];
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function buildFindings(bank: Bank, patterns: Pattern[], opportunities: Opportunity[], contextual: ContextualMatch[]): Finding[] {
  const out: Finding[] = [];
  const series = Array.from(bank.latest.values());
  if (!series.length) {
    return [{ id: 'none', question: 'demand', headline: 'No chart readings stored yet.', detail: 'Open a chart on charts.youtube.com and import it, or add a reading file. Nothing below can be computed until then.', numbers: [], refs: [], limits: [] }];
  }

  /* 1. Persistence within the longest series. */
  const longest = Array.from(bank.seriesPeriods.entries()).sort((a, b) => b[1].length - a[1].length)[0];
  if (longest && longest[1].length >= 2) {
    const [sk, periods] = longest;
    const songs = Array.from(bank.songs.values()).map(s => ({ s, apps: s.appearances.filter(a => `${a.source}|${a.measure}|${a.territory}` === sk) })).filter(x => x.apps.length);
    const everyPeriod = songs.filter(x => periods.every(p => x.apps.some(a => a.period === p)));
    const latestObs = bank.latest.get(sk)!;
    const newThisPeriod = latestObs.entries.filter(e => e.isNew).length;
    const heritageAll = everyPeriod.filter(x => x.s.labels.some(l => l.dimension === 'era' && /heritage|catalogue/.test(l.value))).length;
    out.push({
      id: 'persistence', question: 'demand',
      headline: `${everyPeriod.length} of the ${latestObs.entries.length} songs in the latest ${latestObs.territory} ${measureName(latestObs.measure)} were present in all ${periods.length} stored weeks.`,
      detail: `Persistence is measured inside this one chart series only. ${newThisPeriod} entries are new this week. Of the songs present every week, ${heritageAll} are catalogue or heritage releases (source release date three or more years before the chart week).`,
      numbers: [{ label: 'Weeks stored', value: String(periods.length) }, { label: 'Present every week', value: String(everyPeriod.length) }, { label: 'New this week', value: String(newThisPeriod) }, { label: 'Catalogue/heritage among them', value: String(heritageAll) }],
      refs: everyPeriod.sort((a, b) => a.apps.at(-1)!.rank - b.apps.at(-1)!.rank).slice(0, 8).map(x => ({ kind: 'song' as const, id: x.s.key, label: `${x.s.title} — ${x.s.artists.join(', ')}` })),
      limits: ['Three weekly readings is a short window; a song present in all of them may still be a spike measured on its way down.', 'Rank movement is not a growth rate; the chart publishes views for its own measure only.'],
    });
  } else {
    out.push({ id: 'persistence', question: 'demand', headline: 'Only one stored period per chart so far: persistence cannot be assessed.', detail: 'A second reading of the same chart and territory is the minimum before any entry can be called persistent.', numbers: [], refs: [], limits: [] });
  }

  /* 2. Era: how much of the song chart is catalogue. */
  const songByRow = new Map<string, SongRecord>();
  for (const s of bank.songs.values()) for (const a of s.appearances) songByRow.set(`${a.observationId}#${a.rank}`, s);
  for (const obs of series.filter(o => o.measure === 'song-views-weekly')) {
    const songs = obs.entries.map(e => songByRow.get(`${obs.id}#${e.rank}`)).filter((s): s is SongRecord => !!s);
    const era = (v: RegExp) => songs.filter(s => s.labels.some(l => l.dimension === 'era' && v.test(l.value)));
    const heritage = era(/heritage/), catalogue = era(/catalogue/), recent = era(/recent/), fresh = era(/new/);
    const dated = heritage.length + catalogue.length + recent.length + fresh.length;
    if (dated >= 50) {
      out.push({
        id: `era|${obs.territory}`, question: 'demand',
        headline: `${heritage.length + catalogue.length} of ${dated} dated entries in the ${obs.territory} Top Songs chart (${obs.periodLabel}) were released three or more years ago.`,
        detail: `${heritage.length} heritage (15+ years), ${catalogue.length} catalogue (3–15), ${recent.length} recent (1–3), ${fresh.length} released within 12 months. Release dates are the chart page's own; era is relative to the chart week.`,
        numbers: [{ label: 'Heritage 15y+', value: String(heritage.length) }, { label: 'Catalogue 3–15y', value: String(catalogue.length) }, { label: 'Recent 1–3y', value: String(recent.length) }, { label: 'New ≤12m', value: String(fresh.length) }],
        refs: heritage.sort((a, b) => a.appearances.at(-1)!.rank - b.appearances.at(-1)!.rank).slice(0, 6).map(s => ({ kind: 'song' as const, id: s.key, label: `${s.title} — ${s.artists.join(', ')} (${s.releaseDate?.slice(0, 4)})` })),
        limits: ['Selected successes: this says catalogue songs can chart on YouTube in this territory, not that uploading catalogue produces this.', `${obs.entries.length - dated} entries had no usable release date.`],
      });
    }
  }

  /* 3. Cross-measure demand. */
  const cross = crossMeasureSongs(bank);
  if (cross.length) {
    out.push({
      id: 'cross-measure', question: 'demand',
      headline: `${cross.length} songs appear in more than one chart type across the stored readings.`,
      detail: 'A song on both the Top Songs and the Top Songs on Shorts charts is being watched and used in Shorts; those are different measures and are not added together here.',
      numbers: [{ label: 'Songs in 2+ chart types', value: String(cross.length) }, { label: 'In 3 types', value: String(cross.filter(c => c.measures.length >= 3).length) }],
      refs: cross.slice(0, 8).map(c => ({ kind: 'song' as const, id: c.song.key, label: `${c.song.title} — ${c.song.artists.join(', ')} · ${c.measures.map(measureName).join(' + ')} · ${c.territories.join(', ')}` })),
      limits: ['Songs are joined across charts by normalised title and lead artist, not by identifier; a title shared by two different songs would be over-counted.'],
    });
  }

  /* 4. Strongest patterns, one line each (max 3). */
  /* Era has its own finding above, so the pattern lines go to the other dimensions. */
  const strong = patterns.filter(p => !p.baseline && p.dimension !== 'era' && p.topArtistShare < 0.4)
    .sort((a, b) => (b.provenance.verified + b.provenance.human) - (a.provenance.verified + a.provenance.human) || b.entities - a.entities).slice(0, 3);
  for (const p of strong) {
    out.push({
      id: `pattern|${p.id}`, question: 'demand',
      headline: `${p.value} recurs among ${p.territory} ${measureName(p.measure)} entries: ${p.entities} songs/videos from ${p.artists} artists${p.share != null ? ` (${pct(p.share)} of rows with a ${p.dimension} label)` : ''}.`,
      detail: `${p.periodsObserved > 1 ? `${p.persistentEntities} of them were present in all ${p.periodsObserved} stored weeks.` : 'One stored week; persistence unknown.'} Top artist ${p.topArtist ?? '—'} holds ${pct(p.topArtistShare)} of the rows.`,
      numbers: [{ label: 'Songs/videos', value: String(p.entities) }, { label: 'Artists', value: String(p.artists) }, { label: 'Labelled rows', value: `${p.labelledRows}/${p.totalRows}` }, { label: 'Human/verified/inferred', value: `${p.provenance.human}/${p.provenance.verified}/${p.provenance.inferred}` }],
      refs: [{ kind: 'pattern' as const, id: p.id, label: 'Open pattern' }, ...p.examples.slice(0, 4).map(e => ({ kind: 'song' as const, id: e.songKey, label: `#${e.rank} ${e.title} — ${e.artists.join(', ')}` }))],
      limits: p.caveats,
    });
  }

  /* 5. Direct fit. */
  const verified = opportunities.filter(o => o.matches[0].kind === 'exact-upload' || o.matches[0].kind === 'isrc');
  const composition = opportunities.filter(o => o.matches[0].kind === 'title-artist');
  const sharedTitle = opportunities.filter(o => o.matches[0].kind === 'title-only');
  const artistOnly = opportunities.filter(o => o.matches[0].kind === 'artist');
  const byAct = new Map<string, Opportunity[]>();
  for (const o of artistOnly) { const k = o.signal.artists[0] ?? o.signal.title; byAct.set(k, [...(byAct.get(k) ?? []), o]); }
  const compositionSongs = new Set(composition.map(o => `${o.signal.title}|${o.signal.artists[0]}`));
  out.push({
    id: 'direct-fit', question: 'fit',
    headline: verified.length ? `${verified.length} charted entries are recordings we hold.`
      : composition.length ? `${compositionSongs.size} charted songs are compositions we hold in another or an unverified version (title and artist match); none is a verified recording we hold.`
      : `No charted song or video is a recording or composition we hold. ${artistOnly.length} charted entries share an artist with our uploads.`,
    detail: [
      composition.length ? `Compositions: ${Array.from(compositionSongs).slice(0, 8).map(k => k.split('|')[0]).join('; ')} — on ${Array.from(new Set(composition.map(o => o.matches[0].track.channelName))).filter(Boolean).join(', ')}. Where our upload is marked Live or Acústico it is a different recording of the same song.` : '',
      artistOnly.length ? `Artist-level only (the charted song is not in what we hold): ${Array.from(byAct.entries()).sort((a, b) => b[1].length - a[1].length).slice(0, 6).map(([a, os]) => `${a} (${os.length}; ${Array.from(new Set(os.flatMap(o => o.matches.map(m => m.track.channelName)))).filter(Boolean).join(', ')})`).join('; ')}.` : '',
      sharedTitle.length ? `${sharedTitle.length} further entries share only a title with an upload; almost all will be different songs and are kept out of the main list.` : '',
    ].filter(Boolean).join(' '),
    numbers: [{ label: 'Verified recording', value: String(verified.length) }, { label: 'Same composition', value: String(composition.length) }, { label: 'Artist only', value: String(artistOnly.length) }, { label: 'Shared title only', value: String(sharedTitle.length) }],
    refs: [...verified, ...composition, ...artistOnly].slice(0, 10).map(o => ({ kind: 'opportunity' as const, id: o.id, label: `#${o.signal.rank} ${o.signal.title} — ${o.signal.artists.join(', ')} · ${o.signal.territory} · ${o.matches[0].track.channelName}` })),
    limits: ['A title-and-artist match is a composition match: the charted recording and our upload may differ in version, and the charted figures belong to the charted recording, not ours.', 'Matching is by text (video id and ISRC where the source gives them). The source catalogue tier is empty, so availability of unpublished tracks is unknown.'],
  });

  /* 6. Contextual fit. */
  if (contextual.length) {
    const top = contextual.slice(0, 3);
    out.push({
      id: 'contextual-fit', question: 'fit',
      headline: `${contextual.length} contextual connections between a recurring chart label and a channel that already programmes it.`,
      detail: top.map(c => `${c.channelName}: ${pct(c.channelShare)} of its ${c.channelLabelled} labelled uploads carry the pattern's label (${c.patternId.split('|').slice(-1)[0]})`).join('; ') + '. Hypotheses, not evidence those uploads will chart.',
      numbers: [{ label: 'Connections', value: String(contextual.length) }, { label: 'Channels involved', value: String(new Set(contextual.map(c => c.channelSlug)).size) }],
      refs: top.map(c => ({ kind: 'contextual' as const, id: `${c.patternId}|${c.channelSlug}`, label: `${c.channelName} ← ${c.patternId.split('|').slice(-2).join(' ')}` })),
      limits: ['Contextual matches rest on labels that are mostly inferred; a human review of the labels is the cheapest way to firm them up.'],
    });
  }

  /* 7. What to investigate. */
  const gate = opportunities.filter(o => o.stage === 'consider-paid-test');
  const act = opportunities.filter(o => o.stage === 'act-editorially');
  out.push({
    id: 'next', question: 'next',
    headline: gate.length ? `${gate.length} opportunities clear the paid-test gate.` : act.length ? `${act.length} editorial actions are feasible now; nothing clears the paid-test gate.` : 'Nothing is ready to act on; the useful next step is more readings and a label review.',
    detail: gate.length ? 'Each has a verified recording, a signal held across comparable readings and an owned baseline for that upload. Write the hypothesis down before anything else.' : act.length ? 'Credible matches with an editorial action (feature, playlist position, a Short cut from the recording). The paid-test gate also needs the signal to hold across two or more comparable readings and the verified upload to have its own earlier reading.' : 'Direct connections are artist-level only, so the editorial options are artist playlists on the channels that hold those acts; a paid test would need a verified recording and a baseline we do not yet have.',
    numbers: [{ label: 'Paid-test gate', value: String(gate.length) }, { label: 'Act editorially', value: String(act.length) }, { label: 'Monitor', value: String(opportunities.filter(o => o.stage === 'monitor').length) }],
    refs: [...gate, ...act].slice(0, 6).map(o => ({ kind: 'opportunity' as const, id: o.id, label: `${o.signal.title} — ${o.signal.artists.join(', ')} · ${o.signal.territory}` })),
    limits: ['A chart entry alone never justifies spend. Cost, revenue and audience data are not in this sandbox and are not estimated.'],
  });

  return out;
}

export { persistence };
