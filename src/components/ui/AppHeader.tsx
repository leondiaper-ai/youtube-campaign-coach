'use client';

/* ═══════════════════════════════════════════════════════════════════════
   APP HEADER — THE PRODUCT SHELL

   Eleven pages were drawing their own header, each with its own copy of
   the "YOUTUBE CAMPAIGN SYSTEM" eyebrow and its own pill row, which is
   why the navigation read as a row of loose buttons rather than part of
   a product. This is that header, once.

   WHAT IT DOES NOT DO
   It introduces no destinations and changes no routing. The caller
   passes the links it already had, including the market query string it
   was already threading by hand. If a page had three links before, it
   has the same three now.

   THE WORKSPACE CHIP
   A regional team needs to know at a glance which board they are on —
   the US and Nordics boards are the same product with different
   rosters, and the fastest way to erode trust is for someone to read
   Australia's numbers thinking they are their own. The chip is not
   decoration; it is the answer to "whose data am I looking at".
   ═══════════════════════════════════════════════════════════════════════ */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem {
  href: string;
  label: string;
  /** Matched against the pathname when the href carries a query string. */
  match?: string;
}

export function AppHeader({
  nav, workspace, meta, actions,
}: {
  nav: NavItem[];
  /** The team's own name for itself, e.g. "Virgin Music UK". */
  workspace?: string;
  /** Sync state, counts — anything that qualifies the data below. */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <header className="border-b border-line bg-surface">
      <div className="max-w-[1180px] mx-auto px-6">
        {/* Identity rail. The wordmark follows the hub: one word in ink,
            one in the accent, so the product has a mark rather than a
            sentence. */}
        <div className="flex items-center justify-between gap-6 h-[52px] border-b border-line-faint">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="no-underline shrink-0">
              <span className="text-[13px] font-black tracking-[0.1em] text-ink">VMG</span>
              <span className="text-[13px] font-black tracking-[0.1em] text-signal ml-1.5">YOUTUBE</span>
            </Link>
            {workspace && (
              <>
                <span className="w-px h-3.5 bg-line-strong shrink-0" aria-hidden />
                <span className="text-[11px] font-bold uppercase tracking-label text-muted truncate">
                  {workspace}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {meta && <div className="text-[11px] text-faint text-right leading-snug">{meta}</div>}
            {actions}
          </div>
        </div>

        {/* Navigation rail. Active state is a weight and an underline that
            meets the header's bottom edge — a filled pill competes with
            the page's own cards for attention. */}
        <nav className="flex items-center gap-1 -mb-px">
          {nav.map((item) => {
            const target = item.match ?? item.href.split('?')[0];
            const isActive = pathname === target;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'relative px-3 py-3 text-body no-underline transition-colors',
                  isActive
                    ? 'font-bold text-ink'
                    : 'font-semibold text-muted hover:text-ink',
                ].join(' ')}
              >
                {item.label}
                {isActive && (
                  <span className="absolute left-3 right-3 -bottom-px h-[2px] bg-signal rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

/* ── PageTitle ───────────────────────────────────────────────────────
   The band under the header: what this page is, and one line saying
   what it is for. The old pages opened straight into data with only a
   micro-label for context. */
export function PageTitle({
  title, lede, aside,
}: {
  title: string;
  lede?: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-8 pt-8 pb-6">
      <div className="min-w-0">
        <h1 className="text-h1 font-black text-ink">{title}</h1>
        {lede && <p className="text-bodyLg text-secondary mt-2 max-w-[62ch]">{lede}</p>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}
