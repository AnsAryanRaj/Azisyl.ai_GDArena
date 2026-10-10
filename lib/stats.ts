import type { Line } from "./types";

export function speakingStats(lines: Line[]) {
  const stats: Record<string, { seconds: number; words: number; turns: number }> = {};
  for (const l of lines) {
    const s = (stats[l.speakerId] ??= { seconds: 0, words: 0, turns: 0 });
    s.turns += 1;
    s.words += l.text.split(/\s+/).filter(Boolean).length;
    s.seconds += l.durationMs / 1000;
  }
  return stats;
}
