import type { Clef, NoteEvent, TimeSignature } from "./music";

export type Role = "director" | "musician";

export type Profile = {
  id: string;
  name: string;
  role: Role;
  instrumentId?: string;
  color: string;
  createdAt: number;
};

export type OmrInfo = {
  clef: Clef;
  confidence: number;
  notes: number;
  systems: number;
  analyzedAt: number;
  pages: number;
  warnings: string[];
};

export type Score = {
  id: string;
  title: string;
  composer: string;
  arranger?: string;
  keyFifths: number;
  time: TimeSignature;
  tempo: number;
  clef: Clef;
  instrumentIds: string[];
  pdfId?: string;
  pdfName?: string;
  pages?: number;
  musicXml: string;
  events: NoteEvent[];
  omr?: OmrInfo;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  demo?: boolean;
};

export type Orchestra = {
  name: string;
  code: string;
  city: string;
};

export type AppState = {
  profiles: Profile[];
  currentProfileId: string | null;
  scores: Score[];
  orchestra: Orchestra;
  theme: "light" | "dark";
  seeded: boolean;
};
