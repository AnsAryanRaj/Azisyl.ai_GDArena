export type Language = "english" | "hinglish";

export type Phase = "setup" | "intro" | "discussion" | "closing" | "report";

export interface Persona {
  id: string;
  name: string;
  role: string; // short label shown in the UI
  style: string; // instructions for the model
  voice: { pitch: number; rate: number; prefer: string[] };
  color: string;
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
}

export interface TurnRequest {
  config: RoomConfig;
  phase: "discussion" | "closing";
  transcript: Pick<Line, "id" | "speakerId" | "text">[];
  secondsLeft: number;
  secondsSinceStudentSpoke: number;
  forceSpeaker?: string;
}

export interface TurnResponse {
  speakerId: string;
  text: string;
  demo?: boolean;
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
  demo?: boolean;
}
