import {
  CLEF_LABEL,
  type Clef,
  type NoteEvent,
  type TimeSignature,
  type Pitch,
  measureBeats,
  pitchFromStaffStep,
} from "../lib/music";

export type OmrStaff = {
  index: number;
  page: number;
  clef: Clef;
  confidence: number;
  top: number;
  bottom: number;
  space: number;
  xStart: number;
  xEnd: number;
};

export type OmrNote = {
  id: string;
  page: number;
  staff: number;
  measure: number;
  beat: number;
  duration: number;
  step: number;
  alter: number;
  confidence: number;
  hollow: boolean;
  x: number;
  y: number;
};

export type OmrPageResult = {
  page: number;
  width: number;
  height: number;
  staves: OmrStaff[];
  notes: OmrNote[];
  warnings: string[];
  clef: Clef;
  clefConfidence: number;
};

export type OmrResult = {
  pages: OmrPageResult[];
  staves: OmrStaff[];
  notes: OmrNote[];
  events: NoteEvent[];
  clef: Clef;
  clefConfidence: number;
  warnings: string[];
};

type Bitmap = { data: Uint8ClampedArray; width: number; height: number };
type Binary = { bin: Uint8Array; width: number; height: number };

function otsu(gray: Uint8Array): number {
  const histogram = new Array<number>(256).fill(0);
  for (let index = 0; index < gray.length; index++) histogram[gray[index]]++;
  const total = gray.length;
  let sum = 0;
  for (let value = 0; value < 256; value++) sum += value * histogram[value];
  let sumBackground = 0;
  let weightBackground = 0;
  let best = 0;
  let threshold = 128;
  for (let value = 0; value < 256; value++) {
    weightBackground += histogram[value];
    if (weightBackground === 0) continue;
    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;
    sumBackground += value * histogram[value];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;
    if (variance > best) {
      best = variance;
      threshold = value;
    }
  }
  return threshold;
}

function binarize(image: Bitmap): Binary {
  const { width, height, data } = image;
  const gray = new Uint8Array(width * height);
  for (let index = 0; index < gray.length; index++) {
    const offset = index * 4;
    const alpha = data[offset + 3] / 255;
    const luminance = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
    gray[index] = Math.round(luminance * alpha + 255 * (1 - alpha));
  }
  const threshold = otsu(gray);
  const bin = new Uint8Array(width * height);
  for (let index = 0; index < gray.length; index++) bin[index] = gray[index] < threshold ? 1 : 0;
  return { bin, width, height };
}

type Line = { y: number; thickness: number };

function detectLines(binary: Binary): Line[] {
  const { bin, width, height } = binary;
  const rows = new Uint32Array(height);
  for (let y = 0; y < height; y++) {
    let count = 0;
    const offset = y * width;
    for (let x = 0; x < width; x++) count += bin[offset + x];
    rows[y] = count;
  }
  const threshold = Math.max(width * 0.25, 60);
  const lines: Line[] = [];
  let start = -1;
  for (let y = 0; y <= height; y++) {
    const active = y < height && rows[y] >= threshold;
    if (active && start < 0) start = y;
    if (!active && start >= 0) {
      const end = y - 1;
      let weight = 0;
      let weighted = 0;
      for (let row = start; row <= end; row++) {
        weight += rows[row];
        weighted += rows[row] * row;
      }
      lines.push({ y: weight ? weighted / weight : (start + end) / 2, thickness: end - start + 1 });
      start = -1;
    }
  }
  return lines;
}

