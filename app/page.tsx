"use client";
import { useEffect, useState } from "react";
import Auth from "@/components/Auth";
import Home from "@/components/Home";
import Landing from "@/components/Landing";
import Report from "@/components/Report";
import Room from "@/components/Room";
import { continueAsGuest, currentUser, logOut, ownerKey, type User } from "@/lib/auth";
import { setHistoryOwner } from "@/lib/progress";
import type { Line, RoomConfig } from "@/lib/types";

type View = "landing" | "auth" | "home" | "room" | "report";

export default function Page() {
  const [view, setView] = useState<View>("landing");
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<RoomConfig | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [roomKey, setRoomKey] = useState(0);
  const [demo, setDemo] = useState<boolean | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const signIn = (u: User) => {
    setHistoryOwner(ownerKey(u));
    setUser(u);
    setConfig(null);
    setView("home");
  };

  useEffect(() => {
    // Logged in before? Go straight to practice.
    const u = currentUser();
    if (u) signIn(u);
    setReady(true);
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

  const openAuth = (m: "login" | "signup") => {
    setAuthMode(m);
    setView("auth");
  };

  if (!ready) return <div className="frame" />;

  return (
    <div className="frame">
      {view === "landing" && (
        <Landing onLogIn={() => openAuth("login")} onSignUp={() => openAuth("signup")} onGuest={() => signIn(continueAsGuest(""))} />
      )}
      {view === "auth" && <Auth key={authMode} mode={authMode} onDone={signIn} onBack={() => setView("landing")} />}
      {view === "home" && user && (
        <Home
          initial={config}
          demo={demo}
          aiError={aiError}
          user={user}
          onLogOut={() => {
            logOut();
            setUser(null);
            setHistoryOwner("guest");
            setView("landing");
          }}
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
