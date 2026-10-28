/** Suggest a small, reversible title edit only after the viewer confirms a format. */
export function auditTitleSuggestion(title: string, format: string): string | null {
  const labels: Record<string, string> = {
    omv: 'Official Music Video', lyric: 'Lyric Video', visualiser: 'Visualiser',
    audio: 'Official Audio', live: 'Live Performance', acoustic: 'Acoustic',
  };
  const label = labels[format];
  const original = title.trim();
  if (!label || !original || /\b(?:official|music video|lyric|visuali[sz]er|audio|live|acoustic|unplugged)\b/i.test(original)) return null;
  const suggestion = `${original} (${label})`;
  return suggestion.length <= 100 ? suggestion : null;
}
