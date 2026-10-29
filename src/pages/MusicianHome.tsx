import { useMemo } from "react";
import { useApp, useProfile, scoresForInstrument } from "../lib/store";
import { CLEF_LABEL, instrumentById, instrumentName } from "../lib/music";
import { Badge, Callout, Empty, PageHead, Stat } from "../components/UI";
import { ScoreCard } from "../components/ScoreCard";

export function MusicianHome() {
  const app = useApp();
  const profile = useProfile();
  const instrument = instrumentById(profile?.instrumentId);
  const assigned = useMemo(
    () => (profile ? scoresForInstrument(app.scores, profile.instrumentId) : []),
    [app.scores, profile],
  );
  const withPdf = assigned.filter((score) => score.pdfId).length;
  const withOmr = assigned.filter((score) => score.omr).length;

  if (!profile) return null;

  if (!instrument) {
    return (
      <>
        <PageHead eyebrow={`Hola, ${profile.name}`} title="Elegí tu instrumento para ver tus partituras" />
        <Empty
          icon="🎻"
          title="Tu perfil todavía no tiene instrumento"
          action={
            <a className="btn primary" href="#/ajustes">
              Ir a Mi perfil
            </a>
          }
        >
          El director asigna el material por instrumento. Definí el tuyo para recibir las partes correctas.
        </Empty>
      </>
    );
  }

  return (
    <>
      <section className="hero-panel">
        <div className="eyebrow">Atril de {instrument.name}</div>
        <h1>Hola, {profile.name.split(" ")[0]}. Tu música está lista.</h1>
        <p className="lead">
          {assigned.length
            ? `Tenés ${assigned.length} partitura${assigned.length === 1 ? "" : "s"} asignada${assigned.length === 1 ? "" : "s"}. Abrí cualquiera para leerla, descargarla, imprimirla o escucharla con el timbre de ${instrument.name.toLowerCase()}.`
            : `Todavía no tenés partituras asignadas. Cuando el director asigne material a ${instrument.name.toLowerCase()}, aparecerá acá.`}
        </p>
        <div className="actions">
          <a className="btn primary" href="#/ajustes">
            Ver mi perfil
          </a>
          <span className="badge teal">
            <span aria-hidden="true">{instrument.icon}</span> {instrument.family}
          </span>
          <span className="badge">{CLEF_LABEL[instrument.clef]}</span>
          <span className="badge">{instrument.range}</span>
        </div>
      </section>

      <div className="stat-grid">
        <Stat value={assigned.length} label="Partituras asignadas" hint="Solo de tu instrumento" />
        <Stat value={withPdf} label="Con PDF" hint="Listas para descargar e imprimir" />
        <Stat value={withOmr} label="Con OMR" hint="Notación leída desde PDF" />
        <Stat
          value={instrument.transpose === 0 ? "Real" : `${instrument.transpose > 0 ? "+" : ""}${instrument.transpose} st`}
          label="Transposición"
          hint={instrument.transpose === 0 ? "Instrumento no transpositor" : "Escrito → sonido real"}
        />
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card card-pad">
          <div className="eyebrow">Cómo leer tu parte</div>
          <h3 style={{ margin: "6px 0 8px" }}>{instrument.name}</h3>
          <p className="small" style={{ color: "var(--ink-2)" }}>
            {instrument.transpose === 0
              ? "Tu instrumento suena tal como está escrito. La armadura y las notas coinciden con el sonido real."
              : `Tu instrumento es transpositor: cuando leés un Do escrito, suena ${Math.abs(instrument.transpose)} semitono${Math.abs(instrument.transpose) === 1 ? "" : "s"} ${instrument.transpose < 0 ? "más grave" : "más agudo"}. Atril puede mostrarte la parte escrita o el sonido real.`}
          </p>
          <div className="chips">
            <Badge tone="brass">{CLEF_LABEL[instrument.clef]}</Badge>
            <Badge>{instrument.range}</Badge>
            <Badge tone="blue">Sonido real disponible</Badge>
          </div>
        </div>
        <div className="card card-pad">
          <div className="eyebrow">Consejos de estudio</div>
          <ul className="small" style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--ink-2)", lineHeight: 1.8 }}>
            <li>Abrí la pestaña <strong>Partitura</strong> para la notación y el metrónomo visual.</li>
            <li>Usá <strong>PDF original</strong> para imprimir la edición del director.</li>
            <li>En <strong>Audio</strong> podés bajar el tempo sin cambiar la altura.</li>
            <li>El modo <strong>parte escrita</strong> aplica la transposición de tu instrumento.</li>
          </ul>
        </div>
      </div>

      <div className="section-head">
        <div>
          <h2>Mis partituras</h2>
          <p>Material asignado a {instrumentName(profile.instrumentId)}.</p>
        </div>
      </div>

      {assigned.length ? (
        <div className="score-grid">
          {assigned.map((score) => (
            <ScoreCard key={score.id} score={score} />
          ))}
        </div>
      ) : (
        <Empty icon="🎼" title="Sin material asignado todavía">
          El director puede asignarte partituras desde la biblioteca. Mientras tanto, podés revisar tu perfil y el
          código de la orquesta.
        </Empty>
      )}

      <Callout tone="info" icon="ℹ">
        La biblioteca es local a este dispositivo. Si abrís Atril en otro teléfono o computadora, vas a ver los datos
        guardados en ese navegador.
      </Callout>

      <div className="footer-note">
        <span>
          {app.orchestra.name} · código {app.orchestra.code}
        </span>
        <span>
          Atril · lectura, impresión y audio
        </span>
      </div>
    </>
  );
}
