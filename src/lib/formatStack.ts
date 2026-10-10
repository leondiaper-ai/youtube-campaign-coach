/* ═══════════════════════════════════════════════════════════════════════
   FORMAT STACKS — MULTIFORMAT AROUND ONE RECORD

   YouTube's own advice is to give a release more than one way in: the
   video, then a visualiser, then a live version, each a separate surface
   someone can arrive through. Kings of Leon ran it properly on My Whole
   World — video 10 Sep, visualiser 25 Sep, live 8 Oct, each pushed by its
   own Short.

   ── WHY THIS IS NOT computeMultiformat ────────────────────────────────
   That function asks a CHANNEL-level question: did this channel publish
   3+ different formats in 90 days. A channel that drops one official
   video and, separately, a run of unrelated Shorts and a BTS clip scores
   Strong on it without ever having stacked anything.

   This asks the release-level question instead: did any ONE song get more
   than one format built around it. Those are different findings, and the
   second is the one that matches the advice — so it is computed here
   rather than by loosening the other, which would make the existing
   figures mean something new without saying so.

   ── MATCHING ──────────────────────────────────────────────────────────
   Songs are keyed on the title with the artist prefix and the format tag
   removed, so "Kings of Leon - My Whole World (Visualizer)" and
   "Kings of Leon - My Whole World" land on the same key. That is the same
   normalisation the campaign cover uses to tell a follow-up asset from a
   new track, and it has the same limitation: it is title matching, so a
   release whose assets are titled inconsistently will not group.

   Shorts are deliberately NOT a format in the stack. A Short pointing at
   a video is promotion for the record, not another destination for it —
   counting it would score a video-plus-three-Shorts campaign as a stack
   when it is one asset and some trailers. They are counted separately as
   support, because "three formats and nobody told anyone" is also worth
   seeing.
   ═══════════════════════════════════════════════════════════════════════ */

import type { RecentUpload } from './artists';

/** The formats that are a DESTINATION for a record, in billing order. */
export type StackFormat = 'Video' | 'Visualiser' | 'Lyric' | 'Live';

const FORMAT_ORDER: StackFormat[] = ['Video', 'Visualiser', 'Lyric', 'Live'];

export interface FormatStack {
  /** The song, as normalised for matching — used for display too. */
  song: string;
  /** Distinct destination formats found, in billing order. */
  formats: StackFormat[];
  /** Shorts whose title mentions the song. Promotion, not destinations. */
  shorts: number;
  /** ISO date of the most recent asset in the stack. */
  latestAt: string;
  /** ISO date of the first asset, so the build can be dated. */
  firstAt: string;
}

const isShort = (u: RecentUpload) => u.durationSec > 0 && u.durationSec <= 62;

/**
 * Strip the artist prefix and the trailing format tag.
 *
 * The tag list is the same one the cover's cleanAssetTitle uses. "(Live)"
 * is included: a live version is a different asset for the same song, and
 * leaving it attached would key it as a separate record — which is the
 * exact bug that made the Kings of Leon cover announce a three-week-old
 * track as new.
 */
