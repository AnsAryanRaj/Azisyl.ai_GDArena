// Natural voices with OpenAI text to speech (server side only).
// If the key is missing, the quota runs out or the call fails, the browser voices take over.

export function ttsConfig() {
  const key = process.env.TTS_API_KEY || (process.env.LLM_PROVIDER === "openai" ? process.env.LLM_API_KEY : "") || "";
  const base = (process.env.TTS_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.TTS_MODEL || "gpt-4o-mini-tts";
  return { key, base, model, enabled: Boolean(key) };
}

// One voice per person, matched to their gender, so the room sounds like different people.
const VOICES: Record<string, { voice: string; tone: string }> = {
  moderator: { voice: "sage", tone: "Calm, clear and in charge, like a fair GD moderator." },
  priya: { voice: "nova", tone: "Precise and confident, quoting facts." },
  meera: { voice: "shimmer", tone: "Soft-spoken and thoughtful, a little hesitant." },
  arjun: { voice: "onyx", tone: "Assertive and fast, keen to hold the floor." },
  kabir: { voice: "echo", tone: "Friendly and relaxed, a bit chatty." },
  rohan: { voice: "ash", tone: "Warm and balanced, trying to bring people together." },
  f1: { voice: "coral", tone: "Natural and conversational." },
  f2: { voice: "fable", tone: "Natural and conversational." },
  f3: { voice: "verse", tone: "Natural and conversational." },
  f4: { voice: "ballad", tone: "Natural and conversational." },
};
const OLD_MODEL_VOICES = new Set(["alloy", "ash", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer"]);

export function voiceFor(id: string) {
  return VOICES[id] ?? { voice: "alloy", tone: "Natural and conversational." };
}

// Shared by all requests on this server: after a quota or key error, stop calling for a while.
let pausedUntil = 0;
let pausedReason = "";
export const ttsPaused = () => (Date.now() < pausedUntil ? pausedReason : "");
function pause(ms: number, reason: string) {
  pausedUntil = Date.now() + ms;
  pausedReason = reason;
}

export type TtsResult = { ok: true; audio: ArrayBuffer; type: string } | { ok: false; reason: string; status: number };

async function call(model: string, text: string, id: string): Promise<Response> {
  const { key, base } = ttsConfig();
  const v = voiceFor(id);
  const oldModel = !/gpt-4o/.test(model);
  const body: Record<string, unknown> = {
    model,
    input: text,
    voice: oldModel && !OLD_MODEL_VOICES.has(v.voice) ? "alloy" : v.voice,
    response_format: "mp3",
  };
  if (oldModel) body.speed = 1.05;
  else
    body.instructions = `You are a college student in India speaking in a campus group discussion. Use a natural Indian English accent and a normal speaking pace. ${v.tone}`;
  return fetch(`${base}/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });
}

export async function synthesize(text: string, id: string): Promise<TtsResult> {
  const cfg = ttsConfig();
  if (!cfg.enabled) return { ok: false, reason: "off", status: 503 };
  const paused = ttsPaused();
  if (paused) return { ok: false, reason: paused, status: 503 };
  let res: Response;
  try {
    res = await call(cfg.model, text, id);
    // The newer model may not be on this key yet: try the classic one once.
    if ((res.status === 400 || res.status === 404) && cfg.model !== "tts-1") res = await call("tts-1", text, id);
  } catch {
    return { ok: false, reason: "network", status: 504 };
  }
  if (res.ok) return { ok: true, audio: await res.arrayBuffer(), type: res.headers.get("content-type") || "audio/mpeg" };

  const detail = (await res.text().catch(() => "")).slice(0, 400);
  if (res.status === 401 || res.status === 403) {
    pause(60 * 60 * 1000, "key");
    return { ok: false, reason: "key", status: 503 };
  }
  if (res.status === 429 && /insufficient_quota|quota|billing/i.test(detail)) {
    pause(30 * 60 * 1000, "quota");
    return { ok: false, reason: "quota", status: 503 };
  }
  if (res.status === 429) {
    pause(20 * 1000, "rate");
    return { ok: false, reason: "rate", status: 503 };
  }
  console.warn("[tts]", res.status, detail.slice(0, 200));
  return { ok: false, reason: "error", status: 503 };
}
