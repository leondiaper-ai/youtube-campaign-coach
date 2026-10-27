/** Editorial selection for live campaign covers. A new Short never displaces
 * a published long-form destination. Classification is a cue, not proof of
 * YouTube's Shorts surface: public uploads do not expose aspect ratio. */
export type CoverSelectionAsset = {
  videoId: string; publishedAt: string; title: string; kind: string;
  durationSec?: number | null; sourceAspect?: string | null; views?: number | null;
};
const PROMO = /\b(trailer|teaser|snippet|preview|announcement|countdown)\b|\d+\s*days?\s*['’]?\s*til/i;
export function isCoverLongForm(a: CoverSelectionAsset): boolean {
  return (a.durationSec ?? 0) > 62 && a.sourceAspect !== 'portrait'
    && !['short','trailer','teaser','announcement','clip','unknown'].includes(a.kind)
    && !/#shorts?\b/i.test(a.title) && !PROMO.test(a.title);
}
/** Latest published destinations first. With only short-form material, keep
 * the earliest observed asset stable; subsequent Shorts do not rotate it. */
export function selectCoverHeroes<T extends CoverSelectionAsset>(assets:T[], now=Date.now()): T[] {
  const seen=new Set<string>();
  const published=assets.filter(a=>{
    const t=Date.parse(a.publishedAt);
    if(!a.videoId || seen.has(a.videoId) || !Number.isFinite(t) || t>now)return false;
    seen.add(a.videoId);return true;
  });
  const long=published.filter(isCoverLongForm).sort((a,b)=>
    b.publishedAt.localeCompare(a.publishedAt) || a.videoId.localeCompare(b.videoId));
  if(long.length)return long.slice(0,2);
  return published.sort((a,b)=>a.publishedAt.localeCompare(b.publishedAt) || a.videoId.localeCompare(b.videoId)).slice(0,1);
}
