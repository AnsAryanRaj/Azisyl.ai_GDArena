import { NextResponse } from "next/server";
import { llmConfig } from "@/lib/llm";

export const dynamic = "force-dynamic";

// Tells the UI whether real AI is on. Never returns the key.
export async function GET() {
  const { provider, model, demo } = llmConfig();
  return NextResponse.json({ demo, provider: demo ? null : provider, model: demo ? null : model });
}
