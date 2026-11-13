'use client';
import type { ReactNode, MouseEvent } from 'react';
/** Allow only roster-scoped channel and behaviour drilldowns from the partner board. */
export default function PartnerLinkGuard({ children, allowedSlugs = [], allowedDeepDiveHrefs = [] }: { children: ReactNode; allowedSlugs?: string[]; allowedDeepDiveHrefs?: string[] }) {
  function handleLink(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest('a[href]');
    if (!anchor) return;
    const href = anchor.getAttribute('href') ?? '';
    if (!href.startsWith('/') || href.startsWith('//')) return;
    const url = new URL(href, 'https://partner.local');
    if (url.pathname === '/youtube-uk' || allowedDeepDiveHrefs.includes(url.pathname)) {
      event.preventDefault();
      event.stopPropagation();
      window.location.assign(url.pathname);
      return;
    }
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
  return <div onClickCapture={handleLink} className="[&_button[title='Follow_this_campaign']]:hidden">{children}</div>;
}
