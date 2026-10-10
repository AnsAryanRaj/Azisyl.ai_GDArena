"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { readHistory, summarise, type HistoryItem } from "@/lib/progress";
import { MODERATOR, PANEL } from "@/lib/personas";
import { FORMATS, TOPICS, type Topic } from "@/lib/topics";
import type { GdFormat, Language, RoomConfig } from "@/lib/types";
import Avatar from "./Avatar";
import Feedback from "./Feedback";
import { LogoMark, MicIcon, SparkIcon } from "./Icons";


interface Props {
  initial?: RoomConfig | null;
  demo: boolean | null;
  aiError?: string | null;
  onStart: (c: RoomConfig) => void;
}

const KINDS: ("All" | Topic["kind"])[] = ["All", "Current affairs", "Business", "Tech", "Social", "Regional", "Abstract", "Controversial", "Case"];

export default function Home({ initial, demo, aiError, onStart }: Props) {
  const [kind, setKind] = useState<(typeof KINDS)[number]>("All");
  const [topic, setTopic] = useState(initial?.topic ?? "");
  const [panelSize, setPanelSize] = useState(initial?.panelSize ?? 4);
  const [minutes, setMinutes] = useState(initial?.minutes ?? 5);
  const [language, setLanguage] = useState<Language>(initial?.language ?? "english");
  const [name, setName] = useState(initial?.studentName ?? "");
  const [format, setFormat] = useState<GdFormat>(initial?.format ?? "standard");
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
    () => (kind === "All" ? TOPICS.slice(0, 4) : TOPICS.filter((t) => t.kind === kind)),
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
    onStart({ topic: t.slice(0, 160), panelSize, minutes, language, studentName, format, brief });
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
            <a href="#how">How it works</a>
            <a href="#panel">The panel</a>
            <a href="#feedback">Sample report</a>
            <button type="button" onClick={openFeedback}>
              Give feedback
            </button>
          </div>
          <div className="nav-right">
            <button className="pill dark" type="button" onClick={() => start()}>
              Start practising
            </button>
          </div>
        </nav>

        <form className="hero-body" id="top" onSubmit={start} noValidate>
          <span className="ai-chip">
            <i aria-hidden="true" /> Everyone else at the table is AI
          </span>
          <h1>
            Your first GD should <em>not</em> be the real one.
          </h1>
          <p className="sub">
            Sit with an AI panel that argues, interrupts and drifts off topic, like a real placement group discussion.
            Then get feedback that quotes exactly what you said.
          </p>

          <div className="tabs glass" role="group" aria-label="Topic type">
            {KINDS.map((k) => (
              <button type="button" key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>
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
              placeholder="Type any GD topic, or pick one below"
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

          <div className="quick">
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

      <section className="section" id="how">
        <h2>A real GD room, any time you want one.</h2>
        <p className="lead">
          Most students walk into their first group discussion without ever sitting in one. GD Arena gives you the room,
          the people and an honest assessor.
        </p>
        <ol className="steps">
          <li>
            <h3>Pick a topic and your panel</h3>
            <p>Choose from current affairs, business, tech or abstract topics, or type your own. Pick 3 to 5 AI participants.</p>
          </li>
          <li>
            <h3>Speak like you would in the room</h3>
            <p>Ms. Rao opens, the timer runs, and the panel debates out loud. Tap Speak to jump in. They stop when you cut in.</p>
          </li>
          <li>
            <h3>Read your report</h3>
            <p>See who spoke how much, and get scores on six GD skills. Every point links to the exact moment in the transcript.</p>
          </li>
        </ol>
      </section>

      <section className="section" id="panel">
        <h2>Meet the people at your table.</h2>
        <p className="lead">Each one has a different personality and voice, so you practise handling the people you will actually meet.</p>
        <div className="cast">
          {[MODERATOR, ...PANEL].map((p) => (
            <div className="cast-card" key={p.id}>
              <Avatar look={p.look} shirt={p.color} size={72} />
              <b>{p.name}</b>
              <span>{p.role}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="feedback">
        <div className="sample">
          <div className="scene" aria-hidden="true">
            <img src="/scene.svg" alt="" />
          </div>
          <div>
            <h2>Feedback that points to what you said.</h2>
            <p className="lead">
              No vague &quot;be more confident&quot;. Each score comes with a quote from your discussion and one thing to try next
              time.
            </p>
            <button className="pill sun" type="button" onClick={() => document.getElementById("topic")?.focus()}>
              Try a discussion
              <span className="icon-disc">
                <SparkIcon />
              </span>
            </button>
          </div>
          <div className="sample-card glass">
            <div className="point-head">
              <h3 style={{ margin: 0 }}>Handling interruptions</h3>
              <span className="pips" aria-label="2 out of 5">
                <i className="on" />
                <i className="on" />
                <i />
                <i />
                <i />
              </span>
            </div>
            <p style={{ margin: "8px 0 0" }}>When Arjun cut in, you stopped and did not return to your point.</p>
            <p style={{ margin: "6px 0 0", color: "var(--glass-muted)" }}>
              Next time: say &quot;Let me finish this one point&quot; calmly, then complete it in one sentence.
            </p>
            <div className="quote" style={{ cursor: "default" }}>
              <small>Arjun, 2:14</small>
              &quot;Let me stop you there. Theory sounds nice, but companies care about results.&quot;
            </div>
          </div>
        </div>
      </section>

      {history.length > 0 && <Progress history={history} />}

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
