// Demo mode: scripted but varied replies, used when no API key is set
// or as a fallback when the AI call fails. Keeps the room usable offline.
import { panelFor } from "./personas";
import type { Report, TurnRequest, TurnResponse } from "./types";
import type { Stats } from "./prompts";

const BANK: Record<string, string[]> = {
  arjun: [
    "Let me be very clear, the answer here is obvious and most of us are overthinking it.",
    "With respect, that is not the real issue. The real issue is who actually benefits from this.",
    "Let me stop you there. Theory sounds nice, but companies care about results, not intentions.",
    "I completely disagree. If we keep saying 'it depends', we will never reach a conclusion.",
  ],
  priya: [
    "If we look at the data, roughly half of the surveys I have seen point the other way.",
    "That is a strong claim, Arjun. Do we have any evidence for it, or is it just a feeling?",
    "Around two thirds of recruiters say skills matter more than the label. That changes the picture.",
    "Let us separate opinion from facts. The trend over the last five years is fairly clear.",
  ],
  kabir: [
    "If I can add one thing, nobody has talked about how this affects small towns.",
    "Maybe the question is not yes or no, but who gets left out.",
    "One angle we missed is the long-term cost, not just the short-term gain.",
  ],
  meera: [
    "This reminds me of my cousin's company, they tried something similar and it was so chaotic.",
    "Actually, isn't the bigger problem that our syllabus is outdated? That is what really bothers me.",
    "Funny thing, I was reading about Japan's work culture yesterday, it is so different from ours.",
  ],
  rohan: [
    "I think Arjun and Priya are both partly right. Maybe the middle ground is a phased approach.",
    "So far we agree on the benefits, and we disagree on the cost. Can we focus on that?",
    "Building on what was just said, the solution could be different for freshers and seniors.",
  ],
};

const CLOSING: Record<string, string> = {
  arjun: "To conclude, my position stays the same: the benefits clearly outweigh the risks.",
  priya: "To sum up, the evidence supports it, but only with clear rules and measurement.",
  kabir: "In the end, we must make sure nobody gets left behind.",
  meera: "Overall, I think it can work, if people are open to change.",
  rohan: "So the group seems to agree on a balanced, step-by-step approach.",
};

export function mockTurn(req: TurnRequest): TurnResponse {
  const panel = panelFor(req.config.panelSize);
  if (req.forceSpeaker && CLOSING[req.forceSpeaker]) {
    return { speakerId: req.forceSpeaker, text: CLOSING[req.forceSpeaker], demo: true };
  }
  const last = req.transcript[req.transcript.length - 1]?.speakerId;
  if (req.secondsSinceStudentSpoke > 90 && last !== "moderator") {
    return {
      speakerId: "moderator",
      text: `${req.config.studentName}, we have not heard from you in a while. What is your view?`,
      demo: true,
    };
  }
  const weights: Record<string, number> = { arjun: 4, priya: 3, rohan: 3, meera: 2, kabir: 1 };
  const choices = panel.filter((p) => p.id !== last);
  const total = choices.reduce((s, p) => s + (weights[p.id] ?? 1), 0);
  let r = Math.random() * total;
  let pick = choices[0];
  for (const p of choices) {
    r -= weights[p.id] ?? 1;
    if (r <= 0) {
      pick = p;
      break;
    }
  }
  const used = new Set(req.transcript.map((l) => l.text));
  const options = BANK[pick.id].filter((t) => !used.has(t));
  const text = (options.length ? options : BANK[pick.id])[Math.floor(Math.random() * (options.length || BANK[pick.id].length))];
  return { speakerId: pick.id, text, demo: true };
}

export function mockReport(
  transcript: { id: string; speakerId: string; text: string }[],
  stats: Stats
): Report {
  const mine = transcript.filter((l) => l.speakerId === "you");
  const others = transcript.filter((l) => l.speakerId !== "you" && l.speakerId !== "moderator");
  const you = stats["you"] ?? { seconds: 0, words: 0, turns: 0 };
  const firstOther = transcript.find((l) => l.speakerId !== "moderator");
  const spokeFirst = firstOther?.speakerId === "you";
  const q = (arr: typeof transcript, i: number) => (arr[i] ? [arr[i].id] : others[0] ? [others[0].id] : []);
  const s = (n: number) => Math.max(1, Math.min(5, n));
  const base = mine.length === 0 ? 1 : mine.length < 3 ? 2 : 3;

  return {
    demo: true,
    summary:
      mine.length === 0
        ? "You did not speak in this discussion, so the panel could not assess you. Next time, aim to make your first point in the first minute."
        : `You spoke ${mine.length} times, for about ${Math.round(you.seconds)} seconds. This is a demo report; add an API key for detailed AI feedback.`,
    overall: Math.max(1, Math.min(10, base * 2 + (spokeFirst ? 1 : 0))),
    points: [
      {
        area: "Starting the discussion",
        score: s(spokeFirst ? 4 : 2),
        verdict: spokeFirst ? "You opened the discussion, which panels notice." : "Someone else opened the discussion before you.",
        tip: "Prepare a 15 second opener: define the topic, give one angle, invite others.",
        quoteIds: q(transcript.filter((l) => l.speakerId !== "moderator"), 0),
      },
      { area: "Quality of ideas", score: s(base), verdict: "Your points were on topic.", tip: "Back each point with one example or rough number.", quoteIds: q(mine, 0) },
      { area: "Building on others", score: s(base - 1), verdict: "You rarely referred to others by name.", tip: "Start with 'Building on what Priya said' to show you were listening.", quoteIds: q(mine, 1) },
      { area: "Listening", score: s(base), verdict: "You responded to the flow of the discussion.", tip: "Note one point from each speaker so you can reply to it.", quoteIds: q(others, 1) },
      { area: "Handling interruptions", score: s(base - 1), verdict: "Arjun took the floor often and you did not push back.", tip: "Say 'Let me finish my point' calmly, then complete it in one sentence.", quoteIds: q(others.filter((l) => l.speakerId === "arjun"), 0) },
      { area: "Ending strongly", score: s(base), verdict: "Your conclusion was short.", tip: "Summarise both sides in one line, then state your final position.", quoteIds: q(mine, mine.length - 1) },
    ],
    missedOpening: others[1]
      ? { afterLineId: others[1].id, youCouldHaveSaid: "That is a fair point, but we should also look at who this affects the most." }
      : null,
  };
}