function median(values: number[]): number {
  if (!values.length) return 10;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

type StaffGeometry = {
  lines: number[];
  top: number;
  bottom: number;
  space: number;
  xStart: number;
  xEnd: number;
};

function groupStaves(lines: Line[]): StaffGeometry[] {
  const centers = lines.map((line) => line.y).sort((a, b) => a - b);
  const gaps = centers.slice(1).map((value, index) => value - centers[index]).filter((gap) => gap > 2 && gap < 40);
  const guess = median(gaps) || 10;
  const groups: number[][] = [];
  let current: number[] = [];
  for (const center of centers) {
    if (!current.length) current.push(center);
    else if (center - current[current.length - 1] <= guess * 1.7) current.push(center);
    else {
      groups.push(current);
      current = [center];
    }
  }
  if (current.length) groups.push(current);

  const staves: StaffGeometry[] = [];
  for (const group of groups) {
    if (group.length < 5) continue;
    for (let start = 0; start + 4 < group.length; start += 5) {
      const five = group.slice(start, start + 5);
      const localGaps = five.slice(1).map((value, index) => value - five[index]);
      const mean = localGaps.reduce((sum, value) => sum + value, 0) / 4;
      if (mean < 3) continue;
      const uniform = localGaps.every((gap) => Math.abs(gap - mean) <= mean * 0.28);
      if (!uniform) continue;
      staves.push({ lines: five, top: five[0], bottom: five[4], space: mean, xStart: 0, xEnd: 0 });
    }
  }
  return staves;
}

function lineRange(binary: Binary, staff: StaffGeometry): { xStart: number; xEnd: number } {
  const { bin, width } = binary;
  let xStart = width;
  let xEnd = 0;
  for (let x = 0; x < width; x++) {
    let hits = 0;
    for (const y of staff.lines) {
      const row = Math.round(y);
      if (bin[row * width + x] || bin[(row + 1) * width + x] || bin[(row - 1) * width + x]) hits++;
    }
    if (hits >= 3) {
      if (x < xStart) xStart = x;
      if (x > xEnd) xEnd = x;
    }
  }
  return xStart <= xEnd ? { xStart, xEnd } : { xStart: 0, xEnd: width - 1 };
}

function isStaffRow(y: number, lines: number[]): boolean {
  return lines.some((line) => Math.abs(line - y) <= 1.6);
}

type ClefGuess = { clef: Clef; confidence: number };

function detectClef(binary: Binary, staff: StaffGeometry, fallback: Clef): ClefGuess {
  const { bin, width } = binary;
  const space = staff.space;
  const x0 = Math.max(0, Math.floor(staff.xStart + space * 0.15));
  const x1 = Math.min(width - 1, Math.floor(staff.xStart + space * 3.6));
  const y0 = Math.max(0, Math.floor(staff.top - space * 1.8));
  const y1 = Math.min(binary.height - 1, Math.floor(staff.bottom + space * 1.8));

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let count = 0;
  let sumY = 0;
  for (let y = y0; y <= y1; y++) {
    if (isStaffRow(y, staff.lines)) continue;
    for (let x = x0; x <= x1; x++) {
      if (!bin[y * width + x]) continue;
      count++;
      sumY += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (count < 25 || !Number.isFinite(minX)) return { clef: fallback, confidence: 0 };

  const height = (maxY - minY) / space;
  const centroid = (sumY / count - staff.top) / (staff.bottom - staff.top);
  const widthSpaces = (maxX - minX) / space;

  if (height >= 3.2 && centroid > 0.2) {
    return { clef: "treble", confidence: Math.min(0.95, 0.62 + (height - 3.2) * 0.12) };
  }
  if (height <= 2.7 && widthSpaces < 2.2 && centroid < 0.72) {
    return { clef: "bass", confidence: Math.min(0.92, 0.6 + (2.7 - height) * 0.12) };
  }
  if (height <= 3.4 && widthSpaces < 3) {
    const clef: Clef = centroid > 0.4 ? "alto" : "tenor";
    return { clef, confidence: 0.5 };
  }
  return { clef: fallback, confidence: 0.15 };
}

function detectBarlines(binary: Binary, staff: StaffGeometry): number[] {
  const { bin, width } = binary;
  const height = staff.bottom - staff.top;
  const needed = height * 0.72;
  const found: number[] = [];
  let run = -1;
  for (let x = Math.ceil(staff.xStart + 2); x <= Math.floor(staff.xEnd - 2); x++) {
    let count = 0;
    for (let y = Math.ceil(staff.top); y <= Math.floor(staff.bottom); y++) {
      if (isStaffRow(y, staff.lines)) continue;
      if (bin[y * width + x]) count++;
    }
    const active = count >= needed;
    if (active && run < 0) run = x;
    if (!active && run >= 0) {
      found.push((run + x - 1) / 2);
      run = -1;
    }
  }
  if (run >= 0) found.push(run);
  return found.filter((x) => x > staff.xStart + staff.space * 0.8 && x < staff.xEnd - staff.space * 0.8);
}

type Mask = { dx: number; dy: number }[];

function ellipseMask(rx: number, ry: number): Mask {
  const mask: Mask = [];
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
    for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) mask.push({ dx, dy });
    }
  }
  return mask;
}

