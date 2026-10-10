"use client";
import { useEffect, useState } from "react";
import Auth from "@/components/Auth";
import FriendRoom from "@/components/FriendRoom";
import Home from "@/components/Home";
import JoinRoom, { type Joined } from "@/components/JoinRoom";
import Landing from "@/components/Landing";
import Lobby from "@/components/Lobby";
import Report from "@/components/Report";
import Room from "@/components/Room";
import { continueAsGuest, currentUser, logOut, ownerKey, type User } from "@/lib/auth";
import { setHistoryOwner } from "@/lib/progress";
import type { Line, RoomConfig } from "@/lib/types";

type View = "landing" | "auth" | "home" | "lobby" | "room" | "join" | "guest" | "report";

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
  const [shared, setShared] = useState<{ code: string; hostKey: string } | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joined, setJoined] = useState<Joined | null>(null);
  const [friendError, setFriendError] = useState("");

  const signIn = (u: User) => {
    setHistoryOwner(ownerKey(u));
    setUser(u);
    setConfig(null);
    setView("home");
  };

  useEffect(() => {
    const u = currentUser();
    // A friend opened an invite link: take them straight to the join screen.
    const code = new URLSearchParams(window.location.search).get("join");
    if (u) {
      setHistoryOwner(ownerKey(u));
      setUser(u);
    }
    if (code) {
      setJoinCode(code.toUpperCase().slice(0, 4));
      setView("join");
    } else if (u) setView("home");
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
  const backHome = () => setView(user ? "home" : "landing");

  const createRoom = async (c: RoomConfig) => {
    setFriendError("");
    try {
      const res = await fetch("/api/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostName: c.studentName }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not create a room.");
      setShared({ code: d.code, hostKey: d.hostKey });
      setConfig(c);
      setView("lobby");
    } catch (e) {
      setFriendError((e as Error).message);
    }
  };

  if (!ready) return <div className="frame" />;

  return (
    <div className="frame">
      {view === "landing" && (
        <Landing
          onLogIn={() => openAuth("login")}
          onSignUp={() => openAuth("signup")}
          onGuest={() => signIn(continueAsGuest(""))}
          onJoin={() => setView("join")}
        />
      )}
      {view === "auth" && <Auth key={authMode} mode={authMode} onDone={signIn} onBack={() => setView("landing")} />}
      {view === "home" && user && (
        <>
          {friendError && <p className="banner error" style={{ position: "absolute", top: 90, left: 0, right: 0, zIndex: 5 }}>{friendError}</p>}
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
              setShared(null);
              setConfig(c);
              setRoomKey((k) => k + 1);
              setView("room");
            }}
            onFriends={createRoom}
            onJoin={() => setView("join")}
          />
        </>
      )}
      {view === "lobby" && shared && config && (
        <Lobby
          code={shared.code}
          hostKey={shared.hostKey}
          config={config}
          onCancel={() => {
            setShared(null);
            setView("home");
          }}
          onStart={(c) => {
            setConfig(c);
            setRoomKey((k) => k + 1);
            setView("room");
          }}
        />
      )}
      {view === "join" && (
        <JoinRoom
          initialCode={joinCode}
          initialName={user && !user.guest ? user.name : ""}
          onBack={() => {
            window.history.replaceState(null, "", "/");
            backHome();
          }}
          onJoined={(j) => {
            window.history.replaceState(null, "", "/");
            setJoined(j);
            setView("guest");
          }}
        />
      )}
      {view === "guest" && joined && (
        <FriendRoom
          joined={joined}
          onLeave={() => {
            setJoined(null);
            backHome();
          }}
          onDone={(c, l) => {
            setShared(null);
            setConfig(c);
            setLines(l);
            setView("report");
          }}
        />
      )}
      {view === "room" && config && (
        <Room
          key={roomKey}
          config={config}
          shared={shared ?? undefined}
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
          onHome={backHome}
          onAgain={() => {
            if (!user || config.friends?.length) return backHome();
            setRoomKey((k) => k + 1);
            setView("room");
          }}
        />
      )}
    </div>
  );
}
