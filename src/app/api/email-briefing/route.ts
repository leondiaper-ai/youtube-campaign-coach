/**
 * GET /api/email-briefing
 *
 * Generates a brief, teaser-style HTML email that drives clicks to
 * the full campaign briefing landing page. Text-led, headline-focused.
 * YouTube + Virgin Music branding.
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

type BriefingData = {
  weekRange: string; generatedAt: string; activeCampaignCount: number;
  focusCampaigns: FocusCampaign[];
  platformObservations: string[];
  upcomingMoments: UpcomingMoment[];
  playbook: { title: string; why: string; when: string; actions: string[] };
  topShorts: BriefingVideo[];
  topVideos: BriefingVideo[];
  ecosystemHighlights: { name: string; label: string; read: string; thumbnail: string | null; channelHandle: string | null }[];
  momentsWatching: { id: string; title: string; artistName: string; artistSlug: string; thumbnail: string; viewCount: number; velocity: number; daysAgo: number; format: string; durationSec: number; context: string; }[];
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Landing page URL
const LANDING_URL = 'https://youtube-campaign-coach.vercel.app/weekly-pulse/campaign-briefing';

// YouTube logo (red play icon SVG as base64 data URI — renders in most email clients)
const YT_LOGO = 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/120px-YouTube_full-color_icon_%282017%29.svg.png';
// Virgin logo: use text fallback since SVG hotlinks are unreliable in email clients
const VIRGIN_LOGO = '';

// ── Email HTML builder ──────────────────────────────────────────────────────

function buildEmailHtml(data: BriefingData): string {
  const tier1 = data.focusCampaigns.filter(fc => fc.tier === 1);
  const tier2 = data.focusCampaigns.filter(fc => fc.tier === 2);
  const tier3 = data.focusCampaigns.filter(fc => fc.tier === 3);
  const allNames = data.focusCampaigns.map(fc => fc.channel.name);

  // Build the priority names headline — top 3 tier 1 names
  const headlineNames = tier1.slice(0, 3).map(fc => esc(fc.channel.name));
  const otherCount = data.activeCampaignCount - headlineNames.length;

  // Upcoming moments — just the next 3-4 with dates
  const nextMoments = data.upcomingMoments
    .filter(m => m.date)
    .slice(0, 4);

  // Campaign list — just names grouped by tier
  const tier1Names = tier1.map(fc => `<strong>${esc(fc.channel.name)}</strong>`).join(' &nbsp;&middot;&nbsp; ');
  const tier2Names = tier2.map(fc => esc(fc.channel.name)).join(' &nbsp;&middot;&nbsp; ');
  const tier3Names = tier3.map(fc => esc(fc.channel.name)).join(' &nbsp;&middot;&nbsp; ');

  // One-liner teaser stat
  const totalUploads = data.focusCampaigns.reduce((s, fc) => s + fc.channel.uploads30d, 0);

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>YouTube Campaign Update &mdash; ${esc(data.weekRange)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0;mso-table-rspace:0}
  img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}
  body{margin:0;padding:0;width:100%!important;font-family:Arial,Helvetica,sans-serif}
  a{color:#1a1a1a;text-decoration:none}
  @media only screen and (max-width:620px){
    .email-container{width:100%!important;padding:12px!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#F5F5F5;font-family:Arial,Helvetica,sans-serif;">

<!-- Preheader (hidden) -->
<div style="display:none;font-size:1px;color:#F5F5F5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  ${data.activeCampaignCount} active campaigns this week. ${headlineNames.join(', ')} and more. View the full briefing.
</div>

<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#F5F5F5;">
<tr><td align="center" style="padding:32px 16px;">

<!-- Email container -->
<table class="email-container" role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:8px;">

  <!-- Logo bar -->
  <tr><td style="padding:28px 32px 20px 32px;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
      <td width="40" valign="middle">
        <img src="${YT_LOGO}" width="32" height="23" alt="YouTube" style="display:block;" />
      </td>
      <td style="font-size:13px;font-weight:700;color:#1A1A1A;letter-spacing:0.3px;" valign="middle">
        YouTube Campaign Update
      </td>
      <td align="right" valign="middle" style="font-size:13px;font-weight:700;color:#E2001A;letter-spacing:0.3px;">
        Virgin Music
      </td>
    </tr></table>
  </td></tr>

  <!-- Divider -->
  <tr><td style="padding:0 32px;"><div style="border-top:1px solid #E5E5E5;"></div></td></tr>

  <!-- Headline -->
  <tr><td style="padding:24px 32px 0 32px;">
    <div style="font-size:12px;color:#6B7280;font-weight:500;text-transform:uppercase;letter-spacing:1px;">
      Week of ${esc(data.weekRange)}
    </div>
    <div style="font-size:22px;font-weight:700;color:#1A1A1A;line-height:1.3;margin-top:8px;">
      ${data.activeCampaignCount} Active Campaigns This Week
    </div>
    <div style="font-size:14px;color:#6B7280;line-height:1.5;margin-top:6px;">
      ${totalUploads} uploads across the roster. ${nextMoments.length > 0 ? `${nextMoments.length} dated moments coming up.` : ''} Here&rsquo;s what&rsquo;s moving.
    </div>
  </td></tr>

  <!-- Priority projects -->
  <tr><td style="padding:24px 32px 0 32px;">
    <div style="font-size:11px;font-weight:700;color:#FF0000;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
      Priority Projects
    </div>
    <div style="font-size:15px;color:#1A1A1A;line-height:1.7;">
      ${tier1Names}
    </div>
  </td></tr>

  ${tier2.length > 0 ? `
  <!-- Active campaigns -->
  <tr><td style="padding:16px 32px 0 32px;">
    <div style="font-size:11px;font-weight:700;color:#9A6324;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
      Active
    </div>
    <div style="font-size:14px;color:#4B5563;line-height:1.7;">
      ${tier2Names}
    </div>
  </td></tr>
  ` : ''}

  ${tier3.length > 0 ? `
  <!-- Also tracking -->
  <tr><td style="padding:12px 32px 0 32px;">
    <div style="font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
      Also Tracking
    </div>
    <div style="font-size:13px;color:#9CA3AF;line-height:1.7;">
      ${tier3Names}
    </div>
  </td></tr>
  ` : ''}

  ${nextMoments.length > 0 ? `
  <!-- What's coming up -->
  <tr><td style="padding:24px 32px 0 32px;">
    <div style="border-top:1px solid #E5E5E5;padding-top:20px;">
      <div style="font-size:11px;font-weight:700;color:#2D6A4F;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">
        Coming Up
      </div>
      ${nextMoments.map(m => `
        <div style="font-size:14px;color:#1A1A1A;line-height:1.4;margin-bottom:8px;">
          <strong>${esc(m.artist)}</strong> &mdash; ${esc(m.moment)}
          <span style="color:#6B7280;font-size:13px;">&nbsp;${esc(m.timing)}</span>
        </div>
      `).join('')}
    </div>
  </td></tr>
  ` : ''}

  <!-- CTA Button -->
  <tr><td style="padding:28px 32px 0 32px;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
      <td align="center">
        <a href="${LANDING_URL}" target="_blank" style="display:inline-block;background:#1A1A1A;color:#FFFFFF;font-size:14px;font-weight:700;padding:14px 32px;border-radius:6px;text-decoration:none;letter-spacing:0.3px;">
          View Full Briefing &rarr;
        </a>
      </td>
    </tr></table>
  </td></tr>

  <!-- Subtle footer note -->
  <tr><td style="padding:20px 32px 28px 32px;">
    <div style="font-size:12px;color:#9CA3AF;line-height:1.5;text-align:center;">
      Full campaign cards, content performance, release timeline and strategy notes inside.
    </div>
  </td></tr>

</table>
<!-- /Email container -->

<!-- External footer -->
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width:560px;width:100%;">
  <tr><td style="padding:16px 32px;font-size:11px;color:#9CA3AF;text-align:center;line-height:1.5;">
    Virgin Music UK &middot; YouTube Campaign Intelligence<br/>
    Sent weekly. <a href="${LANDING_URL}" style="color:#6B7280;text-decoration:underline;">View in browser</a>
  </td></tr>
</table>

</td></tr>
</table>

</body>
</html>`;

  return html;
}

// ── GET handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
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

    const tier1Names = data.focusCampaigns
      .filter(fc => fc.tier === 1)
      .slice(0, 3)
      .map(fc => fc.channel.name);
    const subject = `YouTube Campaign Update — ${data.weekRange}`;
    const previewText = `${data.activeCampaignCount} active campaigns. ${tier1Names.join(', ')} and more.`;

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
