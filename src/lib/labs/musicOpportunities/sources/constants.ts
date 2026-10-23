/* Allowlists and chart definitions shared by the server collectors and
   the client board. No environment access and no server imports, so
   the board can import this without pulling the collectors into the
   browser bundle. */
import type { ChartMeasure } from '../types';

export const DATA_API_REGIONS = ['GB', 'US', 'ES', 'MX', 'DE', 'FR', 'BR', 'AU', 'CA', 'IE'] as const;
export const DEFAULT_REGIONS = ['GB', 'US', 'ES', 'MX'] as const;

export const CM_CHARTS = {
  tracks: { path: (c: string) => `/api/charts/youtube/tracks?country_code=${c}&latest=true`, measure: 'song-views-weekly' as ChartMeasure, label: 'Top Songs (weekly)' },
  videos: { path: (c: string) => `/api/charts/youtube/videos?country_code=${c}&latest=true`, measure: 'music-video-views-weekly' as ChartMeasure, label: 'Top Music Videos (weekly)' },
  shorts_weekly: { path: (c: string) => `/api/charts/youtube/shorts/shorts_weekly?code2=${c}&latest=true&limit=100`, measure: 'shorts-creations-weekly' as ChartMeasure, label: 'Top Songs on Shorts (weekly, creations)' },
  shorts_daily: { path: (c: string) => `/api/charts/youtube/shorts/shorts_daily?code2=${c}&latest=true&limit=100`, measure: 'shorts-creations-daily' as ChartMeasure, label: 'Top Songs on Shorts (daily, creations)' },
} as const;
export type CmChart = keyof typeof CM_CHARTS;
export const CM_TERRITORIES = ['GB', 'US', 'ES', 'MX', 'DE', 'FR', 'BR', 'AU', 'CA', 'IE', 'GLOBAL'] as const;
