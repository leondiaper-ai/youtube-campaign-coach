import { readLiveSnapByHandle, writeLiveSnap, type CachedSnap } from '@/lib/kvCache';
import { fetchChannelSnapLite } from '@/lib/youtube';
import { safeMergeSnap } from '@/lib/youtube/normalizeChannelData';

/** A page visit refreshes a stale campaign channel at most once per two
 * hours. Requires Redis for a shared lock; failures back off and retain the
 * prior snapshot. It never writes global sync metadata or schedules a job. */
export async function refreshCampaignCoverSnapshot(input: {
  slug:string; handle:string; campaignStartDate?:string; collabs?:string[];
}, current:CachedSnap | null):Promise<CachedSnap | null> {
  const age=current?.cachedAt ? Date.now()-Date.parse(current.cachedAt) : Infinity;
  if(Number.isFinite(age) && age>=0 && age<2*3600000)return current;
  const url=process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token=process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if(!url || !token)return current;
  try {
    const {Redis}=await import('@upstash/redis');const redis=new Redis({url,token});
    const key='campaign-cover:refresh:v1:'+input.slug;
    if(!await redis.set(key,true,{nx:true,ex:7200}))return current;
    try {
      const snap=await fetchChannelSnapLite(input.handle,{campaignStartDate:input.campaignStartDate,collabs:input.collabs});
      if(!snap?.channelId || snap.error || (snap.subs == null && snap.views == null) || !snap.recentUploads || (current?.channelId && current.channelId!==snap.channelId)) {
        await redis.expire(key,1800);return current;
      }
      const latest=await readLiveSnapByHandle(input.handle).catch(()=>current);
      // Lite fetch deliberately omits the all-time list: retain the existing one.
      const merged=safeMergeSnap(latest,{...snap, topEverVideos:latest?.topEverVideos ?? snap.topEverVideos});
      await writeLiveSnap(snap.channelId,merged);
      return await readLiveSnapByHandle(input.handle) ?? current;
    } catch {
      await redis.expire(key,1800).catch(()=>{});return current;
    }
  } catch { return current; }
}
