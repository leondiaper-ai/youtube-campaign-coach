import { NextRequest, NextResponse } from 'next/server';
import { fetchChannelSnap } from '@/lib/youtube';
import { daysSince } from '@/lib/artists';

export const dynamic = 'force-dynamic';

// ─── Decision logic (deterministic, top-to-bottom, first match wins) ──────
// These are the product contract — do not change state strings or order.

type Metrics = {
  uploads30d: number;
  shorts30d: number;
  lastUploadDays: number | null;
  subs: number;
};

type Decision = {
  state: string;
  explanation: string;
  whatsGoingOn: string;
  actions: string[];
};

function decide(m: Metrics): Decision {
  const { uploads30d, shorts30d, lastUploadDays, subs } = m;

  if (uploads30d === 0) {
    return {
      state: 'NEEDS ATTENTION',
      explanation: 'No uploads in 30 days — momentum is gone',
      whatsGoingOn: 'Channel has audience history but is currently inactive',
      actions: [
        'Post 2–3 Shorts this week to re-engage the algorithm',
        'Ship one main upload to signal the channel is active',
      ],
    };
  }

  if (uploads30d >= 8 && shorts30d >= 4 && lastUploadDays !== null && lastUploadDays < 7) {
    return {
      state: 'STRONG',
      explanation: 'High cadence with healthy Shorts mix — growth compounds',
      whatsGoingOn: 'Strong activity and structure — channel is well maintained',
      actions: [
        'Keep cadence and double down on top-performing formats',
        'Test one new hook or thumbnail style to extend reach',
      ],
    };
  }

  if (subs >= 10000 && uploads30d < 4) {
    return {
      state: 'UNDERUSED',
      explanation: 'Audience is larger than the output — attention is leaking',
      whatsGoingOn: 'Channel is underutilised relative to its size',
      actions: [
        'Increase upload consistency to at least 1–2 per week',
        'Add Shorts alongside main uploads to feed the algorithm',
      ],
    };
  }

  if (uploads30d >= 4 && lastUploadDays !== null && lastUploadDays < 7) {
    return {
      state: 'ACTIVE',
      explanation: 'Posting cadence is steady — channel is moving',
      whatsGoingOn: 'Content is being posted on a regular rhythm',
      actions: [
        'Add 2 Shorts this week to widen reach',
        'Hold the current upload cadence for the next 4 weeks',
      ],
    };
  }

  if (lastUploadDays !== null && lastUploadDays > 14) {
    return {
      state: 'INCONSISTENT',
      explanation: 'Posting is active but inconsistent — growth unlikely to compound',
      whatsGoingOn: 'Content is being posted but lacks consistency',
      actions: [
        'Lock a weekly upload slot and hit it for 4 weeks straight',
        'Post 2–3 Shorts between main uploads to stay in the feed',
      ],
    };
  }

  return {
    state: 'INCONSISTENT',
    explanation: 'Activity is uneven — cadence needs tightening',
    whatsGoingOn: 'Content is being posted but lacks consistency',
    actions: [
      'Commit to a fixed weekly upload slot',
      'Add Shorts between main uploads to stay in the feed',
    ],
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    if (!process.env.YOUTUBE_API_KEY) {
      return NextResponse.json(
        { error: 'YOUTUBE_API_KEY is not set' },
        { status: 500 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const url: string | undefined = body?.url;
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing channel URL' }, { status: 400 });
    }

    // ── Use the campaign system's data layer ────────────────────────────
    const snap = await fetchChannelSnap(url);
    if (!snap) {
      return NextResponse.json({ error: 'Could not fetch channel data' }, { status: 500 });
    }
    if (snap.error) {
      return NextResponse.json({ error: snap.error }, { status: 502 });
    }
    if (snap.subs == null) {
      return NextResponse.json({ error: 'Could not find that channel' }, { status: 404 });
    }

    const lastUploadDays = daysSince(snap.lastUploadAt);

    const decision = decide({
      uploads30d: snap.uploads30d ?? 0,
      shorts30d: snap.shorts30d ?? 0,
      lastUploadDays: lastUploadDays ?? 9999,
      subs: snap.subs ?? 0,
    });

    return NextResponse.json({
      channel: {
        title: snap.title ?? 'Unknown',
        subs: snap.subs ?? 0,
        totalViews: snap.views ?? 0,
        totalVideos: (snap.recentUploads?.length ?? 0),
        lastUploadDays,
        uploads30d: snap.uploads30d ?? 0,
        shorts30d: snap.shorts30d ?? 0,
      },
      ...decision,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
