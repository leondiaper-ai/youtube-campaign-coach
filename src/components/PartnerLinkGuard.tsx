'use client';
import type { ReactNode, MouseEvent } from 'react';
/** Allow only roster-scoped channel and behaviour drilldowns from the partner board. */
export default function PartnerLinkGuard({ children, allowedSlugs = [] }: { children: ReactNode; allowedSlugs?: string[] }) {
  function handleLink(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest('a[href]');
    if (!anchor) return;
    const href = anchor.getAttribute('href') ?? '';
    if (!href.startsWith('/') || href.startsWith('//')) return;
    const url = new URL(href, 'https://partner.local');
    const slug = url.pathname.startsWith('/watcher/') ? url.pathname.slice('/watcher/'.length) : url.pathname === '/campaigns' ? url.searchParams.get('behaviour') : null;
    if (slug && allowedSlugs.includes(slug)) {
      event.preventDefault();
      event.stopPropagation();
      window.location.assign(url.pathname.startsWith('/watcher/') ? `/watcher/${slug}?partner=youtube-uk` : `/campaigns?behaviour=${encodeURIComponent(slug)}&partner=youtube-uk`);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }
  return <div onClickCapture={handleLink}>{children}</div>;
}
