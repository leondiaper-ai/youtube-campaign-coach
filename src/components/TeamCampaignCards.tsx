'use client';

/* ═══════════════════════════════════════════════════════════════════
   A TEAM'S PRIORITY CAMPAIGNS
   ═══════════════════════════════════════════════════════════════════

   This file used to draw its own card: a narrower set of tiles, its
   own conversion label, its own wording for what was happening. It
   sat one link away from the campaigns board drawing the same
   campaign with more detail and different phrasing, which is the
   familiar failure — two descriptions of one thing, and no way to
   tell which is current.

   It now renders DecisionCard, the card the campaigns board draws.
   Same growth read, same decision label, same conversion maths, same
   Slack and email text. What this file still owns is the two things
   that genuinely differ for a team: where a note is written, and
   where the Behaviour button goes.
   ═══════════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { DecisionCard, type CardData, type CardApi } from './CampaignDecisionCard';
import type { CampaignNote } from '@/lib/campaignStore';
import { useOpenBehaviour } from './TeamBoardShell';

/** The board carries this alongside the card fields; the card ignores it. */
export type TeamCardData = CardData & { channelId: string };

export default function TeamCampaignCards({ cards, team }: {
  cards: TeamCardData[];
  /** Decides WHICH board these writes land on. Never defaulted: the API
      falls back to nordics without it, which is correct for the original
      caller and silently wrong for every other one. */
  team?: string;
}) {
  const [notesBySlug, setNotesBySlug] = useState<Record<string, CampaignNote[]>>(
    Object.fromEntries(cards.map((c) => [c.slug, c.notes])),
  );
  const openBehaviour = useOpenBehaviour();

  const url = `/api/team-watcher${team ? `?team=${encodeURIComponent(team)}` : ''}`;

  /* The team's entry is keyed by channelId, and its notes come back
     inside the whole entry list — so each write finds its own entry
     again and returns just that artist's notes, in the shape the card
     reads. */
  function notesFor(channelId: string, entries: unknown): CampaignNote[] | null {
    const list = (entries as { channelId: string; teamNotes: CampaignNote[] }[]) ?? null;
    if (!Array.isArray(list)) return null;
    const mine = list.find((e) => e.channelId === channelId);
    return mine ? mine.teamNotes : null;
  }

  function apiFor(card: TeamCardData): CardApi {
    return {
      addNote: async (_slug, text) => {
        const res = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelId: card.channelId, action: 'addNote', text }),
        });
        const data = await res.json();
        return notesFor(card.channelId, data.entries);
      },
      deleteNote: async (_slug, noteId) => {
        const res = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelId: card.channelId, action: 'deleteNote', noteId }),
        });
        const data = await res.json();
        return notesFor(card.channelId, data.entries);
      },
      /* Weekly snapshots are ours, not theirs — the control is left
         undrawn rather than drawn and empty. */
    };
  }

  async function unpin(card: TeamCardData) {
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId: card.channelId, action: 'unpin' }),
    });
    window.location.reload();
  }

  return (
    <div className="space-y-4">
      {cards.map((card) => (
        <DecisionCard
          key={card.channelId}
          card={{ ...card, notes: notesBySlug[card.slug] ?? card.notes }}
          api={apiFor(card)}
          onUnpin={() => unpin(card)}
          onNotesChange={(slug, notes) =>
            setNotesBySlug((prev) => ({ ...prev, [slug]: notes }))
          }
          onViewBehaviour={openBehaviour ?? undefined}
        />
      ))}
    </div>
  );
}
