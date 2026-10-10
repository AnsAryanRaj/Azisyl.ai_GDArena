import { NextResponse } from "next/server";
import { getRoom, newKey, publicView, pullInbox, pushInbox, saveRoom } from "@/lib/roomStore";
import type { Line } from "@/lib/types";
import { cleanConfig } from "@/lib/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };
const bad = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });
const codeOf = async (ctx: Ctx) => (await ctx.params).code.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
const clip = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

// Guests poll this about once a second to see the table and the transcript.
export async function GET(request: Request, ctx: Ctx) {
  const room = await getRoom(await codeOf(ctx));
  if (!room) return bad("No room with that code. Check the code with your host.", 404);
  const since = Math.max(0, Number(new URL(request.url).searchParams.get("since")) || 0);
  return NextResponse.json(publicView(room, since));
}

export async function POST(request: Request, ctx: Ctx) {
  const code = await codeOf(ctx);
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return bad("Request body must be JSON.");
  }
  const room = await getRoom(code);
  if (!room) return bad("No room with that code. Check the code with your host.", 404);
  const action = String(body.action ?? "");
  const isHost = typeof body.hostKey === "string" && body.hostKey === room.hostKey;
  const friend = room.friends.find((f) => f.id === body.friendId && f.key === body.key);

  switch (action) {
    case "join": {
      if (room.status !== "lobby") return bad("This discussion has already started. Ask your host to make a new room.", 409);
      if (room.friends.length >= 4) return bad("This room is full (4 friends).", 409);
      const name = clip(body.name, 30);
      if (name.length < 2) return bad("Enter your name, at least 2 letters.");
      const id = `f${[1, 2, 3, 4].find((n) => !room.friends.some((f) => f.id === `f${n}`))}`;
      const f = { id, name, key: newKey() };
      room.friends.push(f);
      await saveRoom(room);
      return NextResponse.json({ friendId: f.id, key: f.key, ...publicView(room) });
    }
    case "leave": {
      if (!friend) return bad("Not in this room.", 403);
      if (room.status === "lobby") room.friends = room.friends.filter((f) => f.id !== friend.id);
      await saveRoom(room);
      return NextResponse.json({ ok: true });
    }
    case "start": {
      if (!isHost) return bad("Only the host can start.", 403);
      const config = cleanConfig(body.config);
      if (!config) return bad("Missing room settings.");
      config.friends = room.friends.map(({ id, name }) => ({ id, name }));
      room.config = config;
      room.status = "live";
      await saveRoom(room);
      return NextResponse.json({ ok: true, config });
    }
    case "sync": {
      // The host's browser runs the discussion and shares the transcript and who is speaking.
      if (!isHost) return bad("Only the host can update the room.", 403);
      const lines = (Array.isArray(body.lines) ? body.lines : []).slice(-200).map((l) => {
        const o = (l ?? {}) as Record<string, unknown>;
        return {
          id: clip(o.id, 6),
          speakerId: clip(o.speakerId, 12),
          text: clip(o.text, 600),
          startedAt: Number(o.startedAt) || 0,
          durationMs: Number(o.durationMs) || 0,
          interrupted: o.interrupted === true || undefined,
          typed: o.typed === true || undefined,
        } as Line;
      });
      const s = (body.state ?? {}) as Record<string, unknown>;
      room.lines = lines;
      room.state = {
        phase: clip(s.phase, 20),
        speakingId: s.speakingId ? clip(s.speakingId, 12) : null,
        secondsLeft: Number(s.secondsLeft) || 0,
        thinking: s.thinking === true,
      };
      if (body.ended === true) room.status = "ended";
      await saveRoom(room);
      return NextResponse.json({ events: await pullInbox(code) });
    }
    case "say": {
      if (!friend) return bad("Join the room first.", 403);
      if (room.status !== "live") return bad("The discussion is not running.", 409);
      const text = clip(body.text, 600);
      if (!text) return bad("Say or type something first.");
      await pushInbox(code, { type: "say", friendId: friend.id, text, ms: Math.min(120000, Number(body.ms) || 0), typed: body.typed === true });
      return NextResponse.json({ ok: true });
    }
    case "talk": {
      if (!friend) return bad("Join the room first.", 403);
      await pushInbox(code, { type: "talk", friendId: friend.id, on: body.on === true });
      return NextResponse.json({ ok: true });
    }
    default:
      return bad("Unknown action.");
  }
}
