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
  return { provider, apiKey, model, baseUrl: PROVIDERS[provider].baseUrl, demo: !apiKey };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chatJSON<T>(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {}
): Promise<T> {
  const cfg = llmConfig();
  if (cfg.demo) throw new Error("No API key set");

  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    temperature: opts.temperature ?? 0.9,
    max_tokens: opts.maxTokens ?? 300,
  };
  if (cfg.provider !== "gemini") body.response_format = { type: "json_object" };
  // Gemini 2.5 Flash "thinks" by default, which adds seconds of delay. Turn it off.
  if (cfg.provider === "gemini") body.reasoning_effort = "none";

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
        const err = new Error(`LLM ${res.status}: ${text.slice(0, 200)}`) as Error & { status?: number };
        err.status = res.status;
        throw err;
      }
      const data = await res.json();
      return String(data?.choices?.[0]?.message?.content ?? "");
    } finally {
      clearTimeout(timer);
    }
  };

  let content: string;
  try {
    content = await call(body);
  } catch (e) {
    // Some models reject optional params. Retry once without them.
    const status = (e as { status?: number }).status;
    if (status === 400) {
      const { response_format, reasoning_effort, ...rest } = body;
      void response_format;
      void reasoning_effort;
      content = await call(rest);
    } else {
      throw e;
    }
  }
  return parseJSON<T>(content);
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
