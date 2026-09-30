'use client';

/* ═══════════════════════════════════════════════════════════════════════
   HOW PEOPLE ARE REACTING — one line, near the top.

   ── WHY THIS IS A QUOTE AND NOT A SUMMARY ─────────────────────────────
   The obvious build for "one line of sentiment" is a sentence in our own
   voice: "Response to recent uploads is strongly positive." The engine
   behind this (lib/intelligence/fanResponse) argues at length against
   exactly that, and it is right: the page used to print a line of that
   shape and it is us asserting a conclusion the reader cannot check. A
   real comment with its like count attached is shorter, is evidence
   rather than assertion, and cannot be quietly wrong in the way a
   confident summary can.

   So the line is the strongest qualifying comment on the newest uploads.
   The theme label beside it ("anticipation", "live") is the one summary
   word the engine will stand behind, because it is a count over a
   classified set rather than a judgement.

   ── WHY IT CAN BE ABSENT ──────────────────────────────────────────────
   The engine withholds unless its gates pass — enough volume, spread
   across more than one video, recent enough, and genuinely positive. A
   withheld read is shown as "not enough comment signal to read", never as
   silence, because an empty space would be read as "nothing to report"
   when it means "we did not look hard enough to say". It is never shown
   as a negative verdict: that is a deliberate property of this engine,
   not an oversight, and percentages are never printed.

   ── WHY IT FETCHES ────────────────────────────────────────────────────
   Reading comments costs YouTube quota, and this page's stated property
   is that it makes no API request on load. So the page renders complete
   without this, and this arrives afterwards. Cached 12 hours per artist.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import { RULE } from './primitives';

type Quote = { text: string; likes: number; videoId: string; theme: string | null; source: string | null };
type FanRead = {
  display: boolean;
  quote: Quote | null;
  dominantTheme: string | null;
  evidence?: { commentsClassified?: number; assetsSampled?: unknown[] };
  withheldReason?: string | null;
};
type Payload = { ok: boolean; fanResponse: FanRead | null };

const THEME_WORD: Record<string, string> = {
  return: 'a return',
  song: 'the song',
  visual: 'the visuals',
  live: 'the live show',
  nostalgia: 'nostalgia',
  anticipation: 'anticipation',
  surprise: 'surprise',
  member: 'the band',
};

export default function AudienceLine({ slug }: { slug: string }) {
  const [state, setState] = useState<'loading' | 'done'>('loading');
  const [read, setRead] = useState<FanRead | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/fan-response/${encodeURIComponent(slug)}`)
      .then(r => r.json() as Promise<Payload>)
      .then(p => {
        if (!live) return;
        setRead(p?.fanResponse ?? null);
        setState('done');
      })
      .catch(() => live && setState('done'));
    return () => { live = false; };
  }, [slug]);

  /* Reserve nothing while loading. The line is supplementary, and a
     skeleton that collapses would shift the headline under the reader. */
  if (state === 'loading') return null;

  const quote = read?.display ? read.quote : null;

  if (!quote) {
    return (
      <div className="text-[12px] text-ink/35 mt-5 pl-5" style={{ borderLeft: `2px solid ${RULE}` }}>
        Not enough comment signal on the latest uploads to read a response yet.
      </div>
    );
  }

  const theme = quote.theme ?? read?.dominantTheme ?? null;
  const themeWord = theme ? THEME_WORD[theme] ?? null : null;

  return (
    <div className="mt-5 pl-5" style={{ borderLeft: `2px solid ${RULE}` }}>
      <div className="text-[13px] sm:text-[14px] text-ink/75 leading-snug max-w-[70ch]">
        <a
          href={`https://www.youtube.com/watch?v=${quote.videoId}&lc=`}
          target="_blank"
          rel="noopener noreferrer"
          className="no-underline hover:underline underline-offset-2 text-ink"
        >
          &ldquo;{quote.text}&rdquo;
        </a>
      </div>
      <div className="text-[10px] text-ink/40 mt-1.5 tabular-nums">
        {quote.likes.toLocaleString()} likes
        {quote.source ? ` · on the ${quote.source}` : ''}
        {themeWord ? ` · comments centre on ${themeWord}` : ''}
      </div>
    </div>
  );
}
