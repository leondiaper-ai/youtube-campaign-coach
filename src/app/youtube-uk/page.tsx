import YouTubeUKSharedView from '@/components/YouTubeUKSharedView';
export const revalidate = 600;
export const metadata = { title: 'YouTube UK Shared Watcher — YouTube Campaign System', description: 'Shared UK priority artist monitoring with the existing Channel Health Watcher.' };
export default async function Page({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>> }) {
  return <YouTubeUKSharedView searchParams={searchParams} />;
}
