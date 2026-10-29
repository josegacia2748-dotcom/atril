import { useMemo, useState } from "react";
import { store, useApp, useProfile } from "../lib/store";
import { navigate } from "../lib/router";
import {
  CLEF_LABEL,
  INSTRUMENTS,
  instrumentById,
  instrumentName,
  keyName,
  transposeEvents,
  type Clef,
} from "../lib/music";
import { eventsToXml } from "../lib/musicxml";
import { getPdf, deletePdf } from "../lib/idb";
import { downloadBlob, printBlob } from "../lib/pdf";
import { generateScorePdf } from "../lib/pdfgen";
import { ScoreRenderer } from "../components/ScoreRenderer";
import { PdfViewer } from "../components/PdfViewer";
import { Player } from "../components/Player";
import { InstrumentChips, InstrumentPicker } from "../components/InstrumentPicker";
import { Badge, Callout, Crumbs, Empty } from "../components/UI";

type Tab = "partitura" | "pdf" | "audio";
type ViewMode = "written" | "concert";

export function ScorePage({ id }: { id: string }) {
  const app = useApp();
  const profile = useProfile();
  const score = app.scores.find((item) => item.id === id);

  const [tab, setTab] = useState<Tab>("partitura");
  const [viewMode, setViewMode] = useState<ViewMode>("written");
  const [instrumentId, setInstrumentId] = useState(
    profile?.role === "musician" ? profile.instrumentId ?? "" : score?.instrumentIds[0] ?? "",
  );
  const [assigned, setAssigned] = useState<string[]>(score?.instrumentIds ?? []);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isDirector = profile?.role === "director";

  const partMeta = useMemo(() => {
    if (!score) return { names: ["Partitura"], clefs: ["treble" as Clef] };
    const maxPart = score.events.reduce((max, event) => Math.max(max, event.part), 0);
    const count = score.events.length ? maxPart + 1 : 1;
    return {
      names: Array.from({ length: count }, (_, index) => (count > 1 ? `Pentagrama ${index + 1}` : "Partitura")),
      clefs: Array.from({ length: count }, (_, index) =>
        index === 0 ? score.clef : index === 1 ? "bass" : score.clef,
      ) as Clef[],
    };
  }, [score]);

  const instrument = instrumentById(instrumentId);
  const transpose = viewMode === "written" ? -(instrument?.transpose ?? 0) : 0;
  const shownFifths = viewMode === "written" ? (score?.keyFifths ?? 0) - (instrument?.keyShift ?? 0) : score?.keyFifths ?? 0;

  const displayXml = useMemo(() => {
    if (!score) return "";
    const events = transposeEvents(score.events, transpose);
    return eventsToXml(events, {
      title: score.title,
      composer: score.composer,
      keyFifths: shownFifths,
      time: score.time,
      tempo: score.tempo,
      clef: score.clef,
      partNames: partMeta.names,
      partClefs: partMeta.clefs,
    });
  }, [score, transpose, shownFifths, partMeta]);

  if (!profile) return null;
  if (!score) {
    return (
      <Empty
        icon="🎼"
        title="Partitura no encontrada"
        action={
          <a className="btn primary" href="#/">
            Volver al inicio
          </a>
        }
      >
        Puede que se haya eliminado o que el enlace esté incompleto.
      </Empty>
    );
  }

  const allowed =
    isDirector || (profile.instrumentId ? score.instrumentIds.includes(profile.instrumentId) : false);

  if (!allowed) {
    return (
      <Empty
        icon="🔒"
        title="Esta partitura no está asignada a tu instrumento"
        action={
          <a className="btn primary" href="#/">
            Ver mis partituras
          </a>
        }
      >
        Solo los músicos con el instrumento asignado y la dirección pueden abrir este material. Si creés que es un
        error, consultá con el director.
      </Empty>
    );
  }

  const filename = score.title.replace(/[^\w\-áéíóúüñÁÉÍÓÚÜÑ ]+/g, "").trim() || "partitura";

  const fetchPdf = async (): Promise<Blob> => {
    if (score.pdfId) {
      const stored = await getPdf(score.pdfId);
      if (stored) return stored;
    }
    return generateScorePdf(score);
  };

  const onDownload = async () => {
    setBusy(true);
    setError("");
    try {
      const blob = await fetchPdf();
      downloadBlob(blob, `${filename}.pdf`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo descargar el PDF.");
    } finally {
      setBusy(false);
    }
  };

  const onPrint = async () => {
    setBusy(true);
    setError("");
    try {
      printBlob(await fetchPdf(), `${filename}.pdf`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo imprimir.");
    } finally {
      setBusy(false);
    }
  };

  const onMusicXml = () => {
    downloadBlob(new Blob([displayXml], { type: "application/vnd.recordare.musicxml+xml" }), `${filename}.musicxml`);
  };

  const saveAssignments = () => {
    store.updateScore(score.id, { instrumentIds: assigned });
    setSaved("Asignaciones actualizadas.");
    window.setTimeout(() => setSaved(""), 2500);
  };

  const removeScore = async () => {
    if (!window.confirm(`¿Eliminar "${score.title}" de la biblioteca?`)) return;
    if (score.pdfId) {
      await deletePdf(score.pdfId).catch(() => undefined);
    }
    store.removeScore(score.id);
    navigate("/biblioteca");
  };

  const transpositionNote = !instrument
    ? "Elegí un instrumento para aplicar su transposición."
    : instrument.transpose === 0
      ? `${instrument.name} no es transpositor: la parte escrita coincide con el sonido real.`
      : viewMode === "written"
        ? `Parte escrita para ${instrument.name}: suena ${Math.abs(instrument.transpose)} semitono${Math.abs(instrument.transpose) === 1 ? "" : "s"} ${instrument.transpose < 0 ? "más grave" : "más agudo"}. Armadura escrita: ${keyName(shownFifths)}.`
        : `Sonido real (concierto): armadura ${keyName(score.keyFifths)}. Al pasar a la parte escrita se aplica la transposición de ${instrument.name}.`;

  return (
    <>
      <Crumbs
        items={[
          { label: isDirector ? "Biblioteca" : "Mis partituras", href: isDirector ? "#/biblioteca" : "#/" },
          { label: score.title },
        ]}
      />

      <section className="score-hero">
        <div className="cover" aria-hidden="true">
          𝄞
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div className="eyebrow">{score.omr ? "Partitura leída con OMR" : score.pdfId ? "Partitura con PDF" : "Partitura digital"}</div>
          <h1>{score.title}</h1>
          <div className="composer">
            {score.composer}
            {score.arranger ? ` · arreglo de ${score.arranger}` : ""}
          </div>
          <div className="meta">
            <Badge tone="brass">{CLEF_LABEL[score.clef]}</Badge>
            <Badge>{keyName(score.keyFifths)}</Badge>
            <Badge>
              {score.time.beats}/{score.time.beatType}
            </Badge>
            <Badge>♩ = {score.tempo}</Badge>
            {score.omr ? <Badge tone="teal">OMR {Math.round(score.omr.confidence * 100)}%</Badge> : null}
            {score.pdfId ? <Badge tone="blue">PDF {score.pages ?? ""}</Badge> : null}
          </div>
          <div className="actions">
            <button type="button" className="btn primary" onClick={() => void onDownload()} disabled={busy}>
              ⬇ Descargar PDF
            </button>
            <button type="button" className="btn" onClick={() => void onPrint()} disabled={busy}>
              🖨 Imprimir
            </button>
            <button type="button" className="btn ghost" onClick={onMusicXml}>
              ⬇ MusicXML
            </button>
            {isDirector ? (
              <button type="button" className="btn danger" onClick={() => void removeScore()}>
                Eliminar
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {error ? <Callout tone="warn">{error}</Callout> : null}

      <div className="tabs" role="tablist" aria-label="Vistas de la partitura">
        <button type="button" role="tab" aria-selected={tab === "partitura"} className={`tab${tab === "partitura" ? " active" : ""}`} onClick={() => setTab("partitura")}>
          ♫ Partitura
        </button>
        <button type="button" role="tab" aria-selected={tab === "pdf"} className={`tab${tab === "pdf" ? " active" : ""}`} onClick={() => setTab("pdf")}>
          📄 PDF original
        </button>
        <button type="button" role="tab" aria-selected={tab === "audio"} className={`tab${tab === "audio" ? " active" : ""}`} onClick={() => setTab("audio")}>
          ▶ Audio
        </button>
      </div>

      {tab === "partitura" ? (
        <>
          <div className="card card-pad" style={{ marginBottom: 14 }}>
            <div className="row wrap" style={{ gap: 12 }}>
              <div className="field" style={{ minWidth: 220 }}>
                <label htmlFor="score-instrument">Instrumento de la parte</label>
                {isDirector ? (
                  <select id="score-instrument" value={instrumentId} onChange={(event) => setInstrumentId(event.target.value)}>
                    <option value="">Sin transposición</option>
                    {INSTRUMENTS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="row" style={{ gap: 8 }}>
                    <span className="badge teal">{instrumentName(profile.instrumentId)}</span>
                  </div>
                )}
              </div>
              <div className="field" style={{ minWidth: 240 }}>
                <label>Modo de lectura</label>
                <div className="chips">
                  <button type="button" className={`chip${viewMode === "written" ? " active" : ""}`} onClick={() => setViewMode("written")}>
                    Parte escrita
                  </button>
                  <button type="button" className={`chip${viewMode === "concert" ? " active" : ""}`} onClick={() => setViewMode("concert")}>
                    Sonido real
                  </button>
                </div>
              </div>
              <span className="spacer" />
              <div className="small muted" style={{ maxWidth: 360 }}>
                {transpositionNote}
              </div>
            </div>
          </div>

          <div className="viewer-frame">
            <div className="viewer-toolbar">
              <span>{score.title}</span>
              <span className="spacer" />
              <span className="mono">
                {keyName(shownFifths)} · {score.time.beats}/{score.time.beatType}
              </span>
              <button type="button" className="btn small ghost" onClick={onMusicXml}>
                ⬇ MusicXML
              </button>
            </div>
            <div className="viewer-body">
              <ScoreRenderer xml={displayXml} />
            </div>
          </div>
        </>
      ) : null}

      {tab === "pdf" ? <PdfViewer score={score} /> : null}

      {tab === "audio" ? (
        <div className="viewer-frame">
          <Player score={score} instrumentId={instrumentId} />
        </div>
      ) : null}

      <div className="grid-2" style={{ marginTop: 20 }}>
        <section className="card">
          <div className="card-head">
            <h3>{isDirector ? "Asignación por instrumento" : "Instrumentos asignados"}</h3>
            <span className="spacer" />
            <Badge>{score.instrumentIds.length}</Badge>
          </div>
          <div className="card-body">
            {isDirector ? (
              <div className="stack">
                <InstrumentPicker selected={assigned} onChange={setAssigned} />
                <div className="row wrap">
                  <button type="button" className="btn primary" onClick={saveAssignments} disabled={!assigned.length}>
                    Guardar asignaciones
                  </button>
                  <button type="button" className="btn ghost" onClick={() => setAssigned(score.instrumentIds)}>
                    Descartar cambios
                  </button>
                  {saved ? <span className="small" style={{ color: "var(--ok)" }}>✓ {saved}</span> : null}
                </div>
                {!assigned.length ? <Callout tone="warn">Asigná al menos un instrumento para que los músicos puedan abrirla.</Callout> : null}
              </div>
            ) : (
              <div className="stack">
                <InstrumentChips ids={score.instrumentIds} />
                <div className="small muted">
                  Tu parte corresponde a {instrumentName(profile.instrumentId)}. Si falta tu instrumento, consultá con
                  la dirección.
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Ficha técnica</h3>
          </div>
          <div className="card-body stack">
            <div className="row wrap small">
              <span className="muted">Clave</span>
              <strong>{CLEF_LABEL[score.clef]}</strong>
              <span className="spacer" />
              <span className="muted">Armadura</span>
              <strong>{keyName(score.keyFifths)}</strong>
            </div>
            <div className="row wrap small">
              <span className="muted">Compás</span>
              <strong>
                {score.time.beats}/{score.time.beatType}
              </strong>
              <span className="spacer" />
              <span className="muted">Tempo</span>
              <strong>♩ = {score.tempo}</strong>
            </div>
            <div className="row wrap small">
              <span className="muted">Eventos</span>
              <strong>{score.events.length}</strong>
              <span className="spacer" />
              <span className="muted">Pentagramas</span>
              <strong>{partMeta.names.length}</strong>
            </div>
            {score.pdfName ? (
              <div className="small muted">
                PDF: <span className="mono">{score.pdfName}</span> · {score.pages ?? "?"} página(s)
              </div>
            ) : (
              <div className="small muted">Sin PDF adjunto: el visor genera una versión imprimible.</div>
            )}
            {score.notes ? (
              <Callout tone="info" icon="✎">
                {score.notes}
              </Callout>
            ) : null}
            {score.omr ? (
              <div className="stack" style={{ gap: 8 }}>
                <div className="eyebrow">Lectura OMR</div>
                <div className="small muted">
                  Clave detectada: {CLEF_LABEL[score.omr.clef]} · Confianza {Math.round(score.omr.confidence * 100)}% ·{" "}
                  {score.omr.notes} notas en {score.omr.systems} pentagramas · {score.omr.pages} página(s).
                </div>
                {score.omr.warnings.length ? (
                  <ul className="warning-list">
                    {score.omr.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="small" style={{ color: "var(--ok)" }}>✓ Sin avisos del lector.</div>
                )}
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <div className="footer-note">
        <span>{app.orchestra.name}</span>
        <span>
          {isDirector ? (
            <a href="#/biblioteca">Volver a la biblioteca</a>
          ) : (
            <a href="#/">Volver a mis partituras</a>
          )}
        </span>
      </div>
    </>
  );
}
