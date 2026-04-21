import { NextRequest, NextResponse } from 'next/server';
import { listNotes, addNote, deleteNote } from '@/lib/campaignStore';

export const dynamic = 'force-dynamic';

/** GET /api/campaign-notes?slug=x — list notes for a campaign */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  const notes = await listNotes(slug);
  return NextResponse.json({ notes });
}

/** POST /api/campaign-notes — add a note { slug, text, tag? } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const slug: string | undefined = body?.slug;
  const text: string | undefined = body?.text;
  if (!slug || !text) {
    return NextResponse.json({ error: 'Missing slug or text' }, { status: 400 });
  }
  const tag: string | undefined = body?.tag;
  const notes = await addNote(slug, text, tag);
  return NextResponse.json({ notes });
}

/** DELETE /api/campaign-notes?slug=x&noteId=y — delete a note */
export async function DELETE(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  const noteId = req.nextUrl.searchParams.get('noteId');
  if (!slug || !noteId) {
    return NextResponse.json({ error: 'Missing slug or noteId' }, { status: 400 });
  }
  const notes = await deleteNote(slug, noteId);
  return NextResponse.json({ notes });
}
