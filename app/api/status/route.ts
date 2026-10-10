import { NextResponse } from "next/server";
import { chatJSON, llmConfig } from "@/lib/llm";

export const dynamic = "force-dynamic";

// Tells the UI whether real AI is on. With ?check=1 it makes one tiny test call,
// so the team can see the exact problem (wrong key, rate limit, model name). Never returns the key.
export async function GET(request: Request) {
  const { provider, model, demo } = llmConfig();
  const base = { demo, provider: demo ? null : provider, model: demo ? null : model };
  if (demo || !new URL(request.url).searchParams.has("check")) return NextResponse.json(base);
  const started = Date.now();
  try {
    await chatJSON<{ ok?: boolean }>(
      [
        { role: "system", content: 'Reply with JSON only: {"ok": true}' },
        { role: "user", content: "ping" },
      ],
      { maxTokens: 256, temperature: 0, timeoutMs: 12000 }
    );
    return NextResponse.json({ ...base, ok: true, ms: Date.now() - started });
  } catch (e) {
    return NextResponse.json({ ...base, ok: false, error: (e as Error).message.slice(0, 300) });
  }
}
