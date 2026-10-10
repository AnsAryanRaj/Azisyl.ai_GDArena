"use client";
import { useState } from "react";
import { continueAsGuest, logIn, signUp, type User } from "@/lib/auth";
import { LogoMark } from "./Icons";

interface Props {
  mode: "login" | "signup";
  onDone: (u: User) => void;
  onBack: () => void;
}

/** Log in or sign up. Accounts live only on this device, so judges never get stuck on a server. */
export default function Auth({ mode: initialMode, onDone, onBack }: Props) {
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const u = mode === "signup" ? await signUp(name, email, password) : await logIn(email, password);
      onDone(u);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const switchTo = (m: "login" | "signup") => {
    setMode(m);
    setError("");
  };

  return (
    <div className="auth-view">
      <div className="sky" aria-hidden="true">
        <img src="/sky.svg" alt="" />
      </div>
      <header className="room-top">
        <button className="logo" onClick={onBack} aria-label="Back to the home page">
          <LogoMark />
          GD Arena
        </button>
        <button className="pill ghost" onClick={onBack}>
          Back
        </button>
      </header>

      <div className="auth-wrap">
        <form className="auth-card glass" onSubmit={submit} noValidate>
          <div className="auth-tabs" role="tablist" aria-label="Log in or sign up">
            <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => switchTo("login")}>
              Log in
            </button>
            <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => switchTo("signup")}>
              Sign up
            </button>
          </div>

          <h1>{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
          <p className="fine">
            {mode === "signup"
              ? "Your account and progress are saved on this device. We only ask for your name and email."
              : "Log in to see your progress across sessions."}
          </p>

          {mode === "signup" && (
            <div className="field">
              <label htmlFor="su-name">Name</label>
              <input id="su-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={30} required />
            </div>
          )}
          <div className="field">
            <label htmlFor="au-email">Email</label>
            <input
              id="au-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              maxLength={120}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="au-pass">Password</label>
            <input
              id="au-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={6}
              maxLength={100}
              required
            />
          </div>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button className="pill dark" type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Log in"}
          </button>

          <div className="or">or</div>
          <button className="pill plain" type="button" style={{ width: "100%" }} onClick={() => onDone(continueAsGuest(name))}>
            Continue as a guest
          </button>
        </form>
      </div>
    </div>
  );
}
