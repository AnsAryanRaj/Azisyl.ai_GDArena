import { NextResponse } from "next/server";
import { chatJSON, llmConfig } from "@/lib/llm";
import { mockReport } from "@/lib/mock";
import { reportMessages, type Stats } from "@/lib/prompts";
import type { Report } from "@/lib/types";
import { cleanConfig, cleanTranscript } from "@/lib/validate";

export const dynamic = "force-dynamic";

const AREAS = [
  "Starting the discussion",
  "Quality of ideas",
  "Building on others",
  "Listening",
  "Handling interruptions",
  "Ending strongly",
];

function cleanStats(raw: unknown): Stats {
  const out: Stats = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, Record<string, unknown>>)) {
    if (!/^(you|moderator|arjun|priya|kabir|meera|rohan)$/.test(k)) continue;
    out[k] = {
      seconds: Math.max(0, Number(v?.seconds) || 0),
      words: Math.max(0, Number(v?.words) || 0),
      turns: Math.max(0, Number(v?.turns) || 0),
    };
  }
  return out;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  const config = cleanConfig(body.config);
  if (!config) return NextResponse.json({ error: "Missing room settings." }, { status: 400 });
  const transcript = cleanTranscript(body.transcript, 200);
  const stats = cleanStats(body.stats);
  const ids = new Set(transcript.map((l) => l.id));

  if (llmConfig().demo || !transcript.some((l) => l.speakerId === "you")) {
    return NextResponse.json(mockReport(transcript, stats));
  }

  try {
    const raw = await chatJSON<Partial<Report>>(reportMessages(config, transcript, stats), {
      maxTokens: 3000,
      temperature: 0.4,
      timeoutMs: 25000,
    });

    // Every feedback point must link to a real moment. Drop quotes the model made up.
    const points = (Array.isArray(raw.points) ? raw.points : [])
      .slice(0, 8)
      .map((p, i) => ({
        area: String(p?.area || AREAS[i] || "Feedback").slice(0, 60),
        score: Math.min(5, Math.max(1, Math.round(Number(p?.score) || 1))),
        verdict: String(p?.verdict || "").slice(0, 300),
        tip: String(p?.tip || "").slice(0, 300),
        quoteIds: (Array.isArray(p?.quoteIds) ? p.quoteIds : [])
          .map((q) => String(q).trim().toUpperCase())
          .filter((q) => ids.has(q))
          .slice(0, 2),
      }))
      .filter((p) => p.verdict);

    const fallback = mockReport(transcript, stats);
    for (const p of points) {
      if (p.quoteIds.length === 0) {
        const match = fallback.points.find((f) => f.area === p.area);
        if (match) p.quoteIds = match.quoteIds;
      }
    }

    // If the model skipped an area, keep the report complete with the basic version.
    for (const f of fallback.points) {
      if (!points.some((p) => p.area.toLowerCase() === f.area.toLowerCase())) points.push(f);
    }

    const mo = raw.missedOpening;
    const report: Report = {
      summary: String(raw.summary || "").slice(0, 500) || fallback.summary,
      overall: Math.min(10, Math.max(1, Math.round(Number(raw.overall) || 1))),
      points: points.length ? points : fallback.points,
      missedOpening:
        mo && ids.has(String(mo.afterLineId).toUpperCase()) && mo.youCouldHaveSaid
          ? { afterLineId: String(mo.afterLineId).toUpperCase(), youCouldHaveSaid: String(mo.youCouldHaveSaid).slice(0, 300) }
          : null,
    };
    return NextResponse.json(report);
  } catch (e) {
    console.error("report failed:", (e as Error).message);
    return NextResponse.json({ ...mockReport(transcript, stats), fallback: true });
  }
}
