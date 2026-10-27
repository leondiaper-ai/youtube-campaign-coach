# Label Watcher views

First label: Partisan Records, `/labels/partisan`.

`src/lib/labels.ts` is the label registry: branding, source URL and explicit
current roster. The official logo is hosted locally under public/labels/partisan.
The roster was checked against https://partisanrecords.com/artists/ on 27 Oct 2026;
alumni are excluded. Matching uses normalised artist names, with explicit
label-workspace membership also supported. Channels are deduplicated by handle.

Label workspaces reuse the main Channel Health renderer and cached YouTube
observations. No new YouTube collection is triggered by opening the page.
Artists absent from the existing registry are not represented as monitored.
The dashboard states coverage. Adding a label does not register it as a
geographical market or add it to Workspaces.

The existing workspace query contract is reused internally with a namespaced
id (`label-partisan`). Campaign pins and saved plans use that id, preserving
UK and regional records. Label pins do not overwrite shared artist campaign
start dates or UK baselines. Revenue ownership is never changed to populate
a label roster; the board displays the full label cohort independently.

Navigation contains Channel Health, Active Campaigns and Coach only. Branding
and workspace context follow artist details and campaign/planner links.

Tests: node scripts/test-label-workspaces.cjs, node scripts/test-owned-channels.cjs,
npx tsc --noEmit, npm run build.
