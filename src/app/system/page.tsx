import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Virgin Music × YouTube — the system',
  description: 'From roster activity to actionable YouTube strategy.',
};

/**
 * Public-facing one-pager explaining the monitoring system.
 *
 * Shared with YouTube and shown to director-level stakeholders, so it has to
 * stand on its own without anyone presenting it. Deliberately not a dashboard:
 * four stages, three proof points, one scope note. Nothing else.
 */

const RED = '#E4002B';

const STAGES = [
  {
    n: '01',
    name: 'Monitor',
    lede: 'A growing pool of relevant YouTube channels',
    body: 'We monitor a mix of priority projects, active YouTube campaigns and other relevant artist channels.',
    note: 'Not every Virgin release has a YouTube strategy or significant YouTube activity. Priority projects can also be monitored specifically to identify where a stronger opportunity could exist.',
    list: null as string[] | null,
  },
  {
    n: '02',
    name: 'Surface',
    lede: 'Activity determines what rises into focus',
    body: 'Once an artist is in the monitored pool, the system tracks:',
    list: ['Channel activity', 'Upload cadence', 'Views and momentum', 'Subscriber growth', 'Content behaviour'],
    note: 'Attention isn’t determined solely by a fixed priority list. Channel behaviour can surface opportunities too.',
  },
  {
    n: '03',
    name: 'Understand',
    lede: 'Move from “what happened?” to “why?”',
    body: 'When a channel or campaign becomes interesting, deeper analysis helps us understand:',
    list: [
      'Which content is driving momentum',
      'How audiences are responding',
      'Whether cadence is supporting growth',
      'Where campaign gaps or opportunities exist',
      'What appears to be working repeatedly',
    ],
    note: null,
  },
  {
    n: '04',
    name: 'Act',
    lede: 'Turn signals into campaign strategy',
    body: 'The output is practical recommendations for labels and artists:',
    list: [
      'What to release next',
      'When additional content could help',
      'Which formats are working',
      'Where YouTube strategy could be strengthened',
      'Where additional support may be valuable',
    ],
    note: null,
  },
];

const CARDS = [
  {
    kicker: 'Wider analysis',
    title: 'Virgin × YouTube Analysis',
    body: 'The broader view: patterns, behaviours and opportunities emerging across the channels we monitor.',
    cta: 'View analysis',
    href: 'https://youtube-insights-pi.vercel.app/preview.html',
    external: true,
  },
  {
    kicker: 'Artist analysis',
    title: 'Artist Campaign Example — Amyl & The Sniffers',
    body: 'The artist view: turning channel and content behaviour into specific campaign insights and recommendations.',
    cta: 'View artist example',
    href: '/amyl',
    external: false,
  },
  {
    kicker: 'Weekly priorities',
    title: 'YouTube Weekly Priority View',
    body: 'The weekly view: highlighting the artists, campaigns and releases where YouTube activity or opportunity is particularly relevant right now.',
    cta: 'View weekly priorities',
    href: '/weekly-pulse/campaign-briefing',
    external: false,
  },
];

