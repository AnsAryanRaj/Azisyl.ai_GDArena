"use client";
import { MODERATOR } from "@/lib/personas";
import type { Persona } from "@/lib/types";
import Avatar from "./Avatar";

interface Props {
  panel: Persona[];
  studentName: string;
  speakingId?: string | null;
  thinking?: boolean;
  topic?: string;
}

/** Top-down round table. Moderator at the head, the student at the foot, AI around the sides. */
export default function Table({ panel, studentName, speakingId, thinking, topic }: Props) {
  type Seat = { id: string; name: string; role: string; persona?: Persona; angle: number };
  const seats: Seat[] = [
    { id: MODERATOR.id, name: MODERATOR.name, role: MODERATOR.role, persona: MODERATOR, angle: -90 },
    { id: "you", name: studentName || "You", role: "You", angle: 90 },
  ];
  const left: Persona[] = [];
  const right: Persona[] = [];
  panel.forEach((p, i) => (i % 2 === 0 ? left : right).push(p));
  const place = (list: Persona[], from: number, to: number) =>
    list.forEach((p, i) => {
      const t = (i + 1) / (list.length + 1);
      seats.push({ id: p.id, name: p.name, role: p.role, persona: p, angle: from + (to - from) * t });
    });
  place(left, 220, 140);
  place(right, -40, 40);

  return (
    <div className="table-wrap" role="group" aria-label="Discussion table">
      <div className="table">{topic && <div className="table-topic">{topic}</div>}</div>
      {seats.map((s) => {
        const rad = (s.angle * Math.PI) / 180;
        const x = 50 + 42 * Math.cos(rad);
        const y = 50 + 37 * Math.sin(rad);
        const speaking = speakingId === s.id;
        const cls = ["seat", speaking && "speaking", s.id === "you" && "you", thinking && speaking && "thinking"]
          .filter(Boolean)
          .join(" ");
        return (
          <div key={s.id} className={cls} style={{ left: `${x}%`, top: `${y}%` }}>
            <div style={{ position: "relative" }}>
              <Avatar look={s.persona?.look} shirt={s.persona?.color ?? "#ffc531"} size={60} />
              <div className="bars" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="seat-name">
              {s.name}
              {speaking && <span className="sr-only">, speaking</span>}
            </div>
            <div className="seat-role">{s.role === "You" ? "Human" : s.role}</div>
          </div>
        );
      })}
    </div>
  );
}
