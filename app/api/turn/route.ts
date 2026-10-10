import { NextResponse } from "next/server";
import { chatJSON, llmConfig } from "@/lib/llm";
import { mockTurn } from "@/lib/mock";
import { panelFor } from "@/lib/personas";
import { turnMessages } from "@/lib/prompts";
import type { TurnRequest, TurnResponse } from "@/lib/types";
import { cleanConfig, cleanTranscript } from "@/lib/validate";

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
  };

  if (llmConfig().demo) return NextResponse.json(mockTurn(req));

  try {
    const out = await chatJSON<{ speaker?: string; text?: string }>(turnMessages(req), {
      maxTokens: 220,
      temperature: 0.95,
      timeoutMs: 12000,
    });
    const last = req.transcript[req.transcript.length - 1]?.speakerId;
    let speakerId = force ?? String(out.speaker ?? "").toLowerCase().trim();
    if (!allowed.has(speakerId) || (speakerId === last && !force)) {
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
    const res: TurnResponse = { speakerId, text };
    return NextResponse.json(res);
  } catch (e) {
    console.error("turn failed:", (e as Error).message);
    // Keep the room alive: fall back to a scripted line, and tell the client.
    return NextResponse.json({ ...mockTurn(req), fallback: true });
  }
}
