"use client";
import { useState } from "react";

interface Props {
  where: "report" | "home";
  context?: { topic?: string; format?: string; overall?: number };
  onDone?: () => void;
}

const LABELS = ["Not useful", "Needs work", "Okay", "Good", "Loved it"];

/** Lets students rate GD Arena and tell the team what to improve. */
export default function Feedback({ where, context, onDone }: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) return;
    setState("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment, where, context }),
      });
      if (!res.ok) throw new Error();
      try {
        const prev = JSON.parse(localStorage.getItem("gd-feedback") || "[]");
        localStorage.setItem("gd-feedback", JSON.stringify([{ rating, comment, date: new Date().toISOString() }, ...prev].slice(0, 20)));
      } catch {}
      setState("sent");
      setTimeout(() => onDone?.(), 1400);
    } catch {
      setState("error");
    }
  };

  if (state === "sent") {
    return (
      <p className="fb-thanks" role="status">
        Thanks, your feedback was sent.
      </p>
    );
  }

  return (
    <form className="feedback" onSubmit={send}>
      <fieldset className="stars">
        <legend>{where === "report" ? "How useful was this practice session?" : "How is GD Arena working for you?"}</legend>
        <div>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              className={n <= rating ? "on" : ""}
              aria-pressed={rating === n}
              aria-label={`${n} out of 5, ${LABELS[n - 1]}`}
              onClick={() => setRating(n)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2.8l2.8 5.7 6.3.9-4.6 4.4 1.1 6.3L12 17.1l-5.6 3 1.1-6.3L2.9 9.4l6.3-.9z" />
              </svg>
            </button>
          ))}
          <span className="star-label">{rating ? LABELS[rating - 1] : "Tap a star"}</span>
        </div>
      </fieldset>
      <label htmlFor={`fb-${where}`} className="sr-only">
        What should we improve?
      </label>
      <textarea
        id={`fb-${where}`}
        placeholder="What felt real? What should we improve? (optional)"
        value={comment}
        maxLength={800}
        rows={3}
        onChange={(e) => setComment(e.target.value)}
      />
      {state === "error" && (
        <p className="fb-error" role="alert">
          Feedback could not be sent. Check your connection and try again.
        </p>
      )}
      <button className="pill dark" type="submit" disabled={!rating || state === "sending"}>
        {state === "sending" ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
