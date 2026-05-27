import Link from 'next/link';

export const metadata = {
  title: 'YouTube Campaign System',
  description: 'Plan, track and grow YouTube campaigns.',
};

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const BORDER = '#E8E3DA';
const MUTED = '#9B9589';

export default function HomePage() {
  return (
    <main className="min-h-screen" style={{ background: PAPER, color: INK }}>
      <div className="max-w-[680px] mx-auto px-6 py-16">
        {/* Header */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: MUTED,
            marginBottom: 32,
          }}
        >
          YouTube Campaign System
        </div>

        {/* Hero */}
        <h1
          style={{
            fontSize: 42,
            fontWeight: 900,
            lineHeight: 1.1,
            color: INK,
            margin: 0,
          }}
        >
          YouTube
          <br />
          Campaign Coach
        </h1>
        <p
          style={{
            fontSize: 16,
            color: '#5A5650',
            lineHeight: 1.6,
            marginTop: 16,
            maxWidth: 480,
          }}
        >
          Channel-aware campaign planning. Review your channel state, build
          structured rollouts, and get live guidance shaped by real YouTube
          intelligence.
        </p>

        {/* Primary CTA */}
        <Link
          href="/coach"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 28,
            padding: '14px 28px',
            borderRadius: 10,
            background: INK,
            color: '#FFFFFF',
            fontSize: 15,
            fontWeight: 800,
            textDecoration: 'none',
            letterSpacing: '0.02em',
          }}
        >
          Open Coach →
        </Link>

        {/* Tool grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 10,
            marginTop: 48,
          }}
        >
          <ToolCard
            href="/growth"
            title="Watcher"
            desc="Channel health monitoring — which channels are growing, flat, or at risk."
          />
          <ToolCard
            href="/coach"
            title="Coach"
            desc="Channel-aware campaign planning with live guidance."
            highlight
          />
          <ToolCard
            href="/campaigns"
            title="Active Campaigns"
            desc="Campaign status board with decision signals."
          />
          <ToolCard
            href="/team-watcher"
            title="Team Watcher"
            desc="Shared team board — add artists, track campaigns, monitor health."
          />
          <ToolCard
            href="/weekly-pulse"
            title="Weekly Pulse"
            desc="Weekly YouTube intelligence briefing — signals, moments, and opportunities."
            highlight
          />
        </div>

        <div
          style={{
            marginTop: 48,
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#D1C9BD',
          }}
        >
          Watcher watches · Coach directs · Campaigns track
        </div>
      </div>
    </main>
  );
}

function ToolCard({
  href,
  title,
  desc,
  highlight,
}: {
  href: string;
  title: string;
  desc: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        padding: '16px 18px',
        borderRadius: 10,
        background: highlight ? '#FFFFFF' : SOFT,
        border: `1px solid ${highlight ? BORDER : 'transparent'}`,
        textDecoration: 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: INK,
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
        {desc}
      </div>
    </Link>
  );
}