function fillRatio(binary: Binary, cx: number, cy: number, mask: Mask): number {
  const { bin, width, height } = binary;
  let hits = 0;
  let total = 0;
  for (const { dx, dy } of mask) {
    const x = Math.round(cx + dx);
    const y = Math.round(cy + dy);
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    total++;
    if (bin[y * width + x]) hits++;
  }
  return total ? hits / total : 0;
}

function hasStem(binary: Binary, cx: number, cy: number, space: number): { stem: boolean; direction: 1 | -1; tipY: number } {
  const { bin, width, height } = binary;
  const need = Math.round(space * 1.5);
  for (const side of [0.55, -0.55]) {
    const x = Math.round(cx + space * side);
    if (x < 0 || x >= width) continue;
    for (const direction of [1, -1] as const) {
      let run = 0;
      for (let step = 1; step < space * 3.2; step++) {
        const y = Math.round(cy + direction * step);
        if (y < 0 || y >= height) break;
        const dark = bin[y * width + x] || bin[y * width + x + 1] || bin[y * width + x - 1];
        if (dark) run++;
        else if (run > 0 && step > space * 1.2) break;
      }
      if (run >= need) return { stem: true, direction, tipY: cy + direction * run };
    }
  }
  return { stem: false, direction: 1, tipY: cy };
}

function hasFlag(binary: Binary, x: number, tipY: number, space: number, direction: 1 | -1): boolean {
  const { bin, width, height } = binary;
  const rx = Math.round(space * 0.85);
  const ry = Math.round(space * 0.55);
  let hits = 0;
  let total = 0;
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const px = Math.round(x + dx);
      const py = Math.round(tipY + dy - direction * space * 0.25);
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      total++;
      if (bin[py * width + px]) hits++;
    }
  }
  return total > 0 && hits / total > 0.2;
}

function detectAccidental(binary: Binary, staff: StaffGeometry, cx: number, cy: number): number {
  const { bin, width, height } = binary;
  const space = staff.space;
  const x0 = Math.max(0, Math.floor(cx - space * 1.7));
  const x1 = Math.max(0, Math.floor(cx - space * 0.5));
  const y0 = Math.max(0, Math.floor(cy - space * 0.7));
  const y1 = Math.min(height - 1, Math.floor(cy + space * 0.7));
  if (x1 <= x0) return 0;

  let dark = 0;
  const columnRuns: number[] = [];
  for (let x = x0; x <= x1; x++) {
    let run = 0;
    let best = 0;
    for (let y = y0; y <= y1; y++) {
      if (isStaffRow(y, staff.lines)) continue;
      if (bin[y * width + x]) {
        dark++;
        run++;
        best = Math.max(best, run);
      } else run = 0;
    }
    if (best >= space * 0.7) columnRuns.push(x);
  }
  if (dark < (x1 - x0 + 1) * (y1 - y0 + 1) * 0.035) return 0;

  let strokes = 0;
  let previous = -10;
  for (const x of columnRuns) {
    if (x - previous > 2) strokes++;
    previous = x;
  }
  if (strokes >= 2) return 1;
  if (strokes === 1) return -1;
  return 0;
}

type Candidate = {
  x: number;
  y: number;
  step: number;
  confidence: number;
  hollow: boolean;
  duration: number;
  alter: number;
};

