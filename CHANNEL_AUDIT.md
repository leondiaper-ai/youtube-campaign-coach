# Channel Audit

Channel audit opens a native modal from expanded Channel Health rows, artist action bars and the label Behaviour header. Copy full audit, copy short brief and download text provide reusable outputs. Existing Channel report remains the quick copy action.

`/api/channel-audit/[slug]` accepts only a tracked artist slug and reads existing channel snapshots, history and cached country data. It does not fetch vendors or trigger catalogue sweeps. The public route follows the existing Watcher read-only data model.

The deterministic `channelAudit.ts` model separates whole-channel movement from sampled lifetime upload performance. It excludes external collaborations, future releases and duplicate IDs. Support formats require three examples; median lifetime views are explicitly not age-adjusted. Song-level gaps use the existing song-key matcher and require full-channel checking before commissioning. Caption checks use an explicit false caption flag on long-form uploads in the last 90 days, with unknowns excluded.

Historical reference points come from the existing reviewed deep-dive registry and retain capture dates and a link to the deck. No upcoming album is assumed. This first version does not compute a matched past-vs-current campaign comparison: that requires confirmed campaign/release dates and historical age-matched readings. Missing structured deck references show a full-deck link only.

Tests: `node scripts/test-channel-audit.cjs`, `node scripts/test-label-workspaces.cjs`, TypeScript and Next build. No invented uplift, incremental impact, Studio-only metrics or whole-channel inventory completeness claims.
