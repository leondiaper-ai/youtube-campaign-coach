'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CONVERSION_BAND_META,
  formatRate,
  type ConversionBand,
  type ConversionResult,
} from '@/lib/conversion';

const MUTED = '#E9E2D3';

type ApiResponse = {
  channelId: string;
  slug: string | null;
  historyDays: number;
  d7: ConversionResult;
  d30: ConversionResult;
  trend: 'improving' | 'cooling' | 'steady' | 'unknown';
  error?: string;
};

/**
 * Compact conversion chip for the Coach header.
 *
 * - Auto-detects artist slug from the URL (`?artist=<slug>`).
 * - Silent when there's no slug (e.g. the blank example plan).
 * - Silent on API errors — we don't want to shout a red banner at the top
 *   of the Coach every time the YouTube API has a hiccup.
 * - When data is ready: shows the 7d rate + band color + a tiny 30d reference.
 */
export default function ConversionChip() {
  const searchParams = useSearchParams();
  const slug = searchParams?.get('artist') ?? '';
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!slug) {
      setData(null);
      return;
    }
    let alive = true;
    setLoading(true);
    fetch(`/api/conversion?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((j: ApiResponse) => {
        if (!alive) return;
        if (j.error) setData(null);
        else setData(j);
      })
      .catch(() => { if (alive) setData(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [slug]);

  if (!slug) return null;
  if (loading && !data) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{ background: '#F6F1E7', color: '#6A6A6A', border: `1px solid ${MUTED}` }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#B8B0A0' }} />
        Conversion · loading
      </span>
    );
  }
  if (!data) return null;

  // Use the tightest window with data — 7d preferred, falling back to 30d.
  const primary: ConversionResult =
    data.d7.band !== 'INSUFFICIENT' ? data.d7 : data.d30;
  const band: ConversionBand = primary.band;
  const m = CONVERSION_BAND_META[band];

  const trendGlyph =
    data.trend === 'improving' ? '↑' :
    data.trend === 'cooling' ? '↓' :
    data.trend === 'steady' ? '→' : '';

  return (
    <span
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-[0.14em]"
      style={{ background: m.bg, color: m.fg, border: `1px solid ${m.dot}` }}
      title={`${band} · ${primary.subsDelta.toLocaleString()} new subs per ${primary.viewsDelta.toLocaleString()} new views over ${primary.spanDays}d`}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.dot }} />
      <span>Conversion · {m.label}</span>
      {band !== 'INSUFFICIENT' && (
        <>
          <span style={{ opacity: 0.4 }}>·</span>
          <span className="tabular-nums normal-case tracking-normal">{formatRate(primary)}</span>
          {trendGlyph && (
            <span className="tabular-nums" style={{ opacity: 0.75 }}>
              {trendGlyph}
            </span>
          )}
        </>
      )}
    </span>
  );
}
