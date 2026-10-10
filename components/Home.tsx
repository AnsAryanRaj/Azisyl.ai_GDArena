"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { readHistory, summarise, type HistoryItem } from "@/lib/progress";
import { FORMATS, TOPICS, type Topic } from "@/lib/topics";
import type { GdFormat, Language, RoomConfig, Side } from "@/lib/types";
import Feedback from "./Feedback";
import type { User } from "@/lib/auth";
import Avatar from "./Avatar";
import { LogoMark, MicIcon } from "./Icons";


interface Props {
  initial?: RoomConfig | null;
  demo: boolean | null;
  aiError?: string | null;
  onStart: (c: RoomConfig) => void;
  user: User;
  onLogOut: () => void;
}

const KINDS: ("All" | "Custom" | Topic["kind"])[] = [
  "All",
  "Current affairs",
  "Business",
  "Tech",
  "Social",
  "Regional",
  "Abstract",
  "Controversial",
  "Case",
  "Custom",
];

export default function Home({ initial, demo, aiError, onStart, user, onLogOut }: Props) {
  const [kind, setKind] = useState<(typeof KINDS)[number]>("All");
  const [topic, setTopic] = useState(initial?.topic ?? "");
  const [panelSize, setPanelSize] = useState(initial?.panelSize ?? 4);
  const [minutes, setMinutes] = useState(initial?.minutes ?? 5);
  const [language, setLanguage] = useState<Language>(initial?.language ?? "english");
  const [name, setName] = useState(initial?.studentName ?? (user.guest && user.name === "Guest" ? "" : user.name));
  const [format, setFormat] = useState<GdFormat>(initial?.format ?? "standard");
  const [side, setSide] = useState<Side>(initial?.side ?? "open");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [fbKey, setFbKey] = useState(0);
  const openFeedback = () => {
    setFbKey((k) => k + 1);
    dialogRef.current?.showModal();
  };

  useEffect(() => {
    try {
      setHistory(readHistory());
      const saved = localStorage.getItem("gd-name");
      if (saved && !initial?.studentName) setName(saved);
    } catch {}
  }, [initial?.studentName]);

  const shown = useMemo(
    () => (kind === "All" ? TOPICS.slice(0, 4) : kind === "Custom" ? [] : TOPICS.filter((t) => t.kind === kind)),
    [kind]
  );

  function start(e?: React.FormEvent) {
    e?.preventDefault();
    const t = topic.trim();
    if (t.length < 2) {
      setError("Type a topic or pick one of the suggestions.");
      return;
    }
    const studentName = name.trim().slice(0, 30) || "You";
    try {
      localStorage.setItem("gd-name", studentName);
    } catch {}
    const brief = TOPICS.find((x) => x.text === t)?.brief;
    onStart({ topic: t.slice(0, 160), panelSize, minutes, language, studentName, format, side, brief });
  }

  return (
    <>
      <section className="hero">
        <div className="sky" aria-hidden="true">
          <img src="/sky.svg" alt="" />
        </div>

        <nav className="nav" aria-label="Main">
          <a className="logo" href="#top" aria-label="GD Arena home">
            <LogoMark />
            GD Arena
          </a>
          <div className="navlinks">
            <a href="#top">Practise</a>
            <a href="#progress-title">Your progress</a>
            <button type="button" onClick={openFeedback}>
              Give feedback
            </button>
          </div>
          <div className="nav-right">
            <span className="user-chip">
              <Avatar size={34} />
              <span>{user.guest ? "Guest" : user.name}</span>
            </span>
            <button className="pill dark" type="button" onClick={onLogOut}>
              {user.guest ? "Exit" : "Log out"}
            </button>
          </div>
        </nav>

        <form className="hero-body" id="top" onSubmit={start} noValidate>
          <span className="ai-chip">
            <i aria-hidden="true" /> Everyone else at the table is AI
          </span>
          <h1>
            {user.guest || user.name === "Guest" ? "Pick a topic and" : `${user.name.split(" ")[0]}, pick a topic and`} <em>take your seat.</em>
          </h1>
          <p className="sub">
            Choose a topic, your side and the format. The panel will argue, ask you questions and wait for your answers.
          </p>

          <div className="tabs glass" role="group" aria-label="Topic type">
            {KINDS.map((k) => (
              <button
                type="button"
                key={k}
                aria-pressed={kind === k}
                onClick={() => {
                  setKind(k);
                  if (k === "Custom") {
                    if (TOPICS.some((t) => t.text === topic)) setTopic("");
                    if (format === "case") setFormat("standard");
                    setTimeout(() => document.getElementById("topic")?.focus(), 0);
                  }
                }}
              >
                {k}
              </button>
            ))}
          </div>

          <div className="searchbar glass">
            <label htmlFor="topic" className="sr-only">
              Discussion topic
            </label>
            <input
              id="topic"
              placeholder={kind === "Custom" ? "Type your own topic, for example: Should exams be open book?" : "Type any GD topic, or pick one below"}
              value={topic}
              maxLength={160}
              onChange={(e) => {
                setTopic(e.target.value);
                setError("");
              }}
            />
            <button className="pill orange" type="submit">
              <span className="long">Start discussion</span>
              <span className="short">Start</span>
              <MicIcon />
            </button>
          </div>

          <ul className="suggestions" aria-label="Suggested topics">
            {shown.map((t) => (
              <li key={t.text}>
                <button
                  type="button"
                  aria-pressed={topic === t.text}
                  onClick={() => {
                    setTopic(t.text);
                    setError("");
                    if (t.kind === "Case") setFormat("case");
                    else if (format === "case") setFormat("standard");
                  }}
                >
                  {t.text}
                </button>
              </li>
            ))}
          </ul>

          {kind === "Custom" && (
            <p className="custom-hint">Type any topic you want to practise. The AI panel will build its arguments around it.</p>
          )}

          <div className="quick">
            <div className="qgroup glass" role="group" aria-label="Your side">
              <span>Your side</span>
              {(
                [
                  ["for", "In favour"],
                  ["against", "Against"],
                  ["open", "Decide as I go"],
                ] as [Side, string][]
              ).map(([v, label]) => (
                <button type="button" key={v} aria-pressed={side === v} onClick={() => setSide(v)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="qgroup glass" role="group" aria-label="GD format">
              <span>Format</span>
              {FORMATS.map((f) => (
                <button
                  type="button"
                  key={f.id}
                  title={f.hint}
                  aria-pressed={format === f.id}
                  onClick={() => {
                    setFormat(f.id);
                    if (f.id === "case" || f.id === "controversial") {
                      const k = f.id === "case" ? "Case" : "Controversial";
                      setKind(k);
                      if (!TOPICS.some((x) => x.text === topic && x.kind === k)) {
                        setTopic(TOPICS.find((x) => x.kind === k)!.text);
                        setError("");
                      }
                    }
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="qgroup glass" role="group" aria-label="Number of AI participants">
              <span>AI panel</span>
              {[3, 4, 5].map((n) => (
                <button type="button" key={n} aria-pressed={panelSize === n} onClick={() => setPanelSize(n)}>
                  {n}
                </button>
              ))}
            </div>
            <div className="qgroup glass" role="group" aria-label="Minutes">
              <span>Minutes</span>
              {[3, 5, 8, 10].map((n) => (
                <button type="button" key={n} aria-pressed={minutes === n} onClick={() => setMinutes(n)}>
                  {n}
                </button>
              ))}
            </div>
            <div className="qgroup glass" role="group" aria-label="Language">
              <button type="button" aria-pressed={language === "english"} onClick={() => setLanguage("english")}>
                English
              </button>
              <button type="button" aria-pressed={language === "hinglish"} onClick={() => setLanguage("hinglish")}>
                Hinglish
              </button>
            </div>
            <div className="qgroup glass">
              <label htmlFor="name">Your name</label>
              <input
                id="name"
                placeholder="Type your name"
                value={name}
                maxLength={30}
                autoComplete="given-name"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {demo && <p className="ai-chip" style={{ marginTop: 14 }}>Demo mode: scripted replies until an AI key is added</p>}
          {aiError && (
            <p className="form-error" role="alert" style={{ maxWidth: 720 }}>
              The AI is not responding, so replies will be scripted. {aiError}
            </p>
          )}
        </form>
        <div className="ground" aria-hidden="true">
          <img src="/ground.svg" alt="" />
        </div>
      </section>


      <Progress history={history} />

      <footer className="footer">
        GD Arena is a practice tool. The other participants and the assessor are AI, and their views are generated.{" "}
        <button className="linkish" type="button" onClick={openFeedback} style={{ color: "inherit" }}>
          Send us feedback
        </button>
      </footer>

      <dialog ref={dialogRef} className="fb-dialog" aria-labelledby="fb-title" onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}>
        <div>
          <button className="pill plain close" type="button" onClick={() => dialogRef.current?.close()}>
            Close
          </button>
          <h2 id="fb-title">Give feedback</h2>
          <p style={{ margin: "0 0 14px", color: "var(--glass-muted)" }}>Tell us what works and what does not. It goes straight to the team.</p>
          <Feedback key={fbKey} where="home" onDone={() => dialogRef.current?.close()} />
        </div>
      </dialog>
    </>
  );
}

function Progress({ history }: { history: HistoryItem[] }) {
  if (history.length === 0) {
    return (
      <section className="section" aria-labelledby="progress-title">
        <h2 id="progress-title">Your progress</h2>
        <p className="lead">No sessions yet. Finish your first discussion and your skills and habits will show up here.</p>
      </section>
    );
  }
  const s = summarise(history);
  const pips = (v: number) => (
    <span className="pips" aria-label={`${v.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={n <= Math.round(v) ? "on" : ""} />
      ))}
    </span>
  );
  return (
    <section className="section" aria-labelledby="progress-title">
      <h2 id="progress-title">Your progress</h2>
      <p className="lead">
        {s.sessions} {s.sessions === 1 ? "session" : "sessions"} so far, average score {s.avgOverall.toFixed(1)} out of 10
        {s.sessions >= 2 && s.trend !== 0 ? `, ${s.trend > 0 ? "up" : "down"} ${Math.abs(s.trend)} since your first one` : ""}.
        Saved only on this device.
      </p>
      <div className="progress">
        <div className="panel">
          <h3>Skills across sessions</h3>
          {s.skills.length === 0 && <p className="fine">Finish a discussion to see your skills here.</p>}
          {s.skills.map((k) => (
            <div className="skill-row" key={k.area}>
              <span>{k.area}</span>
              {pips(k.avg)}
            </div>
          ))}
        </div>
        <div className="panel">
          <h3>Your habits</h3>
          <ul className="habits">
            {s.strongest && <li>Strongest skill: {s.strongest.area.toLowerCase()}.</li>}
            {s.weakest && s.weakest !== s.strongest && <li>Work on next: {s.weakest.area.toLowerCase()}.</li>}
            {s.avgShare !== null && (
              <li>
                You speak for about {Math.round(s.avgShare)}% of the time.{" "}
                {s.avgShare < 15 ? "Try to take more turns." : s.avgShare > 35 ? "Leave more room for others." : "That is a healthy share."}
              </li>
            )}
            {s.openedOf > 0 && (
              <li>
                You opened the discussion in {s.openedCount} of {s.openedOf} sessions.
              </li>
            )}
          </ul>
          <ol className="recent">
            {history.slice(0, 4).map((h, i) => (
              <li key={i}>
                <span>{h.topic}</span>
                <span>{h.overall}/10</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
