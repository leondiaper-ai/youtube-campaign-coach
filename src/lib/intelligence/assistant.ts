/**
 * THE ASSISTANT
 *
 * "What should I pay attention to today?" — asked in the Watcher, answered
 * from the Watcher universe.
 *
 * ── WHY THIS IS NOT A CHATBOT ────────────────────────────────────────
 * The brief is explicit, and it is right: a free-text box that forwards
 * everything to a model produces a slower, less reliable version of the
 * tools we already have. So this file routes.
 *
 * Roster-level questions — what needs me, what have we learned, find me a
 * case study — are answered from the STORES, deterministically, in
 * milliseconds and for nothing. Only an artist-specific question that the
 * stores cannot answer reaches a model, and when it does it goes through
 * `askCoach` so it inherits the tools, the provenance and the leak filter.
 *
 * The consequence worth stating: most questions here never cost a token.
 */

import { askCoach, type ServiceCtx } from '../coach-service/service';
import { ARTISTS, mergeArtistLists } from '../artists';
import { listCustomArtists } from '../artistStore';
import { latestRun, listRecentFindings, searchCaseStudies, listCaseStudies } from './store';
import { listPrinciples } from './principles';
import type { IntelligenceFinding, CaseStudyCandidate } from './types';

export type AssistantIntent =
  | 'TODAY'            // what deserves my attention
  | 'CASE_STUDIES'     // find me a case study
  | 'LEARNED'          // what have we learned
  | 'ARTIST'           // something about one artist
  | 'PRINCIPLES';      // what do we believe about YouTube

export interface AssistantReply {
  intent: AssistantIntent;
  /** Markdown. Short by design. */
  answer: string;
  findings?: IntelligenceFinding[];
  caseStudies?: CaseStudyCandidate[];
  /** True when a model was called. Most replies are false. */
  usedModel: boolean;
  tokens: number;
  artistId?: string;
}

/**
 * Intent detection is keyword-based and stays that way. Using a model to
 * decide which store to read would double the latency of every question to
 * save writing twenty lines, and would fail in ways that are harder to fix.
 */
export function detectIntent(q: string): AssistantIntent {
  const s = q.toLowerCase();
  if (/case stud|example of|show youtube|best.in.class|find me an? (good|strong)/.test(s)) return 'CASE_STUDIES';
  if (/what (have|did) we learn|learned|remember|seen this before|pattern before/.test(s)) return 'LEARNED';
  if (/principle|best practice|what do we believe/.test(s)) return 'PRINCIPLES';
  if (/attention|today|priority|need me|what should i look|anything interesting|deep dive next/.test(s)) return 'TODAY';
  return 'ARTIST';
}

