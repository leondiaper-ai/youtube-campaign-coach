/** Parse briefing labels without replacing an explicitly saved year. */
export function parseBriefingDate(label: string | null, now = new Date()): Date | null {
  if (!label || !/^\d{1,2} [A-Za-z]{3}(?: 20\d{2})?$/.test(label)) return null;
  const value = /\b20\d{2}\b/.test(label) ? label : `${label} ${now.getFullYear()}`;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function daysUntilBriefingDate(label: string | null, now = new Date()): number | null {
  const date = parseBriefingDate(label, now);
  if (!date) return null;
  return Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
}
