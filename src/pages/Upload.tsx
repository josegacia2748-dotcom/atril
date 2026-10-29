import { useEffect, useMemo, useRef, useState } from "react";
import { store, uid } from "../lib/store";
import { navigate } from "../lib/router";
import { analyzePdf, pdfPageCount } from "../omr/pdf";
import { omrToEvents, summarizeOmr, type OmrPageResult } from "../omr/analyze";
import { eventsToXml, parseMusicXml, type ParsedXml } from "../lib/musicxml";
import { generateDemoPdf } from "../lib/pdfgen";
import { savePdf } from "../lib/idb";
import { CLEF_LABEL, keyName, type Clef, type NoteEvent } from "../lib/music";
import type { Score } from "../lib/types";
import { Badge, Callout, PageHead, Progress } from "../components/UI";
import { InstrumentPicker } from "../components/InstrumentPicker";
import { ScoreRenderer } from "../components/ScoreRenderer";

type Step = 1 | 2 | 3;

const CLEFS: Clef[] = ["treble", "bass", "alto", "tenor"];

const KEY_OPTIONS = Array.from({ length: 15 }, (_, index) => index - 7);

export function Upload() {
  const [step, setStep] = useState<Step>(1);
  const [fileName, setFileName] = useState("");
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfPages, setPdfPages] = useState<number | undefined>();
  const [omrPages, setOmrPages] = useState<OmrPageResult[] | null>(null);
  const [parsed, setParsed] = useState<ParsedXml | null>(null);
  const [title, setTitle] = useState("");
  const [composer, setComposer] = useState("");
  const [arranger, setArranger] = useState("");
  const [keyFifths, setKeyFifths] = useState(0);
  const [beats, setBeats] = useState(4);
  const [beatType, setBeatType] = useState(4);
  const [tempo, setTempo] = useState(90);
  const [clef, setClef] = useState<Clef>("treble");
  const [instruments, setInstruments] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [previewXml, setPreviewXml] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const time = useMemo(() => ({ beats, beatType }), [beats, beatType]);

  const effectivePages = useMemo(() => {
    if (!omrPages) return null;
    return omrPages.map((page) => ({
      ...page,
      clef,
      staves: page.staves.map((staff) => ({ ...staff, clef })),
    }));
  }, [omrPages, clef]);

  const events: NoteEvent[] = useMemo(() => {
    if (parsed) return parsed.events;
    if (effectivePages) return omrToEvents(effectivePages, { beats, beatType }, keyFifths);
    return [];
  }, [parsed, effectivePages, beats, beatType, keyFifths]);

  const partMeta = useMemo(() => {
    const maxPart = events.reduce((max, event) => Math.max(max, event.part), 0);
    const count = events.length ? maxPart + 1 : 1;
    return {
      names: Array.from({ length: count }, (_, index) =>
        parsed?.parts[index]?.name ?? (count > 1 ? `Pentagrama ${index + 1}` : "Partitura"),
      ),
      clefs: Array.from({ length: count }, (_, index) => {
        const fromParsed = parsed?.parts[index]?.clef;
        const fromOmr = effectivePages?.[0]?.staves[index]?.clef;
        return fromParsed ?? fromOmr ?? (index === 0 ? clef : index === 1 ? "bass" : clef);
      }),
    };
  }, [events, parsed, effectivePages, clef]);

  const xml = useMemo(
    () =>
      eventsToXml(events, {
        title: title.trim() || "Partitura sin título",
        composer: composer.trim() || "Anónimo",
        keyFifths,
        time,
        tempo,
        clef,
        partNames: partMeta.names,
        partClefs: partMeta.clefs,
      }),
    [events, title, composer, keyFifths, time, tempo, clef, partMeta],
  );

  useEffect(() => {
    if (step === 3) setPreviewXml(xml);
    // Solo tomamos una instantánea al entrar al paso de revisión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const summary = useMemo(() => (omrPages ? summarizeOmr(omrPages) : null), [omrPages]);

  const runOmr = async (blob: Blob, fallback: Clef) => {
    setBusy(true);
    setError("");
    setProgress(0);
    setStatus("Preparando el análisis…");
    setOmrPages(null);
    setParsed(null);
    setStep(2);
    try {
      const pages = await analyzePdf(await blob.arrayBuffer(), {
        scale: 2,
        fallbackClef: fallback,
        onProgress: (done, total, message) => {
          setProgress(total ? done / total : 0);
          setStatus(message);
        },
      });
      setOmrPages(pages);
      const result = summarizeOmr(pages);
      setClef(result.clef);
      setProgress(1);
      setStatus(
        result.notes
          ? `Análisis completo: ${result.notes} notas en ${result.staves} pentagramas.`
          : "El análisis terminó sin notas detectadas. Podés ajustar la clave o subir otra versión del PDF.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo analizar el PDF.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  const acceptFile = async (file: File) => {
    setError("");
    setFileName(file.name);
    setOmrPages(null);
    setParsed(null);
    setPdfBlob(null);
    setPdfPages(undefined);
    setPreviewXml("");

    if (/\.(musicxml|xml)$/i.test(file.name)) {
      try {
        const text = await file.text();
        const result = parseMusicXml(text);
        setParsed(result);
        setTitle(result.title);
        setComposer(result.composer);
        setKeyFifths(result.keyFifths);
        setBeats(result.time.beats);
        setBeatType(result.time.beatType);
        setTempo(result.tempo);
        setClef(result.clef);
        setStatus(`${result.events.length} eventos y ${result.parts.length} pentagrama(s) importados desde MusicXML.`);
        setStep(2);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No se pudo leer el MusicXML.");
      }
      return;
    }

    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      setError("Formato no soportado. Subí un PDF, MusicXML (.xml / .musicxml) o generá el ejemplo OMR.");
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const pages = await pdfPageCount(buffer);
      setPdfBlob(file);
      setPdfPages(pages);
      setTitle(file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim());
      setComposer("");
      setArranger("");
      setNotes("");
      await runOmr(file, clef);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo abrir el PDF.");
    }
  };

  const loadDemo = async () => {
    setError("");
    setBusy(true);
    try {
      const demo = await generateDemoPdf();
      setFileName("ejemplo-omr.pdf");
      setPdfBlob(demo.blob);
      setPdfPages(1);
      setTitle(demo.title);
      setComposer(demo.composer);
      setArranger("Generado por Atril");
      setKeyFifths(demo.keyFifths);
      setBeats(demo.time.beats);
      setBeatType(demo.time.beatType);
      setTempo(demo.tempo);
      setClef(demo.clef);
      setNotes("PDF sintético creado para demostrar el flujo completo de lectura OMR.");
      await runOmr(demo.blob, demo.clef);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo generar el ejemplo.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setError("");
    if (!title.trim()) {
      setError("Poné un título para la partitura.");
      return;
    }
    if (!instruments.length) {
      setError("Asigná la partitura al menos a un instrumento.");
      return;
    }
    if (!events.length && !pdfBlob) {
      setError("La partitura no tiene notas ni PDF. Probá con otro archivo.");
      return;
    }
    setBusy(true);
    setStatus("Guardando en este dispositivo…");
    try {
      const id = uid("score");
      if (pdfBlob) await savePdf(id, pdfBlob);
      const omr = omrPages ? summarizeOmr(omrPages) : null;
      const score: Score = {
        id,
        title: title.trim(),
        composer: composer.trim() || "Anónimo",
        arranger: arranger.trim() || undefined,
        keyFifths,
        time,
        tempo,
        clef,
        instrumentIds: instruments,
        pdfId: pdfBlob ? id : undefined,
        pdfName: pdfBlob ? fileName : undefined,
        pages: pdfBlob ? pdfPages : undefined,
        musicXml: xml,
        events,
        omr: omr
          ? {
              clef: omr.clef,
              confidence: omr.confidence,
              notes: omr.notes,
              systems: omr.staves,
              analyzedAt: Date.now(),
              pages: omrPages?.length ?? 1,
              warnings: omr.warnings,
            }
          : undefined,
        notes: notes.trim() || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      store.addScore(score);
      navigate(`/partitura/${id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la partitura.");
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  return (
    <>
      <PageHead
        eyebrow="Nueva partitura"
        title="Del PDF a cada atril"
        lead="Atril analiza el PDF, detecta pentagramas y notas, te deja revisar la clave y genera una versión con notación, transposición y audio."
      />

      <div className="stepper" aria-label="Pasos de carga">
        <div className={`step-pill${step === 1 ? " active" : step > 1 ? " done" : ""}`}>
          <span className="n">{step > 1 ? "✓" : "1"}</span> Archivo
        </div>
        <div className={`step-pill${step === 2 ? " active" : step > 2 ? " done" : ""}`}>
          <span className="n">{step > 2 ? "✓" : "2"}</span> Lectura y clave
        </div>
        <div className={`step-pill${step === 3 ? " active" : ""}`}>
          <span className="n">3</span> Metadatos y asignación
        </div>
      </div>

      {error ? <Callout tone="warn">{error}</Callout> : null}

      {step === 1 ? (
        <>
          <div
            className={`dropzone${dragging ? " over" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files?.[0];
              if (file) void acceptFile(file);
            }}
          >
            <div className="big" aria-hidden="true">
              𝄞
            </div>
            <h3>Arrastrá un PDF o MusicXML</h3>
            <p className="small muted" style={{ maxWidth: "52ch", margin: 0 }}>
              El PDF se guarda en el navegador (IndexedDB) y se analiza con el lector OMR. También podés importar
              MusicXML si ya tenés la notación digital.
            </p>
            <div className="row wrap" style={{ justifyContent: "center", marginTop: 6 }}>
              <button type="button" className="btn primary" onClick={() => inputRef.current?.click()}>
                Elegir archivo
              </button>
              <button type="button" className="btn" onClick={() => void loadDemo()} disabled={busy}>
                ✨ Generar ejemplo OMR
              </button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.xml,.musicxml,application/pdf,application/vnd.recordare.musicxml+xml,application/xml,text/xml"
              style={{ display: "none" }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void acceptFile(file);
                event.target.value = "";
              }}
            />
          </div>
          <div className="grid-2" style={{ marginTop: 18 }}>
            <div className="card card-pad">
              <div className="eyebrow">Formatos</div>
              <ul className="small" style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.9, color: "var(--ink-2)" }}>
                <li><strong>PDF:</strong> se conserva para lectura, descarga e impresión; además se analiza con OMR.</li>
                <li><strong>MusicXML:</strong> se importa la notación directamente, sin OMR.</li>
                <li>El ejemplo OMR genera un PDF sintético en clave de sol para probar todo el flujo.</li>
              </ul>
            </div>
            <div className="card card-pad">
              <div className="eyebrow">Privacidad</div>
              <p className="small" style={{ color: "var(--ink-2)", marginTop: 8 }}>
                Los archivos no se envían a ningún servidor. El PDF queda en el almacenamiento del navegador y los
                metadatos en <code>localStorage</code>. Podés borrar todo desde Ajustes.
              </p>
            </div>
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <div className="grid-2">
            <div className="card">
              <div className="card-head">
                <h3>{parsed ? "MusicXML importado" : "Análisis OMR"}</h3>
                <span className="spacer" />
                {busy ? <Badge tone="brass">Procesando</Badge> : summary ? <Badge tone="ok">Listo</Badge> : null}
              </div>
              <div className="card-body stack">
                {fileName ? <div className="file-chip">📄 {fileName}</div> : null}
                {busy ? (
                  <Progress value={progress} label={status || "Analizando…"} />
                ) : parsed ? (
                  <Callout tone="ok" icon="✓">
                    {parsed.events.length} eventos, {parsed.parts.length} pentagrama(s), {parsed.title}.
                  </Callout>
                ) : summary ? (
                  <>
                    <div className="stat-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginBottom: 0 }}>
                      <div className="stat">
                        <b>{summary.notes}</b>
                        <span>Notas detectadas</span>
                      </div>
                      <div className="stat">
                        <b>{summary.staves}</b>
                        <span>Pentagramas</span>
                      </div>
                      <div className="stat">
                        <b>{Math.round(summary.confidence * 100)}%</b>
                        <span>Confianza de clave</span>
                      </div>
                      <div className="stat">
                        <b>{omrPages?.length ?? 0}</b>
                        <span>Páginas analizadas</span>
                      </div>
                    </div>
                    {summary.warnings.length ? (
                      <div>
                        <div className="eyebrow" style={{ marginBottom: 6 }}>Avisos del lector</div>
                        <ul className="warning-list">
                          {summary.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <Callout tone="ok" icon="✓">Sin avisos: el lector encontró pentagramas y notas con buena confianza.</Callout>
                    )}
                  </>
                ) : (
                  <Callout tone="warn">No hay resultados de análisis todavía.</Callout>
                )}
                {status && !busy ? <div className="small muted">{status}</div> : null}
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h3>Clave musical</h3>
                <span className="spacer" />
                <span className="small muted">Corregí la lectura</span>
              </div>
              <div className="card-body stack">
                <p className="small muted" style={{ margin: 0 }}>
                  El lector estima la clave por pentagrama. Si la detección falló, elegí la clave correcta y las notas
                  se reinterpretan antes de guardar.
                </p>
                <div className="chips">
                  {CLEFS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`chip${clef === option ? " active" : ""}`}
                      onClick={() => setClef(option)}
                      aria-pressed={clef === option}
                    >
                      {CLEF_LABEL[option]}
                    </button>
                  ))}
                </div>
                <div className="field">
                  <label htmlFor="upload-clef">Clave aplicada a la vista</label>
                  <select id="upload-clef" value={clef} onChange={(event) => setClef(event.target.value as Clef)}>
                    {CLEFS.map((option) => (
                      <option key={option} value={option}>
                        {CLEF_LABEL[option]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="upload-beats">Compás</label>
                    <select id="upload-beats" value={beats} onChange={(event) => setBeats(Number(event.target.value))}>
                      {[2, 3, 4, 6, 9, 12].map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="upload-beattype">Figura base</label>
                    <select id="upload-beattype" value={beatType} onChange={(event) => setBeatType(Number(event.target.value))}>
                      {[2, 4, 8].map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="upload-key">Armadura</label>
                  <select id="upload-key" value={keyFifths} onChange={(event) => setKeyFifths(Number(event.target.value))}>
                    {KEY_OPTIONS.map((fifths) => (
                      <option key={fifths} value={fifths}>
                        {keyName(fifths)} ({fifths > 0 ? `+${fifths}` : fifths} ♯/♭)
                      </option>
                    ))}
                  </select>
                </div>
                {pdfBlob ? (
                  <button type="button" className="btn small ghost" onClick={() => void runOmr(pdfBlob, clef)} disabled={busy}>
                    ↻ Volver a analizar el PDF
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="row wrap" style={{ marginTop: 18 }}>
            <button type="button" className="btn ghost" onClick={() => setStep(1)}>
              ← Cambiar archivo
            </button>
            <span className="spacer" />
            <button
              type="button"
              className="btn primary"
              onClick={() => setStep(3)}
              disabled={busy || (!events.length && !pdfBlob)}
            >
              Continuar a metadatos →
            </button>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <div className="grid-2">
            <div className="card">
              <div className="card-head">
                <h3>Metadatos</h3>
              </div>
              <div className="card-body stack">
                <div className="field">
                  <label htmlFor="upload-title">Título *</label>
                  <input id="upload-title" type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Sinfonía n.º 5" />
                </div>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="upload-composer">Compositor</label>
                    <input id="upload-composer" type="text" value={composer} onChange={(event) => setComposer(event.target.value)} placeholder="Ej. Ludwig van Beethoven" />
                  </div>
                  <div className="field">
                    <label htmlFor="upload-arranger">Arreglador</label>
                    <input id="upload-arranger" type="text" value={arranger} onChange={(event) => setArranger(event.target.value)} placeholder="Opcional" />
                  </div>
                </div>
                <div className="field-row three">
                  <div className="field">
                    <label htmlFor="upload-tempo">Tempo (BPM)</label>
                    <input id="upload-tempo" type="number" min={30} max={240} value={tempo} onChange={(event) => setTempo(Number(event.target.value) || 90)} />
                  </div>
                  <div className="field">
                    <label htmlFor="upload-key2">Armadura</label>
                    <select id="upload-key2" value={keyFifths} onChange={(event) => setKeyFifths(Number(event.target.value))}>
                      {KEY_OPTIONS.map((fifths) => (
                        <option key={fifths} value={fifths}>{keyName(fifths)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="upload-clef2">Clave</label>
                    <select id="upload-clef2" value={clef} onChange={(event) => setClef(event.target.value as Clef)}>
                      {CLEFS.map((option) => (
                        <option key={option} value={option}>{CLEF_LABEL[option]}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="upload-notes">Notas para los músicos</label>
                  <textarea id="upload-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Indicaciones de ensayo, dinámica, instrumentos que doblan…" />
                </div>
                <div className="row wrap small muted">
                  <Badge>{events.length} eventos</Badge>
                  <Badge>{partMeta.names.length} pentagrama(s)</Badge>
                  {pdfBlob ? <Badge tone="blue">PDF {pdfPages ?? "?"} pág.</Badge> : null}
                  {summary ? <Badge tone="teal">OMR {Math.round(summary.confidence * 100)}%</Badge> : null}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h3>Asignar por instrumento *</h3>
                <span className="spacer" />
                <span className="small muted">{instruments.length} seleccionados</span>
              </div>
              <div className="card-body">
                <InstrumentPicker selected={instruments} onChange={setInstruments} />
              </div>
            </div>
          </div>

          <div className="section-head">
            <div>
              <h2>Vista previa de la notación</h2>
              <p>Revisión rápida antes de guardar. Los cambios de metadatos se reflejan al actualizar.</p>
            </div>
            <span className="spacer" />
            <button type="button" className="btn small ghost" onClick={() => setPreviewXml(xml)}>
              ↻ Actualizar vista previa
            </button>
          </div>

          <div className="viewer-frame">
            <div className="viewer-toolbar">
              <span>{title || "Partitura sin título"}</span>
              <span className="spacer" />
              <span className="mono">{keyName(keyFifths)} · {beats}/{beatType} · ♩={tempo}</span>
            </div>
            <div className="viewer-body">
              {previewXml ? (
                <ScoreRenderer xml={previewXml} />
              ) : (
                <div className="small muted" style={{ padding: 20 }}>
                  Actualizá la vista previa para dibujar la notación.
                </div>
              )}
            </div>
          </div>

          <div className="row wrap" style={{ marginTop: 18 }}>
            <button type="button" className="btn ghost" onClick={() => setStep(2)}>
              ← Volver a la lectura
            </button>
            <span className="spacer" />
            <button type="button" className="btn primary lg" onClick={() => void save()} disabled={busy}>
              {busy ? "Guardando…" : "Guardar partitura"}
            </button>
          </div>
          {status ? <div className="small muted" style={{ marginTop: 10 }}>{status}</div> : null}
        </>
      ) : null}
    </>
  );
}
