import type { Score } from "./types";
import { instrumentName, keyName, measureBeats, staffStepFromPitch, type Clef, type Letter, type NoteEvent } from "./music";

type JsPdf = import("jspdf").jsPDF;

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;

async function newDoc(): Promise<JsPdf> {
  const { jsPDF } = await import("jspdf");
  return new jsPDF({ unit: "pt", format: "a4", compress: true });
}

function drawHeader(doc: JsPdf, title: string, composer: string, subtitle?: string): number {
  doc.setFont("times", "bold");
  doc.setFontSize(20);
  doc.text(title, MARGIN, 64);
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.setTextColor(80);
  doc.text(composer, MARGIN, 82);
  if (subtitle) {
    doc.setFontSize(9);
    doc.text(subtitle, MARGIN, 96);
  }
  doc.setTextColor(0);
  return 112;
}

function drawSystem(
  doc: JsPdf,
  partEvents: NoteEvent[][],
  clefs: Clef[],
  startY: number,
  measureStart: number,
  measureCount: number,
  beats: number,
  keyFifths: number,
  timeLabel: string,
  title: string,
): number {
  const space = 7;
  const staffHeight = space * 4;
  const gapBetweenParts = space * 7;
  const x0 = MARGIN + 54;
  const x1 = PAGE_W - MARGIN;
  const measureWidth = (x1 - x0) / measureCount;
  let y = startY;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(90);

  partEvents.forEach((events, partIndex) => {
    const clef = clefs[partIndex] ?? "treble";
    const top = y;
    const bottom = y + staffHeight;
    doc.setDrawColor(30);
    doc.setLineWidth(0.6);
    for (let line = 0; line < 5; line++) {
      const ly = top + line * space;
      doc.line(x0, ly, x1, ly);
    }
    doc.setFontSize(8);
    doc.text(clef === "bass" ? "Clave de fa" : clef === "alto" ? "Do 3.ª" : clef === "tenor" ? "Do 4.ª" : "Clave de sol", MARGIN, top + staffHeight / 2 + 3);
    if (partIndex === 0) {
      doc.setFontSize(7);
      doc.text(`${keyName(keyFifths)} · ${timeLabel}`, MARGIN, top - 6);
    }
    doc.setDrawColor(20);
    doc.setLineWidth(0.9);
    for (let measure = 0; measure <= measureCount; measure++) {
      const mx = x0 + measure * measureWidth;
      doc.line(mx, top, mx, bottom);
    }
    doc.setLineWidth(0.6);
    doc.setDrawColor(30);
    for (const event of events) {
      const x = x0 + (event.measure - measureStart + event.beat / beats) * measureWidth + space * 0.6;
      if (x > x1 - space) continue;
      event.pitches.forEach((pitch) => {
        const step = staffStepFromPitch(pitch, clef);
        const noteY = bottom - (step * space) / 2;
        const rx = space * 0.56;
        const ry = space * 0.4;
        doc.ellipse(x, noteY, rx, ry, "F");
        const up = step < 4;
        const stemX = up ? x + rx - 0.4 : x - rx + 0.4;
        doc.setLineWidth(0.9);
        doc.line(stemX, noteY, stemX, noteY + (up ? -space * 3.1 : space * 3.1));
        if (pitch.alter === 1) {
          doc.setFontSize(8);
          doc.text("♯", x - space * 1.1, noteY + 2);
        } else if (pitch.alter === -1) {
          doc.setFontSize(8);
          doc.text("♭", x - space * 1.1, noteY + 2);
        }
      });
    }
    y = bottom + gapBetweenParts;
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(title, PAGE_W - MARGIN, y + 10, { align: "right" });
  doc.setTextColor(0);
  return y + 22;
}

export async function generateScorePdf(score: Score): Promise<Blob> {
  const doc = await newDoc();
  let y = drawHeader(
    doc,
    score.title,
    score.composer,
    [score.arranger, score.instrumentIds.map(instrumentName).join(" · ")].filter(Boolean).join(" — "),
  );
  const beats = measureBeats(score.time);
  const timeLabel = `${score.time.beats}/${score.time.beatType}`;
  const partIndexes = Array.from(new Set(score.events.map((event) => event.part))).sort((a, b) => a - b);
  const indexes = partIndexes.length ? partIndexes : [0];
  const parts = indexes.map((index) => score.events.filter((event) => event.part === index));
  const maxMeasure = score.events.reduce((max, event) => Math.max(max, event.measure), 0);
  const totalMeasures = maxMeasure + 1;
  const measuresPerSystem = 4;

  for (let measureStart = 0; measureStart < totalMeasures; measureStart += measuresPerSystem) {
    const count = Math.min(measuresPerSystem, totalMeasures - measureStart);
    const systemHeight = indexes.length * 28 + 40;
    if (y + systemHeight > PAGE_H - 60) {
      doc.addPage();
      y = 60;
    }
    const partEvents = parts.map((events) => events.filter((event) => event.measure >= measureStart && event.measure < measureStart + count));
    const clefs = indexes.map((index) => (index === 0 ? score.clef : index === 1 ? "bass" : score.clef));
    y = drawSystem(doc, partEvents, clefs, y, measureStart, count, beats, score.keyFifths, timeLabel, score.title);
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(`Atril · ${score.title} · pág. ${page}/${pages}`, PAGE_W / 2, PAGE_H - 24, { align: "center" });
  }
  return doc.output("blob");
}

export type DemoPdf = {
  blob: Blob;
  title: string;
  composer: string;
  keyFifths: number;
  time: { beats: number; beatType: number };
  tempo: number;
  clef: Clef;
};

/** PDF sintético para probar el flujo OMR completo sin depender de archivos externos. */
export async function generateDemoPdf(): Promise<DemoPdf> {
  const doc = await newDoc();
  const space = 9;
  const x0 = 90;
  const x1 = PAGE_W - 60;
  const staffTop = 220;
  const bottom = staffTop + space * 4;
  const beats = 4;
  const measures = 2;
  const measureWidth = (x1 - x0) / measures;

  doc.setFont("times", "bold");
  doc.setFontSize(20);
  doc.text("Ejemplo para OMR", MARGIN, 80);
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.text("Atril · partitura sintética en clave de sol", MARGIN, 100);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text("Do mayor · 4/4 · negras", MARGIN, 116);
  doc.setTextColor(0);

  doc.setDrawColor(20);
  doc.setLineWidth(0.7);
  for (let line = 0; line < 5; line++) doc.line(x0, staffTop + line * space, x1, staffTop + line * space);
  doc.setLineWidth(1);
  for (let measure = 0; measure <= measures; measure++) {
    const mx = x0 + measure * measureWidth;
    doc.line(mx, staffTop, mx, bottom);
  }

  doc.setFontSize(9);
  doc.text("Clave de sol", MARGIN, bottom - 8);

  const melody = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"];
  melody.forEach((token, index) => {
    const step = staffStepFromPitch(
      { step: token[0] as Letter, alter: 0, octave: Number(token[1]) },
      "treble",
    );
    const measure = Math.floor(index / 4);
    const beat = index % 4;
    const x = x0 + measure * measureWidth + (beat / beats) * measureWidth + space * 4.2;
    const noteY = bottom - (step * space) / 2;
    const rx = space * 0.56;
    const ry = space * 0.4;
    doc.ellipse(x, noteY, rx, ry, "F");
    doc.setLineWidth(1.1);
    doc.line(x + rx - 0.3, noteY, x + rx - 0.3, noteY - space * 3.2);
  });

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Generado por Atril para demostrar el lector OMR.", MARGIN, 760);

  return {
    blob: doc.output("blob"),
    title: "Ejemplo para OMR",
    composer: "Atril",
    keyFifths: 0,
    time: { beats: 4, beatType: 4 },
    tempo: 100,
    clef: "treble",
  };
}
