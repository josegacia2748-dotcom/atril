import type { Score } from "./types";
import { eventsToXml } from "./musicxml";
import type { Clef, NoteEvent, Pitch, TimeSignature } from "./music";

const COLORS = ["#c9a227", "#4f9d8f", "#b8655a", "#6d7fd1", "#a77bc4", "#7f9a5c"];

const pitch = (token: string): Pitch => {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(token.trim());
  if (!match) throw new Error(`Nota inválida: ${token}`);
  return {
    step: match[1] as Pitch["step"],
    alter: match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0,
    octave: Number(match[3]),
  };
};

/** "E4:1 F4:1 C4+E4+G4:2" → eventos de un compás */
function melody(part: number, measure: number, text: string): NoteEvent[] {
  let beat = 0;
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((token, index) => {
      const [notes, durationRaw] = token.split(":");
      const duration = Number(durationRaw ?? 1);
      const event: NoteEvent = {
        id: `s${part}-${measure}-${index}`,
        part,
        measure,
        beat,
        duration,
        pitches: notes.split("+").map(pitch),
      };
      beat += duration;
      return event;
    });
}

function makeScore(options: {
  id: string;
  title: string;
  composer: string;
  arranger?: string;
  keyFifths: number;
  time: TimeSignature;
  tempo: number;
  clef: Clef;
  instrumentIds: string[];
  measures: string[];
  parts?: { name: string; clef: Clef; measures: string[] }[];
  notes?: string;
  createdAt: number;
}): Score {
  const primary = options.parts?.[0];
  const measures = primary?.measures ?? options.measures;
  const events: NoteEvent[] = measures.flatMap((text, measure) => melody(0, measure, text));
  (options.parts ?? []).slice(1).forEach((part, index) => {
    part.measures.forEach((text, measure) => events.push(...melody(index + 1, measure, text)));
  });
  const xml = eventsToXml(events, {
    title: options.title,
    composer: options.composer,
    keyFifths: options.keyFifths,
    time: options.time,
    tempo: options.tempo,
    clef: options.clef,
    partNames: options.parts?.map((part) => part.name),
  });
  return {
    id: options.id,
    title: options.title,
    composer: options.composer,
    arranger: options.arranger,
    keyFifths: options.keyFifths,
    time: options.time,
    tempo: options.tempo,
    clef: options.clef,
    instrumentIds: options.instrumentIds,
    musicXml: xml,
    events,
    notes: options.notes,
    createdAt: options.createdAt,
    updatedAt: options.createdAt,
    demo: true,
  };
}

export function seedScores(): Score[] {
  const now = Date.now();
  return [
    makeScore({
      id: "himno-alegria",
      title: "Himno de la Alegría",
      composer: "Ludwig van Beethoven",
      arranger: "Adaptación para orquesta juvenil",
      keyFifths: 0,
      time: { beats: 4, beatType: 4 },
      tempo: 108,
      clef: "treble",
      instrumentIds: ["violin", "flute", "clarinet", "trumpet"],
      measures: [
        "E4:1 E4:1 F4:1 G4:1",
        "G4:1 F4:1 E4:1 D4:1",
        "C4:1 C4:1 D4:1 E4:1",
        "E4:1 D4:1 D4:2",
        "E4:1 E4:1 F4:1 G4:1",
        "G4:1 F4:1 E4:1 D4:1",
        "C4:1 C4:1 D4:1 E4:1",
        "D4:1 C4:1 C4:2",
      ],
      notes: "Melodía principal para cuerdas, maderas y trompeta. Ideal para el primer ensayo.",
      createdAt: now - 86400000 * 6,
    }),
    makeScore({
      id: "cancion-cuna",
      title: "Canción de cuna",
      composer: "Anónimo",
      arranger: "Arreglo para cuerdas graves",
      keyFifths: 0,
      time: { beats: 3, beatType: 4 },
      tempo: 72,
      clef: "treble",
      instrumentIds: ["viola", "cello", "bass"],
      measures: [
        "C4:1 E4:1 G4:1",
        "G4:2 E4:1",
        "A4:1 G4:1 F4:1",
        "E4:3",
        "D4:1 E4:1 F4:1",
        "G4:2 E4:1",
        "D4:1 C4:1 B3:1",
        "C4:3",
      ],
      notes: "Pieza lenta en 3/4 para trabajar fraseo y dinámica.",
      createdAt: now - 86400000 * 4,
    }),
    makeScore({
      id: "fanfarria",
      title: "Fanfarria de apertura",
      composer: "Atril Studio",
      arranger: "Original",
      keyFifths: 0,
      time: { beats: 4, beatType: 4 },
      tempo: 126,
      clef: "treble",
      instrumentIds: ["trumpet", "horn", "trombone", "timpani"],
      measures: [
        "C4:1 E4:1 G4:1 C5:1",
        "G4:2 E4:2",
        "F4:1 A4:1 C5:1 F5:1",
        "C5:4",
        "G4:1 B4:1 D5:1 G5:1",
        "E5:2 C5:2",
        "D5:1 C5:1 B4:1 D5:1",
        "C5:4",
      ],
      notes: "Fanfarria para metales y timbal. Pensada para aperturas de concierto.",
      createdAt: now - 86400000 * 2,
    }),
    makeScore({
      id: "miniatura-piano",
      title: "Miniatura en Do",
      composer: "Atril Studio",
      arranger: "Original para piano",
      keyFifths: 0,
      time: { beats: 4, beatType: 4 },
      tempo: 88,
      clef: "treble",
      instrumentIds: ["piano"],
      measures: [],
      parts: [
        {
          name: "Mano derecha",
          clef: "treble",
          measures: [
            "C5:1 E5:1 G5:1 E5:1",
            "F5:1 D5:1 B4:1 G4:1",
            "A4:1 C5:1 E5:1 C5:1",
            "G4:2 C5:2",
          ],
        },
        {
          name: "Mano izquierda",
          clef: "bass",
          measures: ["C3:2 G3:2", "F3:2 G3:2", "A3:2 E3:2", "C3:2 G3:2"],
        },
      ],
      notes: "Dos pentagramas: melodía en clave de sol y bajo en clave de fa.",
      createdAt: now - 86400000,
    }),
  ];
}

export const SEED_PROFILES = [
  { id: "p-director", name: "Maestra Elena Ríos", role: "director" as const, color: COLORS[0], createdAt: 1 },
  { id: "p-violin", name: "Carlos Mendoza", role: "musician" as const, instrumentId: "violin", color: COLORS[1], createdAt: 2 },
  { id: "p-flute", name: "María Salas", role: "musician" as const, instrumentId: "flute", color: COLORS[2], createdAt: 3 },
  { id: "p-clarinet", name: "José Bravo", role: "musician" as const, instrumentId: "clarinet", color: COLORS[3], createdAt: 4 },
  { id: "p-cello", name: "Ana Petit", role: "musician" as const, instrumentId: "cello", color: COLORS[4], createdAt: 5 },
  { id: "p-piano", name: "Luis Ferrer", role: "musician" as const, instrumentId: "piano", color: COLORS[5], createdAt: 6 },
  { id: "p-viola", name: "Sofía Andrade", role: "musician" as const, instrumentId: "viola", color: COLORS[0], createdAt: 7 },
  { id: "p-trumpet", name: "Pedro Guzmán", role: "musician" as const, instrumentId: "trumpet", color: COLORS[1], createdAt: 8 },
  { id: "p-bass", name: "Lucía Ortega", role: "musician" as const, instrumentId: "bass", color: COLORS[2], createdAt: 9 },
];

export const PROFILE_COLORS = COLORS;
