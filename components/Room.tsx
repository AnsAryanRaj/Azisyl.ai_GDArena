"use client";
import { useEffect, useRef, useState } from "react";
import { friendLook, MODERATOR, panelFor, personaById } from "@/lib/personas";
import {
  assignVoices,
  cloudVoiceAvailable,
  estimateMs,
  Listener,
  onCloudVoiceOff,
  preloadVoice,
  setCloudVoiceWanted,
  speak,
  stopSpeaking,
  sttSupported,
  type AssignedVoice,
  type ListenError,
} from "@/lib/speech";
import type { Line, Plan, RoomConfig, TurnResponse } from "@/lib/types";
import Avatar from "./Avatar";
import { LogoMark, MicIcon, StopIcon } from "./Icons";
import Table from "./Table";

type Phase = "intro" | "discussion" | "closing" | "done";
type MicState = "ok" | "denied" | "nomic" | "unsupported" | "network";

interface Props {
  config: RoomConfig;
  onDone: (lines: Line[]) => void;
  onLeave: () => void;
  shared?: { code: string; hostKey: string }; // set when friends are in this room
}

// After this many AI lines in a row, the next speaker asks the student directly.
const ASK_AFTER = 2;
// How long the room holds the floor after someone asks the student a question.
const ANSWER_WAIT_MS = 8000;

