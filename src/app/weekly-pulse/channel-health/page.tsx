import YouTubeUKSharedView from '@/components/YouTubeUKSharedView';
export const revalidate = 600;
export const metadata = { title: 'Channel Health — YouTube Weekly Pulse' };
export default async function Page() {
  return <YouTubeUKSharedView partnerBriefing searchParams={{ market: 'uk' }} />;
}
