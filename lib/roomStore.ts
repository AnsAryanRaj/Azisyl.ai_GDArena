// Shared rooms for "practise with friends". Server only.
// Locally (npm run dev / start) rooms live in memory. On Vercel, serverless functions do not share
// memory, so set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (free tier) and rooms live there.

import type { Line, RoomConfig } from "./types";

export interface Friend {
  id: string; // f1 to f4
  name: string;
  key: string; // secret the friend's device uses to post
}

export interface LiveState {
  phase: string;
  speakingId: string | null;
  secondsLeft: number;
  thinking: boolean;
}

export interface SharedRoom {
  code: string;
  hostKey: string;
  hostName: string;
  status: "lobby" | "live" | "ended";
  friends: Friend[];
  config: RoomConfig | null;
  lines: Line[];
  state: LiveState | null;
  createdAt: number;
  updatedAt: number;
}

export type InboxEvent =
  | { type: "say"; friendId: string; text: string; ms: number; typed: boolean }
  | { type: "talk"; friendId: string; on: boolean };

const TTL_S = 3 * 60 * 60;
const url = (process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, "");
const token = process.env.UPSTASH_REDIS_REST_TOKEN || "";
export const usingRedis = Boolean(url && token);

async function redis(cmd: (string | number)[]) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Room storage error ${res.status}`);
  return (await res.json()).result;
}

// In-memory fallback. Kept on globalThis so hot reloads in dev do not wipe rooms.
const g = globalThis as unknown as { __gdRooms?: Map<string, SharedRoom>; __gdInbox?: Map<string, InboxEvent[]> };
const mem = (g.__gdRooms ??= new Map());
const inbox = (g.__gdInbox ??= new Map());

export async function getRoom(code: string): Promise<SharedRoom | null> {
  if (usingRedis) {
    const v = await redis(["GET", `gdroom:${code}`]);
    return v ? (JSON.parse(v) as SharedRoom) : null;
  }
  const r = mem.get(code);
  if (r && Date.now() - r.updatedAt > TTL_S * 1000) {
    mem.delete(code);
    return null;
  }
  return r ?? null;
}

export async function saveRoom(room: SharedRoom) {
  room.updatedAt = Date.now();
  if (usingRedis) await redis(["SET", `gdroom:${room.code}`, JSON.stringify(room), "EX", TTL_S]);
  else mem.set(room.code, room);
}

export async function pushInbox(code: string, ev: InboxEvent) {
  if (usingRedis) {
    await redis(["RPUSH", `gdinbox:${code}`, JSON.stringify(ev)]);
    await redis(["EXPIRE", `gdinbox:${code}`, TTL_S]);
    return;
  }
  const list = inbox.get(code) ?? [];
  list.push(ev);
  inbox.set(code, list.slice(-50));
}

/** Returns and removes everything waiting for the host. */
export async function pullInbox(code: string): Promise<InboxEvent[]> {
  if (usingRedis) {
    const items: string[] = (await redis(["LRANGE", `gdinbox:${code}`, 0, -1])) ?? [];
    if (items.length) await redis(["LTRIM", `gdinbox:${code}`, items.length, -1]);
    return items.map((x) => JSON.parse(x) as InboxEvent);
  }
  const list = inbox.get(code) ?? [];
  inbox.set(code, []);
  return list;
}

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O, they look like 1 and 0
export function newCode() {
  return Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join("");
}

export function newKey() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** What guests are allowed to see: no keys. */
export function publicView(room: SharedRoom, since = 0) {
  return {
    code: room.code,
    status: room.status,
    hostName: room.hostName,
    friends: room.friends.map(({ id, name }) => ({ id, name })),
    config: room.config,
    lines: room.lines.slice(since),
    total: room.lines.length,
    state: room.state,
  };
}
