"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  actionStatus,
  type CoachSummary,
  type TrackRoadmap,
  type Decision,
  type Decisions,
} from "@/lib/coach/roadmap";

const fmt = (date: string) =>
  new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export default function CoachActionBoard({
  tracks,
  slug,
  evidence,
  decisions: initial,
}: {
  tracks: TrackRoadmap[];
  slug: string;
  evidence: CoachSummary;
  decisions: Decisions;
}) {
  const router = useRouter();
  const [decisions, setDecisions] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const all = tracks.flatMap((t) =>
    t.actions.map((a) => ({ a, t, d: decisions[a.id] })),
  );
  const pending = all.filter(
    (x) => !x.a.video && x.d?.status !== "done" && x.d?.status !== "dismissed",
  );
  const next = pending
    .filter(
      (x) =>
        x.t.releaseDate >=
        new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10),
    )
    .sort((a, b) =>
      (a.d?.targetDate ?? a.a.date).localeCompare(b.d?.targetDate ?? b.a.date),
    )[0];
  useEffect(() => {
    setDecisions(initial);
  }, [initial]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        !document.hidden &&
        !["INPUT", "SELECT", "TEXTAREA"].includes(
          document.activeElement?.tagName ?? "",
        )
      )
        router.refresh();
    }, 120000);
    return () => clearInterval(timer);
  }, [router]);
  async function save(id: string, decision: Decision) {
    setBusy(id);
    setError("");
    try {
      const response = await fetch("/api/coach/roadmap", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, id, ...decision }),
      });
      if (!response.ok)
        throw new Error((await response.json()).error ?? "Save failed");
      setDecisions((old) => ({ ...old, [id]: decision }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      setBusy(null);
    }
  }
  async function scan() {
    setScanning(true);
    setError("");
    try {
      const response = await fetch(
        "/api/channel-audit/" + encodeURIComponent(evidence.artistSlug),
        { method: "POST" },
      );
      if (!response.ok)
        throw new Error((await response.json()).error ?? "Scan failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }
  return (
    <section className="coach-board" aria-label="Campaign asset roadmap">
      <style>{`.coach-board{max-width:1180px;margin:0 auto;padding:28px 40px;color:#0e0e0e}.coach-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:20px 0}.coach-summary>div{background:white;border:1px solid #e7e2d8;border-radius:10px;padding:16px}.coach-summary strong{display:block;font-size:28px;line-height:1.15}.coach-summary span{font-size:12px;color:#615c53}.coach-track{background:white;border:1px solid #e7e2d8;border-radius:12px;margin-top:16px;overflow:hidden}.coach-track>summary{cursor:pointer;padding:20px;font-weight:750}.coach-action{display:grid;grid-template-columns:minmax(170px,1.4fr) minmax(130px,1fr) minmax(145px,1fr);gap:16px;padding:18px 20px;border-top:1px solid #eee9e1;align-items:start}.coach-action label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#615c53;margin-bottom:5px}.coach-action select,.coach-action input{font:inherit;font-size:14px;border:1px solid #c9c2b6;border-radius:6px;padding:9px;max-width:100%;width:100%;background:white;color:#0e0e0e}.coach-action details{margin-top:8px;font-size:12px;line-height:1.6;color:#615c53}.coach-action details summary{cursor:pointer;text-decoration:underline}.coach-action a{color:#2d6a4f;text-decoration:underline}.coach-muted{font-size:12px;color:#615c53;line-height:1.6}.coach-tools{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.coach-tools button{border:1px solid #c9c2b6;border-radius:6px;padding:8px 12px;background:white;font-weight:650;cursor:pointer}.coach-tools a{color:#2d6a4f;text-decoration:underline}.coach-action :focus-visible,.coach-track summary:focus-visible{outline:2px solid #2d6a4f;outline-offset:3px}@media(max-width:700px){.coach-board{padding:24px 18px}.coach-action{grid-template-columns:1fr;gap:12px}.coach-summary{gap:7px}.coach-summary>div{padding:12px}.coach-summary strong{font-size:24px}}`}</style>
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: ".12em",
          color: "#2d6a4f",
        }}
      >
        YOUR NEXT STEPS
      </div>
      <h2
        style={{
          fontSize: 28,
          fontWeight: 850,
          letterSpacing: "-.03em",
          margin: "8px 0",
        }}
      >
        What is live. What needs a decision. What happens next.
      </h2>
      <p className="coach-muted">
        Suggestions use this channel’s automatic audit, campaign dates and
        available deep-dive evidence. Confirm the assets and dates with the
        team.
      </p>
      <div className="coach-summary">
        <div>
          <strong>
            {all.filter((x) => x.a.video && !x.a.scheduled).length}
          </strong>
          <span>Published assets matched</span>
        </div>
        <div>
          <strong>
            {pending.filter((x) => !x.d || x.d.status === "suggested").length}
          </strong>
          <span>Suggestions to agree</span>
        </div>
        <div>
          <strong>
            {
              pending.filter(
                (x) => x.d?.status === "planned" || x.d?.status === "ready",
              ).length
            }
          </strong>
          <span>Planned / ready</span>
        </div>
      </div>
      {next && (
        <div
          style={{
            background: "#eaf2ed",
            borderLeft: "4px solid #2d6a4f",
            padding: 18,
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          <strong>
            Next decision: {next.t.name} — {next.a.label}
          </strong>
          <p className="coach-muted">
            {(next.d?.targetDate ?? next.a.date) < today
              ? "Review the suggested date: "
              : "Target: "}
            {fmt(next.d?.targetDate ?? next.a.date)}. {next.a.reason}
          </p>
        </div>
      )}
      <div className="coach-tools">
        <button onClick={() => router.refresh()}>
          Refresh channel reading
        </button>
        <button disabled={scanning} onClick={scan}>
          {scanning
            ? "Scanning…"
            : evidence.audit.catalogue?.complete
              ? "Refresh catalogue audit"
              : "Scan more channel history"}
        </button>
        <a href={"/watcher/" + evidence.artistSlug}>Open channel</a>
      </div>
      {error && (
        <p role="alert" style={{ color: "#b91c1c", marginTop: 12 }}>
          {error}
        </p>
      )}
      <details style={{ margin: "16px 0" }}>
        <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 650 }}>
          What this plan is based on
        </summary>
        <p className="coach-muted">
          {evidence.audit.coverage} Channel reading:{" "}
          {evidence.audit.dataAt
            ? fmt(evidence.audit.dataAt.slice(0, 10))
            : "date unavailable"}
          . Missing matches mean “not identified”, not proof an asset does not
          exist. Refresh reads the latest stored channel snapshot; a catalogue
          scan collects more history.
        </p>
        <p className="coach-muted">
          {evidence.audit.visuals.takeaway} Lifetime totals are not
          age-adjusted; no algorithmic lift is assumed.
        </p>
        {evidence.dive && (
          <p className="coach-muted">
            Historical deep dive:{" "}
            {evidence.dive.dataCapturedAt ?? "date unavailable"} ·{" "}
            {evidence.dive.deckUrl && (
              <a href={evidence.dive.deckUrl} target="_blank" rel="noreferrer">
                Read the analysis
              </a>
            )}
            . Historical strengths inform ideas; they do not establish today’s
            activity.
          </p>
        )}
        <p className="coach-muted">
          <a
            href="https://support.google.com/youtube/answer/18736733?hl=en"
            target="_blank"
            rel="noreferrer"
          >
            YouTube release strategy
          </a>{" "}
          informs main-video and Shorts suggestions. Follow-up dates are
          adjustable planning windows, not an optimal upload formula. Check
          footage, rights and budget before adding production.
        </p>
      </details>
      {!tracks.length && (
        <p>
          No identifiable single-release moments yet. Add named focus tracks and
          release dates using Adjust timeline below; album and tour dates remain
          in the campaign timeline.
        </p>
      )}
      {tracks.map((track) => (
        <details
          className="coach-track"
          key={track.id}
          open={
            track.releaseDate >=
            new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10)
          }
        >
          <summary>
            {track.name}
            <span style={{ fontWeight: 400, color: "#615c53", marginLeft: 12 }}>
              Release planned {fmt(track.releaseDate)}
            </span>
          </summary>
          {track.actions.map((a) => {
            const d = decisions[a.id] ?? { status: "suggested" as const };
            const actual = !!a.video && !a.scheduled;
            const target = d.targetDate ?? a.date;
            return (
              <div className="coach-action" key={a.id}>
                <div>
                  <strong style={{ fontSize: 15 }}>{a.label}</strong>
                  {a.video && (
                    <p className="coach-muted">
                      <a
                        href={"https://www.youtube.com/watch?v=" + a.video.id}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {actual
                          ? "Watch published video"
                          : "Check linked video"}{" "}
                        ↗
                      </a>
                    </p>
                  )}
                  <details>
                    <summary>Why this / evidence</summary>
                    <p>{a.reason}</p>
                    <p>{a.basis}</p>
                    {a.available && (
                      <p>
                        Matching file:{" "}
                        {a.available.href ? (
                          <a
                            href={a.available.href}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {a.available.name}
                          </a>
                        ) : (
                          a.available.name
                        )}
                        . Check final approval and upload readiness; a file
                        alone is not a published video.
                      </p>
                    )}
                  </details>
                </div>
                <div>
                  <label htmlFor={a.id + "-status"}>Status</label>
                  {actual || a.scheduled ? (
                    <p
                      style={{
                        color: actual ? "#2d6a4f" : "#9a6700",
                        fontWeight: 700,
                      }}
                    >
                      {actionStatus(a, d)}
                    </p>
                  ) : (
                    <select
                      id={a.id + "-status"}
                      value={d.status}
                      disabled={busy !== null}
                      onChange={(e) =>
                        save(a.id, {
                          ...d,
                          status: e.target.value as Decision["status"],
                        })
                      }
                    >
                      <option value="suggested">
                        {a.available
                          ? "File found — check readiness"
                          : "Suggested — to agree"}
                      </option>
                      <option value="planned">Planned</option>
                      <option value="ready">Ready to upload</option>
                      <option value="done">Done — team confirmed</option>
                      <option value="dismissed">Not needed</option>
                    </select>
                  )}
                </div>
                <div>
                  <label htmlFor={a.id + "-date"}>
                    {actual ? "Published" : "Suggested target date"}
                  </label>
                  {actual ? (
                    <p>{fmt(a.video!.date)}</p>
                  ) : (
                    <input
                      key={target}
                      id={a.id + "-date"}
                      type="date"
                      defaultValue={target}
                      disabled={busy !== null}
                      onBlur={(e) => {
                        if (e.target.value && e.target.value !== target)
                          save(a.id, { ...d, targetDate: e.target.value });
                      }}
                    />
                  )}
                  {!actual &&
                    target < today &&
                    d.status !== "done" &&
                    d.status !== "dismissed" && (
                      <p className="coach-muted" style={{ color: "#9a6700" }}>
                        Date passed — replan with team
                      </p>
                    )}
                </div>
              </div>
            );
          })}
        </details>
      ))}
      <p className="coach-muted" style={{ marginTop: 14 }}>
        Checks update from cached channel data every two minutes while this page
        is open. Matched uploads show publication automatically; team statuses
        and dates are preserved.
      </p>
    </section>
  );
}
