import { NextResponse } from "next/server";
import { getRoom, newCode, newKey, saveRoom, type SharedRoom } from "@/lib/roomStore";

export const dynamic = "force-dynamic";

// Creates a shared room. The host gets a secret key; friends join with the 4-letter code.
export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {}
  const hostName = String(body.hostName ?? "").replace(/\s+/g, " ").trim().slice(0, 30) || "Host";
  try {
    let code = newCode();
    for (let i = 0; i < 5 && (await getRoom(code)); i++) code = newCode();
    const room: SharedRoom = {
      code,
      hostKey: newKey(),
      hostName,
      status: "lobby",
      friends: [],
      config: null,
      lines: [],
      state: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveRoom(room);
    return NextResponse.json({ code, hostKey: room.hostKey });
  } catch (e) {
    return NextResponse.json({ error: `Could not create a room. ${(e as Error).message}` }, { status: 500 });
  }
}
