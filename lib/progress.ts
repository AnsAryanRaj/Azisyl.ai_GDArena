"use client";
// Progress across sessions, stored only in this browser.

export interface HistoryItem {
  date: string;
  topic: string;
  format?: string;
  overall: number;
  youSeconds: number;
  youShare?: number; // percent of speaking time
  turns?: number;
  spokeFirst?: boolean;
  points?: { area: string; score: number }[];
}

// Each account (or the guest) gets its own history on this device.
let owner = "guest";
export function setHistoryOwner(key: string) {
  owner = key;
}
const keyFor = () => (owner === "guest" ? "gd-history" : `gd-history:${owner}`);

export function readHistory(): HistoryItem[] {
  try {
    const v = JSON.parse(localStorage.getItem(keyFor()) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function addHistory(item: HistoryItem) {
  try {
    localStorage.setItem(keyFor(), JSON.stringify([item, ...readHistory()].slice(0, 30)));
  } catch {}
}

export function summarise(history: HistoryItem[]) {
  const withPoints = history.filter((h) => h.points?.length);
  const areas = new Map<string, number[]>();
  for (const h of withPoints) for (const p of h.points!) areas.set(p.area, [...(areas.get(p.area) ?? []), p.score]);
  const skills = [...areas.entries()].map(([area, scores]) => ({
    area,
    avg: scores.reduce((a, b) => a + b, 0) / scores.length,
    last: scores[0],
  }));
  const sorted = [...skills].sort((a, b) => b.avg - a.avg);
  const shares = history.filter((h) => typeof h.youShare === "number").map((h) => h.youShare!);
  const firsts = history.filter((h) => typeof h.spokeFirst === "boolean");
  const overall = history.map((h) => h.overall);
  return {
    sessions: history.length,
    avgOverall: overall.length ? overall.reduce((a, b) => a + b, 0) / overall.length : 0,
    trend: overall.length >= 2 ? overall[0] - overall[overall.length - 1] : 0,
    skills,
    strongest: sorted[0],
    weakest: sorted[sorted.length - 1],
    avgShare: shares.length ? shares.reduce((a, b) => a + b, 0) / shares.length : null,
    openedCount: firsts.filter((h) => h.spokeFirst).length,
    openedOf: firsts.length,
  };
}
