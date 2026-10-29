import { useEffect, useState, type ReactNode } from "react";
import { store, useApp, useProfile } from "../lib/store";
import { useRoute } from "../lib/router";
import { instrumentById, instrumentName } from "../lib/music";
import { Avatar } from "./UI";

type NavItem = { path: string; label: string; icon: string };

const DIRECTOR_NAV: NavItem[] = [
  { path: "/", label: "Panel del director", icon: "▦" },
  { path: "/subir", label: "Subir partitura", icon: "＋" },
  { path: "/biblioteca", label: "Biblioteca", icon: "♫" },
  { path: "/musicos", label: "Músicos", icon: "👥" },
  { path: "/ajustes", label: "Ajustes", icon: "⚙" },
];

const MUSICIAN_NAV: NavItem[] = [
  { path: "/", label: "Mis partituras", icon: "♫" },
  { path: "/ajustes", label: "Mi perfil", icon: "⚙" },
];

function isActive(path: string, current: string): boolean {
  if (path === "/") return current === "/";
  return current === path || current.startsWith(`${path}/`);
}

export function Shell({ children }: { children: ReactNode }) {
  const app = useApp();
  const profile = useProfile();
  const route = useRoute();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [route.hash]);

  if (!profile) return <>{children}</>;

  const nav = profile.role === "director" ? DIRECTOR_NAV : MUSICIAN_NAV;
  const instrument = instrumentById(profile.instrumentId);

  return (
    <div className="app">
      <aside className={`sidebar${open ? " open" : ""}`} aria-label="Navegación principal">
        <a className="sidebar-brand" href="#/">
          <span className="mark" aria-hidden="true">
            𝄞
          </span>
          <span>
            <span className="brand-name">Atril</span>
            <span className="brand-sub">Partituras de orquesta</span>
          </span>
        </a>
        <div className="sidebar-scroll">
          <div className="nav-label">Orquesta</div>
          <div className="card" style={{ padding: 12, marginBottom: 8 }}>
            <div style={{ fontWeight: 650, fontSize: 13.5 }}>{app.orchestra.name}</div>
            <div className="small muted">{app.orchestra.city}</div>
            <div className="badge brass" style={{ marginTop: 7 }}>
              Código {app.orchestra.code}
            </div>
          </div>
          <div className="nav-label">{profile.role === "director" ? "Dirección" : "Músico"}</div>
          {nav.map((item) => (
            <a
              key={item.path}
              className={`nav-item${isActive(item.path, route.path) ? " active" : ""}`}
              href={`#${item.path}`}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </a>
          ))}
          {profile.role === "director" ? (
            <>
              <div className="nav-label">Accesos rápidos</div>
              <a className="nav-item" href="#/subir">
                <span className="nav-icon" aria-hidden="true">
                  ⬆
                </span>
                Cargar PDF o MusicXML
              </a>
              <a className="nav-item" href="#/biblioteca?filtro=omr">
                <span className="nav-icon" aria-hidden="true">
                  🔍
                </span>
                Partituras con OMR
              </a>
            </>
          ) : (
            <div className="card" style={{ padding: 12, marginTop: 12 }}>
              <div className="eyebrow" style={{ fontSize: 10 }}>
                Tu instrumento
              </div>
              <div className="row" style={{ marginTop: 6 }}>
                <span style={{ fontSize: 20 }} aria-hidden="true">
                  {instrument?.icon ?? "🎵"}
                </span>
                <div>
                  <div style={{ fontWeight: 650, fontSize: 13 }}>{instrumentName(profile.instrumentId)}</div>
                  <div className="small muted">
                    {instrument ? `${instrument.family} · ${instrument.range}` : "Definilo en Mi perfil"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="sidebar-footer">
          <div className="row" style={{ gap: 9 }}>
            <Avatar name={profile.name} color={profile.color} size="sm" />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 650, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {profile.name}
              </div>
              <div className="small muted">
                {profile.role === "director" ? "Director/a" : instrumentName(profile.instrumentId)}
              </div>
            </div>
            <button
              type="button"
              className="icon-btn"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              onClick={() => store.logout()}
            >
              ⏻
            </button>
          </div>
        </div>
      </aside>

      {open ? <div className="modal-backdrop" style={{ zIndex: 35 }} onClick={() => setOpen(false)} /> : null}

      <div className="main">
        <div className="topbar">
          <button
            type="button"
            className="icon-btn menu-btn"
            aria-label="Abrir menú"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            ☰
          </button>
          <div className="small muted" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {app.orchestra.name} · {app.orchestra.code}
          </div>
          <button
            type="button"
            className="icon-btn"
            title={app.theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
            aria-label="Cambiar tema"
            onClick={() => store.toggleTheme()}
          >
            {app.theme === "dark" ? "☀" : "☾"}
          </button>
          <a className="icon-btn" href="#/ajustes" title="Ajustes" aria-label="Ajustes">
            ⚙
          </a>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
