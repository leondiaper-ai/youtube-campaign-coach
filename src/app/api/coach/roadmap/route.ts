import { NextRequest, NextResponse } from "next/server";
import { loadPlan } from "@/lib/planStore";
import { decisionStore, decisionsKey } from "@/lib/coach/evidence";
import type { Decision } from "@/lib/coach/roadmap";

export async function PATCH(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin)
    return NextResponse.json(
      { error: "Same-origin request required" },
      { status: 403 },
    );
  try {
    const body = await req.json();
    if (
      typeof body.slug !== "string" ||
      typeof body.id !== "string" ||
      body.id.length > 300 ||
      !body.id.includes(":")
    )
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    if (
      !["suggested", "planned", "ready", "done", "dismissed"].includes(
        body.status,
      )
    )
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    if (
      body.targetDate &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(body.targetDate) ||
        !Number.isFinite(Date.parse(body.targetDate)) ||
        new Date(body.targetDate).toISOString().slice(0, 10) !==
          body.targetDate)
    )
      return NextResponse.json(
        { error: "Invalid target date" },
        { status: 400 },
      );
    if (!(await loadPlan(body.slug)))
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    const decision: Decision = {
      status: body.status,
      ...(body.targetDate ? { targetDate: body.targetDate } : {}),
    };
    // One hash field per action: changing a date cannot overwrite other actions,
    // campaign dates, video links, or another team's plan edits.
    await (
      await decisionStore()
    ).hset(decisionsKey(body.slug), { [body.id]: decision });
    return NextResponse.json({ ok: true, decision });
  } catch {
    return NextResponse.json(
      { error: "Could not save. Your existing plan has not changed." },
      { status: 503 },
    );
  }
}
