import { fmtNum, trustedViewDelta } from '@/lib/artists';
import type { CampaignWindowData } from './CampaignDecisionCard';

/** Two scopes with explicit labels: campaign uploads and channel growth.
 * Uses the board's existing figures; no additional fetching or attribution.
 */
export default function CampaignMetrics({ campaign }: { campaign: CampaignWindowData }) {
  const channelViews = trustedViewDelta(campaign.channelViewsDelta);
  const signed = (value: number | null) => value == null ? '—' : `${value > 0 ? '+' : ''}${fmtNum(value)}`;
  const tone = (value: number | null) => value != null && value > 0 ? '#0C6A3F'
    : value != null && value < 0 ? '#8A1F0C' : '#0E0E0E';

  return (
    <section aria-label="Campaign performance" className="rounded-xl border border-line overflow-hidden mb-4">
      <div className="px-4 py-4 sm:px-5 sm:py-5" style={{ background: '#F3F6FF' }}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: '#2C25FF' }}>Campaign</h3>
          <span className="text-[12px] font-bold text-ink/60 tabular-nums">Day {campaign.campaignDay}</span>
        </div>
        <dl className="grid grid-cols-2 gap-4">
          <div className="flex flex-col">
            <dt className="text-[12px] font-bold text-ink/70 mt-2">Campaign video views</dt>
            <dd className="order-first text-[32px] sm:text-[40px] leading-none font-black tracking-tight tabular-nums text-ink">
              {campaign.contentViews != null ? fmtNum(campaign.contentViews) : '—'}
            </dd>
            <p className="order-last text-[11px] text-ink/45 mt-1">Views on campaign uploads</p>
          </div>
          <div className="flex flex-col">
            <dt className="text-[12px] font-bold text-ink/70 mt-2">Campaign uploads</dt>
            <dd className="order-first text-[32px] sm:text-[40px] leading-none font-black tracking-tight tabular-nums text-ink">
              {campaign.contentMix.uploads}
            </dd>
            <p className="order-last text-[11px] text-ink/45 mt-1">
              {campaign.contentMix.videos} long-form · {campaign.contentMix.shorts} Shorts
            </p>
          </div>
        </dl>
      </div>
      <section aria-label="Whole-channel growth" className="px-4 py-4 sm:px-5 border-t border-line">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink/45 mb-3">
          Whole channel · since tracking began
        </h3>
        <dl className="grid grid-cols-2 gap-4">
          <div className="flex flex-col">
            <dt className="text-[11px] text-ink/50 mt-1.5">Views added · includes catalogue</dt>
            <dd className="order-first text-[24px] leading-none font-black tabular-nums" style={{ color: tone(channelViews) }}>{signed(channelViews)}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-[11px] text-ink/50 mt-1.5">Subscriber change</dt>
            <dd className="order-first text-[24px] leading-none font-black tabular-nums" style={{ color: tone(campaign.subsGained) }}>{signed(campaign.subsGained)}</dd>
          </div>
        </dl>
      </section>
    </section>
  );
}
