# Operational Intelligence Layer — Final Report

**Date**: 2026-05-09
**Scope**: Tasks 1–9 — Evolving the Watcher from "latest API response viewer" into a stable operational intelligence layer.

---

## Architecture Changes

The system now distinguishes between **live movement** (current API data) and **retained directional context** (historical movement preserved when current data is stale). Three new concepts were added to the central data layer (`normalizeChannelData.ts`):

1. **LastKnownGoodMovement** — preserved historical deltas from the most recent period with reliable, non-zero data
2. **MovementFreshness** — a 4-tier freshness classification (live → recent → delayed → stale) that's more granular than the existing MovementConfidence
3. **StructuralFinding** — semi-persistent operational insights with configurable retention that don't flicker on/off with API variance

The scoring engine (`channelScore.ts`) now has an **operational signal override**: channels with strong cadence but stale totals earn a 'C' grade ("Active channel — totals updating") instead of the previous 'Limited' rating.

---

## Files Changed

| File | What changed |
|------|-------------|
| `src/lib/youtube/normalizeChannelData.ts` | Added 3 new types (`MovementFreshness`, `LastKnownGoodMovement`, `StructuralFinding`), 3 new fields on `NormalizedChannel`, 3 derivation functions (`deriveMovementFreshness`, `deriveLastKnownGoodMovement`, `deriveStructuralFindings`) |
| `src/lib/channelScore.ts` | `computeGrade()` accepts optional `movementConfidence`; operational signal override for stale-but-active channels; `buildLabel()` has stale-aware label patterns |
| `src/app/watcher/[slug]/page.tsx` | Directional reporting: shows last-known-good values with muted styling, "last confirmed" labels, freshness indicators |
| `src/components/ChannelHealthBoard.tsx` | `RowData` extended with LKG fields; table rows use effective values (current → LKG fallback); stale rows get muted colors; Top Movers uses effective values |
| `src/app/growth/page.tsx` | Passes `movementFreshness` and LKG fields through to ChannelHealthBoard |
| `src/components/CampaignStatusBoard.tsx` | `CardData` extended with LKG fields; movement confidence indicator shows directional data when stale |
| `src/app/campaigns/page.tsx` | `StatusCardData` extended with LKG fields; passes through to CampaignStatusBoard |

---

## How lastKnownGood Works

`deriveLastKnownGoodMovement()` in `normalizeChannelData.ts`:

- **When current movement is high/medium confidence**: uses current non-zero deltas as the last-known-good values (daysAgo = 0).
- **When movement is stale/limited**: walks backward through the channel's snapshot history, looking for the most recent 7-day window where at least one metric (views or subs) showed real, non-zero change.
- **What it stores**: `views7d` (raw delta), `subs7d` (raw delta), `confirmedAt` (ISO date), `daysAgo` (computed at render time).
- **What it never does**: fabricates data. If no historical movement exists, all fields return null.

The Watcher page, Channel Health table, and Campaign Status Board all check for last-known-good values. When current movement is stale but LKG exists, the UI shows the retained value with:
- Muted color (reduced opacity) to distinguish from live data
- "Last confirmed" label instead of the standard metric label
- "Xd ago" sublabel showing how old the data is

---

## How Structural Memory Works

`deriveStructuralFindings()` converts current opportunity detections (e.g. "missing lyric video for Track X") into persistent `StructuralFinding` objects:

1. **New detection** → creates a finding with `detectedAt` = now, `retentionDays` = 7
2. **Re-confirmed detection** → updates `lastConfirmedAt` to now, keeps existing `detectedAt`
3. **Missing from current detection but within retention window** → kept as `active: true` (prevents flicker)
4. **Missing from current detection and past retention window** → marked `active: false` (removed from UI)

This means a detected gap (e.g. "no lyric video for this single") persists for at least 7 days even if the API temporarily doesn't return the data needed to re-detect it.

---

## Freshness Definitions

| Tier | Meaning | Conditions |
|------|---------|-----------|
| `live` | Current, trustworthy | movementConfidence = high AND dataStatus = FRESH |
| `recent` | Slightly aged but usable | movementConfidence = high/medium AND dataStatus = FRESH/PARTIAL |
| `delayed` | Data is aging; show with caution | movementConfidence = medium/limited AND cache > freshMaxHours |
| `stale` | No reliable current movement | movementConfidence = stale OR all other fallthrough |

The freshness tier drives:
- Whether values are shown at full opacity (live/recent) or muted (delayed/stale)
- Whether labels say "Views 7d" (live) vs "Views (last confirmed)" (stale with LKG)
- The freshness indicator text shown below metrics

---

## Before/After Examples

### K-Trap (big back-catalogue, stale API totals, active uploads)

**Before**: Showed "+0 views" and "+0 subs" → scored as 'Limited' → diagnosis said "algorithm not amplifying" — misleading and discouraging.

**After**: Shows "Last confirmed: +X views · Yd ago" with muted styling → scores as 'C' ("Active channel — totals updating") because cadence is strong → diagnosis acknowledges stale totals without blaming the algorithm.

### Tove Lo (large catalogue, intermittent view staleness)

**Before**: Views sometimes showed +0 during stale API windows → WoW showed -100% → implied catastrophic decline that wasn't real.

**After**: When current views are stale, shows last-known-good views delta with "delayed" freshness tag → WoW computation skips stale periods → no false -100% declines → scoring remains stable.

### Artist with sparse history (e.g. newly added)

**Before**: Showed "—" for everything → scored 'Limited' → no actionable information.

**After**: Still shows "—" if no historical movement exists (never fakes data), but if any prior movement was captured, that's retained and shown with muted styling.

---

## Impact on Trust

| Issue | Before | After |
|-------|--------|-------|
| Stale totals showing "+0" | Looked like channel is dead | Shows last confirmed movement with date |
| -100% WoW from stale data | False alarm of catastrophic decline | WoW skipped when data is stale |
| Score collapse on stale data | Active channel scored 'Limited' | Operational override: strong cadence → at least 'C' |
| Flickering opportunities | Appeared/disappeared per API call | 7-day retention window prevents flicker |
| "Algorithm not amplifying" on stale data | Misleading diagnosis | Replaced with "totals awaiting refresh" |
| Empty UI when data is delayed | No context, no direction | Retained directional data with clear freshness labels |

---

## Constraints Honored

- **No fake metrics**: All displayed numbers are real historical data. Muted styling and "last confirmed" labels make the distinction clear.
- **No UI redesign**: All changes are within existing component structure. No new pages, no new layout.
- **No removed graphs**: Sparklines and all existing visualizations are untouched.
- **Continuity preserved**: The system degrades gracefully from live → recent → delayed → stale, never jumping to empty.

---

## Typecheck

```
npx tsc --noEmit → 0 errors
```
