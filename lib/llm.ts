// Server-only helper. One code path for Gemini, Groq and OpenAI,
// because all three expose an OpenAI-compatible chat completions API.

type Provider = "gemini" | "groq" | "openai";

const PROVIDERS: Record<Provider, { baseUrl: string; model: string }> = {
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.5-flash",
  },
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
};

export function llmConfig() {
  const raw = (process.env.LLM_PROVIDER || "gemini").toLowerCase().trim();
  const provider: Provider = raw in PROVIDERS ? (raw as Provider) : "gemini";
  const apiKey = (process.env.LLM_API_KEY || "").trim();
  const model = (process.env.LLM_MODEL || "").trim() || PROVIDERS[provider].model;
  // Optional: any other OpenAI-compatible endpoint (for example OpenRouter).
  const baseUrl = (process.env.LLM_BASE_URL || "").trim().replace(/\/$/, "") || PROVIDERS[provider].baseUrl;
  return { provider, apiKey, model, baseUrl, demo: !apiKey };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// Free Gemini keys have small per-model rate limits and models get renamed over time.
// So for Gemini we keep a chain of models and move to the next one on 404 / 429 / 5xx.
const GEMINI_CHAIN = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-flash-latest"];
const cooldown = new Map<string, number>(); // model -> time it can be used again
let lastGood = "";

type LlmError = Error & { status?: number };

export async function chatJSON<T>(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {}
): Promise<T> {
  const cfg = llmConfig();
  if (cfg.demo) throw new Error("No API key set");

  const call = async (payload: Record<string, unknown>) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000);
    try {
      const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const err = new Error(`${payload.model} returned ${res.status}: ${text.replace(/\s+/g, " ").slice(0, 180)}`) as LlmError;
        err.status = res.status;
        throw err;
      }
      const data = await res.json();
      return String(data?.choices?.[0]?.message?.content ?? "");
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        const err = new Error(`${payload.model} timed out`) as LlmError;
        err.status = 504;
        throw err;
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  };

  const envModel = (process.env.LLM_MODEL || "").trim();
  let models = [cfg.model];
  if (cfg.provider === "gemini" && !envModel) {
    const now = Date.now();
    const ordered = lastGood ? [lastGood, ...GEMINI_CHAIN.filter((m) => m !== lastGood)] : GEMINI_CHAIN;
    const ready = ordered.filter((m) => (cooldown.get(m) ?? 0) <= now);
    models = ready.length ? ready : ordered;
  }

  let lastErr: LlmError | null = null;
  for (const model of models) {
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: opts.temperature ?? 0.9,
      max_tokens: opts.maxTokens ?? 300,
    };
    if (cfg.provider !== "gemini") body.response_format = { type: "json_object" };
    // Gemini 2.5 Flash "thinks" by default, which adds seconds of delay. Turn it off.
    if (cfg.provider === "gemini" && model.includes("2.5")) body.reasoning_effort = "none";
    try {
      let content: string;
      try {
        content = await call(body);
      } catch (e) {
        // Some models reject optional params. Retry once without them.
        if ((e as LlmError).status !== 400) throw e;
        const { response_format, reasoning_effort, ...rest } = body;
        void response_format;
        void reasoning_effort;
        content = await call(rest);
      }
      lastGood = model;
      return parseJSON<T>(content);
    } catch (e) {
      lastErr = e as LlmError;
      const st = lastErr.status ?? 0;
      if (st === 429) cooldown.set(model, Date.now() + 30000);
      if (st === 404) cooldown.set(model, Date.now() + 10 * 60000);
      const tryNext = models.length > 1 && (st === 404 || st === 429 || st >= 500);
      if (!tryNext) throw lastErr;
    }
  }
  throw lastErr ?? new Error("AI call failed");
}

export function parseJSON<T>(text: string): T {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new Error("Model did not return JSON");
  }
}
