import Link from 'next/link';
import {
  OPPORTUNITIES,
  IMPACT_COLOR,
  IMPACT_RANK,
  type Opportunity,
  type OpportunityImpact,
} from '@/lib/opportunities';

export const revalidate = 600;

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const MUTED = '#E9E2D3';

export default function OpportunitiesPage() {
  const sorted = [...OPPORTUNITIES].sort(
    (a, b) => IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact]
  );
  const artistCount = new Set(OPPORTUNITIES.map((o) => o.artistSlug)).size;

  const tiers: OpportunityImpact[] = ['HIGH', 'MEDIUM', 'LOW'];

  return (
    <main className="min-h-screen" style={{ background: PAPER, color: INK }}>
      <div className="max-w-[960px] mx-auto px-6 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/cockpit"
            className="text-[11px] uppercase tracking-[0.18em] text-ink/55 hover:text-ink"
          >
            ← Cockpit
          </Link>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink/50">
            Cockpit · Opportunities
          </div>
        </div>

        {/* Header */}
        <h1 className="font-black text-3xl leading-tight">Opportunity Scanner</h1>
        <p className="text-[14px] text-ink/70 mt-2">
          Things we&rsquo;re not doing that we should be.
        </p>
        <div className="text-[11px] uppercase tracking-[0.14em] text-ink/45 mt-3 font-mono">
          {OPPORTUNITIES.length} opportunities across {artistCount} artists
        </div>

        {/* Tiers */}
        {tiers.map((tier) => {
          const items = sorted.filter((o) => o.impact === tier);
          if (items.length === 0) return null;
          return (
            <section key={tier} className="mt-12">
              <TierDivider tier={tier} count={items.length} />
              <div className="space-y-4 mt-5">
                {items.map((o) => (
                  <OpportunityCard key={o.id} o={o} />
                ))}
              </div>
            </section>
          );
        })}

        <div className="mt-16 text-[10px] uppercase tracking-[0.18em] text-ink/35">
          v0.1 · seeded opportunities · live detection in next pass
        </div>
      </div>
    </main>
  );
}

function TierDivider({ tier, count }: { tier: OpportunityImpact; count: number }) {
  const c = IMPACT_COLOR[tier];
  const label =
    tier === 'HIGH' ? 'High impact' : tier === 'MEDIUM' ? 'Medium impact' : 'Low impact';
  return (
    <div className="flex items-center gap-3">
      <span className="w-2 h-2 rounded-full" style={{ background: c.dot }} />
      <div className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: c.fg }}>
        {label}
      </div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-ink/40 font-mono">
        {count}
      </div>
      <div className="flex-1 h-px" style={{ background: MUTED }} />
    </div>
  );
}

function OpportunityCard({ o }: { o: Opportunity }) {
  const c = IMPACT_COLOR[o.impact];
  return (
    <article
      className="rounded-xl border p-5"
      style={{ borderColor: MUTED, background: PAPER }}
    >
      {/* Top row: artist · type */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.18em] text-ink/50 font-bold">
            {o.artistName}
          </div>
          <h3 className="font-black text-[18px] mt-0.5 truncate">{o.subtype}</h3>
        </div>
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-[0.14em] shrink-0"
          style={{ background: c.bg, color: c.fg }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
          {o.type}
        </span>
      </div>

      {/* Signal / Impact / Action */}
      <div className="mt-4 space-y-3">
        <Row label="Signal" value={o.signal} />
        <Row label="Impact" value={o.impactRange} mono />
        <Row label="Action" value={o.action} emphasis />
      </div>

      {/* Foot links */}
      <div
        className="flex items-center gap-2 mt-5 pt-4 border-t"
        style={{ borderColor: MUTED }}
      >
        <Link
          href={`/watcher/${o.artistSlug}`}
          className="px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-[0.14em] border"
          style={{ borderColor: MUTED, background: SOFT, color: INK }}
        >
          Open Watcher
        </Link>
        <Link
          href={`/?artist=${o.artistSlug}`}
          className="px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-[0.14em]"
          style={{ background: INK, color: PAPER }}
        >
          Open Coach
        </Link>
      </div>
    </article>
  );
}

function Row({
  label,
  value,
  mono,
  emphasis,
}: {
  label: string;
  value: string;
  mono?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-3 items-baseline">
      <div className="text-[10px] uppercase tracking-[0.18em] text-ink/45 font-bold">
        {label}
      </div>
      <div
        className={`text-[13px] leading-snug ${mono ? 'font-mono text-ink/75' : ''} ${
          emphasis ? 'font-medium text-ink/90' : 'text-ink/75'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