export default function SystemPage() {
  return (
    <main style={{ background: '#fff', color: '#111', minHeight: '100vh', fontFamily: 'var(--font-inter, ui-sans-serif, system-ui, sans-serif)' }}>
      <style>{`
        .sys-wrap{max-width:1180px;margin:0 auto;padding:0 2rem}
        .sys-hero{padding:6.5rem 0 4rem}
        .sys-eyebrow{font-size:.68rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${RED};margin-bottom:1.4rem}
        .sys-h1{font-size:clamp(2.3rem,5vw,3.9rem);font-weight:800;letter-spacing:-.028em;line-height:1.03;margin-bottom:.9rem}
        .sys-lede{font-size:clamp(1.05rem,1.7vw,1.4rem);font-weight:500;color:#3A3A3A;margin-bottom:1.4rem}
        .sys-sub{font-size:.98rem;line-height:1.68;color:#5C5C5C;max-width:64ch}
        .sys-rule{height:1px;background:#E6E6E6;margin:0}

        .sys-stages{display:grid;grid-template-columns:repeat(4,1fr);gap:0;padding:4rem 0 1rem}
        .sys-stage{padding:0 1.7rem;border-left:1px solid #E6E6E6;position:relative}
        .sys-stage:first-child{padding-left:0;border-left:0}
        .sys-stage:last-child{padding-right:0}
        .sys-num{font-size:.68rem;font-weight:700;letter-spacing:.16em;color:${RED};margin-bottom:.5rem}
        .sys-name{font-size:1.28rem;font-weight:800;letter-spacing:-.015em;margin-bottom:.5rem}
        .sys-stage-lede{font-size:.86rem;font-weight:600;color:#222;line-height:1.42;margin-bottom:.75rem}
        .sys-body{font-size:.8rem;line-height:1.6;color:#5C5C5C}
        .sys-list{list-style:none;margin:.55rem 0 0;padding:0}
        .sys-list li{font-size:.8rem;line-height:1.5;color:#5C5C5C;padding:.16rem 0 .16rem .8rem;position:relative}
        .sys-list li::before{content:'';position:absolute;left:0;top:.62rem;width:3px;height:3px;border-radius:50%;background:${RED};opacity:.7}
        .sys-note{font-size:.74rem;line-height:1.55;color:#8A8A8A;margin-top:.85rem;padding-top:.75rem;border-top:1px solid #EFEFEF}

        .sys-flowline{display:flex;align-items:center;justify-content:center;gap:.9rem;
          padding:2.6rem 0 4.5rem;flex-wrap:wrap}
        .sys-flowword{font-size:clamp(.95rem,1.7vw,1.35rem);font-weight:800;letter-spacing:-.01em}
        .sys-flowarrow{color:${RED};font-size:1.05rem}

        .sys-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:1.3rem;padding:3.6rem 0}
        .sys-card{display:flex;flex-direction:column;border:1px solid #E6E6E6;border-radius:10px;
          padding:1.7rem;text-decoration:none;color:inherit;transition:border-color .18s,box-shadow .18s,transform .18s;background:#fff}
        .sys-card:hover{border-color:${RED};box-shadow:0 6px 26px rgba(0,0,0,.07);transform:translateY(-2px)}
        .sys-card-kicker{font-size:.62rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:${RED};margin-bottom:.85rem}
        .sys-card-title{font-size:1.02rem;font-weight:800;letter-spacing:-.012em;line-height:1.3;margin-bottom:.6rem}
        .sys-card-body{font-size:.83rem;line-height:1.62;color:#5C5C5C;flex:1}
        .sys-card-cta{font-size:.78rem;font-weight:700;color:${RED};margin-top:1.4rem}

        .sys-scope{padding:2.8rem 0 5rem;max-width:70ch}
        .sys-scope-h{font-size:.66rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#8A8A8A;margin-bottom:.7rem}
        .sys-scope p{font-size:.82rem;line-height:1.7;color:#6E6E6E;margin-bottom:.65rem}

        @media(max-width:980px){
          .sys-stages{grid-template-columns:repeat(2,1fr);gap:2.2rem 0}
          .sys-stage{padding:0 1.2rem}
          .sys-stage:nth-child(odd){padding-left:0;border-left:0}
          .sys-cards{grid-template-columns:1fr}
        }
        @media(max-width:620px){
          .sys-wrap{padding:0 1.3rem}
          .sys-stages{grid-template-columns:1fr}
          .sys-stage{padding:0;border-left:0;border-top:1px solid #E6E6E6;padding-top:1.5rem}
          .sys-stage:first-child{border-top:0;padding-top:0}
        }
      `}</style>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="sys-wrap">
        <div className="sys-hero">
          <div className="sys-eyebrow">Virgin Music Group × YouTube</div>
          <h1 className="sys-h1">Virgin Music × YouTube</h1>
          <p className="sys-lede">From roster activity to actionable YouTube strategy</p>
          <p className="sys-sub">
            A growing monitoring system designed to help identify where YouTube activity is building,
            understand what is driving it, and turn those signals into campaign action.
          </p>
        </div>
      </div>

      <div className="sys-rule" />

      {/* ── The four stages ──────────────────────────────────────── */}
      <div className="sys-wrap">
        <div className="sys-stages">
          {STAGES.map((s) => (
            <div className="sys-stage" key={s.n}>
              <div className="sys-num">{s.n}</div>
              <div className="sys-name">{s.name}</div>
              <div className="sys-stage-lede">{s.lede}</div>
              <p className="sys-body">{s.body}</p>
              {s.list && (
                <ul className="sys-list">
                  {s.list.map((x) => <li key={x}>{x}</li>)}
                </ul>
              )}
              {s.note && <p className="sys-note">{s.note}</p>}
            </div>
          ))}
        </div>

        <div className="sys-flowline">
          {['Monitor', 'Surface', 'Understand', 'Act'].map((w, i) => (
            <span key={w} style={{ display: 'inline-flex', alignItems: 'center', gap: '.9rem' }}>
              <span className="sys-flowword">{w}</span>
              {i < 3 && <span className="sys-flowarrow">→</span>}
            </span>
          ))}
        </div>
      </div>

      <div className="sys-rule" />

      {/* ── Proof at three levels ────────────────────────────────── */}
      <div className="sys-wrap">
        <div className="sys-cards">
          {CARDS.map((c) => (
            <a
              className="sys-card"
              key={c.title}
              href={c.href}
              {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              <div className="sys-card-kicker">{c.kicker}</div>
              <div className="sys-card-title">{c.title}</div>
              <p className="sys-card-body">{c.body}</p>
              <div className="sys-card-cta">{c.cta} →</div>
            </a>
          ))}
        </div>
      </div>

      <div className="sys-rule" />

      {/* ── Scope ────────────────────────────────────────────────── */}
      <div className="sys-wrap">
        <div className="sys-scope">
          <div className="sys-scope-h">Current scope</div>
          <p>
            The monitored pool does not yet represent the entire Virgin Music roster. Channels are
            continually added as new campaigns arrive, projects become priorities or YouTube activity
            becomes relevant.
          </p>
          <p>
            Once an artist is in the monitored pool, changing activity and traction can automatically
            influence how prominently they surface for attention.
          </p>
        </div>
      </div>
    </main>
  );
}
