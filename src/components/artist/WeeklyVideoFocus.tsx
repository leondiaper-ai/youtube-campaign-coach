'use client';

import { useEffect, useState } from 'react';

type Video = { id: string; title: string; commentCount?: number | null; viewCount?: number | null; durationSec?: number | null };
type WeeklyFocus = { videoId: string | null; title: string | null; signal: string | null; action: string | null };

export default function WeeklyVideoFocus({ uploads }: { uploads: Video[] }) {
  const [focus, setFocus] = useState<WeeklyFocus | null>(null);
  useEffect(() => {
    const sync = () => {
      const match = window.location.hash.match(/^#weekly-video-([A-Za-z0-9_-]{11})$/);
      const params = new URLSearchParams(window.location.search);
      const videoId = match?.[1] ?? null;
      const signal = params.get('weeklySignal');
      setFocus(videoId || signal ? {
        videoId,
        title: params.get('weeklyTitle'),
        signal,
        action: params.get('weeklyAction'),
      } : null);
    };
    sync();
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);
  if (!focus) return null;
  const video = focus.videoId ? uploads.find(u => u.id === focus.videoId) : null;
  const url = focus.videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(focus.videoId)}` : null;
  return (
    <section id={focus.videoId ? `weekly-video-${focus.videoId}` : 'weekly-signal'} className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-ink">
      <div className="font-bold text-base">What changed this week</div>
      {focus.signal && <p className="mt-2 font-semibold">{focus.signal}</p>}
      {(video || focus.title) && <p className="mt-2 font-semibold">{video?.title || focus.title}</p>}
      {focus.action && <p className="mt-1 text-ink/70">{focus.action}</p>}
      {!focus.action && url && <p className="mt-1 text-ink/70">This video is attracting attention. Check its comments and links, then consider how to direct viewers to more music.</p>}
      {url && <div className="mt-3 flex flex-wrap gap-4 font-semibold">
        <a href={url} target="_blank" rel="noopener noreferrer" className="underline">Watch video ↗</a>
        <a href={url + '&lc=0'} target="_blank" rel="noopener noreferrer" className="underline">View comments on YouTube ↗</a>
      </div>}
    </section>
  );
}
