import { frequencyOf, measureBeats, midiOf, type InstrumentFamily, type NoteEvent, type TimeSignature } from "./music";

export type PlaybackNote = {
  time: number;
  duration: number;
  midi: number;
  velocity: number;
};

type ToneModule = typeof import("tone");

export function buildPlaybackNotes(
  events: NoteEvent[],
  time: TimeSignature,
  tempo: number,
  transpose = 0,
): PlaybackNote[] {
  const secondsPerBeat = 60 / Math.max(20, tempo);
  const beats = measureBeats(time);
  const notes: PlaybackNote[] = [];
  for (const event of events) {
    if (!event.pitches.length) continue;
    const start = (event.measure * beats + event.beat) * secondsPerBeat;
    const duration = Math.max(0.08, event.duration * secondsPerBeat * 0.92);
    for (const pitch of event.pitches) {
      notes.push({ time: start, duration, midi: midiOf(pitch) + transpose, velocity: 0.72 });
    }
  }
  return notes.sort((a, b) => a.time - b.time);
}

export function playbackDuration(events: NoteEvent[], time: TimeSignature, tempo: number): number {
  const beats = measureBeats(time);
  const maxMeasure = events.reduce((max, event) => Math.max(max, event.measure), 0);
  const lastBeat = events.reduce((max, event) => Math.max(max, event.measure * beats + event.beat + event.duration), 0);
  return Math.max(1, Math.max((maxMeasure + 1) * beats, lastBeat) * (60 / Math.max(20, tempo)));
}

const TIMBRES: Record<InstrumentFamily, { oscillator: OscillatorType; attack: number; decay: number; sustain: number; release: number; filter: number }> = {
  Cuerdas: { oscillator: "sawtooth", attack: 0.08, decay: 0.25, sustain: 0.55, release: 0.9, filter: 2400 },
  Maderas: { oscillator: "triangle", attack: 0.04, decay: 0.18, sustain: 0.6, release: 0.35, filter: 3200 },
  Metales: { oscillator: "sawtooth", attack: 0.05, decay: 0.3, sustain: 0.5, release: 0.45, filter: 1900 },
  Teclados: { oscillator: "triangle", attack: 0.005, decay: 0.8, sustain: 0.12, release: 1.1, filter: 2800 },
  Percusión: { oscillator: "square", attack: 0.002, decay: 0.25, sustain: 0.02, release: 0.3, filter: 1500 },
  Voz: { oscillator: "sine", attack: 0.12, decay: 0.2, sustain: 0.7, release: 0.7, filter: 2200 },
};

export class OrchestraPlayer {
  private tone: ToneModule | null = null;
  private synth: any = null;
  private part: any = null;
  private reverb: any = null;
  private notes: PlaybackNote[] = [];
  private duration = 0;
  private family: InstrumentFamily = "Cuerdas";
  private timer = 0;
  private lastSignature = "";
  onTick?: (position: number, duration: number) => void;
  onEnded?: () => void;

  async ensure(): Promise<void> {
    if (!this.tone) this.tone = await import("tone");
    if (!this.synth) this.buildSynth();
  }

  private buildSynth() {
    const tone = this.tone;
    if (!tone) return;
    this.disposeSynth();
    const timbre = TIMBRES[this.family];
    this.reverb = new tone.Reverb({ decay: 2.1, wet: 0.22 }).toDestination();
    this.synth = new tone.PolySynth(tone.Synth, {
      oscillator: { type: timbre.oscillator },
      envelope: { attack: timbre.attack, decay: timbre.decay, sustain: timbre.sustain, release: timbre.release },
    });
    this.synth.maxPolyphony = 24;
    const filter = new tone.Filter({ type: "lowpass", frequency: timbre.filter, rolloff: -12 });
    this.synth.connect(filter);
    filter.connect(this.reverb);
    this.synth.volume.value = -6;
  }

  private disposeSynth() {
    try {
      this.part?.dispose();
    } catch {
      /* ignorado */
    }
    this.part = null;
    try {
      this.synth?.dispose();
    } catch {
      /* ignorado */
    }
    this.synth = null;
    try {
      this.reverb?.dispose();
    } catch {
      /* ignorado */
    }
    this.reverb = null;
  }

  async load(notes: PlaybackNote[], duration: number, family: InstrumentFamily): Promise<void> {
    await this.ensure();
    const signature = `${family}-${notes.length}-${notes[0]?.time ?? 0}-${notes[notes.length - 1]?.time ?? 0}-${duration}`;
    this.notes = notes;
    this.duration = duration;
    if (family !== this.family) {
      this.family = family;
      this.buildSynth();
    }
    if (signature === this.lastSignature && this.part) return;
    this.lastSignature = signature;
    this.schedule();
  }

  private schedule() {
    const tone = this.tone;
    if (!tone) return;
    try {
      this.part?.dispose();
      tone.Transport.stop();
      tone.Transport.cancel();
      tone.Transport.seconds = 0;
    } catch {
      /* ignorado */
    }
    this.part = new tone.Part((time: number, note: PlaybackNote) => {
      try {
        this.synth?.triggerAttackRelease(frequencyOf(note.midi), note.duration, time, note.velocity);
      } catch {
        /* nota fuera de rango */
      }
    }, this.notes.map((note) => [note.time, note] as [number, PlaybackNote]));
    this.part.start(0);
  }

  async play(): Promise<void> {
    await this.ensure();
    const tone = this.tone;
    if (!tone) return;
    await tone.start();
    if (tone.Transport.state === "paused") tone.Transport.start("+0.05");
    else if (tone.Transport.state !== "started") {
      if (tone.Transport.seconds >= this.duration) tone.Transport.seconds = 0;
      tone.Transport.start("+0.05");
    }
    this.tick();
  }

  pause(): void {
    this.tone?.Transport.pause();
    this.stopTimer();
  }

  stop(): void {
    this.tone?.Transport.stop();
    if (this.tone) this.tone.Transport.seconds = 0;
    this.stopTimer();
    this.onTick?.(0, this.duration);
  }

  seek(seconds: number): void {
    const tone = this.tone;
    if (!tone) return;
    const clamped = Math.max(0, Math.min(this.duration, seconds));
    const wasPlaying = tone.Transport.state === "started";
    tone.Transport.stop();
    tone.Transport.seconds = clamped;
    if (wasPlaying) tone.Transport.start("+0.02");
    this.onTick?.(clamped, this.duration);
  }

  get position(): number {
    return this.tone?.Transport.seconds ?? 0;
  }

  private stopTimer() {
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = 0;
    }
  }

  private tick = () => {
    this.stopTimer();
    const loop = () => {
      const tone = this.tone;
      if (!tone) return;
      const position = tone.Transport.seconds;
      this.onTick?.(Math.min(position, this.duration), this.duration);
      if (tone.Transport.state !== "started") return;
      if (position >= this.duration + 0.25) {
        this.stop();
        this.onEnded?.();
      }
    };
    loop();
    this.timer = window.setInterval(loop, 60);
  };

  dispose(): void {
    this.stopTimer();
    try {
      this.tone?.Transport.stop();
      this.tone?.Transport.cancel();
      if (this.tone) this.tone.Transport.seconds = 0;
    } catch {
      /* ignorado */
    }
    this.disposeSynth();
  }
}

export function formatClock(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safe / 60);
  const rest = Math.floor(safe % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
