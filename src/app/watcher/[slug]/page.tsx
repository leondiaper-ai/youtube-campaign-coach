import WatcherArtistView from '@/components/WatcherArtistView';

/* ═══════════════════════════════════════════════════════════════════════
   OUR OWN ARTIST PAGE — now genuinely just a mount point.

   This used to assemble a top bar (back link, a Behaviour link that only
   appeared for pinned artists, a pin button) and pass a separate metrics
   strip. All of that has moved into the view itself:

     - the actions are ArtistActionBar, rendered by WatcherArtistView
       whenever no `chrome` is supplied, so every reader of the page gets
       the same controls in the same place;
     - the format split and markets are part of ArtistOverview now, so
       passing FormatSplitPanel here would render them a second time.

   A team board still passes its own chrome, because its pin writes to
   that board's store and its "back" goes somewhere else.
   ═══════════════════════════════════════════════════════════════════════ */

export const revalidate = 600;

export default async function WatcherPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <WatcherArtistView
      slug={slug}
      signature="Watcher watches · Coach plans · You decide"
    />
  );
}
