'use client';

import { useEffect, useState } from 'react';

type Video = { id: string; title: string; commentCount?: number | null; viewCount?: number | null; durationSec?: number | null };

export default function WeeklyVideoFocus({ uploads }: { uploads: Video[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [linkedTitle, setLinkedTitle] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => {
      const match = window.location.hash.match(/^#weekly-video-([A-Za-z0-9_-]{11})$/);
      setSelected(match?.[1] ?? null);
      setLinkedTitle(new URLSearchParams(window.location.search).get('weeklyTitle'));
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  if (!selected) return null;
  const video = uploads.find(u => u.id === selected);
  const url = `https://www.youtube.com/watch?v=${encodeURIComponent(selected)}`;
  return (
    <section id={`weekly-video-${selected}`} className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-ink">
      <div className="font-bold text-base">From What changed this week</div>
      {(video || linkedTitle) ? (
        <>
          <p className="mt-1 font-semibold">{video?.title || linkedTitle}</p>
          <p className="mt-1 text-ink/70">This video is attracting attention. Review its comments and existing links, then decide whether a playlist, end screen or related release would help viewers discover more.</p>
          <div className="mt-3 flex flex-wrap gap-4 font-semibold">
            <a href={url} target="_blank" rel="noopener noreferrer" className="underline">Watch video ↗</a>
            <a href={url} target="_blank" rel="noopener noreferrer" className="underline">Open comments on YouTube ↗</a>
          </div>
        </>
      ) : (
        <p className="mt-2">The highlighted video is not in this channel's current cached uploads. <a href={url} target="_blank" rel="noopener noreferrer" className="underline font-semibold">Open it on YouTube ↗</a></p>
      )}
    </section>
  );
}
