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

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((s) => setDemo(Boolean(s.demo)))
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
