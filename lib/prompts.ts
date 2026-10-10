import { MODERATOR, panelFor } from "./personas";
import type { ChatMessage } from "./llm";
import type { Line, Plan, RoomConfig, TurnRequest } from "./types";

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

const SIDES: Record<string, string> = {
  arjun: "strongly one side (pick the side a confident person would grab)",
  priya: "the opposite side to Arjun, backed by evidence",
  kabir: "a nuanced position with an angle nobody else will raise",
  meera: "loosely on one side, but she keeps bringing in related side issues",
  rohan: "the middle ground, a practical compromise",
};

export function sideRule(config: RoomConfig) {
  const n = config.studentName;
  if (config.side === "for") return `${n} has chosen to argue IN FAVOUR of the topic.`;
  if (config.side === "against") return `${n} has chosen to argue AGAINST the topic.`;
  return `${n} has not picked a side and may argue either way.`;
}

export function planMessages(config: RoomConfig): ChatMessage[] {
  const panel = panelFor(config.panelSize);
  const who = panel.map((p) => `- "${p.id}": ${p.name}, ${p.role}. Takes ${SIDES[p.id]}.`).join("\n");
  const system = `You prepare a realistic campus placement group discussion so it has real disagreement.
For the topic, give each AI participant a position they will defend for the whole discussion.
${sideRule(config)}${config.side && config.side !== "open" ? ` So ${config.studentName} is properly challenged, give at least two AI participants the opposite side ("${config.side === "for" ? "against" : "for"}"), at most one the same side, and the rest "middle". Personalities still decide how they argue.` : ""}
${who}

For each participant give:
- "side": "for", "against" or "middle"
- "claim": their position in one specific sentence about this exact topic
- "points": 3 short, concrete arguments they can use one at a time. Use Indian context where it fits (colleges, companies, cities, rupees, real examples). No two participants share an argument.
${formatRule(config)}
${config.language === "hinglish" ? "Write claims and points in natural Hinglish (Roman script)." : "Write in simple English."}

Reply with JSON only, keyed by id: {"${panel[0].id}": {"side": "", "claim": "", "points": ["", "", ""]}}`;
  return [
    { role: "system", content: system },
    { role: "user", content: `Topic: "${config.topic}"${config.brief ? `\nCase details: ${config.brief}` : ""}` },
  ];
}

