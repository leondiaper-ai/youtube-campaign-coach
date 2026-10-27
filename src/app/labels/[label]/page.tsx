import { notFound } from 'next/navigation';
import GrowthPage from '@/app/growth/page';
import { getLabelWorkspace } from '@/lib/labels';
export const revalidate = 600;
export async function generateMetadata({ params }: { params: { label: string } }) {
  const label = getLabelWorkspace(params.label);
  return { title: label ? `${label.name} — YouTube Watcher` : 'Label Watcher', robots: { index: false, follow: false } };
}
export default async function LabelPage({ params }: { params: { label: string } }) {
  const label = getLabelWorkspace(params.label);
  if (!label || label.slug !== params.label) notFound();
  return GrowthPage({ searchParams: { market: label.workspaceId } });
}
