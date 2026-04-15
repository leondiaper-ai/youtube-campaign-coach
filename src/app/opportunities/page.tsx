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
      <div className="max-w-[860px] mx-auto px-6 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/cockpit"
            className="text-[11px] uppercase tracking-[0.18em] text-ink/55 hover:text-ink"
          >
            ← Cockpit
          </Link>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink/50">
            Scanner
          </div>
        </div>

        {/* Header */}
        <h1 className="font-black text-3xl leading-tight">Opportunity Scanner</h1>
        <p className="text-[13px] text-ink/65 mt-2 max-w-[55ch]">
          Cross-artist radar. Pick a row to open Watcher for the full diagnosis and action.
        </p>
        <div className="text-[11px] uppercase tracking-[0.14em] text-ink/45 mt-3 font-mono">
          {OPPORTUNITIES.length} flagged across {artistCount} artists
        </div>

        {/* Tiers */}
        {tiers.map((tier) => {
          const items = sorted.filter((o) => o.impact === tier);
          if (items.length === 0) return null;
          return (
            <section key={tier} className="mt-10">
              <TierDivider tier={tier} count={items.length} />
              <ul
                className="mt-3 rounded-xl border divide-y overflow-hidden"
                style={{ borderColor: MUTED, background: PAPER }}
              >
                {items.map((o) => (
                  <RadarRow key={o.id} o={o} />
                ))}
              </ul>
            </section>
          );
        })}

        <div className="mt-16 text-[10px] uppercase tracking-[0.18em] text-ink/35">
          Scanner points · Watcher knows · Coach ships
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

function RadarRow({ o }: { o: Opportunity }) {
  const c = IMPACT_COLOR[o.impact];
  return (
    <li style={{ borderColor: MUTED }}>
      <Link
        href={`/watcher/${o.artistSlug}`}
        className="flex items-center gap-4 px-5 py-4 hover:bg-[#F6F1E7] transition-colors"
      >
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: c.dot }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink/55 shrink-0">
              {o.artistName}
            </div>
            <div className="text-[10px] text-ink/30">·</div>
            <div className="text-[13px] font-bold truncate">{o.subtype}</div>
          </div>
          <div className="text-[12px] text-ink/60 mt-0.5 truncate">{o.signal}</div>
        </div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-ink/40 shrink-0">
          Watcher →
        </div>
      </Link>
    </li>
  );
}
