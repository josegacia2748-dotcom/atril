import { useEffect, useRef, useState } from "react";
import { store, useApp, useProfile } from "../lib/store";
import type { AppState } from "../lib/types";
import { instrumentName } from "../lib/music";
import { clearPdfs, pdfCount } from "../lib/idb";
import { downloadBlob } from "../lib/pdf";
import { Avatar, Badge, Callout, PageHead } from "../components/UI";
import { InstrumentSelect } from "../components/InstrumentPicker";

export function Settings() {
  const app = useApp();
  const profile = useProfile();
  const [name, setName] = useState(profile?.name ?? "");
  const [instrumentId, setInstrumentId] = useState(profile?.instrumentId ?? "violin");
  const [savedProfile, setSavedProfile] = useState(false);

  const [orchestraName, setOrchestraName] = useState(app.orchestra.name);
  const [orchestraCode, setOrchestraCode] = useState(app.orchestra.code);
  const [orchestraCity, setOrchestraCity] = useState(app.orchestra.city);
  const [savedOrchestra, setSavedOrchestra] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [files, setFiles] = useState(0);
  const [copied, setCopied] = useState(false);
  const importRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setInstrumentId(profile.instrumentId ?? "violin");
  }, [profile]);

  useEffect(() => {
    pdfCount()
      .then(setFiles)
      .catch(() => setFiles(0));
  }, [app.scores]);

  if (!profile) return null;
  const isDirector = profile.role === "director";

  const saveProfile = () => {
    if (!name.trim()) {
      setError("El nombre no puede quedar vacío.");
      return;
    }
    store.updateProfile(profile.id, {
      name: name.trim(),
      instrumentId: profile.role === "musician" ? instrumentId : undefined,
    });
    setSavedProfile(true);
    setError("");
    window.setTimeout(() => setSavedProfile(false), 2200);
  };

  const saveOrchestra = () => {
    if (!orchestraName.trim() || !orchestraCode.trim()) {
      setError("El nombre y el código de la orquesta son obligatorios.");
      return;
    }
    store.setOrchestra({
      name: orchestraName.trim(),
      code: orchestraCode.trim().toUpperCase(),
      city: orchestraCity.trim(),
    });
    setSavedOrchestra(true);
    setError("");
    window.setTimeout(() => setSavedOrchestra(false), 2200);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(app.orchestra.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const exportData = () => {
    const payload = JSON.stringify(app, null, 2);
    downloadBlob(new Blob([payload], { type: "application/json" }), "atril-respaldo.json");
    setMessage("Respaldo descargado. Incluye metadatos y perfiles, no los PDFs.");
  };

  const importData = async (file: File) => {
    setError("");
    setMessage("");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<AppState>;
      if (!Array.isArray(parsed.profiles) || !Array.isArray(parsed.scores)) {
        throw new Error("El archivo no parece un respaldo de Atril.");
      }
      const next: AppState = {
        ...app,
        ...parsed,
        profiles: parsed.profiles,
        scores: parsed.scores,
        orchestra: { ...app.orchestra, ...(parsed.orchestra ?? {}) },
        theme: parsed.theme === "light" ? "light" : "dark",
        currentProfileId:
          parsed.currentProfileId && parsed.profiles.some((item) => item.id === parsed.currentProfileId)
            ? parsed.currentProfileId
            : app.currentProfileId,
        seeded: true,
      };
      store.replaceState(next);
      setMessage("Respaldo importado. Los PDFs deben volver a cargarse si no están en este navegador.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo importar el respaldo.");
    }
  };

  const resetDemo = async () => {
    if (!window.confirm("¿Restablecer los datos de demostración? Se reemplazan perfiles y partituras.")) return;
    await clearPdfs().catch(() => undefined);
    store.resetDemo();
    setMessage("Demostración restablecida: 4 partituras, 1 director y 8 músicos.");
  };

  const clearScores = async () => {
    if (!window.confirm("¿Borrar todas las partituras y sus PDFs? Los perfiles se conservan.")) return;
    await clearPdfs().catch(() => undefined);
    store.clearScores();
    setMessage("Biblioteca vacía. Los perfiles siguen disponibles.");
  };

  const clearAll = async () => {
    if (!window.confirm("¿Borrar todos los datos de Atril en este dispositivo? Esta acción no se puede deshacer.")) return;
    await clearPdfs().catch(() => undefined);
    store.clearAll();
  };

  return (
    <>
      <PageHead
        eyebrow="Ajustes"
        title={isDirector ? "Configuración de la orquesta" : "Mi perfil de músico"}
        lead="Editá tus datos, el tema visual y la información de la orquesta. Todo se guarda en este navegador."
      />

      {message ? <Callout tone="ok">{message}</Callout> : null}
      {error ? <Callout tone="warn">{error}</Callout> : null}

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h3>Mi perfil</h3>
            <span className="spacer" />
            <Badge tone={isDirector ? "brass" : "teal"}>{isDirector ? "Director/a" : "Músico"}</Badge>
          </div>
          <div className="card-body stack">
            <div className="row" style={{ gap: 12 }}>
              <Avatar name={name || profile.name} color={profile.color} />
              <div>
                <div style={{ fontWeight: 650 }}>{name || profile.name}</div>
                <div className="small muted">
                  {isDirector ? "Acceso completo a la biblioteca" : instrumentName(instrumentId)}
                </div>
              </div>
            </div>
            <div className="field">
              <label htmlFor="settings-name">Nombre visible</label>
              <input id="settings-name" type="text" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            {!isDirector ? (
              <div className="field">
                <label htmlFor="settings-instrument">Instrumento</label>
                <InstrumentSelect id="settings-instrument" value={instrumentId} onChange={setInstrumentId} />
                <span className="hint">Determina las partituras asignadas y la transposición de tu parte.</span>
              </div>
            ) : null}
            <div className="row">
              <button type="button" className="btn primary" onClick={saveProfile}>
                Guardar perfil
              </button>
              {savedProfile ? <span className="small" style={{ color: "var(--ok)" }}>✓ Guardado</span> : null}
              <span className="spacer" />
              <button type="button" className="btn ghost" onClick={() => store.logout()}>
                Cerrar sesión
              </button>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Orquesta</h3>
            <span className="spacer" />
            <button type="button" className="btn small ghost" onClick={copyCode}>
              {copied ? "✓ Copiado" : "Copiar código"}
            </button>
          </div>
          <div className="card-body stack">
            {isDirector ? (
              <>
                <div className="field">
                  <label htmlFor="settings-orchestra">Nombre</label>
                  <input id="settings-orchestra" type="text" value={orchestraName} onChange={(event) => setOrchestraName(event.target.value)} />
                </div>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="settings-code">Código</label>
                    <input id="settings-code" type="text" value={orchestraCode} onChange={(event) => setOrchestraCode(event.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="settings-city">Ciudad</label>
                    <input id="settings-city" type="text" value={orchestraCity} onChange={(event) => setOrchestraCity(event.target.value)} />
                  </div>
                </div>
                <div className="row">
                  <button type="button" className="btn primary" onClick={saveOrchestra}>
                    Guardar orquesta
                  </button>
                  {savedOrchestra ? <span className="small" style={{ color: "var(--ok)" }}>✓ Guardado</span> : null}
                </div>
              </>
            ) : (
              <>
                <div className="small muted">Datos de la orquesta</div>
                <div style={{ fontFamily: "var(--serif)", fontSize: 22 }}>{app.orchestra.name}</div>
                <div className="small" style={{ color: "var(--ink-2)" }}>{app.orchestra.city}</div>
                <Badge tone="brass">Código {app.orchestra.code}</Badge>
                <Callout tone="info">Solo el perfil de dirección puede editar la información de la orquesta.</Callout>
              </>
            )}
          </div>
        </section>
      </div>

      <div className="grid-2" style={{ marginTop: 18 }}>
        <section className="card">
          <div className="card-head">
            <h3>Apariencia</h3>
          </div>
          <div className="card-body stack">
            <div className="field">
              <label>Tema</label>
              <div className="row wrap">
                <button type="button" className={`chip${app.theme === "dark" ? " active" : ""}`} onClick={() => app.theme !== "dark" && store.toggleTheme()}>
                  ☾ Sala de conciertos (oscuro)
                </button>
                <button type="button" className={`chip${app.theme === "light" ? " active" : ""}`} onClick={() => app.theme !== "light" && store.toggleTheme()}>
                  ☀ Papel de partitura (claro)
                </button>
              </div>
            </div>
            <Callout tone="info" icon="🎨">
              El tema se aplica a toda la interfaz y se recuerda en este dispositivo.
            </Callout>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Datos y respaldo</h3>
            <span className="spacer" />
            <Badge>{files} PDF{files === 1 ? "" : "s"}</Badge>
          </div>
          <div className="card-body stack">
            <p className="small muted" style={{ margin: 0 }}>
              Atril es local-first: metadatos en <code>localStorage</code> y PDFs en <code>IndexedDB</code>. El respaldo
              JSON incluye perfiles, partituras y asignaciones, pero no los archivos PDF.
            </p>
            <div className="row wrap">
              <button type="button" className="btn" onClick={exportData}>
                ⬇ Exportar respaldo
              </button>
              <button type="button" className="btn" onClick={() => importRef.current?.click()}>
                ⬆ Importar respaldo
              </button>
              <input
                ref={importRef}
                type="file"
                accept="application/json,.json"
                style={{ display: "none" }}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importData(file);
                  event.target.value = "";
                }}
              />
            </div>
            <div className="divider" style={{ margin: "4px 0" }} />
            <div className="row wrap">
              <button type="button" className="btn" onClick={() => void resetDemo()}>
                ↻ Restablecer demostración
              </button>
              {isDirector ? (
                <button type="button" className="btn danger" onClick={() => void clearScores()}>
                  Borrar partituras
                </button>
              ) : null}
              <button type="button" className="btn danger" onClick={() => void clearAll()}>
                Borrar todos los datos
              </button>
            </div>
            <div className="small muted">
              Partituras: {app.scores.length} · Perfiles: {app.profiles.length} · PDFs: {files}
            </div>
          </div>
        </section>
      </div>

      <section className="card card-pad" style={{ marginTop: 18 }}>
        <div className="eyebrow">Acerca de Atril</div>
        <h3 style={{ margin: "6px 0 8px" }}>Lectura, asignación y audio para orquestas</h3>
        <p className="small" style={{ color: "var(--ink-2)", marginBottom: 10 }}>
          Atril combina pdf.js para la lectura de PDF, OpenSheetMusicDisplay para la notación, un lector OMR propio para
          interpretar pentagramas y claves, y Tone.js para la síntesis por familia de instrumentos. La interfaz está en
          español y funciona en cualquier dispositivo con un navegador moderno.
        </p>
        <div className="chips">
          <Badge tone="brass">v1.0</Badge>
          <Badge>React 19</Badge>
          <Badge>Vite 8</Badge>
          <Badge>pdf.js</Badge>
          <Badge>OSMD</Badge>
          <Badge>Tone.js</Badge>
          <Badge>OMR propio</Badge>
        </div>
      </section>
    </>
  );
}
