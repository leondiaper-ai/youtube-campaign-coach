import type { RecentUpload } from './artists';

export type AuditCatalogue = {
  version: 1; channelId: string; startedAt: string; fetchedAt: string;
  complete: boolean; nextPage: string | null; playlist: string;
  publicVideoCount: number | null; scannedIds: number; uploads: RecentUpload[];
};
const TTL = 30 * 86400;
const WEEK = 7 * 86400000;
async function store() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('Catalogue storage unavailable. Existing audit data is still available.');
  const { Redis } = await import('@upstash/redis');
  return new Redis({url,token});
}
const key = (id: string) => 'audit:catalogue:v1:'+id;
export async function readAuditCatalogue(id: string): Promise<AuditCatalogue | null> {
  try { return await (await store()).get<AuditCatalogue>(key(id)); } catch { return null; }
}
function seconds(iso: string) {
  const m=/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso);
  return m ? +(m[1]||0)*86400 + +(m[2]||0)*3600 + +(m[3]||0)*60 + +(m[4]||0) : 0;
}
// Each POST advances at most 10 playlist pages (500 IDs / about 20 quota units).
// Save after every hydrated page; older libraries resume rather than restart or silently cap.
export async function scanAuditCatalogue(id: string): Promise<AuditCatalogue> {
  const redis=await store();
  const existing=await redis.get<AuditCatalogue>(key(id));
  if(existing?.complete && Date.now()-Date.parse(existing.fetchedAt)<WEEK) return existing;
  const lock=key(id)+':lock';
  if(!await redis.set(lock,true,{nx:true,ex:90})) throw new Error('A catalogue scan is already running. Try again shortly.');
  try {
    const apiKey=process.env.YOUTUBE_API_KEY;
    if(!apiKey) throw new Error('YouTube collection is not configured.');
    const get = async (path:string,query:Record<string,string>) => {
      const params=new URLSearchParams({...query,key:apiKey!});
      const response=await fetch('https://www.googleapis.com/youtube/v3/'+path+'?'+params,{cache:'no-store'});
      if(!response.ok) throw new Error('YouTube collection returned '+response.status+'. Saved progress is preserved.');
      return response.json();
    }
    let job=existing && !existing.complete ? existing : null;
    if(!job) {
      const result=await get('channels',{part:'statistics,contentDetails',id});
      const channel=result.items?.[0];
      const playlist=channel?.contentDetails?.relatedPlaylists?.uploads;
      if(!playlist) throw new Error('No public uploads playlist found.');
      const now=new Date().toISOString();
      job={version:1,channelId:id,playlist,publicVideoCount:channel.statistics?.videoCount!=null?Number(channel.statistics.videoCount):null,scannedIds:0,uploads:[],nextPage:null,complete:false,startedAt:now,fetchedAt:now};
    }
    const started=Date.now();
    for(let page=0;page<10 && Date.now()-started<45000;page++) {
      const list=await get('playlistItems',{part:'contentDetails',playlistId:job.playlist,maxResults:'50',...(job.nextPage?{pageToken:job.nextPage}:{})});
      const ids=(list.items??[]).map((x:any)=>x.contentDetails?.videoId).filter(Boolean) as string[];
      const result=ids.length ? await get('videos',{part:'snippet,statistics,contentDetails,liveStreamingDetails',id:ids.join(',')}) : {items:[]};
      const uploads:RecentUpload[]=(result.items??[]).filter((v:any)=>v.snippet?.channelId===id).map((v:any)=>({id:v.id,title:v.snippet.title??'',description:(v.snippet.description??'').slice(0,1200),publishedAt:v.snippet.publishedAt,durationSec:seconds(v.contentDetails?.duration??''),captions:v.contentDetails?.caption==='true',live:v.snippet?.liveBroadcastContent??'none',scheduledStart:v.liveStreamingDetails?.scheduledStartTime??null,actualStart:v.liveStreamingDetails?.actualStartTime??null,viewCount:Number(v.statistics?.viewCount??0),likeCount:Number(v.statistics?.likeCount??0),commentCount:Number(v.statistics?.commentCount??0)}));
      const byId:Map<string,RecentUpload>=new Map(job.uploads.map(u=>[u.id,u]));
      uploads.forEach(u=>byId.set(u.id,u));
      job={...job,uploads:Array.from(byId.values()),scannedIds:job.scannedIds+ids.length,nextPage:list.nextPageToken??null,complete:!list.nextPageToken,fetchedAt:new Date().toISOString()};
      await redis.set(key(id),job,{ex:TTL});
      if(job.complete) break;
    }
    return job;
  } finally { await redis.del(lock); }
}
