/**
 * Campaign Config — per-campaign metadata for the Coach planner.
 *
 * This is the generalisation layer for Drive asset scanning. Any campaign slug
 * can declare its Drive folder, a seed asset list, milestones, known releases
 * and expected asset types here. Nothing in the asset pipeline is hardcoded to
 * a specific artist — Snuts is simply the first entry.
 *
 * To onboard a campaign:
 *   1. Add an entry keyed by its Coach slug.
 *   2. (optional) Paste scanned Drive files into `seedAssetFiles` so the panel
 *      shows data before the first live scan is pushed to KV.
 *   3. (optional) Declare `expectedAssetTypes` to tune readiness for the
 *      campaign's shape (e.g. a visualiser-led release).
 */

import {
  buildLibrary,
  type AssetLibrary,
  type AssetMappingConfig,
  type DriveAssetClass,
  type RawDriveFile,
} from './driveAssets';
import type { TimelineKind } from './planEngine';

// ── Types ──────────────────────────────────────────────────────────────────

export type CampaignMilestone = {
  /** ISO date (yyyy-mm-dd) if known. */
  dateISO?: string;
  label: string;
  /** Timeline kind — helps infer expected assets. */
  kind?: TimelineKind;
  /** Per-milestone override of expected asset classes. */
  expectedAssetTypes?: DriveAssetClass[];
};

export type CampaignRelease = {
  title: string;
  type: 'single' | 'album' | 'ep' | 'documentary';
  dateISO?: string;
};

export type CampaignConfig = {
  slug: string;
  artist: string;
  driveFolderUrl?: string;
  driveFolderName?: string;
  /** Raw scanned Drive files used to build the seed library (optional). */
  seedAssetFiles?: RawDriveFile[];
  /** Folder ID + scan timestamp metadata for the seed. */
  seedFolderId?: string;
  seedScannedAt?: string;
  campaignMilestones?: CampaignMilestone[];
  knownReleases?: CampaignRelease[];
  /** Campaign-wide expected asset classes (tunes mapping + readiness). */
  expectedAssetTypes?: DriveAssetClass[];
  /** Per-kind expected overrides (advanced tuning). */
  expectedByKind?: Partial<Record<TimelineKind, DriveAssetClass[]>>;
  /** Extra classes treated as valid release anchors (e.g. trailer / live session). */
  anchorAssetTypes?: DriveAssetClass[];
};

// ── Registry ─────────────────────────────────────────────────────────────────

import { SNUTS_CONFIG } from './campaigns/the-snuts';

export const CAMPAIGN_CONFIGS: Record<string, CampaignConfig> = {
  [SNUTS_CONFIG.slug]: SNUTS_CONFIG,
};

// ── Accessors ────────────────────────────────────────────────────────────────

export function getCampaignConfig(slug: string): CampaignConfig | null {
  return CAMPAIGN_CONFIGS[slug] ?? null;
}

/** The mapping/scoring tuning derived from a campaign config. */
export function mappingConfigFor(slug: string): AssetMappingConfig | undefined {
  const cfg = getCampaignConfig(slug);
  if (!cfg) return undefined;
  const knownTitles = cfg.knownReleases?.map((r) => r.title);
  const hasTuning = cfg.expectedAssetTypes || cfg.expectedByKind ||
    cfg.anchorAssetTypes || (knownTitles && knownTitles.length > 0);
  if (!hasTuning) return undefined;
  return {
    expectedAssetTypes: cfg.expectedAssetTypes,
    expectedByKind: cfg.expectedByKind,
    anchorAssetTypes: cfg.anchorAssetTypes,
    knownTitles,
  };
}

/**
 * Build a seed AssetLibrary for a campaign from its declared raw files.
 * Returns null when the campaign has no seed (live KV data should be used).
 * Classification runs through the same buildLibrary() path as the live API.
 */
export function getSeedLibrary(slug: string): AssetLibrary | null {
  const cfg = getCampaignConfig(slug);
  if (!cfg || !cfg.seedAssetFiles || cfg.seedAssetFiles.length === 0) return null;
  return buildLibrary(slug, cfg.driveFolderUrl ?? '', cfg.seedAssetFiles, {
    folderId: cfg.seedFolderId,
    folderName: cfg.driveFolderName,
    scannedAt: cfg.seedScannedAt,
  });
}
