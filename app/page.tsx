"use client";
import { useEffect, useState } from "react";
import Home from "@/components/Home";
import Report from "@/components/Report";
import Room from "@/components/Room";
import type { Line, RoomConfig } from "@/lib/types";

type View = "home" | "room" | "report";

export default function Page() {
  const [view, setView] = useState<View>("home");
  const [config, setConfig] = useState<RoomConfig | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [roomKey, setRoomKey] = useState(0);
  const [demo, setDemo] = useState<boolean | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    // One tiny test call, so a wrong key or a rate limit shows up before the demo, not during it.
    fetch("/api/status?check=1")
      .then((r) => r.json())
      .then((s) => {
        setDemo(Boolean(s.demo));
        setAiError(s.demo || s.ok ? null : String(s.error || "Unknown error"));
      })
      .catch(() => setDemo(null));
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  return (
    <div className="frame">
      {view === "home" && (
        <Home
          initial={config}
          demo={demo}
          aiError={aiError}
          onStart={(c) => {
            setConfig(c);
            setRoomKey((k) => k + 1);
            setView("room");
          }}
        />
      )}
      {view === "room" && config && (
        <Room
          key={roomKey}
          config={config}
          onLeave={() => setView("home")}
          onDone={(l) => {
            setLines(l);
            setView("report");
          }}
        />
      )}
      {view === "report" && config && (
        <Report
          config={config}
          lines={lines}
          onHome={() => setView("home")}
          onAgain={() => {
            setRoomKey((k) => k + 1);
            setView("room");
          }}
        />
      )}
    </div>
  );
}
