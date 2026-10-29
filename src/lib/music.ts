export type Clef = "treble" | "bass" | "alto" | "tenor";
export type Letter = "C" | "D" | "E" | "F" | "G" | "A" | "B";

export type Pitch = {
  step: Letter;
  alter: number;
  octave: number;
};

export type NoteEvent = {
  id: string;
  /** índice de pentagrama / parte */
  part: number;
  /** compás 0-based */
  measure: number;
  /** pulso dentro del compás, en negras */
  beat: number;
  /** duración en negras */
  duration: number;
  /** vacío = silencio */
  pitches: Pitch[];
};

export type TimeSignature = { beats: number; beatType: number };

export type InstrumentFamily = "Cuerdas" | "Maderas" | "Metales" | "Percusión" | "Teclados" | "Voz";

export type Instrument = {
  id: string;
  name: string;
  short: string;
  family: InstrumentFamily;
  clef: Clef;
  /** semitonos de escritura a sonido real */
  transpose: number;
  /** desplazamiento de armadura en quintas al pasar a sonido real */
  keyShift: number;
  icon: string;
  range: string;
};

export const CLEF_LABEL: Record<Clef, string> = {
  treble: "Clave de sol",
  bass: "Clave de fa",
  alto: "Clave de do en 3.ª",
  tenor: "Clave de do en 4.ª",
};

export const CLEF_SHORT: Record<Clef, string> = {
  treble: "Sol",
  bass: "Fa",
  alto: "Do 3.ª",
  tenor: "Do 4.ª",
};

export const CLEF_SIGN: Record<Clef, { sign: "G" | "F" | "C"; line: number }> = {
  treble: { sign: "G", line: 2 },
  bass: { sign: "F", line: 4 },
  alto: { sign: "C", line: 3 },
  tenor: { sign: "C", line: 4 },
};

/** índice diatónico de la primera línea (inferior) del pentagrama */
const CLEF_BASE: Record<Clef, number> = {
  treble: 4 * 7 + 2, // E4
  bass: 2 * 7 + 4, // G2
  alto: 3 * 7 + 3, // F3
  tenor: 3 * 7 + 1, // D3
};

const LETTERS: Letter[] = ["C", "D", "E", "F", "G", "A", "B"];
const LETTER_SEMITONE: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_ORDER: Letter[] = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER: Letter[] = ["B", "E", "A", "D", "G", "C", "F"];

export function keyAlter(letter: Letter, fifths: number): number {
  if (fifths > 0 && SHARP_ORDER.slice(0, Math.min(7, fifths)).includes(letter)) return 1;
  if (fifths < 0 && FLAT_ORDER.slice(0, Math.min(7, -fifths)).includes(letter)) return -1;
  return 0;
}

export function keyName(fifths: number): string {
  const major = ["Do", "Sol", "Re", "La", "Mi", "Si", "Fa♯", "Do♯"];
  const flat = ["Do", "Fa", "Si♭", "Mi♭", "La♭", "Re♭", "Sol♭", "Do♭"];
  if (fifths === 0) return "Do mayor / La menor";
  if (fifths > 0) return `${major[Math.min(7, fifths)]} mayor`;
  return `${flat[Math.min(7, -fifths)]} mayor`;
}

export function midiOf(pitch: Pitch): number {
  return 12 * (pitch.octave + 1) + LETTER_SEMITONE[pitch.step] + pitch.alter;
}

