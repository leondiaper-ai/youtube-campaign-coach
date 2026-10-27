'use client';
import { useState } from 'react';
export default function VideoCaptionActions({id,title}:{id:string;title:string}) {
  const [status,setStatus]=useState('');
  async function copy() {
    const task=`CAPTION REVIEW\n${title}\nVideo: https://www.youtube.com/watch?v=${id}\nStudio: https://studio.youtube.com/video/${id}/edit\n\n1. In YouTube Studio, open Subtitles for this video. The public API did not report a caption track.\n2. If the video has speech or sung lyrics, use the approved transcript/lyrics. Review any automatic transcript, especially names and lyrics, or upload a correctly timed subtitle file.\n3. Check language, spelling and timing, then publish. If the video is instrumental with no speech, review whether captions are appropriate rather than adding invented lyrics.\n\nThis is an editing task, not generated subtitle text.`;
    try {await navigator.clipboard.writeText(task);setStatus('Task copied');}catch{setStatus('Could not copy');}
  }
  return <div className="flex flex-wrap items-center gap-3 mt-3 text-xs"><button type="button" onClick={copy} className="font-semibold underline underline-offset-2">{status||'Copy caption task'}</button><a href={`https://studio.youtube.com/video/${id}/edit`} target="_blank" rel="noreferrer" className="text-ink/50 hover:text-ink">Open in Studio ↗</a></div>;
}
