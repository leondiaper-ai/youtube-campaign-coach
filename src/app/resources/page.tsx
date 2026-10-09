import { AppHeader, PageTitle } from '@/components/ui/AppHeader';

export const metadata = {
  title: 'Resources — YouTube Campaign System',
  description: 'Campaigns and artist intelligence for Virgin Music on YouTube.',
};

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
          lede="Campaigns, artist intelligence and the method behind the numbers, in one place."
        />

        {/* ── The hub ──────────────────────────────────────────────────
            With the file list gone this page is one door, and the hub is
            what is behind it: campaigns and artist intelligence as they
            stand today rather than as they stood on the day a deck was
            exported. */}
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
                across Virgin Music Group and the wider YouTube ecosystem, kept
                current rather than exported once.
              </p>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-label text-signal shrink-0 group-hover:translate-x-0.5 transition-transform">
              Open the hub →
            </span>
          </div>
        </a>

        {/* ─── The list is gone, deliberately ──────────────────────────
            Twenty-five decks, reports and downloads across five headings
            used to sit here. The hub above carries the same work as a
            live index, so the list was a second, ageing description of
            it — and the failure mode of two descriptions is that nobody
            can tell which is current.

            Nothing is deleted: RESOURCE_GROUPS still holds every item in
            src/lib/resources.ts, and every file is still at its own URL.
            Restoring the list is re-adding the map that used to be here.
            If a deck needs linking in the meantime, it belongs on the
            hub. */}

      </div>
    </main>
  );
}
