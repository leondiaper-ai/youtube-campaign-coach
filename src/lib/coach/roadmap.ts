import type { RecentUpload } from "../artists";
import type { GeneratedPlan } from "../planEngine";
import type { AssetLibrary } from "../driveAssets";
import type { ChannelAudit } from "../channelAudit";
import type { DeepDiveContext } from "../intelligence/types";
import {
  classifyUploadFormat,
  getFormatMeta,
  type UploadFormat,
} from "../formatClassifier";
import { songKey } from "../formatStack";

export type Decision = {
  status: "suggested" | "planned" | "ready" | "done" | "dismissed";
  targetDate?: string;
};
export type Decisions = Record<string, Decision>;
export type RoadmapAction = {
  id: string;
  format: string;
  label: string;
  date: string;
  reason: string;
  basis: string;
  video?: { id: string; title: string; date: string };
  scheduled?: boolean;
  available?: { name: string; href?: string };
};
export type TrackRoadmap = {
  id: string;
  name: string;
  releaseDate: string;
  actions: RoadmapAction[];
};
export type CoachSummary = {
  status?: import("./status").CoachStatus;
  lastUploadAt?: string;
  audit: Pick<ChannelAudit, "catalogue" | "coverage" | "dataAt"> & {
    visuals: Pick<ChannelAudit["visuals"], "takeaway">;
  };
  dive: Pick<DeepDiveContext, "dataCapturedAt" | "deckUrl"> | null;
  artistSlug: string;
};
export type CoachEvidence = {
  fanResponse?: import("../intelligence/fanResponse").FanResponse | null;
  audit: ChannelAudit;
  dive: DeepDiveContext | null;
  artistSlug: string;
  uploads: RecentUpload[];
};
const DAY = 86400000;
const key = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "");
export function trackMention(text: string, name: string): boolean {
  const words = name.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return (
    words.length > 0 &&
    new RegExp("\\b" + words.join("[^a-z0-9]+") + "\\b", "i").test(text)
  );
}
const addDays = (iso: string, n: number) =>
  new Date(Date.parse(iso + "T12:00:00Z") + n * DAY).toISOString().slice(0, 10);

/** Timeline descriptions are not YouTube titles. Extract identity before matching. */
export function trackName(title: string): string {
  return title
    .split(/\s+[–—-]\s+/)[0]
    .trim()
    .replace(/^["'“‘]|["'”’]$/g, "");
}
export function uploadTrack(title: string, artist: string): string {
  let out = songKey(title, artist);
  // Remove repeated trailing format tags (some distributor titles contain two).
  for (let i = 0; i < 4; i++)
    out = out
      .replace(
        /\s*[[(](?:official\s+)?(?:music\s+)?(?:video|lyric(?:s|\s+video)?|visuali[sz]er|audio|live[^)\]]*|acoustic[^)\]]*|behind the scenes|bts)[)\]]\s*$/i,
        "",
      )
      .trim();
  return key(out);
}
const tags: Partial<Record<UploadFormat, string[]>> = {
  lyric: ["lyric_video"],
  live: ["archive_live", "live_performance"],
  acoustic: ["acoustic"],
  bts: ["bts_process"],
  visualiser: ["visualiser"],
};

