import Link from 'next/link';
import { isPinned } from '@/lib/campaignStore';
import PinCampaignButton from '@/components/PinCampaignButton';
import WatcherArtistView from '@/components/WatcherArtistView';

/* Our own artist page. The analysis lives in WatcherArtistView, which
   the regional boards render too; what belongs to us alone is this
   top bar — the way back to our dashboard, and a pin that writes to
   our campaign store rather than a team's board. */

export const revalidate = 600;

export default async function WatcherPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const campaignPinned = await isPinned(slug);

  return (
    <WatcherArtistView
      slug={slug}
      signature="Watcher watches · Coach plans · You decide"
      chrome={
        <div className="flex items-center justify-between mb-8">
          <Link href="/growth" className="text-[11px] uppercase tracking-[0.18em] text-ink/55 hover:text-ink">
            ← Dashboard
          </Link>
          <div className="flex items-center gap-3">
            {campaignPinned && (
              <Link
                href={`/campaigns?behaviour=${slug}`}
                className="px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-[0.08em] no-underline transition-colors"
                style={{ background: '#2C25FF', color: '#fff' }}
              >
                Behaviour
              </Link>
            )}
            <PinCampaignButton slug={slug} initiallyPinned={campaignPinned} />
          </div>
        </div>
      }
    />
  );
}
