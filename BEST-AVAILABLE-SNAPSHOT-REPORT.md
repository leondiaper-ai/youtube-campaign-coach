# Best Available Snapshot — Implementation Report

## What Changed

The system evolved from a binary "current data or Last Known Good fallback" to a ranked **Best Available Snapshot** model. Instead of showing either live 7d deltas or a single retained fallback, the system now walks a 6-tier priority ladder to select the most informative signal available for each artist at render time.

### New Architecture: `deriveBestAvailableMovement()`

Every artist now gets a `BestAvailableMovement` object attached to their `NormalizedChannel`. This object carries:

- **source** — which tier provided the data (`live_7d`, `recent_snapshot`, `campaign_period`, `recent_uploads`, `last_confirmed`, `none`)
- **viewsValue / subsValue** — the numeric movement (null when unavailable)
- **confidence** — `high`, `medium`, or `low`
- **label / sublabel** — source-aware metric labels (e.g. "Views (7d)" vs "Views (recent)" vs "Campaign period" vs "Activity signal")
- **explanation** — human-readable context for tooltips and reports
- **shouldUseInScore / shouldUseInTopMovers / shouldUseInReport** — per-source usage flags that prevent stale or cumulative data from polluting rankings

### The 6-Tier Priority Ladder

| Priority | Source | Confidence | Use in Score | Use in Top Movers | Age Limit |
|----------|--------|-----------|-------------|-------------------|-----------|
| 1 | `live_7d` | high/medium | Yes | Yes | Current |
| 2 | `recent_snapshot` | medium | Yes | Yes | 7 days |
| 3 | `campaign_period` | medium | No (cumulative) | No | Active campaign |
| 4 | `recent_uploads` | low | No | No | 14 days |
| 5 | `last_confirmed` | low | No | ≤14d only | 14d headline / unlimited tooltip |
| 6 | `none` | low | No | No | — |

### How It Differs From LastKnownGood

**Before (LKG):**
- Binary: either current 7d deltas are valid, or fall back to the single stored LKG values
- No age awareness: LKG could be 30 days old and still headline the dashboard
- No campaign context: active campaigns showed the same generic LKG as dormant artists
- No upload signal: if view totals stalled, the artist looked dead even while uploading daily
- Scoring treated all non-live data identically

**After (Best Available Snapshot):**
- 6-tier ranked selection picks the most useful signal available
- Age limits prevent stale data from overstaying: recent_snapshot expires at 7d, recent_uploads at 14d, last_confirmed headlines cap at 14d
- Active campaigns jump ahead of generic retained data in priority
- Upload activity provides a directional "alive" signal when all totals are stale
- Source-aware labels tell the user exactly what they're looking at
- Usage flags prevent cumulative or low-confidence data from contaminating scores and rankings

---

## Before / After: K-Trap

**Before:** When YouTube API returns stale view totals (common for K-Trap due to quota limits), the Watcher shows either "+0 views (7d)" or falls back to LKG with no campaign context. The Campaign Status Board shows generic stale data regardless of the active campaign.

**After:** With an active campaign, K-Trap's Best Available source becomes `campaign_period`. The Watcher shows "Campaign period — +X views since launch · day N" instead of misleading weekly zeros. The label explicitly says "Campaign period" and the sublabel shows the campaign start date and day count. If no campaign were active but uploads continued, K-Trap would fall to `recent_uploads` showing "Activity signal — 3 uploads / 30d" instead of dead silence.

## Before / After: Tove Lo

**Before:** Tove Lo has irregular upload cadence and frequent API staleness. With no active campaign and sporadic uploads, the system showed stale LKG indefinitely — potentially weeks-old data headlining the dashboard with no age context.

**After:** With current data available, Tove Lo shows `live_7d` as before. When data goes stale:
- Within 7 days: `recent_snapshot` kicks in with "Views (recent) — as of 2 May" and medium confidence
- After 7 days with uploads: `recent_uploads` shows "Activity signal — 1 upload / 30d"
- After 7 days without uploads: `last_confirmed` shows "Views (last confirmed) — 8d ago" if within 14d, or "Views (historical)" if older
- The label always tells the user exactly what vintage of data they're seeing

---

## Active Campaigns During API Stalls

Active campaigns now remain useful during API stalls. The `campaign_period` tier sits at priority 3 — below live data and recent snapshots (which are more precise) but above upload activity and generic retained data. This means:

1. If live weekly deltas work → use those (most precise)
2. If live data stalls but we have a recent snapshot → use that (still weekly-scoped)
3. If both are stale but a campaign is active → show campaign-period cumulative movement
4. Campaign data says "Campaign active: +1.8M views since launch" — actionable context vs dead silence

