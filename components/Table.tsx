"use client";
import { MODERATOR } from "@/lib/personas";
import type { Persona } from "@/lib/types";

interface Props {
  panel: Persona[];
  studentName: string;
  speakingId?: string | null;
  thinking?: boolean;
  topic?: string;
  timer?: string;
}

/** Top-down round table. Moderator at the head, the student at the foot, AI around the sides. */
export default function Table({ panel, studentName, speakingId, thinking, topic, timer }: Props) {
  type Seat = { id: string; name: string; role: string; color: string; angle: number };
  const seats: Seat[] = [
    { id: MODERATOR.id, name: MODERATOR.name, role: MODERATOR.role, color: MODERATOR.color, angle: -90 },
    { id: "you", name: studentName || "You", role: "You", color: "#f0a82a", angle: 90 },
  ];
  // Spread AI participants on the left and right arcs, alternating sides.
  const left: Persona[] = [];
  const right: Persona[] = [];
  panel.forEach((p, i) => (i % 2 === 0 ? left : right).push(p));
  const place = (list: Persona[], from: number, to: number) =>
    list.forEach((p, i) => {
      const t = (i + 1) / (list.length + 1);
      seats.push({ id: p.id, name: p.name, role: p.role, color: p.color, angle: from + (to - from) * t });
    });
  place(left, 225, 135); // upper-left down to lower-left
  place(right, -45, 45); // upper-right down to lower-right

  return (
    <div className="table-wrap" role="group" aria-label="Discussion table">
      <div className="table" aria-hidden={!topic && !timer}>
        <div>
          {topic && <div className="table-topic">{topic}</div>}
          {timer && (
            <span className="table-timer" aria-label={`Time left ${timer}`}>
              {timer}
            </span>
          )}
        </div>
      </div>
      {seats.map((s) => {
        const rad = (s.angle * Math.PI) / 180;
        const x = 50 + 41 * Math.cos(rad);
        const y = 50 + 40 * Math.sin(rad);
        const speaking = speakingId === s.id;
        const cls = ["seat", speaking ? "speaking" : "", s.id === "you" ? "you" : "", thinking && speaking ? "thinking" : ""]
          .filter(Boolean)
          .join(" ");
        return (
          <div
            key={s.id}
            className={cls}
            style={{ left: `${x}%`, top: `${y}%`, ["--seat-color" as string]: s.color }}
            aria-label={`${s.name}, ${s.role}${speaking ? ", speaking" : ""}`}
          >
            <div className="tent">
              <div className="tent-name">{s.name}</div>
              <div className="tent-role">{s.role}</div>
            </div>
            <div className="bars" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          </div>
        );
      })}
    </div>
  );
}
