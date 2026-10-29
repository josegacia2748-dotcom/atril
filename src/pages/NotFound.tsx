export function NotFound() {
  return (
    <div className="empty" style={{ minHeight: 320 }}>
      <div style={{ fontSize: 44 }} aria-hidden="true">
        𝄽
      </div>
      <h3>Esta página no existe</h3>
      <p style={{ maxWidth: "44ch" }}>
        El enlace puede estar roto o la sección cambió de lugar. Volvé al panel para seguir trabajando con la orquesta.
      </p>
      <a className="btn primary" href="#/">
        Volver al inicio
      </a>
    </div>
  );
}
