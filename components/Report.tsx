"use client";
import { useEffect, useRef, useState } from "react";
import { MODERATOR, panelFor, personaById } from "@/lib/personas";
import { speakingStats } from "@/lib/stats";
import type { Line, Report as ReportData, RoomConfig } from "@/lib/types";
import { addHistory, readHistory } from "@/lib/progress";
import Avatar from "./Avatar";
import Feedback from "./Feedback";
import { LogoMark, MicIcon } from "./Icons";

interface Props {
  config: RoomConfig;
  lines: Line[];
  onAgain: () => void;
  onHome: () => void;
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function Report({ config, lines, onAgain, onHome }: Props) {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [prevOverall, setPrevOverall] = useState<number | null>(null);
  const saved = useRef(false);
  const stats = speakingStats(lines);
  const people = ["you", ...panelFor(config.panelSize).map((p) => p.id), MODERATOR.id];

  const load = async () => {
    setError("");
    setData(null);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config,
          transcript: lines.map(({ id, speakerId, text }) => ({ id, speakerId, text })),
          stats,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const r = (await res.json()) as ReportData;
      setData(r);
      if (!saved.current) {
        saved.current = true;
        const before = readHistory();
        setPrevOverall(before[0]?.overall ?? null);
        const total = Object.values(stats).reduce((a, x) => a + x.seconds, 0) || 1;
        const firstSpeaker = lines.find((l) => l.speakerId !== "moderator")?.speakerId;
        addHistory({
          date: new Date().toISOString(),
          topic: config.topic,
          format: config.format,
          overall: r.overall,
          youSeconds: stats.you?.seconds ?? 0,
          youShare: Math.round(((stats.you?.seconds ?? 0) / total) * 100),
          turns: stats.you?.turns ?? 0,
          spokeFirst: firstSpeaker === "you",
          points: r.points.map((p) => ({ area: p.area, score: p.score })),
        });
      }
    } catch {
      setError("The report could not be generated. Check your connection and try again.");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byId = new Map(lines.map((l) => [l.id, l]));
  const nameOf = (id: string) => (id === "you" ? config.studentName : personaById(id)?.name ?? id);
  const colorOf = (id: string) => (id === "you" ? "#ffc531" : personaById(id)?.color ?? "#888");
  const totalSeconds = people.reduce((s, id) => s + (stats[id]?.seconds ?? 0), 0) || 1;

  const jump = (id: string) => {
    const el = document.getElementById(`line-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlash(id);
    setTimeout(() => setFlash(null), 1800);
  };

  return (
    <div className="report-view">
      <div className="scene faded" aria-hidden="true">
        <img src="/scene.svg" alt="" />
      </div>
      <header className="room-top">
        <button className="logo" onClick={onHome} style={{ color: "var(--ink)" }}>
          <LogoMark />
          GD Arena
        </button>
        <button className="pill dark" onClick={onAgain}>
          Practise again
        </button>
      </header>

      {!data && !error && (
        <div className="loading" role="status">
          <div className="glass">
            <h2>Writing your report…</h2>
            <p style={{ margin: 0 }}>Reading the transcript and matching feedback to what you said.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="loading" role="alert">
          <div className="glass">
            <h2>Report not ready</h2>
            <p>{error}</p>
            <button className="pill dark" onClick={load}>
              Try again
            </button>
          </div>
        </div>
      )}

      {data && (
        <main className="report">
          <section className="report-hero glass">
            <div className="score-ring" style={{ ["--pct" as string]: data.overall * 10 }} aria-label={`Overall score ${data.overall} out of 10`}>
              <div>
                <div>
                  <strong>{data.overall}</strong>
                  <br />
                  <span>out of 10</span>
                </div>
              </div>
            </div>
            <div>
              <h1>
                Your GD report
                {prevOverall !== null && (
                  <span className="delta" style={{ fontFamily: "var(--sans)" }}>
                    {data.overall > prevOverall
                      ? `Up ${data.overall - prevOverall} from last time`
                      : data.overall < prevOverall
                        ? `Down ${prevOverall - data.overall} from last time`
                        : "Same as last time"}
                  </span>
                )}
              </h1>
              <p style={{ fontWeight: 600, marginBottom: 6 }}>{config.topic}</p>
              <p>{data.summary}</p>
              {data.demo && <p className="demo-note">Demo report. Add an AI key for a full assessment.</p>}
            </div>
          </section>

          <section className="card glass" aria-label="Speaking time">
            <h2>Who spoke how much</h2>
            <div className="share-bar" role="img" aria-label="Share of speaking time by participant">
              {people.map((id) =>
                stats[id] ? (
                  <div key={id} style={{ width: `${((stats[id].seconds || 0) / totalSeconds) * 100}%`, background: colorOf(id) }} />
                ) : null
              )}
            </div>
            <div className="share-legend">
              {people.map((id) => (
                <span key={id}>
                  <i style={{ background: colorOf(id) }} />
                  <b>{nameOf(id)}</b> {Math.round(((stats[id]?.seconds ?? 0) / totalSeconds) * 100)}%, {stats[id]?.turns ?? 0} turns
                </span>
              ))}
            </div>
          </section>

          <ul className="points">
            {data.points.map((p) => (
              <li className="point glass" key={p.area}>
                <div className="point-head">
                  <h3>{p.area}</h3>
                  <span className="pips" aria-label={`${p.score} out of 5`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <i key={n} className={n <= p.score ? "on" : ""} />
                    ))}
                  </span>
                </div>
                <p>{p.verdict}</p>
                <p className="tip">Next time: {p.tip}</p>
                {p.quoteIds.map((q) => {
                  const l = byId.get(q);
                  if (!l) return null;
                  return (
                    <button className="quote" key={q} onClick={() => jump(q)} aria-label={`Show this moment in the transcript: ${l.text}`}>
                      <small>
                        {nameOf(l.speakerId)}, {clock(l.startedAt)}
                      </small>
                      &ldquo;{l.text}&rdquo;
                    </button>
                  );
                })}
              </li>
            ))}
          </ul>

          {data.missedOpening && byId.get(data.missedOpening.afterLineId) && (
            <section className="missed" aria-label="What you could have said">
              <h2>What you could have said</h2>
              <p className="after">
                After {nameOf(byId.get(data.missedOpening.afterLineId)!.speakerId)} said &ldquo;
                {byId.get(data.missedOpening.afterLineId)!.text}&rdquo;
              </p>
              <blockquote>&ldquo;{data.missedOpening.youCouldHaveSaid}&rdquo;</blockquote>
            </section>
          )}

          <section className="card glass" aria-label="Full transcript">
            <h2>Full transcript</h2>
            <ol className="transcript-list" style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
              {lines.map((l) => {
                const p = personaById(l.speakerId);
                return (
                  <li
                    key={l.id}
                    id={`line-${l.id}`}
                    className={`tline ${l.speakerId === "you" ? "you" : ""} ${flash === l.id ? "flash" : ""}`}
                  >
                    <Avatar look={p?.look} shirt={p?.color ?? "#ffc531"} size={32} />
                    <div>
                      <b>{nameOf(l.speakerId)}</b>
                      <span className="tag">{clock(l.startedAt)}</span>
                      {l.interrupted && <span className="tag">cut off</span>}
                      <div>{l.text}</div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="card glass" aria-label="Rate this session">
            <h2>Help us improve GD Arena</h2>
            <Feedback where="report" context={{ topic: config.topic, format: config.format, overall: data.overall }} />
          </section>

          <div className="report-actions">
            <button className="pill sun" onClick={onAgain}>
              Practise the same topic again
              <span className="icon-disc">
                <MicIcon />
              </span>
            </button>
            <button className="pill plain" onClick={onHome}>
              Choose a new topic
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
