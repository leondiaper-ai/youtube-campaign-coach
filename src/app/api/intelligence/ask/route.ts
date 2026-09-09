/**
 * THE ASSISTANT — HTTP SURFACE
 *
 * Most questions here are answered from the stores and cost nothing; the
 * reply's `usedModel` flag says which. See lib/intelligence/assistant.ts
 * for why the routing is keyword-based rather than model-based.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ask } from '@/lib/intelligence/assistant';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const baseUrl = new URL(req.url).origin;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'BAD_JSON' }, { status: 400 }); }

  const question = String(body?.question ?? '').trim();
  if (!question) return NextResponse.json({ error: 'question is required' }, { status: 400 });

  return NextResponse.json(await ask(question, { baseUrl }));
}
