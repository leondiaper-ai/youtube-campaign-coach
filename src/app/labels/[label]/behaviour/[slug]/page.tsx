import Link from 'next/link';
import { notFound } from 'next/navigation';
import CampaignBehaviour from '@/components/CampaignBehaviour';
import ChannelAuditButton from '@/components/ChannelAuditButton';
import { getLabelWorkspace } from '@/lib/labels';
import { getArtistsForMarket } from '@/lib/marketScope';
import { readAllLiveSnaps } from '@/lib/kvCache';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Channel Behaviour — Label Watcher', robots: { index: false, follow: false } };

export default async function LabelBehaviourPage({ params }: { params: { label: string; slug: string } }) {
  const label = getLabelWorkspace(params.label);
  if (!label || label.slug !== params.label) notFound();
  const artists = (await getArtistsForMarket(label.workspaceId)).sort((a, b) => a.name.localeCompare(b.name));
  const artist = artists.find(a => a.slug === params.slug);
  if (!artist) notFound();
  const snapshots = await readAllLiveSnaps(artists.flatMap(a => a.channelHandle ? [a.channelHandle] : []));
  const home = '/labels/' + label.slug;
  return <div className="min-h-screen bg-paper text-ink">
    <header className="flex items-center gap-4 px-5 py-3 border-b border-line">
      <Link href={home} className="flex items-center gap-3 no-underline">
        <img src={label.logo} width={32} height={32} alt="" />
        <span className="text-[13px] font-black">{label.name}</span>
      </Link>
      <span className="text-muted" aria-hidden>│</span>
      <Link href={home} className="text-[11px] font-bold uppercase tracking-wide text-muted">← Channel Health</Link>
      <div className="ml-auto"><ChannelAuditButton slug={artist.slug} name={artist.name} /></div>
    </header>
    <div className="flex items-start">
      <nav aria-label="Label artists" className="sticky top-0 flex flex-col items-center gap-3 py-4 shrink-0 overflow-y-auto" style={{ width: 72, height: 'calc(100dvh - 57px)', background: '#1A1A1A' }}>
        <Link href={home} aria-label="Back to Channel Health" title="Back to Channel Health" className="flex items-center justify-center shrink-0 rounded-full no-underline" style={{ width: 42, height: 42, background: '#303030', color: '#FAF7F2' }}>←</Link>
        {artists.map(a => {
          const thumbnail = a.channelHandle ? snapshots.get(a.channelHandle)?.thumbnail : null;
          const selected = a.slug === artist.slug;
          return <Link key={a.slug} href={home + '/behaviour/' + a.slug} title={a.name} aria-label={a.name} aria-current={selected ? 'page' : undefined}
            className="flex items-center justify-center shrink-0 rounded-full overflow-hidden no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            style={{ width: 44, height: 44, border: selected ? '2.5px solid #FAF7F2' : '2.5px solid transparent', background: '#303030', color: '#FAF7F2', opacity: selected ? 1 : 0.75 }}>
            {thumbnail ? <img src={thumbnail} alt="" width={44} height={44} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span className="text-xs font-bold">{a.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2)}</span>}
          </Link>;
        })}
      </nav>
      <main className="flex-1 min-w-0"><CampaignBehaviour key={artist.slug} slug={artist.slug} artistName={artist.name} noBreakout /></main>
    </div>
  </div>;
}
