import UKLandscape from '@/components/UKLandscape';

export const dynamic = 'force-dynamic';

const TITLE = 'UK YouTube Landscape — Virgin Music Group';
const DESCRIPTION =
  "Virgin's UK YouTube performance across our consumption data and the wider UK YouTube audience.";

export const metadata = {
  /* `absolute` bypasses the root layout's "%s — Decision System"
     template. That suffix, and the "YouTube Campaign Coach" open-graph
     name beneath it, are our internal tooling names — they would be
     the first thing a partner saw in the browser tab and in the link
     preview when this URL is pasted into an email. Overridden here
     only; every internal page keeps the template. */
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'Virgin Music Group',
    type: 'website',
  },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
};

/**
 * This page is sent to people outside Virgin, including YouTube, so it
 * stands on its own: no link back into the internal Watcher, and no
 * internal strapline. Everything a first-time viewer needs is in the
 * page itself.
 */
export default function UKLandscapePage() {
  return (
    <main className="min-h-screen px-5 sm:px-8 py-10 max-w-[1500px] mx-auto">
      <UKLandscape />
    </main>
  );
}
