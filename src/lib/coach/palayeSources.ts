import type { RecentUpload } from '@/lib/artists';
/** Palaye Royale's official videos may be released by Sumerian, not the artist channel.
 * Search only the verified label channel, filter artist identity, and never treat a
 * missing API result as evidence that a video was not published. */
export async function palayeLabelUploads(): Promise<RecentUpload[]> {
 const key=process.env.YOUTUBE_API_KEY;
 if(!key) return [];
 const api='https://www.googleapis.com/youtube/v3/';
 try {
  const channelRes=await fetch(api+'channels?part=id&forHandle=SumerianRecords&key='+encodeURIComponent(key),{next:{revalidate:21600}});
  if(!channelRes.ok)return [];
  const channel=(await channelRes.json()).items?.[0]?.id as string|undefined;
  if(!channel)return [];
  const res=await fetch(api+'search?part=snippet&type=video&channelId='+encodeURIComponent(channel)+'&q='+encodeURIComponent('Palaye Royale')+'&maxResults=50&order=date&key='+encodeURIComponent(key),{next:{revalidate:3600}});
  if(!res.ok)return [];
  const items=(await res.json()).items??[];
  const candidates=items.filter((v:{id?:{videoId?:string};snippet?:{title?:string;description?:string}})=>v.id?.videoId&&/palaye\s+royale/i.test((v.snippet?.title??'')+' '+(v.snippet?.description??'')));
  if(!candidates.length)return [];
  const ids=candidates.map((v:{id:{videoId:string}})=>v.id.videoId);
  const details=await fetch(api+'videos?part=snippet,statistics,contentDetails&maxResults=50&id='+ids.join(',')+'&key='+encodeURIComponent(key),{next:{revalidate:3600}});
  if(!details.ok)return [];
  return ((await details.json()).items??[]).filter((v:{snippet?:{channelId?:string;title?:string;description?:string}})=>v.snippet?.channelId===channel&&/palaye\s+royale/i.test((v.snippet.title??'')+' '+(v.snippet.description??''))).map((v:{id:string;snippet:{title:string;description?:string;publishedAt:string};statistics?:{viewCount?:string;likeCount?:string;commentCount?:string};contentDetails?:{duration?:string}}):RecentUpload=>({id:v.id,title:v.snippet.title,description:v.snippet.description??'',publishedAt:v.snippet.publishedAt,durationSec:parseDuration(v.contentDetails?.duration??''),live:'none',scheduledStart:null,actualStart:null,captions:false,viewCount:Number(v.statistics?.viewCount??0),likeCount:Number(v.statistics?.likeCount??0),commentCount:Number(v.statistics?.commentCount??0),collabChannel:'Sumerian Records'}));
 }catch{return []}
}
function parseDuration(value:string):number {const m=value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);return m?Number(m[1]??0)*3600+Number(m[2]??0)*60+Number(m[3]??0):0;}
