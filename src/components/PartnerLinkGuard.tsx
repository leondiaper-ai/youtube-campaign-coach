'use client';
import type { ReactNode, MouseEvent } from 'react';
/** Partner board retains Watcher interactions but never follows internal app links. */
export default function PartnerLinkGuard({ children }: { children: ReactNode }) {
  function stopInternalLinks(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest('a[href]');
    if (!anchor) return;
    const href = anchor.getAttribute('href') ?? '';
    if (href.startsWith('/') && !href.startsWith('//')) {
      event.preventDefault();
      event.stopPropagation();
    }
  }
  return <div onClickCapture={stopInternalLinks} className="[&_a[href^='/']]:cursor-default [&_a[href^='/']]:no-underline">{children}</div>;
}
