import Link from 'next/link';
import { RESOURCE_GROUPS, type ResourceKind } from '@/lib/resources';
import { AppHeader, PageTitle } from '@/components/ui/AppHeader';

export const metadata = {
  title: 'Resources — YouTube Campaign System',
  description: 'Decks, analysis and source data produced for Virgin Music YouTube campaigns.',
};

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
    <main className="min-h-screen bg-paper text-ink">
      <AppHeader
        nav={[
          { href: '/growth', label: 'Channel Health' },
          { href: '/campaigns', label: 'Active Campaigns' },
          { href: '/coach', label: 'Coach' },
          { href: '/teams', label: 'Workspaces' },
          { href: '/resources', label: 'Resources' },
        ]}
        workspace="Virgin Music UK"
      />

      <div className="max-w-[1180px] mx-auto px-6">
        <PageTitle
          title="Resources"
          lede="Everything produced for Virgin Music on YouTube — artist decks, market analysis, and the method behind the numbers. Current versions only."
        />

        {/* ── The hub ──────────────────────────────────────────────────
            This page is the file library: finished decks and reports, by
            date. The hub is the live index of the same work — campaigns
            and artist intelligence as they stand today. Somebody landing
            here looking for "the Kings of Leon story" wants the hub, and
            until now nothing in the product pointed at it. */}
        <a
          href="/intelligence"
          className="group block no-underline rounded-card overflow-hidden mb-10 border border-ink/80 bg-ink"
        >
          <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-5">
            <div className="min-w-0">
              <div className="text-[11px] font-black uppercase tracking-eyebrow">
                <span className="text-paper">VMG</span>
                <span className="text-signal ml-1.5">YOUTUBE HUB</span>
              </div>
              <div className="text-h3 font-extrabold text-paper mt-2">
                Campaigns and artist intelligence, live
              </div>
              <p className="text-body mt-1.5 max-w-[62ch]" style={{ color: 'rgba(250,247,242,0.62)' }}>
                Every active campaign and what we have gathered on each artist —
                across Virgin Music Group and the wider YouTube ecosystem. The
                pages below are the finished documents; the hub is the current
                picture.
              </p>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-label text-signal shrink-0 group-hover:translate-x-0.5 transition-transform">
              Open the hub →
            </span>
          </div>
        </a>

        {RESOURCE_GROUPS.map((group) => (
          <section key={group.heading} className="mb-9">
            <h2 className="text-h4 font-extrabold text-ink">{group.heading}</h2>
            {group.note && (
              <p className="text-meta text-muted mt-1 mb-3 max-w-[72ch]">{group.note}</p>
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
                        className="text-[11px] font-bold uppercase tracking-label px-1.5 py-0.5 rounded"
                        style={{ background: kind.bg, color: kind.fg }}
                      >
                        {r.kind}
                      </span>
                      {r.external && (
                        <span className="text-[11px] font-bold uppercase tracking-label px-1.5 py-0.5 rounded"
                          style={{ background: NEUTRAL_BADGE.bg, color: NEUTRAL_BADGE.fg }}>
                          Public link
                        </span>
                      )}
                    </div>
                    <p className="text-body text-secondary mt-1 leading-snug max-w-[78ch]">
                      {r.blurb}
                    </p>
                    <div className="text-micro uppercase tracking-label text-muted mt-1.5">
                      {r.updated}
                      {r.download && ' · Downloads'}
                      {r.offsite && ' · Opens in a new tab'}
                    </div>
                  </>
                );

                const cls =
                  'block bg-surface rounded-card px-4 py-3.5 no-underline ' +
                  'border border-line hover:border-line-strong transition-colors';

                if (r.download) {
                  return <a key={r.href} href={r.href} download className={cls}>{inner}</a>;
                }
                if (r.offsite) {
                  return (
                    <a key={r.href} href={r.href} target="_blank" rel="noopener noreferrer" className={cls}>
                      {inner}
                    </a>
                  );
                }
                return <Link key={r.href} href={r.href} className={cls}>{inner}</Link>;
              })}
            </div>
          </section>
        ))}

        <p className="text-micro text-muted pb-14 max-w-[72ch] leading-relaxed">
          Superseded drafts are kept off this page on purpose. If you need an earlier
          version of the market deck, it is on the shared drive rather than here.
        </p>
      </div>
    </main>
  );
}
