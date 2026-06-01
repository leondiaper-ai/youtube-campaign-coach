'use client';

import { useState, useEffect } from 'react';
import PulseNav from './PulseNav';
import WeeklySpotlight, { type SpotlightChannel } from './WeeklySpotlight';

// ── Design System (matches PartnerBriefing) ─────────────────────────────────

const INK    = '#0E0E0E';
const PAPER  = '#FAF7F2';
const SMOKE  = '#8A847A';
const GHOST  = '#C8C2B8';
const BONE   = '#E8E3DA';
const WHITE  = '#FFFFFF';
const WARM   = '#4A4640';

const ACCENT = {
  green:  '#2D6A4F',
  amber:  '#9A6324',
};

// ── Types ───────────────────────────────────────────────────────────────────

type SpotlightData = {
  channels: SpotlightChannel[];
  weekRange: string;
  generatedAt: string;
  totalManaged: number;
  syncMeta: { lastSyncAt: string; artistsSuccess: number; artistsTotal: number } | null;
};

// ── Utilities ───────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K';
  return String(n);
}

// ── Logos (same as PartnerBriefing) ─────────────────────────────────────────

function VirginMusicLogo({ height = 36 }: { height?: number }) {
  return (
    <img
      src="/virgin-music-logo.png"
      alt="Virgin Music"
      style={{ height, width: 'auto', display: 'block' }}
    />
  );
}

function YouTubeLogo({ height = 20 }: { height?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: height * 0.35 }}>
      <img
        src="/youtube-icon.png"
        alt=""
        style={{ height, width: 'auto', display: 'block' }}
      />
      <span style={{
        fontFamily: "'Inter', 'Roboto', system-ui, sans-serif",
        fontWeight: 700,
        fontSize: height * 0.85,
        color: INK,
        letterSpacing: '-0.02em',
      }}>
        YouTube
      </span>
    </span>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function ChannelSpotlightPage() {
  const [data, setData] = useState<SpotlightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/channel-spotlight')
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: PAPER,
        color: INK,
        fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
        position: 'relative',
      }}
    >
      {/* Paper grain texture overlay */}
      <div
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.03\'/%3E%3C/svg%3E")',
          backgroundSize: '256px 256px',
          opacity: 0.4,
        }}
      />

      <div className="pulse-wrap" style={{ position: 'relative', zIndex: 1, maxWidth: 900, margin: '0 auto', padding: '48px 32px 64px' }}>
        {/* ── Header ─────────────────────────────────────────────── */}
        <header style={{ marginBottom: 32 }}>
          {/* Logos */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <VirginMusicLogo height={28} />
            <span style={{ fontSize: 11, color: GHOST, fontWeight: 300 }}>×</span>
            <YouTubeLogo height={16} />
          </div>

          {/* Pulse Nav */}
          <PulseNav />

          {/* Title block */}
          <div style={{ marginTop: 8 }}>
            <h1
              style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontSize: 32,
                fontWeight: 400,
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
                color: INK,
                margin: 0,
              }}
            >
              Weekly Channel Spotlight
            </h1>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.5,
                color: SMOKE,
                marginTop: 8,
                maxWidth: 640,
              }}
            >
              Top performing Virgin-managed channels this week — what the data says is working across the roster.
            </p>
            {data && (
              <div style={{ marginTop: 12 }}>
                <span style={{ fontSize: 11, color: GHOST, letterSpacing: '0.04em' }}>
                  {data.weekRange}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* ── Loading / Error States ─────────────────────────────── */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div
              style={{
                width: 32, height: 32, border: `3px solid ${BONE}`,
                borderTopColor: ACCENT.green, borderRadius: '50%',
                margin: '0 auto 16px',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <p style={{ fontSize: 13, color: SMOKE }}>Loading spotlight data...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '32px 24px', background: '#FFF5F5', borderRadius: 12,
              border: '1px solid #FED7D7', textAlign: 'center',
            }}
          >
            <p style={{ fontSize: 14, color: '#9B2C2C', margin: 0 }}>
              Could not load spotlight data. Try refreshing.
            </p>
          </div>
        )}

        {/* ── Spotlight Content ───────────────────────────────────── */}
        {data && !loading && (
          <>
            {/* Spacer before cards */}
            <div style={{ marginBottom: 8 }} />

            {/* Spotlight cards */}
            <WeeklySpotlight channels={data.channels} linkPrefix="/watcher" />

            {/* spacer before footer */}
            <div style={{ marginTop: 32 }} />

            {/* Footer */}
            <footer style={{ marginTop: 56, paddingTop: 24, borderTop: `1px solid ${BONE}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <VirginMusicLogo height={18} />
                <span style={{ fontSize: 9, color: GHOST }}>×</span>
                <YouTubeLogo height={11} />
              </div>
              <p style={{ fontSize: 10, color: GHOST, lineHeight: 1.6, maxWidth: 500 }}>
                Channel Spotlight is generated from the YouTube Campaign System watcher data. Channels are scored on cadence, conversion efficiency, format diversity, and growth momentum — not audience size.
              </p>
              <p style={{ fontSize: 9, color: GHOST, marginTop: 4 }}>
                Data refreshes with each sync cycle. Scores measure execution quality, not artist popularity.
              </p>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
