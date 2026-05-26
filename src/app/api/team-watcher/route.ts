import { NextRequest, NextResponse } from 'next/server';
import {
  listEntries,
  upsertEntry,
  patchEntry,
  addEntryNote,
  deleteEntryNote,
  removeEntry,
  type TeamWatcherEntry,
  type CampaignState,
  CAMPAIGN_STATES,
} from '@/lib/teamWatcherStore';
import { readLiveSnap } from '@/lib/kvCache';
import { deriveFromLive, type LiveSnap, type Derived } from '@/lib/artists';

export const dynamic = 'force-dynamic';

// ── Types for the enriched response ──────────────────────────────────────────

type EnrichedEntry = TeamWatcherEntry & {
  /** Cached YouTube data — null if no cache exists yet */
  youtube: {
    subs: number | null;
    views: number | null;
    uploads30d: number | null;
    shorts30d: number | null;
    lastUploadAt: string | null;
    thumbnail: string | null;
    cachedAt: string | null;
  } | null;
  /** Derived channel health — null if no YouTube data */
  health: Derived | null;
};

function enrichSnap(snap: LiveSnap | null): EnrichedEntry['youtube'] {
  if (!snap) return null;
  return {
    subs: snap.subs ?? null,
    views: snap.views ?? null,
    uploads30d: snap.uploads30d ?? null,
    shorts30d: snap.shorts30d ?? null,
    lastUploadAt: snap.lastUploadAt ?? null,
    thumbnail: snap.thumbnail ?? null,
    cachedAt: (snap as Record<string, unknown>).cachedAt as string | null ?? null,
  };
}

// ── GET: list all entries with cached YouTube data ───────────────────────────

export async function GET() {
  const entries = await listEntries();

  // Enrich each entry with cached YouTube data (no API calls)
  const enriched: EnrichedEntry[] = await Promise.all(
    entries.map(async (entry) => {
      const snap = await readLiveSnap(entry.channelId);
      const youtube = enrichSnap(snap);
      const health = snap ? deriveFromLive(snap) : null;
      return { ...entry, youtube, health };
    }),
  );

  return NextResponse.json({ entries: enriched });
}

// ── POST: add a new entry ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    channelId,
    artistSlug,
    displayName,
    campaignName,
    campaignStartDate,
    campaignState,
    regionTag,
  } = body as Record<string, string | undefined>;

  if (!channelId || !artistSlug || !displayName) {
    return NextResponse.json(
      { error: 'channelId, artistSlug, and displayName are required' },
      { status: 400 },
    );
  }

  const state: CampaignState =
    campaignState && CAMPAIGN_STATES.includes(campaignState as CampaignState)
      ? (campaignState as CampaignState)
      : 'Monitoring';

  const entries = await upsertEntry({
    channelId,
    artistSlug,
    displayName,
    campaignName: campaignName ?? '',
    campaignStartDate: campaignStartDate ?? '',
    campaignState: state,
    regionTag: regionTag ?? '',
    teamNotes: [],
    pinnedAt: null,
  });

  return NextResponse.json({ entries });
}

// ── PATCH: update fields, pin/unpin, add/delete note ─────────────────────────

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { channelId, action } = body as Record<string, string | undefined>;
  if (!channelId) {
    return NextResponse.json({ error: 'channelId is required' }, { status: 400 });
  }

  // Route by action type
  switch (action) {
    case 'pin': {
      const entries = await patchEntry(channelId, {
        pinnedAt: new Date().toISOString(),
      });
      return NextResponse.json({ entries });
    }
    case 'unpin': {
      const entries = await patchEntry(channelId, { pinnedAt: null });
      return NextResponse.json({ entries });
    }
    case 'addNote': {
      const text = (body as Record<string, string>).text;
      if (!text) {
        return NextResponse.json({ error: 'text is required for addNote' }, { status: 400 });
      }
      const entries = await addEntryNote(channelId, text);
      return NextResponse.json({ entries });
    }
    case 'deleteNote': {
      const noteId = (body as Record<string, string>).noteId;
      if (!noteId) {
        return NextResponse.json({ error: 'noteId is required for deleteNote' }, { status: 400 });
      }
      const entries = await deleteEntryNote(channelId, noteId);
      return NextResponse.json({ entries });
    }
    default: {
      // Generic field update
      const patch: Record<string, unknown> = {};
      if (body.campaignName !== undefined) patch.campaignName = body.campaignName;
      if (body.campaignStartDate !== undefined) patch.campaignStartDate = body.campaignStartDate;
      if (body.regionTag !== undefined) patch.regionTag = body.regionTag;
      if (body.displayName !== undefined) patch.displayName = body.displayName;
      if (
        body.campaignState !== undefined &&
        CAMPAIGN_STATES.includes(body.campaignState as CampaignState)
      ) {
        patch.campaignState = body.campaignState;
      }
      const entries = await patchEntry(channelId, patch);
      return NextResponse.json({ entries });
    }
  }
}

// ── DELETE: remove an entry ──────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get('channelId');
  if (!channelId) {
    return NextResponse.json({ error: 'channelId query param required' }, { status: 400 });
  }
  const entries = await removeEntry(channelId);
  return NextResponse.json({ entries });
}
