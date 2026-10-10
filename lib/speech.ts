"use client";
// Browser speech: Web Speech API for listening, speechSynthesis for AI voices.
// Free, no keys, works best in Chrome and Edge.

import type { Persona } from "./types";

/* ---------------- Text to speech ---------------- */

export function ttsSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!ttsSupported()) return resolve([]);
    const now = window.speechSynthesis.getVoices();
    if (now.length) return resolve(now);
    const done = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1500);
  });
}

/** Give each persona a different voice where the device has enough of them. */
export async function assignVoices(personas: Persona[]) {
  const voices = (await loadVoices()).filter((v) => v.lang.toLowerCase().startsWith("en"));
  const map = new Map<string, SpeechSynthesisVoice | null>();
  const used = new Set<string>();
  for (const p of personas) {
    let pick: SpeechSynthesisVoice | undefined;
    for (const lang of p.voice.prefer) {
      pick = voices.find((v) => v.lang.replace("_", "-").startsWith(lang) && !used.has(v.name));
      if (pick) break;
    }
    pick = pick ?? voices.find((v) => !used.has(v.name)) ?? voices[0];
    if (pick) used.add(pick.name);
    map.set(p.id, pick ?? null);
  }
  return map;
}

export const estimateMs = (text: string, rate = 1) =>
  Math.max(1200, (text.split(/\s+/).length / 2.6) * 1000 / rate);

export interface SpeakResult {
  durationMs: number;
  interrupted: boolean;
  spokenChars: number;
}

let activeCancel: (() => void) | null = null;

/** Speak a line. Resolves when finished or cancelled. Falls back to a silent wait. */
export function speak(
  text: string,
  persona: Persona,
  voice: SpeechSynthesisVoice | null | undefined,
  enabled: boolean
): Promise<SpeakResult> {
  return new Promise((resolve) => {
    const started = performance.now();
    let spokenChars = 0;
    let settled = false;
    const finish = (interrupted: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      activeCancel = null;
      resolve({ durationMs: performance.now() - started, interrupted, spokenChars: interrupted ? spokenChars : text.length });
    };

    const est = estimateMs(text, persona.voice.rate);
    // Chrome sometimes never fires onend. Never let the room get stuck.
    const guard = setTimeout(() => finish(false), enabled && ttsSupported() ? est * 2 + 4000 : est);

    activeCancel = () => {
      if (ttsSupported()) window.speechSynthesis.cancel();
      finish(true);
    };

    if (!enabled || !ttsSupported()) return; // captions only; guard timer ends the turn

    const u = new SpeechSynthesisUtterance(text);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else {
      u.lang = "en-IN";
    }
    u.pitch = persona.voice.pitch;
    u.rate = persona.voice.rate;
    u.onboundary = (e) => {
      spokenChars = e.charIndex;
    };
    u.onend = () => finish(false);
    u.onerror = (e) => {
      // "interrupted" and "canceled" are expected when the student barges in.
      if (e.error === "interrupted" || e.error === "canceled") finish(true);
      else finish(false);
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  });
}

/** Stop whoever is talking right now (barge-in). */
export function stopSpeaking() {
  if (activeCancel) activeCancel();
  else if (ttsSupported()) window.speechSynthesis.cancel();
}

/* ---------------- Speech to text ---------------- */

type RecognitionCtor = new () => SpeechRecognitionLike;
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function sttSupported() {
  return getCtor() !== null;
}

export type ListenError = "mic-denied" | "no-mic" | "network" | "other";

/**
 * Push-to-talk listener. start() begins capturing, stop() resolves with the full text.
 * Chrome stops on its own after long silences, so we quietly restart while active.
 */
export class Listener {
  private rec: SpeechRecognitionLike | null = null;
  private finals = "";
  private interim = "";
  private active = false;
  private stopResolve: ((text: string) => void) | null = null;

  constructor(
    private lang: string,
    private onInterim: (text: string) => void,
    private onError: (err: ListenError) => void
  ) {}

  start() {
    const Ctor = getCtor();
    if (!Ctor) return this.onError("other");
    this.finals = "";
    this.interim = "";
    this.active = true;
    this.spawn(Ctor);
  }

  private spawn(Ctor: RecognitionCtor) {
    const rec = new Ctor();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) this.finals += " " + r[0].transcript;
        else interim += r[0].transcript;
      }
      this.interim = interim;
      this.onInterim((this.finals + " " + interim).trim());
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      this.active = false;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") this.onError("mic-denied");
      else if (e.error === "audio-capture") this.onError("no-mic");
      else if (e.error === "network") this.onError("network");
      else this.onError("other");
    };
    rec.onend = () => {
      if (this.active && !this.stopResolve) {
        // Ended by itself while the student is still talking. Keep going.
        this.finals += " " + this.interim;
        this.interim = "";
        try {
          this.spawn(Ctor);
        } catch {
          this.active = false;
        }
        return;
      }
      this.active = false;
      const text = (this.finals + " " + this.interim).replace(/\s+/g, " ").trim();
      this.stopResolve?.(text);
      this.stopResolve = null;
    };
    this.rec = rec;
    try {
      rec.start();
    } catch {
      this.onError("other");
    }
  }

  stop(): Promise<string> {
    return new Promise((resolve) => {
      if (!this.rec) return resolve("");
      this.stopResolve = resolve;
      // If the engine never calls onend, resolve with what we have.
      setTimeout(() => {
        if (this.stopResolve) {
          const text = (this.finals + " " + this.interim).replace(/\s+/g, " ").trim();
          this.stopResolve(text);
          this.stopResolve = null;
          this.active = false;
          try {
            this.rec?.abort();
          } catch {}
        }
      }, 1800);
      try {
        this.rec.stop();
      } catch {
        resolve((this.finals + " " + this.interim).trim());
        this.stopResolve = null;
      }
    });
  }

  abort() {
    this.active = false;
    this.stopResolve = null;
    try {
      this.rec?.abort();
    } catch {}
  }
}
