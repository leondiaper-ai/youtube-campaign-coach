import { notFound, redirect } from 'next/navigation';
import { getLabelWorkspace } from '@/lib/labels';
import { getArtistsForMarket } from '@/lib/marketScope';

export const dynamic = 'force-dynamic';

/** Open the full Channel Behaviour experience with the label's entire
 * roster in its artist sidebar, rather than a separate directory page. */
export default async function LabelBehaviourIndex({ params }: { params: { label: string } }) {
  const label = getLabelWorkspace(params.label);
  if (!label || label.slug !== params.label) notFound();
  const artists = (await getArtistsForMarket(label.workspaceId))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!artists.length) {
    redirect('/labels/' + label.slug);
  }
  redirect('/labels/' + label.slug + '/behaviour/' + encodeURIComponent(artists[0].slug));
}
