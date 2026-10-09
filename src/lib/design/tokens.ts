/* ═══════════════════════════════════════════════════════════════════════
   VMG YOUTUBE — DESIGN TOKENS

   One source of truth for colour. Before this existed, 49 files declared
   their own palette: #0E0E0E went by INK in thirty of them, #E8E3DA was
   BORDER in four and BONE in seven, and a dozen near-misses (#0A0A0A,
   #1A1D23, #E7E2D8, #E6E1D8) had drifted in behind them. Nothing here is
   a new colour — it is the set that was already in tailwind.config.ts and
   globals.css, named once so the rest can stop guessing.

   WHY BOTH THIS FILE AND THE TAILWIND THEME
   Roughly half the codebase styles with inline style objects and half
   with Tailwind classes, often in the same element. Tailwind classes
   cannot be used inside an inline style object or an SVG `fill`, so the
   same values have to be reachable both ways. These constants and the
   theme in tailwind.config.ts are deliberately kept in step; change one,
   change the other.

   USING IT
   Prefer the Tailwind classes (`text-ink`, `bg-surface`, `border-line`)
   in new work. Reach for these constants only where a class cannot go:
   chart fills, dynamic colour, and the inline-styled components that have
   not been migrated yet.
   ═══════════════════════════════════════════════════════════════════════ */

export const color = {
  /* ── Surfaces ──────────────────────────────────────────────────────
     Three levels, warm. `page` is the app background, `surface` is a
     card or table sitting on it, `raised` is a panel inside a card.
     The brief asked for depth without decoration: that comes from this
     separation plus a hairline, never from a shadow. */
  page: '#FAF7F2',
  surface: '#FFFFFF',
  raised: '#F6F1E7',
  sunken: '#F1ECE3',

  /* ── Lines ─────────────────────────────────────────────────────────
     `line` is the standard hairline. `lineStrong` is for a divider that
     has to carry hierarchy — a table header rule, a section break. */
  line: '#E8E3DA',
  lineStrong: '#D9D2C6',
  lineFaint: '#F0EBE2',

  /* ── Text ──────────────────────────────────────────────────────────
     Four steps, and no more. The old interface had secondary text at
     seven different greys between #5A5650 and #D1C9BD, which is why
     everything read as the same weight. `muted` is the floor for any
     text that has to be read; `faint` is for decoration only and must
     never carry information on its own. */
  ink: '#0E0E0E',
  inkSecondary: '#55504A',
  inkMuted: '#7D776E',
  inkFaint: '#A8A199',

  /* ── Brand ─────────────────────────────────────────────────────────
     `signal` is the VMG/YouTube accent and is rationed: navigation
     active state, one call to action per view, and nothing else. */
  signal: '#FF4A1C',
  signalSoft: '#FFEDE7',
  electric: '#2C25FF',

  /* ── Performance ───────────────────────────────────────────────────
     Reserved strictly for meaning. Green is not decoration here: if a
     number is green it went up, and if it is red it went down. */
  positive: '#0C6A3F',
  positiveSoft: '#E6F2EB',
  negative: '#A32915',
  negativeSoft: '#FBEAE6',
  warn: '#9A6324',
  warnSoft: '#FAF0E2',
  neutral: '#7D776E',

  /* ── Format ────────────────────────────────────────────────────────
     Long-form against Shorts, used identically on every surface that
     splits the two so the pairing is learnable. */
  longform: '#2C6BFF',
  shorts: '#C77A16',
} as const;

/* ── Health classification ───────────────────────────────────────────
   The four states the Watcher sorts on. Colour carries the same meaning
   on the KPI row, the status badge and the table, so a reader only has
   to learn it once. Classification logic is untouched — this is purely
   how each state is painted. */
export const health = {
  GROWING: { fg: color.positive, bg: color.positiveSoft, label: 'Growing' },
  WEAK: { fg: color.warn, bg: color.warnSoft, label: 'Weak conversion' },
  UNDERFED: { fg: '#8A5A00', bg: '#FBF2DF', label: 'Underfed' },
  COLD: { fg: color.negative, bg: color.negativeSoft, label: 'Cold' },
} as const;

/* ── Spacing ─────────────────────────────────────────────────────────
   A 4px base. Section rhythm is the thing most worth holding: `section`
   between major blocks, `block` inside them. */
export const space = {
  section: 56,
  block: 28,
  tight: 12,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
} as const;

/* ── Legacy aliases ──────────────────────────────────────────────────
   The names the old per-file constants used, so a component can switch
   to the shared set in one import line without touching its markup.
   New code should use `color` above. */
export const INK = color.ink;
export const PAPER = color.page;
export const SOFT = color.raised;
export const BONE = color.line;
export const BORDER = color.line;
export const MUTED = color.line;
export const SMOKE = color.inkMuted;
export const GHOST = color.inkFaint;
export const WHITE = color.surface;
export const SIGNAL = color.signal;
export const GAIN = color.positive;
export const LOSS = color.negative;
