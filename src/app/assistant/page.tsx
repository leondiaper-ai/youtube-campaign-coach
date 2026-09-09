/**
 * YOUTUBE ASSISTANT
 *
 * One destination for the intelligence work happening behind Watcher. The
 * strategist should not need to know whether a deterministic scan, the
 * Coach or Scout produced a given line — only whether it is useful.
 *
 * Rendered from stored data, so opening it costs nothing.
 */

import Link from 'next/link';
import { buildAssistantHome } from '@/lib/assistant/home';
import AssistantHomeView from '@/components/AssistantHome';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'YouTube Assistant — YouTube Campaign System',
  description: 'What the assistant has prepared, and what Scout has found.',
};

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';

const NAV = [
  { href: '/growth', label: 'Channel Health' },
  { href: '/campaigns', label: 'Active Campaigns' },
  { href: '/coach', label: 'Coach' },
  { href: '/resources', label: 'Resources' },
];

export default async function AssistantPage() {
  const data = await buildAssistantHome();

  return (
    <main className="min-h-screen" style={{ background: PAPER, color: INK }}>
      <div className="max-w-[1080px] mx-auto px-6 py-10">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink/45">
          YouTube Campaign System
        </div>
        <div className="flex items-center gap-1 mt-2 mb-8 flex-wrap">
          <span className="px-3 py-1.5 rounded-md text-[13px] font-black" style={{ background: SOFT }}>
            YouTube Assistant
          </span>
          {NAV.map(n => (
            <Link
              key={n.href}
              href={n.href}
              className="px-3 py-1.5 rounded-md text-[13px] font-bold text-ink/50 hover:text-ink hover:bg-[#F6F1E7] transition-colors"
            >
              {n.label}
            </Link>
          ))}
        </div>

        <AssistantHomeView initial={data} />

        <p className="mt-12 text-[10px] uppercase tracking-[0.18em] text-ink/25">
          Assembled {new Date(data.generatedAt).toLocaleString('en-GB')}
        </p>
      </div>
    </main>
  );
}
