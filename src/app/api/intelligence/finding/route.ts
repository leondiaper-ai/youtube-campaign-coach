/**
 * FINDING REVIEW
 *
 * The human end of the learning loop. A finding is NEW until a person says
 * otherwise; nothing here is written by the model.
 *
 * Promoting to a case study or into campaign memory is an explicit act, for
 * the reason set out in coach-service/memory.ts — an observation must not
 * become a validated principle because a model wrote an eloquent paragraph.
 */

import { NextRequest, NextResponse } from 'next/server';
import { setFindingStatus, listFindings, setCaseStudyStatus } from '@/lib/intelligence/store';
import { recordMemory } from '@/lib/coach-service/memory';
import type { FindingStatus } from '@/lib/intelligence/types';

export const dynamic = 'force-dynamic';

const STATUSES: FindingStatus[] = [
  'NEW', 'REVIEWED', 'ACTIONED', 'SAVED_AS_CASE_STUDY', 'DISMISSED',
];

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'BAD_JSON' }, { status: 400 }); }

  const { artistId, findingId, status, promoteToMemory } = body ?? {};
  if (!artistId || !findingId) {
    return NextResponse.json({ error: 'artistId and findingId are required' }, { status: 400 });
  }
  if (!STATUSES.includes(status)) {
    return NextResponse.json({ error: `status must be one of ${STATUSES.join(', ')}` }, { status: 400 });
  }

  const updated = await setFindingStatus(artistId, findingId, status);
  if (!updated) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  /* Accepting a case study is what makes it real. Until a human does this
     it stays CANDIDATE, however confident the model was. */
  if (status === 'SAVED_AS_CASE_STUDY' && updated.caseStudyId) {
    await setCaseStudyStatus(updated.caseStudyId, 'VALIDATED');
  }

  let memoryId: string | null = null;
  if (promoteToMemory === true) {
    const item = await recordMemory({
      artistId: updated.artistId,
      campaignId: updated.campaignId,
      /* A finding the model produced is an INTERPRETATION until someone
         measures it, regardless of how it was labelled upstream. */
      kind: status === 'ACTIONED' ? 'RECOMMENDATION' : 'INTERPRETATION',
      text: updated.headline,
      sourceRef: updated.signal.sourceRef,
      createdBy: 'human:watcher-intelligence',
    });
    memoryId = item.id;
  }

  return NextResponse.json({ finding: { ...updated, memoryId: memoryId ?? updated.memoryId } });
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('artistId');
  if (!slug) return NextResponse.json({ error: 'artistId is required' }, { status: 400 });
  return NextResponse.json({ findings: await listFindings(slug) });
}