export function turnMessages(req: TurnRequest): ChatMessage[] {
  const { config } = req;
  const name = config.studentName;
  const panel = panelFor(config.panelSize);
  const roster = panel
    .map((p) => {
      const st = req.plan?.[p.id];
      const pos = st
        ? ` Position (${st.side}): ${st.claim} Arguments to use, one per turn: ${st.points.join(" | ")}.`
        : "";
      return `- id "${p.id}": ${p.name}, ${p.role}. ${p.style}${pos}`;
    })
    .join("\n");
  const last = req.transcript[req.transcript.length - 1];
  const recentHuman = last?.speakerId === "you" ? last : undefined;
  const humanBefore = !recentHuman && req.transcript[req.transcript.length - 2]?.speakerId === "you" ? req.transcript[req.transcript.length - 2] : undefined;

  const system = `You run a realistic campus placement group discussion (GD) for practice.
The human candidate is ${name}. You never speak for the human.

The panel, with the position each AI defends for the whole discussion:
${roster}
- id "moderator": ${MODERATOR.name}. ${MODERATOR.style}

${formatRule(config)}
${sideRule(config)} AIs on the other side should challenge ${name}'s arguments directly. AIs on the same side may back ${name} up, but only by adding a new reason.

How a real GD works, and how you must play it:
1. React first. Every line responds to something specific said just before it: name the person, quote or paraphrase their point, then agree, counter or build on it. No standalone speeches.
2. The human matters most. When ${name} has just spoken, the next speaker must answer ${name}'s exact point, by name. If the speaker's position disagrees, push back with a clear reason. If it agrees, add a new reason or example. Never ignore the human and never just praise them.
3. Keep your position. Each AI defends their own position all through the discussion. They may concede a small point ("fair point, but...") but never switch sides. When challenged, defend with a new argument.
4. Never repeat. Do not reuse an argument, example or phrase already in the transcript, including your own earlier lines. Use your next unused argument, a fresh example, a consequence, or a sharp counter-question.
5. Stay on this exact topic with concrete details. A generic line that could fit any topic is not allowed. Meera drifts, but to something related to this topic.
6. Spoken style: 1 to 3 short sentences, at most 40 words (Kabir under 25). Arjun may cut in with "Sorry to cut in" or "Let me stop you there". No lists, markdown, emojis or stage directions.
7. Who speaks next: never the human, never "${last?.speakerId ?? "none"}". Pick the person with the strongest reason to respond to the last point, often someone who disagrees. Arjun often, Kabir rarely.
8. The moderator speaks only to bring ${name} in, to point out that ${name} has been quiet, or to stop the group going in circles. The moderator never gives opinions.
9. No fake precise statistics; use "roughly" or "around".
10. ${languageRule(config)}

Reply with JSON only: {"speaker": "<id>", "text": "<spoken words>", "asksHuman": <true if the line ends with a direct question to ${name}, else false>}`;

  let task = `Topic: "${config.topic}"${config.brief ? `\nCase details: ${config.brief}` : ""}
Time left: about ${Math.max(0, Math.round(req.secondsLeft))} seconds.
Seconds since ${name} last spoke: ${Math.round(req.secondsSinceStudentSpoke)}.

Transcript so far:
${formatTranscript(req.transcript, config, 30) || "(nobody has spoken yet after the moderator's opening)"}
`;

  if (req.phase === "closing" && req.forceSpeaker) {
    const who = nameOf(req.forceSpeaker, config);
    task += `\nThis is the closing round. ${who} must speak now: one or two sentences that sum up their own position, mention one point from the discussion (including ${name}'s if relevant), under 35 words. Use speaker "${req.forceSpeaker}".`;
  } else if (req.ignoredAsks && req.ignoredAsks >= 1) {
    task += `\n${name} did not answer the last question. Use speaker "moderator": politely but clearly point out that ${name} has been quiet, say that in a real GD staying silent costs marks, then give ${name} the floor with one simple, specific question about a point already on the table. Set asksHuman true.`;
  } else if (recentHuman) {
    task += `\n${name} just said: "${recentHuman.text}". The next speaker must respond directly to this point, by name. Counter it if their position disagrees, or build on it with something new.`;
    if (req.askHuman) task += ` Then end with a short follow-up question to ${name}. Set asksHuman true.`;
  } else if (humanBefore && !req.askHuman) {
    task += `\n${name} said "${humanBefore.text}" just before the last reply. The next speaker may take the other side of that exchange: either back ${name} up or challenge ${name}, by name, with a new argument.`;
  } else if (req.askHuman) {
    task += `\n${name} has not spoken for a while. The next speaker reacts briefly to the last point, then ends with a specific question to ${name} by name, for example whether ${name} agrees with a claim someone just made. Set asksHuman true.`;
  }
  task += "\nWho speaks next, and what exactly do they say?";

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
${sideRule(config)}${config.side && config.side !== "open" ? " Judge whether they held that side and defended it with reasons when challenged; mention it in Quality of ideas." : ""}
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

Also give "overall" (1 to 10), "summary" (two plain sentences), and "missedOpenings": up to 3 moments where the candidate should have jumped in but did not (for example a direct question to them, a weak argument they could have countered, or a pause). For each: "afterLineId" (the line just before the opening), "why" (one short sentence on why it was an opening) and "youCouldHaveSaid" (one or two natural sentences they could have said, in their own side's voice).

Write in simple everyday English. Reply with JSON only:
{"summary": "", "overall": 0, "points": [{"area": "", "score": 0, "verdict": "", "tip": "", "quoteIds": [""]}], "missedOpenings": [{"afterLineId": "", "why": "", "youCouldHaveSaid": ""}]}`;

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
