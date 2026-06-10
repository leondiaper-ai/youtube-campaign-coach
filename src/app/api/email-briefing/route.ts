/**
 * GET /api/email-briefing
 *
 * Generates a self-contained HTML email from the partner-briefing data.
 * Table-based layout with inline CSS for Outlook / Gmail / Mailchimp compatibility.
 *
 * Returns: { html: string; subject: string; previewText: string; weekRange: string }
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ── Types (mirrored from partner-briefing) ──────────────────────────────────

type BriefingVideo = {
  id: string; title: string; channelName: string; artistSlug: string;
  viewCount: number; likeCount: number; commentCount: number;
  publishedAt: string; durationSec: number; format: string;
  thumbnail: string; velocity: number; daysAgo: number;
};

type BriefingChannel = {
  slug: string; name: string; channelHandle: string | null;
  subs: number | null; totalViews: number | null; views7d: number | null;
  subs7d: number | null; viewsWoW: number | null;
  uploads30d: number; shorts30d: number; longform30d: number;
  lastUploadAt: string | null; lastUploadDaysAgo: number | null;
  thumbnail: string | null; phase: string; campaign: string | null;
  campaignStartDate: string | null; classification: string;
  subsPer1kViews: number | null;
};

type FocusCampaign = {
  channel: BriefingChannel;
  heroImage: string;
  campaignPhase: string;
  nowLabel: string;
  nowDetail: string;
  nowThumbnail: string | null;
  nextLabel: string;
  nextDate: string | null;
  afterLabel: string;
  afterDate: string | null;
  youtubeFocus: string;
  channelUrl: string | null;
  hasCoachPlan: boolean;
  currentMoment: string;
  currentMomentDate: string | null;
  nextMoment: string;
  nextMomentDate: string | null;
  upcomingMoment: string;
  upcomingMomentDate: string | null;
  recentVideos: BriefingVideo[];
  editorialPriority: number;
  standoutVideo: BriefingVideo | null;
  tier: 1 | 2 | 3;
  contentFormats: string[];
};

type UpcomingMoment = {
  artist: string; slug: string; moment: string; date: string | null;
  timing: string; eventType: string; supportSurface: string;
  rolloutNote: string; fromCoachPlan: boolean; priority: number;
};

type MomentWatching = {
  id: string; title: string; artistName: string; artistSlug: string;
  thumbnail: string; viewCount: number; velocity: number; daysAgo: number;
  format: string; durationSec: number; context: string;
};

type BriefingData = {
  weekRange: string; generatedAt: string; activeCampaignCount: number;
  focusCampaigns: FocusCampaign[];
  platformObservations: string[];
  upcomingMoments: UpcomingMoment[];
  playbook: { title: string; why: string; when: string; actions: string[] };
  topShorts: BriefingVideo[];
  topVideos: BriefingVideo[];
  ecosystemHighlights: { name: string; label: string; read: string; thumbnail: string | null; channelHandle: string | null }[];
  momentsWatching: MomentWatching[];
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K';
  return String(n);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Colour palette ──────────────────────────────────────────────────────────

const BG      = '#FAF7F2';
const WHITE   = '#FFFFFF';
const INK     = '#1A1A1A';
const SMOKE   = '#6B7280';
const BONE    = '#E8E3DA';
const GREEN   = '#2D6A4F';
const AMBER   = '#9A6324';
const RED_YT  = '#FF0000';

// ── Email HTML builder ──────────────────────────────────────────────────────

function buildEmailHtml(data: BriefingData): string {
  const tier1 = data.focusCampaigns.filter(fc => fc.tier === 1);
  const tier2 = data.focusCampaigns.filter(fc => fc.tier === 2);
  const tier3 = data.focusCampaigns.filter(fc => fc.tier === 3);

  // Week date for subject line
  const weekLabel = data.weekRange;

  // ── Campaign row builder ──────────────────────────────────────────────────

  const campaignRow = (fc: FocusCampaign, size: 'large' | 'medium' | 'compact'): string => {
    const ch = fc.channel;
    const name = esc(ch.name);
    const campaign = ch.campaign ? esc(ch.campaign) : '';
    const phase = esc(fc.campaignPhase);

    // Stats line
    const stats: string[] = [];
    if (ch.subs) stats.push(`${fmtNum(ch.subs)} subs`);
    if (ch.views7d) stats.push(`${fmtNum(ch.views7d)} views/7d`);
    if (ch.uploads30d) stats.push(`${ch.uploads30d} uploads/30d`);
    const statsLine = stats.join(' &middot; ');

    // Formats
    const formats = fc.contentFormats.length > 0
      ? fc.contentFormats.map(f => esc(f)).join(', ')
      : '';

    // Upcoming moment
    const nextMoment = fc.currentMoment && fc.currentMomentDate
      ? `${esc(fc.currentMoment)} &mdash; ${esc(fc.currentMomentDate)}`
      : '';
    const afterMoment = fc.nextMoment && fc.nextMomentDate
      ? `${esc(fc.nextMoment)} &mdash; ${esc(fc.nextMomentDate)}`
      : '';

    // Standout video
    const standout = fc.standoutVideo;
    const standoutHtml = standout && size === 'large'
      ? `<tr><td style="padding:8px 0 0 0;">
           <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
             <td width="120" style="padding-right:12px;" valign="top">
               <img src="${esc(standout.thumbnail)}" width="120" style="display:block;border-radius:4px;" alt="" />
             </td>
             <td valign="top" style="font-size:13px;color:${SMOKE};line-height:1.4;">
               <span style="color:${INK};font-weight:600;">${esc(standout.title)}</span><br/>
               ${fmtNum(standout.viewCount)} views &middot; ${standout.daysAgo}d ago &middot; ${esc(standout.format)}
             </td>
           </tr></table>
         </td></tr>`
      : '';

    if (size === 'large') {
      return `
      <tr><td style="padding:0 0 24px 0;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${WHITE};border-radius:8px;border:1px solid ${BONE};">
          <tr><td style="padding:20px 24px 16px 24px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td>
                  <span style="font-size:20px;font-weight:700;color:${INK};line-height:1.3;">${name}</span>
                  ${campaign ? `<span style="font-size:13px;color:${GREEN};font-weight:600;padding-left:8px;">${campaign}</span>` : ''}
                </td>
                <td align="right" style="font-size:12px;color:${SMOKE};font-weight:500;">${phase}</td>
              </tr>
              <tr><td colspan="2" style="padding:6px 0 0 0;font-size:13px;color:${SMOKE};line-height:1.4;">${statsLine}</td></tr>
              ${formats ? `<tr><td colspan="2" style="padding:6px 0 0 0;font-size:12px;color:${AMBER};font-weight:500;">${formats}</td></tr>` : ''}
              ${nextMoment ? `<tr><td colspan="2" style="padding:10px 0 0 0;">
                <table cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="font-size:11px;font-weight:600;color:${GREEN};text-transform:uppercase;letter-spacing:0.5px;padding-right:8px;">NEXT</td>
                  <td style="font-size:13px;color:${INK};">${nextMoment}</td>
                </tr></table>
              </td></tr>` : ''}
              ${afterMoment ? `<tr><td colspan="2" style="padding:4px 0 0 0;">
                <table cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="font-size:11px;font-weight:600;color:${SMOKE};text-transform:uppercase;letter-spacing:0.5px;padding-right:8px;">THEN</td>
                  <td style="font-size:13px;color:${SMOKE};">${afterMoment}</td>
                </tr></table>
              </td></tr>` : ''}
              ${standoutHtml}
            </table>
          </td></tr>
        </table>
      </td></tr>`;
    }

    if (size === 'medium') {
      return `
      <tr><td style="padding:0 0 16px 0;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${WHITE};border-radius:6px;border:1px solid ${BONE};">
          <tr><td style="padding:16px 20px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td>
                  <span style="font-size:16px;font-weight:700;color:${INK};">${name}</span>
                  ${campaign ? `<span style="font-size:12px;color:${GREEN};font-weight:600;padding-left:6px;">${campaign}</span>` : ''}
                </td>
                <td align="right" style="font-size:11px;color:${SMOKE};">${phase}</td>
              </tr>
              <tr><td colspan="2" style="padding:4px 0 0 0;font-size:12px;color:${SMOKE};">${statsLine}</td></tr>
              ${nextMoment ? `<tr><td colspan="2" style="padding:6px 0 0 0;font-size:12px;color:${INK};">
                <span style="color:${GREEN};font-weight:600;">Next:</span> ${nextMoment}
              </td></tr>` : ''}
            </table>
          </td></tr>
        </table>
      </td></tr>`;
    }

    // compact — one line
    return `
    <tr><td style="padding:4px 0;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td style="font-size:14px;font-weight:600;color:${INK};">${name}</td>
        <td align="right" style="font-size:12px;color:${SMOKE};">${statsLine}</td>
      </tr></table>
    </td></tr>`;
  };

  // ── Upcoming moments table ────────────────────────────────────────────────

  const momentsRows = data.upcomingMoments.slice(0, 10).map(m => `
    <tr>
      <td style="padding:6px 12px 6px 0;font-size:13px;font-weight:600;color:${INK};border-bottom:1px solid ${BONE};">${esc(m.artist)}</td>
      <td style="padding:6px 12px 6px 0;font-size:13px;color:${INK};border-bottom:1px solid ${BONE};">${esc(m.moment)}</td>
      <td style="padding:6px 0;font-size:12px;color:${SMOKE};border-bottom:1px solid ${BONE};white-space:nowrap;">${esc(m.timing)}</td>
    </tr>
  `).join('');

  // ── Top content ───────────────────────────────────────────────────────────

  const topContentRows = data.momentsWatching.slice(0, 4).map(v => `
    <tr>
      <td width="100" style="padding:8px 12px 8px 0;" valign="top">
        <img src="${esc(v.thumbnail)}" width="100" style="display:block;border-radius:4px;" alt="" />
      </td>
      <td style="padding:8px 0;font-size:13px;color:${INK};line-height:1.4;" valign="top">
        <span style="font-weight:600;">${esc(v.title)}</span><br/>
        <span style="color:${SMOKE};font-size:12px;">${esc(v.artistName)} &middot; ${fmtNum(v.viewCount)} views &middot; ${v.daysAgo}d ago</span>
        ${v.context ? `<br/><span style="color:${GREEN};font-size:12px;">${esc(v.context)}</span>` : ''}
      </td>
    </tr>
  `).join('');

  // ── Assemble email ────────────────────────────────────────────────────────

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>YouTube Campaign Update &mdash; ${esc(weekLabel)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0;mso-table-rspace:0}
  img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}
  body{margin:0;padding:0;width:100%!important;font-family:Arial,Helvetica,sans-serif}
  @media only screen and (max-width:620px){
    .email-container{width:100%!important;padding:12px!important}
    .stack-col{display:block!important;width:100%!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${BG};font-family:Arial,Helvetica,sans-serif;">

<!-- Preheader text (hidden) -->
<div style="display:none;font-size:1px;color:${BG};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  ${data.activeCampaignCount} active campaigns &mdash; ${tier1.length > 0 ? tier1.map(fc => esc(fc.channel.name)).join(', ') : 'Campaign update'} and more.
</div>

<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${BG};">
<tr><td align="center" style="padding:24px 12px;">

<!-- Email container -->
<table class="email-container" role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr><td style="padding:0 0 24px 0;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="font-size:11px;font-weight:700;color:${RED_YT};text-transform:uppercase;letter-spacing:1.5px;">YouTube Campaign Update</td>
      </tr>
      <tr>
        <td style="font-size:24px;font-weight:700;color:${INK};padding:6px 0 2px 0;line-height:1.2;">
          Week of ${esc(weekLabel)}
        </td>
      </tr>
      <tr>
        <td style="font-size:13px;color:${SMOKE};padding:2px 0 0 0;">
          ${data.activeCampaignCount} active campaigns across Virgin Music UK
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Divider -->
  <tr><td style="border-bottom:2px solid ${INK};padding:0 0 20px 0;"></td></tr>

  ${tier1.length > 0 ? `
  <!-- Priority Campaigns -->
  <tr><td style="padding:20px 0 8px 0;">
    <span style="font-size:11px;font-weight:700;color:${GREEN};text-transform:uppercase;letter-spacing:1px;">Priority Campaigns</span>
  </td></tr>
  ${tier1.map(fc => campaignRow(fc, 'large')).join('')}
  ` : ''}

  ${tier2.length > 0 ? `
  <!-- Active Campaigns -->
  <tr><td style="padding:12px 0 8px 0;">
    <span style="font-size:11px;font-weight:700;color:${AMBER};text-transform:uppercase;letter-spacing:1px;">Active Campaigns</span>
  </td></tr>
  ${tier2.map(fc => campaignRow(fc, 'medium')).join('')}
  ` : ''}

  ${tier3.length > 0 ? `
  <!-- Also Tracking -->
  <tr><td style="padding:12px 0 8px 0;">
    <span style="font-size:11px;font-weight:700;color:${SMOKE};text-transform:uppercase;letter-spacing:1px;">Also Tracking</span>
  </td></tr>
  <tr><td style="padding:0 0 16px 0;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${WHITE};border-radius:6px;border:1px solid ${BONE};">
      <tr><td style="padding:12px 16px;">
        ${tier3.map(fc => campaignRow(fc, 'compact')).join('')}
      </td></tr>
    </table>
  </td></tr>
  ` : ''}

  ${data.upcomingMoments.length > 0 ? `
  <!-- Release Radar -->
  <tr><td style="border-top:1px solid ${BONE};padding:20px 0 8px 0;">
    <span style="font-size:11px;font-weight:700;color:${GREEN};text-transform:uppercase;letter-spacing:1px;">What Happens Next</span>
  </td></tr>
  <tr><td style="padding:0 0 20px 0;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      ${momentsRows}
    </table>
  </td></tr>
  ` : ''}

  ${topContentRows ? `
  <!-- Content Performing Now -->
  <tr><td style="border-top:1px solid ${BONE};padding:20px 0 8px 0;">
    <span style="font-size:11px;font-weight:700;color:${AMBER};text-transform:uppercase;letter-spacing:1px;">Content Performing Now</span>
  </td></tr>
  <tr><td style="padding:0 0 20px 0;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      ${topContentRows}
    </table>
  </td></tr>
  ` : ''}

  ${data.platformObservations.length > 0 ? `
  <!-- Platform Observations -->
  <tr><td style="border-top:1px solid ${BONE};padding:20px 0 8px 0;">
    <span style="font-size:11px;font-weight:700;color:${SMOKE};text-transform:uppercase;letter-spacing:1px;">Platform Observations</span>
  </td></tr>
  <tr><td style="padding:0 0 20px 0;">
    ${data.platformObservations.map(obs => `
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:8px;">
        <tr>
          <td width="6" valign="top" style="padding:4px 10px 0 0;"><div style="width:4px;height:4px;background:${SMOKE};border-radius:50%;"></div></td>
          <td style="font-size:13px;color:${INK};line-height:1.5;">${esc(obs)}</td>
        </tr>
      </table>
    `).join('')}
  </td></tr>
  ` : ''}

  <!-- Footer -->
  <tr><td style="border-top:2px solid ${INK};padding:20px 0 0 0;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="font-size:12px;color:${SMOKE};line-height:1.5;">
          Virgin Music UK &middot; YouTube Campaign Intelligence<br/>
          Data refreshed weekly. For the full interactive view, visit the campaign dashboard.
        </td>
      </tr>
    </table>
  </td></tr>

</table>
<!-- /Email container -->

</td></tr>
</table>

</body>
</html>`;

  return html;
}

// ── GET handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    // Fetch partner-briefing data from same origin
    const url = new URL(request.url);
    const origin = url.origin;
    const refresh = url.searchParams.get('refresh') === '1' ? '?refresh=1' : '';

    const res = await fetch(`${origin}/api/partner-briefing${refresh}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Partner briefing API returned ${res.status}` },
        { status: 500 },
      );
    }

    const data: BriefingData = await res.json();
    const html = buildEmailHtml(data);

    // Build subject line
    const tier1Names = data.focusCampaigns
      .filter(fc => fc.tier === 1)
      .slice(0, 3)
      .map(fc => fc.channel.name);
    const subjectNames = tier1Names.length > 0
      ? tier1Names.join(', ') + (data.activeCampaignCount > tier1Names.length ? ` + ${data.activeCampaignCount - tier1Names.length} more` : '')
      : `${data.activeCampaignCount} campaigns`;
    const subject = `YouTube Campaign Update — ${data.weekRange} — ${subjectNames}`;

    const previewText = `${data.activeCampaignCount} active campaigns this week. ${tier1Names.join(', ')} and more.`;

    return NextResponse.json({
      html,
      subject,
      previewText,
      weekRange: data.weekRange,
      campaignCount: data.activeCampaignCount,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
