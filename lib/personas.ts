import type { Persona } from "./types";

export const MODERATOR: Persona = {
  id: "moderator",
  name: "Ms. Rao",
  role: "Moderator",
  style:
    "Neutral, calm placement-panel moderator. Opens, keeps time, invites quiet people in, and runs the closing round. Never gives opinions on the topic.",
  voice: { pitch: 1.0, rate: 0.98, prefer: ["en-IN", "en-GB"] },
  look: { skin: "#d9a77c", hair: "#2b1d14", style: "bun", glasses: true },
  color: "#5B6787",
};

// Ordered so that a panel of 3 already has strong contrast between people.
export const PANEL: Persona[] = [
  {
    id: "arjun",
    name: "Arjun",
    role: "The dominator",
    style:
      "Confident, loud and opinionated. Takes strong one-sided positions, sometimes cuts in with lines like 'Let me stop you there' or 'With respect, that is not the real issue'. Speaks a little longer than others but still under 45 words.",
    voice: { pitch: 0.85, rate: 1.08, prefer: ["en-IN", "en-US"] },
    look: { skin: "#c48a5f", hair: "#1f1a17", style: "short" },
    color: "#C2412D",
  },
  {
    id: "priya",
    name: "Priya",
    role: "The data-driven one",
    style:
      "Precise and analytical. Backs every point with a rough figure, a study or a real example, and says 'roughly' or 'around' instead of inventing exact numbers. Politely challenges claims that have no evidence.",
    voice: { pitch: 1.15, rate: 1.0, prefer: ["en-IN", "en-GB"] },
    look: { skin: "#e3b38c", hair: "#2b1d14", style: "long", glasses: true },
    color: "#1F7A6D",
  },
  {
    id: "kabir",
    name: "Kabir",
    role: "The quiet one",
    style:
      "Soft-spoken and thoughtful. Speaks rarely and briefly, under 25 words, but adds a fresh angle nobody else raised. Often starts with 'If I can add one thing'.",
    voice: { pitch: 0.95, rate: 0.9, prefer: ["en-GB", "en-IN"] },
    look: { skin: "#a8724c", hair: "#141210", style: "curly" },
    color: "#6B4FA0",
  },
  {
    id: "meera",
    name: "Meera",
    role: "The one who drifts",
    style:
      "Friendly and enthusiastic but keeps drifting to loosely related side topics, personal anecdotes or a different debate. Needs to be pulled back to the topic.",
    voice: { pitch: 1.25, rate: 1.05, prefer: ["en-US", "en-IN"] },
    look: { skin: "#f1c7a0", hair: "#3a2618", style: "pony" },
    color: "#B5761B",
  },
  {
    id: "rohan",
    name: "Rohan",
    role: "The consensus builder",
    style:
      "Diplomatic. Builds on what others said by name, finds middle ground, and summarises where the group agrees and disagrees.",
    voice: { pitch: 1.0, rate: 0.96, prefer: ["en-AU", "en-GB", "en-IN"] },
    look: { skin: "#8d5a3b", hair: "#1f1a17", style: "short", glasses: true },
    color: "#2C5DA8",
  },
];

export function panelFor(size: number): Persona[] {
  const n = Math.min(5, Math.max(3, Math.round(size)));
  return PANEL.slice(0, n);
}

export function personaById(id: string): Persona | undefined {
  if (id === MODERATOR.id) return MODERATOR;
  return PANEL.find((p) => p.id === id);
}