export function songKey(title: string, artistName: string): string {
  const t = (title ?? '').trim();
  const a = (artistName ?? '').trim();
  let out = t;
  if (a) {
    const esc = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = new RegExp(`^${esc}\\s*[-–—:]\\s*(.+)$`, 'i').exec(t);
    if (m) out = m[1].trim();
  }
  out = out
    .replace(/\s*[[(]\s*(official\s+)?(music\s+)?(video|audio|lyric[s]?(\s+video)?|visuali[sz]er|live[^)\]]*)\s*[)\]]\s*$/i, '')
    .trim();
  /* Quotes around a single name are packaging too: ‟Cold Blue Dawn” and
     Cold Blue Dawn are the same record. */
  return out.replace(/^["'“‘]|["'”’]$/g, '').trim();
}

/** Which destination format an upload is, or null if it is not one. */
export function formatOfUpload(u: RecentUpload): StackFormat | null {
  return classifyUpload(u)?.format ?? null;
}

/**
 * The format, and whether the TITLE SAID SO.
 *
 * The difference matters more than it looks. "(Visualizer)", "(Live)" and
 * "(Official Video)" are the artist declaring a format. A bare
 * "Artist - Title" is not — it is the shape of a lead single upload, and
 * also the shape of every catalogue upload ever made.
 *
 * Treating the bare case as a confident 'Video' is what put the Ennio
 * Morricone estate channel on this card: a catalogue upload of The
 * Mission and a live solo-piano recording of the same piece scored as
 * "Video + Live", which is indistinguishable from a campaign to the
 * matcher and nothing like one in life.
 */
function classifyUpload(u: RecentUpload): { format: StackFormat; tagged: boolean } | null {
  if (isShort(u)) return null;
  const t = u.title ?? '';
  if (/\blyric/i.test(t)) return { format: 'Lyric', tagged: true };
  if (/\bvisuali[sz]er\b/i.test(t)) return { format: 'Visualiser', tagged: true };
  if (/[[(]\s*(official\s+)?live\b|\blive\s+(at|from|session)\b/i.test(t)) {
    return { format: 'Live', tagged: true };
  }
  if (/[[(]\s*official\s+(music\s+)?video\s*[)\]]|\bofficial\s+(music\s+)?video\b/i.test(t)) {
    return { format: 'Video', tagged: true };
  }
  /* Untagged long-form. Counted as the release's main video, because that
     is usually what it is — but it cannot carry a stack on its own. */
  return { format: 'Video', tagged: false };
}

/**
 * The deepest format stack on a channel in the window.
 *
 * Returns null when nothing has two destination formats — a stack of one
 * is just a release, and the whole point is to spot the ones that are
 * more than that.
 */
export function bestFormatStack(
  uploads: RecentUpload[],
  artistName: string,
  windowDays = 120,
): FormatStack | null {
  const cutoff = Date.now() - windowDays * 86_400_000;
  const recent = uploads.filter((u) => {
    const t = new Date(u.publishedAt).getTime();
    return Number.isFinite(t) && t >= cutoff;
  });
  if (recent.length === 0) return null;

  type Acc = {
    song: string;
    formats: Set<StackFormat>;
    /** Formats the title explicitly declared. See classifyUpload. */
    tagged: Set<StackFormat>;
    shorts: number;
    latestAt: string;
    firstAt: string;
  };
  const byKey = new Map<string, Acc>();

  for (const u of recent) {
    const cls = classifyUpload(u);
    if (!cls) continue;
    const fmt = cls.format;
    const key = songKey(u.title, artistName).toLowerCase();
    /* A key of one or two characters is a title we failed to parse, not a
       song. Grouping on it would merge unrelated uploads. */
    if (key.length < 3) continue;
    const acc = byKey.get(key) ?? {
      song: songKey(u.title, artistName),
      formats: new Set<StackFormat>(),
      tagged: new Set<StackFormat>(),
      shorts: 0,
      latestAt: u.publishedAt,
      firstAt: u.publishedAt,
    };
    acc.formats.add(fmt);
    if (cls.tagged) acc.tagged.add(fmt);
    if (u.publishedAt > acc.latestAt) acc.latestAt = u.publishedAt;
    if (u.publishedAt < acc.firstAt) acc.firstAt = u.publishedAt;
    byKey.set(key, acc);
  }

  /* Shorts are attributed by name rather than by key, because a Short is
     captioned in prose — "My Whole World is out everywhere" — and will
     almost never normalise to the song key. */
  for (const u of recent) {
    if (!isShort(u)) continue;
    const t = (u.title ?? '').toLowerCase();
    for (const [key, acc] of Array.from(byKey.entries())) {
      if (t.includes(key)) { acc.shorts += 1; break; }
    }
  }

  /* ── WHAT COUNTS AS A STACK ───────────────────────────────────────
     Two formats, and then evidence that this is a release being worked
     rather than two catalogue uploads of the same song:

       two DECLARED formats          the artist labelled both, or
       one declared format + Shorts  they labelled one and promoted it.

     A stack resting on an untagged upload with no Shorts behind it is
     the catalogue case, and it is the one that has to be excluded —
     without this rule the Morricone estate channel outranks Ezra
     Collective on a card about campaign strategy.

     Checked against the live board: this keeps Kings of Leon (2 declared
     + 5 Shorts), Lukas Graham (3 declared), Ezra Collective (2 declared)
     and mary in the junkyard (2 declared + 7 Shorts), and drops only
     Morricone (1 declared, 0 Shorts). The Shorts clause earns its place
     on the other side — it is what would keep a real campaign whose lead
     upload is untagged, which is how a lead single is usually titled. */
  const stacks = Array.from(byKey.values())
    .filter((a) => a.formats.size >= 2 && (a.tagged.size >= 2 || a.shorts >= 1))
    .map((a) => ({
      song: a.song,
      formats: FORMAT_ORDER.filter((f) => a.formats.has(f)),
      shorts: a.shorts,
      latestAt: a.latestAt,
      firstAt: a.firstAt,
    }));
  if (stacks.length === 0) return null;

  /* Deepest first; the most recently extended wins a tie, because a stack
     still being built is the live example and an old one is history. */
  stacks.sort((x, y) =>
    y.formats.length - x.formats.length || y.latestAt.localeCompare(x.latestAt));
  return stacks[0];
}
