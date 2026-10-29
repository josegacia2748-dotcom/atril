import {
  CLEF_SIGN,
  type Clef,
  type NoteEvent,
  type Pitch,
  type TimeSignature,
  musicXmlType,
  measureBeats,
} from "./music";

export type XmlPart = {
  name: string;
  clef: Clef;
  events: NoteEvent[];
};

export type BuildXmlOptions = {
  title: string;
  composer?: string;
  arranger?: string;
  keyFifths: number;
  time: TimeSignature;
  tempo: number;
  parts: XmlPart[];
};

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const pitchXml = (pitch: Pitch): string =>
  `<pitch><step>${pitch.step}</step>${pitch.alter ? `<alter>${pitch.alter}</alter>` : ""}<octave>${pitch.octave}</octave></pitch>`;

function noteXml(pitch: Pitch | null, duration: number, chord: boolean, divisions: number): string {
  const { type, dots } = musicXmlType(duration);
  const dotXml = "<dot/>".repeat(dots);
  const body = pitch ? pitchXml(pitch) : "<rest/>";
  const tie = "";
  return `<note>${chord ? "<chord/>" : ""}${body}<duration>${Math.round(duration * divisions)}</duration>${tie}<type>${type}</type>${dotXml}</note>`;
}

function measureEvents(events: NoteEvent[], measure: number): NoteEvent[] {
  return events
    .filter((event) => event.measure === measure)
    .slice()
    .sort((a, b) => a.beat - b.beat || a.part - b.part);
}

function buildPart(part: XmlPart, measures: number, time: TimeSignature, keyFifths: number, tempo: number, divisions: number): string {
  const beatsPerMeasure = measureBeats(time);
  const sign = CLEF_SIGN[part.clef];
  let xml = `<part id="P${part.name.replace(/[^A-Za-z0-9]/g, "") || "1"}">`;

  for (let measure = 0; measure < measures; measure++) {
    xml += `<measure number="${measure + 1}">`;
    if (measure === 0) {
      xml += `<attributes><divisions>${divisions}</divisions><key><fifths>${keyFifths}</fifths></key><time><beats>${time.beats}</beats><beat-type>${time.beatType}</beat-type></time><clef><sign>${sign.sign}</sign><line>${sign.line}</line></clef></attributes>`;
      xml += `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${Math.round(tempo)}</per-minute></metronome></direction-type><sound tempo="${Math.round(tempo)}"/></direction>`;
    }

    const events = measureEvents(part.events, measure);
    let cursor = 0;
    for (const event of events) {
      const start = Math.max(0, Math.min(beatsPerMeasure, event.beat));
      if (start - cursor > 0.001) {
        xml += noteXml(null, start - cursor, false, divisions);
      }
      if (event.pitches.length === 0) {
        xml += noteXml(null, Math.max(0.25, event.duration), false, divisions);
      } else {
        event.pitches.forEach((pitch, index) => {
          xml += noteXml(pitch, Math.max(0.25, event.duration), index > 0, divisions);
        });
      }
      cursor = Math.max(cursor, start + Math.max(0.25, event.duration));
    }
    if (beatsPerMeasure - cursor > 0.001) {
      xml += noteXml(null, beatsPerMeasure - cursor, false, divisions);
    }
    xml += "</measure>";
  }
  xml += "</part>";
  return xml;
}

