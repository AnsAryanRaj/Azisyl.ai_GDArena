"use client";
import { useEffect, useRef, useState } from "react";
import { friendLook, MODERATOR, panelFor, personaById } from "@/lib/personas";
import { assignVoices, Listener, speak, stopSpeaking, sttSupported, type AssignedVoice } from "@/lib/speech";
import type { Line, RoomConfig } from "@/lib/types";
import Avatar from "./Avatar";
import { LogoMark, MicIcon, StopIcon } from "./Icons";
import type { Joined } from "./JoinRoom";
import Table from "./Table";

interface Props {
  joined: Joined;
  onDone: (config: RoomConfig, lines: Line[]) => void; // config and lines already seen from this friend's side
  onLeave: () => void;
}

interface RoomView {
  status: "lobby" | "live" | "ended";
  hostName: string;
  friends: { id: string; name: string }[];
  config: RoomConfig | null;
  lines: Line[];
  state: { phase: string; speakingId: string | null; secondsLeft: number; thinking: boolean } | null;
}

const fmt = (s: number) => {
  const v = Math.max(0, Math.ceil(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
};

/**
 * A friend's view of the host's room. The host's device runs the AI; this device shows the
 * table and transcript, and sends this friend's speech. Ids are swapped so that this friend
 * is "you" here and the host appears as a friend seat, which lets us reuse the same table and report.
 */
export default function FriendRoom({ joined, onDone, onLeave }: Props) {
  const me = joined.friendId;
  const [view, setView] = useState<RoomView | null>(null);
  const [error, setError] = useState("");
  const [talking, setTalking] = useState(false);
  const [interim, setInterim] = useState("");
  const [typed, setTyped] = useState("");
  const [typeOpen, setTypeOpen] = useState(!sttSupported());
  const [micError, setMicError] = useState("");
  const [voicesOn, setVoicesOn] = useState(false);
  const listenerRef = useRef<Listener | null>(null);
  const talkStart = useRef(0);
  const spokenUpTo = useRef(0);
  const voices = useRef<Map<string, AssignedVoice>>(new Map());
  const speakingQueue = useRef(Promise.resolve());
  const listRef = useRef<HTMLOListElement>(null);

  const swap = (id: string | null) => (id === me ? "you" : id === "you" ? me : id);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch(`/api/room/${joined.code}`, { cache: "no-store" });
        const d = await r.json();
        if (!alive) return;
        if (!r.ok) return setError(d.error ?? "Room not found.");
        setError("");
        setView(d);
      } catch {
        if (alive) setError("Connection lost. Reconnecting…");
      }
    };
    poll();
    const t = setInterval(poll, 900);
    return () => {
      alive = false;
      clearInterval(t);
      listenerRef.current?.abort();
      stopSpeaking();
    };
  }, [joined.code]);

  // Seen from this friend's side.
  const config: RoomConfig | null = view?.config
    ? {
        ...view.config,
        studentName: joined.name,
        friends: [
          { id: me, name: view.hostName },
          ...(view.config.friends ?? []).filter((f) => f.id !== me),
        ],
      }
    : null;
  const lines: Line[] = (view?.lines ?? []).map((l) => ({ ...l, speakerId: swap(l.speakerId) as string }));
  const panel = config ? panelFor(config.panelSize) : [];
  const nameOf = (id: string) => (id === "you" ? joined.name : config?.friends?.find((f) => f.id === id)?.name ?? personaById(id)?.name ?? id);

  // Optional: play the AI voices on this device too (off by default, the host's speaker usually covers it).
  useEffect(() => {
    if (!config) return;
    assignVoices([MODERATOR, ...panel]).then((m) => (voices.current = m));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.panelSize]);

  useEffect(() => {
    if (!voicesOn) {
      spokenUpTo.current = lines.length;
      return;
    }
    const fresh = lines.slice(spokenUpTo.current).filter((l) => personaById(l.speakerId));
    spokenUpTo.current = lines.length;
    for (const l of fresh) {
      const p = personaById(l.speakerId)!;
      speakingQueue.current = speakingQueue.current.then(() => speak(l.text, p, voices.current.get(p.id), true).then(() => {}));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.length, voicesOn]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length, interim]);

  useEffect(() => {
    if (view?.status === "ended" && config) onDone(config, lines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.status]);

  const post = (body: Record<string, unknown>) =>
    fetch(`/api/room/${joined.code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendId: me, key: joined.key, ...body }),
    });

  const startTalking = () => {
    if (!sttSupported()) {
      setTypeOpen(true);
      return;
    }
    stopSpeaking();
    setTalking(true);
    setInterim("");
    talkStart.current = performance.now();
    post({ action: "talk", on: true }).catch(() => {});
    const l = new Listener("en-IN", setInterim, (err) => {
      setTalking(false);
      setTypeOpen(true);
      setMicError(
        err === "mic-denied"
          ? "Microphone is blocked. On phones the mic needs the https version of the site. You can type instead."
          : "Voice input is not available here. You can type instead."
      );
      post({ action: "talk", on: false }).catch(() => {});
    });
    listenerRef.current = l;
    l.start();
  };

  const stopTalking = async () => {
    setTalking(false);
    const text = (await listenerRef.current?.stop()) ?? "";
    setInterim("");
    if (text.trim()) await post({ action: "say", text, ms: performance.now() - talkStart.current }).catch(() => {});
    else await post({ action: "talk", on: false }).catch(() => {});
  };

  const sendTyped = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = typed.trim();
    if (!t) return;
    setTyped("");
    const r = await post({ action: "say", text: t, typed: true }).catch(() => null);
    if (r && !r.ok) setMicError((await r.json().catch(() => ({}))).error ?? "Could not send.");
  };

  if (!view || !config || view.status === "lobby") {
    return (
      <div className="auth-view">
        <div className="sky" aria-hidden="true">
          <img src="/sky.svg" alt="" />
        </div>
        <header className="room-top">
          <span className="logo">
            <LogoMark />
            GD Arena
          </span>
          <button
            className="pill ghost"
            onClick={() => {
              post({ action: "leave" }).catch(() => {});
              onLeave();
            }}
          >
            Leave
          </button>
        </header>
        <div className="auth-wrap">
          <section className="auth-card glass lobby" aria-live="polite">
            <p className="fine" style={{ margin: 0 }}>
              Room {joined.code}
            </p>
            <h1>You are in{view ? ` ${view.hostName}'s` : " the"} room</h1>
            <p className="fine">Waiting for the host to start. The other seats will be AI participants.</p>
            <ul className="lobby-list">
              {view && (
                <li>
                  <Avatar size={36} /> <b>{view.hostName}</b> <span>Host</span>
                </li>
              )}
              {view?.friends.map((f) => (
                <li key={f.id}>
                  <Avatar size={36} look={friendLook(f.id).look} shirt={friendLook(f.id).color} /> <b>{f.name}</b>{" "}
                  <span>{f.id === me ? "You" : "Friend"}</span>
                </li>
              ))}
            </ul>
            {error && <p className="auth-error">{error}</p>}
          </section>
        </div>
      </div>
    );
  }

  const st = view.state;
  const speakingId = talking ? "you" : swap(st?.speakingId ?? null);
  const last = lines[lines.length - 1];

  return (
    <div className="room-view">
      <div className="scene dim" aria-hidden="true">
        <img src="/scene.svg" alt="" />
      </div>
      <header className="room-top">
        <span className="logo">
          <LogoMark />
          GD Arena
        </span>
        <div className="room-pills">
          <span className="topic-pill glass" title={config.topic}>
            {config.topic}
          </span>
          <span className="timer-pill">{st?.phase === "discussion" ? fmt(st.secondsLeft) : st?.phase === "closing" ? "0:00" : fmt(config.minutes * 60)}</span>
        </div>
        <button className="pill dark" onClick={onLeave}>
          Leave room
        </button>
      </header>
      {error && <p className="banner error">{error}</p>}
      {micError && <p className="banner">{micError}</p>}

      <div className="room-grid">
        <section className="stage glass" aria-label="Discussion room">
          <div className="stage-head">
            <span className="phase">
              <i aria-hidden="true" />
              {view.hostName}&apos;s room, {st?.phase === "closing" ? "closing round" : st?.phase === "intro" ? "moderator is opening" : "discussion live"}
            </span>
            <span className="ai-note">Humans: you, {view.hostName}{(view.config?.friends?.length ?? 0) > 1 ? " and friends" : ""}. Everyone else is AI</span>
          </div>
          <Table panel={panel} studentName={joined.name} speakingId={speakingId} thinking={st?.thinking} topic={config.topic} humans={config.friends} />
          <div className="caption" aria-live="polite">
            {talking ? (
              <>
                <div className="caption-who">{joined.name}</div>
                <div className="caption-text">{interim || "Listening…"}</div>
              </>
            ) : last ? (
              <>
                <div className="caption-who">{nameOf(last.speakerId)}</div>
                <div className="caption-text">{last.text}</div>
              </>
            ) : (
              <div className="caption-who">Ms. Rao will open the discussion.</div>
            )}
          </div>
          <div className="controls">
            <button className="talk" aria-pressed={talking} onClick={() => (talking ? stopTalking() : startTalking())}>
              {talking ? "Done speaking" : "Speak"}
              <span className="icon-disc">{talking ? <StopIcon /> : <MicIcon />}</span>
            </button>
          </div>
          <p className="hint">Tap Speak, talk, then tap Done. Everyone at the table stops while you speak.</p>
          {typeOpen ? (
            <form className="type-row" onSubmit={sendTyped}>
              <label htmlFor="f-typed" className="sr-only">
                Type your point
              </label>
              <input id="f-typed" placeholder="Type your point" value={typed} maxLength={600} onChange={(e) => setTyped(e.target.value)} />
              <button className="pill dark" type="submit">
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
              <input type="checkbox" checked={voicesOn} onChange={(e) => setVoicesOn(e.target.checked)} />
              Play AI voices on this device too (use if you are not in the same room as the host)
            </label>
          </div>
        </section>

        <section className="transcript glass" aria-label="Live transcript">
          <h2>Live transcript</h2>
          <ol ref={listRef}>
            {lines.map((l) => {
              const p = personaById(l.speakerId);
              const fl = l.speakerId.startsWith("f") ? friendLook(l.speakerId) : null;
              return (
                <li key={l.id} className={`tline ${l.speakerId === "you" ? "you" : ""}`}>
                  <Avatar look={p?.look ?? fl?.look} shirt={p?.color ?? fl?.color ?? "#ffc531"} size={32} />
                  <div>
                    <b>{nameOf(l.speakerId)}</b>
                    {l.interrupted && <span className="tag">cut off</span>}
                    <div>{l.text}</div>
                  </div>
                </li>
              );
            })}
            {talking && (
              <li className="tline you live">
                <Avatar size={32} />
                <div>
                  <b>{joined.name}</b>
                  <span className="tag">speaking now</span>
                  <div>{interim || "Listening…"}</div>
                </div>
              </li>
            )}
          </ol>
        </section>
      </div>
    </div>
  );
}
