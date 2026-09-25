import Link from 'next/link';
import UKLandscape from '@/components/UKLandscape';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'UK YouTube Landscape — YouTube Campaign System',
  description: "Virgin's UK YouTube consumption, audience and biggest artists.",
};

export default function UKLandscapePage() {
  return (
    <main className="min-h-screen px-5 sm:px-8 py-8 max-w-[1500px] mx-auto">
      <div className="mb-8">
        <Link href="/" className="text-[11px] uppercase tracking-[0.18em] text-ink/55 hover:text-ink no-underline">
          ← Home
        </Link>
      </div>
      <UKLandscape />
      <div className="mt-12 text-[10px] uppercase tracking-[0.18em] text-ink/25">
        Watcher watches · Coach plans · You decide
      </div>
    </main>
  );
}
