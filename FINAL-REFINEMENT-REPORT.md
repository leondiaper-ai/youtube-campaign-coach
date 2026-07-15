# Final Refinement Report — UX + Clarity + Trust Polish

## Final Wording Decisions

### Standardised Label System

| State | Label | Where used |
|-------|-------|-----------|
| Live 7d data | "Views (7d)" / "Subs (7d)" | Watcher, ChannelHealth table |
| Recent snapshot (≤7d) | "Views (recent)" / "Subs (recent)" | Watcher, ChannelHealth |
| Campaign period | "Campaign views" / "Campaign subs" | Watcher, CampaignStatus |
| Upload activity (no totals) | "Content activity" | Watcher, normalizeChannelData |
| Last confirmed (≤14d) | "Views (last confirmed)" | Watcher |
| Historical (>14d) | "Views (historical)" | Watcher |
| No data available | "Movement" + "Awaiting data" | All surfaces |

### "Activity signal" → "Content activity"

Renamed everywhere. Rationale: "Activity signal" sounds like a diagnostic output — technical, tentative. "Content activity" communicates the same thing in operational language: "uploads are happening." It feels like a status, not a fallback.

### Stale / Delayed Language

**Eliminated:**
- "No data" → "Awaiting data" or "—"
- "Offline" → "Updating"
- "Totals delayed" → "Totals updating"
- "Channel totals delayed" → "Totals updating"
- "Insufficient snapshot history" → "Building snapshot history"
- "Channel could not be reached" → "Channel updating"
- "API unavailable" → removed entirely
- "Waiting for fresh YouTube totals" → "Totals updating"
- "Movement data updating" → "Totals updating"
- "Insufficient recent activity" → "Building data — score will appear soon"

**Principle:** Every stale/delayed state now reads as a process in motion ("updating", "building") rather than a broken state ("insufficient", "unavailable", "failed").

---

## Final Confidence Language System

| Confidence | User sees | Tone |
|------------|-----------|------|
| high | Full-opacity numbers, no badge | Confident |
| medium | Full-opacity numbers, subtle "Partial history" badge | Mostly confident |
| limited | Muted opacity (45%), "Building history" badge | Calm, acknowledge gap |
| stale | "—" or muted LKG numbers, "Totals updating" badge | Calm, process-oriented |

---

## Final Stale/Delayed UX Rules

1. **Never show "+0" for stale data** — show "—" instead
2. **Never use alarm language** for data gaps — "updating" and "building" always, never "failed" or "unavailable"
3. **Muted opacity (45%)** for any non-live numeric value — the number is still visible but the softened color subconsciously communicates "this is not current"
4. **Source label always visible** — if showing non-live data, the metric tile's label says what it is ("Views (recent)", "Content activity"), not generic "Views (7d)"
5. **Explanation line at 10px italic, 35% opacity** — present but not demanding attention. Shows source context on hover for technical users.
6. **Active campaigns always feel alive** — if uploads exist + campaign active, the card's language is "Campaign active — totals updating" not "Waiting for data"

---

## Score Presentation Adjustments

- "Insufficient data" pillar labels → "Building" — shorter, calmer, non-technical
- Scoring explainer text updated to match ("◻️ Building" in the legend)
- Score badges remain compact (letter grade + mini color) — they annotate, never dominate the row
- When confidence is limited, the scoring system returns "Building data — score will appear soon" rather than implying something is wrong
- Campaign active + cadence → minimum C grade (never looks dead)

---

## Top Movers Safeguards

Already in place from Best Available Snapshot work, confirmed correct:
- `canRank(r)` helper checks `bestAvailableShouldUseInTopMovers !== false`
- `campaign_period` data (`shouldUseInTopMovers: false`) never enters rankings
- `recent_uploads` data (`shouldUseInTopMovers: false`) never enters rankings
- `last_confirmed` data only enters rankings if ≤14d old
- `none` never enters rankings
- Weekly insights filter by `movementConfidence !== 'stale'`
- Biggest decline filter requires `confidence !== 'LOW'` AND `dataStatus !== 'STALE'` AND `viewDataFreshness !== 'stale'`

