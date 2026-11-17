# Channel Audit

Channel audit opens a native modal from expanded Channel Health rows, artist action bars and the label Behaviour header. Copy full audit, copy short brief and download text provide reusable outputs. Existing Channel report remains the quick copy action.

`/api/channel-audit/[slug]` accepts only a tracked artist slug and reads existing channel snapshots, history and cached country data. It does not fetch vendors or trigger catalogue sweeps. The public route follows the existing Watcher read-only data model.

The deterministic `channelAudit.ts` model separates whole-channel movement from sampled lifetime upload performance. It excludes external collaborations, future releases and duplicate IDs. Support formats require three examples; median lifetime views are explicitly not age-adjusted. Song-level gaps use the existing song-key matcher and require full-channel checking before commissioning. Caption checks use an explicit false caption flag on long-form uploads in the last 90 days, with unknowns excluded.

Historical reference points come from the existing reviewed deep-dive registry and retain capture dates and a link to the deck. No upcoming album is assumed. This first version does not compute a matched past-vs-current campaign comparison: that requires confirmed campaign/release dates and historical age-matched readings. Missing structured deck references show a full-deck link only.

Tests: `node scripts/test-channel-audit.cjs`, `node scripts/test-label-workspaces.cjs`, TypeScript and Next build. No invented uplift, incremental impact, Studio-only metrics or whole-channel inventory completeness claims.

## Catalogue and visual update

GET remains cache-only. Same-origin POST scans the known channel's uploads playlist in saved batches of at most ten pages (about 500 IDs / 20 YouTube quota units plus initial channel lookup). Each hydrated page is saved separately; a failure preserves the last page token and does not label a partial result complete. Complete collections are reused for seven days and retained for thirty. No cron or existing Watcher inventory is changed.

The visual read adds format totals/counts/medians, lifetime Shorts/long-form upload sums, and thirteen calendar weeks of publishing. Unknown pre-sample weeks are marked partial; the current week is incomplete. “Repeat evidence” means at least three observed examples, not proven causal uplift or age-matched performance. Video descriptions are truncated for format classification; the audit does not claim to check CTA presence.

PNG is rendered locally on a 1600×1000 canvas, with source dates, coverage and a QR link to the channel page. It uses no external image service. PNG cannot embed clickable links; copied text preserves those. QR generation is dynamically loaded on export.

Artist actions are reduced to text navigation, Follow, the audit button and a More menu. Caption checks offer a copyable review task and Studio link, not fabricated subtitle text. Removed unsupported caption reach percentages from the existing missed-reach copy.

Checks: test-channel-audit.cjs, test-channel-audit-catalogue.cjs, test-label-workspaces.cjs, TypeScript and Next build.

## Complete catalogue by default

Opening Channel Audit now calls the collector when the playlist cache is absent, partial or seven days old. This is still user-triggered, not cron work. The GET route remains cache-only. Incomplete recent samples no longer show final visual verdicts or allow audit exports while collection runs; progress and retry controls are shown instead. Complete caches remove the redundant check-cache button.

The format inventory now includes audio, documentaries, interviews and tour uploads, ensuring every classified upload appears in exactly one row. Empty secondary categories stay out of the main cards. Bracketed “Live for…” / “Live on…” titles are recognised. PNG row spacing adapts to the number of displayed formats.

Live validation: IDLES playlist returned 372 IDs / 371 published uploads, reaching 2011, and revealed 37 official-video-labelled uploads that were absent from the latest 100-upload sample. No artist metadata, campaign pins or daily sync were changed.

## Linked artist-channel uploads

The uploads playlist can return linked videos whose original uploader channel ID differs from the current artist channel. The collector now retains every video explicitly requested from that playlist, recording uploaderChannelId for provenance, rather than dropping those linked uploads. It does not discover arbitrary third-party videos. Old completed caches lacking includesLinkedUploads are marked incomplete by the audit API and automatically recollected on next use. This repaired Tom Odell's missing legacy uploads, including Another Love, found during the cross-channel QA.


## Quick channel intel (17 November 2026)

The existing Channel audit modal now opens on a concise evidence-led read. The existing Channel report stays a separate short movement report; no extra row of launch buttons is added. Full format analysis, caption/asset checks, manual format review, market data and historical deck references remain below the quick read.

`channelAuditIntel.ts` derives a six-month cohort and monthly timeline from the classified uploads. It includes release audio found in that inventory; it never equates an artist-video gap with no music releases. It chooses a read from the actual pattern: sparse output with a response, release-led output, bursts, sustained output, Shorts-heavy publishing with long-form viewing, concentration, or early observed output. Named uploads with views, reported likes/comments and dates support the read. Actions refer to those uploads and observed formats; a DJ identity is suggested only with explicit DJ/mix evidence. Saved campaign/next-moment metadata is used only when present; no album is invented.

Guardrails:
- Partial, stale or materially unreconciled inventories receive a coverage read instead of a whole-channel inactivity claim. A completed uploads playlist does not verify the entire Releases/Topic catalogue or third-party appearances. The discrepancy check is a review heuristic, not a diagnosis of the difference.
- The window ends at the latest usable upload reading. Full-week cadence excludes partial boundary weeks. First and last calendar months are partial. Older proof uploads are labelled when the six-month cohort is empty.
- `mergeAuditUploads` combines the weekly scan with newer cached recent/top uploads, deduplicating by ID and preferring the newer source reading. Metadata provenance is retained. GET still adds zero YouTube/vendor API calls; no cron, artist-roster or access changes.
- Collection now preserves whether likes/comments were actually reported. Legacy zeroes are unknown, not fabricated measured zeroes. A weighted interaction rate uses only uploads with both available counters and positive views, showing the video/view denominator. Positive legacy counts are usable. Counts do not imply sentiment, loyalty, unique engaged fans or subscriber attribution. A views/subscriber ratio is not used as conversion.
- The same model drives the modal, Copy quick intel, the text audit and a compact local PNG. Full-audit PNG remains available. The PNG preserves date/scope and QR/source links; clickable links remain in copied text.

Verification: `node scripts/test-channel-audit-intel.cjs` exercises different channel patterns, release-audio inclusion, freshness/coverage gates, missing counters, early channels, saved corrections, exclusions/deduplication, cache merge ordering, copy output and server-rendered UI. Existing audit, catalogue and label tests, TypeScript and production build also pass.


Live QA refinement: an all-Shorts recent inventory now asks for a relevant full-length destination rather than automatically prescribing more Shorts. Title-based song-family matching proposes a named destination only when one exists; otherwise it asks for a match check. Sparse inventories explaining less than half the channel counter trigger a coverage check, including Interplanetary Criminal's linked/Topic gap. Positive observations in larger samples stay usable with an explicit coverage warning; unknown coverage does not become an inactivity verdict. Explicit #visualiser / #lyricvideo metadata can classify an otherwise unlabelled long-form upload without using promotional links in the description.