export function buildMusicXml(options: BuildXmlOptions): string {
  const divisions = 4;
  const allEvents = options.parts.flatMap((part) => part.events);
  const measures = Math.max(1, ...allEvents.map((event) => event.measure + 1));
  const partList = options.parts
    .map((part, index) => `<score-part id="P${part.name.replace(/[^A-Za-z0-9]/g, "") || index + 1}"><part-name>${escapeXml(part.name)}</part-name></score-part>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>${escapeXml(options.title)}</work-title></work>
  <identification>
    <creator type="composer">${escapeXml(options.composer ?? "Anónimo")}</creator>
    ${options.arranger ? `<creator type="arranger">${escapeXml(options.arranger)}</creator>` : ""}
    <encoding><software>Atril</software></encoding>
  </identification>
  <part-list>${partList}</part-list>
  ${options.parts.map((part) => buildPart(part, measures, options.time, options.keyFifths, options.tempo, divisions)).join("")}
</score-partwise>`;
}

export type ParsedXml = {
  title: string;
  composer: string;
  keyFifths: number;
  time: TimeSignature;
  tempo: number;
  clef: Clef;
  parts: XmlPart[];
  events: NoteEvent[];
};

const text = (parent: Element | Document, tag: string): string =>
  parent.getElementsByTagName(tag)[0]?.textContent?.trim() ?? "";

const numberOf = (parent: Element | Document, tag: string, fallback: number): number => {
  const value = Number(text(parent, tag));
  return Number.isFinite(value) ? value : fallback;
};

function clefFromSign(sign: string, line: number): Clef {
  if (sign === "F") return "bass";
  if (sign === "C") return line >= 4 ? "tenor" : "alto";
  return "treble";
}

export function parseMusicXml(xml: string): ParsedXml {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) {
    throw new Error("El archivo MusicXML no es válido.");
  }
  const root = doc.documentElement;
  const title = text(doc, "work-title") || text(doc, "movement-title") || "Partitura sin título";
  const composer = text(doc, "creator") || "Anónimo";
  const partNodes = Array.from(root.getElementsByTagName("part"));
  const parts: XmlPart[] = [];
  const events: NoteEvent[] = [];
  let keyFifths = 0;
  let time: TimeSignature = { beats: 4, beatType: 4 };
  let tempo = 90;
  let firstClef: Clef = "treble";

  partNodes.forEach((partNode, partIndex) => {
    const measures = Array.from(partNode.getElementsByTagName("measure"));
    let divisions = 1;
    let clef: Clef = partIndex === 0 ? firstClef : "treble";

    measures.forEach((measureNode, measureIndex) => {
      const attributes = measureNode.getElementsByTagName("attributes")[0];
      if (attributes) {
        divisions = numberOf(attributes, "divisions", divisions) || divisions;
        const fifthsNode = attributes.getElementsByTagName("fifths")[0];
        if (fifthsNode) keyFifths = Number(fifthsNode.textContent) || 0;
        const beatsNode = attributes.getElementsByTagName("beats")[0];
        const beatTypeNode = attributes.getElementsByTagName("beat-type")[0];
        if (beatsNode && beatTypeNode) {
          time = { beats: Number(beatsNode.textContent) || 4, beatType: Number(beatTypeNode.textContent) || 4 };
        }
        const clefNode = attributes.getElementsByTagName("clef")[0];
        if (clefNode) {
          clef = clefFromSign(text(clefNode, "sign"), numberOf(clefNode, "line", 2));
          if (partIndex === 0) firstClef = clef;
        }
      }
      const sound = measureNode.getElementsByTagName("sound")[0];
      if (sound?.getAttribute("tempo")) tempo = Number(sound.getAttribute("tempo")) || tempo;
      const perMinute = measureNode.getElementsByTagName("per-minute")[0];
      if (perMinute) tempo = Number(perMinute.textContent) || tempo;

      let cursor = 0;
      let chordStart = 0;
      const notes = Array.from(measureNode.getElementsByTagName("note"));
      notes.forEach((noteNode) => {
        const durationDiv = numberOf(noteNode, "duration", divisions);
        const isChord = Boolean(noteNode.getElementsByTagName("chord")[0]);
        const isRest = Boolean(noteNode.getElementsByTagName("rest")[0]);
        const start = isChord ? chordStart : cursor;
        if (!isChord) chordStart = cursor;
        const beat = start / divisions;
        const duration = durationDiv / divisions;

        if (isRest) {
          const event: NoteEvent = {
            id: `x${partIndex}-${measureIndex}-${Math.round(start)}-${Math.round(cursor)}`,
            part: partIndex,
            measure: measureIndex,
            beat,
            duration,
            pitches: [],
          };
          events.push(event);
        } else {
          const pitchNode = noteNode.getElementsByTagName("pitch")[0];
          if (pitchNode) {
            const step = (text(pitchNode, "step") || "C") as Pitch["step"];
            const alter = Number(text(pitchNode, "alter") || "0");
            const octave = Number(text(pitchNode, "octave") || "4");
            const existing = events.find(
              (event) =>
                event.part === partIndex &&
                event.measure === measureIndex &&
                Math.abs(event.beat - beat) < 0.001 &&
                event.pitches.length > 0,
            );
            if (isChord && existing) {
              existing.pitches.push({ step, alter, octave });
            } else {
              events.push({
                id: `x${partIndex}-${measureIndex}-${Math.round(start)}`,
                part: partIndex,
                measure: measureIndex,
                beat,
                duration,
                pitches: [{ step, alter, octave }],
              });
            }
          }
        }
        if (!isChord) cursor += durationDiv;
      });
    });

    parts.push({
      name: text(partNode, "part-name") || `Pentagrama ${partIndex + 1}`,
      clef,
      events: events.filter((event) => event.part === partIndex),
    });
  });

  return { title, composer, keyFifths, time, tempo, clef: firstClef, parts, events };
}

export function eventsToXml(
  events: NoteEvent[],
  meta: {
    title: string;
    composer?: string;
    keyFifths: number;
    time: TimeSignature;
    tempo: number;
    clef: Clef;
    partNames?: string[];
    partClefs?: Clef[];
  },
): string {
  const partIndexes = Array.from(new Set(events.map((event) => event.part))).sort((a, b) => a - b);
  const indexes = partIndexes.length ? partIndexes : [0];
  return buildMusicXml({
    title: meta.title,
    composer: meta.composer,
    keyFifths: meta.keyFifths,
    time: meta.time,
    tempo: meta.tempo,
    parts: indexes.map((index) => ({
      name: meta.partNames?.[index] ?? (indexes.length > 1 ? `Pentagrama ${index + 1}` : "Partitura"),
      clef: meta.partClefs?.[index] ?? (index === 0 ? meta.clef : index === 1 ? "bass" : meta.clef),
      events: events.filter((event) => event.part === index),
    })),
  });
}
