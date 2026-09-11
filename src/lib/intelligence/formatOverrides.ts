/**
 * HUMAN FORMAT OVERRIDES
 *
 * The public API can see duration and liveStreamingDetails. It cannot see
 * intent. A 42-second vertical upload and a 42-second vertical campaign
 * trailer are the same object to `videos.list`, so `formatOf()` calls both
 * of them a Short — correctly, on the evidence it has.
 *
 * When a person who knows what the asset is says otherwise, that is better
 * evidence than duration, and it belongs in the record rather than in a
 * one-off patch at the render layer. Each entry names who said so, so the
 * label on a campaign asset in front of YouTube can always be traced to a
 * person rather than to a guess.
 *
 * Note what an override does NOT change: the shape the deck renders. That is
 * driven by the observed aspect of the upload, because a vertical trailer is
 * still vertical and cropping it into a 16:9 frame would reintroduce the
 * pillarbox this deck already went to some trouble to remove.
 */

export interface FormatOverride {
  kind: string;
  label: string;
  /**
   * How the deck should FRAME it, when that differs from how it was shot.
   *
   * A vertical trailer shown in a vertical frame reads as a Short whatever
   * the caption says, because shape communicates format faster than type
   * does. Setting this to 'landscape' asks the deck to take a landscape
   * crop out of the vertical source rather than letterbox it — see the
   * `src-portrait` rule in the deck's CSS for why that is not the same as
   * just changing the aspect ratio.
   */
  frame?: 'landscape' | 'portrait';
  statedBy: string;
  statedAt: string;
  note: string;
}

export const HUMAN_FORMAT_OVERRIDES: Record<string, FormatOverride> = {
  /* "Now, we can start." — 9 Sep 2026. Reads as a Short on duration alone. */
  KCm7pn_lza8: {
    kind: 'trailer',
    label: 'TRAILER',
    frame: 'landscape',
    statedBy: 'Leon',
    statedAt: '2026-09-11',
    note: 'Campaign trailer, not a Short. Vertical and under 62s, so the API cannot tell the difference — '
      + 'and shown in a vertical frame it reads as a Short however it is labelled.',
  },
};

export function overrideFor(videoId: string): FormatOverride | null {
  return HUMAN_FORMAT_OVERRIDES[videoId] ?? null;
}
