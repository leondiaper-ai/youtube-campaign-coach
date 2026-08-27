import Link from 'next/link';
import { RESOURCE_GROUPS, type ResourceKind } from '@/lib/resources';

export const metadata = {
  title: 'Resources — YouTube Campaign System',
  description: 'Decks, analysis and source data produced for Virgin Music YouTube campaigns.',
};

const PAPER = '#FAF7F2';
const INK = '#0E0E0E';
/* Active-pill background. Matches /growth so the nav reads identically. */
const SOFT = '#F6F1E7';

/* Badge tints. Distinct enough to scan a column for "the spreadsheet" without
   reading titles, muted enough that they do not compete with them. */
const KIND_STYLE: Record<ResourceKind, { bg: string; fg: string }> = {
  Deck:   { bg: 'rgba(193,39,45,0.10)',  fg: 'rgba(150,30,35,0.95)' },
  Report: { bg: 'rgba(14,14,14,0.07)',   fg: 'rgba(14,14,14,0.62)'  },
  Data:   { bg: 'rgba(23,105,90,0.11)',  fg: 'rgba(18,85,72,0.95)'  },
  Page:   { bg: 'rgba(40,70,140,0.10)',  fg: 'rgba(32,58,118,0.95)' },
};

const NEUTRAL_BADGE = { bg: 'rgba(14,14,14,0.07)', fg: 'rgba(14,14,14,0.62)' };

export default function ResourcesPage() {
  return (
    <main className="min-h-screen" style={{ background: PAPER, color: INK }}>
      <div className="max-w-[1080px] mx-auto px-6 py-10">
        {/* Header. Mirrors the pill nav on /growth so this reads as one of the
            main boards rather than a page that arrived from somewhere else. */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-ink/45">
            YouTube Campaign System
          </div>
          <div className="flex items-center gap-1 mt-2">
            <Link
              href="/growth"
              className="px-3 py-1.5 rounded-md text-[13px] font-bold text-ink/50 hover:text-ink hover:bg-[#F6F1E7] transition-colors"
            >
              Channel Health
            </Link>
            <Link
              href="/campaigns"
              className="px-3 py-1.5 rounded-md text-[13px] font-bold text-ink/50 hover:text-ink hover:bg-[#F6F1E7] transition-colors"
            >
              Active Campaigns
            </Link>
            <Link
              href="/coach"
              className="px-3 py-1.5 rounded-md text-[13px] font-bold text-ink/50 hover:text-ink hover:bg-[#F6F1E7] transition-colors"
            >
              Coach
            </Link>
            <span className="px-3 py-1.5 rounded-md text-[13px] font-black" style={{ background: SOFT }}>
              Resources
            </span>
          </div>
          <h1 className="font-black text-[28px] leading-tight mt-4">Resources</h1>
          <p className="text-[11px] text-ink/35 mt-1 max-w-[560px]">
            Everything produced for Virgin Music on YouTube — artist decks, market analysis,
            and the method behind the numbers. Current versions only.
          </p>
        </div>

        {RESOURCE_GROUPS.map((group) => (
          <section key={group.heading} className="mb-9">
            <h2 className="text-[13px] font-black uppercase tracking-[0.14em] text-ink/70">
              {group.heading}
            </h2>
            {group.note && (
              <p className="text-[11px] text-ink/35 mt-1 mb-3 max-w-[620px]">{group.note}</p>
            )}

            <div className="grid gap-2 mt-3">
              {group.items.map((r) => {
                const kind = KIND_STYLE[r.kind];

                /* Files under /resources are static assets, not routes. next/link
                   would try to client-navigate to them, so they use a plain anchor
                   with `download`. Internal routes keep Link for prefetching. */
                const inner = (
                  <>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[14px] font-bold">{r.title}</span>
                      <span
                        className="text-[9px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded"
                        style={{ background: kind.bg, color: kind.fg }}
                      >
                        {r.kind}
                      </span>
                      {r.external && (
                        <span className="text-[9px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded"
                          style={{ background: NEUTRAL_BADGE.bg, color: NEUTRAL_BADGE.fg }}>
                          Public link
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-ink/50 mt-1 leading-snug max-w-[680px]">
                      {r.blurb}
                    </p>
                    <div className="text-[10px] uppercase tracking-[0.12em] text-ink/30 mt-1.5">
                      {r.updated}
                      {r.download && ' · Downloads'}
                    </div>
                  </>
                );

                const cls =
                  'block bg-white rounded-lg px-4 py-3 no-underline ' +
                  'border border-black/5 hover:border-black/15 transition-colors';

                return r.download ? (
                  <a key={r.href} href={r.href} download className={cls}>
                    {inner}
                  </a>
                ) : (
                  <Link key={r.href} href={r.href} className={cls}>
                    {inner}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        <p className="text-[10px] text-ink/25 mt-10 max-w-[620px] leading-relaxed">
          Superseded drafts are kept off this page on purpose. If you need an earlier
          version of the market deck, it is on the shared drive rather than here.
        </p>
      </div>
    </main>
  );
}