export function frequencyOf(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function midiToPitch(midi: number): Pitch {
  const names: Letter[] = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"];
  const alters = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return { step: names[pc], alter: alters[pc], octave };
}

export function pitchFromStaffStep(step: number, clef: Clef, fifths: number, explicitAlter = 0): Pitch {
  const index = CLEF_BASE[clef] + step;
  const octave = Math.floor(index / 7);
  const letter = LETTERS[((index % 7) + 7) % 7];
  return { step: letter, alter: keyAlter(letter, fifths) + explicitAlter, octave };
}

export function staffStepFromPitch(pitch: Pitch, clef: Clef): number {
  return pitch.octave * 7 + LETTERS.indexOf(pitch.step) - CLEF_BASE[clef];
}

export function transposePitch(pitch: Pitch, semitones: number): Pitch {
  return midiToPitch(midiOf(pitch) + semitones);
}

export function solfege(pitch: Pitch): string {
  const names: Record<Letter, string> = { C: "Do", D: "Re", E: "Mi", F: "Fa", G: "Sol", A: "La", B: "Si" };
  const accidental = pitch.alter === 1 ? "♯" : pitch.alter === -1 ? "♭" : pitch.alter === 2 ? "𝄪" : pitch.alter === -2 ? "𝄫" : "";
  return `${names[pitch.step]}${accidental}${pitch.octave}`;
}

export function pitchLabel(pitch: Pitch): string {
  return `${pitch.step}${pitch.alter === 1 ? "#" : pitch.alter === -1 ? "b" : ""}${pitch.octave}`;
}

export const INSTRUMENTS: Instrument[] = [
  { id: "violin", name: "Violín", short: "Vln.", family: "Cuerdas", clef: "treble", transpose: 0, keyShift: 0, icon: "🎻", range: "Sol3 – La7" },
  { id: "viola", name: "Viola", short: "Vla.", family: "Cuerdas", clef: "alto", transpose: 0, keyShift: 0, icon: "🎻", range: "Do3 – Mi6" },
  { id: "cello", name: "Violonchelo", short: "Vc.", family: "Cuerdas", clef: "bass", transpose: 0, keyShift: 0, icon: "🎻", range: "Do2 – La5" },
  { id: "bass", name: "Contrabajo", short: "Cb.", family: "Cuerdas", clef: "bass", transpose: -12, keyShift: 0, icon: "🎻", range: "Mi1 – Sol4" },
  { id: "flute", name: "Flauta traversa", short: "Fl.", family: "Maderas", clef: "treble", transpose: 0, keyShift: 0, icon: "🪈", range: "Do4 – Do7" },
  { id: "piccolo", name: "Flautín", short: "Picc.", family: "Maderas", clef: "treble", transpose: 12, keyShift: 0, icon: "🪈", range: "Re5 – Do8" },
  { id: "oboe", name: "Oboe", short: "Ob.", family: "Maderas", clef: "treble", transpose: 0, keyShift: 0, icon: "🎵", range: "Si♭3 – La6" },
  { id: "clarinet", name: "Clarinete en Si♭", short: "Cl. Si♭", family: "Maderas", clef: "treble", transpose: -2, keyShift: -2, icon: "🎵", range: "Mi3 – Do7" },
  { id: "clarinetA", name: "Clarinete en La", short: "Cl. La", family: "Maderas", clef: "treble", transpose: -3, keyShift: 3, icon: "🎵", range: "Do3 – Do7" },
  { id: "bassclarinet", name: "Clarinete bajo", short: "Cl. B.", family: "Maderas", clef: "treble", transpose: -14, keyShift: -2, icon: "🎵", range: "Mi♭2 – Do6" },
  { id: "bassoon", name: "Fagot", short: "Fg.", family: "Maderas", clef: "bass", transpose: 0, keyShift: 0, icon: "🎵", range: "Si♭1 – Mi5" },
  { id: "saxAlto", name: "Saxofón alto (Mi♭)", short: "Sax. A.", family: "Maderas", clef: "treble", transpose: -9, keyShift: -3, icon: "🎷", range: "Si♭3 – Fa♯6" },
  { id: "saxTenor", name: "Saxofón tenor (Si♭)", short: "Sax. T.", family: "Maderas", clef: "treble", transpose: -14, keyShift: -2, icon: "🎷", range: "La♭2 – Mi5" },
  { id: "saxBaritone", name: "Saxofón barítono (Mi♭)", short: "Sax. B.", family: "Maderas", clef: "treble", transpose: -21, keyShift: -3, icon: "🎷", range: "Do2 – La4" },
  { id: "trumpet", name: "Trompeta en Si♭", short: "Tpt.", family: "Metales", clef: "treble", transpose: -2, keyShift: -2, icon: "🎺", range: "Mi3 – Do6" },
  { id: "horn", name: "Corno en Fa", short: "Cor.", family: "Metales", clef: "treble", transpose: -7, keyShift: -1, icon: "🎺", range: "Si1 – Fa5" },
  { id: "trombone", name: "Trombón", short: "Tbn.", family: "Metales", clef: "bass", transpose: 0, keyShift: 0, icon: "🎺", range: "Mi2 – Si♭4" },
  { id: "tuba", name: "Tuba", short: "Tba.", family: "Metales", clef: "bass", transpose: 0, keyShift: 0, icon: "🎺", range: "Re1 – Fa3" },
  { id: "piano", name: "Piano", short: "Pno.", family: "Teclados", clef: "treble", transpose: 0, keyShift: 0, icon: "🎹", range: "La0 – Do8" },
  { id: "guitar", name: "Guitarra", short: "Gtr.", family: "Teclados", clef: "treble", transpose: -12, keyShift: 0, icon: "🎸", range: "Mi2 – Mi6" },
  { id: "harp", name: "Arpa", short: "Arp.", family: "Teclados", clef: "treble", transpose: 0, keyShift: 0, icon: "🎼", range: "Do1 – Sol7" },
  { id: "timpani", name: "Timbal", short: "Tmp.", family: "Percusión", clef: "bass", transpose: 0, keyShift: 0, icon: "🥁", range: "Re2 – La3" },
  { id: "percussion", name: "Percusión", short: "Perc.", family: "Percusión", clef: "treble", transpose: 0, keyShift: 0, icon: "🥁", range: "—" },
  { id: "voice", name: "Voz / Coro", short: "Voz", family: "Voz", clef: "treble", transpose: 0, keyShift: 0, icon: "🎤", range: "—" },
];

export const FAMILIES: InstrumentFamily[] = ["Cuerdas", "Maderas", "Metales", "Teclados", "Percusión", "Voz"];

export function instrumentById(id: string | undefined): Instrument | undefined {
  return INSTRUMENTS.find((item) => item.id === id);
}

export function instrumentName(id: string | undefined): string {
  return instrumentById(id)?.name ?? "Sin instrumento";
}

export function measureBeats(time: TimeSignature): number {
  return (time.beats * 4) / time.beatType;
}

export function totalBeats(events: NoteEvent[], time: TimeSignature): number {
  const maxMeasure = events.reduce((max, event) => Math.max(max, event.measure), 0);
  return (maxMeasure + 1) * measureBeats(time);
}

export function durationName(duration: number): string {
  const map: Record<string, string> = {
    "4": "redonda",
    "3": "blanca con puntillo",
    "2": "blanca",
    "1.5": "negra con puntillo",
    "1": "negra",
    "0.75": "corchea con puntillo",
    "0.5": "corchea",
    "0.25": "semicorchea",
    "0.125": "fusa",
  };
  return map[String(duration)] ?? `${duration} pulsos`;
}

export function musicXmlType(duration: number): { type: string; dots: number } {
  if (duration >= 4) return { type: "whole", dots: 0 };
  if (duration >= 3) return { type: "half", dots: 1 };
  if (duration >= 2) return { type: "half", dots: 0 };
  if (duration >= 1.5) return { type: "quarter", dots: 1 };
  if (duration >= 1) return { type: "quarter", dots: 0 };
  if (duration >= 0.75) return { type: "eighth", dots: 1 };
  if (duration >= 0.5) return { type: "eighth", dots: 0 };
  if (duration >= 0.25) return { type: "16th", dots: 0 };
  return { type: "32nd", dots: 0 };
}

export function transposeEvents(events: NoteEvent[], semitones: number): NoteEvent[] {
  if (!semitones) return events;
  return events.map((event) => ({
    ...event,
    pitches: event.pitches.map((pitch) => midiToPitch(midiOf(pitch) + semitones)),
  }));
}

export function eventTime(event: NoteEvent, time: TimeSignature): number {
  return event.measure * measureBeats(time) + event.beat;
}
