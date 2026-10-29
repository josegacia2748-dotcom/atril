import { describe, expect, it } from "vitest";
import {
  durationName,
  eventTime,
  frequencyOf,
  keyName,
  measureBeats,
  midiOf,
  midiToPitch,
  musicXmlType,
  pitchFromStaffStep,
  staffStepFromPitch,
  transposeEvents,
  transposePitch,
  type NoteEvent,
} from "./music";

describe("alturas y frecuencias", () => {
  it("convierte notas a MIDI y frecuencia", () => {
    expect(midiOf({ step: "C", alter: 0, octave: 4 })).toBe(60);
    expect(midiOf({ step: "A", alter: 0, octave: 4 })).toBe(69);
    expect(frequencyOf(69)).toBeCloseTo(440, 6);
    expect(frequencyOf(81)).toBeCloseTo(880, 6);
  });

  it("redondea MIDI a la nota enarmonica mas simple", () => {
    expect(midiToPitch(61)).toEqual({ step: "C", alter: 1, octave: 4 });
    expect(midiToPitch(60)).toEqual({ step: "C", alter: 0, octave: 4 });
    expect(midiToPitch(59)).toEqual({ step: "B", alter: 0, octave: 3 });
  });

  it("transpone manteniendo la ortografia diatónica", () => {
    expect(transposePitch({ step: "C", alter: 0, octave: 4 }, 2)).toEqual({ step: "D", alter: 0, octave: 4 });
    expect(transposePitch({ step: "B", alter: 0, octave: 3 }, 1)).toEqual({ step: "C", alter: 0, octave: 4 });
  });
});

describe("claves", () => {
  it("mapea la primera linea de cada clave", () => {
    expect(pitchFromStaffStep(0, "treble", 0)).toEqual({ step: "E", alter: 0, octave: 4 });
    expect(pitchFromStaffStep(0, "bass", 0)).toEqual({ step: "G", alter: 0, octave: 2 });
    expect(pitchFromStaffStep(0, "alto", 0)).toEqual({ step: "F", alter: 0, octave: 3 });
    expect(pitchFromStaffStep(0, "tenor", 0)).toEqual({ step: "D", alter: 0, octave: 3 });
  });

  it("aplica la armadura al leer el pentagrama", () => {
    // Fa en clave de sol con un sostenido en la armadura (Sol mayor).
    expect(pitchFromStaffStep(1, "treble", 1).alter).toBe(1);
    // Si en clave de sol con un bemol (Fa mayor).
    expect(pitchFromStaffStep(4, "treble", -1).alter).toBe(-1);
  });

  it("ida y vuelta entre paso de pentagrama y altura", () => {
    for (const clef of ["treble", "bass", "alto", "tenor"] as const) {
      for (let step = 0; step < 9; step++) {
        const pitch = pitchFromStaffStep(step, clef, 0);
        expect(staffStepFromPitch(pitch, clef)).toBe(step);
      }
    }
  });
});

describe("ritmo y compases", () => {
  it("calcula pulsos por compas", () => {
    expect(measureBeats({ beats: 4, beatType: 4 })).toBe(4);
    expect(measureBeats({ beats: 6, beatType: 8 })).toBe(3);
    expect(measureBeats({ beats: 3, beatType: 2 })).toBe(6);
  });

  it("nombra duraciones y tipos MusicXML", () => {
    expect(durationName(1)).toBe("negra");
    expect(durationName(2)).toBe("blanca");
    expect(musicXmlType(1.5)).toEqual({ type: "quarter", dots: 1 });
    expect(musicXmlType(0.5)).toEqual({ type: "eighth", dots: 0 });
  });

  it("ubica un evento en el tiempo del compas", () => {
    const event: NoteEvent = { id: "e1", part: 0, measure: 2, beat: 1.5, duration: 1, pitches: [] };
    expect(eventTime(event, { beats: 4, beatType: 4 })).toBe(9.5);
  });
});

describe("armaduras", () => {
  it("nombra las tonalidades principales", () => {
    expect(keyName(0)).toContain("Do mayor");
    expect(keyName(1)).toContain("Sol mayor");
    expect(keyName(-2)).toContain("Si♭ mayor");
  });
});

describe("transposicion de eventos", () => {
  it("desplaza todas las alturas sin mutar el original", () => {
    const events: NoteEvent[] = [
      {
        id: "e1",
        part: 0,
        measure: 0,
        beat: 0,
        duration: 1,
        pitches: [{ step: "C", alter: 0, octave: 4 }],
      },
    ];
    const shifted = transposeEvents(events, 2);
    expect(shifted[0].pitches[0]).toEqual({ step: "D", alter: 0, octave: 4 });
    expect(events[0].pitches[0]).toEqual({ step: "C", alter: 0, octave: 4 });
    expect(shifted[0]).not.toBe(events[0]);
  });

  it("devuelve la misma referencia cuando no hay transposicion", () => {
    const events: NoteEvent[] = [];
    expect(transposeEvents(events, 0)).toBe(events);
  });
});
