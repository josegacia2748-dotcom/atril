import { useEffect, useMemo, useState } from "react";
import { useApp } from "../lib/store";
import { useRoute } from "../lib/router";
import { instrumentName } from "../lib/music";
import { PageHead, Empty, Callout } from "../components/UI";
import { ScoreCard } from "../components/ScoreCard";
import { InstrumentSelect } from "../components/InstrumentPicker";

export function Library() {
  const app = useApp();
  const route = useRoute();
  const [query, setQuery] = useState("");
  const [instrument, setInstrument] = useState(route.query.get("instrumento") ?? "");
  const [onlyOmr, setOnlyOmr] = useState(route.query.get("filtro") === "omr");

  useEffect(() => {
    setInstrument(route.query.get("instrumento") ?? "");
    setOnlyOmr(route.query.get("filtro") === "omr");
  }, [route.query]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return app.scores.filter((score) => {
      if (onlyOmr && !score.omr) return false;
      if (instrument && !score.instrumentIds.includes(instrument)) return false;
      if (!needle) return true;
      return (
        score.title.toLowerCase().includes(needle) ||
        score.composer.toLowerCase().includes(needle) ||
        (score.arranger ?? "").toLowerCase().includes(needle)
      );
    });
  }, [app.scores, instrument, onlyOmr, query]);

  return (
    <>
      <PageHead
        eyebrow="Biblioteca de partituras"
        title="Todo el repertorio de la orquesta"
        lead="Buscá por título o compositor, filtrá por instrumento y abrí cualquier partitura para revisar notación, PDF, audio y asignaciones."
        actions={
          <a className="btn primary" href="#/subir">
            ＋ Nueva partitura
          </a>
        }
      />

      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="row wrap" style={{ gap: 12 }}>
          <div className="searchbar" style={{ flex: 1, minWidth: 220 }}>
            <span className="ico" aria-hidden="true">
              🔍
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por título, compositor o arreglador…"
              aria-label="Buscar partituras"
            />
          </div>
          <div style={{ width: 220 }}>
            <InstrumentSelect
              value={instrument || undefined}
              onChange={(id) => setInstrument(id)}
              placeholder="Todos los instrumentos"
            />
          </div>
          <button
            type="button"
            className={`chip${onlyOmr ? " active" : ""}`}
            aria-pressed={onlyOmr}
            onClick={() => setOnlyOmr((value) => !value)}
          >
            Solo con OMR
          </button>
          {instrument || onlyOmr || query ? (
            <button
              type="button"
              className="btn small ghost"
              onClick={() => {
                setQuery("");
                setInstrument("");
                setOnlyOmr(false);
              }}
            >
              Limpiar filtros
            </button>
          ) : null}
          <span className="spacer" />
          <span className="small muted">
            {filtered.length} de {app.scores.length}
          </span>
        </div>
        {instrument ? (
          <div className="small muted" style={{ marginTop: 10 }}>
            Mostrando partituras asignadas a <strong>{instrumentName(instrument)}</strong>.
          </div>
        ) : null}
      </div>

      {filtered.length ? (
        <div className="score-grid">
          {filtered.map((score) => (
            <ScoreCard key={score.id} score={score} />
          ))}
        </div>
      ) : (
        <Empty
          icon="🔎"
          title="No hay partituras con esos filtros"
          action={
            <button
              type="button"
              className="btn"
              onClick={() => {
                setQuery("");
                setInstrument("");
                setOnlyOmr(false);
              }}
            >
              Ver toda la biblioteca
            </button>
          }
        >
          Probá con otro instrumento o subí una partitura nueva.
        </Empty>
      )}

      <Callout tone="info" icon="🗂">
        Cada partitura puede asignarse a varios instrumentos a la vez. Abrí una partitura para ajustar sus asignaciones,
        descargar el PDF o cambiar entre sonido real y parte escrita.
      </Callout>
    </>
  );
}
