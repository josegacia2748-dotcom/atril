import { useMemo } from "react";
import { useApp, useProfile } from "../lib/store";
import { FAMILIES, INSTRUMENTS } from "../lib/music";
import { PageHead, Stat, Callout } from "../components/UI";
import { ScoreCard } from "../components/ScoreCard";

export function DirectorHome() {
  const app = useApp();
  const profile = useProfile();

  const stats = useMemo(() => {
    const musicians = app.profiles.filter((item) => item.role === "musician");
    const assignments = app.scores.reduce((sum, score) => sum + score.instrumentIds.length, 0);
    const omr = app.scores.filter((score) => score.omr).length;
    return { musicians: musicians.length, assignments, omr };
  }, [app.profiles, app.scores]);

  const coverage = useMemo(() => {
    return FAMILIES.map((family) => {
      const familyInstruments = INSTRUMENTS.filter((instrument) => instrument.family === family);
      const covered = familyInstruments.filter((instrument) =>
        app.scores.some((score) => score.instrumentIds.includes(instrument.id)),
      ).length;
      return { family, total: familyInstruments.length, covered };
    });
  }, [app.scores]);

  const recent = app.scores.slice(0, 3);

  return (
    <>
      <PageHead
        eyebrow={`Panel del director · ${profile?.name ?? ""}`}
        title="La orquesta empieza por una partitura bien asignada."
        lead="Subí un PDF, revisá el análisis OMR y asigná el material a cada instrumento. Los músicos verán únicamente lo que les corresponde."
        actions={
          <>
            <a className="btn primary" href="#/subir">
              ＋ Subir partitura
            </a>
            <a className="btn" href="#/biblioteca">
              Ver biblioteca
            </a>
            <a className="btn ghost" href="#/musicos">
              Gestionar músicos
            </a>
          </>
        }
      />

      <div className="stat-grid">
        <Stat value={app.scores.length} label="Partituras" hint={`${app.scores.filter((score) => score.pdfId).length} con PDF adjunto`} />
        <Stat value={stats.musicians} label="Músicos" hint={`${app.profiles.filter((item) => item.role === "director").length} perfil de dirección`} />
        <Stat value={stats.assignments} label="Asignaciones" hint="Partes entregadas por instrumento" />
        <Stat value={stats.omr} label="Con OMR" hint="Partituras leídas desde PDF" />
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h3>Cobertura por familia</h3>
            <span className="spacer" />
            <span className="small muted">Instrumentos con al menos una partitura</span>
          </div>
          <div className="card-body coverage">
            {coverage.map((row) => (
              <div className="coverage-row" key={row.family}>
                <span>{row.family}</span>
                <div className="coverage-bar">
                  <i style={{ width: `${row.total ? (row.covered / row.total) * 100 : 0}%` }} />
                </div>
                <span className="mono">
                  {row.covered}/{row.total}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Flujo recomendado</h3>
          </div>
          <div className="card-body stack">
            <div className="row" style={{ alignItems: "flex-start" }}>
              <span className="badge brass">1</span>
              <div>
                <strong>Subí el PDF original.</strong>
                <div className="small muted">Atril lo guarda en el navegador y analiza pentagramas y notas.</div>
              </div>
            </div>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <span className="badge brass">2</span>
              <div>
                <strong>Revisá clave y notas.</strong>
                <div className="small muted">Podés corregir la clave detectada y ver la confianza del OMR.</div>
              </div>
            </div>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <span className="badge brass">3</span>
              <div>
                <strong>Asigná por instrumento.</strong>
                <div className="small muted">Cada músico recibe solo sus partes, con transposición y audio.</div>
              </div>
            </div>
            <Callout tone="info" icon="🔒">
              Los archivos viven en este navegador (IndexedDB). Para compartir con otros dispositivos hace falta
              conectar un backend o almacenamiento en la nube.
            </Callout>
          </div>
        </section>
      </div>

      <div className="section-head">
        <div>
          <h2>Partituras recientes</h2>
          <p>Las últimas tres incorporaciones a la biblioteca.</p>
        </div>
        <span className="spacer" />
        <a className="btn small ghost" href="#/biblioteca">
          Ver todas →
        </a>
      </div>

      {recent.length ? (
        <div className="score-grid">
          {recent.map((score) => (
            <ScoreCard key={score.id} score={score} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <h3>Todavía no hay partituras</h3>
          <p>Subí un PDF o generá el ejemplo sintético para probar el lector OMR.</p>
          <a className="btn primary" href="#/subir">
            Subir la primera partitura
          </a>
        </div>
      )}

      <div className="footer-note">
        <span>Atril · {app.orchestra.name}</span>
        <span>Código de orquesta {app.orchestra.code}</span>
      </div>
    </>
  );
}
