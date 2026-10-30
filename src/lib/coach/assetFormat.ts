import type { RecentUpload } from '../artists';
import { classifyUploadFormat, type UploadFormat } from '../formatClassifier';
import { likelyMusicVideo } from '../channelAudit';
import { toCampaignUploads } from '../intelligence/campaignWindow';

/** Shared Coach classification: use explicit titles first, then the upload's
 * own description/production credits. Promotional Shorts never prove that a
 * separate long-form asset exists. */
export function coachUploadFormat(u: RecentUpload): UploadFormat {
  if (toCampaignUploads([u])[0]?.kind === 'short') return 'short';
  const named = classifyUploadFormat({...u, description:''});
  if (named !== 'longform' && named !== 'short') return named;
  const intro=(u.description??'').slice(0,700);
  if (/\b(?:create|created|creat[ei]|official|the)\b[^.\n]{0,100}\blyric video\b/i.test(intro)) return 'lyric';
  if (likelyMusicVideo(u) || (/\bDirector\s*[-–—:]\s*[^\n]{2,}/i.test(intro) && /Production Company|Director of Photography|Cinematograph/i.test(intro))) return 'omv';
  return 'longform';
}
