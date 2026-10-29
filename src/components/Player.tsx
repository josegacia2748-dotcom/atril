import { useEffect, useRef, useState } from "react";
import type { Score } from "../lib/types";
import { instrumentById, instrumentName } from "../lib/music";
import { OrchestraPlayer, buildPlaybackNotes, formatClock, playbackDuration } from "../lib/audio";
import { Callout } from "./UI";

export function Player({ score, instrumentId }: { score: Score; instrumentId?: string }) {
  const playerRef = useRef<OrchestraPlayer | null>(null);
  const [tempo, setTempo] = useState(score.tempo);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(() => playbackDuration(score.events, score.time, score.tempo));
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const instrument = instrumentById(instrumentId);
  const family = instrument?.family ?? "Cuerdas";
  const notes = buildPlaybackNotes(score.events, score.time, tempo);

  useEffect(() => {
    const player = new OrchestraPlayer();
    player.onTick = (next, total) => {
      setPosition(next);
      setDuration(total);
    };
    player.onEnded = () => setPlaying(false);
    playerRef.current = player;
    return () => {
      player.dispose();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    let cancelled = false;
    const total = playbackDuration(score.events, score.time, tempo);
    setDuration(total);
    setPlaying(false);
    setReady(false);
    player
      .load(buildPlaybackNotes(score.events, score.time, tempo), total, family)
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "No se pudo preparar el audio.");
      });
    return () => {
      cancelled = true;
    };
  }, [score.events, score.time, score.id, tempo, family]);

  const toggle = async () => {
    const player = playerRef.current;
    if (!player || !ready) return;
    try {
      if (playing) {
        player.pause();
        setPlaying(false);
      } else {
        await player.play();
        setPlaying(true);
        setError("");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "El navegador bloqueó el audio. Volvé a intentar.");
    }
  };

  const stop = () => {
    playerRef.current?.stop();
    setPlaying(false);
    setPosition(0);
  };

  const onSeek = (value: number) => {
    playerRef.current?.seek(value);
    setPosition(value);
  };

  const changeTempo = (value: number) => {
    playerRef.current?.stop();
    setPlaying(false);
    setPosition(0);
    setTempo(value);
  };

  return (
    <div className="player">
      <div className="player-main">
        <button
          type="button"
          className="play-btn"
          onClick={toggle}
          aria-label={playing ? "Pausar" : "Reproducir"}
          disabled={!notes.length || !ready}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <div>
          <div className="track-title">{score.title}</div>
          <div className="track-sub">
            {instrument ? `${instrument.name} · ${instrument.family}` : "Timbre de cuerdas"} · {notes.length} notas ·{" "}
            {formatClock(duration)}
          </div>
        </div>
        <span className="spacer" />
        <button type="button" className="btn small ghost" onClick={stop} disabled={!notes.length || !ready}>
          ⏹ Detener
        </button>
      </div>

      <div className="timeline">
        <input
          type="range"
          min={0}
          max={Math.max(1, duration)}
          step={0.05}
          value={Math.min(position, Math.max(1, duration))}
          onChange={(event) => onSeek(Number(event.target.value))}
          aria-label="Posición de reproducción"
        />
        <div className="times">
          <span>{formatClock(position)}</span>
          <span>{formatClock(duration)}</span>
        </div>
      </div>

      <div className="player-controls">
        <div className="field" style={{ maxWidth: 260 }}>
          <label htmlFor="tempo">Tempo · {tempo} BPM</label>
          <input
            id="tempo"
            type="range"
            min={40}
            max={200}
            step={2}
            value={tempo}
            onChange={(event) => changeTempo(Number(event.target.value))}
          />
        </div>
        <div className="timbre">
          <span className="ico" aria-hidden="true">
            {instrument?.icon ?? "🎻"}
          </span>
          <div>
            <div style={{ fontWeight: 650 }}>Timbre sintetizado</div>
            <div className="small muted">
              {instrumentName(instrumentId)} · familia {family}
            </div>
          </div>
        </div>
        <div className="timbre">
          <span className="ico" aria-hidden="true">
            🎚
          </span>
          <div>
            <div style={{ fontWeight: 650 }}>Sonido real</div>
            <div className="small muted">
              {instrument && instrument.transpose
                ? `Escrito ${instrument.transpose > 0 ? "+" : ""}${instrument.transpose} st → concierto`
                : "Instrumento no transpositor"}
            </div>
          </div>
        </div>
      </div>

      {!notes.length ? <Callout tone="warn">Esta partitura todavía no tiene notas para reproducir.</Callout> : null}
      {error ? <Callout tone="warn">{error}</Callout> : null}
      <div className="small muted">
        La síntesis usa Tone.js. La primera reproducción necesita un toque o clic para habilitar el audio del navegador.
      </div>
    </div>
  );
}
