import type { Language, RoomConfig } from "./types";

const clean = (v: unknown, max: number) =>
  String(v ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export function cleanConfig(raw: unknown): RoomConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const topic = clean(r.topic, 160);
  if (topic.length < 2) return null;
  const panelSize = Math.min(5, Math.max(3, Math.round(Number(r.panelSize) || 4)));
  const minutes = Math.min(15, Math.max(2, Math.round(Number(r.minutes) || 6)));
  const language: Language = r.language === "hinglish" ? "hinglish" : "english";
  const studentName = clean(r.studentName, 30) || "Candidate";
  return { topic, panelSize, minutes, language, studentName };
}

const ID = /^L\d{1,4}$/;
const SPEAKER = /^(you|moderator|arjun|priya|kabir|meera|rohan)$/;

export function cleanTranscript(raw: unknown, maxLines = 200) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-maxLines)
    .map((l) => {
      const o = (l ?? {}) as Record<string, unknown>;
      return { id: clean(o.id, 6), speakerId: clean(o.speakerId, 12), text: clean(o.text, 600) };
    })
    .filter((l) => ID.test(l.id) && SPEAKER.test(l.speakerId) && l.text.length > 0);
}
