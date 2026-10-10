"use client";
import { useEffect, useState } from "react";
import { panelFor } from "@/lib/personas";
import { TOPICS } from "@/lib/topics";
import type { Language, RoomConfig } from "@/lib/types";
import Table from "./Table";

export interface HistoryItem {
  date: string;
  topic: string;
  overall: number;
  youSeconds: number;
}

interface Props {
  initial?: RoomConfig | null;
  demo: boolean | null;
  onStart: (c: RoomConfig) => void;
}

function readHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem("gd-history") || "[]");
  } catch {
    return [];
  }
}

export default function Setup({ initial, demo, onStart }: Props) {
  const [topic, setTopic] = useState(initial?.topic ?? TOPICS[0].text);
  const [custom, setCustom] = useState(
    initial && !TOPICS.some((t) => t.text === initial.topic) ? initial.topic : ""
  );
  const [panelSize, setPanelSize] = useState(initial?.panelSize ?? 4);
  const [minutes, setMinutes] = useState(initial?.minutes ?? 5);
  const [language, setLanguage] = useState<Language>(initial?.language ?? "english");
  const [name, setName] = useState(initial?.studentName ?? "");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    setHistory(readHistory());
    try {
      const saved = localStorage.getItem("gd-name");
      if (saved && !initial?.studentName) setName(saved);
    } catch {}
  }, [initial?.studentName]);

  const chosenTopic = custom.trim() || topic;

  function start(e: React.FormEvent) {
    e.preventDefault();
    const t = chosenTopic.trim();
    if (t.length < 2) return setError("Pick a topic, or type one with at least 2 characters.");
    const studentName = name.trim().slice(0, 30) || "You";
    try {
      localStorage.setItem("gd-name", studentName);
    } catch {}
    onStart({ topic: t.slice(0, 160), panelSize, minutes, language, studentName });
  }

  return (
    <form className="setup" onSubmit={start} noValidate>
      <div>
        <h1>Practise a group discussion before the real one.</h1>
        <p className="lede">
          Sit at a table with AI participants who argue, interrupt and drift off topic, just like a real campus GD. Then
          get feedback that points to exactly what you said.
        </p>

        <fieldset>
          <legend>Topic</legend>
          <div className="topics">
            {TOPICS.map((t) => (
              <button
                type="button"
                key={t.text}
                className="chip"
                aria-pressed={!custom.trim() && topic === t.text}
                onClick={() => {
                  setTopic(t.text);
                  setCustom("");
                  setError("");
                }}
              >
                {t.text}
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="custom-topic">
            Or type your own topic
          </label>
          <input
            id="custom-topic"
            className="input"
            placeholder="Or type your own topic"
            value={custom}
            maxLength={160}
            onChange={(e) => {
              setCustom(e.target.value);
              setError("");
            }}
          />
        </fieldset>

        <div className="row">
          <fieldset>
            <legend>AI participants</legend>
            <div className="segment">
              {[3, 4, 5].map((n) => (
                <button type="button" key={n} aria-pressed={panelSize === n} onClick={() => setPanelSize(n)}>
                  {n}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Minutes</legend>
            <div className="segment">
              {[3, 5, 8, 10].map((n) => (
                <button type="button" key={n} aria-pressed={minutes === n} onClick={() => setMinutes(n)}>
                  {n}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Language</legend>
            <div className="segment">
              <button type="button" aria-pressed={language === "english"} onClick={() => setLanguage("english")}>
                English
              </button>
              <button type="button" aria-pressed={language === "hinglish"} onClick={() => setLanguage("hinglish")}>
                Hinglish
              </button>
            </div>
          </fieldset>
        </div>

        <fieldset>
          <label className="label" htmlFor="name">
            Your name
          </label>
          <input
            id="name"
            className="input"
            placeholder="So the moderator can call on you"
            value={name}
            maxLength={30}
            autoComplete="given-name"
            onChange={(e) => setName(e.target.value)}
          />
        </fieldset>

        {error && (
          <p className="banner error" role="alert">
            {error}
          </p>
        )}

        <div className="start-row">
          <button className="btn primary" type="submit">
            Start discussion
          </button>
          <span className="fine">
            {demo ? "Demo mode: scripted replies, no AI key set." : "Uses your microphone. Works best in Chrome or Edge."}
          </span>
        </div>

        {history.length > 0 && (
          <section className="history" aria-label="Your past sessions">
            <div className="label">Your past sessions</div>
            <ol>
              {history.slice(0, 5).map((h, i) => (
                <li key={i}>
                  <span>{h.topic}</span>
                  <span>
                    {h.overall}/10, you spoke {Math.round(h.youSeconds)}s
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      <Table panel={panelFor(panelSize)} studentName={name.trim() || "You"} topic={chosenTopic} />
    </form>
  );
}
