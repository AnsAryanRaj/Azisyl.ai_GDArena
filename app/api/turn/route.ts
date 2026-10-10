import { NextResponse } from "next/server";
import { chatJSON, llmConfig } from "@/lib/llm";
import { mockTurn } from "@/lib/mock";
import { panelFor } from "@/lib/personas";
import { turnMessages } from "@/lib/prompts";
import type { TurnRequest, TurnResponse } from "@/lib/types";
import { cleanConfig, cleanPlan, cleanTranscript } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const config = cleanConfig(body.config);
  if (!config) return NextResponse.json({ error: "Pick a topic of at least 2 characters." }, { status: 400 });

  const allowed = new Set(["moderator", ...panelFor(config.panelSize).map((p) => p.id)]);
  const force = typeof body.forceSpeaker === "string" && allowed.has(body.forceSpeaker) ? body.forceSpeaker : undefined;

  const req: TurnRequest = {
    config,
    phase: body.phase === "closing" ? "closing" : "discussion",
    transcript: cleanTranscript(body.transcript, 60),
    secondsLeft: Number(body.secondsLeft) || 0,
    secondsSinceStudentSpoke: Number(body.secondsSinceStudentSpoke) || 0,
    forceSpeaker: force,
    plan: cleanPlan(body.plan),
    askHuman: body.askHuman === true,
    ignoredAsks: Math.min(5, Math.max(0, Math.round(Number(body.ignoredAsks) || 0))),
  };
  // After the student lets a direct question pass, the moderator steps in.
  if (!req.forceSpeaker && req.phase === "discussion" && (req.ignoredAsks ?? 0) >= 1) req.forceSpeaker = "moderator";

  if (llmConfig().demo) return NextResponse.json(mockTurn(req));

  try {
    const out = await chatJSON<{ speaker?: string; text?: string; asksHuman?: boolean }>(turnMessages(req), {
      maxTokens: 220,
      temperature: 0.95,
      timeoutMs: 12000,
    });
    const last = req.transcript[req.transcript.length - 1]?.speakerId;
    let speakerId = req.forceSpeaker ?? String(out.speaker ?? "").toLowerCase().trim();
    if (!allowed.has(speakerId)) {
      // The model may answer with a name instead of an id.
      const said = String(out.speaker ?? "").toLowerCase();
      const byName = said.includes("rao") ? "moderator" : [...allowed].find((id) => said.includes(id));
      if (byName) speakerId = byName;
    }
    if (!allowed.has(speakerId) || (speakerId === last && !req.forceSpeaker)) {
      // Model picked someone invalid. Pick a different panel member.
      const options = panelFor(config.panelSize).filter((p) => p.id !== last);
      speakerId = options[Math.floor(Math.random() * options.length)].id;
    }
    const text = String(out.text ?? "")
      .replace(/^\s*[\w.]+\s*:\s*/, "") // drop "Arjun:" prefixes
      .replace(/[*_#`]/g, "")
      .trim()
      .slice(0, 400);
    if (!text) throw new Error("Empty reply");
    const asksHuman =
      out.asksHuman === true || (text.includes("?") && text.toLowerCase().includes(config.studentName.toLowerCase()));
    const res: TurnResponse = { speakerId, text, asksHuman };
    return NextResponse.json(res);
  } catch (e) {
    console.error("turn failed:", (e as Error).message);
    // Keep the room alive: fall back to a scripted line, and tell the client.
    return NextResponse.json({ ...mockTurn(req), fallback: true, reason: (e as Error).message.slice(0, 200) });
  }
}
