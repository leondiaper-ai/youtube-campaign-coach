// ─────────────────────────────────────────────────────────────────────────────
// YouTube data layer — public API
//
// Import from '@/lib/youtube' to get the normalized data types and functions.
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Core function
  normalizeChannelData,

  // Safe merge
  safeMergeSnap,

  // Bridge helpers (for gradual migration)
  toGrowthInput,
  rawDelta,
  rawDeltaOrZero,

  // Week-on-week
  computeWoW,

  // Centralized thresholds
  THRESHOLDS,

  // Types
  type NormalizedChannel,
  type DeltaResult,
  type CadenceMetrics,
  type CampaignContext,
  type CampaignMetrics,
  type DataHealth,
  type DataConfidence,
  type WoWResult,
} from './normalizeChannelData';
