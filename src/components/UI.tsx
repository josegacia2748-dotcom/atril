import { useEffect, type ReactNode } from "react";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function Avatar({
  name,
  color,
  size = "md",
}: {
  name: string;
  color: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={`avatar${size === "sm" ? " sm" : ""}`}
      style={{ background: color }}
      title={name}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function Badge({
  children,
  tone,
  title,
}: {
  children: ReactNode;
  tone?: "brass" | "teal" | "red" | "ok" | "blue";
  title?: string;
}) {
  return (
    <span className={`badge${tone ? ` ${tone}` : ""}`} title={title}>
      {children}
    </span>
  );
}

export function Callout({
  children,
  tone = "info",
  icon,
}: {
  children: ReactNode;
  tone?: "info" | "warn" | "ok";
  icon?: string;
}) {
  return (
    <div className={`callout ${tone}`}>
      <span className="ico" aria-hidden="true">
        {icon ?? (tone === "warn" ? "⚠" : tone === "ok" ? "✓" : "ℹ")}
      </span>
      <div>{children}</div>
    </div>
  );
}

export function Empty({
  icon = "🎼",
  title,
  children,
  action,
}: {
  icon?: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div style={{ fontSize: 38 }} aria-hidden="true">
        {icon}
      </div>
      <h3>{title}</h3>
      {children ? <p style={{ maxWidth: "46ch", margin: 0 }}>{children}</p> : null}
      {action}
    </div>
  );
}

export function PageHead({
  eyebrow,
  title,
  lead,
  actions,
}: {
  eyebrow?: string;
  title: string;
  lead?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
      <h1>{title}</h1>
      {lead ? <p className="lead">{lead}</p> : null}
      {actions ? <div className="row wrap" style={{ marginTop: 14 }}>{actions}</div> : null}
    </header>
  );
}

export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="crumbs" aria-label="Migas de pan">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="row" style={{ gap: 7 }}>
          {index > 0 ? <span className="sep">/</span> : null}
          {item.href ? <a href={item.href}>{item.label}</a> : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function Stat({
  value,
  label,
  hint,
}: {
  value: ReactNode;
  label: string;
  hint?: ReactNode;
}) {
  return (
    <div className="stat">
      <b>{value}</b>
      <span>{label}</span>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

export function Progress({ value, label }: { value: number; label?: string }) {
  const safe = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="progress" role="progressbar" aria-valuenow={Math.round(safe * 100)} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: `${safe * 100}%` }} />
      </div>
      {label ? <div className="small muted">{label}</div> : null}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-head">
          <h3>{title}</h3>
          <span className="spacer" />
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}