const fmt = (s: number) => {
  const v = Math.max(0, Math.ceil(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
};

export default function Room({ config, onDone, onLeave, shared }: Props) {
  const panel = panelFor(config.panelSize);
  const friends = config.friends ?? [];
  const hinglish = config.language === "hinglish";

  /* ---------- render state ---------- */
  const [lines, setLines] = useState<Line[]>([]);
  const [phase, setPhaseState] = useState<Phase>("intro");
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [caption, setCaption] = useState<{ who: string; text: string } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [talking, setTalking] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(config.minutes * 60);
  const [mic, setMic] = useState<MicState>("ok");
  const [online, setOnline] = useState(true);
  const [typeOpen, setTypeOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [aiError, setAiError] = useState(false);
  const [awaitingClosing, setAwaitingClosing] = useState(false);
  const [patience, setPatience] = useState(1.2);
  const [voiceOn, setVoiceOn] = useState(true);
  const [nudgeAfter, setNudgeAfter] = useState(60); // seconds of silence before a nudge, 0 = off
  const [readFriends, setReadFriends] = useState(true);
  const [cloudShown, setCloudShown] = useState(() => cloudVoiceAvailable()); // natural voices set up on the server
  const [naturalOn, setNaturalOn] = useState(true);
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [fallbackReason, setFallbackReason] = useState("");
  const [askedBy, setAskedBy] = useState<string | null>(null); // who just asked the student a question
  const [watchLeft, setWatchLeft] = useState(0);
  const fishbowl = config.format === "fishbowl";
  const watchMs = Math.round(Math.min(90, Math.max(45, config.minutes * 60 * 0.3)) * 1000);
  const watching = watchLeft > 0;

  /* ---------- engine refs (the async loop reads these, never stale state) ---------- */
  const linesRef = useRef<Line[]>([]);
  const phaseRef = useRef<Phase>("intro");
  const genRef = useRef(0); // bumps whenever the student barges in or the phase changes
  const busyRef = useRef(false);
  const readingRef = useRef(0); // non-zero while a friend's point is being read aloud on this device
  const talkingRef = useRef(false);
  const onlineRef = useRef(true);
  const startRef = useRef(0);
  const talkStartRef = useRef(0);
  const lastYouRef = useRef(0);
  const lastNudgeRef = useRef(0);
  const failuresRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voicesRef = useRef<Map<string, AssignedVoice>>(new Map());
  const listenerRef = useRef<Listener | null>(null);
  const prefetchRef = useRef<{ key: number; gen: number; promise: Promise<TurnResponse | null> } | null>(null);
  const settingsRef = useRef({ patience: 1.2, voiceOn: true, nudgeAfter: 60, readFriends: true });
  const awaitingClosingRef = useRef(false);
  const watchUntilRef = useRef(0); // fishbowl: student watches until this time
  const inviteDueRef = useRef(false);
  const planRef = useRef<Plan | undefined>(undefined);
  const aiStreakRef = useRef(0); // AI lines since the student last spoke
  const ignoredAsksRef = useRef(0); // direct questions the student let pass in a row
  const awaitingAnswerRef = useRef(false);
  const mountedRef = useRef(true);
  const listRef = useRef<HTMLOListElement>(null);
  const typeInputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  settingsRef.current = { patience, voiceOn, nudgeAfter, readFriends };

  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };

  const showToast = (msg: string, ms = 4500) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  };

  const elapsed = () => (startRef.current ? performance.now() - startRef.current : 0);

  const addLine = (speakerId: string, text: string, extra: Partial<Line> = {}) => {
    const line: Line = {
      id: `L${linesRef.current.length + 1}`,
      speakerId,
      text,
      startedAt: Math.max(0, elapsed()),
      durationMs: 0,
      ...extra,
    };
    linesRef.current = [...linesRef.current, line];
    setLines(linesRef.current);
    return line;
  };

  const patchLine = (id: string, patch: Partial<Line>) => {
    linesRef.current = linesRef.current.map((l) => (l.id === id ? { ...l, ...patch } : l));
    setLines(linesRef.current);
  };

  // How the moderator addresses the student when they did not type a name.
  const named = config.studentName.trim().toLowerCase() !== "you";
  const call = named ? `${config.studentName}, ` : "";
  const nameOf = (id: string) =>
    id === "you" ? config.studentName : friends.find((f) => f.id === id)?.name ?? personaById(id)?.name ?? id;

  /* ---------- talking to the server ---------- */

  const requestTurn = async (forceSpeaker?: string): Promise<TurnResponse> => {
    const body = JSON.stringify({
      config,
      phase: phaseRef.current === "closing" ? "closing" : "discussion",
      forceSpeaker,
      transcript: linesRef.current.map(({ id, speakerId, text }) => ({ id, speakerId, text })),
      secondsLeft: config.minutes * 60 - elapsed() / 1000,
      plan: planRef.current,
      // Give the student a real chance: every third AI line asks them something directly.
      askHuman:
        phaseRef.current === "discussion" && performance.now() >= watchUntilRef.current && aiStreakRef.current >= ASK_AFTER,
      ignoredAsks: ignoredAsksRef.current,
      secondsSinceStudentSpoke:
        performance.now() < watchUntilRef.current
          ? 0
          : (performance.now() - (lastYouRef.current || watchUntilRef.current || startRef.current || performance.now())) / 1000,
    });
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch("/api/turn", { method: "POST", headers: { "Content-Type": "application/json" }, body });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as TurnResponse & { fallback?: boolean };
        if (data.fallback) {
          setFallbackUsed(true);
          if (data.reason) setFallbackReason(data.reason);
        }
        return data;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 600));
      }
    }
    throw lastErr;
  };

  /* ---------- one AI line, spoken out loud ---------- */

  const aiSpeak = async (speakerId: string, text: string, asksHuman = false) => {
    const persona = personaById(speakerId) ?? MODERATOR;
    const line = addLine(speakerId, text);
    if (phaseRef.current === "discussion") aiStreakRef.current += 1;
    setThinking(false);
    setSpeakingId(speakerId);
    setCaption({ who: persona.name, text });

    // While this line plays, start fetching the next one so there is no dead air.
    // Not when the line asks the student something: then we wait for their answer first.
    if (phaseRef.current === "discussion" && !asksHuman) {
      const gen = genRef.current;
      prefetchRef.current = {
        key: linesRef.current.length,
        gen,
        promise: requestTurn()
          .then((r) => {
            // Make the next line's natural voice while this one is still playing.
            if (r && settingsRef.current.voiceOn) preloadVoice(r.text, r.speakerId);
            return r;
          })
          .catch(() => null),
      };
    }

    const res = await speak(text, persona, voicesRef.current.get(speakerId), settingsRef.current.voiceOn);
    const patch: Partial<Line> = { durationMs: res.durationMs };
    if (res.interrupted) {
      patch.interrupted = true;
      if (res.spokenChars > 0 && res.spokenChars < text.length) patch.text = text.slice(0, res.spokenChars).trim() + "…";
    }
    patchLine(line.id, patch);
    if (!talkingRef.current) {
      setSpeakingId(null);
    }
    return res;
  };

  /* ---------- the discussion loop ---------- */

  const clearNext = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  };

  const scheduleNext = (delayMs = settingsRef.current.patience * 1000) => {
    clearNext();
    if (phaseRef.current !== "discussion" || talkingRef.current || busyRef.current || readingRef.current || !onlineRef.current) return;
    if (friendTalkingRef.current.size > 0) return; // a friend has the floor
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      runTurn();
    }, delayMs);
  };

  const timeUp = () => elapsed() / 1000 >= config.minutes * 60;

  const runTurn = async () => {
    if (!mountedRef.current || phaseRef.current !== "discussion" || talkingRef.current || busyRef.current || readingRef.current) return;
    if (friendTalkingRef.current.size > 0) return;
    if (timeUp()) return startClosing(false);
    if (awaitingAnswerRef.current) {
      // The student let a direct question pass.
      awaitingAnswerRef.current = false;
      setAskedBy(null);
      prefetchRef.current = null;
      ignoredAsksRef.current += 1;
      if (ignoredAsksRef.current >= 2) {
        // Called out once already. Let the discussion flow and ask again later.
        ignoredAsksRef.current = 0;
        aiStreakRef.current = 0;
      }
    }
    busyRef.current = true;
    const gen = genRef.current;
    let asked = false;
    setThinking(true);
    try {
      if (inviteDueRef.current) {
        // Fishbowl: watching time is over, the moderator brings the student in.
        inviteDueRef.current = false;
        prefetchRef.current = null;
        await aiSpeak(
          MODERATOR.id,
          hinglish
            ? `Thank you. ${call}aapne sab suna. Ab aap discussion join kijiye. Aap kya sochte hain?`
            : `Thank you. ${named ? call + "you" : "You"} have been listening to all of this. Please join in now. What is your view?`
        );
        lastYouRef.current = performance.now();
        showToast("Your turn. Tap Speak to join the discussion.", 5000);
      } else {
        let turn: TurnResponse | null = null;
        const pf = prefetchRef.current;
        if (pf && pf.key === linesRef.current.length && pf.gen === gen) turn = await pf.promise;
        prefetchRef.current = null;
        if (!turn) turn = await requestTurn();
        if (gen !== genRef.current || talkingRef.current || phaseRef.current !== "discussion") return;
        failuresRef.current = 0;
        setAiError(false);
        asked = Boolean(turn.asksHuman) && performance.now() >= watchUntilRef.current;
        await aiSpeak(turn.speakerId, turn.text, asked);
      }
    } catch {
      failuresRef.current += 1;
      if (failuresRef.current >= 2) setAiError(true);
    } finally {
      busyRef.current = false;
      setThinking(false);
    }
    if (gen !== genRef.current || phaseRef.current !== "discussion") {
      // The student cut in while this turn was running. If they typed (so they are not
      // still talking) and nothing is queued, carry the discussion on from their point.
      if (phaseRef.current === "discussion" && !talkingRef.current && !timeoutRef.current && !awaitingAnswerRef.current)
        scheduleNext();
      return;
    }
    if (timeUp()) return startClosing(false);
    if (failuresRef.current >= 2) return; // wait for "Try again"
    if (asked && !talkingRef.current) {
      // Someone asked the student directly. Hold the floor for them.
      const who = personaById(linesRef.current[linesRef.current.length - 1]?.speakerId ?? "")?.name ?? "The panel";
      awaitingAnswerRef.current = true;
      setAskedBy(who);
      showToast(`${who} asked you. Tap Speak to answer.`, 6000);
      scheduleNext(ANSWER_WAIT_MS + settingsRef.current.patience * 1000);
      return;
    }
    scheduleNext(failuresRef.current ? 2500 : undefined);
  };

  /* ---------- intro and closing ---------- */

  const intro = async () => {
    const gen = genRef.current;
    const names = [...panel.map((p) => p.name), ...friends.map((f) => f.name)].join(", ");
    const dot = (t: string) => (/[.?!]$/.test(t) ? t : `${t}.`);
    const topic = dot(config.topic.replace(/^case:\s*/i, ""));
    const f = config.format;
    const what =
      f === "case" && config.brief
        ? hinglish
          ? `Aaj ka case hai: ${dot(config.brief)}`
          : `Today's case is this. ${dot(config.brief)}`
        : hinglish
          ? `Aaj ka topic hai: ${topic}`
          : `Today's topic is: ${topic}`;
    const extra =
      f === "controversial"
        ? hinglish
          ? " Ye topic sensitive hai, isliye ideas se disagree kijiye, logon se nahi."
          : " This topic can get heated, so please disagree with ideas, not people."
        : "";
    const ending =
      f === "fishbowl"
        ? hinglish
          ? `${named ? call + "ye" : "Ye"} fishbowl hai. Pehle aap suniye, main thodi der mein aapko bulaungi. ${panel[0].name}, aap shuru kijiye.`
          : `${named ? call : "To our candidate: "}this is a fishbowl, so please listen first. I will bring you in shortly. ${panel[0].name}, please begin.`
        : hinglish
          ? `Panel mein hain ${names}, aur ${named ? config.studentName : "aap"}. Kaun shuru karega?`
          : `With us are ${names}, and ${named ? config.studentName : "you"}. Who would like to start?`;
    const text = hinglish
      ? `Hello everyone, main ${MODERATOR.name} hoon, aaj ki moderator. ${what} Aapke paas ${config.minutes} minute hain.${extra} ${ending}`
      : `Good morning everyone, I am ${MODERATOR.name}, your moderator. ${what} You have ${config.minutes} minutes.${extra} ${ending}`;
    await aiSpeak(MODERATOR.id, text);
    if (gen !== genRef.current || phaseRef.current !== "intro") return; // student already jumped in
    if (fishbowl) {
      beginDiscussion(false);
      watchUntilRef.current = performance.now() + watchMs;
      setWatchLeft(watchMs / 1000);
      scheduleNext(900);
      return;
    }
    beginDiscussion(true);
  };

  const beginDiscussion = (waitForStudent: boolean) => {
    if (phaseRef.current !== "intro") return;
    startRef.current = performance.now();
    lastYouRef.current = 0;
    setPhase("discussion");
    if (waitForStudent) {
      showToast("Speaking first gets you noticed. Tap Speak to open the discussion.", 6000);
      scheduleNext(6500);
    }
  };

  const startClosing = async (manual: boolean) => {
    if (phaseRef.current !== "discussion") return;
    clearNext();
    genRef.current += 1;
    prefetchRef.current = null;
    if (manual) stopSpeaking();
    setPhase("closing");
    setSecondsLeft(0);
    const gen = genRef.current;
    // Wait for any AI line still in flight to finish.
    while ((busyRef.current || readingRef.current) && mountedRef.current) await new Promise((r) => setTimeout(r, 120));
    if (gen !== genRef.current) return;

    await aiSpeak(
      MODERATOR.id,
      hinglish
        ? "Time ho gaya, everyone. Ab closing round karte hain. Sab ek ya do line mein conclude kijiye."
        : "That is time, everyone. Let us do a quick closing round. One or two lines each, please."
    );
    for (const p of panel) {
      if (gen !== genRef.current || !mountedRef.current) return;
      setThinking(true);
      setSpeakingId(p.id);
      let text = "To conclude, I stand by the point I made earlier.";
      try {
        text = (await requestTurn(p.id)).text;
      } catch {}
      if (gen !== genRef.current) return;
      await aiSpeak(p.id, text);
    }
    // Friends give their closing too. Wait up to 30 seconds for each one.
    for (const f of friends) {
      if (gen !== genRef.current || !mountedRef.current) return;
      await aiSpeak(MODERATOR.id, hinglish ? `${f.name}, aapka conclusion?` : `${f.name}, your conclusion, please.`);
      await new Promise<void>((resolve) => {
        friendClosingRef.current = { id: f.id, done: resolve };
        setTimeout(resolve, 30000);
      });
      friendClosingRef.current = null;
    }
    if (gen !== genRef.current) return;
    await aiSpeak(
      MODERATOR.id,
      hinglish
        ? `${call}last word aapka. Apna conclusion boliye.`
        : `${named ? call + "you" : "You"} have the last word. Your conclusion, please.`
    );
    awaitingClosingRef.current = true;
    setAwaitingClosing(true);
    closingTimerRef.current = setTimeout(() => {
      if (awaitingClosingRef.current && !talkingRef.current) finish();
    }, 45000);
  };

  const finish = async () => {
    if (phaseRef.current === "done") return;
    awaitingClosingRef.current = false;
    setAwaitingClosing(false);
    if (closingTimerRef.current) clearTimeout(closingTimerRef.current);
    listenerRef.current?.abort();
    talkingRef.current = false;
    setTalking(false);
    genRef.current += 1;
    stopSpeaking();
    await aiSpeak(MODERATOR.id, hinglish ? "Thank you everyone. Discussion yahin khatam hota hai." : "Thank you, everyone. That ends the discussion.");
    setPhase("done");
    await syncNow(true);
    onDone(linesRef.current);
  };

  /* ---------- friends in a shared room ---------- */

  const friendTalkingRef = useRef<Set<string>>(new Set());
  const friendClosingRef = useRef<{ id: string; done: () => void } | null>(null);
  const liveRef = useRef({ speakingId: null as string | null, thinking: false, secondsLeft: 0 });
  liveRef.current = { speakingId, thinking, secondsLeft };

  const handleFriendEvent = (ev: { type: string; friendId: string; on?: boolean; text?: string; ms?: number; typed?: boolean }) => {
    const f = friends.find((x) => x.id === ev.friendId);
    if (!f) return;
    if (phaseRef.current === "closing" || phaseRef.current === "done") {
      // Closing round runs in order; do not interrupt it, just record what friends say.
      if (ev.type === "talk" && ev.on) {
        setSpeakingId(f.id);
        setCaption({ who: f.name, text: "Speaking…" });
      }
      if (ev.type === "say" && ev.text && phaseRef.current === "closing") {
        addLine(f.id, ev.text, { durationMs: ev.ms || estimateMs(ev.text), typed: ev.typed || undefined });
        setCaption({ who: f.name, text: ev.text });
        if (friendClosingRef.current?.id === f.id) friendClosingRef.current.done();
      }
      return;
    }
    if (ev.type === "talk") {
      if (ev.on) {
        // A friend started talking: everyone else stops, like a real table.
        friendTalkingRef.current.add(f.id);
        genRef.current += 1;
        clearNext();
        prefetchRef.current = null;
        stopSpeaking();
        setSpeakingId(f.id);
        setCaption({ who: f.name, text: "Speaking…" });
      } else {
        friendTalkingRef.current.delete(f.id);
        if (!friendTalkingRef.current.size && phaseRef.current === "discussion") scheduleNext();
      }
      return;
    }
    if (ev.type === "say" && ev.text) {
      friendTalkingRef.current.delete(f.id);
      genRef.current += 1;
      clearNext();
      prefetchRef.current = null;
      stopSpeaking();
      if (phaseRef.current === "intro") beginDiscussion(false);
      addLine(f.id, ev.text, { durationMs: ev.ms || estimateMs(ev.text), typed: ev.typed || undefined });
      setCaption({ who: f.name, text: ev.text });
      aiStreakRef.current = 0;
      if (friendClosingRef.current?.id === f.id) friendClosingRef.current.done();
      // Read the friend's point out on the host's device too, so a remote friend is heard by the room.
      const gen = genRef.current;
      setSpeakingId(f.id);
      // Its own flag: an AI turn still in flight must not clear it and start talking over the friend.
      const readId = Date.now() + Math.random();
      readingRef.current = readId;
      const reader = { ...MODERATOR, id: f.id, name: f.name, voice: { pitch: 1, rate: 1.05, prefer: ["en-IN", "en-GB"] } };
      speak(ev.text, reader, undefined, settingsRef.current.voiceOn && settingsRef.current.readFriends).then(() => {
        if (readingRef.current === readId) readingRef.current = 0;
        if (gen !== genRef.current) return;
        setSpeakingId(null);
        if (phaseRef.current === "discussion") {
          if (timeUp()) return void startClosing(false);
          scheduleNext();
        }
      });
    }
  };

  const syncingRef = useRef(false);
  const syncNow = async (ended = false) => {
    if (!shared || (syncingRef.current && !ended)) return;
    syncingRef.current = true;
    try {
      const res = await fetch(`/api/room/${shared.code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync",
          hostKey: shared.hostKey,
          lines: linesRef.current,
          state: { phase: phaseRef.current, ...liveRef.current },
          ended,
        }),
      });
      const data = await res.json().catch(() => ({}));
      for (const ev of data.events ?? []) handleFriendEvent(ev);
    } catch {
      // Network blip: the next sync will catch up.
    } finally {
      syncingRef.current = false;
    }
  };

  useEffect(() => {
    if (!shared) return;
    const t = setInterval(() => syncNow(), 800);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared?.code]);

  /* ---------- the student ---------- */

  const commitStudent = (raw: string, wasTyped: boolean) => {
    const text = raw.replace(/\s+/g, " ").trim().slice(0, 600);
    const dur = wasTyped ? estimateMs(text) : performance.now() - talkStartRef.current;
    setSpeakingId(null);
    setCaption(null);
    if (phaseRef.current === "intro") beginDiscussion(false);
    if (!text) {
      showToast(wasTyped ? "Type something first." : "I did not catch that. Try again, or type your point.");
      if (phaseRef.current === "discussion") scheduleNext();
      return;
    }
    addLine("you", text, { durationMs: dur, typed: wasTyped || undefined });
    if (!wasTyped && dur > 45000 && settingsRef.current.nudgeAfter) {
      lastNudgeRef.current = performance.now();
      showToast("That turn was long. Keep turns under 30 to 40 seconds so others can respond.", 6000);
    }
    lastYouRef.current = performance.now();
    aiStreakRef.current = 0;
    ignoredAsksRef.current = 0;
    awaitingAnswerRef.current = false;
    setAskedBy(null);
    if (awaitingClosingRef.current) return void finish();
    if (phaseRef.current === "discussion") {
      if (timeUp()) return void startClosing(false);
      scheduleNext();
    }
  };

  const canTalk = () =>
    (phaseRef.current === "intro" && !fishbowl) ||
    (phaseRef.current === "discussion" && performance.now() >= watchUntilRef.current) ||
    awaitingClosingRef.current;

  const startTalking = () => {
    if (talkingRef.current || !canTalk()) return;
    if (mic !== "ok" || !sttSupported()) {
      setTypeOpen(true);
      setTimeout(() => typeInputRef.current?.focus(), 0);
      return;
    }
    // Barge-in: stop whoever is speaking and cancel anything queued.
    genRef.current += 1;
    clearNext();
    prefetchRef.current = null;
    stopSpeaking();
    talkingRef.current = true;
    talkStartRef.current = performance.now();
    setTalking(true);
    setSpeakingId("you");
    setCaption({ who: config.studentName, text: "" });

    const listener = new Listener(
      "en-IN", // Indian English also handles Hinglish spoken in Roman script
      (t) => setCaption({ who: config.studentName, text: t }),
      (err: ListenError) => {
        talkingRef.current = false;
        setTalking(false);
        setSpeakingId(null);
        setCaption(null);
        setMic(err === "mic-denied" ? "denied" : err === "no-mic" ? "nomic" : err === "network" ? "network" : "unsupported");
        setTypeOpen(true);
        if (phaseRef.current === "discussion") scheduleNext(2500);
      }
    );
    listenerRef.current = listener;
    listener.start();
  };

  const stopTalking = async () => {
    if (!talkingRef.current) return;
    talkingRef.current = false;
    setTalking(false);
    const text = (await listenerRef.current?.stop()) ?? "";
    commitStudent(text, false);
  };

  const toggleTalk = () => (talkingRef.current ? stopTalking() : startTalking());

  const sendTyped = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canTalk()) return;
    genRef.current += 1;
    clearNext();
    prefetchRef.current = null;
    stopSpeaking();
    const t = typed;
    setTyped("");
    commitStudent(t, true);
  };

  const retryAi = () => {
    failuresRef.current = 0;
    setAiError(false);
    scheduleNext(200);
  };

  /* ---------- lifecycle ---------- */

  useEffect(() => {
    mountedRef.current = true;
    if (!sttSupported()) {
      setMic("unsupported");
      setTypeOpen(true);
    }
    let cancelled = false;
    // Decide each AI participant's position while the moderator is opening.
    fetch("/api/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config }) })
      .then((r) => r.json())
      .then((d) => {
        if (d?.plan) planRef.current = d.plan;
        if (d?.fallback) {
          setFallbackUsed(true);
          if (d.reason) setFallbackReason(d.reason);
        }
      })
      .catch(() => {});
    assignVoices([MODERATOR, ...panel]).then((m) => {
      if (cancelled) return;
      voicesRef.current = m;
      intro();
    });

    const onOff = () => {
      onlineRef.current = false;
      setOnline(false);
      genRef.current += 1;
      clearNext();
      stopSpeaking();
    };
    const onOn = () => {
      onlineRef.current = true;
      setOnline(true);
      scheduleNext(800);
    };
    window.addEventListener("offline", onOff);
    window.addEventListener("online", onOn);

    const tick = setInterval(() => {
      if (phaseRef.current !== "discussion") return;
      if (watchUntilRef.current) {
        const w = (watchUntilRef.current - performance.now()) / 1000;
        if (w > 0) {
          setWatchLeft(w);
          return; // no nudges while the student is watching
        }
        watchUntilRef.current = 0; // watching is over
        setWatchLeft(0);
        inviteDueRef.current = true;
        if (!busyRef.current && !readingRef.current && !talkingRef.current) scheduleNext(300);
      }
      const left = config.minutes * 60 - elapsed() / 1000;
      setSecondsLeft(left);
      if (left <= 0 && !busyRef.current && !readingRef.current && !talkingRef.current) startClosing(false);
      // Silent coaching nudges: visual only, never spoken, at most one every 40 seconds.
      const nudgeAfterS = settingsRef.current.nudgeAfter;
      if (!nudgeAfterS || left <= 20 || talkingRef.current) return;
      const sinceYou = (performance.now() - (lastYouRef.current || startRef.current)) / 1000;
      const sinceNudge = (performance.now() - lastNudgeRef.current) / 1000;
      if (sinceNudge < 40) return;
      const nudge = (msg: string) => {
        lastNudgeRef.current = performance.now();
        showToast(msg, 6000);
      };
      const ls = linesRef.current;
      const recent = ls.slice(-3);
      const you = ls.filter((l) => l.speakerId === "you");
      const youWords = you.reduce((a, l) => a + l.text.split(/\s+/).length, 0);
      const allWords = ls.filter((l) => l.speakerId !== "moderator").reduce((a, l) => a + l.text.split(/\s+/).length, 0) || 1;
      if (sinceYou > nudgeAfterS && sinceNudge > nudgeAfterS) {
        const m = Math.floor(sinceYou / 60);
        nudge(
          m >= 1
            ? `You have not spoken for ${m} minute${m > 1 ? "s" : ""}. Jump in at the next pause.`
            : `You have not spoken for ${Math.round(sinceYou)} seconds. Jump in at the next pause.`
        );
      } else if (sinceYou > 30 && recent.length === 3 && recent.filter((l) => l.speakerId === "arjun").length >= 2) {
        nudge("Arjun is holding the floor. Cut in politely: \"If I may add one point...\"");
      } else if (you.length >= 3 && youWords / allWords > 0.45) {
        nudge(`You have spoken a lot. Bring someone in: "${panel[panel.length - 1].name}, what do you think?"`);
      }
    }, 250);

    return () => {
      cancelled = true;
      mountedRef.current = false;
      genRef.current += 1;
      clearInterval(tick);
      clearNext();
      if (closingTimerRef.current) clearTimeout(closingTimerRef.current);
      listenerRef.current?.abort();
      stopSpeaking();
      window.removeEventListener("offline", onOff);
      window.removeEventListener("online", onOn);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Natural voices: follow the setting, and say so once if they switch off on their own.
  useEffect(() => {
    setCloudVoiceWanted(naturalOn);
  }, [naturalOn]);
  useEffect(() => {
    onCloudVoiceOff((reason) => {
      if (!mountedRef.current) return;
      setCloudShown(false);
      showToast(
        reason === "quota"
          ? "Natural voice credits ran out. Switched to device voices, the discussion goes on."
          : "Natural voices are not responding. Switched to device voices, the discussion goes on.",
        6000
      );
    });
    return () => onCloudVoiceOff(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Space bar toggles the mic, unless you are typing or on another control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, button, select, a")) return;
      e.preventDefault();
      toggleTalk();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length, talking, caption?.text]);

  /* ---------- view ---------- */

  const phaseLabel =
    phase === "intro" ? "Moderator is opening" : phase === "discussion" ? (watching ? "Fishbowl: watch and listen" : "Discussion live") : phase === "closing" ? "Closing round" : "Finished";
  const talkDisabled =
    !((phase === "intro" && !fishbowl) || phase === "discussion" || awaitingClosing) || !online || watching;
  const micMessage: Record<Exclude<MicState, "ok">, string> = {
    denied: "Microphone is blocked. Allow it from the icon in the address bar, or type your points below.",
    nomic: "No microphone found. Plug one in, or type your points below.",
    unsupported: "Voice input works in Chrome and Edge. You can type your points below.",
    network: "The speech service is not reachable right now. Type your points below.",
  };
  const timerText = phase === "discussion" ? fmt(secondsLeft) : phase === "intro" ? fmt(config.minutes * 60) : "0:00";

  return (
    <div className="room-view">
      <div className="scene dim" aria-hidden="true">
        <img src="/scene.svg" alt="" />
      </div>

      <header className="room-top">
        <button className="logo" onClick={onLeave} aria-label="Leave the room and go home">
          <LogoMark />
          GD Arena
        </button>
        <div className="room-pills">
          <span className="topic-pill glass" title={config.topic}>
            {config.topic}
          </span>
          {config.side && config.side !== "open" && (
            <span className="topic-pill glass">You argue: {config.side === "for" ? "In favour" : "Against"}</span>
          )}
          <span className={`timer-pill ${phase === "discussion" && secondsLeft < 30 ? "low" : ""}`} aria-label={`Time left ${timerText}`}>
            {timerText}
          </span>
        </div>
        <button className="pill dark" onClick={onLeave}>
          Leave room
        </button>
      </header>

      {!online && (
        <p className="banner error" role="alert">
          You are offline. The discussion is paused and will continue when you reconnect.
        </p>
      )}
      {mic !== "ok" && (
        <p className="banner" role="status">
          {micMessage[mic]}
        </p>
      )}
      {aiError && (
        <p className="banner error" role="alert">
          The AI participants could not reply.
          <button className="pill dark" onClick={retryAi}>
            Try again
          </button>
        </p>
      )}
      {fallbackUsed && !aiError && (
        <p className="banner" role="status">
          The AI replies failed, so some lines are scripted for now.
          {fallbackReason ? ` Reason: ${fallbackReason}` : ""}
        </p>
      )}

      <div className="room-grid">
        <section className="stage glass" aria-label="Discussion room">
          <div className="stage-head">
            <span className="phase">
              <i aria-hidden="true" />
              {phaseLabel}
            </span>
            <span className="ai-note">All other participants are AI</span>
          </div>

          <Table
            humans={friends}
            panel={panel}
            studentName={config.studentName}
            speakingId={speakingId}
            thinking={thinking}
            topic={config.topic}
            yourTurn={Boolean(askedBy) || awaitingClosing}
          />

          <div className="caption" aria-live="polite">
            {caption ? (
              <>
                <div className="caption-who">{caption.who}</div>
                <div className="caption-text">{caption.text || (talking ? "Listening…" : "")}</div>
              </>
            ) : thinking ? (
              <div className="caption-who">Someone is about to speak…</div>
            ) : askedBy ? (
              <div className="caption-who">{askedBy} asked you. Your turn: tap Speak and answer.</div>
            ) : awaitingClosing ? (
              <div className="caption-who">Your turn: give your closing statement.</div>
            ) : (
              <div className="caption-who">Waiting for the next speaker. Tap Speak to jump in.</div>
            )}
          </div>

          <div className="controls">
            <button className="talk" aria-pressed={talking} onClick={toggleTalk} disabled={talkDisabled} aria-describedby="talk-hint">
              {talking
                ? "Done speaking"
                : watching
                  ? `Watching, you join in ${fmt(watchLeft)}`
                  : awaitingClosing
                    ? "Give your closing"
                    : "Speak"}
              <span className="icon-disc">{talking ? <StopIcon /> : <MicIcon />}</span>
            </button>
            {phase === "discussion" && (
              <button className="pill plain" onClick={() => startClosing(true)}>
                End discussion
              </button>
            )}
            {awaitingClosing && (
              <button className="pill plain" onClick={finish}>
                Skip my closing
              </button>
            )}
          </div>
          <p id="talk-hint" className="hint">
            Tap Speak or press the space bar, talk, then tap Done. Speaking stops whoever is talking.
          </p>

          {typeOpen ? (
            <form className="type-row" onSubmit={sendTyped}>
              <label htmlFor="typed" className="sr-only">
                Type your point
              </label>
              <input
                id="typed"
                ref={typeInputRef}
                placeholder="Type your point"
                value={typed}
                maxLength={600}
                onChange={(e) => setTyped(e.target.value)}
                disabled={talkDisabled}
              />
              <button className="pill dark" type="submit" disabled={talkDisabled}>
                Send
              </button>
            </form>
          ) : (
            <button className="linkish" onClick={() => setTypeOpen(true)}>
              Type instead
            </button>
          )}

          <div className="settings">
            <label>
              AI waits
              <input
                type="range"
                min={0.5}
                max={4}
                step={0.5}
                value={patience}
                onChange={(e) => setPatience(Number(e.target.value))}
                aria-valuetext={`${patience} seconds`}
              />
              {patience}s before speaking
            </label>
            <label>
              <input type="checkbox" checked={voiceOn} onChange={(e) => setVoiceOn(e.target.checked)} />
              AI voices on
            </label>
            {cloudShown && (
              <label>
                <input type="checkbox" checked={naturalOn} disabled={!voiceOn} onChange={(e) => setNaturalOn(e.target.checked)} />
                Natural AI voices (OpenAI)
              </label>
            )}
            {friends.length > 0 && (
              <label>
                <input type="checkbox" checked={readFriends} onChange={(e) => setReadFriends(e.target.checked)} />
                Read friends&apos; points aloud
              </label>
            )}
            <label>
              Silent nudges
              <select value={nudgeAfter} onChange={(e) => setNudgeAfter(Number(e.target.value))} className="nudge-select">
                <option value={60}>after 1 min quiet</option>
                <option value={120}>after 2 min quiet</option>
                <option value={180}>after 3 min quiet</option>
                <option value={0}>off</option>
              </select>
            </label>
          </div>
        </section>

        <section className="transcript glass" aria-label="Live transcript">
          <h2>Live transcript</h2>
          <ol ref={listRef}>
            {lines.length === 0 && <li className="empty">Ms. Rao will open the discussion.</li>}
            {lines.map((l) => {
              const p = personaById(l.speakerId);
              return (
                <li key={l.id} className={`tline ${l.speakerId === "you" ? "you" : ""}`}>
                  <Avatar
                    look={p?.look ?? (l.speakerId.startsWith("f") ? friendLook(l.speakerId).look : undefined)}
                    shirt={p?.color ?? (l.speakerId.startsWith("f") ? friendLook(l.speakerId).color : "#ffc531")}
                    size={32}
                  />
                  <div>
                    <b>{nameOf(l.speakerId)}</b>
                    {l.interrupted && <span className="tag">cut off</span>}
                    {l.typed && <span className="tag">typed</span>}
                    <div>{l.text}</div>
                  </div>
                </li>
              );
            })}
            {talking && (
              <li className="tline you live" aria-live="polite">
                <Avatar size={32} />
                <div>
                  <b>{nameOf("you")}</b>
                  <span className="tag">speaking now</span>
                  <div>{caption?.text || "Listening…"}</div>
                </div>
              </li>
            )}
          </ol>
        </section>
      </div>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
