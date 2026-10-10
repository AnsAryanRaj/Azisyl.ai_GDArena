"use client";
import { useEffect, useRef, useState } from "react";
import { MODERATOR, panelFor, personaById } from "@/lib/personas";
import { assignVoices, estimateMs, Listener, speak, stopSpeaking, sttSupported, type ListenError } from "@/lib/speech";
import type { Line, RoomConfig, TurnResponse } from "@/lib/types";
import Avatar from "./Avatar";
import { LogoMark, MicIcon, StopIcon } from "./Icons";
import Table from "./Table";

type Phase = "intro" | "discussion" | "closing" | "done";
type MicState = "ok" | "denied" | "nomic" | "unsupported" | "network";

interface Props {
  config: RoomConfig;
  onDone: (lines: Line[]) => void;
  onLeave: () => void;
}

const fmt = (s: number) => {
  const v = Math.max(0, Math.ceil(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
};

export default function Room({ config, onDone, onLeave }: Props) {
  const panel = panelFor(config.panelSize);
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
  const [fallbackUsed, setFallbackUsed] = useState(false);

  /* ---------- engine refs (the async loop reads these, never stale state) ---------- */
  const linesRef = useRef<Line[]>([]);
  const phaseRef = useRef<Phase>("intro");
  const genRef = useRef(0); // bumps whenever the student barges in or the phase changes
  const busyRef = useRef(false);
  const talkingRef = useRef(false);
  const onlineRef = useRef(true);
  const startRef = useRef(0);
  const talkStartRef = useRef(0);
  const lastYouRef = useRef(0);
  const lastNudgeRef = useRef(0);
  const failuresRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voicesRef = useRef<Map<string, SpeechSynthesisVoice | null>>(new Map());
  const listenerRef = useRef<Listener | null>(null);
  const prefetchRef = useRef<{ key: number; gen: number; promise: Promise<TurnResponse | null> } | null>(null);
  const settingsRef = useRef({ patience: 1.2, voiceOn: true });
  const awaitingClosingRef = useRef(false);
  const mountedRef = useRef(true);
  const listRef = useRef<HTMLOListElement>(null);
  const typeInputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  settingsRef.current = { patience, voiceOn };

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

  const nameOf = (id: string) => (id === "you" ? config.studentName : personaById(id)?.name ?? id);

  /* ---------- talking to the server ---------- */

  const requestTurn = async (forceSpeaker?: string): Promise<TurnResponse> => {
    const body = JSON.stringify({
      config,
      phase: phaseRef.current === "closing" ? "closing" : "discussion",
      forceSpeaker,
      transcript: linesRef.current.map(({ id, speakerId, text }) => ({ id, speakerId, text })),
      secondsLeft: config.minutes * 60 - elapsed() / 1000,
      secondsSinceStudentSpoke: (performance.now() - (lastYouRef.current || startRef.current || performance.now())) / 1000,
    });
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch("/api/turn", { method: "POST", headers: { "Content-Type": "application/json" }, body });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as TurnResponse & { fallback?: boolean };
        if (data.fallback) setFallbackUsed(true);
        return data;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 600));
      }
    }
    throw lastErr;
  };

  /* ---------- one AI line, spoken out loud ---------- */

  const aiSpeak = async (speakerId: string, text: string) => {
    const persona = personaById(speakerId) ?? MODERATOR;
    const line = addLine(speakerId, text);
    setThinking(false);
    setSpeakingId(speakerId);
    setCaption({ who: persona.name, text });

    // While this line plays, start fetching the next one so there is no dead air.
    if (phaseRef.current === "discussion") {
      const gen = genRef.current;
      prefetchRef.current = {
        key: linesRef.current.length,
        gen,
        promise: requestTurn().catch(() => null),
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
    if (phaseRef.current !== "discussion" || talkingRef.current || busyRef.current || !onlineRef.current) return;
    timeoutRef.current = setTimeout(runTurn, delayMs);
  };

  const timeUp = () => elapsed() / 1000 >= config.minutes * 60;

  const runTurn = async () => {
    if (!mountedRef.current || phaseRef.current !== "discussion" || talkingRef.current || busyRef.current) return;
    if (timeUp()) return startClosing(false);
    busyRef.current = true;
    const gen = genRef.current;
    setThinking(true);
    try {
      let turn: TurnResponse | null = null;
      const pf = prefetchRef.current;
      if (pf && pf.key === linesRef.current.length && pf.gen === gen) turn = await pf.promise;
      prefetchRef.current = null;
      if (!turn) turn = await requestTurn();
      if (gen !== genRef.current || talkingRef.current || phaseRef.current !== "discussion") return;
      failuresRef.current = 0;
      setAiError(false);
      await aiSpeak(turn.speakerId, turn.text);
    } catch {
      failuresRef.current += 1;
      if (failuresRef.current >= 2) setAiError(true);
    } finally {
      busyRef.current = false;
      setThinking(false);
    }
    if (gen !== genRef.current || phaseRef.current !== "discussion") return;
    if (timeUp()) return startClosing(false);
    if (failuresRef.current >= 2) return; // wait for "Try again"
    scheduleNext(failuresRef.current ? 2500 : undefined);
  };

  /* ---------- intro and closing ---------- */

  const intro = async () => {
    const gen = genRef.current;
    const names = panel.map((p) => p.name).join(", ");
    const topic = /[.?!]$/.test(config.topic) ? config.topic : `${config.topic}.`;
    const text = hinglish
      ? `Hello everyone, main ${MODERATOR.name} hoon, aaj ki moderator. Aaj ka topic hai: ${topic} Aapke paas ${config.minutes} minute hain. Panel mein hain ${names}, aur ${config.studentName}. Kaun shuru karega?`
      : `Good morning everyone, I am ${MODERATOR.name}, your moderator. Today's topic is: ${topic} You have ${config.minutes} minutes. With us are ${names}, and ${config.studentName}. Who would like to start?`;
    await aiSpeak(MODERATOR.id, text);
    if (gen !== genRef.current || phaseRef.current !== "intro") return; // student already jumped in
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
    while (busyRef.current && mountedRef.current) await new Promise((r) => setTimeout(r, 120));
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
    if (gen !== genRef.current) return;
    await aiSpeak(
      MODERATOR.id,
      hinglish
        ? `${config.studentName}, last word aapka. Apna conclusion boliye.`
        : `${config.studentName}, you have the last word. Your conclusion, please.`
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
    onDone(linesRef.current);
  };

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
    lastYouRef.current = performance.now();
    if (awaitingClosingRef.current) return void finish();
    if (phaseRef.current === "discussion") {
      if (timeUp()) return void startClosing(false);
      scheduleNext();
    }
  };

  const canTalk = () =>
    phaseRef.current === "intro" || phaseRef.current === "discussion" || awaitingClosingRef.current;

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
      const left = config.minutes * 60 - elapsed() / 1000;
      setSecondsLeft(left);
      if (left <= 0 && !busyRef.current && !talkingRef.current) startClosing(false);
      const sinceYou = (performance.now() - (lastYouRef.current || startRef.current)) / 1000;
      const sinceNudge = (performance.now() - lastNudgeRef.current) / 1000;
      if (sinceYou > 120 && sinceNudge > 120 && left > 20) {
        lastNudgeRef.current = performance.now();
        showToast("You have not spoken for 2 minutes. Jump in at the next pause.");
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
  }, [lines.length]);

  /* ---------- view ---------- */

  const phaseLabel =
    phase === "intro" ? "Moderator is opening" : phase === "discussion" ? "Discussion live" : phase === "closing" ? "Closing round" : "Finished";
  const talkDisabled = !(phase === "intro" || phase === "discussion" || awaitingClosing) || !online;
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
          The AI service is slow, so some replies are scripted for now.
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

          <Table panel={panel} studentName={config.studentName} speakingId={speakingId} thinking={thinking} topic={config.topic} />

          <div className="caption" aria-live="polite">
            {caption ? (
              <>
                <div className="caption-who">{caption.who}</div>
                <div className="caption-text">{caption.text || (talking ? "Listening…" : "")}</div>
              </>
            ) : thinking ? (
              <div className="caption-who">Someone is about to speak…</div>
            ) : awaitingClosing ? (
              <div className="caption-who">Your turn: give your closing statement.</div>
            ) : (
              <div className="caption-who">Waiting for the next speaker. Tap Speak to jump in.</div>
            )}
          </div>

          <div className="controls">
            <button className="talk" aria-pressed={talking} onClick={toggleTalk} disabled={talkDisabled} aria-describedby="talk-hint">
              {talking ? "Done speaking" : awaitingClosing ? "Give your closing" : "Speak"}
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
                  <Avatar look={p?.look} shirt={p?.color ?? "#ffc531"} size={32} />
                  <div>
                    <b>{nameOf(l.speakerId)}</b>
                    {l.interrupted && <span className="tag">cut off</span>}
                    {l.typed && <span className="tag">typed</span>}
                    <div>{l.text}</div>
                  </div>
                </li>
              );
            })}
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
