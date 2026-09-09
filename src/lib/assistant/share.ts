/**
 * FOUR AUDIENCES, ONE INTERPRETATION
 *
 * The workflow this replaces is: screenshot Watcher → paste into ChatGPT →
 * explain the context → ask for a report → edit it. The expensive part of
 * that is not the writing, it is re-explaining the campaign every time.
 *
 * So the interpretation is produced once, by the Coach, and stored. These
 * are four renderings of that same `CoachOverview` — deterministic string
 * assembly, no second model call. Which matters for a reason beyond cost:
 * if each audience got its own generation, the Slack post and the partner
 * summary could quietly disagree about what happened, and nobody would
 * notice until someone put them side by side.
 *
 * What differs between them is FRAMING and WHAT IS OMITTED, not substance:
 *
 *   INTERNAL   everything, including the missing context and the caveats
 *   SLACK      short, skimmable, one action, no hedging furniture
 *   SLIDE      headline plus three bullets, sized for a marketing deck
 *   PARTNER    observed behaviour and evidence, no internal plans, no
 *              recommendations to a third party, and the data limits stated
 *              explicitly because YouTube will know exactly what we can and
 *              cannot see
 */

import type { CoachOverview } from '../coach-service/types';

export type ShareFormat = 'INTERNAL' | 'SLACK' | 'SLIDE' | 'PARTNER';

export const SHARE_LABELS: Record<ShareFormat, string> = {
  INTERNAL: 'Internal',
  SLACK: 'Slack',
  SLIDE: 'Marketing slide',
  PARTNER: 'YouTube partner',
};

function clean(s: string): string {
  return (s ?? '').trim().replace(/\s+/g, ' ');
}

/** Split a recommendation into discrete actions where it reads as a list. */
function actions(o: CoachOverview): string[] {
  const r = clean(o.recommendation);
  if (!r || /^no (intervention|action)/i.test(r)) return [];
  return r
    .split(/(?:\.\s+|;\s*|\n)/)
    .map(s => s.trim().replace(/\.$/, ''))
    .filter(s => s.length > 12)
    .slice(0, 3);
}

export function renderShare(o: CoachOverview, format: ShareFormat): string {
  const name = o.artistName;
  const campaign = o.campaignName ? ` — ${o.campaignName}` : '';
  const acts = actions(o);

  if (format === 'SLACK') {
    /* Written to be read on a phone, in a channel, between two other
       things. One line of what, one of why, one of next. */
    const lines = [
      `*${name}${campaign}*`,
      clean(o.headline),
      clean(o.whatHappened),
    ];
    if (acts.length) lines.push(`*Next:* ${acts[0]}`);
    if (o.timing) lines.push(`_${clean(o.timing)}_`);
    return lines.filter(Boolean).join('\n');
  }

  if (format === 'SLIDE') {
    /* A slide is a headline and three bullets. Anything longer will be
       read aloud instead of shown, which defeats the point of a slide. */
    const bullets = [
      clean(o.whatHappened),
      clean(o.interpretation),
      ...acts,
    ].filter(Boolean).slice(0, 3);
    return [
      name.toUpperCase() + (o.campaignName ? ` · ${o.campaignName.toUpperCase()}` : ''),
      '',
      clean(o.headline),
      '',
      ...bullets.map(b => `• ${b}`),
    ].join('\n');
  }

  if (format === 'PARTNER') {
    /* For YouTube. Observed behaviour and the evidence behind it — no
       internal plans, no forward-looking commitments, and no advice to
       someone who does not report to us. The limits paragraph is not
       throat-clearing: the reader knows precisely which metrics a public
       API exposes, and claiming more would cost credibility immediately. */
    const observed = o.evidence
      .filter(e => e.sourceType === 'WATCHER' || e.sourceType === 'PUBLIC_YOUTUBE')
      .slice(0, 5);
    return [
      `${name}${campaign}`,
      '',
      clean(o.headline),
      '',
      'WHAT WE OBSERVED',
      clean(o.whatHappened),
      '',
      ...(observed.length
        ? ['EVIDENCE', ...observed.map(e => `• ${clean(e.claim)}`), '']
        : []),
      'HOW WE READ IT',
      clean(o.interpretation),
      '',
      'DATA BASIS',
      'Public YouTube Data API only — upload dates, durations, titles and lifetime ' +
      'view counts. No retention, traffic source, impression or click-through data ' +
      'is used, and no claim is made about them.',
      o.missingContext ? `\nNot visible to us: ${clean(o.missingContext)}` : '',
    ].filter(Boolean).join('\n');
  }

  /* INTERNAL — the full picture, caveats included. */
  return [
    `${name}${campaign}`,
    `Status: ${o.status.replace(/_/g, ' ')} · Confidence: ${o.confidence}`,
    '',
    'THE READ',
    clean(o.headline),
    clean(o.interpretation),
    '',
    'WHAT HAPPENED',
    clean(o.whatHappened),
    '',
    ...(acts.length ? ['NEXT', ...acts.map(a => `• ${a}`), ''] : []),
    ...(o.timing ? ['TIMING', clean(o.timing), ''] : []),
    ...(o.evidence.length
      ? ['EVIDENCE', ...o.evidence.slice(0, 6).map(e => `• [${e.sourceType}] ${clean(e.claim)}`), '']
      : []),
    'WHAT WE COULD NOT SEE',
    clean(o.missingContext) || 'Not stated.',
    '',
    `Next check: ${clean(o.nextCheck) || 'not set'}`,
    `Prepared ${new Date(o.generatedAt).toLocaleString('en-GB')} · ${o.producedBy}`,
  ].filter(Boolean).join('\n');
}
