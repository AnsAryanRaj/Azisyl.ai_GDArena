import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Collects ratings and comments about the app. No personal data is stored:
// it only goes to the server log, which the team reads on the hosting dashboard.
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  const rating = Math.round(Number(body.rating));
  if (!(rating >= 1 && rating <= 5)) return NextResponse.json({ error: "Pick a rating from 1 to 5." }, { status: 400 });
  const comment = String(body.comment ?? "").replace(/\s+/g, " ").trim().slice(0, 800);
  const where = String(body.where ?? "").slice(0, 20);
  const ctx = (body.context ?? {}) as Record<string, unknown>;
  console.log(
    "[feedback]",
    JSON.stringify({
      at: new Date().toISOString(),
      rating,
      comment,
      where,
      topic: String(ctx.topic ?? "").slice(0, 160),
      format: String(ctx.format ?? "").slice(0, 20),
      overall: Number(ctx.overall) || null,
    })
  );
  return NextResponse.json({ ok: true });
}