function detectNotes(binary: Binary, staff: StaffGeometry): { notes: Candidate[]; barlines: number[] } {
  const space = staff.space;
  const rx = space * 0.6;
  const ry = space * 0.42;
  const mask = ellipseMask(rx, ry);
  const centerMask = ellipseMask(rx * 0.35, ry * 0.32);
  const stepX = Math.max(1, Math.round(space * 0.3));
  const candidates: Candidate[] = [];
  const barlines = detectBarlines(binary, staff);
  const barSet = new Set(barlines.map((bar) => Math.round(bar)));

  for (let x = Math.ceil(staff.xStart + space * 3.4); x <= Math.floor(staff.xEnd - space * 0.5); x += stepX) {
    if (barSet.has(x)) continue;
    for (let step = -2; step <= 10; step++) {
      const y = staff.bottom - (step * space) / 2;
      if (y < staff.top - space * 1.6 || y > staff.bottom + space * 1.6) continue;
      const fill = fillRatio(binary, x, y, mask);
      if (fill < 0.28) continue;
      const center = fillRatio(binary, x, y, centerMask);
      const hollow = fill >= 0.32 && center <= 0.3 && fill - center >= 0.1;
      const filled = fill >= 0.58;
      if (!hollow && !filled) continue;

      const stem = hasStem(binary, x, y, space);
      if (filled && !stem.stem) continue;

      let duration = 1;
      if (hollow) duration = stem.stem ? 2 : 4;
      else if (stem.stem && hasFlag(binary, x + space * 0.55, stem.tipY, space, stem.direction)) duration = 0.5;

      const alter = detectAccidental(binary, staff, x, y);
      candidates.push({
        x,
        y,
        step,
        confidence: hollow ? Math.min(0.9, fill + (1 - center) * 0.2) : Math.min(0.95, fill + 0.1),
        hollow,
        duration,
        alter,
      });
    }
  }

  const kept: Candidate[] = [];
  for (const candidate of [...candidates].sort((a, b) => b.confidence - a.confidence)) {
    const duplicate = kept.some(
      (other) => Math.abs(other.x - candidate.x) < space * 0.45 && Math.abs(other.y - candidate.y) < space * 0.35,
    );
    if (!duplicate) kept.push(candidate);
  }
  return { notes: kept.sort((a, b) => a.x - b.x), barlines };
}

export function analyzeImage(image: Bitmap, options: { fallbackClef?: Clef; page?: number; fifths?: number } = {}): OmrPageResult {
  const page = options.page ?? 1;
  const fallback = options.fallbackClef ?? "treble";
  const binary = binarize(image);
  const lines = detectLines(binary);
  const geometries = groupStaves(lines);
  const warnings: string[] = [];
  const staves: OmrStaff[] = [];
  const notes: OmrNote[] = [];

  if (!geometries.length) {
    warnings.push("No se detectaron pentagramas. Probá con un PDF de mayor resolución o una página con notación impresa.");
  }

  geometries.forEach((geometry, staffIndex) => {
    const range = lineRange(binary, geometry);
    const staff: StaffGeometry = { ...geometry, ...range };
    const guess = detectClef(binary, staff, fallback);
    const staffInfo: OmrStaff = {
      index: staffIndex,
      page,
      clef: guess.clef,
      confidence: guess.confidence,
      top: staff.top,
      bottom: staff.bottom,
      space: staff.space,
      xStart: staff.xStart,
      xEnd: staff.xEnd,
    };
    staves.push(staffInfo);
    const detected = detectNotes(binary, staff);
    const beatsPerMeasure = 4;

    const grouped: Candidate[][] = [];
    for (const candidate of detected.notes) {
      const last = grouped[grouped.length - 1];
      if (last && Math.abs(last[0].x - candidate.x) < staff.space * 0.5) last.push(candidate);
      else grouped.push([candidate]);
    }

    const perMeasureBeat = new Map<number, number>();
    let barIndex = 0;
    for (const group of grouped) {
      const x = group.reduce((sum, item) => sum + item.x, 0) / group.length;
      while (barIndex < detected.barlines.length && detected.barlines[barIndex] < x) barIndex++;
      const measure = barIndex;
      const beat = perMeasureBeat.get(measure) ?? 0;
      const duration = Math.max(...group.map((item) => item.duration));
      perMeasureBeat.set(measure, Math.min(beatsPerMeasure, beat + duration));
      group.forEach((candidate, index) => {
        notes.push({
          id: `omr-${page}-${staffIndex}-${measure}-${Math.round(x)}-${index}`,
          page,
          staff: staffIndex,
          measure,
          beat,
          duration,
          step: candidate.step,
          alter: candidate.alter,
          confidence: candidate.confidence,
          hollow: candidate.hollow,
          x: candidate.x,
          y: candidate.y,
        });
      });
    }

    if (!detected.notes.length) warnings.push(`Pentagrama ${staffIndex + 1}: no se detectaron notas.`);
    if (guess.confidence < 0.4) warnings.push(`Pentagrama ${staffIndex + 1}: clave estimada (${CLEF_LABEL[guess.clef]}); revisá el resultado.`);
  });

  return {
    page,
    width: image.width,
    height: image.height,
    staves,
    notes,
    warnings,
    clef: staves[0]?.clef ?? fallback,
    clefConfidence: staves[0]?.confidence ?? 0,
  };
}

