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

// Browsers do not say whether a voice is male or female, so we read it from the voice name.
// Female is checked first because "female" contains "male".
const FEMALE =
  /female|woman|samantha|victoria|karen|moira|tessa|veena|fiona|serena|allison|\bava\b|susan|zira|heera|neerja|aria|jenny|sonia|libby|natasha|kalpana|lekha|kanya|ellen|joanna|kendra|kimberly|salli|\bivy\b|emma|\bamy\b|olivia|nicky|\bflo\b|sandy|shelley|grandma|catherine|hazel|swara|aditi|raveena|anjali|isha|martha|kate|zoe|google us english|google हिन्दी|google hindi/i;
const MALE =
  /\bmale\b|\bman\b|daniel|\balex\b|\bfred\b|rishi|aaron|\btom\b|oliver|arthur|gordon|ravi|david|\bmark\b|\bguy\b|prabhat|hemant|george|ryan|thomas|\blee\b|eddy|reed|rocko|grandpa|james|brian|matthew|joey|justin|russell|madhur|evan|nathan|google uk english male/i;
// Novelty voices on macOS that would sound silly in a GD.
const NOVELTY =
  /bad news|bahh|bells|boing|bubbles|cellos|jester|organ|superstar|trinoids|whisper|wobble|zarvox|albert|junior|ralph|kathy|good news|hysterical|pipe|deranged|princess/i;

export type Gender = "f" | "m";
const genderOf = (v: SpeechSynthesisVoice): Gender | "u" =>
  FEMALE.test(v.name) ? "f" : MALE.test(v.name) ? "m" : "u";

export interface AssignedVoice {
  voice: SpeechSynthesisVoice | null;
  pitch: number;
  rate: number;
}

/**
 * Give each persona a voice that matches their gender, different from the others where the
 * device has enough voices. If no voice of the right gender exists, shift the pitch instead.
 */
export async function assignVoices(personas: Persona[]) {
  const all = (await loadVoices()).filter(
    (v) => v.lang.toLowerCase().replace("_", "-").startsWith("en") && !NOVELTY.test(v.name)
  );
  const map = new Map<string, AssignedVoice>();
  const used = new Set<string>();
  // The newer macOS "Eddy / Flo / Reed" family sounds more robotic, so use it last.
  const weak = (v: SpeechSynthesisVoice) => /\(English|eddy|flo|reed|rocko|sandy|shelley|grandma|grandpa/i.test(v.name);
  const byPref = (p: Persona, input: SpeechSynthesisVoice[]) => {
    for (const group of [input.filter((v) => !weak(v)), input.filter(weak)]) {
      for (const lang of p.voice.prefer) {
        const hit = group.find((v) => v.lang.replace("_", "-").startsWith(lang));
        if (hit) return hit;
      }
      if (group.length) return group[0];
    }
    return undefined;
  };
  for (const p of personas) {
    const want = p.gender;
    const fresh = all.filter((v) => !used.has(v.name));
    let voice =
      byPref(p, fresh.filter((v) => genderOf(v) === want)) ?? // right gender, not used yet
      byPref(p, all.filter((v) => genderOf(v) === want)) ?? // right gender, shared
      byPref(p, fresh.filter((v) => genderOf(v) === "u")) ?? // unknown gender
      byPref(p, all.filter((v) => genderOf(v) === "u")) ??
      null;
    let pitch = p.voice.pitch;
    if (!voice) {
      // Only voices of the other gender exist: use one and move the pitch towards the right range.
      voice = byPref(p, all) ?? null;
      pitch = want === "f" ? Math.max(pitch, 1.4) : Math.min(pitch, 0.7);
    } else if (genderOf(voice) === "u") {
      pitch = want === "f" ? Math.max(pitch, 1.15) : Math.min(pitch, 0.9);
    }
    if (voice) used.add(voice.name);
    map.set(p.id, { voice, pitch, rate: p.voice.rate });
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
  assigned: AssignedVoice | undefined,
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
    let guard = setTimeout(() => finish(false), enabled && ttsSupported() ? est * 2 + 4000 : est);

    activeCancel = () => {
      if (ttsSupported()) window.speechSynthesis.cancel();
      finish(true);
    };

    if (!enabled || !ttsSupported()) return; // captions only; guard timer ends the turn

    const u = new SpeechSynthesisUtterance(text);
    const voice = assigned?.voice;
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else {
      u.lang = "en-IN";
    }
    u.pitch = assigned?.pitch ?? persona.voice.pitch;
    u.rate = assigned?.rate ?? persona.voice.rate;
    u.onboundary = (e) => {
      spokenChars = e.charIndex;
    };
    // If the device has no working voice, the engine "ends" instantly.
    // Then we fall back to captions and wait as long as the line would take to say.
    const endOrWait = () => {
      const spent = performance.now() - started;
      if (spent < est * 0.4) {
        clearTimeout(guard);
        guard = setTimeout(() => finish(false), est - spent);
      } else finish(false);
    };
    u.onend = endOrWait;
    u.onerror = (e) => {
      // "interrupted" and "canceled" are expected when the student barges in.
      if (e.error === "interrupted" || e.error === "canceled") finish(true);
      else endOrWait();
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
