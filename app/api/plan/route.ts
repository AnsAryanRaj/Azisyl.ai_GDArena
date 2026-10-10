import { NextResponse } from "next/server";
import { chatJSON, llmConfig } from "@/lib/llm";
import { mockPlan } from "@/lib/mock";
import { panelFor } from "@/lib/personas";
import { planMessages } from "@/lib/prompts";
import { cleanConfig, cleanPlan } from "@/lib/validate";

export const dynamic = "force-dynamic";

// Decides, once per room, which position each AI participant defends.
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  const config = cleanConfig(body.config);
  if (!config) return NextResponse.json({ error: "Missing room settings." }, { status: 400 });
  if (llmConfig().demo) return NextResponse.json({ plan: mockPlan(config), demo: true });
  try {
    const raw = await chatJSON<Record<string, unknown>>(planMessages(config), { maxTokens: 2048, temperature: 0.8, timeoutMs: 15000 });
    const plan = cleanPlan(raw) ?? {};
    // Fill anyone the model skipped.
    const backup = mockPlan(config);
    for (const p of panelFor(config.panelSize)) if (!plan[p.id]) plan[p.id] = backup[p.id];
    return NextResponse.json({ plan });
  } catch (e) {
    console.error("plan failed:", (e as Error).message);
    return NextResponse.json({ plan: mockPlan(config), fallback: true, reason: (e as Error).message.slice(0, 200) });
  }
}
