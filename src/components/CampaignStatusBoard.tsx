'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { fmtNum, type ChannelState } from '@/lib/artists';
import type { CampaignNote } from '@/lib/campaignStore';
import {
  DECISION_STYLE,
  type DecisionLabel,
} from '@/lib/youtubeGrowthOS';
import CampaignBehaviour from './CampaignBehaviour';
import {
  DecisionCard, DecisionSectionHeader, WeeklySummary, DormantBlock,
  SectionIssueNote, classifyCard, whatHappening, getGrowthRead,
  type CardData, type AvailableArtist,
} from './CampaignDecisionCard';

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const MUTED = '#E9E2D3';

// ─── Board ──────────────────────────────────────────────────────────────
export default function CampaignStatusBoard({
  initialCards,
  availableArtists,
}: {
  initialCards: CardData[];
  availableArtists: AvailableArtist[];
}) {
  const [cards, setCards] = useState<CardData[]>(initialCards);
  const [available, setAvailable] = useState<AvailableArtist[]>(availableArtists);
  const [showAdd, setShowAdd] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [snapshotStatus, setSnapshotStatus] = useState<string | null>(null);
  const [snapshotSaving, setSnapshotSaving] = useState(false);
  const searchParams = useSearchParams();
  const [behaviourSlug, setBehaviourSlug] = useState<string | null>(
    searchParams.get('behaviour')
  );

  async function handlePin(slug: string) {
    setPinning(true);
    try {
      await fetch('/api/active-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      window.location.reload();
    } finally {
      setPinning(false);
    }
  }

  async function handleUnpin(slug: string) {
    await fetch(`/api/active-campaigns?slug=${slug}`, { method: 'DELETE' });
    const removed = cards.find((c) => c.slug === slug);
    setCards((prev) => prev.filter((c) => c.slug !== slug));
    if (removed) setAvailable((prev) => [...prev, { slug: removed.slug, name: removed.name }]);
  }

  function handleNotesChange(slug: string, notes: CampaignNote[]) {
    setCards((prev) => prev.map((c) => (c.slug === slug ? { ...c, notes } : c)));
  }

  async function handleSaveSnapshot() {
    setSnapshotSaving(true);
    setSnapshotStatus(null);
    try {
      const res = await fetch('/api/weekly-snapshots', { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        setSnapshotStatus(`Error: ${data.error}`);
      } else {
        setSnapshotStatus(
          `${data.captured} captured · ${data.skipped} skipped${data.errors?.length ? ` · ${data.errors.length} errors` : ''} (${data.weekId})`
        );
      }
    } catch (e: any) {
      setSnapshotStatus(`Error: ${e?.message ?? 'Failed'}`);
    } finally {
      setSnapshotSaving(false);
      setTimeout(() => setSnapshotStatus(null), 8000);
    }
  }

  // ─── Group cards by Growth OS decision ─────────────────────────────
  const pushCards: CardData[] = [];
  const fixCards: CardData[] = [];
  const buildCards: CardData[] = [];
  const holdCards: CardData[] = [];
  const dormant: CardData[] = [];

  for (const card of cards) {
    if (card.boardStatus === 'COLD') {
      dormant.push(card);
      continue;
    }
    const read = getGrowthRead(card);
    switch (read.decision) {
      case 'PUSH': pushCards.push(card); break;
      case 'FIX': fixCards.push(card); break;
      case 'HOLD': holdCards.push(card); break;
    }
  }

  // Within each section, sort by priority then by views (highest first)
  const sortByPriorityAndViews = (a: CardData, b: CardData) => {
    if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
    return (b.views7Delta ?? 0) - (a.views7Delta ?? 0);
  };
  pushCards.sort(sortByPriorityAndViews);
  fixCards.sort(sortByPriorityAndViews);
  buildCards.sort(sortByPriorityAndViews);
  holdCards.sort(sortByPriorityAndViews);

  // ─── Behaviour view with Spotify-style sidebar ──────────────────
  const behaviourCard = behaviourSlug ? cards.find((c) => c.slug === behaviourSlug) : null;
  if (behaviourSlug && behaviourCard) {
    // All active (non-COLD, non-dormant) campaigns for sidebar
    const sidebarCampaigns = cards
      .filter((c) => c.boardStatus !== 'COLD' && c.lastUploadDaysAgo !== null && (c.lastUploadDaysAgo ?? 999) < 60)
      .sort((a, b) => a.name.localeCompare(b.name));

    const statusDot = (status: string) => {
      if (status === 'PUSH') return '#1FBE7A';
      if (status === 'FIX') return '#FF4A1C';
      if (status === 'BUILD') return '#2C25FF';
      return '#8A847A';
    };

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        width: '100vw',
        marginLeft: 'calc(-50vw + 50%)',
        position: 'relative',
      }}>
        {/* ─── Logo strip above sidebar ─── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 20px',
          background: PAPER,
        }}>
          <Link href="/growth" className="text-[11px] uppercase tracking-[0.18em] text-ink/55 hover:text-ink no-underline" style={{ marginRight: 8 }}>
            ← Dashboard
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/virgin-music-group.svg" alt="Virgin Music Group" style={{ height: 24 }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/youtube-logo.svg" alt="YouTube" style={{ height: 16, opacity: 0.7 }} />
        </div>

        {/* ─── Sidebar + Content row ─── */}
        <div style={{ display: 'flex', flex: 1 }}>
        {/* ─── Sidebar ─── */}
        <div
          style={{
            width: 72,
            minWidth: 72,
            background: '#1A1A1A',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 16,
            paddingBottom: 16,
            gap: 6,
            overflowY: 'auto',
            position: 'sticky',
            top: 0,
            height: 'calc(100vh - 52px)',
            borderRight: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Back arrow */}
          <button
            onClick={() => setBehaviourSlug(null)}
            title="Back to board"
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(250,247,242,0.7)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              marginBottom: 10,
              flexShrink: 0,
              transition: 'background 0.15s ease',
            }}
          >
            &#x2190;
          </button>

          {/* Campaign list */}
          {sidebarCampaigns.map((c) => {
            const isActive = c.slug === behaviourSlug;
            const initials = c.name
              .split(/\s+/)
              .map((w) => w[0])
              .join('')
              .substring(0, 2)
              .toUpperCase();
            return (
              <button
                key={c.slug}
                onClick={() => setBehaviourSlug(c.slug)}
                title={c.name}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  border: isActive ? '2.5px solid #FAF7F2' : '2.5px solid transparent',
                  background: c.thumbnail ? 'transparent' : (isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'),
                  color: isActive ? '#FAF7F2' : 'rgba(250,247,242,0.5)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  position: 'relative',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                  padding: 0,
                  overflow: 'hidden',
                  opacity: isActive ? 1 : 0.7,
                }}
              >
                {c.thumbnail ? (
                  <img
                    src={c.thumbnail}
                    alt={c.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      borderRadius: '50%',
                    }}
                  />
                ) : (
                  initials
                )}
                {/* Status dot */}
                <span
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: statusDot(c.boardStatus),
                    border: '2px solid #1A1A1A',
                  }}
                />
              </button>
            );
          })}
        </div>

        {/* ─── Main content ─── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <CampaignBehaviour
            slug={behaviourSlug}
            artistName={behaviourCard.name}
            onClose={() => setBehaviourSlug(null)}
            noBreakout
          />
        </div>
        </div>{/* close sidebar+content row */}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/growth" className="text-[11px] uppercase tracking-[0.18em] text-ink/55 hover:text-ink no-underline" style={{ marginRight: 4 }}>
            ← Dashboard
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/virgin-music-group.svg" alt="Virgin Music Group" style={{ height: 28 }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/youtube-logo.svg" alt="YouTube" style={{ height: 16, opacity: 0.7 }} />
        </div>
        <div className="flex items-center gap-4" />
      </div>
      <div className="mb-6 flex items-center justify-between">
        <div>
        {!showAdd ? (
          <button
            onClick={() => setShowAdd(true)}
            className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/30 hover:text-ink/60 transition-colors"
          >
            + Add campaign
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <select
              className="rounded-lg border px-3 py-2 text-[13px] outline-none"
              style={{ borderColor: MUTED, background: SOFT }}
              defaultValue=""
              onChange={(e) => { if (e.target.value) handlePin(e.target.value); }}
              disabled={pinning}
            >
              <option value="" disabled>
                {available.length === 0 ? 'All artists already added' : 'Select an artist…'}
              </option>
              {available.map((a) => (
                <option key={a.slug} value={a.slug}>{a.name}</option>
              ))}
            </select>
            <button onClick={() => setShowAdd(false)} className="text-[12px] text-ink/30 hover:text-ink/50">
              Cancel
            </button>
          </div>
        )}
        </div>
        <div className="flex items-center gap-3" />
      </div>

      {cards.length === 0 ? (
        <div className="rounded-2xl p-16 text-center" style={{ background: SOFT }}>
          <div className="text-[15px] font-bold mb-1">No campaigns yet</div>
          <div className="text-[13px] text-ink/40">Add artists to start tracking campaign status.</div>
        </div>
      ) : (
        <div className="space-y-10">
          {/* ─── Weekly YouTube Read ────────────────────────────────── */}
          <WeeklySummary cards={cards} />

          {/* ─── PUSH — Strong performance, ready to scale ──────────── */}
          {pushCards.length > 0 && (
            <div>
              <DecisionSectionHeader decision="PUSH" subtitle="Strong performance — ready to scale" count={pushCards.length} />
              <SectionIssueNote cards={pushCards} />
              <div className="space-y-4">
                {pushCards.map((card) => (
                  <DecisionCard
                    key={card.slug}
                    card={card}
                    onUnpin={handleUnpin}
                    onNotesChange={handleNotesChange}
                    onViewBehaviour={setBehaviourSlug}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ─── FIX — High reach, weak conversion ──────────────────── */}
          {fixCards.length > 0 && (
            <div>
              <DecisionSectionHeader decision="FIX" subtitle="High reach but weak conversion" count={fixCards.length} />
              <SectionIssueNote cards={fixCards} />
              <div className="space-y-4">
                {fixCards.map((card) => (
                  <DecisionCard
                    key={card.slug}
                    card={card}
                    onUnpin={handleUnpin}
                    onNotesChange={handleNotesChange}
                    onViewBehaviour={setBehaviourSlug}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ─── BUILD — Early signal or underfed ───────────────────── */}
          {buildCards.length > 0 && (
            <div>
              <DecisionSectionHeader decision="BUILD" subtitle="Early signal or underfed channel" count={buildCards.length} />
              <SectionIssueNote cards={buildCards} />
              <div className="space-y-4">
                {buildCards.map((card) => (
                  <DecisionCard
                    key={card.slug}
                    card={card}
                    onUnpin={handleUnpin}
                    onNotesChange={handleNotesChange}
                    onViewBehaviour={setBehaviourSlug}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ─── HOLD — No clear signal or inactive ─────────────────── */}
          {holdCards.length > 0 && (
            <div>
              <DecisionSectionHeader decision="HOLD" subtitle="No clear signal — waiting" count={holdCards.length} />
              <div className="space-y-4">
                {holdCards.map((card) => (
                  <DecisionCard
                    key={card.slug}
                    card={card}
                    onUnpin={handleUnpin}
                    onNotesChange={handleNotesChange}
                    onViewBehaviour={setBehaviourSlug}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ─── Dormant / Cold (collapsed) ─────────────────────────── */}
          {dormant.length > 0 && (
            <DormantBlock cards={dormant} />
          )}
        </div>
      )}
    </>
  );
}
