import UKLandscape from '@/components/UKLandscape';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'UK YouTube Landscape — Virgin Music Group',
  description:
    "Virgin's UK YouTube performance across our consumption data and the wider UK YouTube audience.",
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
