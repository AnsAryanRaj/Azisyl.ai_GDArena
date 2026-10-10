"use client";
import { useEffect, useState } from "react";
import { friendLook } from "@/lib/personas";
import type { RoomConfig } from "@/lib/types";
import Avatar from "./Avatar";
import { LogoMark } from "./Icons";

interface Props {
  code: string;
  hostKey: string;
  config: RoomConfig; // panelSize here means "other seats at the table"
  onStart: (config: RoomConfig) => void;
  onCancel: () => void;
}

/** The host waits here while friends join with the code. Empty seats are filled by AI. */
export default function Lobby({ code, hostKey, config, onStart, onCancel }: Props) {
  const [friends, setFriends] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/?join=${code}` : "";
  const seats = Math.max(config.panelSize, friends.length + 2);
  const aiSeats = Math.max(2, seats - friends.length);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch(`/api/room/${code}`, { cache: "no-store" });
        const d = await r.json();
        if (alive && r.ok) {
          setFriends(d.friends ?? []);
          setError("");
        } else if (alive) setError(d.error ?? "Room not found.");
      } catch {
        if (alive) setError("Connection lost. Retrying…");
      }
    };
    poll();
    const t = setInterval(poll, 1200);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [code]);

  const start = async () => {
    setStarting(true);
    setError("");
    try {
      const res = await fetch(`/api/room/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", hostKey, config: { ...config, panelSize: aiSeats, friends } }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not start.");
      onStart(d.config);
    } catch (e) {
      setError((e as Error).message);
      setStarting(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="auth-view">
      <div className="sky" aria-hidden="true">
        <img src="/sky.svg" alt="" />
      </div>
      <header className="room-top">
        <button className="logo" onClick={onCancel}>
          <LogoMark />
          GD Arena
        </button>
        <button className="pill ghost" onClick={onCancel}>
          Cancel
        </button>
      </header>
      <div className="auth-wrap">
        <section className="auth-card glass lobby" aria-label="Room lobby">
          <p className="fine" style={{ margin: 0 }}>
            Share this code with your friends
          </p>
          <div className="room-code" aria-label={`Room code ${code.split("").join(" ")}`}>
            {code}
          </div>
          <p className="fine">
            They open GD Arena, tap &quot;Join a friend&apos;s room&quot; and type the code, or open this link:
          </p>
          <div className="link-row">
            <code>{link}</code>
            <button className="pill plain" onClick={copy}>
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>

          <h2 className="lobby-h">At the table</h2>
          <ul className="lobby-list">
            <li>
              <Avatar size={36} /> <b>{config.studentName}</b> <span>Host</span>
            </li>
            {friends.map((f) => (
              <li key={f.id}>
                <Avatar size={36} look={friendLook(f.id).look} shirt={friendLook(f.id).color} /> <b>{f.name}</b> <span>Friend</span>
              </li>
            ))}
            {friends.length === 0 && <li className="waiting">Waiting for friends to join…</li>}
          </ul>
          <p className="fine">
            {friends.length} friend{friends.length === 1 ? "" : "s"} joined. AI will fill {aiSeats} seat{aiSeats === 1 ? "" : "s"}, plus Ms. Rao
            as moderator.
          </p>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button className="pill dark" onClick={start} disabled={starting}>
            {starting ? "Starting…" : friends.length ? "Start the discussion" : "Start without friends"}
          </button>
        </section>
      </div>
    </div>
  );
}
