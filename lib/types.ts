export type Language = "english" | "hinglish";

export type GdFormat = "standard" | "case" | "controversial" | "fishbowl";

export type Side = "for" | "against" | "open";

export type Phase = "setup" | "intro" | "discussion" | "closing" | "report";

export interface Persona {
  id: string;
  name: string;
  role: string; // short label shown in the UI
  style: string; // instructions for the model
  voice: { pitch: number; rate: number; prefer: string[] };
  color: string;
  gender: "f" | "m";
  look: { skin: string; hair: string; style: "short" | "long" | "bun" | "curly" | "pony"; glasses?: boolean };
}

export interface Line {
  id: string; // L1, L2 ...
  speakerId: string; // persona id, "moderator" or "you"
  text: string;
  startedAt: number; // ms since discussion start
  durationMs: number;
  interrupted?: boolean;
  typed?: boolean;
}

export interface RoomConfig {
  topic: string;
  panelSize: number; // 3 to 5 AI participants
  minutes: number;
  language: Language;
  studentName: string;
  format: GdFormat;
  side?: Side; // the side the student chose to argue
  friends?: { id: string; name: string }[]; // other real people in a shared room (ids f1 to f4)
  brief?: string; // case details, only for case-based GDs
}

/** Each AI participant's position for this GD, decided once at the start. */
export interface Stance {
  side: string; // "for", "against" or "middle"
  claim: string; // one-line position they defend
  points: string[]; // 2 to 3 arguments they can use, one at a time
}
export type Plan = Record<string, Stance>;

export interface TurnRequest {
  config: RoomConfig;
  phase: "discussion" | "closing";
  transcript: Pick<Line, "id" | "speakerId" | "text">[];
  secondsLeft: number;
  secondsSinceStudentSpoke: number;
  forceSpeaker?: string;
  plan?: Plan;
  askHuman?: boolean; // the next speaker must end by asking the human a direct question
  ignoredAsks?: number; // how many direct questions the human has let pass in a row
}

export interface TurnResponse {
  speakerId: string;
  text: string;
  asksHuman?: boolean;
  demo?: boolean;
  fallback?: boolean;
  reason?: string;
}

export interface FeedbackPoint {
  area: string;
  score: number; // 1 to 5
  verdict: string;
  tip: string;
  quoteIds: string[];
}

export interface Report {
  summary: string;
  overall: number; // 1 to 10
  points: FeedbackPoint[];
  missedOpening?: { afterLineId: string; youCouldHaveSaid: string } | null;
  missedOpenings?: { afterLineId: string; why: string; youCouldHaveSaid: string }[];
  demo?: boolean;
}