export function omrToEvents(pages: OmrPageResult[], time: TimeSignature, fifths: number): NoteEvent[] {
  const events: NoteEvent[] = [];
  const beatsPerMeasure = measureBeats(time);
  let measureOffset = 0;
  let id = 0;
  for (const page of pages) {
    const maxMeasure = page.notes.reduce((max, note) => Math.max(max, note.measure), -1);
    const groups = new Map<string, OmrNote[]>();
    for (const note of page.notes) {
      const key = `${note.staff}-${note.measure}-${note.beat}-${Math.round(note.x)}`;
      const list = groups.get(key) ?? [];
      list.push(note);
      groups.set(key, list);
    }
    for (const group of groups.values()) {
      const first = group[0];
      const staff = page.staves[first.staff];
      const clef = staff?.clef ?? page.clef;
      const pitches: Pitch[] = group
        .sort((a, b) => b.step - a.step)
        .map((note) => pitchFromStaffStep(note.step, clef, fifths, note.alter));
      const unique = pitches.filter((pitch, index) => pitches.findIndex((item) => item.step === pitch.step && item.alter === pitch.alter && item.octave === pitch.octave) === index);
      events.push({
        id: `omr-e${id++}`,
        part: first.staff,
        measure: measureOffset + first.measure,
        beat: Math.min(first.beat, Math.max(0, beatsPerMeasure - 0.25)),
        duration: Math.min(Math.max(0.25, first.duration), beatsPerMeasure),
        pitches: unique,
      });
    }
    measureOffset += Math.max(0, maxMeasure + 1);
    if (measureOffset === 0) measureOffset = 1;
  }
  return events.sort((a, b) => a.measure - b.measure || a.beat - b.beat || a.part - b.part);
}

export function summarizeOmr(pages: OmrPageResult[]): { clef: Clef; confidence: number; notes: number; staves: number; warnings: string[] } {
  const staves = pages.reduce((sum, page) => sum + page.staves.length, 0);
  const notes = pages.reduce((sum, page) => sum + page.notes.length, 0);
  const warnings = Array.from(new Set(pages.flatMap((page) => page.warnings)));
  const best = pages
    .flatMap((page) => page.staves)
    .slice()
    .sort((a, b) => b.confidence - a.confidence)[0];
  return {
    clef: best?.clef ?? pages[0]?.clef ?? "treble",
    confidence: best?.confidence ?? 0,
    notes,
    staves,
    warnings,
  };
}

export function measureCount(pages: OmrPageResult[]): number {
  return pages.reduce((sum, page) => sum + page.notes.reduce((max, note) => Math.max(max, note.measure), 0) + (page.notes.length ? 1 : 0), 0);
}

export function beatsPerMeasureOf(time: TimeSignature): number {
  return measureBeats(time);
}