/** Longest roster name that appears in the question wins, so "Tove Lo Music" beats "Tove Lo". */
async function matchArtist(q: string): Promise<{ slug: string; name: string } | null> {
  const s = q.toLowerCase();
  const artists = mergeArtistLists(ARTISTS, await listCustomArtists());
  const hits = artists
    .filter(a => s.includes(a.name.toLowerCase()) || s.includes(a.slug.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length);
  return hits.length ? { slug: hits[0].slug, name: hits[0].name } : null;
}

function renderFinding(f: IntelligenceFinding): string {
  return [
    `**${f.artistName} — ${f.headline}**`,
    f.whyItMatters,
    `_Next:_ ${f.action}`,
    `_Confidence ${f.confidence} · triggered by: ${f.signal.reason}_`,
  ].join('\n\n');
}

export async function ask(question: string, ctx: ServiceCtx): Promise<AssistantReply> {
  const intent = detectIntent(question);

  if (intent === 'TODAY') {
    const run = await latestRun();
    if (!run) {
      return {
        intent, usedModel: false, tokens: 0,
        answer: 'No intelligence run has been performed yet. Run one to populate this.',
      };
    }
    const fresh = run.findings.filter(f => f.status === 'NEW');
    if (!fresh.length) {
      return {
        intent, usedModel: false, tokens: 0, findings: [],
        answer:
          `Nothing needs you. The last run scanned ${run.metrics.channelsScanned} channels, ` +
          `triggered ${run.metrics.candidatesTriggered} candidates and found nothing material. ` +
          (run.watching.length ? `\n\nWatching: ${run.watching.map(w => w.artistName).join(', ')}.` : ''),
      };
    }
    return {
      intent, usedModel: false, tokens: 0, findings: fresh,
      answer: [
        `**${fresh.length} thing${fresh.length === 1 ? '' : 's'} deserve${fresh.length === 1 ? 's' : ''} attention**`,
        ...fresh.map((f, i) => `${i + 1}. ${renderFinding(f)}`),
        run.watching.length
          ? `\n**Watching** — ${run.watching.map(w => `${w.artistName} (${w.reason})`).join('; ')}`
          : '',
        `\n_Everything else across ${run.metrics.channelsScanned} channels is behaving normally._`,
      ].filter(Boolean).join('\n\n'),
    };
  }

  if (intent === 'CASE_STUDIES') {
    const hits = await searchCaseStudies(question);
    const all = hits.length ? hits : await listCaseStudies();
    if (!all.length) {
      return {
        intent, usedModel: false, tokens: 0, caseStudies: [],
        answer: 'No case study candidates recorded yet. They accumulate as investigations find them.',
      };
    }
    return {
      intent, usedModel: false, tokens: 0, caseStudies: all.slice(0, 8),
      answer: [
        `**${all.length} case stud${all.length === 1 ? 'y' : 'ies'}**`,
        ...all.slice(0, 8).map(c =>
          `**${c.artistName} — ${c.title}** _(${c.status}, ${c.evidenceClass})_\n${c.behaviourObserved}\n_Lesson:_ ${c.potentialLearning}`,
        ),
      ].join('\n\n'),
    };
  }

  if (intent === 'LEARNED') {
    const artist = await matchArtist(question);
    const recent = await listRecentFindings(40);
    const scoped = artist ? recent.filter(f => f.artistId === artist.slug) : recent;
    if (!scoped.length) {
      return {
        intent, usedModel: false, tokens: 0,
        answer: artist
          ? `Nothing recorded for ${artist.name} yet.`
          : 'No findings recorded yet.',
      };
    }
    return {
      intent, usedModel: false, tokens: 0, findings: scoped.slice(0, 10),
      answer: [
        artist ? `**What we know about ${artist.name}**` : '**Recent findings**',
        ...scoped.slice(0, 10).map(f =>
          `- **${f.artistName}:** ${f.headline} _(${f.createdAt.slice(0, 10)}, ${f.status})_`,
        ),
      ].join('\n'),
    };
  }

  if (intent === 'PRINCIPLES') {
    const ps = await listPrinciples();
    return {
      intent, usedModel: false, tokens: 0,
      answer: [
        '**Working principles** — none of these is settled, and the status says how far from settled.',
        ...ps.map(p => `- **${p.title}** _(${p.status})_ — ${p.description} _Source: ${p.source}._`),
      ].join('\n'),
    };
  }

  /* ARTIST — the only branch that costs anything. */
  const artist = await matchArtist(question);
  if (!artist) {
    return {
      intent, usedModel: false, tokens: 0,
      answer:
        'I could not tell which artist you meant. Name one, or ask what deserves attention today, ' +
        'what we have learned, or for a case study.',
    };
  }

  const res = await askCoach({
    artistId: artist.slug,
    question:
      `${question}\n\nAnswer from the tools, comparing the artist against their own history. ` +
      `If the data does not support an answer, say so plainly rather than reasoning around it.`,
    contextScope: 'ARTIST',
  }, ctx);

  if (!res.ok) {
    return {
      intent, usedModel: false, tokens: 0, artistId: artist.slug,
      answer: `Could not investigate ${artist.name}: ${res.detail}`,
    };
  }

  return {
    intent,
    usedModel: true,
    tokens: res.data.usage?.totalTokens ?? 0,
    artistId: artist.slug,
    answer: res.data.answer,
  };
}
