// Demo mode: scripted but topic-aware replies, used when no API key is set
// or as a fallback when the AI call fails. Keeps the room usable offline.
import { MODERATOR, panelFor, personaById } from "./personas";
import type { Plan, Report, RoomConfig, TurnRequest, TurnResponse } from "./types";
import type { Stats } from "./prompts";

const topicOf = (c: RoomConfig) => c.topic.replace(/^case:\s*/i, "").replace(/[?.!]+$/, "");

export function mockPlan(config: RoomConfig): Plan {
  const t = topicOf(config);
  const all: Plan = {
    arjun: {
      side: "for",
      claim: `I strongly support it. On "${t}", the answer is yes.`,
      points: [
        "it pushes students and companies to move faster, and India cannot afford to wait",
        "the people who already tried it are seeing real results",
        "most of the resistance is just people protecting their comfort zone",
      ],
    },
    priya: {
      side: "against",
      claim: `I am not convinced. The evidence on "${t}" points the other way.`,
      points: [
        "the costs land first on students and families in small towns",
        "early results look good, but roughly half of them fade within a year",
        "nobody has a clear way to measure whether it is actually working",
      ],
    },
    kabir: {
      side: "middle",
      claim: "The real question is who gets left out.",
      points: ["students from tier-3 colleges and small towns", "the long-term effect five years from now", "what it does to fairness and trust"],
    },
    meera: {
      side: "for",
      claim: "I like the idea, mostly because of what I have seen around me.",
      points: ["my cousin's experience at a Bengaluru company", "how Instagram and YouTube are shaping this whole debate", "what countries like Japan are doing differently"],
    },
    rohan: {
      side: "middle",
      claim: "A phased approach with clear rules works best.",
      points: [
        "we could start with a pilot in a few colleges or cities",
        "we review it after six months with real data",
        "the rules could be different for freshers and for experienced people",
      ],
    },
  };
  // If the student argues for, Arjun (the loudest) takes the other side, and the reverse.
  if (config.side === "for") [all.arjun, all.priya] = [all.priya, all.arjun];
  if (config.side === "against") all.meera = { ...all.meera, side: "for" };
  const out: Plan = {};
  for (const p of panelFor(config.panelSize)) out[p.id] = all[p.id];
  return out;
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
const short = (x: string, n = 9) => {
  const w = x.replace(/[.?!]+$/, "").split(/\s+/);
  return w.length > n ? w.slice(0, n).join(" ") + "…" : w.join(" ");
};

export function mockTurn(req: TurnRequest): TurnResponse {
  const { config } = req;
  const name = config.studentName;
  const panel = panelFor(config.panelSize);
  const plan = req.plan ?? mockPlan(config);
  const lines = req.transcript;
  const last = lines[lines.length - 1];
  const res = (speakerId: string, text: string, asksHuman = false): TurnResponse => ({ speakerId, text, asksHuman, demo: true });

  if (req.forceSpeaker && plan[req.forceSpeaker]) {
    const st = plan[req.forceSpeaker];
    return res(req.forceSpeaker, `To conclude, my view has not changed. ${st.claim}`);
  }

  const someone = panel.find((p) => p.id !== last?.speakerId) ?? panel[0];
  if (req.ignoredAsks && req.ignoredAsks >= 1) {
    return res(
      MODERATOR.id,
      `${name}, we have not heard from you yet. In a real GD, staying silent costs marks. Do you agree with ${someone.name} that ${plan[someone.id]?.claim.replace(/\.$/, "").toLowerCase() ?? "this is the right approach"}?`,
      true
    );
  }
  if (req.secondsSinceStudentSpoke > 90 && last?.speakerId !== MODERATOR.id) {
    return res(MODERATOR.id, `${name}, you have been quiet for a while. What is your view on ${topicOf(config)}?`, true);
  }

  const weights: Record<string, number> = { arjun: 4, priya: 3, rohan: 3, meera: 2, kabir: 1 };
  const choices = panel.filter((p) => p.id !== last?.speakerId);
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
  const mine = plan[pick.id];
  const turnsSoFar = lines.filter((l) => l.speakerId === pick.id).length;
  const point = mine.points[turnsSoFar % mine.points.length];
  const again = turnsSoFar >= mine.points.length ? " Let me say it differently:" : "";

  let text: string;
  const friendName = config.friends?.find((f) => f.id === last?.speakerId)?.name;
  if (last && (last.speakerId === "you" || friendName)) {
    const q = short(last.text);
    const name = friendName ?? config.studentName;
    text =
      mine.side === "against"
        ? `${name}, you said "${q}", but I disagree.${again} ${cap(point)}.`
        : mine.side === "for"
          ? `I agree with ${name} on "${q}". And${again} ${point}.`
          : `${name} has a fair point about "${q}", but${again} ${point}.`;
  } else {
    const prev = personaById(last?.speakerId ?? "")?.name ?? "everyone";
    const prevSide = plan[last?.speakerId ?? ""]?.side;
    if (last?.speakerId === MODERATOR.id) text = `Let me start. ${mine.claim} ${cap(point)}.`;
    else if (pick.id === "kabir") text = `If I can add one thing to what ${prev} said, nobody has talked about ${point}.`;
    else if (pick.id === "meera") text = `This reminds me of ${point}. Isn't that connected to ${short(topicOf(config), 6)}?`;
    else if (pick.id === "rohan") text = `So ${prev} and the others see this differently. Maybe ${point}.`;
    else if (pick.id === "arjun" && prevSide !== mine.side) text = `Sorry to cut in, ${prev}, but${again} ${point}.`;
    else if (prevSide && prevSide === mine.side) text = `Building on what ${prev} said,${again} ${point}.`;
    else text = `${prev}, I hear you, but${again} ${point}.`;
  }
  if (req.askHuman) return res(pick.id, `${text} ${name}, what do you think?`, true);
  return res(pick.id, text);
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
        : `You spoke ${mine.length} times, for about ${Math.round(you.seconds)} seconds. Your points were on topic, but you can build more on what others said.`,
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
    missedOpening: null,
    missedOpenings: mockOpenings(transcript),
  };
}

/** Moments where the student could have come in: questions to them, and long runs without them. */
function mockOpenings(transcript: { id: string; speakerId: string; text: string }[]) {
  const out: { afterLineId: string; why: string; youCouldHaveSaid: string }[] = [];
  let streak = 0;
  transcript.forEach((l, i) => {
    const next = transcript[i + 1];
    if (l.speakerId === "you") {
      streak = 0;
      return;
    }
    if (l.speakerId !== "moderator") streak += 1;
    if (next?.speakerId === "you" || out.length >= 3) return;
    const who = personaById(l.speakerId)?.name ?? "they";
    if (l.text.includes("?") && i > 0) {
      out.push({
        afterLineId: l.id,
        why: `${who} asked you directly, and you let the question pass.`,
        youCouldHaveSaid: "Yes, and here is why. My main reason is practical: it changes what students can actually do, and I can give one example.",
      });
    } else if (streak === 3) {
      out.push({
        afterLineId: l.id,
        why: "Three people had spoken in a row. A short pause like this is the best time to enter.",
        youCouldHaveSaid: `If I can come in here, I see it a little differently from ${who}. Let me add one point nobody has raised yet.`,
      });
    }
  });
  return out;
}
