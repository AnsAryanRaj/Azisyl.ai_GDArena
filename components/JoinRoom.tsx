"use client";
import { useState } from "react";
import { LogoMark } from "./Icons";

export interface Joined {
  code: string;
  friendId: string;
  key: string;
  name: string;
}

interface Props {
  initialCode?: string;
  initialName?: string;
  onJoined: (j: Joined) => void;
  onBack: () => void;
}

/** A friend joins the host's room with the 4-letter code. No account needed. */
export default function JoinRoom({ initialCode = "", initialName = "", onJoined, onBack }: Props) {
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.toUpperCase().replace(/[^A-Z]/g, "");
    if (c.length !== 4) return setError("The room code has 4 letters, like KQTM.");
    if (name.trim().length < 2) return setError("Enter your name, at least 2 letters.");
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/room/${c}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", name }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not join.");
      try {
        localStorage.setItem("gd-name", name.trim());
      } catch {}
      onJoined({ code: c, friendId: d.friendId, key: d.key, name: name.trim().slice(0, 30) });
    } catch (err) {
      setError((err as Error).message === "Failed to fetch" ? "No connection. Check your internet and try again." : (err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="auth-view">
      <div className="sky" aria-hidden="true">
        <img src="/sky.svg" alt="" />
      </div>
      <header className="room-top">
        <button className="logo" onClick={onBack}>
          <LogoMark />
          GD Arena
        </button>
        <button className="pill ghost" onClick={onBack}>
          Back
        </button>
      </header>
      <div className="auth-wrap">
        <form className="auth-card glass" onSubmit={join} noValidate>
          <h1>Join a friend&apos;s room</h1>
          <p className="fine">Ask the host for the 4-letter code. The other seats are filled by AI participants.</p>
          <div className="field">
            <label htmlFor="j-code">Room code</label>
            <input
              id="j-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
              autoCapitalize="characters"
              autoComplete="off"
              inputMode="text"
              className="code-input"
              placeholder="ABCD"
            />
          </div>
          <div className="field">
            <label htmlFor="j-name">Your name</label>
            <input id="j-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoComplete="given-name" />
          </div>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button className="pill dark" type="submit" disabled={busy}>
            {busy ? "Joining…" : "Join room"}
          </button>
        </form>
      </div>
    </div>
  );
}
