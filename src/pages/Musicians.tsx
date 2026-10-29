import { useMemo, useState } from "react";
import { store, useApp, useProfile } from "../lib/store";
import { instrumentById, instrumentName } from "../lib/music";
import { navigate } from "../lib/router";
import { Avatar, Badge, Callout, Empty, Modal, PageHead } from "../components/UI";
import { InstrumentSelect } from "../components/InstrumentPicker";

export function Musicians() {
  const app = useApp();
  const current = useProfile();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<"musician" | "director">("musician");
  const [instrumentId, setInstrumentId] = useState("violin");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const sorted = useMemo(
    () =>
      [...app.profiles].sort((a, b) => {
        if (a.role !== b.role) return a.role === "director" ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [app.profiles],
  );

  const assignedCount = (instrument?: string) =>
    instrument ? app.scores.filter((score) => score.instrumentIds.includes(instrument)).length : 0;

  const submit = () => {
    if (!name.trim()) {
      setError("Escribí el nombre del perfil.");
      return;
    }
    store.addProfile({ name, role, instrumentId: role === "musician" ? instrumentId : undefined });
    setName("");
    setRole("musician");
    setInstrumentId("violin");
    setError("");
    setOpen(false);
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

  return (
    <>
      <PageHead
        eyebrow="Perfiles de la orquesta"
        title="Músicos y dirección"
        lead="Creá un perfil por cada integrante. El instrumento define qué partituras ve cada músico y qué transposición se aplica."
        actions={
          <>
            <button type="button" className="btn primary" onClick={() => setOpen(true)}>
              ＋ Agregar perfil
            </button>
            <button type="button" className="btn" onClick={copyCode}>
              {copied ? "✓ Código copiado" : `Copiar código ${app.orchestra.code}`}
            </button>
          </>
        }
      />

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <div className="stat">
          <b>{app.profiles.filter((profile) => profile.role === "musician").length}</b>
          <span>Músicos</span>
        </div>
        <div className="stat">
          <b>{app.profiles.filter((profile) => profile.role === "director").length}</b>
          <span>Dirección</span>
        </div>
        <div className="stat">
          <b>{app.orchestra.code}</b>
          <span>Código de orquesta</span>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Perfil</th>
              <th>Rol</th>
              <th>Instrumento</th>
              <th>Partituras</th>
              <th style={{ textAlign: "right" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((profile) => {
              const instrument = instrumentById(profile.instrumentId);
              const count = assignedCount(profile.instrumentId);
              return (
                <tr key={profile.id}>
                  <td>
                    <div className="row" style={{ gap: 10 }}>
                      <Avatar name={profile.name} color={profile.color} size="sm" />
                      <div>
                        <div style={{ fontWeight: 650 }}>{profile.name}</div>
                        <div className="small muted">
                          {profile.role === "director" ? "Dirección de orquesta" : "Músico"}
                          {profile.id === current?.id ? " · vos" : ""}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge tone={profile.role === "director" ? "brass" : "teal"}>
                      {profile.role === "director" ? "Director/a" : "Músico"}
                    </Badge>
                  </td>
                  <td>
                    {instrument ? (
                      <span className="row" style={{ gap: 7 }}>
                        <span aria-hidden="true">{instrument.icon}</span>
                        <span>{instrument.name}</span>
                        <span className="small muted">{instrument.family}</span>
                      </span>
                    ) : (
                      <span className="muted small">—</span>
                    )}
                  </td>
                  <td>
                    {profile.role === "musician" ? (
                      <a href={`#/biblioteca?instrumento=${profile.instrumentId ?? ""}`} className="badge blue">
                        {count} asignada{count === 1 ? "" : "s"}
                      </a>
                    ) : (
                      <span className="small muted">Toda la biblioteca</span>
                    )}
                  </td>
                  <td>
                    <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                      <button
                        type="button"
                        className="btn small ghost"
                        onClick={() => {
                          store.login(profile.id);
                          navigate("/");
                        }}
                      >
                        Entrar
                      </button>
                      <button
                        type="button"
                        className="btn small danger"
                        onClick={() => {
                          if (!window.confirm(`¿Eliminar el perfil de ${profile.name}?`)) return;
                          store.removeProfile(profile.id);
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!sorted.length ? (
        <Empty icon="👥" title="No hay perfiles" action={<button type="button" className="btn primary" onClick={() => setOpen(true)}>Crear el primero</button>}>
          Agregá a los integrantes de la orquesta para asignarles material.
        </Empty>
      ) : null}

      <Callout tone="info" icon="💡">
        Podés cambiar de perfil con el botón <strong>Entrar</strong> para probar la experiencia de cada músico. Al
        eliminar un perfil no se borran las partituras, solo el acceso de esa persona.
      </Callout>

      <Modal
        open={open}
        title="Nuevo perfil"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="btn primary" onClick={submit}>
              Crear perfil
            </button>
          </>
        }
      >
        <div className="stack">
          <div className="field">
            <label htmlFor="profile-name">Nombre</label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Valeria Núñez"
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="profile-role">Rol</label>
            <select id="profile-role" value={role} onChange={(event) => setRole(event.target.value as "musician" | "director")}>
              <option value="musician">Músico</option>
              <option value="director">Director/a</option>
            </select>
          </div>
          {role === "musician" ? (
            <div className="field">
              <label htmlFor="profile-instrument">Instrumento</label>
              <InstrumentSelect id="profile-instrument" value={instrumentId} onChange={setInstrumentId} />
              <span className="hint">
                {instrumentId
                  ? `${instrumentName(instrumentId)} · ${instrumentById(instrumentId)?.family ?? ""}`
                  : "Elegí el instrumento principal"}
              </span>
            </div>
          ) : (
            <Callout tone="info">El perfil de dirección puede ver y asignar toda la biblioteca.</Callout>
          )}
          {error ? <Callout tone="warn">{error}</Callout> : null}
        </div>
      </Modal>
    </>
  );
}
