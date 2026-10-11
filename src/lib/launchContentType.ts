/* ═══════════════════════════════════════════════════════════════════════
   WHAT KIND OF ASSET IS THIS UPLOAD

   Pure title classification, and it lives in lib/ rather than inside
   LaunchModule for one reason: LaunchModule is a 'use client' component.

   Importing a FUNCTION from a client component into server code does not
   give you the function. It gives you a client reference proxy, and
   calling it on the server throws — which is exactly what happened when
   formatPerformance imported classifyLaunchType from there: every artist
   page returned 500. Typecheck passes, because the types are real; only
   the runtime knows.

   So the rule this file exists to enforce: shared logic belongs in lib/,
   and a component may import from lib/, never the reverse.
   ═══════════════════════════════════════════════════════════════════════ */

export type LaunchContentType =
  | 'OFFICIAL_VIDEO' | 'LYRIC_VIDEO' | 'VISUALIZER'
  | 'BTS' | 'LIVE' | 'SHORT' | 'OTHER';

export const CONTENT_TYPE_LABEL: Record<LaunchContentType, string> = {
  OFFICIAL_VIDEO: 'Official Video', LYRIC_VIDEO: 'Lyric Video',
  VISUALIZER: 'Visualizer', BTS: 'BTS', LIVE: 'Live',
  SHORT: 'Short', OTHER: 'Video',
};

export function classifyLaunchType(title: string, kind: 'short' | 'video'): LaunchContentType {
  if (kind === 'short') return 'SHORT';
  const t = title.toLowerCase();
  if (/\b(official\s*(music\s*)?video)\b/.test(t) || /\(official\)/.test(t) || /\bmusic\s*video\b/.test(t)) return 'OFFICIAL_VIDEO';
  if (/\b(lyric\s*(video)?|lyrics?\s*video)\b/.test(t)) return 'LYRIC_VIDEO';
  if (/\b(visuali[sz]er|official\s*visuali[sz]er)\b/.test(t)) return 'VISUALIZER';
  if (/\b(behind\s*the\s*scenes|bts)\b/.test(t)) return 'BTS';
  if (/\b(live\s*(at|from|in|session|performance)|tiny\s*desk|concert)\b/.test(t)) return 'LIVE';
  if (/\bsession\b/.test(t)) return 'LIVE';
  if (/\b(official\s*audio)\b/.test(t)) return 'OFFICIAL_VIDEO';
  return 'OTHER';
}