/** Pure derivation: re-run against the newest cache, never mutate agreed dates. */
export function buildRoadmap(
  plan: GeneratedPlan,
  evidence: CoachEvidence,
  now = Date.now(),
  library?: AssetLibrary | null,
): TrackRoadmap[] {
  const inventory = Array.from(
    new Map(
      evidence.uploads
        .filter(
          (u) =>
            !u.isCollab &&
            u.live !== "upcoming" &&
            Date.parse(u.publishedAt) <= now,
        )
        .map((u) => [u.id, u]),
    ).values(),
  );
  const repeat = evidence.audit.visuals.formats
    .filter(
      (f) =>
        ["lyric", "visualiser", "live", "acoustic", "bts"].includes(f.key) &&
        f.count >= 3 &&
        f.median > 0,
    )
    .sort((a, b) => b.median - a.median);
  const points = evidence.dive
    ? [
        ...evidence.dive.channelStrengths,
        ...evidence.dive.recommendedContentDirections,
      ]
    : [];
  return plan.events
    .filter(
      (e) =>
        e.kind === "singleRelease" ||
        (/\bsingle\b/i.test(e.title) && /release|\bout\b|drop/i.test(e.title)),
    )
    .map((event) => {
      const name = trackName(event.title),
        identity = key(name);
      const family = inventory.filter(
        (u) =>
          identity.length >= 3 &&
          (uploadTrack(u.title, plan.artist) === identity ||
            (classifyUploadFormat({ ...u, description: "" }) === "short" &&
              trackMention(u.title, name))) &&
          Math.abs(Date.parse(u.publishedAt) - Date.parse(event.dateISO)) <=
            120 * DAY,
      );
      const classified = family.map((u) => ({
        u,
        f: classifyUploadFormat({ ...u, description: "" }),
      }));
      const trackId = identity + ":" + event.dateISO;
      const actions: RoadmapAction[] = [];
      const push = (
        format: string,
        label: string,
        date: string,
        reason: string,
        basis: string,
        item?: RecentUpload,
        scheduled = false,
      ) => {
        actions.push({
          id: trackId + ":" + format,
          format,
          label,
          date,
          reason,
          basis,
          ...(item
            ? {
                video: {
                  id: item.id,
                  title: item.title,
                  date: item.publishedAt.slice(0, 10),
                },
              }
            : {}),
          scheduled,
        });
      };
      const destinations = classified.filter((x) => x.f !== "short");
      destinations.forEach(({ u, f }) =>
        push(
          f + ":" + u.id,
          getFormatMeta(f).label,
          u.publishedAt.slice(0, 10),
          u.title,
          "Matched song title and campaign window; check versions if this looks wrong.",
          u,
        ),
      );
      const linked =
        event.videoId && !family.some((u) => u.id === event.videoId);
      if (linked)
        push(
          "linked",
          "Linked release video — check visibility",
          event.dateISO,
          "The team linked this video. Publication is not confirmed in the current channel reading.",
          "Team-linked video; not counted as published.",
          {
            id: event.videoId!,
            title: name,
            publishedAt: event.dateISO,
          } as RecentUpload,
          true,
        );
      const visualDestination = classified.some((x) =>
        ["omv", "lyric", "visualiser", "live", "acoustic"].includes(x.f),
      );
      if (!visualDestination && !linked) {
        const lyric = repeat.find((f) => f.key === "lyric");
        const historicLyric = points.find((p) =>
          p.needTags.includes("lyric_video"),
        );
        push(
          "hero",
          "Confirm the main release video",
          event.dateISO,
          lyric
            ? `Lyric videos have ${lyric.count} examples in this channel reading (${Math.round(lyric.median).toLocaleString("en-GB")} median lifetime views). Confirm the creative and production plan.`
            : historicLyric
              ? historicLyric.point
              : "Choose the main visual destination with the team; an official video, performance, lyric video or visualiser can anchor a release.",
          lyric
            ? "Channel audit; upload ages differ. This does not establish the best format."
            : historicLyric
              ? `Deep dive · ${evidence.dive?.dataCapturedAt ?? "date unavailable"} · ${historicLyric.basis}`
              : "YouTube release strategy; no channel format winner established.",
        );
      }
      // Recommend ONE evidence-supported follow-up, rather than six generic assets.
      const preferredLive = points.some(p=>p.needTags.includes("archive_live")&&p.needTags.includes("follow_up_7_14"));
      const ranked = preferredLive ? [...repeat.filter(f=>f.key==="live"),...repeat.filter(f=>f.key!=="live")] : repeat;
      const candidate = ranked.find(
        (f) => !classified.some((x) => x.f === f.key),
      );
      if (candidate) {
        const example = candidate.examples[0];
        const tour = plan.events.find(
          (e) =>
            ["tourDate", "liveShow", "festival"].includes(e.kind) &&
            e.dateISO >= event.dateISO &&
            e.dateISO <= addDays(event.dateISO, 28),
        );
        const anchorDate = destinations.filter(x=>["omv","lyric","visualiser","live","acoustic"].includes(x.f)).map(x=>x.u.publishedAt.slice(0,10)).sort()[0] ?? event.dateISO;
        const nominal =
          candidate.key === "live" && tour
            ? addDays(tour.dateISO, 3)
            : addDays(anchorDate, 10);
        const nextRelease = plan.events
          .filter(
            (e) => e.kind === "singleRelease" && e.dateISO > event.dateISO,
          )
          .sort((a, b) => a.dateISO.localeCompare(b.dateISO))[0];
        const date =
          nextRelease && nominal >= nextRelease.dateISO
            ? addDays(nextRelease.dateISO, -3)
            : nominal;
        push(
          candidate.key,
          `Consider ${candidate.name.toLowerCase()} follow-up`,
          date,
          `${candidate.count} channel examples; ${Math.round(candidate.median).toLocaleString("en-GB")} median lifetime views.${example ? ` Review “${example.title}” for the creative approach.` : ""}${tour && candidate.key === "live" ? ` Check capture availability around ${tour.title}.` : " Confirm existing footage and rights before commissioning."}`,
          "Channel audit. Lifetime views are not age-adjusted. Target is a planning suggestion, not an optimal interval or a promise of growth.",
        );
      } else {
        const historical = points.find((p) =>
          Object.entries(tags).some(
            ([f, ts]) =>
              ts.some((t) => p.needTags.includes(t as never)) &&
              !classified.some((x) => x.f === f),
          ),
        );
        if (historical)
          push(
            "followup",
            "Choose a follow-up with the team",
            addDays(event.dateISO, 10),
            historical.point,
            `Historical deep dive · ${evidence.dive?.dataCapturedAt ?? "date unavailable"} · ${historical.basis} Reconfirm relevance for this campaign.`,
          );
        else if (destinations.length < 2)
          push(
            "followup",
            "Choose one distinct follow-up",
            addDays(event.dateISO, 10),
            "No repeatable support-format winner was established in this reading. Check available performances, lyrics or making-of material with the team.",
            "YouTube multi-format guidance; exploratory until channel evidence or team input supports a format.",
          );
      }
      const shorts = classified.filter((x) => x.f === "short");
      if (shorts.length)
        shorts.forEach(({ u }) =>
          push(
            "short:" + u.id,
            "Short",
            u.publishedAt.slice(0, 10),
            u.title,
            "Title-matched Short; related-video setting is not verified.",
            u,
          ),
        );
      else
        push(
          "short",
          "Short linking to the release video",
          destinations.length
            ? addDays(destinations[0].u.publishedAt.slice(0, 10), 2)
            : event.dateISO,
          "Use a distinct moment from the release, with its official audio and a related-video link. Check existing Shorts whose captions do not name the track.",
          "YouTube release strategy. No fixed campaign-wide Shorts quota.",
        );
      const classes: Record<string, string[]> = {
        hero: [
          "official_video",
          "visualiser",
          "lyric_video",
          "live_performance",
        ],
        lyric: ["lyric_video"],
        visualiser: ["visualiser"],
        live: ["live_performance"],
        acoustic: ["live_performance"],
        bts: ["bts"],
        short: ["shorts_cutdown"],
      };
      for (const action of actions) {
        if (action.video) continue;
        const file = library?.assets.find(
          (a) =>
            a.classConfidence === "high" &&
            (classes[action.format] ?? []).includes(a.assetClass) &&
            trackMention(a.name, name),
        );
        if (file)
          action.available = { name: file.name, href: file.webViewLink };
      }
      return { id: trackId, name, releaseDate: event.dateISO, actions };
    });
}

export function actionStatus(a: RoadmapAction, d?: Decision): string {
  if (a.video && !a.scheduled) return "Published";
  if (a.scheduled) return "Linked · verify";
  if (a.available && (!d || d.status === "suggested"))
    return "File found · check readiness";
  return (
    {
      suggested: "Suggested",
      planned: "Planned",
      ready: "Ready",
      done: "Done · team confirmed",
      dismissed: "Not needed",
    } as const
  )[d?.status ?? "suggested"];
}
