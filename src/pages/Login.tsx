import { useMemo, useState } from "react";
import { store, useApp } from "../lib/store";
import { instrumentById } from "../lib/music";
import { Avatar } from "../components/UI";
import { navigate } from "../lib/router";

type Access = "director" | "musician";

export function Login() {
  const app = useApp();
  const [access, setAccess] = useState<Access>("director");

  const directors = useMemo(() => app.profiles.filter((profile) => profile.role === "director"), [app.profiles]);
  const musicians = useMemo(() => app.profiles.filter((profile) => profile.role === "musician"), [app.profiles]);
  const list = access === "director" ? directors : musicians;
  const instruments = useMemo(() => {
    const ids = new Set<string>();
    app.scores.forEach((score) => score.instrumentIds.forEach((id) => ids.add(id)));
    return ids.size;
  }, [app.scores]);
  const pdfs = app.scores.filter((score) => score.pdfId).length;

  const enter = (profileId: string) => {
    store.login(profileId);
    navigate("/");
  };

  return (
    <div className="login">
      <section className="login-hero">
        <div className="login-brand">
          <span className="mark" aria-hidden="true">
            𝄞
          </span>
          <span>
            <span className="name">Atril</span>
            <span className="sub">Gestión musical de orquesta</span>
          </span>
        </div>
        <div className="eyebrow" style={{ color: "var(--brass-2)" }}>
          {app.orchestra.name}
        </div>
        <h1>
          Toda la orquesta, <em>en la misma página.</em>
        </h1>
        <p className="lead">
          El director sube y asigna partituras por instrumento. Cada músico entra, ve su material, lo descarga, lo
          imprime y escucha cómo suena en su propio instrumento.
        </p>
        <ul className="login-points">
          <li>
            <span className="dot">1</span>
            <span>
              <strong>PDF por instrumento.</strong> Violines, flautas, clarinetes, piano, guitarra y cualquier familia
              de la orquesta.
            </span>
          </li>
          <li>
            <span className="dot">2</span>
            <span>
              <strong>Lector OMR con claves.</strong> Detecta pentagramas, notas y claves de sol, fa y do, con
              transposición automática.
            </span>
          </li>
          <li>
            <span className="dot">3</span>
            <span>
              <strong>Audio inteligente.</strong> Reproduce la pieza con el timbre del instrumento asignado y control de
              tempo.
            </span>
          </li>
        </ul>
        <div className="login-stats">
          <div>
            <b>{app.scores.length}</b>
            <span>Partituras</span>
          </div>
          <div>
            <b>{musicians.length}</b>
            <span>Músicos</span>
          </div>
          <div>
            <b>{instruments}</b>
            <span>Instrumentos</span>
          </div>
          <div>
            <b>{pdfs}</b>
            <span>PDFs cargados</span>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <div className="access-card">
          <div className="eyebrow">Acceso de demostración</div>
          <h2>¿Quién entra al atril?</h2>
          <p className="muted small" style={{ marginTop: 4 }}>
            Elegí un perfil. Los datos se guardan en este dispositivo con almacenamiento local.
          </p>

          <div className="access-tabs" role="tablist" aria-label="Tipo de perfil">
            <button
              type="button"
              role="tab"
              aria-selected={access === "director"}
              className={access === "director" ? "active" : ""}
              onClick={() => setAccess("director")}
            >
              🎼 Director
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={access === "musician"}
              className={access === "musician" ? "active" : ""}
              onClick={() => setAccess("musician")}
            >
              🎻 Músico
            </button>
          </div>

          <div className="profile-list">
            {list.map((profile) => {
              const instrument = instrumentById(profile.instrumentId);
              return (
                <button key={profile.id} type="button" className="profile-option" onClick={() => enter(profile.id)}>
                  <Avatar name={profile.name} color={profile.color} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="p-name">{profile.name}</span>
                    <span className="p-sub">
                      {profile.role === "director"
                        ? "Dirección de orquesta"
                        : instrument
                          ? `${instrument.name} · ${instrument.family}`
                          : "Músico sin instrumento"}
                    </span>
                  </span>
                  <span aria-hidden="true" style={{ color: "var(--muted)" }}>
                    →
                  </span>
                </button>
              );
            })}
            {!list.length ? (
              <div className="small muted" style={{ padding: 12 }}>
                No hay perfiles de {access === "director" ? "dirección" : "músicos"} todavía. Entrá como director para
                crearlos.
              </div>
            ) : null}
          </div>

          {!directors.length ? (
            <button
              type="button"
              className="btn primary"
              style={{ width: "100%", marginTop: 10 }}
              onClick={() => {
                const created = store.addProfile({ name: "Dirección", role: "director" });
                store.login(created.id);
                navigate("/");
              }}
            >
              Crear perfil de dirección
            </button>
          ) : null}

          <div className="login-foot">
            Código de orquesta <span className="badge brass">{app.orchestra.code}</span> · Atril funciona sin servidor:
            los PDFs viven en tu navegador.
          </div>
        </div>
      </section>
    </div>
  );
}
