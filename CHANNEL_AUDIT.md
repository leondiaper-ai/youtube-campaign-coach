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
