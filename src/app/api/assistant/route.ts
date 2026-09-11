/**
 * ASSISTANT — HTTP SURFACE
 *
 * GET assembles the home from stored data and never spends anything.
 * POST performs the one action the page offers that costs money: refreshing
 * a campaign read, which goes through the existing Coach service rather
 * than a second model path.
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildAssistantHome } from '@/lib/assistant/home';
import { renderShare, type ShareFormat } from '@/lib/assistant/share';
import { prepareCampaignRead } from '@/lib/assistant/read';
import { ARTISTS, mergeArtistLists } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { readOverview } from '@/lib/coach-service/store';
import { readCampaignRead, reviewCampaignRead, readHistory } from '@/lib/assistant/readStore';
import {
  listKnowledge, propose, review, recordFeedback, listFeedback,
  type KnowledgeKind, type ItemStatus, type FeedbackKind,
} from '@/lib/knowledge/inbox';
import { BOUNDARY_RULES } from '@/lib/knowledge/evidence';
import { runBoundaryChecks } from '@/lib/knowledge/__tests__/evidence.test';
import { runMatchingChecks } from '@/lib/intelligence/__tests__/matching.test';
import { runProgressChecks } from '@/lib/intelligence/__tests__/progress.test';
import { runRolloutChecks } from '@/lib/intelligence/__tests__/rollout.test';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const view = req.nextUrl.searchParams.get('view');

  if (view === 'knowledge') {
    return NextResponse.json({
      items: await listKnowledge(),
      feedback: await listFeedback(50),
      boundaryRules: BOUNDARY_RULES,
    });
  }
  /* The boundary suite runs on demand rather than in CI, because this repo
     has no test runner. Executable is better than aspirational. */
  if (view === 'boundary-checks') {
    return NextResponse.json(runBoundaryChecks());
  }
  /* The matching suite, same arrangement. It also validates every seeded
     Deep Dive, so a transcription with an invented tag or a missing basis
     fails here rather than showing up as a silently unmatchable artist. */
  if (view === 'matching-checks') {
    return NextResponse.json(runMatchingChecks());
  }
  /* The progress suite. These guard the one claim this layer could make
     wrongly and flatteringly: that an upload proves a recommendation was
     implemented. */
  if (view === 'progress-checks') {
    return NextResponse.json(runProgressChecks());
  }
  /* The rollout suite. These guard the Ideas tab's two temptations: showing
     an unverified example as evidence, and letting the research question sit
     on a stage the campaign has already passed. */
  if (view === 'rollout-checks') {
    return NextResponse.json(runRolloutChecks());
  }
  if (view === 'read') {
    const slug = req.nextUrl.searchParams.get('slug') ?? '';
    return NextResponse.json({
      read: await readCampaignRead(slug),
      history: await readHistory(slug),
    });
  }

  return NextResponse.json(await buildAssistantHome());
}

export async function POST(req: NextRequest) {
  const baseUrl = new URL(req.url).origin;
  let body: any = {};
  try { body = await req.json(); } catch { /* optional */ }

  /* Rendering a share format is free — it is string assembly over an
     interpretation that already exists, not a second generation. */
  if (body.action === 'share') {
    const o = await readOverview(String(body.slug ?? ''));
    if (!o) return NextResponse.json({ error: 'NO_READ' }, { status: 404 });
    return NextResponse.json({ text: renderShare(o, body.format as ShareFormat) });
  }

  if (body.action === 'refresh') {
    const slug = String(body.slug ?? '');
    if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });

    const artist = mergeArtistLists(ARTISTS, await listCustomArtists()).find(a => a.slug === slug);
    if (!artist) return NextResponse.json({ error: 'UNKNOWN_ARTIST' }, { status: 404 });

    /* Asset-level read: reconstructs the catalogue, compares this release
       with the artist's own previous one, then interprets. */
    const r = await prepareCampaignRead(artist, baseUrl);
    if (!r.ok) return NextResponse.json({ error: 'READ_FAILED', detail: r.detail }, { status: 400 });
    return NextResponse.json({
      overview: r.overview,
      releaseWindows: r.evidence?.profile.releaseWindows ?? [],
      comparison: r.evidence?.comparison ?? null,
      tokens: r.tokens, latencyMs: r.latencyMs,
    });
  }

  /* Batch: prepare reads for pinned campaigns that do not have one.
     Sequential and time-boxed — each read is a catalogue pull plus a model
     call at roughly 12s, and the platform kills the request at 60. The
     caller loops until `remaining` is zero. */
  if (body.action === 'refresh-all') {
    const t0 = Date.now();
    const budgetMs = Number(body.budgetMs ?? 45_000);
    const artists = mergeArtistLists(ARTISTS, await listCustomArtists());
    const { listPinned } = await import('@/lib/campaignStore');
    const pinned = await listPinned();
    const bySlug = new Map(artists.map(a => [a.slug, a]));

    const done: { slug: string; status: string; headline: string }[] = [];
    const failed: { slug: string; detail: string }[] = [];
    let remaining = 0;

    for (const p of pinned) {
      const artist = bySlug.get(p.slug);
      if (!artist) continue;
      if (!body.force && await readCampaignRead(p.slug)) continue;
      if (Date.now() - t0 + 14_000 > budgetMs) { remaining++; continue; }

      const r = await prepareCampaignRead(artist, baseUrl);
      if (r.ok && r.record) {
        done.push({ slug: p.slug, status: r.record.status, headline: r.record.read });
      } else {
        failed.push({ slug: p.slug, detail: r.detail ?? 'unknown' });
      }
    }
    return NextResponse.json({ done, failed, remaining, ms: Date.now() - t0 });
  }

  if (body.action === 'review-read') {
    const r = await reviewCampaignRead(String(body.slug), body.status, body.note);
    return r ? NextResponse.json({ read: r }) : NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  if (body.action === 'feedback') {
    /* A factual correction and a preference judgement are different things
       and are stored apart — see knowledge/inbox.ts. */
    return NextResponse.json({
      feedback: await recordFeedback({
        targetId: String(body.targetId ?? ''),
        targetType: body.targetType,
        subjectId: body.subjectId ?? null,
        kind: body.kind as FeedbackKind,
        correction: body.correction,
        note: body.note,
      }),
    });
  }

  if (body.action === 'propose-knowledge') {
    return NextResponse.json({
      item: await propose({
        kind: body.kind as KnowledgeKind,
        statement: String(body.statement ?? ''),
        subjectId: body.subjectId ?? null,
        subjectName: body.subjectName ?? null,
        evidence: Array.isArray(body.evidence) ? body.evidence : [],
        confidence: body.confidence ?? 'LOW',
        origin: body.origin ?? 'HUMAN',
        sourceRef: String(body.sourceRef ?? 'manual'),
      }),
    });
  }

  if (body.action === 'review-knowledge') {
    const item = await review(String(body.id), body.status as ItemStatus, body.note);
    return item ? NextResponse.json({ item }) : NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
