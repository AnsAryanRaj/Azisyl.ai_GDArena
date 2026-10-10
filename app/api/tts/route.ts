import { NextResponse } from "next/server";
import { synthesize, ttsConfig } from "@/lib/tts";

export const dynamic = "force-dynamic";

// Simple per-address limit so a leaked link cannot burn the voice credits.
const hits = new Map<string, { n: number; at: number }>();
function allowed(ip: string) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.at > 60_000) {
    hits.set(ip, { n: 1, at: now });
    if (hits.size > 500) hits.clear();
    return true;
  }
  h.n += 1;
  return h.n <= 40;
}

/** Turns one line into natural speech (mp3). On any problem it answers 503 with a reason,
 *  and the browser speaks the line with its own voice instead. */
export async function POST(request: Request) {
  if (!ttsConfig().enabled) return NextResponse.json({ fallback: true, reason: "off" }, { status: 503 });
  let body: { text?: unknown; id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  const text = String(body.text ?? "").replace(/\s+/g, " ").trim().slice(0, 600);
  const id = String(body.id ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 20);
  if (!text) return NextResponse.json({ error: "Nothing to say." }, { status: 400 });
  const ip = (request.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (!allowed(ip)) return NextResponse.json({ fallback: true, reason: "rate" }, { status: 503 });

  const r = await synthesize(text, id);
  if (!r.ok) return NextResponse.json({ fallback: true, reason: r.reason }, { status: r.status });
  return new Response(r.audio, { headers: { "Content-Type": r.type, "Cache-Control": "no-store" } });
}
