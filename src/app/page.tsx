import Link from 'next/link';

export const metadata = {
  title: 'YouTube Campaign Coach',
  description:
    'Plan your YouTube rollout around release moments. Turn weekly activity into a clear next move.',
};

export default function EntryPage() {
  return (
    <main
      className="bg-paper text-ink min-h-screen"
      style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
    >
      <section className="mx-auto max-w-[1440px] px-6 md:px-10 pt-10 md:pt-14 pb-20 md:pb-28">
        {/* Eyebrow row — back to system + tool number */}
        <div className="flex items-center justify-between mb-14 md:mb-20">
          <span className="text-[0.72rem] tracking-[0.18em] uppercase font-semibold text-ink/60">
            Tool 03 — Decision System
          </span>
          <a
            href="http://localhost:3000/#tools"
            className="text-[0.72rem] tracking-[0.18em] uppercase font-semibold text-ink/60 hover:text-signal transition-colors"
          >
            ← Back to system
          </a>
        </div>

        {/* Headline + short lines + CTA */}
        <div className="grid gap-12 md:gap-16 md:grid-cols-[1.1fr_1fr] md:items-end">
          <div className="max-w-2xl">
            <div
              className="inline-flex items-center gap-2 rounded-full bg-mint text-ink px-3 py-1.5 text-[10px] font-bold tracking-widest mb-6 shadow-[3px_3px_0_0_rgba(14,14,14,1)]"
            >
              <span>03</span>
              <span className="opacity-60">/</span>
              <span className="uppercase">Mint</span>
            </div>

            <h1 className="font-extrabold leading-[0.9] tracking-[-0.04em] text-ink text-[clamp(2.5rem,7vw,5.25rem)]">
              YouTube Campaign Coach
            </h1>

            <p className="mt-7 text-lg md:text-xl font-semibold text-ink leading-snug max-w-xl">
              Plan your YouTube rollout around release moments.
            </p>
            <p className="mt-1.5 text-lg md:text-xl text-ink/55 leading-snug max-w-xl">
              Turn weekly activity into a clear next move.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-5">
              <Link
                href="/app"
                className="group inline-flex items-center gap-2.5 rounded-full bg-ink text-paper px-8 py-4 text-[15px] font-black tracking-wide hover:-translate-y-0.5 hover:shadow-[6px_8px_0_0_rgba(14,14,14,1)] transition-all shadow-[4px_5px_0_0_rgba(14,14,14,1)]"
              >
                Launch Tool
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
              <span className="text-[11px] tracking-[0.14em] uppercase text-ink/40 font-semibold">
                Built for release teams, artist managers, and channel leads
              </span>
            </div>
          </div>

          {/* Framed UI preview — stylised snapshot, no photo needed */}
          <ToolPreview />
        </div>
      </section>
    </main>
  );
}

/**
 * Stylised, static preview of the tool UI. Uses the same palette as the
 * live tool so it reads as a product snapshot, not a marketing illustration.
 * Kept deliberately static — no interaction — to signal "preview".
 */
function ToolPreview() {
  return (
    <div className="relative">
      {/* Outer frame with the same chunky shadow language */}
      <div
        className="rounded-3xl border border-ink/10 bg-cream p-5 md:p-6"
        style={{
          boxShadow:
            '10px 12px 0 0 rgba(14,14,14,1), 0 30px 60px -20px rgba(14,14,14,0.25)',
        }}
        aria-hidden="true"
      >
        {/* Fake browser chrome */}
        <div className="flex items-center gap-1.5 mb-4">
          <span className="w-2.5 h-2.5 rounded-full bg-ink/15" />
          <span className="w-2.5 h-2.5 rounded-full bg-ink/15" />
          <span className="w-2.5 h-2.5 rounded-full bg-ink/15" />
          <span className="ml-3 text-[9px] font-bold uppercase tracking-[0.16em] text-ink/35">
            Campaign Coach
          </span>
        </div>

        {/* Output row */}
        <div className="rounded-2xl bg-paper px-4 py-3 mb-3 grid grid-cols-4 gap-2">
          {[
            { n: '12', l: 'Shorts' },
            { n: '4',  l: 'Videos' },
            { n: '6',  l: 'Posts' },
            { n: '22', l: 'Support' },
          ].map((s) => (
            <div key={s.l} className="flex flex-col items-center text-center">
              <span className="text-lg font-black leading-none text-ink">{s.n}</span>
              <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-ink/40 mt-1">
                {s.l}
              </span>
            </div>
          ))}
        </div>

        {/* Support headline card */}
        <div className="rounded-2xl bg-paper px-4 py-3 mb-3">
          <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-ink/40 mb-1.5">
            Campaign Support
          </div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-sm leading-none text-sun">⚠</span>
            <span className="text-sm font-black leading-none text-sun">
              Support is inconsistent
            </span>
          </div>
          <div className="text-[10px] font-semibold text-ink/55">
            Missing: Shorts · Community · Follow-up
          </div>
        </div>

        {/* Drop cards */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { name: 'Single — "Ember"', tier: 'Strong', color: '#1FBE7A', score: '5/5' },
            { name: 'Vlog — Studio Day',   tier: 'Medium', color: '#FFD24C', score: '2/4' },
          ].map((d) => (
            <div key={d.name} className="rounded-xl bg-paper px-3 py-2.5">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <span className="text-[10px] font-black text-ink truncate">{d.name}</span>
                <span
                  className="text-[8px] font-black uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full"
                  style={{ color: d.color, background: `${d.color}18` }}
                >
                  {d.tier}
                </span>
              </div>
              <div className="h-1 rounded-full bg-ink/5 overflow-hidden mb-1.5">
                <span
                  className="block h-full"
                  style={{
                    background: d.color,
                    width: d.score === '5/5' ? '100%' : '50%',
                  }}
                />
              </div>
              <div
                className="flex items-center justify-between rounded-lg px-2 py-1"
                style={{ background: `${d.color}10` }}
              >
                <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-ink/40">
                  Support
                </span>
                <span className="text-[10px] font-black" style={{ color: d.color }}>
                  {d.score}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
