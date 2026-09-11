// ─────────────────────────────────────────────────────────────────────────────
// THE WORKED EXAMPLE
//
// The brief's own scenario, run against the real seeded Deep Dives. Four
// external artists described exactly as the brief describes them, scored, and
// matched. This is a demonstration rather than a test: it exists so that the
// matcher's behaviour can be seen without a populated Redis, and so that a
// change which quietly stops matching is visible in one command.
//
// The Dijon row is the important one. Strong mechanic, credible artist,
// nothing distinctive to look at — so it matches, stays in the library, and
// does NOT reach the board. That is the two-score rule doing its job, and if
// it ever starts returning board=true something has been collapsed.
//
// Run: npx tsc src/lib/intelligence/__tests__/workedExample.ts --outDir /tmp/we \
//        --module commonjs --target es2020 --moduleResolution node \
//        --esModuleInterop --skipLibCheck && node /tmp/we/intelligence/__tests__/workedExample.js
// ─────────────────────────────────────────────────────────────────────────────

import { SEEDED_DEEP_DIVES } from '../deepDives';
import { boardEligible, partitionTags, type NeedTag } from '../types';

/* Fixtures. These are NOT saved research records — they are the brief's
   four examples, written here so the demonstration needs no store. */
const EXTERNAL = [
  { subject: 'Aimyon',         mechanic: 'archive live turned into a multi-night Premiere run', tags: ['archive_live','premiere_behaviour','channel_reactivation','low_new_production'], scores: {mechanicValue:3, culturalRelevance:3, visualBoardValue:2} },
  { subject: 'Wet Leg',        mechanic: 'a named studio-session series',                       tags: ['named_series','archive_live','low_new_production'],                        scores: {mechanicValue:3, culturalRelevance:3, visualBoardValue:3} },
  { subject: 'Magdalena Bay',  mechanic: 'album-making process as a long-form event',           tags: ['long_form_event','bts_process','named_series'],                           scores: {mechanicValue:3, culturalRelevance:2, visualBoardValue:3} },
  { subject: 'Dijon',          mechanic: 'live performance as the hero visual',                 tags: ['archive_live','follow_up_7_14'],                                          scores: {mechanicValue:2, culturalRelevance:3, visualBoardValue:1} },
];

for (const slug of Object.keys(SEEDED_DEEP_DIVES)) {
  const d = SEEDED_DEEP_DIVES[slug];
  const needs = new Map<string,string>();
  for (const p of [...d.channelGaps, ...d.strategicOpportunities])
    for (const t of p.needTags) if (!needs.has(t)) needs.set(t, p.point);

  console.log(`\n=== ${d.artistName} (${slug}) — ${needs.size} distinct needs`);
  console.log('    ' + Array.from(needs.keys()).join(', '));
  for (const e of EXTERNAL) {
    const { valid } = partitionTags(e.tags);
    const shared = valid.filter(t => needs.has(t));
    if (!shared.length) continue;
    console.log(`  MATCH ${e.subject} [${shared.join(', ')}] board=${boardEligible(e.scores as any)}`);
    for (const t of shared) console.log(`        ${t} :: ${needs.get(t)}`);
  }
}
