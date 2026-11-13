'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export default function PartnerAddChannelButton() {
 const [open,setOpen]=useState(false),[input,setInput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const router=useRouter();
 async function submit(e:React.FormEvent) {e.preventDefault();setBusy(true);setError('');try {
  const result=await fetch('/api/artists',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({input:input.trim(),ownership:'observed'})});
  const data=await result.json();if(!result.ok)throw new Error(data.error||'Channel could not be added');
  const added=await fetch('/api/youtube-uk/add',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({slug:data.artist.slug})});
  const saved=await added.json();if(!added.ok)throw new Error(saved.error||'Channel added but not saved to shared roster');
  setOpen(false);setInput('');router.refresh();
 }catch(err){setError(err instanceof Error?err.message:'Could not add channel')}finally{setBusy(false)}}
 return <><button onClick={()=>setOpen(true)} className="rounded-lg bg-ink text-paper px-4 py-2 text-xs font-bold">+ Add channel</button>{open&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5" onClick={()=>!busy&&setOpen(false)}><form onClick={e=>e.stopPropagation()} onSubmit={submit} className="w-full max-w-md bg-surface text-ink border border-line rounded-xl p-6 shadow-xl"><h2 className="text-xl font-black">Add to YouTube UK Watcher</h2><p className="text-sm text-muted mt-2">Paste the artist's YouTube channel URL, handle or channel ID. This adds the channel to the shared partner view, not the agreed six-monthly Google Sheet.</p><input autoFocus required disabled={busy} value={input} onChange={e=>setInput(e.target.value)} placeholder="https://youtube.com/@artist" className="w-full mt-4 p-3 border border-line rounded-lg bg-paper text-ink"/>{error&&<p role="alert" className="text-sm text-red-700 mt-3">{error}</p>}<div className="flex justify-end gap-3 mt-5"><button type="button" disabled={busy} onClick={()=>setOpen(false)}>Cancel</button><button disabled={busy||!input.trim()} type="submit" className="bg-ink text-paper rounded-lg px-4 py-2 font-bold disabled:opacity-50">{busy?'Adding…':'Add channel'}</button></div></form></div>}</>;
}
