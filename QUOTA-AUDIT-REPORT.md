# YouTube API Quota Audit & Smart Snapshot Scheduling

**Date:** 2026-05-08  
**Status:** Implemented — ready for deploy

---

## 1. Current Quota Usage (Before)

All YouTube API calls flow through a single path: `fetchChannelSnapLite()` in the daily cron job at `/api/cron/snapshot`. No API calls happen during page browsing — every page reads from KV cache.

| Metric | Value |
|--------|-------|
| API calls per artist | 1 (`channels.list` with `statistics,snippet,contentDetails`) |
| Quota cost per artist | ~6 units |
| Total artists tracked | ~51 (5 hardcoded + ~46 custom) |
| Previous schedule | 1x daily at 8am UTC |
| Previous daily cost | ~306 units/day |
| Daily quota limit | 10,000 units |
| Previous usage | ~3.1% of daily quota |

**Full-mode `fetchChannelSnap()` is NOT used in cron** — it costs ~113+ units/artist (includes `search.list`, `commentThreads.list`) and is only used for on-demand single-artist pages.

---

## 2. Recommended Schedule: Smart Priority-Based (Implemented)

### Priority Tiers

| Priority | Criteria | Frequency | Runs |
|----------|----------|-----------|------|
| **HIGH** | Active campaign OR uploaded in last 14 days | 2x daily | Morning (8am UTC) + Evening (8pm UTC) |
| **MEDIUM** | Healthy/Building/Weak Conversion channels | 1x daily | Morning only |
| **LOW** | Cold/Inactive/No uploads in 90+ days | 3x weekly | Mon/Wed/Fri morning only |

### Expected Distribution (51 artists)

Assuming typical roster: ~5 HIGH (1 campaign + ~4 recent uploaders), ~30 MEDIUM, ~16 LOW.

| | HIGH (5) | MEDIUM (30) | LOW (16) | Total |
|---|----------|-------------|----------|-------|
| Fetches/week | 70 | 210 | 48 | 328 |
| Quota/week | 420 | 1,260 | 288 | 1,968 |
| Quota/day (avg) | 60 | 180 | 41 | 281 |

**Worst-case day (Mon/Wed/Fri):** Morning run fetches all 51 artists (306 units) + Evening run fetches 5 HIGH (30 units) = **336 units/day (3.4%)**.

**Typical day (Tue/Thu/Sat/Sun):** Morning fetches 35 (HIGH+MEDIUM = 210 units) + Evening fetches 5 HIGH (30 units) = **240 units/day (2.4%)**.

### Comparison: 3 Scenarios

| Scenario | Daily Cost | % of Quota | Risk |
|----------|-----------|------------|------|
| A: Current (1x daily, all) | 306 | 3.1% | None — very safe |
| B: Simple 2x daily (all) | 612 | 6.1% | Still safe, wastes quota on cold channels |
| **C: Smart priority (implemented)** | **240–336** | **2.4–3.4%** | **None — fresher data where it matters** |

Smart scheduling actually uses *less* daily quota than the old 1x-all approach on most days, while giving HIGH-priority channels 2x the data freshness.

---

## 3. Implementation Changes

### New Files

| File | Purpose |
|------|---------|
| `src/lib/snapshotScheduler.ts` | Priority classification, run eligibility, quota budget calculator, guardrails |
| `src/app/api/debug/snapshot-schedule/route.ts` | Debug endpoint exposing per-artist schedule, freshness, and quota budget |

### Modified Files

| File | Change |
|------|--------|
| `src/app/api/cron/snapshot/route.ts` | Complete rewrite — smart scheduling with priority classification, quota guardrails, run slot awareness |
| `vercel.json` | Added second cron entry: `0 20 * * *` for evening HIGH-priority run |

### Key Exports from `snapshotScheduler.ts`

- `classifySnapshotPriority(artist, snap, channelState)` → `SnapshotSchedule` with priority, reason, frequency
- `shouldFetchInRun(priority, runSlot, dayOfWeek)` → boolean
- `calculateQuotaBudget(schedules)` → full budget with safety thresholds
- `applyQuotaGuardrails(artists, maxQuota)` → filters artists if budget exceeded

---

## 4. Quota Guardrails

The cron job applies budget caps before fetching:

1. **Pre-run budget check**: Estimates total cost, caps at 40% of daily quota per run (4,000 units)
2. **Priority ordering**: HIGH artists always fetched first, then MEDIUM, then LOW
3. **Graceful degradation**: If budget exceeded, LOW-priority artists are skipped first, then MEDIUM
4. **Mid-run quota detection**: If YouTube returns `quota_exceeded`, remaining artists are skipped (not failed)
5. **Never fail the whole run**: Individual artist failures are caught and logged, never propagate

Every skip is logged with a reason in the cron response JSON.

---

## 5. Zero/Stale Safety Verification

More frequent snapshots do NOT break existing safety guarantees:

| Safety Layer | Status | Why |
|-------------|--------|-----|
| `writeSnapshot()` one-per-day | **Safe** | Uses `todayKey()` (YYYY-MM-DD) — evening run overwrites morning entry for same day |
| `safeMergeSnap()` null protection | **Safe** | Frequency-agnostic — always prevents null from overwriting valid data |
| `deltaOver()` timestamp-based | **Safe** | Uses time-based cutoffs, not index-based — more snapshots = more data points, same deltas |
| Stale-view detection | **Safe** | Compares consecutive view totals — works regardless of how often snapshots are taken |
| Zero-safety runtime guards | **Safe** | `writeSnapshot()` blocks suspicious `views=0` / `subs=0` regardless of frequency |
| KV cache freshness | **Improved** | HIGH-priority artists get fresher KV data (up to 12h old instead of 24h) |

---

## 6. HIGH Priority Channels (Immediate)

Based on current data, these channels should be classified HIGH:

| Artist | Reason |
|--------|--------|
| K-Trap | Active campaign (TRAPO 2, started 2026-03-22) |
| Any artist with uploads in last 14 days | Detected automatically from cached `lastUploadAt` |

The classification is **fully automatic** — no manual tagging needed. When a campaign is activated or an artist uploads, they move to HIGH priority on the next cron run.

---

## 7. Debug Endpoint

`GET /api/debug/snapshot-schedule` returns per-artist:

- `snapshotPriority`: HIGH / MEDIUM / LOW
- `reason`: Why this priority was assigned
- `lastSnapshotAt`: When data was last fetched
- `nextSnapshotDueAt`: When the next fetch is expected
- `snapshotFrequency`: Human-readable schedule
- `estimatedWeeklyQuotaCost`: Quota units per week for this artist
- `dataFreshness`: fresh / stale / no_data
- `channelState`: Derived state (HEALTHY, BUILDING, etc.)
- `wouldFetchMorning` / `wouldFetchEvening`: Whether eligible for today's runs

Plus system-level `quotaBudget` with safety thresholds and breakdown by tier.

---

## 8. Deploy Checklist

1. Deploy code changes (snapshotScheduler.ts, rewritten cron route, debug endpoint)
2. Vercel will pick up the new cron schedule from `vercel.json` (adds 8pm UTC run)
3. Verify first evening run only fetches HIGH-priority artists
4. Check `/api/debug/snapshot-schedule` to confirm priority assignments
5. Monitor quota usage via cron response JSON (`estimatedQuota` field)
