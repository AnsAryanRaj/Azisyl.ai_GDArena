import { MODERATOR, panelFor } from "./personas";
import type { ChatMessage } from "./llm";
import type { Line, RoomConfig, TurnRequest } from "./types";

type TLine = Pick<Line, "id" | "speakerId" | "text">;

export function nameOf(id: string, config: RoomConfig) {
  if (id === "you") return `${config.studentName} (the human candidate)`;
  if (id === MODERATOR.id) return `${MODERATOR.name} (moderator)`;
  return panelFor(5).find((p) => p.id === id)?.name ?? id;
}

export function formatTranscript(lines: TLine[], config: RoomConfig, max = 40) {
  return lines
    .slice(-max)
    .map((l) => `[${l.id}] ${nameOf(l.speakerId, config)}: ${l.text}`)
    .join("\n");
}

function languageRule(config: RoomConfig) {
  return config.language === "hinglish"
    ? "Speak in Hinglish: natural Hindi-English mix written in Roman script, the way Indian college students talk (for example: 'Dekho, mujhe lagta hai ki remote work se productivity actually badhti hai'). Keep it easy to read aloud."
    : "Speak in clear, simple Indian English.";
}

export function formatRule(config: RoomConfig) {
  switch (config.format) {
    case "case":
      return `This is a case-based GD. The case: ${config.brief ?? config.topic}. Participants analyse the problem, propose concrete options, weigh trade-offs with numbers where useful, and push towards a recommendation.`;
    case "controversial":
      return "This is a controversial-topic GD. Participants take clear, opposing sides and disagree sharply but stay respectful and avoid personal attacks or hateful remarks. The moderator steps in if anyone gets personal.";
    case "fishbowl":
      return `This is a fishbowl GD: ${config.studentName} first watches silently, then joins. While the human is watching, the AI participants debate among themselves and do not address the human.`;
    default:
      return "This is a standard topic GD.";
  }
}

export function turnMessages(req: TurnRequest): ChatMessage[] {
  const { config } = req;
  const panel = panelFor(config.panelSize);
  const roster = panel
    .map((p) => `- id "${p.id}": ${p.name}, ${p.role}. ${p.style}`)
    .join("\n");
  const last = req.transcript[req.transcript.length - 1];

  const system = `You run a realistic campus placement group discussion (GD) simulation for practice.
The human candidate is ${config.studentName}. You never speak for the human.

AI participants:
${roster}
- id "moderator": ${MODERATOR.name}. ${MODERATOR.style}

${formatRule(config)}

Your job: choose who speaks next and write exactly what they say out loud.

Rules:
- Never choose the human. Never choose "${last?.speakerId ?? "none"}" (they just spoke).
- People talk to each other, not only to the human: refer to earlier speakers by name, agree, disagree, rebut or build on a specific point. If the human spoke recently, someone should react to their point.
- 1 to 3 short spoken sentences, at most 45 words. Kabir stays under 25 words. No lists, markdown, stage directions or emojis.
- Arjun speaks often, Kabir rarely. Meera drifts off topic and others may pull her back.
- Do not repeat a point already made. Move the discussion forward with new angles.
- Choose the moderator only if the human has been silent for more than 90 seconds (then invite them by name), or if the group is going in circles.
- No fake precise statistics; use words like "roughly" or "around".
- ${languageRule(config)}

Reply with JSON only: {"speaker": "<id>", "text": "<what they say>"}`;

  let task = `Topic: "${config.topic}"${config.brief ? `\nCase details: ${config.brief}` : ""}
Time left: about ${Math.max(0, Math.round(req.secondsLeft))} seconds.
Seconds since ${config.studentName} last spoke: ${Math.round(req.secondsSinceStudentSpoke)}.

Transcript so far:
${formatTranscript(req.transcript, config) || "(nobody has spoken yet after the moderator's opening)"}

Who speaks next, and what do they say?`;

  if (req.phase === "closing" && req.forceSpeaker) {
    const who = nameOf(req.forceSpeaker, config);
    task += `\n\nThis is the closing round. ${who} must speak now and give a one or two sentence conclusion of their own view, under 35 words. Use speaker "${req.forceSpeaker}".`;
  }

  return [
    { role: "system", content: system },
    { role: "user", content: task },
  ];
}

export interface Stats {
  [speakerId: string]: { seconds: number; words: number; turns: number };
}

export function reportMessages(config: RoomConfig, transcript: TLine[], stats: Stats): ChatMessage[] {
  const you = stats["you"] ?? { seconds: 0, words: 0, turns: 0 };
  const firstAfterModerator = transcript.find((l) => l.speakerId !== "moderator");
  const statLines = Object.entries(stats)
    .map(([id, s]) => `${nameOf(id, config)}: ${s.turns} turns, ${s.words} words, ~${Math.round(s.seconds)}s`)
    .join("\n");

  const system = `You are a strict but kind placement GD assessor at an Indian campus.
Assess ONLY the human candidate, ${config.studentName}, whose lines are marked "(the human candidate)".
${formatRule(config)}${config.format === "fishbowl" ? " In a fishbowl, give extra weight to how well they used what they heard while watching. Do not mark them down for not starting the discussion." : ""}
Be honest and specific. If they barely spoke, say so plainly. Do not praise things that did not happen.

Score these six areas from 1 (poor) to 5 (excellent), in this order:
1. Starting the discussion
2. Quality of ideas
3. Building on others
4. Listening
5. Handling interruptions
6. Ending strongly

For each area give:
- "verdict": one honest sentence about what they actually did
- "tip": one specific, practical sentence on what to do next time
- "quoteIds": 1 or 2 transcript line ids (like "L4") that prove the verdict. Use the candidate's own lines where possible; use another person's line when the point is about a moment the candidate missed or handled.

Also give "overall" (1 to 10), "summary" (two plain sentences), and "missedOpening": one moment after line id X where the candidate should have jumped in, with a sample line they could have said.

Write in simple everyday English. Reply with JSON only:
{"summary": "", "overall": 0, "points": [{"area": "", "score": 0, "verdict": "", "tip": "", "quoteIds": [""]}], "missedOpening": {"afterLineId": "", "youCouldHaveSaid": ""}}`;

  const user = `Topic: "${config.topic}"${config.brief ? `\nCase details: ${config.brief}` : ""}

Speaking stats:
${statLines}
The candidate spoke ${you.turns} times. First person to speak after the moderator: ${
    firstAfterModerator ? nameOf(firstAfterModerator.speakerId, config) : "nobody"
  }.

Full transcript:
${formatTranscript(transcript, config, 200)}`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