**Result:** Only live_7d and recent_snapshot data can appear in Top Movers. All other sources are structurally excluded.

---

## Structural Findings UX

- 3-state lifecycle (`active` → `pending_refresh` → `resolved`) prevents findings from flashing on/off during brief API gaps
- `findingConfidence` field (`high` / `medium` / `low`) allows UI to weight how prominently a finding appears — re-confirmed findings are more prominent
- Duplicate prevention is handled by the detection logic (structural gaps are keyed by type, so "missing lyric video" appears once, not once per video)
- Resolution is clean: findings move to `resolved` only after re-confirmation shows the gap no longer exists, then disappear from display

---

## First-Time User Audit

**As a label manager opening Channel Health cold:**
- ✅ Instantly see classification summary (4 Growing, 2 Weak Conversion, etc.)
- ✅ "What Changed This Week" strip gives immediate operational context
- ✅ Status column immediately tells me who needs attention
- ✅ Score badge is small enough to not overwhelm but present enough to notice
- ⚠️ "Totals updating" badge is calm enough — won't alarm. Might confuse first time (what totals?), but hover explains.
- ✅ Muted numbers clearly read as "not current" without needing to read any label

**As a Virgin exec opening Campaign Status Board:**
- ✅ Section headers (Active / Building / At Risk / Dormant) immediately answer "what needs attention?"
- ✅ Campaign cards show "Campaign active — totals updating" during stalls — feels operational, not broken
- ✅ Impact stats (subs gained, content views since launch) are always available even when weekly totals stall
- ⚠️ No campaign? → Card shows "Awaiting data" — calm but might prompt "why is this here?" for newly pinned artists. Acceptable — the pin was intentional.

**As an artist manager opening a Watcher page:**
- ✅ Metric tiles immediately show the best available signal with clear source labels
- ✅ Campaign section shows cumulative progress even when weekly API stalls
- ✅ "Content activity" fallback clearly communicates "channel is alive" without false precision
- ✅ Fix Now section only appears when there's actually something to fix — no noise
- ✅ Muted colors for non-live data don't look broken, just softer

**Where trust could still break:**
1. If a channel goes from live_7d to `none` (complete data gap), the sudden appearance of "—" across all tiles might feel like a system failure. Mitigation: the explanation line says "Totals updating — movement data will refresh shortly."
2. Long-running API stalls (>14 days) push data past all age limits. The UI correctly shows historical context only, but a user might wonder why "old" data is showing at all. This is intentional — context > silence.

---

## Remaining Trust Risks

1. **Multi-week API stalls** — if YouTube's public API stalls for 2+ weeks (rare but possible), all channels fall to `none` and the board becomes mostly "—". Mitigation: the language stays calm ("Building" / "Updating") and cadence/campaign signals keep active artists feeling alive. True fix: YouTube Analytics API (requires OAuth).

2. **First-day channel** — newly added artists show "Building history" everywhere. This is correct but the user sees mostly empty tiles. Mitigation: cadence and upload data appear immediately; movement builds over 3-7 days.

3. **Campaign pinned without uploads** — a campaign card showing "Totals updating" with 0 uploads looks odd. But this is a real operational signal: "you said this is a campaign but nothing has shipped." The system correctly surfaces this as a FIX signal.

---

## What Should NOT Be Touched Anymore

1. **Best Available Snapshot architecture** — the 6-tier priority ladder, age limits, and usage flags are correct. Don't add tiers or change the priority order.
2. **normalizeChannelData()** — the single source of truth. Don't create parallel calculation paths.
3. **Scoring system** — the A/B/C/D grades with operational overrides are tuned. Don't change thresholds.
4. **Top Movers safeguards** — the canRank() + shouldUseInTopMovers architecture prevents noise. Don't bypass.
5. **Structural findings 3-state lifecycle** — prevents flicker. Don't simplify back to binary.
6. **Muted opacity convention** — 45% for stale, 100% for live. Consistent everywhere. Don't add more opacity levels.
7. **The overall page architecture** — Channel Health → Campaigns → Watcher → Coach flow is correct. Don't reorganise.

The system is now: simple on the surface, smart underneath.
