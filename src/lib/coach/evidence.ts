import { buildChannelAudit } from "../channelAudit";
import { readAuditCatalogue } from "../channelAuditCatalogue";
import { getDeepDive } from "../intelligence/deepDiveStore";
import { DEEP_DIVE_BY_NAME, normaliseName } from "../intelligence/deepDives";
import type { RecentUpload } from "../artists";
import type { CoachEvidence, Decisions } from "./roadmap";

export async function decisionStore() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Plan tracking storage is unavailable.");
  const { Redis } = await import("@upstash/redis");
  return new Redis({ url, token });
}
export const decisionsKey = (slug: string) =>
  "coach:roadmap:decisions:v1:" + slug;
export async function readDecisions(slug: string): Promise<Decisions> {
  try {
    return (
      (await (await decisionStore()).hgetall<Decisions>(decisionsKey(slug))) ??
      {}
    );
  } catch {
    return {};
  }
}

export async function loadCoachEvidence(input: {
  slug: string;
  name: string;
  channelId?: string;
  uploads: RecentUpload[];
  dataAt?: string | null;
}): Promise<CoachEvidence> {
  const [catalogue, deep] = await Promise.all([
    input.channelId
      ? readAuditCatalogue(input.channelId)
      : Promise.resolve(null),
    getDeepDive(input.slug).then(async (result) =>
      result.dive
        ? result
        : getDeepDive(
            DEEP_DIVE_BY_NAME[normaliseName(input.name)] ?? input.slug,
          ),
    ),
  ]);
  // A catalogue read must include newly cached uploads too, even between full scans.
  const uploads = Array.from(
    new Map(
      [...(catalogue?.uploads ?? []), ...input.uploads].map((u) => [u.id, u]),
    ).values(),
  );
  const audit = buildChannelAudit({
    name: input.name,
    slug: input.slug,
    uploads,
    dataAt: input.dataAt ?? null,
    stats: {
      subs: null,
      lifetimeViews: null,
      views7d: null,
      views30d: null,
      subs7d: null,
    },
    catalogue: catalogue
      ? {
          complete:
            catalogue.complete && catalogue.includesLinkedUploads === true,
          fetchedAt: catalogue.fetchedAt,
          publicVideoCount: catalogue.publicVideoCount,
          scannedIds: catalogue.scannedIds,
        }
      : undefined,
  });
  return { audit, dive: deep.dive, artistSlug: input.slug, uploads };
}
