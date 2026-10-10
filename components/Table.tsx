"use client";
import { friendLook, MODERATOR } from "@/lib/personas";
import type { Persona } from "@/lib/types";
import Avatar from "./Avatar";

interface Props {
  panel: Persona[];
  studentName: string;
  speakingId?: string | null;
  thinking?: boolean;
  topic?: string;
  yourTurn?: boolean;
  humans?: { id: string; name: string }[]; // friends in a shared room
}

/** Top-down round table. Moderator at the head, the student at the foot, AI around the sides. */
export default function Table({ panel, studentName, speakingId, thinking, topic, yourTurn, humans = [] }: Props) {
  type Seat = { id: string; name: string; role: string; persona?: Persona; angle: number; human?: boolean };
  const seats: Seat[] = [
    { id: MODERATOR.id, name: MODERATOR.name, role: MODERATOR.role, persona: MODERATOR, angle: -90 },
    { id: "you", name: studentName || "You", role: "You", angle: 90 },
  ];
  // Friends sit among the AI participants, so the table reads as one group.
  const others: Omit<Seat, "angle">[] = [
    ...humans.map((h) => {
      const fl = friendLook(h.id);
      const persona = { id: h.id, name: h.name, role: "Friend", style: "", voice: { pitch: 1, rate: 1, prefer: [] }, color: fl.color, gender: "f", look: fl.look } as Persona;
      return { id: h.id, name: h.name, role: "Friend", persona, human: true };
    }),
    ...panel.map((p) => ({ id: p.id, name: p.name, role: p.role, persona: p })),
  ];
  const left: Omit<Seat, "angle">[] = [];
  const right: Omit<Seat, "angle">[] = [];
  others.forEach((p, i) => (i % 2 === 0 ? left : right).push(p));
  // Spread each side evenly between the moderator (top) and the student (bottom).
  const place = (list: Omit<Seat, "angle">[], from: number, to: number) =>
    list.forEach((p, i) => {
      const t = (i + 1) / (list.length + 1);
      seats.push({ ...p, angle: from + (to - from) * t });
    });
  place(left, 270, 90);
  place(right, -90, 90);

  return (
    <div className="table-wrap" role="group" aria-label="Discussion table">
      <div className="table">{topic && <div className="table-topic">{topic}</div>}</div>
      {seats.map((s) => {
        const rad = (s.angle * Math.PI) / 180;
        const x = 50 + 42 * Math.cos(rad);
        const y = 50 + 39 * Math.sin(rad);
        const speaking = speakingId === s.id;
        const cls = ["seat", speaking && "speaking", (s.id === "you" || s.human) && "you", s.id === "you" && yourTurn && !speaking && "turn", thinking && speaking && "thinking"]
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
            {s.persona && s.id !== MODERATOR.id && <div className="seat-role">{s.human ? "Friend, human" : s.role}</div>}
          </div>
        );
      })}
    </div>
  );
}