The `shouldUseInScore: false` flag on campaign_period prevents cumulative totals from inflating weekly scores, while `shouldUseInReport: true` ensures campaign progress still appears in reports and decision surfaces.

---

## Structural Findings Upgrade

`StructuralFinding` gained three new fields:

- **status**: `FindingStatus = 'active' | 'pending_refresh' | 'resolved'` — 3-state lifecycle prevents flicker (active findings move to pending_refresh before resolving, so brief API gaps don't cause findings to flash on/off)
- **evidenceSource**: string describing what data backs the finding (e.g. "Upload cadence analysis", "Subscriber delta")
- **findingConfidence**: `'high' | 'medium' | 'low'` — re-confirmed findings get high, new detections get medium, aging unconfirmed ones get low

---

## Scoring Refinements

`computeGrade()` and `buildLabel()` now accept `hasActiveCampaign` and `bestAvailableSource` parameters. The operational signal override matrix expanded:

| Condition | Grade Floor |
|-----------|-------------|
| Active campaign + any cadence (not weak) | C |
| Strong cadence (≥4 uploads/30d), no campaign | C |
| Average cadence (1-3 uploads/30d), no campaign | D |
| `limited` confidence | Label adjusted, no false "Excellent" |
| `recent_snapshot` source | Label reflects "recent data" context |

This prevents artists with active campaigns and regular uploads from receiving F grades just because view totals are temporarily stale.

---

## Reporting Helper

`getReportingMovementSummary(nc, artistName)` generates source-aware prose for each tier:

- `live_7d` → "Channel movement is live: +X views over 7d"
- `recent_snapshot` → "Recent movement (3d ago): +X views. Channel totals currently delayed."
- `campaign_period` → "Campaign remains active, +X views since launch. Weekly channel totals delayed."
- `recent_uploads` → "Channel totals delayed. Recent uploads still active (4 in 30 days)."
- `last_confirmed` → Age-gated: headline-worthy vs historical-only language
- `none` → "No recent movement data available."

---

## Files Changed

| File | Changes |
|------|---------|
| `src/lib/youtube/normalizeChannelData.ts` | Added `BestAvailableSource`, `BestAvailableMovement`, `FindingStatus` types. Added `BEST_AVAILABLE_AGE_LIMITS` constants. Added `deriveBestAvailableMovement()` (~140 lines). Added `ReportingMovementSummary` type and `getReportingMovementSummary()`. Updated `StructuralFinding` with status/evidenceSource/findingConfidence. Updated `deriveStructuralFindings()`. Updated `normalizeChannelData()` to derive bestAvailable. |
| `src/lib/channelScore.ts` | Added `hasActiveCampaign` and `bestAvailableSource` to `ChannelScoreInput`. Expanded `computeGrade()` operational override matrix. Updated `buildLabel()` for campaign/source-aware labels. |
| `src/app/watcher/[slug]/page.tsx` | Replaced manual LKG rendering with `bestAvailable`-based source-aware labels, muted colors for non-live sources, simplified freshness indicator. |
| `src/components/ChannelHealthBoard.tsx` | Added `bestAvailableSource` and `bestAvailableShouldUseInTopMovers` to `RowData`. Updated Top Movers to filter by `shouldUseInTopMovers`. |
| `src/app/growth/page.tsx` | Passes `bestAvailableSource` and `bestAvailableShouldUseInTopMovers` to ChannelHealthBoard rows. |
| `src/app/campaigns/page.tsx` | Added `bestAvailableSource` and `bestAvailableExplanation` to `StatusCardData` and data builder. |

---

## What Is Still Limited Without YouTube Analytics API

The Best Available Snapshot model maximises the value of public YouTube Data API v3 data, but several capabilities remain out of reach without YouTube Analytics API (OAuth-gated, requires channel owner consent):

1. **Watch time and retention** — cannot measure average view duration, audience retention curves, or watch time per video. These are the strongest signals of content quality.
2. **Traffic sources** — cannot see how viewers find videos (search, browse, suggested, external). Critical for understanding whether a campaign is driving discovery.
3. **Demographics** — cannot access age, gender, or geography breakdowns. Important for validating whether campaigns reach the intended audience.
4. **Revenue data** — cannot see RPM, CPM, or estimated earnings. Relevant for value model accuracy.
5. **Real-time views** — the public API's view counts update with variable delay (sometimes hours). Analytics API provides near-real-time data.
6. **Subscriber source** — cannot determine which videos or external sources drive subscriber growth.

The Best Available Snapshot model mitigates the delay/staleness problem (#5) through its tiered fallback system, but it cannot synthesise the deeper engagement signals (#1-4, #6) that only Analytics API provides. For managed Virgin artists where channel owner consent is obtainable, Analytics API integration would be the highest-value next step.
